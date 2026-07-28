'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { AppointmentDoc, AppointmentStatus, EncounterDoc, LabResultDoc } from '@/lib/db-types';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  MoreVertical,
  Pill,
  Plus,
  Printer,
  Search,
  Send,
  Stethoscope,
  Video,
  X,
} from '@/components/icons/lucide';
import { initials, stateTint, AVATAR_TINT_NEUTRAL } from '@/lib/patient-utils';
// One palette for "what is this and how urgent" across the bell and the rail.
import { NOTIFICATION_META, SEVERITY_META } from '@/lib/notification-meta';
import type { NotificationSeverity, NotificationType } from '@/lib/hooks/useNotifications';
import { formatClockTime, formatTimeUntil } from '@/lib/format-utils';
import { useToast } from '@/components/Toast';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePatients } from '@/lib/hooks/usePatients';
import { useWards } from '@/lib/hooks/useWards';
import Modal from '@/components/Modal';
import {
  toIsoDate,
  parseIsoDate,
  startOfMonth,
  addMonths,
  addDays,
  formatMonthTitle,
} from '@/components/ehr/EhrMiniCalendar';
import { EhrWeekActivityChart, type DayStatsItem } from '@/components/ehr/EhrDayStatsChart';
import EhrVisitPopup, { EhrQueueMoveDialog, PRIORITY_META, waitLabel } from '@/components/ehr/EhrVisitPopup';
import { useTriage } from '@/lib/hooks/useTriage';
import { useAuth } from '@/lib/context';
import { buildQueueFromTriage, STAGE_LABELS, type QueueEntry } from '@/lib/services/patient-queue-service';
import type { TriageDoc } from '@/lib/db-types';
import { encountersDB, labResultsDB } from '@/lib/db';
import { makeCoalescer } from '@/lib/hooks/live-reload';
import { tooltipStyle, axisTick } from '@/components/ChartCard';

function appointmentTriage(priority: AppointmentDoc['priority']) {
  if (priority === 'emergency') return 'RED';
  if (priority === 'urgent') return 'YELLOW';
  return 'GREEN';
}

type WorklistPatient = {
  _id: string;
  /** Patient portrait; the avatar falls back to initials when absent. */
  photoUrl?: string;
  name: string;
  age: number | null;
  gender: string;
  id?: string;
  ward?: string;
  doctor?: string;
  nurse?: string;
  division?: string;
  triagePriority?: 'RED' | 'YELLOW' | 'GREEN';
};

type UnifiedPatientRow = {
  id: string;
  photoUrl?: string;
  patient: WorklistPatient | null;
  appointment: AppointmentDoc | null;
  name: string;
  patientId?: string;
  triagePriority: 'RED' | 'YELLOW' | 'GREEN';
  reason: string;
  timeLabel: string;
  status: AppointmentStatus;
  department: string;
  provider: string;
  isAssigned: boolean;
};

/**
 * One row of the rail's "Needs your attention" feed. `type` picks the icon and
 * hue (shared with the notification bell via NOTIFICATION_META) and answers
 * "what kind of thing is this"; `severity` picks the tint and answers "how
 * hard is it pushing". They are deliberately separate: a lab result is purple
 * whether it is critical or routine.
 */
type RailAction = {
  key: string;
  type: Extract<NotificationType, 'lab' | 'triage' | 'appointment'>;
  severity: NotificationSeverity;
  title: string;
  meta: string;
  /** Ties broken inside a severity band — bigger is more urgent (minutes
   *  waiting, hours overdue). */
  weight: number;
  onOpen: () => void;
};

const SEVERITY_RANK: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** One row inside an outstanding-item worklist (a document to sign, an open
 *  referral, a paused encounter, …) rendered inline in the centre panel. */
export type OutstandingEntry = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: 'neutral' | 'warning' | 'danger';
  href?: string;
};

type OutstandingItem = {
  label: string;
  count: number;
  tone?: 'neutral' | 'warning' | 'danger';
  href?: string;
  /** The actual items behind the count — clicking the card swaps the centre
   *  panel (schedule area) for this list instead of navigating away. */
  entries?: OutstandingEntry[];
};

const statusOptions: AppointmentStatus[] = ['requested', 'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];

function statusLabel(status: AppointmentStatus) {
  if (status === 'checked_in') return 'Checked in';
  if (status === 'in_progress') return 'Roomed';
  if (status === 'completed') return 'Checked out';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function typeLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatAppointmentDate(value: string) {
  const date = parseIsoDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(date);
}

function appointmentTimeRange(appointment: AppointmentDoc) {
  const start = formatClockTime(appointment.appointmentTime || '00:00');
  if (appointment.endTime) return `${start} - ${formatClockTime(appointment.endTime)}`;
  return `${start} · ${appointment.duration}m`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="appointment-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function statusTone(status: AppointmentStatus) {
  if (status === 'completed') return 'done';
  if (status === 'checked_in' || status === 'in_progress') return 'active';
  if (status === 'confirmed') return 'ready';
  return 'scheduled';
}

// Outstanding-entry tone → triage-style avatar color and a status pill,
// reusing the codebase's existing tone vocabulary (Overdue/Needs
// attention/Open already appear elsewhere as status labels) rather than
// inventing new copy per entry.
function outstandingTonePriority(tone?: OutstandingEntry['tone']): 'RED' | 'YELLOW' | 'GREEN' {
  if (tone === 'danger') return 'RED';
  if (tone === 'warning') return 'YELLOW';
  return 'GREEN';
}

function outstandingPillTone(tone?: OutstandingEntry['tone']) {
  if (tone === 'danger') return { key: 'red', label: 'Overdue' };
  if (tone === 'warning') return { key: 'yellow', label: 'Needs attention' };
  return { key: 'green', label: 'Open' };
}

// Mirrors dashboard/lab/page.tsx's FLAG_COLORS convention (critical=red,
// abnormal=amber) rather than importing it — that page's constant isn't
// exported for reuse, so the same rgba/CSS-var values are matched here.
// A result that's overdue for review but neither flagged abnormal nor
// critical still needs a pill; it gets a neutral gray "Overdue" rather than
// inventing a fabricated severity.
function overdueFlagTone(result: Pick<LabResultDoc, 'critical' | 'abnormal'>) {
  if (result.critical) return { label: 'Critical', bg: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', border: 'rgba(239,68,68,0.25)' };
  if (result.abnormal) return { label: 'Abnormal', bg: 'rgba(251,191,36,0.12)', color: 'var(--color-warning)', border: 'rgba(251,191,36,0.25)' };
  return { label: 'Overdue', bg: 'rgba(148,163,184,0.14)', color: 'var(--text-muted)', border: 'rgba(148,163,184,0.28)' };
}

function departmentTone(value?: string) {
  const department = (value || '').toLowerCase();
  if (department.includes('emergency')) return 'emergency';
  if (department.includes('maternity')) return 'maternity';
  if (department.includes('pediatric')) return 'pediatrics';
  if (department.includes('surgery')) return 'surgery';
  if (department.includes('lab')) return 'lab';
  return 'opd';
}

export default function EhrClinicalDashboard({
  clinicianName,
  facilityName,
  patients,
  appointments,
  outstanding,
  onUpdateAppointmentStatus,
}: {
  clinicianName: string;
  facilityName?: string;
  patients: WorklistPatient[];
  appointments: AppointmentDoc[];
  outstanding: OutstandingItem[];
  onUpdateAppointmentStatus?: (appointmentId: string, status: AppointmentStatus) => Promise<void> | void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  // Gate the "Start consultation" action to roles that can actually consult.
  const { canConsult, canBookAppointments } = usePermissions();
  // Inpatient = the appointment's patient currently holds an active ward
  // admission; everyone else counts as outpatient (day-activity chart).
  const { activeAdmissions } = useWards();
  const admittedPatientIds = useMemo(() => new Set(activeAdmissions.map(admission => admission.patientId)), [activeAdmissions]);
  // Preferred language also lives on the patient record, not the appointment.
  const { patients: patientDocs } = usePatients();
  const patientLanguages = useMemo(() => {
    const map = new Map<string, string>();
    for (const patient of patientDocs) {
      if (patient.primaryLanguage) map.set(patient._id, patient.primaryLanguage);
    }
    return map;
  }, [patientDocs]);
  // Portraits for rows that come from an appointment rather than the assigned
  // worklist, so the same patient shows the same face on every surface.
  const photoByPatientId = useMemo(() => {
    const map = new Map<string, string>();
    for (const patient of patientDocs) {
      const photo = (patient as { photoUrl?: string }).photoUrl;
      if (photo) map.set(patient._id, photo);
    }
    return map;
  }, [patientDocs]);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const [view, setView] = useState<'dashboard' | 'calendar'>('dashboard');
  const [railOpen, setRailOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [openAppointment, setOpenAppointment] = useState<AppointmentDoc | null>(null);
  // Which action dropdown (if any) is open in the appointment detail popup.
  const [detailMenuOpen, setDetailMenuOpen] = useState<'note' | 'more' | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close whichever action dropdown is open on an outside click.
  useEffect(() => {
    if (!detailMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const ref = detailMenuOpen === 'note' ? noteMenuRef : moreMenuRef;
      if (ref.current && !ref.current.contains(event.target as Node)) setDetailMenuOpen(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [detailMenuOpen]);

  // A fresh appointment (or none) shouldn't inherit the previous one's open menu.
  useEffect(() => { setDetailMenuOpen(null); }, [openAppointment?._id]);

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [locationFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  // Which outstanding item's worklist occupies the centre panel (null = the
  // normal schedule). Keyed by item label.
  const [outstandingView, setOutstandingView] = useState<string | null>(null);

  // "Dispense" header action — searches the full patient register (not just
  // today's worklist) and hands off to the pharmacy dispense queue for the
  // chosen patient.
  const [findPatientOpen, setFindPatientOpen] = useState(false);
  const [findPatientQuery, setFindPatientQuery] = useState('');
  // Inline search under the mini-calendar that filters the day's appointment list.
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const findPatientInputRef = useRef<HTMLInputElement>(null);
  // Modal renders its children a tick after open (portal mount) and then
  // focuses its dialog, so autoFocus — and a 0ms refocus — both lose the
  // race. Focus the input once the dialog has settled.
  useEffect(() => {
    if (!findPatientOpen) return;
    const id = window.setTimeout(() => findPatientInputRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [findPatientOpen]);

  const findPatientResults = useMemo(() => {
    const query = findPatientQuery.trim().toLowerCase();
    if (!query) return [];
    return patientDocs
      .filter(patient => {
        const name = [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ').toLowerCase();
        return (
          name.includes(query) ||
          patient.hospitalNumber?.toLowerCase().includes(query) ||
          patient.phone?.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [findPatientQuery, patientDocs]);

  const openFoundPatient = (patient: (typeof findPatientResults)[number]) => {
    setFindPatientOpen(false);
    // Hand off to the pharmacy workbench with the exact patient selected so
    // their dispense workflow opens with the step-by-step popup ready.
    const name = [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ');
    router.push(`/dashboard/pharmacy?patientId=${encodeURIComponent(patient._id)}&patient=${encodeURIComponent(name)}`);
  };

  const activeOutstanding = outstandingView
    ? outstanding.find(item => item.label === outstandingView) ?? null
    : null;

  // The rail search stays mounted over the outstanding drill-down, so it has
  // to filter this list too — otherwise typing there silently does nothing.
  const visibleOutstandingEntries = useMemo(() => {
    const entries = activeOutstanding?.entries ?? [];
    const q = appointmentSearch.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(entry =>
      [entry.title, entry.subtitle, entry.meta].some(value => value?.toLowerCase().includes(q)));
  }, [activeOutstanding, appointmentSearch]);

  const openOutstanding = (item: OutstandingItem) => {
    setView('dashboard');
    setOutstandingView(current => (current === item.label ? null : item.label));
    setRailOpen(false);
  };

  const openPatientRecord = (appointment: AppointmentDoc) => {
    const patientId = appointment.patientId || patients.find(patient => patient.name === appointment.patientName)?._id;
    if (patientId) {
      router.push(`/patients/${patientId}`);
    } else {
      // Both the direct id and the name-match fallback failed — say so
      // instead of silently doing nothing.
      showToast(`No patient record found for ${appointment.patientName}`, 'error');
    }
  };

  const isTelehealth = (appointment: AppointmentDoc) => appointment.appointmentType === 'telehealth';
  const joinTelehealth = (appointment: AppointmentDoc) => {
    router.push(`/telehealth/visit/${encodeURIComponent(appointment._id)}`);
  };

  // Clicking an outstanding-item entry normally follows its href. But a
  // telehealth entry must NOT jump straight into the video call — it opens the
  // appointment detail popover first (matching the appointment card), and the
  // Join button inside that popover launches the visit.
  const openOutstandingEntry = (entry: OutstandingEntry) => {
    const appointment = appointments.find(a => a._id === entry.id);
    if (appointment && isTelehealth(appointment)) {
      setOpenAppointment(appointment);
      return;
    }
    if (entry.href) { router.push(entry.href); return; }
    // No href — never let the click dead-end: open the matching appointment,
    // else the patient's chart (resolved by name), else say so out loud.
    if (appointment) { setOpenAppointment(appointment); return; }
    const patientId = patients.find(patient => patient.name === entry.title)?._id;
    if (patientId) { router.push(`/patients/${patientId}`); return; }
    showToast(`Couldn't open “${entry.title}”`, 'error');
  };

  const providerOptions = useMemo(() => {
    const names = [clinicianName, ...appointments.map(appointment => appointment.providerName)]
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names));
  }, [appointments, clinicianName]);

  useEffect(() => {
    setProviderFilter(current => {
      const active = current.filter(provider => providerOptions.includes(provider));
      if (active.length === providerOptions.length) return active;
      if (current.length > 0 && active.length > 0) return active;
      return providerOptions;
    });
  }, [providerOptions]);

  useEffect(() => {
    // Calendar view was removed — the dashboard is the only view for all users.
    setView('dashboard');
  }, [searchParams]);

  const matchesProviderFilter = useCallback((appointment: AppointmentDoc) => {
    if (providerOptions.length === 0 || providerFilter.length === 0) return true;
    return providerFilter.includes(appointment.providerName || clinicianName);
  }, [clinicianName, providerFilter, providerOptions.length]);

  const appointmentCounts = useMemo(() => {
    return appointments.reduce<Map<string, number>>((counts, appointment) => {
      if (locationFilter !== 'all' && appointment.facilityName !== locationFilter) return counts;
      if (!matchesProviderFilter(appointment)) return counts;
      counts.set(appointment.appointmentDate, (counts.get(appointment.appointmentDate) || 0) + 1);
      return counts;
    }, new Map());
  }, [appointments, locationFilter, matchesProviderFilter]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    // Only as many week rows as the month needs (design shows no trailing
    // blank week — July 2026 renders 5 rows, not a fixed 6).
    const daysInMonth = addDays(startOfMonth(addMonths(monthStart, 1)), -1).getDate();
    const weekCount = Math.ceil((monthStart.getDay() + daysInMonth) / 7);
    return Array.from({ length: weekCount * 7 }).map((_, index) => {
      const date = addDays(gridStart, index);
      const iso = toIsoDate(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === calendarMonth.getMonth(),
        isToday: iso === todayIso,
        isSelected: iso === selectedDate,
        count: appointmentCounts.get(iso) || 0,
      };
    });
  }, [appointmentCounts, calendarMonth, selectedDate, todayIso]);

  // Provider/location-scoped but NOT date-scoped — the day-activity chart
  // needs adjacent days too, for its two-day comparison.
  const filteredAppointments = useMemo(() => (
    appointments
      .filter(appointment => locationFilter === 'all' || appointment.facilityName === locationFilter)
      .filter(matchesProviderFilter)
  ), [appointments, locationFilter, matchesProviderFilter]);

  const selectedAppointmentsForDay = useMemo(() => {
    return filteredAppointments
      .filter(appointment => appointment.appointmentDate === selectedDate)
      .sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''));
  }, [filteredAppointments, selectedDate]);

  const appointmentQuery = appointmentSearch.trim().toLowerCase();
  const unifiedPatientRows = useMemo<UnifiedPatientRow[]>(() => {
    const appointmentByPatient = new Map<string, AppointmentDoc>();
    const appointmentByName = new Map<string, AppointmentDoc>();
    for (const appointment of selectedAppointmentsForDay) {
      if (appointment.patientId && !appointmentByPatient.has(appointment.patientId)) appointmentByPatient.set(appointment.patientId, appointment);
      if (appointment.patientName && !appointmentByName.has(appointment.patientName.toLowerCase())) appointmentByName.set(appointment.patientName.toLowerCase(), appointment);
    }

    const rows: UnifiedPatientRow[] = patients.map(patient => {
      const appointment = appointmentByPatient.get(patient._id) || appointmentByName.get(patient.name.toLowerCase()) || null;
      const status = appointment?.status || (patient.triagePriority === 'RED' ? 'checked_in' : 'scheduled');
      const department = patient.division || patient.ward?.split('-')[0] || appointment?.department || 'OPD';
      return {
        id: patient._id,
        photoUrl: patient.photoUrl,
        patient,
        appointment,
        name: patient.name,
        patientId: patient._id,
        triagePriority: patient.triagePriority || (appointment ? appointmentTriage(appointment.priority) : 'GREEN'),
        reason: appointment?.reason || patient.division || patient.ward || 'Assigned patient',
        timeLabel: appointment?.appointmentTime ? formatClockTime(appointment.appointmentTime) : 'Assigned',
        status: status as AppointmentStatus,
        department,
        provider: patient.doctor || clinicianName || appointment?.providerName || 'Not assigned',
        isAssigned: true,
      };
    });

    const assignedIds = new Set(patients.map(patient => patient._id));
    const assignedNames = new Set(patients.map(patient => patient.name.toLowerCase()));
    for (const appointment of selectedAppointmentsForDay) {
      if ((appointment.patientId && assignedIds.has(appointment.patientId)) || assignedNames.has(appointment.patientName.toLowerCase())) continue;
      rows.push({
        id: appointment._id,
        photoUrl: appointment.patientId ? photoByPatientId.get(appointment.patientId) : undefined,
        patient: null,
        appointment,
        name: appointment.patientName,
        patientId: appointment.patientId,
        triagePriority: appointmentTriage(appointment.priority),
        reason: appointment.reason || typeLabel(appointment.appointmentType),
        timeLabel: appointment.appointmentTime ? formatClockTime(appointment.appointmentTime) : 'Scheduled',
        status: appointment.status,
        department: appointment.department || appointment.appointmentType || 'OPD',
        provider: appointment.providerName || clinicianName || 'Not assigned',
        isAssigned: false,
      });
    }

    return rows.sort((a, b) => {
      if (a.isAssigned !== b.isAssigned) return a.isAssigned ? -1 : 1;
      const aTime = a.appointment?.appointmentTime || '99:99';
      const bTime = b.appointment?.appointmentTime || '99:99';
      return aTime.localeCompare(bTime) || a.name.localeCompare(b.name);
    });
  }, [clinicianName, patients, photoByPatientId, selectedAppointmentsForDay]);
  const visiblePatientRows = unifiedPatientRows.filter(row => (
    !appointmentQuery ||
    [row.name, row.reason, row.timeLabel, row.department, row.provider, row.status]
      .some(value => value?.toLowerCase().includes(appointmentQuery))
  ));

  // ── Live queue state behind the worklist columns ──
  // Coming from / Queue / Wait time derive from the patient's active triage
  // record via the acuity-weighted, time-aged queue builder. Scoped to the
  // last 24 hours (older docs are unclosed visits, not waiting patients) and
  // deduped to the newest record per patient.
  const { currentUser } = useAuth();
  const { triages, update: updateTriageDoc } = useTriage();

  // ── Clinical activity charts (consultations trend + lab-review aging) ──
  // Neither `getAllEncounters` nor `getOverdueUnreviewedResults` has a
  // dedicated hook yet (unlike lab results / resumable encounters), so this
  // loads them directly and stays live via the same PouchDB `.changes()` +
  // coalescer pattern `useResumableEncounters`/`useLabResults` use.
  const [allEncounters, setAllEncounters] = useState<EncounterDoc[]>([]);
  const [overdueLabResults, setOverdueLabResults] = useState<LabResultDoc[]>([]);
  const vizScope = useMemo(() => (
    currentUser ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role } : undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);
  useEffect(() => {
    let cancelled = false;
    const loadClinicalViz = async () => {
      try {
        const [{ getAllEncounters }, { getOverdueUnreviewedResults }] = await Promise.all([
          import('@/lib/services/encounter-service'),
          import('@/lib/services/lab-service'),
        ]);
        const [encounters, overdue] = await Promise.all([
          getAllEncounters(vizScope),
          getOverdueUnreviewedResults(vizScope),
        ]);
        if (!cancelled) {
          setAllEncounters(encounters);
          setOverdueLabResults(overdue);
        }
      } catch (err) {
        console.error('Failed to load clinical dashboard chart data', err);
      }
    };
    loadClinicalViz();
    const reload = makeCoalescer(() => { if (!cancelled) loadClinicalViz(); });
    const encChanges = encountersDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger()).on('error', () => { /* noop */ });
    const labChanges = labResultsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger()).on('error', () => { /* noop */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { encChanges.cancel(); } catch { /* noop */ }
      try { labChanges.cancel(); } catch { /* noop */ }
    };
  }, [vizScope]);

  // "My consultations per day" — encounters this clinician ran (clinicianId
  // match, the same identity the rest of this file uses for "mine"), bucketed
  // by startedAt's calendar day over the trailing 14 days including today.
  const consultationsPerDay = useMemo(() => {
    const days: { iso: string; label: string; count: number }[] = [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const day = new Date(startOfToday);
      day.setDate(day.getDate() - i);
      days.push({
        iso: toIsoDate(day),
        label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: 0,
      });
    }
    if (!currentUser) return days;
    const byIso = new Map(days.map(d => [d.iso, d]));
    for (const encounter of allEncounters) {
      if (encounter.clinicianId !== currentUser._id || !encounter.startedAt) continue;
      const started = new Date(encounter.startedAt);
      if (Number.isNaN(started.getTime())) continue;
      const bucket = byIso.get(toIsoDate(started));
      if (bucket) bucket.count += 1;
    }
    return days;
  }, [allEncounters, currentUser]);
  const consultationsTotal = useMemo(
    () => consultationsPerDay.reduce((sum, day) => sum + day.count, 0),
    [consultationsPerDay],
  );

  // "Abnormal-results aging" — getOverdueUnreviewedResults() already does the
  // SLA math (24h critical / 7-day routine, order-lifecycles.getResultReviewSLA);
  // scoped here to labs THIS clinician ordered. LabResultDoc.orderedBy is a
  // free-text name (stamped from currentUser.name at order time — see
  // consultation/page.tsx and lab/page.tsx), so it's matched the same way this
  // file already matches "my" appointments in matchesProviderFilter (name
  // equality against clinicianName), rather than an id join that doesn't exist
  // on this doc.
  const overdueLabRows = useMemo(() => {
    const now = Date.now();
    const mine = currentUser?.name
      ? overdueLabResults.filter(r => r.orderedBy === currentUser.name)
      : [];
    return mine
      .map(r => ({
        ...r,
        hoursOverdue: Math.max(0, Math.round((now - new Date(r.updatedAt || r.createdAt || '').getTime()) / 3_600_000)),
      }))
      .sort((a, b) => b.hoursOverdue - a.hoursOverdue);
  }, [overdueLabResults, currentUser?.name]);
  // Wall-clock sampled in an effect (render stays pure) and refreshed once a
  // minute so wait times and the time-aged scores keep aging on screen.
  const [queueNowMs, setQueueNowMs] = useState<number | null>(null);
  useEffect(() => {
    setQueueNowMs(Date.now());
    const timer = setInterval(() => setQueueNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const activeTriageByPatient = useMemo(() => {
    const latest = new Map<string, TriageDoc>();
    if (queueNowMs === null) return latest;
    const cutoff = queueNowMs - 24 * 60 * 60 * 1000;
    for (const doc of triages) {
      if (new Date(doc.triagedAt).getTime() < cutoff) continue;
      const held = latest.get(doc.patientId);
      if (!held || doc.triagedAt > held.triagedAt) latest.set(doc.patientId, doc);
    }
    return latest;
  }, [triages, queueNowMs]);
  const queueEntryByPatient = useMemo(() => {
    const entries = buildQueueFromTriage([...activeTriageByPatient.values()]);
    const map = new Map<string, QueueEntry>();
    for (const entry of entries) map.set(entry.patientId, entry);
    return map;
  }, [activeTriageByPatient]);

  // Worklist column values for one row, from its queue entry when the patient
  // has arrived and from the appointment alone when they haven't.
  const rowQueueColumns = (row: UnifiedPatientRow) => {
    const entry = row.patientId ? queueEntryByPatient.get(row.patientId) : undefined;
    const triage = row.patientId ? activeTriageByPatient.get(row.patientId) : undefined;
    const inService = Boolean(entry?.assignedToId) || row.status === 'in_progress';
    const appointmentAt = row.appointment?.appointmentTime
      ? new Date(`${row.appointment.appointmentDate}T${row.appointment.appointmentTime}:00`)
      : null;
    const relativeNow = queueNowMs === null ? null : new Date(queueNowMs);
    const appointmentRelative = appointmentAt && relativeNow && !Number.isNaN(appointmentAt.getTime())
      ? formatTimeUntil(appointmentAt.toISOString(), relativeNow)
      : '';
    return {
      entry: entry ?? null,
      triage: triage ?? null,
      comingFrom: entry
        ? (entry.stage === 'awaiting_triage' ? 'Registration' : 'Triage')
        : row.appointment ? 'Appointment' : 'Registry',
      careTeamPrimary: row.provider || 'Doctor unassigned',
      careTeamSecondary: row.patient?.nurse || entry?.assignedToName || 'Nurse unassigned',
      statusText: inService
        ? 'In service'
        : entry ? 'Waiting' : statusLabel(row.status),
      queueText: entry ? STAGE_LABELS[entry.stage] : typeLabel(row.department),
      waitText: entry ? formatClockTime(entry.enteredStageAt) : row.appointment?.appointmentTime ? formatClockTime(row.appointment.appointmentTime) : '—',
      waitSubtext: entry
        ? waitLabel(entry.minutesWaiting)
        : row.appointment?.appointmentDate || appointmentRelative || 'Assigned list',
      statusSubtext: entry?.acuity === 'RED'
        ? 'Critical'
        : entry?.acuity === 'YELLOW'
          ? 'Urgent'
          : entry?.acuity === 'GREEN'
            ? 'Routine'
            : PRIORITY_META[row.triagePriority].label,
      overTarget: Boolean(entry?.flaggedForReassessment),
      inService,
    };
  };

  // Daybar filter pills (design): Waiting = rows actively in a queue (arrived,
  // not yet in service) or checked in; Scheduled = everything else (in
  // service, booked appointments, registry-only assignments).
  const [worklistFilter, setWorklistFilter] = useState<'all' | 'waiting' | 'scheduled'>('all');
  const isWaitingRow = (row: UnifiedPatientRow) => {
    const columns = rowQueueColumns(row);
    return !columns.inService && (Boolean(columns.entry) || row.status === 'checked_in');
  };
  const waitingCount = visiblePatientRows.filter(isWaitingRow).length;
  const scheduledCount = visiblePatientRows.length - waitingCount;
  const filteredPatientRows = worklistFilter === 'all'
    ? visiblePatientRows
    : visiblePatientRows.filter(row => isWaitingRow(row) === (worklistFilter === 'waiting'));

  // Row popup (visit info + actions) and the Move dialog it can open.
  const [visitRow, setVisitRow] = useState<UnifiedPatientRow | null>(null);

  // ── "Needs your attention" rail feed ────────────────────────────────────
  // One row per thing that actually wants this clinician: a result past its
  // review SLA, a triaged patient still waiting, a patient checked in. Each
  // row is typed and colour-coded, because a flat monochrome list makes a RED
  // triage look exactly like a routine check-in. Icon + hue come from the
  // notification palette so the rail and the bell say the same thing about the
  // same item; the tint on the row comes from severity, not from the source.
  const railActions = useMemo<RailAction[]>(() => {
    const rows: RailAction[] = [];

    for (const lab of overdueLabRows) {
      rows.push({
        key: `lab-${lab._id}`,
        type: 'lab',
        severity: lab.critical ? 'critical' : 'warning',
        title: lab.testName,
        // Hours until it reads oddly, then days.
        meta: `${lab.patientName} · ${lab.hoursOverdue >= 48
          ? `${Math.floor(lab.hoursOverdue / 24)}d overdue`
          : `${lab.hoursOverdue}h overdue`}`,
        weight: lab.hoursOverdue,
        onOpen: () => router.push(`/patients/${lab.patientId}?tab=labs&focus=${encodeURIComponent(lab._id)}`),
      });
    }

    for (const row of visiblePatientRows) {
      // Same "arrived, not yet in service" test the worklist's Waiting pill
      // uses — inlined off queueEntryByPatient so this stays memoisable.
      const entry = row.patientId ? queueEntryByPatient.get(row.patientId) : undefined;
      const inService = Boolean(entry?.assignedToId) || row.status === 'in_progress';
      if (inService) continue;
      if (entry) {
        rows.push({
          key: `triage-${row.id}`,
          type: 'triage',
          // ETAT acuity is the whole point of triage — it drives the tint.
          severity: entry.acuity === 'RED' ? 'critical' : entry.acuity === 'YELLOW' ? 'warning' : 'info',
          title: row.name,
          meta: `${STAGE_LABELS[entry.stage]} · ${waitLabel(entry.minutesWaiting)}`,
          weight: entry.minutesWaiting,
          onOpen: () => setVisitRow(row),
        });
      } else if (row.status === 'checked_in') {
        rows.push({
          key: `checkin-${row.id}`,
          type: 'appointment',
          severity: 'info',
          title: row.name,
          meta: `Checked in · ${row.timeLabel || 'waiting to be seen'}`,
          weight: 0,
          onOpen: () => setVisitRow(row),
        });
      }
    }

    // Urgency first, then the oldest wait/breach inside each band.
    return rows.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.weight - a.weight);
  }, [overdueLabRows, visiblePatientRows, queueEntryByPatient, router]);

  const [moveEntry, setMoveEntry] = useState<QueueEntry | null>(null);
  const [moveSaving, setMoveSaving] = useState(false);

  // Call = take the patient now: record the handoff on the triage doc (the
  // row flips to "In service" for every station) and open the consultation.
  const callPatient = async (row: UnifiedPatientRow) => {
    if (!row.patientId) return;
    const entry = queueEntryByPatient.get(row.patientId);
    if (entry && !entry.assignedToId && currentUser) {
      await updateTriageDoc(entry.triageId, {
        handoffTo: currentUser._id,
        handoffToName: currentUser.name,
        handoffAt: new Date().toISOString(),
      });
    }
    router.push(`/consultation?patientId=${row.patientId}`);
  };

  const handleMove = async (change: { stage: QueueEntry['stage'] | null; priority: QueueEntry['acuity']; room: string; comment: string }) => {
    if (!moveEntry || !currentUser) return;
    setMoveSaving(true);
    try {
      const doc = triages.find(triage => triage._id === moveEntry.triageId);
      const updates: Partial<TriageDoc> = {};
      if (change.stage && change.stage !== moveEntry.stage) {
        // pending→seen is the only status hop these destinations need; the
        // room field is what separates rooming from consultation.
        if (doc?.status === 'pending') updates.status = 'seen';
        updates.assignedRoom = change.stage === 'awaiting_consultation' ? change.room : '';
      }
      if (change.priority !== moveEntry.acuity) updates.priority = change.priority;
      if (change.comment) {
        const stamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${currentUser.name}`;
        updates.notes = [doc?.notes, `[Queue ${stamp}] ${change.comment}`].filter(Boolean).join('\n');
      }
      const updated = await updateTriageDoc(moveEntry.triageId, updates);
      if (!updated) {
        showToast('Move failed — the triage record could not be updated.', 'error');
        return;
      }
      showToast(`${moveEntry.patientName} updated in the queue.`, 'success');
      setMoveEntry(null);
    } finally {
      setMoveSaving(false);
    }
  };
  // Compact doctor-facing appointment popup. The scheduler owns the full
  // appointment record; clinicians need the clinical next step.
  const appointmentPanel = openAppointment ? (
    <div
      className="modal-panel modal-panel--md appointment-detail-panel appointment-detail-panel--clinical"
      aria-label="Appointment details"
      role="dialog"
      aria-modal="true"
    >
      <div className="appointment-detail-modal__header">
        <div className="appointment-detail-modal__header-row">
          <div>
            <h2 id="appointment-clinical-title" className="appointment-detail-modal__time">{openAppointment.patientName}</h2>
            <p className="appointment-detail-modal__reason">{openAppointment.reason || typeLabel(openAppointment.appointmentType)}</p>
          </div>
          <div className="appointment-detail-modal__header-right">
            <select
              value={openAppointment.status}
              className="appointment-detail-modal__status-select"
              aria-label="Appointment status"
              onChange={event => {
                const status = event.target.value as AppointmentStatus;
                void onUpdateAppointmentStatus?.(openAppointment._id, status);
                setOpenAppointment({ ...openAppointment, status });
              }}
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
            <button type="button" className="appointment-detail-modal__close" onClick={() => setOpenAppointment(null)} aria-label="Close appointment details">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="appointment-detail-modal__subrow">
          <span>{appointmentTimeRange(openAppointment)}</span>
          <span>{openAppointment.department || 'OPD'}</span>
          <span className="appointment-detail-modal__priority-badge">{typeLabel(openAppointment.priority)}</span>
          {isTelehealth(openAppointment) && (
            <button type="button" className="appointment-detail-join-pill" onClick={() => joinTelehealth(openAppointment)}>
              <Video className="w-3.5 h-3.5" /> Join
            </button>
          )}
        </div>
      </div>

      <div className="appointment-detail-modal__body" role="tabpanel">
        <div className="appointment-detail-modal__summary-grid">
          {[
            { label: 'Visit', value: openAppointment.appointmentType === 'telehealth' ? 'Telehealth' : openAppointment.appointmentType === 'walk_in' ? 'Walk-in' : 'In office' },
            { label: 'Date', value: formatAppointmentDate(openAppointment.appointmentDate) },
            { label: 'Provider', value: openAppointment.providerName || clinicianName || 'Unassigned' },
            { label: 'Language', value: patientLanguages.get(openAppointment.patientId) || 'Not recorded' },
          ].map(row => <DetailRow key={row.label} label={row.label} value={row.value} />)}
        </div>

        <div className="appointment-doctor-next">
          <h3>Doctor next steps</h3>
          <ul>
            <li><Check className="w-4 h-4" /> Confirm the patient is ready to be seen.</li>
            <li><Check className="w-4 h-4" /> Review the reason for visit and any intake note.</li>
            <li><Check className="w-4 h-4" /> Start the consultation and document the clinical note.</li>
          </ul>
        </div>
      </div>

      <div className="appointment-detail-modal__actions">
        {isTelehealth(openAppointment) && (
          <button
            type="button"
            className="btn btn-sm appointment-detail-join-btn"
            onClick={() => joinTelehealth(openAppointment)}
          >
            <Video className="w-4 h-4" /> Join Telehealth Visit
          </button>
        )}
        {canConsult && openAppointment.patientId ? (
          <div className="appointment-detail-modal__split" ref={noteMenuRef}>
            <button
              type="button"
              className="btn btn-primary btn-sm appointment-detail-modal__split-main"
              title="Create clinical note"
              onClick={() => router.push(`/consultation?patientId=${encodeURIComponent(openAppointment.patientId)}`)}
            >
              <Stethoscope className="w-4 h-4" /> <span className="appointment-detail-modal__btn-label">Start Consultation</span>
            </button>
            <button
              type="button"
              className="appointment-detail-modal__split-toggle"
              aria-label="More clinical note options"
              aria-expanded={detailMenuOpen === 'note'}
              onClick={() => setDetailMenuOpen(current => (current === 'note' ? null : 'note'))}
            >
              {detailMenuOpen === 'note' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {detailMenuOpen === 'note' && (
              <div className="appointment-detail-modal__menu">
                <button
                  type="button"
                  onClick={() => { setDetailMenuOpen(null); router.push(`/consultation?patientId=${encodeURIComponent(openAppointment.patientId)}`); }}
                >
                  <Stethoscope size={14} /> Start consultation
                </button>
                <button type="button" onClick={() => { setDetailMenuOpen(null); openPatientRecord(openAppointment); }}>
                  <ClipboardList size={14} /> Open patient record
                </button>
                {isTelehealth(openAppointment) && (
                  <button type="button" onClick={() => { setDetailMenuOpen(null); joinTelehealth(openAppointment); }}>
                    <Video size={14} /> Join telehealth visit
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openPatientRecord(openAppointment)}
          >
            Open patient record
          </button>
        )}
        <div className="appointment-detail-modal__split" ref={moreMenuRef}>
          <button
            type="button"
            className="appointment-detail-modal__more-toggle"
            title="More options"
            aria-expanded={detailMenuOpen === 'more'}
            onClick={() => setDetailMenuOpen(current => (current === 'more' ? null : 'more'))}
          >
            <MoreVertical size={16} /> <span className="appointment-detail-modal__btn-label">More</span> {detailMenuOpen === 'more' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {detailMenuOpen === 'more' && (
            <div className="appointment-detail-modal__menu appointment-detail-modal__menu--right">
              <button
                type="button"
                onClick={() => { const id = openAppointment._id; setDetailMenuOpen(null); setOpenAppointment(null); router.push(`/appointments?appointment=${id}`); }}
              >
                <Calendar size={14} /> Reschedule or cancel
              </button>
              <button type="button" onClick={() => { setDetailMenuOpen(null); window.print(); }}>
                <Printer size={14} /> Print appointment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="ehr-schedule-shell">
      <section className="ehr-schedule-header ehr-clinical-dashboard-header">
        <div className="ehr-clinical-dashboard-tabs">
          {canBookAppointments && (
            <div className="ehr-segmented ehr-segmented-single">
              <button type="button" className="active" aria-label="New appointments" onClick={() => router.push('/appointments?new=1')}>
                <Plus className="w-4 h-4" /> New appointments
              </button>
            </div>
          )}
        </div>
        <div className="ehr-schedule-primary-controls ehr-clinical-dashboard-header-main">
          <div className="ehr-greeting-row">
            <p className="ehr-care-greeting">Welcome, {clinicianName}</p>
          </div>
        </div>
        <div className="ehr-schedule-actions">
          <button
            type="button"
            aria-label="Dispense"
            onClick={() => { setFindPatientQuery(''); setFindPatientOpen(true); }}
          >
            <Pill className="w-4 h-4" /> Dispense
          </button>
          <button
            type="button"
            aria-label="Print today's schedule"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            type="button"
            className="primary"
            aria-label="Send intake"
            onClick={() => router.push('/patient-intake')}
          >
            <Send className="w-4 h-4" /> Send intake
          </button>
        </div>
      </section>

      <section className={`ehr-workspace-grid ${view === 'dashboard' ? 'is-dashboard' : 'is-calendar'}`}>
        <aside className="ehr-left-rail">
          <div className="ehr-mini-calendar">
            <div className="ehr-mini-calendar-title">
              <button type="button" onClick={() => setCalendarMonth(current => addMonths(current, -1))} aria-label="Previous month">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{formatMonthTitle(calendarMonth)}</span>
              <button type="button" onClick={() => setCalendarMonth(current => addMonths(current, 1))} aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="ehr-mini-calendar-grid">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}
              {calendarCells.map(cell => (
                <button
                  key={cell.iso}
                  type="button"
                  data-date={cell.iso}
                  className={[
                    cell.isToday ? 'today' : '',
                    cell.isSelected ? 'selected' : '',
                    !cell.inMonth ? 'muted' : '',
                    cell.count > 0 ? 'has-events' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSelectedDate(cell.iso);
                    if (!cell.inMonth) setCalendarMonth(startOfMonth(parseIsoDate(cell.iso)));
                  }}
                  aria-label={`${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIsoDate(cell.iso))}${cell.count ? `, ${cell.count} appointment${cell.count === 1 ? '' : 's'}` : ''}`}
                  aria-pressed={cell.isSelected}
                >
                  <span>{cell.day}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ehr-rail-search">
            <Search className="ehr-rail-search-icon w-4 h-4" />
            <input
              type="search"
              placeholder="Search appointments"
              aria-label="Search the day's appointments"
              value={appointmentSearch}
              onChange={event => setAppointmentSearch(event.target.value)}
            />
            {appointmentSearch && (
              <button type="button" className="ehr-rail-search-clear" aria-label="Clear search" onClick={() => setAppointmentSearch('')}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <DayActivityChart
            appointments={filteredAppointments}
            selectedDate={selectedDate}
            todayIso={todayIso}
            admittedPatientIds={admittedPatientIds}
            onSelectDate={iso => {
              setSelectedDate(iso);
              setCalendarMonth(startOfMonth(parseIsoDate(iso)));
            }}
          />
        </aside>

        <main className="ehr-center-panel">
          {view === 'dashboard' && activeOutstanding ? (
            <>
              <div className="ehr-daybar">
                <h2 className="ehr-outstanding-title">
                  <button
                    type="button"
                    className="ehr-outstanding-back"
                    onClick={() => setOutstandingView(null)}
                  >
                    <ChevronLeft className="w-4 h-4" /> Schedule
                  </button>
                  {activeOutstanding.label}
                </h2>
                <div className="ehr-day-tabs">
                  <button type="button" className="active">
                    {appointmentQuery
                      ? `${visibleOutstandingEntries.length} of ${activeOutstanding.count}`
                      : `${activeOutstanding.count} ${activeOutstanding.count === 1 ? 'item' : 'items'}`}
                  </button>
                  {activeOutstanding.href && (
                    <button type="button" onClick={() => router.push(activeOutstanding.href!)}>
                      Open full page
                    </button>
                  )}
                </div>
              </div>

              <div className="ehr-appointment-list">
                {visibleOutstandingEntries.length === 0 && (
                  <div className="ehr-empty-state">
                    <ClipboardList className="w-8 h-8" />
                    <strong>{appointmentQuery ? 'Nothing matches your search' : 'Nothing outstanding'}</strong>
                    <span>
                      {appointmentQuery
                        ? `No ${activeOutstanding.label.toLowerCase()} items match “${appointmentSearch.trim()}”.`
                        : `${activeOutstanding.label} is clear — no items need your attention.`}
                    </span>
                    {appointmentQuery
                      ? <button type="button" onClick={() => setAppointmentSearch('')}>Clear search</button>
                      : <button type="button" onClick={() => setOutstandingView(null)}>Back to schedule</button>}
                  </div>
                )}

                {visibleOutstandingEntries.length > 0 && (
                  <div className="ehr-queue-scroll">
                    <div className="ehr-queue-cards ehr-queue-cards--compact">
                      {visibleOutstandingEntries.map(entry => {
                        // Telehealth visits render as full appointment cards (same
                        // columns as the schedule) with a Status column in place of
                        // Language. Clicking opens the appointment popover; Join lives
                        // inside it.
                        const appointment = appointments.find(a => a._id === entry.id);
                        if (appointment && isTelehealth(appointment)) {
                          return (
                            <article
                              key={entry.id}
                              className="ehr-appointment-row"
                              data-triage={appointmentTriage(appointment.priority)}
                              role="button"
                              tabIndex={0}
                              onClick={() => openOutstandingEntry(entry)}
                              onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  openOutstandingEntry(entry);
                                }
                              }}
                            >
                              <div className="ehr-appointment-identity">
                                <div className="ehr-patient-icon" data-acuity={appointmentTriage(appointment.priority)}>{initials(appointment.patientName)}</div>
                                <div className="ehr-appointment-main">
                                  <button type="button" className="print-visible" onClick={event => { event.stopPropagation(); openPatientRecord(appointment); }}>
                                    {appointment.patientName}
                                  </button>
                                  <p>{appointment.reason || 'Telehealth visit'}</p>
                                </div>
                              </div>
                              <div className="ehr-appointment-time">
                                <strong>{formatClockTime(appointment.appointmentTime)}</strong>
                                <span>{typeLabel(appointment.priority)}</span>
                              </div>
                              <div className="ehr-appointment-language">
                                <strong>{statusLabel(appointment.status)}</strong>
                                <span>Status</span>
                              </div>
                              <span className="ehr-appointment-department">
                                <b className={`ehr-department-pill ${departmentTone(appointment.department)}`}>{typeLabel(appointment.department || 'Telemedicine')}</b>
                              </span>
                              <div className="ehr-status-menu">
                                <select
                                  value={appointment.status}
                                  className={statusTone(appointment.status)}
                                  onClick={event => event.stopPropagation()}
                                  onKeyDown={event => event.stopPropagation()}
                                  onChange={event => {
                                    void onUpdateAppointmentStatus?.(appointment._id, event.target.value as AppointmentStatus);
                                  }}
                                >
                                  {statusOptions.map(status => (
                                    <option key={status} value={status}>{statusLabel(status)}</option>
                                  ))}
                                </select>
                              </div>
                            </article>
                          );
                        }
                        const pill = outstandingPillTone(entry.tone);
                        return (
                          <div
                            key={entry.id}
                            className="ehr-queue-card ehr-queue-card--compact"
                            data-triage={outstandingTonePriority(entry.tone)}
                            role="button"
                            tabIndex={0}
                            onClick={() => openOutstandingEntry(entry)}
                            onKeyDown={event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openOutstandingEntry(entry);
                              }
                            }}
                          >
                            <div className="ehr-queue-patient">
                              <span
                                className="ehr-patient-icon"
                                data-acuity={outstandingTonePriority(entry.tone)}
                              >
                                {initials(entry.title)}
                              </span>
                              <div className="ehr-queue-patient-text">
                                <button type="button" className="ehr-queue-name" onClick={event => { event.stopPropagation(); openOutstandingEntry(entry); }}>
                                  {entry.title}
                                </button>
                                {entry.subtitle && <p>{entry.subtitle}</p>}
                              </div>
                            </div>

                            <div className="ehr-queue-cell ehr-queue-muted-cell">{entry.meta || '—'}</div>

                            <div className="ehr-queue-cell">
                              <span className="ehr-queue-pill" data-tone={pill.key}>{pill.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
	          <div className="ehr-daybar ehr-assigned-worklist-daybar">
	            <h2>Patients assigned to you</h2>
	            <div className="ehr-day-tabs">
              <button
                type="button"
                className={worklistFilter === 'all' ? 'active' : undefined}
                aria-pressed={worklistFilter === 'all'}
                onClick={() => setWorklistFilter('all')}
              >
                All · {visiblePatientRows.length}
              </button>
              <button
                type="button"
                className={worklistFilter === 'waiting' ? 'active' : undefined}
                aria-pressed={worklistFilter === 'waiting'}
                onClick={() => setWorklistFilter('waiting')}
              >
                Waiting · {waitingCount}
              </button>
              <button
                type="button"
                className={worklistFilter === 'scheduled' ? 'active' : undefined}
                aria-pressed={worklistFilter === 'scheduled'}
                onClick={() => setWorklistFilter('scheduled')}
              >
                Scheduled · {scheduledCount}
              </button>
	            </div>
	          </div>

	          <div className="ehr-appointment-list ehr-assigned-worklist-list">
            {visiblePatientRows.length === 0 && (
              <div className="ehr-empty-state">
                <ClipboardList className="w-8 h-8" />
                <strong>{appointmentQuery ? 'No assigned patients match your search' : 'No patients are assigned to you right now'}</strong>
                <span>{appointmentQuery ? `Nothing matches “${appointmentSearch.trim()}”.` : 'Assigned patients will appear here with appointment times when scheduled.'}</span>
                {appointmentQuery
                  ? <button type="button" onClick={() => setAppointmentSearch('')}>Clear search</button>
                  : <button type="button" onClick={() => router.push('/patients')}>Open patient registry</button>}
              </div>
            )}

            {visiblePatientRows.length > 0 && (
              <div className="ehr-queue-scroll">
                {/* Patient / Time / Care team / Context / Status, with every
                    column using a primary line plus a secondary line. */}
                <div className="appointment-card-flow">
                  <div className="appointment-card-head" aria-hidden="true">
                    <span>Patient</span>
                    <span>Time</span>
                    <span>Care team</span>
                    <span>Context</span>
                    <span>Status</span>
                  </div>
                  {filteredPatientRows.length === 0 && (
                    <div className="ehr-empty-state">
                      <strong>No {worklistFilter} patients</strong>
                      <span>Nothing is in the {worklistFilter === 'waiting' ? 'waiting' : 'scheduled'} bucket right now.</span>
                    </div>
                  )}
                  {filteredPatientRows.map((row) => {
                    const columns = rowQueueColumns(row);
                    const openRow = () => {
                      if (row.patientId) setVisitRow(row);
                      else if (row.appointment) setOpenAppointment(row.appointment);
                    };
                    const statusPillClass = columns.inService || row.status === 'checked_in' || row.status === 'in_progress' ? 'status-checked-in'
                      : columns.statusText === 'Waiting' ? 'status-attention'
                      : row.status === 'confirmed' ? 'status-confirmed'
                      : row.status === 'completed' ? 'status-completed'
                      : row.status === 'cancelled' || row.status === 'no_show' ? 'status-no-show'
                      : '';
                    return (
                      <div
                        key={row.id}
                        data-triage={row.triagePriority}
                        className="ehr-appointment-row appointment-card-row"
                        role="button"
                        tabIndex={0}
                        onClick={openRow}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openRow();
                          }
                        }}
                      >
                        <div className="ehr-appointment-identity">
                          <div className="ehr-patient-icon" style={stateTint(row.triagePriority)}>
                            {row.photoUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={row.photoUrl} alt="" className="ehr-patient-icon-photo" />
                              : initials(row.name)}
                          </div>
                          <div className="ehr-appointment-main appointment-card-patient">
                            <button type="button" className="print-visible" onClick={event => { event.stopPropagation(); openRow(); }}>
                              {row.name}
                            </button>
                            <p>
                              {row.reason}
                              {row.patient && <> · {row.patient.age ? `${row.patient.age}y` : 'Age unknown'} · {row.patient.gender || 'Not recorded'}</>}
                            </p>
                          </div>
                        </div>

                        <div className="ehr-appointment-time">
                          <strong style={columns.overTarget ? { color: '#C24135' } : undefined}>{columns.waitText}</strong>
                          {columns.waitSubtext && (
                            <span className={columns.overTarget ? 'is-soon' : ''}>
                              {columns.waitSubtext}{columns.overTarget ? ' · over target' : ''}
                            </span>
                          )}
                        </div>

                        <div className="appointment-card-provider">
                          <strong>{columns.careTeamPrimary}</strong>
                          <span>{columns.careTeamSecondary}</span>
                        </div>

                        <div className="ehr-appointment-department">
                          <strong>{columns.queueText || '—'}</strong>
                          <span>{columns.comingFrom}</span>
                        </div>

                        <div className="appointment-card-status">
                          <span className={`appointment-status-pill ${statusPillClass}`.trim()}>{columns.statusText}</span>
                          <small>{columns.statusSubtext}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
            </>
          )}

          {openAppointment && (
            <Modal onClose={() => setOpenAppointment(null)} width={520} labelledBy="appointment-clinical-title">
              {appointmentPanel}
            </Modal>
          )}

          {visitRow && (() => {
            const columns = rowQueueColumns(visitRow);
            return (
              <EhrVisitPopup
                patientId={visitRow.patientId}
                name={visitRow.name}
                detail={visitRow.patient
                  ? `${visitRow.reason} · ${visitRow.patient.age ? `${visitRow.patient.age}y` : 'Age unknown'} · ${visitRow.patient.gender || 'Not recorded'}`
                  : visitRow.reason}
                acuity={visitRow.triagePriority}
                statusLabel={columns.statusText}
                comingFrom={columns.comingFrom}
                queueLabel={columns.queueText}
                wait={columns.waitText}
                appointment={visitRow.appointment}
                triage={columns.triage}
                entry={columns.entry}
                onClose={() => setVisitRow(null)}
                onCall={() => { setVisitRow(null); void callPatient(visitRow); }}
                onMove={columns.entry ? () => { setVisitRow(null); setMoveEntry(columns.entry); } : undefined}
                onOpenChart={visitRow.patientId ? () => router.push(`/patients/${visitRow.patientId}`) : undefined}
              />
            );
          })()}

          {moveEntry && (
            <EhrQueueMoveDialog
              entry={moveEntry}
              saving={moveSaving}
              onClose={() => setMoveEntry(null)}
              onMove={change => void handleMove(change)}
            />
          )}

          {findPatientOpen && (
            <Modal onClose={() => setFindPatientOpen(false)} width={480} align="top" labelledBy="find-patient-title">
              <div className="ehr-find-patient">
                <h3 id="find-patient-title">Dispense to patient</h3>
                <div className="ehr-find-patient-input">
                  <Search className="w-4 h-4" />
                  <input
                    ref={findPatientInputRef}
                    type="search"
                    placeholder="Search by name, hospital number, or phone"
                    value={findPatientQuery}
                    onChange={event => setFindPatientQuery(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && findPatientResults.length > 0) {
                        event.preventDefault();
                        openFoundPatient(findPatientResults[0]);
                      }
                    }}
                  />
                </div>
                {findPatientQuery.trim() === '' ? (
                  <p className="ehr-find-patient-hint">Start typing to find the patient to dispense to.</p>
                ) : findPatientResults.length === 0 ? (
                  <p className="ehr-find-patient-hint">No patients match &ldquo;{findPatientQuery.trim()}&rdquo;.</p>
                ) : (
                  <ul className="ehr-find-patient-results">
                    {findPatientResults.map(patient => {
                      const name = [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ');
                      return (
                        <li key={patient._id}>
                          <button type="button" onClick={() => openFoundPatient(patient)}>
                            <span className="ehr-patient-icon" style={AVATAR_TINT_NEUTRAL}>{initials(name)}</span>
                            <span className="ehr-find-patient-identity">
                              <strong>{name}</strong>
                              <small>{[patient.hospitalNumber, patient.gender, patient.phone].filter(Boolean).join(' · ')}</small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Modal>
          )}
        </main>

        {view === 'dashboard' && railOpen && (
          <button type="button" className="ehr-rail-backdrop" aria-label="Close outstanding items panel" onClick={() => setRailOpen(false)} />
        )}
        {view === 'dashboard' && (
        <aside className={`ehr-right-rail ${railOpen ? 'is-open' : ''}`}>
          <button type="button" className="ehr-rail-close" aria-label="Close panel" onClick={() => setRailOpen(false)}>
            <X className="w-4 h-4" />
          </button>
          <section className="ehr-side-card ehr-outstanding-card">
            <div className="ehr-side-card-head">
              <ClipboardList className="w-5 h-5" />
              <h2>Outstanding items</h2>
            </div>
            <div className="ehr-outstanding-chips">
              {outstanding.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => openOutstanding(item)}
                  className={`${item.tone || 'neutral'}${outstandingView === item.label ? ' is-open' : ''}`}
                >
                  <span>{item.label}</span>
                  <b>{item.count}</b>
                </button>
              ))}
            </div>
          </section>
          {/* Everything that wants this clinician, typed and colour-coded
              (KAN-75 started this as an unreviewed-results card). Placed BELOW
              "Outstanding items" at the user's direction. Note the trade-off
              this accepts: a breached critical result now sits under routine
              outstanding work rather than leading the rail. It still only
              renders when there is something to act on. */}
          {railActions.length > 0 && (
            <section className="ehr-side-card ehr-action-feed-card">
              <div className="ehr-side-card-head">
                <ClipboardCheck className="w-5 h-5" />
                <h2>Needs your attention</h2>
              </div>
              {/* Three rows tall, the rest on a scroll: the card is a glance
                  surface in a fixed-height rail, so a clinician with hundreds
                  of open items gets a bounded card rather than one that runs
                  off the rail. Capped at 25 rows here; the full queue lives on
                  /notifications. */}
              <ul className="ehr-action-feed is-scrollable">
                {railActions.slice(0, 25).map(action => {
                  const meta = NOTIFICATION_META[action.type];
                  const severity = SEVERITY_META[action.severity];
                  const Icon = meta.icon;
                  return (
                    <li key={action.key}>
                      <button
                        type="button"
                        className={`ehr-action-row is-${action.severity}`}
                        onClick={action.onOpen}
                        title={`${meta.label} · ${severity.label}`}
                      >
                        {/* Bare icon, no tinted chip: globals.css strips the
                            background off any `span:has(> svg:only-child)` —
                            the flat-clinical direction — so the glyph carries
                            the source colour on its own. */}
                        <span className="ehr-action-icon">
                          {/* The icon set hardcodes a stroke attribute, so the
                              colour must be forced via the stroke property. */}
                          <Icon className="w-3.5 h-3.5" style={{ stroke: meta.color, color: meta.color }} />
                        </span>
                        <span className="ehr-action-text">
                          <span className="ehr-action-title">{action.title}</span>
                          <span className="ehr-action-meta">{action.meta}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/* These rows ARE notifications — the same items the bell raises
                  — so "view all" opens the notifications feed. */}
              <button type="button" className="ehr-action-more" onClick={() => router.push('/notifications')}>
                {`View all ${railActions.length} in notifications`}
              </button>
            </section>
          )}
        </aside>
        )}
      </section>

    </div>
  );
}

/* ─── Day activity chart (left rail) ───
   Maps the clinician's own (provider/location-filtered) schedule onto the
   weekly `EhrWeekActivityChart`: Inpatient (the patient holds an active ward
   admission) vs Outpatient (everyone else). Cancelled and no-show visits are
   excluded, so the bars stay a truthful picture of the doctor's week. */
const CHART_HIDDEN_STATUSES: AppointmentStatus[] = ['cancelled', 'no_show'];

function DayActivityChart({ appointments, selectedDate, todayIso, admittedPatientIds, onSelectDate }: {
  appointments: AppointmentDoc[]; selectedDate: string; todayIso: string; admittedPatientIds: Set<string>;
  onSelectDate?: (iso: string) => void;
}) {
  const items = useMemo<DayStatsItem[]>(() => appointments
    .filter(appointment => !CHART_HIDDEN_STATUSES.includes(appointment.status))
    .map(appointment => ({
      date: appointment.appointmentDate,
      time: appointment.appointmentTime,
      series: admittedPatientIds.has(appointment.patientId) ? 0 : 1,
    })), [appointments, admittedPatientIds]);

  return (
    <EhrWeekActivityChart
      items={items}
      seriesNames={['Inpatient', 'Outpatient']}
      selectedDate={selectedDate}
      todayIso={todayIso}
      onSelectDate={onSelectDate}
    />
  );
}
