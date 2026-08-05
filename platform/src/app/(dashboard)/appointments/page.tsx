'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { formatClockTime } from '@/lib/format-utils';
import AppointmentStatusSelect from '@/components/appointments/AppointmentStatusSelect';
import AppointmentDetailFields, { type AppointmentDetailFieldValues } from '@/components/appointments/AppointmentDetailFields';
import {
  APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_I18N_KEYS,
  APPOINTMENT_CLOSED_STATUSES, APPOINTMENT_PENDING_STATUSES, APPOINTMENT_STATUS_FLOW,
  APPOINTMENT_STATUS_EXITS, priorAppointmentStatus,
} from '@/lib/appointment-status';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AvailabilityModal from '@/components/AvailabilityModal';
import {
  Calendar, Plus, CheckCircle2, User,
  AlertTriangle, RefreshCw,
  Video, Stethoscope, Syringe, HeartPulse, FlaskConical,
  X, UserPlus, ClipboardList,
  ExternalLink, ChevronLeft, ChevronRight,
  Download, Filter,
} from '@/components/icons/lucide';
import EhrListHeader, { LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { usePatients } from '@/lib/hooks/usePatients';
import { useInsuredPatientIds } from '@/lib/hooks/usePayments';
import { initials, patientAgeLabel, patientFullName, stateTint } from '@/lib/patient-utils';
import { useApp } from '@/lib/context';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { FilterBar, SearchInput, FilterSelect } from '@/components/filters';
import type { AppointmentType, AppointmentPriority, AppointmentStatus, FacilityLevel } from '@/lib/db-types';
import dynamic from 'next/dynamic';
import PortalModal from '@/components/Modal';
import PatientName from '@/components/PatientName';
import { jubaDate, jubaNow, jubaTime } from '@/lib/time-juba';
import PageInstructionCard from '@/components/PageInstructionCard';

// react-big-calendar (and its CSS) is a heavy client-only library. Split it out
// of the route's initial bundle so it loads only when the calendar view renders.
const AppointmentsCalendar = dynamic(() => import('./_AppointmentsCalendar'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', minHeight: 560 }} />,
});

/* ─── Config ─── */
const appointmentTypes: { value: AppointmentType; label: string; icon: typeof Calendar; color: string; bg: string }[] = [
  { value: 'general',      label: 'General Consultation', icon: Stethoscope,   color: '#2191D0', bg: 'rgba(33,145,208,0.10)' },
  { value: 'follow_up',    label: 'Follow-Up',            icon: RefreshCw,     color: '#015697', bg: 'rgba(1,86,151,0.10)' },
  { value: 'specialist',   label: 'Specialist',           icon: User,          color: '#015697', bg: 'rgba(3,105,161,0.10)' },
  { value: 'anc',          label: 'Antenatal Care',       icon: HeartPulse,    color: '#047857', bg: 'rgba(4,120,87,0.10)' },
  { value: 'immunization', label: 'Immunization',         icon: Syringe,       color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  { value: 'lab',          label: 'Laboratory',           icon: FlaskConical,  color: '#2191D0', bg: 'rgba(8,145,178,0.10)' },
  { value: 'telehealth',   label: 'Telehealth',           icon: Video,         color: '#015697', bg: 'rgba(14,116,144,0.10)' },
  { value: 'surgical',     label: 'Surgical',             icon: Stethoscope,   color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
  { value: 'dental',       label: 'Dental',               icon: Stethoscope,   color: '#015697', bg: 'rgba(29,78,216,0.10)' },
  { value: 'mental_health',label: 'Mental Health',        icon: HeartPulse,    color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  { value: 'walk_in',      label: 'Walk-In',              icon: UserPlus,      color: '#2191D0', bg: 'rgba(33,145,208,0.10)' },
];

// Fallback list when the facility hasn't set its departments in Facility Settings.
const FALLBACK_DEPARTMENTS = [
  'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'Surgery',
  'Emergency', 'Cardiology', 'Orthopedics', 'Ophthalmology', 'Neurology',
  'Dermatology', 'ENT', 'Outpatient', 'Dental', 'Mental Health', 'Maternity',
];

// Colours and labels both come from the shared vocabulary, so this list and
// the chart's status dropdown can no longer disagree about what a status is
// called (it used to say "In Progress" where the chart said "Roomed").
const statusConfig = Object.fromEntries(
  (Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]).map(status => [
    status,
    { ...APPOINTMENT_STATUS_COLORS[status], label: APPOINTMENT_STATUS_LABELS[status] },
  ]),
) as Record<AppointmentStatus, { color: string; bg: string; label: string }>;

const priorityConfig: Record<AppointmentPriority, { color: string; label: string }> = {
  routine: { color: 'var(--color-success)', label: 'Routine' },
  urgent: { color: 'var(--color-warning)', label: 'Urgent' },
  emergency: { color: 'var(--color-danger)', label: 'Emergency' },
};

const timeSlots = Array.from({ length: 24 }, (_, h) =>
  ['00', '30'].map(m => `${h.toString().padStart(2, '0')}:${m}`)
).flat().filter(t => { const h = parseInt(t.split(':')[0]); return h >= 7 && h <= 18; });

function statusSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function appointmentTimeMinutes(time?: string): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const value = time.trim();
  const match12 = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2]);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
  const match24 = value.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) return Number(match24[1]) * 60 + Number(match24[2]);
  return Number.MAX_SAFE_INTEGER;
}

function appointmentOperationalCue(apt: { appointmentType: AppointmentType; appointmentDate: string; appointmentTime: string; status: AppointmentStatus; checkedInAt?: string }) {
  if (apt.status === 'checked_in') return 'Checked in';
  if (apt.status === 'in_progress') return 'With clinician';
  if (apt.status === 'completed') return 'Visit complete';
  if (apt.status === 'cancelled') return 'Cancelled';
  if (apt.status === 'no_show') return 'No show';
  if (apt.appointmentType === 'walk_in') return apt.checkedInAt ? 'Walk-in arrived' : 'Walk-in waiting';

  const minutesOfDay = appointmentTimeMinutes(apt.appointmentTime);
  const scheduled = new Date(`${apt.appointmentDate}T00:00:00`);
  if (minutesOfDay !== Number.MAX_SAFE_INTEGER) scheduled.setMinutes(minutesOfDay);
  if (Number.isNaN(scheduled.getTime())) return 'Appointment';
  const minutes = Math.round((scheduled.getTime() - Date.now()) / 60000);
  if (minutes > 0) return minutes <= 60 ? `Appt. in ${minutes} mins` : `Appt. in ${Math.round(minutes / 60)}h`;
  if (minutes === 0) return 'Appointment now';
  const overdue = Math.abs(minutes);
  return overdue <= 60 ? `${overdue} mins late` : `${Math.round(overdue / 60)}h late`;
}

/* ─── Page ─── */
export default function AppointmentsPage() {
  const { appointments, create, updateStatus, reschedule, update } = useAppointments();
  const { patients } = usePatients();
  const { currentUser, globalSearch } = useApp();
  const {
    canBookAppointments,
    canConfirmAppointments,
    canDoTelehealth,
    canManageAppointmentSchedule,
    canCheckInAppointments,
    canAdvanceAppointments,
    canExportAppointments,
  } = usePermissions();
  // Anyone who can move a booking along the ladder gets the pill-as-picker;
  // read-only roles keep a plain pill.
  const canChangeAppointmentStatus = canConfirmAppointments || canCheckInAppointments || canAdvanceAppointments;
  // The picker's own option list, independent of whether it renders at all:
  // forward progression (arrived/checked in/roomed/in progress/completed…) is
  // open to anyone above, but the exits are not — dropping a patient with
  // Cancelled, No Show or Rescheduled belongs to reception/scheduling, same as
  // the dedicated Reschedule and (former) Cancel actions beside it always
  // required. `cancelled` is excluded even for schedule-management roles: it
  // needs a reason, and only the dedicated Cancel button below (which still
  // opens the reason dialog) collects one — the picker never writes it
  // directly.
  const statusPickerOptions = useMemo(() => [
    ...APPOINTMENT_STATUS_FLOW,
    ...(canManageAppointmentSchedule ? APPOINTMENT_STATUS_EXITS.filter(s => s !== 'cancelled') : []),
  ], [canManageAppointmentSchedule]);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { departments: facilityDepartments } = useSettings();
  const departments = facilityDepartments.length ? facilityDepartments : FALLBACK_DEPARTMENTS;

  // Translated label lookups for module-level config (which can't call t()).
  const typeLabelKey: Record<AppointmentType, string> = {
    general: 'appointments.typeGeneral', follow_up: 'appointments.typeFollowUp',
    specialist: 'appointments.typeSpecialist', anc: 'appointments.typeAnc',
    immunization: 'appointments.typeImmunization', lab: 'appointments.typeLab',
    telehealth: 'appointments.typeTelehealth', surgical: 'appointments.typeSurgical',
    dental: 'appointments.typeDental', mental_health: 'appointments.typeMentalHealth',
    walk_in: 'appointments.typeWalkIn',
  };
  const statusLabelKey = APPOINTMENT_STATUS_I18N_KEYS;
  const priorityLabelKey: Record<AppointmentPriority, string> = {
    routine: 'appointments.priorityRoutine', urgent: 'appointments.priorityUrgent',
    emergency: 'appointments.priorityEmergency',
  };

  // Insurance coverage lives in separate insurance_policy docs (not on the
  // appointment); the hook exposes the set of covered patient ids so each
  // appointment can be badged Insured / Not insured.
  const insuredIds = useInsuredPatientIds();

  const router = useRouter();
  const [calView, setCalView] = useState<'month' | 'week' | 'day'>('month');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [listSearch, setListSearch] = useState('');
  const [listStatus, setListStatus] = useState('all');
  // The day the redesigned list view is scoped to (header date picker); stat
  // cards + table both reflect just this day. Defaults to Africa/Juba "today".
  const [listDate, setListDate] = useState(() => jubaDate());
  // Header "service type" filter (appointment type), applied to the table only.
  // Appointment opened in the click-to-view detail popup.
  const [eventApt, setEventApt] = useState<typeof appointments[0] | null>(null);
  // List rows unfold in place instead of opening a dialog — the queue stays on
  // screen while one appointment is read. `eventApt` above is now only the
  // calendar's dialog, where there is no row to unfold beneath.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [editingApt, setEditingApt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Deep link: TopBar "+ → Schedule appointment" routes here with ?new=1 to
  // open the booking form straight away. Read on the client to avoid needing a
  // Suspense boundary around useSearchParams, then strip the param.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      if (canBookAppointments) setShowNewForm(true);
      params.delete('new');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [canBookAppointments]);

  // Deep link: a patient chart's "Appointments" quick action / front-desk
  // checkout routes here with ?patientId= to land already filtered to that
  // patient's appointments. Kept separate from the ?new=1 effect above since
  // it depends on `patients` having loaded (retries via the dep array instead
  // of running once on mount).
  const patientIdParamRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || patientIdParamRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');
    if (!patientId) return;
    const patient = patients.find(p => p._id === patientId);
    if (!patient) return;
    patientIdParamRef.current = true;
    setViewMode('list');
    setListSearch(patientFullName(patient));
    params.delete('patientId');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [patients]);

  // Deep link: dashboard/consultation "Open schedule" pushes ?appointment= so
  // the specific appointment's detail popup opens directly instead of the
  // generic list. Depends on `appointments` having loaded.
  const appointmentParamRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || appointmentParamRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const appointmentId = params.get('appointment');
    if (!appointmentId) return;
    const match = appointments.find(a => a._id === appointmentId);
    if (!match) return;
    appointmentParamRef.current = true;
    setEventApt(match);
    params.delete('appointment');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [appointments]);

  // Keyboard ← → to step through appointments while the detail modal is open.
  useEffect(() => {
    if (!eventApt) return;
    const sorted = [...appointments].sort((a, b) =>
      `${a.appointmentDate}${a.appointmentTime}`.localeCompare(`${b.appointmentDate}${b.appointmentTime}`)
    );
    const idx = sorted.findIndex(a => a._id === eventApt._id);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && idx > 0) setEventApt(sorted[idx - 1]);
      if (e.key === 'ArrowRight' && idx < sorted.length - 1) setEventApt(sorted[idx + 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [eventApt, appointments]);

  // Date the react-big-calendar view is centered on (Google-Calendar-style nav).
  // Defaults to "today" in Africa/Juba so the initial focus matches the facility
  // timezone rather than whatever timezone the viewer's browser is set to.
  const [calDate, setCalDate] = useState<Date>(() => jubaNow());

  // Form state
  const [formPatient, setFormPatient] = useState('');
  const [formProvider, setFormProvider] = useState(currentUser?.name || '');
  const [formDate, setFormDate] = useState(jubaDate());
  const [formTime, setFormTime] = useState('09:00');
  const [formDuration, setFormDuration] = useState(30);
  const [formType, setFormType] = useState<AppointmentType>('general');
  const [formPriority, setFormPriority] = useState<AppointmentPriority>('routine');
  // Where the booking sits on the desk's ladder. A new booking starts at
  // Scheduled; the edit form loads whatever the appointment already is.
  const [formStatus, setFormStatus] = useState<AppointmentStatus>('scheduled');
  // Mode / location / staff / room / recurrence — the group under the status
  // dropdown in the edit form. One object so the child patches it in one call.
  const [formDetail, setFormDetail] = useState<AppointmentDetailFieldValues>({
    mode: 'in_office', recurrence: '', staffId: '', staffName: '', room: '',
  });
  const [formDepartment, setFormDepartment] = useState('Outpatient');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRecurring, setFormRecurring] = useState(false);
  const [formRecurrencePattern, setFormRecurrencePattern] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly'>('monthly');
  const [submitting, setSubmitting] = useState(false);

  // Walk-in form
  const [wiPatient, setWiPatient] = useState('');
  const [wiReason, setWiReason] = useState('');
  const [wiDepartment, setWiDepartment] = useState('Outpatient');
  const [wiPriority, setWiPriority] = useState<AppointmentPriority>('routine');
  const [wiNotes, setWiNotes] = useState('');

  // Reschedule / Cancel
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Africa/Juba "today" — NOT a UTC slice, which would roll to the next day
  // after ~21:00 local and put the date picker / highlights a day ahead.
  const today = jubaDate();

  // Appointments → react-big-calendar events. Each event keeps the full
  // appointment on `resource` so clicking can open the existing detail/edit flow.
  const calendarEvents = useMemo(() => {
    let list = appointments;
    if (filterStatus === 'pending_approval') {
      list = list.filter(a => a.status === 'scheduled' && a.appointmentDate >= today);
    } else if (filterStatus !== 'all') {
      list = list.filter(a => a.status === filterStatus);
    }
    const q = `${search} ${globalSearch}`.toLowerCase().trim();
    if (q) list = list.filter(a =>
      a.patientName.toLowerCase().includes(q) ||
      a.providerName.toLowerCase().includes(q) ||
      a.department.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q)
    );
    return list.map(a => {
      const start = new Date(`${a.appointmentDate}T${(a.appointmentTime || '00:00')}:00`);
      const end = new Date(start.getTime() + (a.duration || 30) * 60000);
      return {
        id: a._id,
        title: `${a.patientName}${a.reason ? ' · ' + a.reason : ''}`,
        start,
        end,
        resource: a,
      };
    });
  }, [appointments, filterStatus, search, globalSearch, today]);

  // Same scope as the calendar (date + search) but WITHOUT the status filter, so the
  // status tab badges show how many appointments each status holds in the current view.
  const statusBaseList = useMemo(() => {
    let list = appointments;
    if (selectedDate) list = list.filter(a => a.appointmentDate === selectedDate);
    const q = `${search} ${globalSearch}`.toLowerCase().trim();
    if (q) list = list.filter(a =>
      a.patientName.toLowerCase().includes(q) ||
      a.providerName.toLowerCase().includes(q) ||
      a.department.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q)
    );
    return list;
  }, [appointments, selectedDate, search, globalSearch]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: statusBaseList.length };
    for (const a of statusBaseList) counts[a.status] = (counts[a.status] || 0) + 1;
    return counts;
  }, [statusBaseList]);

  const statusTabs = useMemo(() => {
    const base = [{ key: 'all', label: t('appointments.allStatus'), count: statusCounts.all }];
    const fromStatuses = (Object.keys(statusConfig) as AppointmentStatus[])
      .filter(k => (statusCounts[k] || 0) > 0 || filterStatus === k)
      .map(k => ({ key: k, label: t(statusLabelKey[k]), count: statusCounts[k] || 0 }));
    return [...base, ...fromStatuses];
  }, [statusCounts, filterStatus, t, statusLabelKey]);

  // Pending approvals
  const pendingApprovals = useMemo(() => appointments.filter(a => a.status === 'scheduled' && a.appointmentDate >= today), [appointments, today]);

  const resetForm = () => {
    setFormPatient(''); setFormDate(jubaDate()); setFormTime('09:00');
    setFormDuration(30); setFormType('general'); setFormPriority('routine');
    setFormDepartment('Outpatient'); setFormReason(''); setFormNotes(''); setFormRecurring(false);
    setFormStatus('scheduled');
  };

  const loadEditForm = (apt: typeof appointments[0]) => {
    setFormDate(apt.appointmentDate); setFormTime(apt.appointmentTime); setFormDuration(apt.duration);
    setFormType(apt.appointmentType); setFormPriority(apt.priority); setFormDepartment(apt.department);
    setFormProvider(apt.providerName); setFormReason(apt.reason); setFormNotes(apt.notes || '');
    setFormStatus(apt.status);
    setFormDetail({
      // Legacy rows have no mode; a telehealth *type* is how a remote visit used
      // to be recorded, so it still reads as telehealth.
      mode: apt.appointmentMode || (apt.appointmentType === 'telehealth' ? 'telehealth' : 'in_office'),
      recurrence: apt.isRecurring ? (apt.recurrencePattern || 'weekly') : '',
      staffId: apt.staffId || '',
      staffName: apt.staffName || '',
      room: apt.room || '',
    });
  };

  const handleSubmit = async () => {
    if (!formPatient || !formDate || !formTime || !formReason) {
      showToast(t('appointments.toastFillRequired'), 'error'); return;
    }
    const patient = patients.find(p => p._id === formPatient);
    if (!patient) { showToast(t('appointments.toastSelectValidPatient'), 'error'); return; }
    setSubmitting(true);
    try {
      await create({
        patientId: patient._id, patientName: `${patient.firstName} ${patient.surname}`,
        // The form only captures a provider NAME (free text below), not a real
        // clinician id — stamping the acting clerk's own id here put every
        // desk-booked appointment on the clerk's own schedule.
        patientPhone: patient.phone || undefined, providerId: '',
        providerName: formProvider || currentUser?.name || '', facilityId: currentUser?.hospitalId || '',
        facilityName: currentUser?.hospitalName || '', facilityLevel: 'payam' as FacilityLevel,
        appointmentDate: formDate, appointmentTime: formTime, duration: formDuration,
        appointmentType: formType, priority: formPriority, department: formDepartment,
        reason: formReason, notes: formNotes || undefined, status: formStatus,
        reminderSent: false, isRecurring: formRecurring,
        recurrencePattern: formRecurring ? formRecurrencePattern : undefined,
        bookedBy: currentUser?._id || '', bookedByName: currentUser?.name || '', state: '',
        orgId: currentUser?.orgId,
      });
      showToast(t('appointments.toastBooked'), 'success'); setShowNewForm(false); resetForm();
    } catch (err) { showToast(err instanceof Error ? err.message : t('appointments.toastFailedBook'), 'error'); }
    finally { setSubmitting(false); }
  };

  const handleWalkIn = async () => {
    if (!wiPatient || !wiReason) { showToast(t('appointments.toastFillRequiredShort'), 'error'); return; }
    const patient = patients.find(p => p._id === wiPatient);
    if (!patient) { showToast(t('appointments.toastSelectValidPatientShort'), 'error'); return; }
    setSubmitting(true);
    try {
      await create({
        patientId: patient._id, patientName: `${patient.firstName} ${patient.surname}`,
        // The desk registering a walk-in is not their clinician; the queue
        // assigns one. `bookedBy` below already records who took them in.
        patientPhone: patient.phone || undefined, providerId: '',
        providerName: '', facilityId: currentUser?.hospitalId || '',
        facilityName: currentUser?.hospitalName || '', facilityLevel: 'payam' as FacilityLevel,
        appointmentDate: today, appointmentTime: jubaTime(),
        duration: 30, appointmentType: 'walk_in', priority: wiPriority,
        department: wiDepartment, reason: wiReason, notes: wiNotes || undefined,
        status: 'checked_in', reminderSent: false, isRecurring: false,
        bookedBy: currentUser?._id || '', bookedByName: currentUser?.name || '', state: '',
        orgId: currentUser?.orgId,
      });
      showToast(t('appointments.toastWalkInRegistered'), 'success'); setShowWalkIn(false);
      setWiPatient(''); setWiReason(''); setWiNotes(''); setWiDepartment('Outpatient'); setWiPriority('routine');
    } catch (err) { showToast(err instanceof Error ? err.message : t('appointments.toastFailed'), 'error'); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = useCallback(async (id: string, status: AppointmentStatus) => {
    try { await updateStatus(id, status); showToast(t('appointments.toastStatusChanged', { status: t(statusLabelKey[status]).toLowerCase() }), 'success'); }
    catch { showToast(t('appointments.toastFailedUpdate'), 'error'); }
  }, [updateStatus, showToast, t, statusLabelKey]);

  // Reversing a step reuses the same updateAppointmentStatus path (which
  // accepts any target status), so an accidental remind / confirm / check-in
  // can be undone. `priorAppointmentStatus` reads the rung off the shared
  // ladder, so a new status joins the undo path without a second map here.

  const handleReschedule = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    try { await reschedule(rescheduleId, rescheduleDate, rescheduleTime); showToast(t('appointments.toastRescheduled'), 'success'); setRescheduleId(null); }
    catch { showToast(t('appointments.toastFailedReschedule'), 'error'); }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try { await updateStatus(cancelId, 'cancelled', { cancelledReason: cancelReason, cancelledByName: currentUser?.name }); showToast(t('appointments.toastCancelled'), 'success'); setCancelId(null); setCancelReason(''); }
    catch { showToast(t('appointments.toastFailedCancel'), 'error'); }
  };

  // ── Redesigned list view (stat cards + day table) ──
  const patientById = useMemo(() => {
    const map = new Map<string, typeof patients[0]>();
    for (const p of patients) map.set(p._id, p);
    return map;
  }, [patients]);

  // Everything in the redesigned list view is scoped to the header's date.
  const dayList = useMemo(
    () => appointments.filter(a => a.appointmentDate === listDate),
    [appointments, listDate]
  );

  const dayStats = useMemo(() => {
    const checkedIn = dayList.filter(a => a.status === 'checked_in' || a.status === 'in_progress' || a.status === 'completed').length;
    // Reminded and arrived-but-not-checked-in count as not yet arrived at the
    // desk, so the stat keeps meaning "still to walk up to the window".
    const notArrived = dayList.filter(a => a.status === 'requested' || APPOINTMENT_PENDING_STATUSES.includes(a.status)).length;
    const svcCounts = new Map<AppointmentType, number>();
    for (const a of dayList) svcCounts.set(a.appointmentType, (svcCounts.get(a.appointmentType) || 0) + 1);
    let topService: { type: AppointmentType; count: number } | null = null;
    for (const [type, count] of svcCounts) if (!topService || count > topService.count) topService = { type, count };
    const providers = new Set(dayList.filter(a => a.status !== 'cancelled').map(a => a.providerName).filter(Boolean));
    return { total: dayList.length, checkedIn, notArrived, topService, providers: providers.size };
  }, [dayList]);

  const tableRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return dayList
      .filter(a => listStatus === 'all' || a.status === listStatus)
      .filter(a => {
        if (!q) return true;
        const identifier = patientById.get(a.patientId)?.hospitalNumber || '';
        return a.patientName.toLowerCase().includes(q) || a.reason.toLowerCase().includes(q) ||
          identifier.toLowerCase().includes(q) || a.department.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const byTime = appointmentTimeMinutes(a.appointmentTime) - appointmentTimeMinutes(b.appointmentTime);
        if (byTime !== 0) return byTime;
        const byStatus = a.status.localeCompare(b.status);
        if (byStatus !== 0) return byStatus;
        return a.patientName.localeCompare(b.patientName);
      });
  }, [dayList, listStatus, listSearch, patientById]);

  const dayLabel = listDate === today
    ? 'Today'
    : new Date(listDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const handleDownloadCsv = useCallback(() => {
    const header = ['Patient name', 'Identifier', 'Location', 'Service type', 'Appointment time', 'Visit start time', 'Status'];
    const rows = tableRows.map(a => [
      a.patientName,
      patientById.get(a.patientId)?.hospitalNumber || '',
      a.department,
      appointmentTypes.find(ti => ti.value === a.appointmentType)?.label || a.appointmentType,
      `${a.appointmentDate} ${a.appointmentTime}`,
      a.checkedInAt ? new Date(a.checkedInAt).toLocaleString('en-US') : '',
      t(statusLabelKey[a.status]),
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointments-${listDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [tableRows, patientById, listDate, t, statusLabelKey]);

  /**
   * The appointment's detail and its actions, rendered wherever they are
   * needed. In the list this unfolds under the row it belongs to — the same
   * treatment the work-queue dashboards use, so the list stays on screen while
   * one appointment is read. The calendar still shows it in a dialog: a
   * calendar cell has no row to unfold beneath.
   *
   * `onDone` closes whichever container it is in, so an action that navigates
   * away or opens another dialog doesn't leave this hanging open behind it.
   */
  const renderAppointmentDetail = (apt: typeof appointments[0], onDone: () => void) => (
    <>
      <div className="ehr-row-detail__body">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, gridColumn: '1 / -1', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 10px', borderRadius: 999, color: statusConfig[apt.status].color, background: statusConfig[apt.status].bg }}>
            {t(statusLabelKey[apt.status])}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 10px', borderRadius: 999, color: priorityConfig[apt.priority].color, background: `${priorityConfig[apt.priority].color}14` }}>
            {t(priorityLabelKey[apt.priority])}
          </span>
          <InsuranceBadge insured={insuredIds.has(apt.patientId)} pill />
        </div>
        <div className="appointment-detail-row"><dt>Date</dt><dd>{new Date(apt.appointmentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</dd></div>
        <div className="appointment-detail-row"><dt>Time</dt><dd>{formatClockTime(apt.appointmentTime)} · {apt.duration}m</dd></div>
        <div className="appointment-detail-row"><dt>Type</dt><dd>{appointmentTypes.find(x => x.value === apt.appointmentType)?.label || apt.appointmentType}</dd></div>
        <div className="appointment-detail-row"><dt>Provider</dt><dd>{apt.providerName || 'Unassigned'}</dd></div>
        <div className="appointment-detail-row"><dt>Department</dt><dd>{apt.department || '—'}</dd></div>
        {apt.reason && <div className="appointment-detail-row"><dt>Reason</dt><dd>{apt.reason}</dd></div>}
      </div>

      <div className="ehr-row-detail__actions">
        {/* The whole ladder, same control the front desk uses. The buttons
            beside it are shortcuts for the steps taken constantly; this is how
            any other rung — reminded, arrived, rescheduled — gets set. */}
        {(canConfirmAppointments || canCheckInAppointments || canAdvanceAppointments) && (
          <AppointmentStatusSelect
            status={apt.status}
            layout="bare"
            allowedStatuses={statusPickerOptions}
            onChange={status => { onDone(); handleStatusChange(apt._id, status); }}
          />
        )}
        {canDoTelehealth && apt.appointmentType === 'telehealth' && apt.status !== 'cancelled' && apt.status !== 'completed' && (
          <button onClick={() => { onDone(); router.push(`/telehealth/visit/${encodeURIComponent(apt._id)}`); }} className="btn btn-primary btn-sm" style={{ gap: 6, background: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
            <Video size={14} /> Join session
          </button>
        )}
        <button onClick={() => { onDone(); router.push(`/patients/${apt.patientId}`); }} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
          <User size={14} /> Open patient record
        </button>
        {canConfirmAppointments && (apt.status === 'requested' || apt.status === 'scheduled' || apt.status === 'reminder_sent') && (
          <button onClick={() => { onDone(); handleStatusChange(apt._id, 'confirmed'); }} className="btn btn-secondary btn-sm">{t('appointments.actionApprove')}</button>
        )}
        {canCheckInAppointments && (apt.status === 'requested' || APPOINTMENT_PENDING_STATUSES.includes(apt.status)) && (
          <button onClick={() => { onDone(); handleStatusChange(apt._id, 'checked_in'); }} className="btn btn-secondary btn-sm">{t('appointments.actionCheckIn')}</button>
        )}
        {canAdvanceAppointments && apt.status === 'checked_in' && (
          <button onClick={() => { onDone(); handleStatusChange(apt._id, 'in_progress'); }} className="btn btn-secondary btn-sm">{t('appointments.actionStart')}</button>
        )}
        {canAdvanceAppointments && (apt.status === 'checked_in' || apt.status === 'in_progress') && (
          <button onClick={() => { onDone(); handleStatusChange(apt._id, 'completed'); }} className="btn btn-secondary btn-sm">{t('appointments.actionComplete')}</button>
        )}
        {canManageAppointmentSchedule && (
          <button onClick={() => { loadEditForm(apt); setEditingApt(apt._id); onDone(); }} className="btn btn-secondary btn-sm">{t('action.edit')}</button>
        )}
        {canManageAppointmentSchedule && (
          <button onClick={() => { setRescheduleId(apt._id); setRescheduleDate(apt.appointmentDate); setRescheduleTime(apt.appointmentTime); onDone(); }} className="btn btn-secondary btn-sm">{t('appointments.actionReschedule')}</button>
        )}
        {(canManageAppointmentSchedule || canCheckInAppointments || canAdvanceAppointments)
          && !APPOINTMENT_CLOSED_STATUSES.includes(apt.status) && priorAppointmentStatus(apt.status) && (
          <button onClick={() => { onDone(); handleStatusChange(apt._id, priorAppointmentStatus(apt.status)!); }} className="btn btn-secondary btn-sm">{t('action.undo')}</button>
        )}
        {/* Reopen covers every closed status — completed, cancelled, no-show,
            and now rescheduled — none of which has a rung to step back to. */}
        {canManageAppointmentSchedule && APPOINTMENT_CLOSED_STATUSES.includes(apt.status) && (
          <button onClick={() => { onDone(); handleStatusChange(apt._id, 'scheduled'); }} className="btn btn-secondary btn-sm">{t('action.reopen')}</button>
        )}
        {canManageAppointmentSchedule && apt.status !== 'cancelled' && apt.status !== 'completed' && (
          <button onClick={() => { setCancelId(apt._id); onDone(); }} className="btn btn-secondary btn-sm" style={{ color: 'var(--color-danger)' }}>{t('appointments.actionCancel')}</button>
        )}
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PageInstructionCard />

        {/* ═══ LIST VIEW ═══ */}
        {viewMode === 'list' && (
          <>
            {/* Table card */}
            <div className="card-elevated overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
              <EhrListHeader
                title={`Appointments for: ${dayLabel}`}
                stats={[
                  { label: 'Appointments', value: dayStats.total, color: LIST_STAT_COLORS.muted },
                  { label: 'Checked in', value: dayStats.checkedIn, color: LIST_STAT_COLORS.blue },
                  { label: 'Not arrived', value: dayStats.notArrived, color: LIST_STAT_COLORS.amber },
                  { label: dayStats.topService ? (appointmentTypes.find(ti => ti.value === dayStats.topService!.type)?.label || dayStats.topService.type) : 'No appointments', value: dayStats.topService?.count ?? 0, color: LIST_STAT_COLORS.green },
                  { label: 'Providers', value: dayStats.providers, color: LIST_STAT_COLORS.bronze },
                ]}
                search={{ value: listSearch, onChange: setListSearch, placeholder: 'Filter table', ariaLabel: 'Filter table' }}
                actions={
                  <>
                    <input
                      type="date"
                      value={listDate}
                      onChange={e => setListDate(e.target.value || today)}
                      className="listpage-toolbar-date"
                      style={{ width: 150, flex: '0 0 auto' }}
                      aria-label={t('appointments.labelDate')}
                    />
                    <div className={`listpage-icon-select ${listStatus !== 'all' ? 'is-active' : ''}`} title="Filter appointments by status">
                      <Filter size={16} />
                      <select
                        value={listStatus}
                        onChange={e => setListStatus(e.target.value)}
                        aria-label="Filter appointments by status"
                      >
                        <option value="all">All statuses</option>
                        {(Object.keys(statusConfig) as AppointmentStatus[]).map(k => (
                          <option key={k} value={k}>{t(statusLabelKey[k])}</option>
                        ))}
                      </select>
                    </div>
                    {canExportAppointments && (
                      <button type="button" className="listpage-icon-btn" onClick={handleDownloadCsv} title="Download" aria-label="Download">
                        <Download size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="listpage-icon-btn"
                      onClick={() => setViewMode('calendar')}
                      title="Appointments calendar"
                      aria-label="Appointments calendar"
                    >
                      <Calendar size={16} />
                    </button>
                    {canBookAppointments && (
                      <button type="button" className="listpage-icon-btn listpage-icon-btn-primary" onClick={() => setShowNewForm(true)} title="Create new appointment" aria-label="Create new appointment">
                        <Plus size={16} />
                      </button>
                    )}
                  </>
                }
              />

              <div className="appointment-card-list appointments-list-surface">
                {tableRows.length === 0 ? (
                  <div className="appointment-card-empty">
                    No appointments for {dayLabel.toLowerCase()}.
                  </div>
                ) : (
                  <>
                    <div className="appointment-card-head" aria-hidden="true">
                      <span>Patient</span>
                      <span>Time</span>
                      <span>Care team</span>
                      <span>Department</span>
                      <span>Status</span>
                    </div>
                    {tableRows.map(apt => {
                  const svc = appointmentTypes.find(ti => ti.value === apt.appointmentType);
                  const patient = patientById.get(apt.patientId);
                  const patientMeta = patient
                    ? `${patientAgeLabel(patient)}${patient.gender ? ` · ${String(patient.gender).charAt(0).toUpperCase()}` : ''}`
                    : '';
                  const subtitle = [apt.reason, patientMeta].filter(Boolean).join(' · ');
                  const isExpanded = expandedId === apt._id;
                  const toggle = () => setExpandedId(current => (current === apt._id ? null : apt._id));
                  return (
                    <div key={apt._id} className={isExpanded ? 'ehr-appointment-group is-expanded' : 'ehr-appointment-group'}>
                    <div
                      className="ehr-appointment-row appointment-card-row"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={toggle}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggle();
                        }
                      }}
                    >
                      <div className="ehr-appointment-identity">
                        <div className="ehr-patient-icon" style={stateTint(apt.priority)}>
                          {initials(apt.patientName)}
                        </div>
                        <div className="ehr-appointment-main appointment-card-patient">
                          {apt.patientId ? (
                            <Link href={`/patients/${apt.patientId}`} onClick={e => e.stopPropagation()}>{apt.patientName}</Link>
                          ) : (
                            <button type="button" onClick={e => { e.stopPropagation(); toggle(); }}>{apt.patientName}</button>
                          )}
                          <p>{subtitle || svc?.label || apt.department || 'Appointment'}</p>
                        </div>
                      </div>

                      <div className="ehr-appointment-time">
                        <strong>{formatClockTime(apt.appointmentTime)}</strong>
                        <span>{apt.appointmentDate}</span>
                      </div>

                      <div className="appointment-card-provider">
                        <strong>{apt.providerName || patient?.assignedDoctorName || 'Doctor unassigned'}</strong>
                        <span>{patient?.assignedByName || 'Nurse unassigned'}</span>
                      </div>

                      <div className="ehr-appointment-department appointment-card-department">
                        <span className={`ehr-department-pill appointment-service-pill type-${apt.appointmentType}`}>
                          {apt.department || svc?.label || 'Service'}
                        </span>
                      </div>

                      <div className="appointment-card-status">
                        {/* The pill is the picker: reception moves a booking
                            along the ladder from the row it is reading, rather
                            than expanding it first. Roles without any
                            appointment-workflow permission get the plain pill. */}
                        {canChangeAppointmentStatus ? (
                          <span
                            className={`appointment-status-pill appointment-status-pill--select status-${statusSlug(apt.status)}`}
                            onClick={event => event.stopPropagation()}
                          >
                            {t(statusLabelKey[apt.status])}
                            <AppointmentStatusSelect
                              status={apt.status}
                              layout="bare"
                              allowedStatuses={statusPickerOptions}
                              onChange={status => handleStatusChange(apt._id, status)}
                            />
                          </span>
                        ) : (
                          <span className={`appointment-status-pill status-${statusSlug(apt.status)}`}>
                            {t(statusLabelKey[apt.status])}
                          </span>
                        )}
                        <small>{appointmentOperationalCue(apt)}</small>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ehr-row-detail" role="region" aria-label={`${apt.patientName} appointment details`}>
                        {renderAppointmentDetail(apt, () => setExpandedId(null))}
                      </div>
                    )}
                    </div>
                  );
                    })}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Calendar filters — status + search feed the react-big-calendar view */}
        {viewMode === 'calendar' && (
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder={t('appointments.searchPlaceholder')} />
            <FilterSelect
              aria-label={t('appointments.allStatus')}
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                ...(pendingApprovals.length > 0 ? [{ value: 'pending_approval', label: `${t('appointments.pendingApproval')} (${pendingApprovals.length})` }] : []),
                ...statusTabs.map(tab => ({ value: tab.key, label: `${tab.label} (${tab.count})` })),
              ]}
            />
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                <X size={12} /> {t('appointments.clearDate')}
              </button>
            )}
            <button
              type="button"
              className="listpage-icon-btn"
              onClick={() => setViewMode('list')}
              title="Appointments list"
              aria-label="Appointments list"
            >
              <ClipboardList size={16} />
            </button>
            {canBookAppointments && (
              <button type="button" className="listpage-icon-btn listpage-icon-btn-primary" onClick={() => setShowNewForm(true)} title="Create new appointment" aria-label="Create new appointment">
                <Plus size={16} />
              </button>
            )}
          </FilterBar>
        )}

        {/* ═══ Calendar (react-big-calendar) — the only appointments view ═══ */}
        {viewMode === 'calendar' && <div className="card-elevated" style={{ padding: 16, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', marginBottom: -8 }}>
          <div className="rbc-tamam" style={{ flex: 1, minHeight: 560 }}>
            <AppointmentsCalendar
              events={calendarEvents}
              calView={calView}
              calDate={calDate}
              today={today}
              statusConfig={statusConfig}
              onNavigate={(d) => setCalDate(d)}
              onView={(v) => setCalView(v)}
              onSelectEvent={(apt) => setEventApt(apt)}
              onSelectSlot={(slot) => {
                if (!canBookAppointments) return;
                const d = slot.start;
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                setFormDate(iso);
                if (calView !== 'month') {
                  setFormTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                }
                setShowNewForm(true);
              }}
            />
          </div>
        </div>}



        {/* ═══ Modals ═══ */}

        {/* Book Appointment */}
        {showNewForm && canBookAppointments && (
          <Modal onClose={() => { setShowNewForm(false); resetForm(); }} title={t('appointments.bookAppointment')} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>{t('appointments.labelPatient')}</label>
                <select value={formPatient} onChange={e => setFormPatient(e.target.value)}>
                  <option value="">{t('appointments.selectPatient')}</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.surname} {p.hospitalNumber ? `(${p.hospitalNumber})` : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'stretch', gap: 12 }}>
                <div><label>{t('appointments.labelDate')}</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} min={today} /></div>
                <div><label>{t('appointments.labelTime')}</label><select value={formTime} onChange={e => setFormTime(e.target.value)}>{timeSlots.map(ts => <option key={ts} value={ts}>{ts}</option>)}</select></div>
                <div><label>{t('appointments.labelDuration')}</label><select value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}>{[15, 20, 30, 45, 60, 90].map(d => <option key={d} value={d}>{t('appointments.durationMin', { count: d })}</option>)}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 12 }}>
                <div><label>{t('appointments.labelType')}</label><select value={formType} onChange={e => setFormType(e.target.value as AppointmentType)}>{appointmentTypes.filter(at => at.value !== 'walk_in').map(at => <option key={at.value} value={at.value}>{t(typeLabelKey[at.value])}</option>)}</select></div>
                <div><label>{t('appointments.labelPriority')}</label><select value={formPriority} onChange={e => setFormPriority(e.target.value as AppointmentPriority)}><option value="routine">{t('appointments.priorityRoutine')}</option><option value="urgent">{t('appointments.priorityUrgent')}</option><option value="emergency">{t('appointments.priorityEmergency')}</option></select></div>
                {/* Usually left at Scheduled, but the desk books patients already
                    standing at the window, and data entry back-fills visits that
                    have happened — both need to start on a different rung. */}
                <div><label>{t('appointments.labelStatus')}</label><AppointmentStatusSelect status={formStatus} layout="bare" onChange={setFormStatus} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 12 }}>
                <div><label>{t('appointments.labelDepartment')}</label><select value={formDepartment} onChange={e => setFormDepartment(e.target.value)}>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label>{t('appointments.labelProvider')}</label><input value={formProvider} onChange={e => setFormProvider(e.target.value)} placeholder={t('appointments.providerPlaceholder')} /></div>
              </div>
              <div><label>{t('appointments.labelReason')}</label><textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} placeholder={t('appointments.reasonPlaceholder')} /></div>
              <div><label>{t('appointments.labelNotes')}</label><textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder={t('appointments.notesPlaceholder')} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: 13 }}>
                <input type="checkbox" checked={formRecurring} onChange={e => setFormRecurring(e.target.checked)} /> {t('appointments.recurringAppointment')}
                {formRecurring && <select value={formRecurrencePattern} onChange={e => setFormRecurrencePattern(e.target.value as typeof formRecurrencePattern)} style={{ width: 'auto' }}>
                  <option value="weekly">{t('appointments.recurrenceWeekly')}</option><option value="biweekly">{t('appointments.recurrenceBiweekly')}</option><option value="monthly">{t('appointments.recurrenceMonthly')}</option><option value="quarterly">{t('appointments.recurrenceQuarterly')}</option>
                </select>}
              </label>
              <ModalActions onCancel={() => { setShowNewForm(false); resetForm(); }} onConfirm={handleSubmit} confirmLabel={submitting ? t('appointments.booking') : t('appointments.bookAppointment')} cancelLabel={t('action.cancel')} disabled={submitting} />
            </div>
          </Modal>
        )}

        {/* Walk-In */}
        {showWalkIn && canBookAppointments && (
          <Modal onClose={() => setShowWalkIn(false)} title={t('appointments.registerWalkIn')} icon={<UserPlus size={34} style={{ color: 'var(--accent-primary)' }} />}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {t('appointments.walkInIntro')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>{t('appointments.labelPatient')}</label>
                <select value={wiPatient} onChange={e => setWiPatient(e.target.value)}>
                  <option value="">{t('appointments.selectPatient')}</option>
                  {patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.surname}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 12 }}>
                <div><label>{t('appointments.labelDepartment')}</label><select value={wiDepartment} onChange={e => setWiDepartment(e.target.value)}>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label>{t('appointments.labelPriority')}</label><select value={wiPriority} onChange={e => setWiPriority(e.target.value as AppointmentPriority)}><option value="routine">{t('appointments.priorityRoutine')}</option><option value="urgent">{t('appointments.priorityUrgent')}</option><option value="emergency">{t('appointments.priorityEmergency')}</option></select></div>
              </div>
              <div><label>{t('appointments.labelReasonForVisit')}</label><textarea value={wiReason} onChange={e => setWiReason(e.target.value)} rows={2} placeholder={t('appointments.reasonForVisitPlaceholder')} /></div>
              <div><label>{t('appointments.labelNotes')}</label><textarea value={wiNotes} onChange={e => setWiNotes(e.target.value)} rows={2} placeholder={t('appointments.walkInNotesPlaceholder')} /></div>
              <ModalActions onCancel={() => setShowWalkIn(false)} onConfirm={handleWalkIn} confirmLabel={submitting ? t('appointments.registering') : t('appointments.registerWalkIn')} cancelLabel={t('action.cancel')} confirmColor="var(--accent-primary)" disabled={submitting} />
            </div>
          </Modal>
        )}

        {/* Provider availability ("Schedule") — opened from the action bar */}
        {showAvailability && <AvailabilityModal onClose={() => setShowAvailability(false)} />}

        {/* Appointment detail — opens when an event on the calendar is clicked.
            Sorted list enables prev/next navigation without closing the modal. */}
        {eventApt && (() => {
          const sorted = [...appointments].sort((a, b) =>
            `${a.appointmentDate}${a.appointmentTime}`.localeCompare(`${b.appointmentDate}${b.appointmentTime}`)
          );
          const idx = sorted.findIndex(a => a._id === eventApt._id);
          const hasPrev = idx > 0;
          const hasNext = idx < sorted.length - 1;
          return (
            <Modal
              onClose={() => setEventApt(null)}
              title={eventApt.patientName}
              size="md"
              nav={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>
                    {idx + 1} / {sorted.length}
                  </span>
                  <button
                    onClick={() => setEventApt(sorted[idx - 1])}
                    disabled={!hasPrev}
                    aria-label="Previous appointment"
                    style={{
                      width: 30, height: 30, borderRadius: 8, border: '1px solid var(--glass-border)',
                      background: hasPrev ? 'var(--bg-card-solid)' : 'transparent',
                      color: hasPrev ? 'var(--text-secondary)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: hasPrev ? 'pointer' : 'default', opacity: hasPrev ? 1 : 0.35,
                    }}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setEventApt(sorted[idx + 1])}
                    disabled={!hasNext}
                    aria-label="Next appointment"
                    style={{
                      width: 30, height: 30, borderRadius: 8, border: '1px solid var(--glass-border)',
                      background: hasNext ? 'var(--bg-card-solid)' : 'transparent',
                      color: hasNext ? 'var(--text-secondary)' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: hasNext ? 'pointer' : 'default', opacity: hasNext ? 1 : 0.35,
                    }}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              }
            >
              {/* Same detail and actions the list unfolds inline; a calendar
                  cell has no row to unfold beneath, so here it stays a dialog. */}
              <div className="ehr-row-detail ehr-row-detail--dialog">
                {renderAppointmentDetail(eventApt, () => setEventApt(null))}
              </div>
            </Modal>
          );
        })()}

        {/* Reschedule */}
        {rescheduleId && canManageAppointmentSchedule && (
          <Modal onClose={() => setRescheduleId(null)} title={t('appointments.rescheduleTitle')} size="sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>{t('appointments.labelNewDate')}</label><input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} min={today} /></div>
              <div><label>{t('appointments.labelNewTime')}</label><select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}>{timeSlots.map(ts => <option key={ts} value={ts}>{ts}</option>)}</select></div>
              <ModalActions onCancel={() => setRescheduleId(null)} onConfirm={handleReschedule} confirmLabel={t('appointments.actionReschedule')} cancelLabel={t('action.cancel')} />
            </div>
          </Modal>
        )}

        {/* Cancel */}
        {cancelId && canManageAppointmentSchedule && (
          <Modal onClose={() => { setCancelId(null); setCancelReason(''); }} title={t('appointments.cancelTitle')} titleColor="#EF4444" icon={<AlertTriangle size={34} style={{ color: 'var(--color-danger)' }} />} size="sm">
            <div><label>{t('appointments.labelCancelReason')}</label><textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder={t('appointments.cancelReasonPlaceholder')} /></div>
            <ModalActions onCancel={() => { setCancelId(null); setCancelReason(''); }} onConfirm={handleCancel} confirmLabel={t('appointments.cancelTitle')} confirmColor="#EF4444" cancelLabel={t('appointments.goBack')} />
          </Modal>
        )}

        {/* Day Popup — appears when clicking a date on the calendar */}
        {showDayPopup && selectedDate && (
          <Modal onClose={() => { setShowDayPopup(false); }} title={new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} size="lg">
            {/* Quick actions */}
            {canBookAppointments && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" style={{ gap: 4 }} onClick={() => { setShowDayPopup(false); setFormDate(selectedDate); setShowNewForm(true); }}>
                  <Plus size={14} /> {t('appointments.newAppointment')}
                </button>
                <button className="btn btn-secondary btn-sm" style={{ gap: 4, color: 'var(--accent-primary)', borderColor: 'var(--accent-border)' }} onClick={() => { setShowDayPopup(false); setShowWalkIn(true); }}>
                  <UserPlus size={14} /> {t('appointments.walkIn')}
                </button>
                {/* Telehealth lives on this calendar now — "New Session" books a
                    telehealth appointment via the same form, pre-typed. */}
                <button className="btn btn-secondary btn-sm" style={{ gap: 4, color: 'var(--accent-primary)', borderColor: 'var(--accent-border)' }} onClick={() => { setShowDayPopup(false); setFormDate(selectedDate); setFormType('telehealth'); setShowNewForm(true); }}>
                  <Video size={14} /> New Session
                </button>
              </div>
            )}

            {/* Day's appointments */}
            {(() => {
              const dayApts = appointments.filter(a => a.appointmentDate === selectedDate).sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
              if (dayApts.length === 0) return (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Calendar size={44} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ fontSize: 13 }}>{t('appointments.noneOnDate')}</p>
                </div>
              );
              return (
                <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('appointments.appointmentsCount', { count: dayApts.length })}</p>
                  {dayApts.map(apt => {
                    const sc = statusConfig[apt.status];
                    const pc = priorityConfig[apt.priority];
                    const typeInfo = appointmentTypes.find(t => t.value === apt.appointmentType);
                    const isWI = apt.appointmentType === 'walk_in';
                    return (
                      <div key={apt._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--card-radius)', border: '1px solid var(--border-medium)', background: 'var(--overlay-subtle)' }}>
                        <div style={{ minWidth: 44, textAlign: 'center' }}>
                          <div className="stat-value" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatClockTime(apt.appointmentTime)}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{apt.duration}m</div>
                        </div>
                        <div className="icon-box-sm" style={{ flexShrink: 0 }}>
                          {typeInfo ? <typeInfo.icon size={14} style={{ color: typeInfo.color }} /> : <Calendar size={14} style={{ color: '#6366F1' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {apt.patientId ? (
                              <Link
                                href={`/patients/${apt.patientId}`}
                                onClick={(e) => { e.stopPropagation(); setShowDayPopup(false); }}
                                style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                className="hover:underline"
                                title={t('appointments.viewPatientRecord')}
                              >
                                <PatientName name={apt.patientName} nameClassName="text-[13px] font-normal" />
                                <ExternalLink size={10} style={{ opacity: 0.55 }} />
                              </Link>
                            ) : (
                              <PatientName name={apt.patientName} nameClassName="text-[13px] font-normal" />
                            )}
                            {isWI && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(124,58,237,0.08)', color: 'var(--accent-primary)' }}>{t('appointments.walkInBadge')}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{apt.reason.slice(0, 40)}{apt.reason.length > 40 ? '...' : ''}</div>
                        </div>
                        <InsuranceBadge insured={insuredIds.has(apt.patientId)} compact />
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: pc.color, background: `${pc.color}12` }}>{t(priorityLabelKey[apt.priority])}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, color: sc.color, background: sc.bg }}>{t(statusLabelKey[apt.status])}</span>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {canConfirmAppointments && apt.status === 'scheduled' && (
                            <button onClick={() => { handleStatusChange(apt._id, 'confirmed'); }} title={t('appointments.actionApprove')} style={miniBtn('var(--accent-primary)')}>
                              <CheckCircle2 size={12} />
                            </button>
                          )}
                          {canCheckInAppointments && (apt.status === 'requested' || APPOINTMENT_PENDING_STATUSES.includes(apt.status)) && (
                            <button onClick={() => { handleStatusChange(apt._id, 'checked_in'); }} title={t('appointments.actionCheckIn')} style={miniBtn('var(--accent-primary)')}>
                              <UserPlus size={12} />
                            </button>
                          )}
                          {canManageAppointmentSchedule && (
                            <>
                              <button onClick={() => { setShowDayPopup(false); setEditingApt(apt._id); loadEditForm(apt); }} title={t('action.edit')} style={miniBtn('var(--accent-primary)')}>
                                <ClipboardList size={12} />
                              </button>
                              <button onClick={() => { setShowDayPopup(false); setRescheduleId(apt._id); setRescheduleDate(apt.appointmentDate); setRescheduleTime(apt.appointmentTime); }} title={t('appointments.actionReschedule')} style={miniBtn('var(--color-warning)')}>
                                <RefreshCw size={12} />
                              </button>
                              {(apt.status !== 'completed' && apt.status !== 'cancelled') && (
                                <button onClick={() => { setShowDayPopup(false); setCancelId(apt._id); }} title={t('appointments.actionCancel')} style={miniBtn('var(--color-danger)')}>
                                  <X size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Modal>
        )}

        {/* Edit Appointment */}
        {editingApt && canManageAppointmentSchedule && (() => {
          const apt = appointments.find(a => a._id === editingApt);
          if (!apt) return null;
          return (
            <Modal onClose={() => setEditingApt(null)} title={t('appointments.editTitle')} size="lg">
              <div className="appt-edit-grid">
                {/* Three columns, as the design has them: who and when on the
                    left, who is on the visit in the middle, what it costs on the
                    right. Each column is a stack of titled sections. */}
                <div className="appt-edit-col">

                  <div><label>{t('appointments.labelType')}</label><select value={formType} onChange={e => setFormType(e.target.value as AppointmentType)}>{appointmentTypes.filter(at => at.value !== 'walk_in').map(at => <option key={at.value} value={at.value}>{t(typeLabelKey[at.value])}</option>)}</select></div>

                  <h4 className="appt-edit-section">Appointment mode &amp; location</h4>
                  <AppointmentDetailFields
                    section="mode"
                    patient={patientById.get(apt.patientId)}
                    appointment={apt}
                    appointments={appointments}
                    providerId={apt.providerId}
                    providerName={formProvider || apt.providerName}
                    date={formDate}
                    time={formTime}
                    duration={formDuration}
                    values={formDetail}
                    onChange={patch => setFormDetail(current => ({ ...current, ...patch }))}
                  />

                  <h4 className="appt-edit-section">Date &amp; time</h4>
                  <div className="appt-edit-row">
                    <div><label>{t('frontDesk.date')}</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} min={today} /></div>
                    <div><label>{t('frontDesk.colTime')}</label><select value={formTime} onChange={e => setFormTime(e.target.value)}>{timeSlots.map(ts => <option key={ts} value={ts}>{ts}</option>)}</select></div>
                    <div><label>{t('appointments.labelDuration')}</label><select value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}>{[15, 20, 30, 45, 60, 90].map(d => <option key={d} value={d}>{t('appointments.durationMin', { count: d })}</option>)}</select></div>
                  </div>
                  <div><label>{t('appointments.labelNotes')}</label><textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} /></div>
                </div>

                <div className="appt-edit-col">
                  <h4 className="appt-edit-section">Provider &amp; staff</h4>
                  <div><label>{t('appointments.labelProvider')}</label><input value={formProvider} onChange={e => setFormProvider(e.target.value)} placeholder={t('appointments.providerPlaceholder')} /></div>
                  <AppointmentDetailFields
                    section="provider"
                    patient={patientById.get(apt.patientId)}
                    appointment={apt}
                    appointments={appointments}
                    providerId={apt.providerId}
                    providerName={formProvider || apt.providerName}
                    date={formDate}
                    time={formTime}
                    duration={formDuration}
                    values={formDetail}
                    onChange={patch => setFormDetail(current => ({ ...current, ...patch }))}
                  />
                  <h4 className="appt-edit-section">Visit detail</h4>
                  <div><label>{t('appointments.labelDepartment')}</label><select value={formDepartment} onChange={e => setFormDepartment(e.target.value)}>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  <div><label>{t('appointments.detailReason')}</label><textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
                </div>

                <div className="appt-edit-col">
                  <h4 className="appt-edit-section">Status &amp; priority</h4>
                  <div><label>{t('appointments.labelStatus')}</label><AppointmentStatusSelect status={formStatus} layout="bare" onChange={setFormStatus} /></div>
                  <div><label>{t('appointments.labelPriority')}</label><select value={formPriority} onChange={e => setFormPriority(e.target.value as AppointmentPriority)}><option value="routine">{t('appointments.priorityRoutine')}</option><option value="urgent">{t('appointments.priorityUrgent')}</option><option value="emergency">{t('appointments.priorityEmergency')}</option></select></div>
                  <AppointmentDetailFields
                    section="billing"
                    patient={patientById.get(apt.patientId)}
                    appointment={apt}
                    appointments={appointments}
                    providerId={apt.providerId}
                    providerName={formProvider || apt.providerName}
                    date={formDate}
                    time={formTime}
                    duration={formDuration}
                    values={formDetail}
                    onChange={patch => setFormDetail(current => ({ ...current, ...patch }))}
                  />
                </div>
              </div>
              <div>
                <ModalActions
                  onCancel={() => setEditingApt(null)}
                  onConfirm={async () => {
                    try {
                      await update(apt._id, {
                        appointmentDate: formDate, appointmentTime: formTime, duration: formDuration,
                        appointmentType: formType, priority: formPriority, department: formDepartment,
                        providerName: formProvider, reason: formReason, notes: formNotes,
                        appointmentMode: formDetail.mode,
                        staffId: formDetail.staffId || undefined,
                        staffName: formDetail.staffName || undefined,
                        room: formDetail.room || undefined,
                        isRecurring: Boolean(formDetail.recurrence),
                        recurrencePattern: formDetail.recurrence || undefined,
                      });
                      // Status goes through updateStatus, not the field write
                      // above: that path stamps confirmedAt/checkedInAt, appends
                      // the status history, and enforces who may confirm. A raw
                      // field write would skip all three.
                      if (formStatus !== apt.status) await handleStatusChange(apt._id, formStatus);
                      showToast(t('appointments.toastUpdated'), 'success'); setEditingApt(null);
                    } catch { showToast(t('appointments.toastFailedUpdate'), 'error'); }
                  }}
                  confirmLabel={t('appointments.saveChanges')}
                  cancelLabel={t('action.cancel')}
                />
              </div>
            </Modal>
          );
        })()}
      </main>
    </div>
  );
}

/* ─── Reusable Components ─── */

function Modal({ children, onClose, title, titleColor, icon, size = 'md', nav, variant = 'dialog' }: {
  children: React.ReactNode; onClose: () => void; title: string; titleColor?: string;
  icon?: React.ReactNode; size?: 'sm' | 'md' | 'lg'; nav?: React.ReactNode; variant?: 'dialog' | 'drawer';
}) {
  const sizeClass = size === 'sm' ? 'modal-panel--sm' : size === 'lg' ? 'modal-panel--lg' : 'modal-panel--md';
  const width = size === 'sm' ? 400 : size === 'lg' ? 720 : 560;
  return (
    <PortalModal onClose={onClose} width={width} variant={variant}>
      <div className={`modal-panel ${sizeClass}`} style={{ maxHeight: variant === 'drawer' ? '100vh' : 'calc(100vh - 32px)', height: variant === 'drawer' ? '100%' : undefined, overflowY: 'auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {icon}
            <h2 className="truncate" style={{ fontSize: 18, fontWeight: 700, color: titleColor || 'var(--text-primary)' }}>{title}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {nav}
            <button onClick={onClose} aria-label="Close" style={{
              background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer',
              width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', transition: 'background 0.15s',
            }}><X size={16} /></button>
          </div>
        </div>
        {children}
      </div>
    </PortalModal>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, confirmColor, cancelLabel, disabled }: {
  onCancel: () => void; onConfirm: () => void; confirmLabel: string;
  confirmColor?: string; cancelLabel?: string; disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
      <button onClick={onCancel} className="btn btn-secondary" style={{ flex: 1 }}>{cancelLabel || 'Cancel'}</button>
      <button onClick={onConfirm} disabled={disabled} className="btn btn-primary" style={{
        flex: 1, background: confirmColor || undefined,
        opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
      }}>{confirmLabel}</button>
    </div>
  );
}

function InsuranceBadge({ insured, compact, pill }: { insured: boolean; compact?: boolean; pill?: boolean }) {
  const color = insured ? '#047857' : '#64748B';
  return (
    <span style={{
      fontSize: compact ? 9 : 11, fontWeight: 700, whiteSpace: 'nowrap',
      padding: pill ? '3px 10px' : compact ? '2px 6px' : '2px 8px',
      borderRadius: pill ? 999 : compact ? 4 : 6,
      textTransform: pill ? 'uppercase' : undefined, letterSpacing: pill ? '0.04em' : undefined,
      color, background: insured ? 'rgba(4,120,87,0.10)' : 'rgba(100,116,139,0.10)',
    }}>
      {insured ? 'Insured' : 'Not insured'}
    </span>
  );
}

/* ─── Styles ─── */
function miniBtn(color: string): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 'var(--card-radius)', border: `1px solid ${color}25`,
    background: `${color}08`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, padding: 0,
  };
}
