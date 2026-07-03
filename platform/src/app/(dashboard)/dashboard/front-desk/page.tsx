'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePatients } from '@/lib/hooks/usePatients';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { useTriage } from '@/lib/hooks/useTriage';
import type { AppointmentDoc, EncounterDoc } from '@/lib/db-types';
import { formatCompactDateTime, formatMoney } from '@/lib/format-utils';
import { patientRegisteredAt, patientFullName, patientGenderAge, patientAgeLabel, initials } from '@/lib/patient-utils';
import { priorityColor } from '@/lib/clinical/triage-display';
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import Modal from '@/components/Modal';
import PatientCheckInForm from '@/components/check-in/PatientCheckInForm';
import { PatientRegistrationForm } from '@/app/(dashboard)/patients/new/page';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { getRoleConfig } from '@/lib/permissions';
import EhrCareDashboard, { type EhrCareDashboardAction, type EhrCareDashboardMetric, type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import {
  Calendar, ClipboardCheck, ArrowRightLeft,
  UserPlus, ClipboardList,
  MapPin, LogOut, Wallet, CheckCircle, X, Maximize2,
} from '@/components/icons/lucide';
import { formatPhoneDisplay } from '@/lib/field-formats';

/**
 * Front-desk operations workspace.
 *
 * Shows the live queue, today's appointments, and registry snapshots in one
 * view so reception can move patients without jumping between screens.
 */

// Exam rooms / bays a walk-in patient can be placed in to meet the provider.
// Fallback used only when facility settings provide no rooms.
const ROOM_OPTIONS = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Bay A', 'Bay B', 'Bay C', 'Bay D'];

const COMPLAINT_DEPARTMENT_MAP: Record<string, string> = {
  fever: 'General Medicine', malaria: 'General Medicine', cough: 'General Medicine',
  headache: 'General Medicine', pregnancy: 'Maternity', anc: 'Maternity',
  antenatal: 'Maternity', injury: 'Emergency', wound: 'Emergency',
  fracture: 'Emergency', accident: 'Emergency', child: 'Pediatrics',
  pediatric: 'Pediatrics', infant: 'Pediatrics', eye: 'Ophthalmology',
  vision: 'Ophthalmology', dental: 'Dental', tooth: 'Dental',
  skin: 'Dermatology', rash: 'Dermatology',
};

function suggestDepartment(complaint: string): string {
  const lower = complaint.toLowerCase();
  for (const [keyword, dept] of Object.entries(COMPLAINT_DEPARTMENT_MAP)) {
    if (lower.includes(keyword)) return dept;
  }
  return 'General Medicine';
}

// Split a timestamp into separate date / time pieces so the queue can show them
// in their own columns. Date-only values (e.g. "YYYY-MM-DD") yield an empty time.
function splitDateTime(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '—', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = /T\d{2}:\d{2}/.test(iso) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  return { date, time };
}

function formatDayMonthYear(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isoDateKey(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

// Final-checkout target: closing out a completed visit at the front desk.
interface CheckoutTarget {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  encounterId?: string;
  /** Set when the queue entry came from an appointment. */
  appointmentId?: string;
  /** Set when the queue entry came from triage (walk-in). */
  triageId?: string;
}

export default function FrontDeskDashboardPage() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { canConsult } = usePermissions();
  const { patients } = usePatients();
  const { appointments, updateStatus: updateAppointmentStatus } = useAppointments();
  const { triages, update: updateTriage } = useTriage();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { rooms } = useSettings();
  // Reactive room list from facility settings; fall back to the static list.
  const roomOptions = rooms.length ? rooms : ROOM_OPTIONS;

  const [queueFilter, setQueueFilter] = useState<'all' | 'walk-in' | 'appointment' | 'referral'>('all');
  const [panelView, setPanelView] = useState<'all' | 'appointments' | 'pending' | 'queue' | 'registered'>('all');
  const queueSort: 'priority' | 'name' | 'time' | 'status' = 'priority';
  const [queueSearch, setQueueSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<AppointmentDoc | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [encounters, setEncounters] = useState<EncounterDoc[]>([]);
  const [roomDraft, setRoomDraft] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    let changes: { cancel: () => void } | null = null;
    const load = async () => {
      try {
        const { getAllEncounters } = await import('@/lib/services/encounter-service');
        const rows = await getAllEncounters({
          orgId: currentUser.orgId,
          hospitalId: currentUser.hospitalId || currentUser.hospital?._id,
          role: currentUser.role,
        });
        if (!cancelled) setEncounters(rows);
      } catch (err) {
        console.warn('Failed to load front-desk encounter queue', err);
      }
    };
    load();
    import('@/lib/db').then(({ encountersDB }) => {
      if (cancelled) return;
      changes = encountersDB().changes({ since: 'now', live: true, include_docs: false })
        .on('change', load)
        .on('error', err => console.warn('Encounter queue subscription failed', err));
    }).catch(() => {});
    return () => {
      cancelled = true;
      try { changes?.cancel(); } catch { /* noop */ }
    };
  }, [currentUser, currentUser?.hospital?._id, currentUser?.hospitalId, currentUser?.orgId, currentUser?.role]);

  // ── Real today's appointments ──
  const todaysAppointments = useMemo(() =>
    appointments
      .filter(a => a.appointmentDate === today && a.status !== 'cancelled')
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)),
    [appointments, today]
  );

  // ── Real today's triages (pending/seen = still in queue) ──
  const todaysTriages = useMemo(() =>
    triages
      .filter(t => (t.triagedAt || '').startsWith(today))
      .sort((a, b) => {
        const pOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
        return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
      }),
    [triages, today]
  );


  // ── Unified queue: triaged walk-ins + appointments + recent registrations ──
  interface QueueItem {
    id: string;
    patientId: string;
    patientName: string;
    type: 'walk-in' | 'appointment' | 'referral' | 'registered';
    priority: 'RED' | 'YELLOW' | 'GREEN' | 'normal';
    complaint: string;
    department: string;
    gender: string;
    age: string;
    date: string;
    time: string;
    calendarDate: string;
    status: 'WAITING' | 'IN CONSULT' | 'DONE' | 'ADMITTED' | 'REFERRED';
    sourceId: string; // triage / appointment / patient ID
    encounterId?: string;
    assignedRoom?: string; // OPD exam room/bay (walk-in/triage entries only)
    registeredAt?: string; // registration timestamp (registered entries only — for ordering)
  }

  const queue = useMemo(() => {
    const items: QueueItem[] = [];
    // Look up gender/age per queue entry from the patient record (all entry
    // types carry a patientId), so Gender and Age render in their own columns.
    const patientById = new Map(patients.map(p => [p._id, p]));
    const genderOf = (pid: string) => patientById.get(pid)?.gender || '—';
    const ageOf = (pid: string) => { const p = patientById.get(pid); return p ? patientAgeLabel(p) : '—'; };
    const checkoutStatuses = new Set<EncounterDoc['status']>([
      'ready_for_clinic_checkout',
      'in_clinic_checkout',
      'clinic_complete_awaiting_next_station',
      'awaiting_facility_checkout',
      'in_facility_checkout',
    ]);
    const checkoutEncounterByPatient = new Map<string, EncounterDoc>();
    for (const enc of encounters) {
      if (!checkoutStatuses.has(enc.status)) continue;
      const dateKey = isoDateKey(enc.updatedAt || enc.closedAt || enc.startedAt || enc.createdAt);
      if (dateKey !== today) continue;
      const current = checkoutEncounterByPatient.get(enc.patientId);
      if (!current || (enc.updatedAt || enc.createdAt || '').localeCompare(current.updatedAt || current.createdAt || '') > 0) {
        checkoutEncounterByPatient.set(enc.patientId, enc);
      }
    }

    // Add triaged patients (walk-ins and triaged appointments)
    for (const t of todaysTriages) {
      if (t.status === 'discharged') continue;
      const checkoutEncounter = checkoutEncounterByPatient.get(t.patientId);
      const status = checkoutEncounter ? 'DONE' :
                     t.status === 'pending' ? 'WAITING' :
                     t.status === 'seen' ? 'IN CONSULT' :
                     t.status === 'admitted' ? 'ADMITTED' :
                     t.status === 'referred' ? 'REFERRED' : 'DONE';
      items.push({
        id: `triage-${t._id}`,
        patientId: t.patientId,
        patientName: t.patientName,
        type: 'walk-in',
        priority: t.priority as 'RED' | 'YELLOW' | 'GREEN',
        complaint: t.chiefComplaint || 'ETAT Assessment',
        department: t.chiefComplaint ? suggestDepartment(t.chiefComplaint) : 'Triage',
        gender: genderOf(t.patientId),
        age: ageOf(t.patientId),
        ...splitDateTime(t.triagedAt),
        calendarDate: isoDateKey(t.triagedAt),
        status,
        sourceId: t._id,
        encounterId: checkoutEncounter?._id,
        assignedRoom: t.assignedRoom,
      });
    }

    // Appointments only join the queue once the patient has CHECKED IN (arrived).
    // Scheduled/confirmed appointments stay in the Today's Appointments card until
    // the receptionist checks them in via the check-in popup.
    const ARRIVED = new Set<AppointmentDoc['status']>(['checked_in', 'in_progress', 'completed']);
    const apptPatientIds = new Set(todaysAppointments.map(a => a.patientId));
    const triagedPatientIds = new Set(todaysTriages.map(t => t.patientId));
    for (const a of todaysAppointments) {
      if (triagedPatientIds.has(a.patientId)) continue;
      if (!ARRIVED.has(a.status)) continue; // not checked in yet → not in the queue
      const checkoutEncounter = checkoutEncounterByPatient.get(a.patientId);
      const status = checkoutEncounter ? 'DONE' :
                     a.status === 'completed' ? 'DONE' :
                     a.status === 'in_progress' ? 'IN CONSULT' : 'WAITING';
      items.push({
        id: `appt-${a._id}`,
        patientId: a.patientId,
        patientName: a.patientName,
        type: 'appointment',
        priority: a.priority === 'emergency' ? 'RED' : a.priority === 'urgent' ? 'YELLOW' : 'normal',
        complaint: a.reason || 'Scheduled visit',
        department: a.department || 'OPD',
        gender: genderOf(a.patientId),
        age: ageOf(a.patientId),
        date: splitDateTime(a.appointmentDate).date,
        time: a.appointmentTime,
        calendarDate: isoDateKey(a.appointmentDate),
        status,
        sourceId: a._id,
        encounterId: checkoutEncounter?._id,
      });
    }

    // Add recent registrations not already in the queue (replaces the old
    // "Recent Registrations" card — every registered patient awaiting a visit).
    const queuedPatientIds = new Set(items.map(it => it.patientId));
    for (const enc of checkoutEncounterByPatient.values()) {
      if (queuedPatientIds.has(enc.patientId)) continue;
      const patient = patientById.get(enc.patientId);
      items.push({
        id: `encounter-${enc._id}`,
        patientId: enc.patientId,
        patientName: enc.patientName || (patient ? patientFullName(patient) : 'Patient'),
        type: 'walk-in',
        priority: 'normal',
        complaint: String(enc.snapshot?.chiefComplaint || 'Clinical checkout'),
        department: 'Checkout',
        gender: genderOf(enc.patientId),
        age: ageOf(enc.patientId),
        ...splitDateTime(enc.updatedAt || enc.closedAt || enc.startedAt),
        calendarDate: isoDateKey(enc.updatedAt || enc.closedAt || enc.startedAt),
        status: 'DONE',
        sourceId: enc._id,
        encounterId: enc._id,
      });
      queuedPatientIds.add(enc.patientId);
    }
    const recent = [...patients].sort((a, b) =>
      patientRegisteredAt(b).localeCompare(patientRegisteredAt(a)));
    for (const p of recent) {
      if (queuedPatientIds.has(p._id)) continue;
      // A patient with a today's appointment is handled by the check-in flow
      // above — don't also list them as a generic "registered" walk-in.
      if (apptPatientIds.has(p._id)) continue;
      const registeredAt = patientRegisteredAt(p);
      if (isoDateKey(registeredAt) !== today) continue;
      items.push({
        id: `patient-${p._id}`,
        patientId: p._id,
        patientName: patientFullName(p),
        type: 'registered',
        priority: 'normal',
        complaint: 'Newly registered',
        department: patientGenderAge(p),
        gender: p.gender || '—',
        age: patientAgeLabel(p),
        ...splitDateTime(registeredAt),
        calendarDate: isoDateKey(registeredAt),
        status: 'WAITING',
        sourceId: p._id,
        registeredAt,
      });
    }

    // Sort: RED → YELLOW → GREEN → normal, then registered last (recent first).
    const pOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2, normal: 3 };
    const rank = (it: QueueItem) => it.type === 'registered' ? 4 : (pOrder[it.priority] ?? 3);
    items.sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r) return r;
      if (a.type === 'registered' && b.type === 'registered') {
        return (b.registeredAt || '').localeCompare(a.registeredAt || '');
      }
      return a.time.localeCompare(b.time);
    });

    return items;
  }, [encounters, patients, today, todaysAppointments, todaysTriages]);

  const filteredQueue = useMemo(() => {
    let items = queueFilter === 'all' ? queue : queue.filter(q => q.type === queueFilter);

    const q = queueSearch.trim().toLowerCase();
    if (q) {
      items = items.filter(it =>
        it.patientName.toLowerCase().includes(q) ||
        it.complaint.toLowerCase().includes(q) ||
        it.department.toLowerCase().includes(q)
      );
    }

    if (queueSort !== 'priority') {
      const statusOrder: Record<string, number> = { 'WAITING': 0, 'IN CONSULT': 1, 'DONE': 2, 'ADMITTED': 3, 'REFERRED': 4 };
      items = [...items].sort((a, b) => {
        if (queueSort === 'name') return a.patientName.localeCompare(b.patientName);
        if (queueSort === 'time') return a.time.localeCompare(b.time);
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      });
    }

    return items;
  }, [queue, queueFilter, queueSearch, queueSort]);

  const filteredRegisteredPatients = useMemo(() => {
    const sorted = [...patients].sort((a, b) =>
      patientRegisteredAt(b).localeCompare(patientRegisteredAt(a)));
    const q = queueSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(patient => {
      const name = patientFullName(patient).toLowerCase();
      const phone = (patient.phone || '').toLowerCase();
      const hospitalNumber = (patient.hospitalNumber || '').toLowerCase();
      const location = [patient.county, patient.state].filter(Boolean).join(' ').toLowerCase();
      return name.includes(q) || phone.includes(q) || hospitalNumber.includes(q) || location.includes(q);
    });
  }, [patients, queueSearch]);

  const recentPatients = useMemo(() => (
    [...patients]
      .sort((a, b) => patientRegisteredAt(b).localeCompare(patientRegisteredAt(a)))
      .slice(0, 6)
  ), [patients]);

  // ── Selected patient previous visit info (from real records) ──
  const selectedPatient = useMemo(() =>
    selectedPatientId ? patients.find(p => p._id === selectedPatientId) : null,
    [selectedPatientId, patients]
  );

  // ── Room assignment (OPD rooming) for triage-sourced queue entries ──
  const handleSaveRoom = useCallback(async (triageId: string, room: string) => {
    setSavingRoom(true);
    try {
      await updateTriage(triageId, { assignedRoom: room || undefined });
      showToast(room ? `Room set to ${room}` : 'Room cleared', 'success');
    } catch {
      showToast('Failed to set room', 'error');
    } finally {
      setSavingRoom(false);
    }
  }, [updateTriage, showToast]);

  // ── Final checkout: close out a completed visit ──
  const handleCompleteCheckout = useCallback(async (target: CheckoutTarget) => {
    try {
      // Stage 10 — Facility checkout gate. Evaluate the documented checkout gate
      // (prescriptions dispensed, critical labs reviewed, …) and advance the
      // clinical encounter to a terminal `discharged` status. Unmet critical
      // items don't block the desk from closing the visit, but they flag it as
      // `discharged_with_pending_items` and warn the receptionist.
      let gateNote = '';
      try {
        const {
          getEncounter, getOpenEncounterForPatient, dischargeEncounter,
        } = await import('@/lib/services/encounter-service');
        const enc = target.encounterId
          ? await getEncounter(target.encounterId)
          : await getOpenEncounterForPatient(target.patientId);
        if (enc) {
          const { getPrescriptionsByPatient } = await import('@/lib/services/prescription-service');
          const { getLabResultsByPatient } = await import('@/lib/services/lab-service');
          const { unmetCriticalGateItems } = await import('@/lib/clinical-flow/encounter-journey');

          const rxs = (await getPrescriptionsByPatient(target.patientId)).filter(r => !r.encounterId || r.encounterId === enc._id);
          // Lab results aren't encounter-linked, so critical labs are checked at
          // patient level (any unreviewed critical result blocks a clean discharge).
          const labs = await getLabResultsByPatient(target.patientId);
          const reviewed = new Set(['reviewed_by_clinician', 'acted_upon', 'communicated_to_patient']);

          const satisfied: string[] = [
            // The clinician closing the visit implies these were handled.
            'all_clinic_visits_closed', 'in_clinic_procedures_complete',
            'required_documentation_generated', 'payment_status_determined',
            'pending_items_flagged',
          ];
          if (rxs.every(r => r.status !== 'pending')) satisfied.push('prescriptions_dispensed');
          if (!labs.some(l => l.critical && l.status === 'completed' && !reviewed.has(l.orderStatus ?? ''))) {
            satisfied.push('critical_labs_reviewed');
          }

          const unmet = unmetCriticalGateItems(satisfied);
          await dischargeEncounter(enc._id, { actorId: currentUser?._id, pendingItems: unmet.length > 0 });
          if (unmet.length > 0) gateNote = ` — flagged: ${unmet.map(u => u.label).join('; ')}`;
        }
      } catch (e) {
        console.warn('Encounter discharge during checkout failed', e);
      }

      if (target.appointmentId) {
        await updateAppointmentStatus(target.appointmentId, 'completed');
      } else if (target.triageId) {
        // 'discharged' is the terminal status in the TriageDoc status union.
        await updateTriage(target.triageId, { status: 'discharged' });
      }
      showToast(`${target.patientName} checked out${gateNote}`, 'success');
      setCheckoutTarget(null);
    } catch {
      showToast('Failed to complete checkout', 'error');
    }
  }, [updateAppointmentStatus, updateTriage, showToast, currentUser]);

  // ── Appointment check-in: mark the patient as arrived → joins the queue ──
  const handleCheckIn = useCallback(async (appt: AppointmentDoc) => {
    await updateAppointmentStatus(appt._id, 'checked_in');
    showToast(`${appt.patientName} checked in — added to queue`, 'success');
    setCheckInTarget(null);
  }, [updateAppointmentStatus, showToast]);

  // ── Reverse an appointment check-in: send the patient back to scheduled so
  //    a mistaken "arrived" can be corrected. Appointment status has no
  //    forward-only guard, so this round-trips cleanly. (Triage check-in has
  //    no equivalent here — see BACKEND GAPS.) ──
  const handleUndoCheckIn = useCallback(async (appt: AppointmentDoc) => {
    try {
      await updateAppointmentStatus(appt._id, 'scheduled');
      showToast(`${appt.patientName} check-in reversed`, 'success');
      setCheckInTarget(null);
    } catch {
      showToast('Failed to reverse check-in', 'error');
    }
  }, [updateAppointmentStatus, showToast]);

  // ── Reverse a completed checkout for an APPOINTMENT-sourced visit: set the
  //    appointment back to checked_in so the patient re-enters the live queue.
  //    Only appointment checkouts are reversible — a triage checkout writes the
  //    terminal `discharged` status (see BACKEND GAPS). ──
  const handleUndoCheckout = useCallback(async (appointmentId: string, patientName: string) => {
    try {
      await updateAppointmentStatus(appointmentId, 'checked_in');
      showToast(`Checkout reversed for ${patientName}`, 'success');
    } catch {
      showToast('Failed to reverse checkout', 'error');
    }
  }, [updateAppointmentStatus, showToast]);

  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;
  const canUseRoute = useCallback((href: string) => {
    if (!roleConfig) return false;
    return roleConfig.allowedRoutes.includes(href);
  }, [roleConfig]);

  const pendingAppointments = useMemo(() => {
    const pendingStatuses = new Set<AppointmentDoc['status']>(['requested', 'scheduled', 'confirmed']);
    const triagedPatientIds = new Set(todaysTriages.map(item => item.patientId));
    return todaysAppointments.filter(appointment => pendingStatuses.has(appointment.status) && !triagedPatientIds.has(appointment.patientId));
  }, [todaysAppointments, todaysTriages]);

  const dateLabel = useMemo(() => (
    new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date())
  ), []);

  const tabs = useMemo(() => ([
    { key: 'all', label: 'All', count: queue.length + pendingAppointments.length },
    { key: 'walk-in', label: 'Walk-ins', count: queue.filter(q => q.type === 'walk-in').length },
    { key: 'appointment', label: 'Appointments', count: queue.filter(q => q.type === 'appointment').length + pendingAppointments.length },
    { key: 'referral', label: 'Referrals', count: queue.filter(q => q.type === 'referral').length },
  ]), [queue, pendingAppointments.length]);

  const handleTabChange = useCallback((tab: string) => {
    const next = tab as typeof queueFilter;
    setQueueFilter(next);
    setPanelView(next === 'appointment' ? 'appointments' : next === 'all' ? 'all' : 'queue');
  }, []);

  const openFullRegistration = useCallback(() => {
    setRegisterOpen(false);
    router.push('/patients/new');
  }, [router]);

  const visiblePendingAppointments = useMemo(() => {
    if (queueFilter !== 'all' && queueFilter !== 'appointment') return [];
    const q = queueSearch.trim().toLowerCase();
    const items = q
      ? pendingAppointments.filter(appointment =>
          appointment.patientName.toLowerCase().includes(q) ||
          (appointment.reason || '').toLowerCase().includes(q) ||
          (appointment.department || '').toLowerCase().includes(q)
        )
      : pendingAppointments;
    return items.sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''));
  }, [pendingAppointments, queueFilter, queueSearch]);

  const actions = useMemo<EhrCareDashboardAction[]>(() => ([
    ...(canUseRoute('/check-in') ? [{ label: 'Check in', icon: ClipboardCheck, onClick: () => setCheckInOpen(true), tone: 'primary' as const }] : []),
    ...(canUseRoute('/patients') ? [{ label: t('frontDesk.registerNewPatient'), icon: UserPlus, onClick: () => setRegisterOpen(true) }] : []),
    ...(canUseRoute('/referrals') ? [{ label: t('frontDesk.viewReferrals'), icon: ArrowRightLeft, onClick: () => router.push('/referrals') }] : []),
    ...(canUseRoute('/appointments') ? [{ label: t('nav.appointments'), icon: Calendar, onClick: () => router.push('/appointments') }] : []),
  ]), [canUseRoute, router, t]);

  // Quick-navigation strip mirroring the Clinical Officer dashboard's clinical
  // strip. Route-guarded so a clinic clerk never sees a shortcut they can't open.
  const actionStrip = useMemo<EhrCareDashboardAction[]>(() => ([
    ...(canUseRoute('/patients') ? [{ label: 'Patient registry', icon: ClipboardList, onClick: () => router.push('/patients') }] : []),
    ...(canUseRoute('/appointments') ? [{ label: 'Appointments', icon: Calendar, onClick: () => router.push('/appointments') }] : []),
    ...(canUseRoute('/referrals') ? [{ label: 'Referrals', icon: ArrowRightLeft, onClick: () => router.push('/referrals') }] : []),
    ...(canUseRoute('/check-in') ? [{ label: 'Check-in queue', icon: ClipboardCheck, onClick: () => setCheckInOpen(true) }] : []),
  ]), [canUseRoute, router]);

  const frontDeskRows = useMemo<EhrCareDashboardRow[]>(() => {
    const appointmentRows: EhrCareDashboardRow[] = visiblePendingAppointments.map(appointment => ({
      id: `pending-appt-${appointment._id}`,
      title: appointment.patientName,
      subtitle: appointment.reason || 'Scheduled visit',
      meta: `${appointment.appointmentTime || 'No time'} · ${appointment.providerName || 'Unassigned'} · ${appointment.facilityName || currentUser?.hospitalName || 'Facility'}`,
      compactMeta: appointment.appointmentTime || 'No time',
      status: appointment.status === 'requested' ? 'requested' : 'scheduled',
      statusTone: 'scheduled',
      priority: appointment.priority === 'emergency' ? 'Emergency' : appointment.priority === 'urgent' ? 'Urgent' : 'Appointment',
      date: isoDateKey(appointment.appointmentDate),
      onClick: () => setCheckInTarget(appointment),
      actionLabel: 'Check in',
      onAction: () => setCheckInTarget(appointment),
      secondaryActionLabel: 'Record',
      onSecondaryAction: () => router.push(`/patients/${appointment.patientId}`),
    }));

    const queueRows = filteredQueue.map(entry => {
      const patient = patients.find(pp => pp._id === entry.patientId);
      const isOpen = selectedPatientId === entry.patientId;
      const pColor = priorityColor(entry.priority);
      const pLabel = entry.priority === 'RED' ? t('appointments.priorityEmergency')
        : entry.priority === 'YELLOW' ? t('appointments.priorityUrgent')
        : entry.priority === 'GREEN' ? t('appointments.priorityRoutine')
        : entry.type === 'registered' ? 'Registration' : t('lab.normal');
      const activeForCare = entry.status === 'WAITING' || entry.status === 'IN CONSULT';
      const checkoutReady = entry.status === 'DONE';
      const statusTone: EhrCareDashboardRow['statusTone'] = entry.status === 'DONE'
        ? 'done'
        : entry.status === 'ADMITTED' || entry.status === 'REFERRED'
          ? 'scheduled'
        : entry.status === 'IN CONSULT'
          ? 'active'
          : entry.priority === 'RED'
            ? 'danger'
            : entry.priority === 'YELLOW'
              ? 'warning'
              : 'ready';
      return {
        id: entry.id,
        title: entry.patientName,
        subtitle: `${entry.complaint} · ${entry.department}`,
        meta: `${entry.gender} · ${entry.age} · ${entry.date}${entry.time ? ` · ${entry.time}` : ''}`,
        compactMeta: entry.time || entry.date,
        status: entry.status.toLowerCase(),
        statusTone,
        priority: pLabel,
        room: entry.assignedRoom,
        date: entry.calendarDate,
        onClick: () => setSelectedPatientId(isOpen ? null : entry.patientId),
        actionLabel: checkoutReady ? t('frontDesk.checkout') : activeForCare ? t('frontDesk.assign') : 'Record',
        onAction: () => {
          if (checkoutReady) {
            setCheckoutTarget({
              patientId: entry.patientId,
              patientName: entry.patientName,
              hospitalNumber: patient?.hospitalNumber,
              encounterId: entry.encounterId,
              appointmentId: entry.id.startsWith('appt-') ? entry.sourceId : undefined,
              triageId: entry.id.startsWith('triage-') ? entry.sourceId : undefined,
            });
            return;
          }
          if (!activeForCare) {
            router.push(`/patients/${entry.patientId}`);
            return;
          }
          setAssignTarget({
            patientId: entry.patientId,
            patientName: entry.patientName,
            hospitalNumber: patient?.hospitalNumber,
            triageId: entry.id.startsWith('triage-') ? entry.sourceId : undefined,
            currentDoctorId: patient?.assignedDoctor,
          });
        },
        secondaryActionLabel: checkoutReady && entry.id.startsWith('appt-')
          ? t('action.undo')
          : canConsult && activeForCare
            ? t('frontDesk.startConsultation')
            : 'Records',
        onSecondaryAction: () => {
          if (checkoutReady && entry.id.startsWith('appt-')) {
            handleUndoCheckout(entry.sourceId, entry.patientName);
            return;
          }
          if (canConsult && activeForCare) {
            router.push(`/consultation?patientId=${entry.patientId}`);
            return;
          }
          router.push(`/patients/${entry.patientId}`);
        },
        detail: isOpen && selectedPatient ? (
          <div className="ehr-care-detail">
            <div>
              <strong>{patientFullName(selectedPatient)}</strong>
              <span>{selectedPatient.hospitalNumber || 'No hospital number'}</span>
            </div>
            <dl>
              <div><dt>{t('frontDesk.genderAge')}</dt><dd>{patientGenderAge(selectedPatient)}</dd></div>
              <div><dt>{t('patient.phone')}</dt><dd>{selectedPatient.phone ? formatPhoneDisplay(selectedPatient.phone) : 'N/A'}</dd></div>
              <div><dt>{t('patient.location')}</dt><dd>{selectedPatient.county}, {selectedPatient.state}</dd></div>
              <div><dt>{t('frontDesk.lastVisit')}</dt><dd>{selectedPatient.lastConsultedAt ? formatCompactDateTime(selectedPatient.lastConsultedAt) : selectedPatient.lastVisitDate || t('frontDesk.firstVisit')}</dd></div>
            </dl>
            {selectedPatient.allergies?.length > 0 && selectedPatient.allergies[0] !== 'None known' && (
              <p className="ehr-care-alert">{t('frontDesk.allergiesLabel', { list: selectedPatient.allergies.join(', ') })}</p>
            )}
            {entry.id.startsWith('triage-') && (
              <div className="ehr-care-rooming">
                <MapPin className="w-4 h-4" />
                <span>Exam room</span>
                <select
                  value={roomDraft || entry.assignedRoom || ''}
                  onChange={(event) => setRoomDraft(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {roomOptions.map(room => <option key={room} value={room}>{room}</option>)}
                </select>
                <button
                  type="button"
                  disabled={savingRoom}
                  onClick={() => { handleSaveRoom(entry.sourceId, roomDraft || entry.assignedRoom || ''); setRoomDraft(''); }}
                >
                  {savingRoom ? 'Saving...' : entry.assignedRoom ? 'Update room' : 'Assign room'}
                </button>
                <span style={{ color: pColor }}>{pLabel}</span>
              </div>
            )}
          </div>
        ) : undefined,
      };
    });

    const registeredRows: EhrCareDashboardRow[] = filteredRegisteredPatients.map(patient => {
      const registered = splitDateTime(patientRegisteredAt(patient));
      return {
        id: `registered-${patient._id}`,
        title: patientFullName(patient),
        subtitle: patient.hospitalNumber || patientGenderAge(patient),
        meta: `${patientGenderAge(patient)} · ${registered.date}${registered.time ? ` · ${registered.time}` : ''}`,
        compactMeta: registered.time || registered.date,
        status: 'registered',
        statusTone: 'ready',
        priority: 'Registered',
        date: isoDateKey(patientRegisteredAt(patient)),
        onClick: () => router.push(`/patients/${patient._id}`),
        actionLabel: 'Record',
        onAction: () => router.push(`/patients/${patient._id}`),
      };
    });

    if (panelView === 'pending') return appointmentRows;
    if (panelView === 'queue') return queueRows;
    if (panelView === 'registered') return registeredRows;
    return [...appointmentRows, ...queueRows];
  }, [
    canConsult,
    currentUser?.hospitalName,
    filteredQueue,
    filteredRegisteredPatients,
    handleSaveRoom,
    handleUndoCheckout,
    patients,
    panelView,
    roomDraft,
    roomOptions,
    router,
    savingRoom,
    selectedPatient,
    selectedPatientId,
    t,
    visiblePendingAppointments,
  ]);

  const metrics = useMemo<EhrCareDashboardMetric[]>(() => ([
    {
      label: "Today's appointments",
      value: todaysAppointments.length,
      active: panelView === 'appointments',
      onClick: () => {
        setQueueFilter('appointment');
        setPanelView('appointments');
      },
    },
    {
      label: 'Pending arrivals',
      value: pendingAppointments.length,
      tone: pendingAppointments.length > 0 ? 'warning' : 'neutral',
      active: panelView === 'pending',
      onClick: () => {
        setQueueFilter('appointment');
        setPanelView('pending');
      },
    },
    {
      label: 'Live queue',
      value: queue.length,
      active: panelView === 'queue',
      onClick: () => {
        setQueueFilter('all');
        setPanelView('queue');
      },
    },
    {
      label: 'Registered patients',
      value: patients.length,
      active: panelView === 'registered',
      onClick: () => {
        setPanelView('registered');
      },
    },
  ]), [panelView, pendingAppointments.length, patients.length, queue.length, todaysAppointments.length]);

  const centerCopy = useMemo(() => {
    if (panelView === 'appointments') {
      return {
        title: "Today's appointments",
        subtitle: `${frontDeskRows.length} appointment${frontDeskRows.length === 1 ? '' : 's'} scheduled or arrived today`,
        emptyTitle: 'No appointments for this view',
        emptyActionLabel: 'Book appointment',
      };
    }
    if (panelView === 'pending') {
      return {
        title: 'Pending arrivals',
        subtitle: `${frontDeskRows.length} patient${frontDeskRows.length === 1 ? '' : 's'} waiting to check in`,
        emptyTitle: 'No pending arrivals',
        emptyActionLabel: 'Open check-in',
      };
    }
    if (panelView === 'queue') {
      return {
        title: 'Live queue',
        subtitle: `${frontDeskRows.length} patient${frontDeskRows.length === 1 ? '' : 's'} ready for desk action`,
        emptyTitle: t('frontDesk.noPatientsInQueue'),
        emptyActionLabel: 'Register patient',
      };
    }
    if (panelView === 'registered') {
      return {
        title: 'Registered patients',
        subtitle: `${frontDeskRows.length} registered record${frontDeskRows.length === 1 ? '' : 's'}`,
        emptyTitle: 'No registered patients',
        emptyActionLabel: 'Register patient',
      };
    }
    return {
      title: dateLabel,
      subtitle: `${frontDeskRows.length} active item${frontDeskRows.length === 1 ? '' : 's'}`,
      emptyTitle: t('frontDesk.noPatientsInQueue'),
      emptyActionLabel: 'Register patient',
    };
  }, [dateLabel, frontDeskRows.length, panelView, t]);

  const checklist = useMemo(() => ([
    { label: 'Register patient', done: queue.some(item => item.type === 'registered') || patients.length > 0, onClick: () => setRegisterOpen(true) },
    { label: 'Check in arrivals', done: pendingAppointments.length === 0, onClick: () => setCheckInOpen(true) },
    { label: 'Assign provider', done: queue.every(item => item.status !== 'WAITING'), onClick: () => { setQueueFilter('all'); setPanelView('queue'); } },
    { label: 'Room walk-ins', done: !queue.some(item => item.type === 'walk-in' && !item.assignedRoom), onClick: () => { setQueueFilter('walk-in'); setPanelView('queue'); } },
    { label: 'Close completed visits', done: !queue.some(item => item.status === 'DONE'), onClick: () => { setQueueFilter('all'); setPanelView('queue'); } },
  ]), [pendingAppointments.length, patients.length, queue]);

  if (!currentUser) return null;

  return (
    <>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <EhrCareDashboard
          title=""
          greetingName={currentUser.name || 'front desk'}
          dateLabel={dateLabel}
          tabs={tabs}
          activeTab={queueFilter}
          onTabChange={handleTabChange}
          searchValue={queueSearch}
          searchPlaceholder="Search patients, reasons, departments"
          onSearchChange={setQueueSearch}
          filters={[
            { label: 'Waiting', value: queue.filter(item => item.status === 'WAITING').length, active: queueFilter === 'all' && panelView !== 'registered', onClick: () => { setQueueFilter('all'); setPanelView('all'); } },
            { label: 'Arrivals', value: pendingAppointments.length, active: panelView === 'pending', onClick: () => { setQueueFilter('appointment'); setPanelView('pending'); } },
            { label: 'Walk-ins', value: queue.filter(item => item.type === 'walk-in').length, active: queueFilter === 'walk-in' && panelView === 'queue', onClick: () => { setQueueFilter('walk-in'); setPanelView('queue'); } },
            { label: 'Completed', value: queue.filter(item => item.status === 'DONE').length, onClick: () => { setQueueFilter('all'); setPanelView('queue'); } },
          ]}
          actions={actions}
          actionStrip={actionStrip}
          rows={frontDeskRows}
          metrics={metrics}
          checklist={checklist}
          calendarEventDates={appointments.map(appointment => appointment.appointmentDate)}
          metricsTitle="Reception today"
          centerTitle={centerCopy.title}
          centerSubtitle={centerCopy.subtitle}
          checklistTitle="Front desk checklist"
          checklistDescription="Registration, arrivals, routing, and checkout."
          missionTitle="Keep the desk moving"
          missionDescription="Show the next action clearly so reception can register, check in, route, and close visits."
          showMissionCard
          footerContent={(
            <section className="ehr-worklist-panel" style={{ minWidth: 0 }}>
              <div>
                <h3>Recently registered</h3>
                <span>{recentPatients.length} patients</span>
              </div>
              <div className="ehr-worklist-table" style={{ minWidth: 0 }}>
                {recentPatients.length > 0 && (
                  <div className="ehr-worklist-head" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)', minWidth: 0 }}>
                    <span>Patient</span>
                    <span>Phone</span>
                    <span>Location</span>
                    <span>Last Activity</span>
                    <span>Status</span>
                  </div>
                )}
                {recentPatients.length === 0 && (
                  <div className="ehr-worklist-empty">
                    No patients registered yet.
                    <button type="button" onClick={() => setRegisterOpen(true)}>Register new patient</button>
                  </div>
                )}
                {recentPatients.map(patient => (
                  <button key={patient._id} type="button" className="ehr-worklist-row" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)', minWidth: 0 }} onClick={() => router.push(`/patients/${patient._id}`)}>
                    <span className="ehr-worklist-name">
                      <span className="ehr-patient-icon ehr-patient-icon--sm">{initials(patientFullName(patient))}</span>
                      <span>
                        <strong>{patientFullName(patient)}</strong>
                        <small>{patient.hospitalNumber || 'No hospital number'} · {patientGenderAge(patient)}</small>
                      </span>
                    </span>
                    <span className="ehr-worklist-room">{patient.phone ? formatPhoneDisplay(patient.phone) : 'Not recorded'}</span>
                    <span className="ehr-worklist-room">{[patient.county, patient.state].filter(Boolean).join(', ') || 'Not recorded'}</span>
                    <span className="ehr-worklist-care">
                      <strong>{formatDayMonthYear(patient.lastConsultedAt || patient.lastVisitDate || patientRegisteredAt(patient))}</strong>
                    </span>
                    <span><b className="ehr-worklist-status active">Registered</b></span>
                  </button>
                ))}
              </div>
            </section>
          )}
          emptyTitle={centerCopy.emptyTitle}
          emptyActionLabel={centerCopy.emptyActionLabel}
          onEmptyAction={() => {
            if (panelView === 'appointments') {
              router.push('/appointments');
              return;
            }
            if (panelView === 'pending') {
              setCheckInOpen(true);
              return;
            }
            setRegisterOpen(true);
          }}
        />

        {assignTarget && (
          <AssignDoctorModal
            target={assignTarget}
            onClose={() => setAssignTarget(null)}
          />
        )}

        {checkoutTarget && (
          <CheckoutModal
            target={checkoutTarget}
            onClose={() => setCheckoutTarget(null)}
            onComplete={handleCompleteCheckout}
            canCollectPayment={canUseRoute('/payments')}
            onCollectPayment={(pid) => {
              router.push(`/payments?patientId=${pid}`);
            }}
          />
        )}

        {registerOpen && (
          <Modal onClose={() => setRegisterOpen(false)} width={1180} align="center" disableBackdropClose labelledBy="patient-registration-dialog-title">
            <div className="ehr-checkin-dialog ehr-registration-dialog">
              <div className="ehr-checkin-dialog-header">
                <div>
                  <h2 id="patient-registration-dialog-title">Register new patient</h2>
                  <p>Complete the full patient registration without leaving the front desk.</p>
                </div>
                <div className="ehr-registration-dialog-actions">
                  <button type="button" onClick={openFullRegistration} aria-label="Expand patient registration">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => setRegisterOpen(false)} aria-label="Close patient registration">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="ehr-checkin-dialog-body">
                <PatientRegistrationForm
                  embedded
                  onCancel={() => setRegisterOpen(false)}
                  onRegistered={() => {
                    setRegisterOpen(false);
                    setPanelView('registered');
                    router.refresh();
                  }}
                />
              </div>
            </div>
          </Modal>
        )}

        {checkInOpen && (
          <Modal onClose={() => setCheckInOpen(false)} width={760} align="top" labelledBy="patient-check-in-dialog-title">
            <div className="ehr-checkin-dialog">
              <div className="ehr-checkin-dialog-header">
                <div>
                  <h2 id="patient-check-in-dialog-title">Patient check-in</h2>
                  <p>Search the patient, record arrival details, and add them to the live queue.</p>
                </div>
                <button type="button" onClick={() => setCheckInOpen(false)} aria-label="Close check-in form">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="ehr-checkin-dialog-body">
                <PatientCheckInForm
                  mode="modal"
                  onCancel={() => setCheckInOpen(false)}
                  onComplete={() => {
                    setCheckInOpen(false);
                    setQueueFilter('all');
                    setPanelView('queue');
                  }}
                  onRegisterPatient={() => {
                    setCheckInOpen(false);
                    setRegisterOpen(true);
                  }}
                />
              </div>
            </div>
          </Modal>
        )}

        {checkInTarget && (
          <CheckInModal
            appt={checkInTarget}
            onClose={() => setCheckInTarget(null)}
            onCheckIn={handleCheckIn}
            onUndoCheckIn={handleUndoCheckIn}
            onViewPatient={(pid) => router.push(`/patients/${pid}`)}
          />
        )}
      </main>
    </>
  );
}

// ── Final-checkout modal: confirm balance settled, mark the visit complete ──
function CheckoutModal({
  target,
  onClose,
  onComplete,
  canCollectPayment,
  onCollectPayment,
}: {
  target: CheckoutTarget;
  onClose: () => void;
  onComplete: (target: CheckoutTarget) => Promise<void>;
  canCollectPayment: boolean;
  onCollectPayment: (patientId: string) => void;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [charges, setCharges] = useState<{ description: string; amount: number }[]>([]);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getPatientBalance } = await import('@/lib/services/ledger-service');
        const b = await getPatientBalance(target.patientId);
        if (!cancelled) setBalance(b);
      } catch {
        if (!cancelled) setBalance(0);
      }
      // Itemized fee ticket for this visit so the desk sees what was billed.
      try {
        const { getEncounter, getOpenEncounterForPatient } = await import('@/lib/services/encounter-service');
        const enc = target.encounterId
          ? await getEncounter(target.encounterId)
          : await getOpenEncounterForPatient(target.patientId);
        if (enc) {
          const { getChargesByEncounter } = await import('@/lib/services/payment-service');
          const ch = await getChargesByEncounter(enc._id);
          if (!cancelled) setCharges(ch.map(c => ({ description: c.description, amount: c.billedAmount })));
        }
      } catch { /* non-fatal — balance still shows */ }
    })();
    return () => { cancelled = true; };
  }, [target.encounterId, target.patientId]);

  const owes = (balance ?? 0) > 0;

  return (
    <Modal onClose={onClose} width={440}>
      <div className="modal-content card-elevated" style={{ width: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Final checkout</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {target.patientName}{target.hospitalNumber ? ` · ${target.hospitalNumber}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-black/5" aria-label="Close">
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {charges.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Visit charges</p>
              <ul className="space-y-1">
                {charges.map((c, i) => (
                  <li key={i} className="flex justify-between text-[12px]">
                    <span style={{ color: 'var(--text-primary)' }}>{c.description}</span>
                    <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatMoney(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {balance === null ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Checking balance…</p>
          ) : owes ? (
            <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#EF4444' }}>Outstanding balance</span>
                <Wallet className="w-4 h-4" style={{ color: '#EF4444' }} />
              </div>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#EF4444' }}>{formatMoney(balance)}</p>
              {canCollectPayment ? (
                <button
                  onClick={() => onCollectPayment(target.patientId)}
                  className="mt-2.5 w-full text-[12px] font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                  style={{ background: '#EF4444' }}
                >
                  <Wallet className="w-4 h-4" />Collect payment
                </button>
              ) : (
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Send this patient to cashier or billing to collect payment.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-light)' }}>
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Balance settled</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No outstanding charges on this account.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button
            onClick={async () => { setCompleting(true); await onComplete(target); setCompleting(false); }}
            disabled={completing}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-success)' }}
          >
            <CheckCircle className="w-4 h-4" />
            {completing ? 'Closing…' : 'Complete checkout'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Appointment check-in modal: confirm the patient has arrived; on check-in
//    they're added to the live patient queue. ──
function CheckInModal({
  appt,
  onClose,
  onCheckIn,
  onUndoCheckIn,
  onViewPatient,
}: {
  appt: AppointmentDoc;
  onClose: () => void;
  onCheckIn: (appt: AppointmentDoc) => Promise<void>;
  onUndoCheckIn: (appt: AppointmentDoc) => Promise<void>;
  onViewPatient: (patientId: string) => void;
}) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [reversing, setReversing] = useState(false);
  const alreadyIn = appt.status === 'checked_in' || appt.status === 'in_progress' || appt.status === 'completed';
  // Only a plain check-in (not yet in consult / completed) can be cleanly
  // reversed back to scheduled without stepping over later workflow state.
  const canReverseCheckIn = appt.status === 'checked_in';

  return (
    <Modal onClose={onClose} width={440}>
      <div className="modal-content card-elevated" style={{ width: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{t('frontDesk.checkInTitle')}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{appt.patientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-black/5" aria-label="Close">
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body — appointment detail */}
        <div className="p-4 space-y-2.5">
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <DetailRow icon={<Calendar className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />} label={t('frontDesk.colTime')} value={appt.appointmentTime} />
            <DetailRow icon={<ClipboardList className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />} label={t('frontDesk.colComplaint')} value={appt.reason || '—'} />
            <DetailRow icon={<MapPin className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />} label={t('frontDesk.department')} value={appt.department || '—'} />
          </div>
          {alreadyIn && (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-light)' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{t('frontDesk.alreadyInQueue')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={() => onViewPatient(appt.patientId)} className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--accent-primary)' }}>
            {t('frontDesk.viewProfile')}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
              {t('action.cancel')}
            </button>
            {/* Reverse a mistaken check-in — sends the appointment back to
                scheduled and drops it from the live queue. */}
            {canReverseCheckIn && (
              <button
                onClick={async () => { setReversing(true); try { await onUndoCheckIn(appt); } finally { setReversing(false); } }}
                disabled={reversing}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5 disabled:opacity-50"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}
              >
                <ArrowRightLeft className="w-4 h-4" />
                {reversing ? '…' : t('action.undo')}
              </button>
            )}
            {!alreadyIn && (
              <button
                onClick={async () => { setChecking(true); try { await onCheckIn(appt); } finally { setChecking(false); } }}
                disabled={checking}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: 'var(--color-success)' }}
              >
                <CheckCircle className="w-4 h-4" />
                {checking ? t('frontDesk.checkingIn') : t('frontDesk.checkIn')}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 78 }}>{label}</span>
      <span className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
