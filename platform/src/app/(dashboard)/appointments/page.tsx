'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import AvailabilityModal from '@/components/AvailabilityModal';
import {
  Calendar, Plus, Clock, CheckCircle2, User,
  AlertTriangle, RefreshCw,
  Video, Stethoscope, Syringe, HeartPulse, FlaskConical,
  Building2, X, UserPlus, ClipboardList,
  Filter, ExternalLink, ChevronLeft, ChevronRight,
} from '@/components/icons/lucide';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { usePatients } from '@/lib/hooks/usePatients';
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
  { value: 'specialist',   label: 'Specialist',           icon: User,          color: '#0369A1', bg: 'rgba(3,105,161,0.10)' },
  { value: 'anc',          label: 'Antenatal Care',       icon: HeartPulse,    color: '#047857', bg: 'rgba(4,120,87,0.10)' },
  { value: 'immunization', label: 'Immunization',         icon: Syringe,       color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  { value: 'lab',          label: 'Laboratory',           icon: FlaskConical,  color: '#0891B2', bg: 'rgba(8,145,178,0.10)' },
  { value: 'telehealth',   label: 'Telehealth',           icon: Video,         color: '#0E7490', bg: 'rgba(14,116,144,0.10)' },
  { value: 'surgical',     label: 'Surgical',             icon: Stethoscope,   color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
  { value: 'dental',       label: 'Dental',               icon: Stethoscope,   color: '#1D4ED8', bg: 'rgba(29,78,216,0.10)' },
  { value: 'mental_health',label: 'Mental Health',        icon: HeartPulse,    color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  { value: 'walk_in',      label: 'Walk-In',              icon: UserPlus,      color: '#2191D0', bg: 'rgba(33,145,208,0.10)' },
];

// Fallback list when the facility hasn't set its departments in Facility Settings.
const FALLBACK_DEPARTMENTS = [
  'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'Surgery',
  'Emergency', 'Cardiology', 'Orthopedics', 'Ophthalmology', 'Neurology',
  'Dermatology', 'ENT', 'Outpatient', 'Dental', 'Mental Health', 'Maternity',
];

const statusConfig: Record<AppointmentStatus, { color: string; bg: string; label: string }> = {
  requested:   { color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', label: 'Requested' },
  scheduled:   { color: '#2191D0', bg: 'rgba(33,145,208,0.10)',  label: 'Scheduled' },
  confirmed:   { color: '#015697', bg: 'rgba(1,86,151,0.10)',    label: 'Confirmed' },
  checked_in:  { color: '#D97706', bg: 'rgba(217,119,6,0.10)',   label: 'Checked In' },
  in_progress: { color: '#059669', bg: 'rgba(5,150,105,0.10)',   label: 'In Progress' },
  completed:   { color: '#047857', bg: 'rgba(4,120,87,0.10)',    label: 'Completed' },
  cancelled:   { color: '#DC2626', bg: 'rgba(220,38,38,0.10)',   label: 'Cancelled' },
  no_show:     { color: '#64748B', bg: 'rgba(100,116,139,0.10)', label: 'No Show' },
};

const priorityConfig: Record<AppointmentPriority, { color: string; label: string }> = {
  routine: { color: 'var(--color-success)', label: 'Routine' },
  urgent: { color: 'var(--color-warning)', label: 'Urgent' },
  emergency: { color: 'var(--color-danger)', label: 'Emergency' },
};

const timeSlots = Array.from({ length: 24 }, (_, h) =>
  ['00', '30'].map(m => `${h.toString().padStart(2, '0')}:${m}`)
).flat().filter(t => { const h = parseInt(t.split(':')[0]); return h >= 7 && h <= 18; });

/* ─── Page ─── */
export default function AppointmentsPage() {
  const { appointments, create, updateStatus, reschedule, update } = useAppointments();
  const { patients } = usePatients();
  const { currentUser, globalSearch } = useApp();
  const { canBookAppointments } = usePermissions();
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
  const statusLabelKey: Record<AppointmentStatus, string> = {
    requested: 'appointments.statusRequested',
    scheduled: 'appointments.statusScheduled', confirmed: 'appointments.statusConfirmed',
    checked_in: 'appointments.statusCheckedIn', in_progress: 'appointments.statusInProgress',
    completed: 'appointments.statusCompleted', cancelled: 'appointments.statusCancelled',
    no_show: 'appointments.statusNoShow',
  };
  const priorityLabelKey: Record<AppointmentPriority, string> = {
    routine: 'appointments.priorityRoutine', urgent: 'appointments.priorityUrgent',
    emergency: 'appointments.priorityEmergency',
  };

  const router = useRouter();
  const [calView, setCalView] = useState<'month' | 'week' | 'day'>('month');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [listSearch, setListSearch] = useState('');
  const [listStatus, setListStatus] = useState('all');
  const [listSort, setListSort] = useState<'date_asc' | 'date_desc' | 'name' | 'priority'>('date_asc');
  // Appointment opened in the click-to-view detail popup.
  const [eventApt, setEventApt] = useState<typeof appointments[0] | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  // Providers publish their own bookable windows ("Schedule"). This used to be a
  // sidebar tab; it now lives on the appointments page where it belongs.
  const canSetAvailability = ['doctor', 'clinical_officer', 'clinician', 'medical_superintendent', 'nurse', 'midwife'].includes(currentUser?.role ?? '');
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [editingApt, setEditingApt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Deep link: TopBar "+ → Schedule appointment" routes here with ?new=1 to
  // open the booking form straight away. Read on the client to avoid needing a
  // Suspense boundary around useSearchParams, then strip the param.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setShowNewForm(true);
      params.delete('new');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

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
  };

  const loadEditForm = (apt: typeof appointments[0]) => {
    setFormDate(apt.appointmentDate); setFormTime(apt.appointmentTime); setFormDuration(apt.duration);
    setFormType(apt.appointmentType); setFormPriority(apt.priority); setFormDepartment(apt.department);
    setFormProvider(apt.providerName); setFormReason(apt.reason); setFormNotes(apt.notes || '');
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
        patientPhone: patient.phone || undefined, providerId: currentUser?._id || '',
        providerName: formProvider || currentUser?.name || '', facilityId: currentUser?.hospitalId || '',
        facilityName: currentUser?.hospitalName || '', facilityLevel: 'payam' as FacilityLevel,
        appointmentDate: formDate, appointmentTime: formTime, duration: formDuration,
        appointmentType: formType, priority: formPriority, department: formDepartment,
        reason: formReason, notes: formNotes || undefined, status: 'scheduled',
        reminderSent: false, isRecurring: formRecurring,
        recurrencePattern: formRecurring ? formRecurrencePattern : undefined,
        bookedBy: currentUser?._id || '', bookedByName: currentUser?.name || '', state: '',
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
        patientPhone: patient.phone || undefined, providerId: currentUser?._id || '',
        providerName: currentUser?.name || '', facilityId: currentUser?.hospitalId || '',
        facilityName: currentUser?.hospitalName || '', facilityLevel: 'payam' as FacilityLevel,
        appointmentDate: today, appointmentTime: jubaTime(),
        duration: 30, appointmentType: 'walk_in', priority: wiPriority,
        department: wiDepartment, reason: wiReason, notes: wiNotes || undefined,
        status: 'checked_in', reminderSent: false, isRecurring: false,
        bookedBy: currentUser?._id || '', bookedByName: currentUser?.name || '', state: '',
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

  // Map a status to the step it can be reversed back to. Reversing reuses the
  // same updateAppointmentStatus path (which accepts any target status), so an
  // accidental confirm / check-in / start can be undone, and a cancelled,
  // completed, or no-show appointment can be reopened to 'scheduled'.
  const PRIOR_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
    confirmed: 'scheduled',
    checked_in: 'confirmed',
    in_progress: 'checked_in',
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    try { await reschedule(rescheduleId, rescheduleDate, rescheduleTime); showToast(t('appointments.toastRescheduled'), 'success'); setRescheduleId(null); }
    catch { showToast(t('appointments.toastFailedReschedule'), 'error'); }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try { await updateStatus(cancelId, 'cancelled', { cancelledReason: cancelReason, cancelledBy: currentUser?.name }); showToast(t('appointments.toastCancelled'), 'success'); setCancelId(null); setCancelReason(''); }
    catch { showToast(t('appointments.toastFailedCancel'), 'error'); }
  };

  // List view — filtered + sorted appointments
  const listAppointments = useMemo(() => {
    const q = listSearch.toLowerCase();
    let result = appointments.filter(a => {
      const matchSearch = !q || a.patientName.toLowerCase().includes(q) || a.reason.toLowerCase().includes(q);
      const matchStatus = listStatus === 'all' || a.status === listStatus;
      return matchSearch && matchStatus;
    });
    if (listSort === 'date_asc') result = result.sort((a, b) => `${a.appointmentDate}${a.appointmentTime}`.localeCompare(`${b.appointmentDate}${b.appointmentTime}`));
    else if (listSort === 'date_desc') result = result.sort((a, b) => `${b.appointmentDate}${b.appointmentTime}`.localeCompare(`${a.appointmentDate}${a.appointmentTime}`));
    else if (listSort === 'name') result = result.sort((a, b) => a.patientName.localeCompare(b.patientName));
    else if (listSort === 'priority') {
      const order: Record<string, number> = { emergency: 0, urgent: 1, routine: 2 };
      result = result.sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2));
    }
    return result;
  }, [appointments, listSearch, listStatus, listSort]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <TopBar
          searchTrailing={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Calendar / List view toggle */}
              <div style={{ display: 'flex', borderRadius: 10, border: '1px solid var(--border-medium)', overflow: 'hidden', height: 36 }}>
                <button
                  onClick={() => setViewMode('calendar')}
                  style={{ padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: viewMode === 'calendar' ? 'var(--accent-primary)' : 'var(--bg-card-solid)', color: viewMode === 'calendar' ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Calendar size={13} /> Calendar
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{ padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', borderLeft: '1px solid var(--border-medium)', background: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--bg-card-solid)', color: viewMode === 'list' ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Filter size={13} /> List
                </button>
              </div>
              {/* Calendar granularity — only when in calendar mode */}
              {viewMode === 'calendar' && (
                <select
                  value={calView}
                  onChange={(e) => setCalView(e.target.value as 'month' | 'week' | 'day')}
                  aria-label={t('appointments.viewCalendar')}
                  className="text-[13px] font-medium cursor-pointer"
                  style={{ height: 36, padding: '0 10px', borderRadius: 'var(--input-radius)', border: '1px solid var(--border-medium)', background: 'var(--bg-card-solid)', color: 'var(--text-secondary)' }}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              )}
              {viewMode === 'calendar' && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`btn btn-secondary btn-filter${(selectedDate || filterStatus !== 'all') ? ' is-active' : ''}`}
                  aria-pressed={showFilters}
                  style={{ gap: 6 }}
                >
                  <Filter size={14} /> {t('appointments.filters')}
                </button>
              )}
            </div>
          }
          actions={
            (canSetAvailability || canBookAppointments) ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canSetAvailability && (
                  <button onClick={() => setShowAvailability(true)} className="btn btn-secondary" style={{ gap: 6 }}>
                    <Clock size={16} /> {t('appointments.schedule')}
                  </button>
                )}
                {canBookAppointments && (
                  <>
                    <button onClick={() => setShowWalkIn(true)} className="btn btn-secondary" style={{ gap: 6, color: 'var(--accent-primary)', borderColor: 'var(--accent-border)' }}>
                      <UserPlus size={16} /> {t('appointments.walkIn')}
                    </button>
                    <button onClick={() => setShowNewForm(true)} className="btn btn-primary" style={{ gap: 6 }}>
                      <Plus size={16} /> {t('appointments.bookAppointment')}
                    </button>
                  </>
                )}
              </div>
            ) : undefined
          } />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* View toggle + Filters live beside the search bar above (TopBar
            searchTrailing); the list/calendar body renders directly here. */}

        {/* Filters bar */}
        {showFilters && (
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
          </FilterBar>
        )}

        {/* ═══ LIST VIEW ═══ */}
        {viewMode === 'list' && (
          <div className="card-elevated overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
            {/* Toolbar — matches "Patients assigned to you" design */}
            <div className="flex items-center gap-3 px-4 py-3 flex-wrap flex-shrink-0" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <input
                type="search"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Search by name or reason…"
                className="flex-1 min-w-[200px]"
                style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 18px', fontSize: 13 }}
              />
              <select
                value={listStatus}
                onChange={e => setListStatus(e.target.value)}
                className="w-full sm:w-44"
                style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 16px', fontSize: 13 }}
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <select
                value={listSort}
                onChange={e => setListSort(e.target.value as typeof listSort)}
                className="w-full sm:w-44"
                style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 16px', fontSize: 13 }}
                aria-label="Sort"
              >
                <option value="date_asc">Date (earliest first)</option>
                <option value="date_desc">Date (latest first)</option>
                <option value="name">Name (A–Z)</option>
                <option value="priority">Priority (urgent first)</option>
              </select>
            </div>

            {/* Table */}
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
              <table className="data-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    {['Patient', 'Reason', 'Date & Time', 'Type', 'Priority', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listAppointments.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)', fontSize: 13 }}>No appointments match your search.</td></tr>
                  ) : listAppointments.map(apt => {
                    const sc = statusConfig[apt.status];
                    const pc = priorityConfig[apt.priority];
                    const typeInfo = appointmentTypes.find(ti => ti.value === apt.appointmentType);
                    return (
                      <tr
                        key={apt._id}
                        className="cursor-pointer hover:bg-[var(--table-row-hover)]"
                        onClick={() => setEventApt(apt)}
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                      >
                        <td className="px-4 py-3">
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.patientName}</div>
                          {apt.providerName && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{apt.providerName}</div>}
                        </td>
                        <td className="px-4 py-3" style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 220 }}>
                          <div className="truncate">{apt.reason || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-platform-mono)' }}>{apt.appointmentDate}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{apt.appointmentTime} · {apt.duration}min</div>
                        </td>
                        <td className="px-4 py-3">
                          {typeInfo ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: typeInfo.color, background: typeInfo.bg, borderRadius: 6, padding: '2px 8px' }}>{typeInfo.label}</span>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, background: `${pc.color}15`, borderRadius: 6, padding: '2px 8px' }}>{t(priorityLabelKey[apt.priority])}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 6, padding: '2px 8px' }}>{t(statusLabelKey[apt.status])}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            {apt.status === 'scheduled' && (
                              <button onClick={() => handleStatusChange(apt._id, 'confirmed')} className="btn btn-sm btn-secondary" style={{ fontSize: 11 }}>Confirm</button>
                            )}
                            {apt.status === 'confirmed' && (
                              <button onClick={() => handleStatusChange(apt._id, 'completed')} className="btn btn-sm btn-primary" style={{ fontSize: 11 }}>Complete</button>
                            )}
                            <button onClick={() => { setEditingApt(apt._id); loadEditForm(apt); }} className="btn btn-sm btn-secondary" style={{ fontSize: 11 }}>Edit</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
        {showNewForm && (
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
        {showWalkIn && (
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 10px', borderRadius: 999, color: statusConfig[eventApt.status].color, background: statusConfig[eventApt.status].bg }}>
                  {t(statusLabelKey[eventApt.status])}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 10px', borderRadius: 999, color: priorityConfig[eventApt.priority].color, background: `${priorityConfig[eventApt.priority].color}14` }}>
                  {t(priorityLabelKey[eventApt.priority])}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 18 }}>
                <Detail label="Date" value={new Date(eventApt.appointmentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} icon={<Calendar size={14} />} />
                <Detail label="Time" value={`${eventApt.appointmentTime} · ${eventApt.duration}m`} icon={<Clock size={14} />} />
                <Detail label="Type" value={appointmentTypes.find(x => x.value === eventApt.appointmentType)?.label || eventApt.appointmentType} icon={<ClipboardList size={14} />} />
                <Detail label="Provider" value={eventApt.providerName} icon={<Stethoscope size={14} />} />
                <Detail label="Department" value={eventApt.department} icon={<Building2 size={14} />} />
              </div>
              {eventApt.reason && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Reason</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{eventApt.reason}</div>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => { const id = eventApt.patientId; setEventApt(null); router.push(`/patients/${id}`); }} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
                  <User size={14} /> Open patient record
                </button>
                <button onClick={() => { loadEditForm(eventApt); setEditingApt(eventApt._id); setEventApt(null); }} className="btn btn-secondary btn-sm">{t('action.edit')}</button>
                <button onClick={() => { setRescheduleId(eventApt._id); setRescheduleDate(eventApt.appointmentDate); setRescheduleTime(eventApt.appointmentTime); setEventApt(null); }} className="btn btn-secondary btn-sm">{t('appointments.actionReschedule')}</button>
                {PRIOR_STATUS[eventApt.status] && (
                  <button onClick={() => { const id = eventApt._id; const to = PRIOR_STATUS[eventApt.status]!; setEventApt(null); handleStatusChange(id, to); }} className="btn btn-secondary btn-sm">{t('action.undo')}</button>
                )}
                {(eventApt.status === 'completed' || eventApt.status === 'cancelled' || eventApt.status === 'no_show') && (
                  <button onClick={() => { const id = eventApt._id; setEventApt(null); handleStatusChange(id, 'scheduled'); }} className="btn btn-secondary btn-sm">{t('action.reopen')}</button>
                )}
                {eventApt.status !== 'cancelled' && eventApt.status !== 'completed' && (
                  <button onClick={() => { setCancelId(eventApt._id); setEventApt(null); }} className="btn btn-secondary btn-sm" style={{ color: 'var(--color-danger)' }}>{t('appointments.actionCancel')}</button>
                )}
              </div>
            </Modal>
          );
        })()}

        {/* Reschedule */}
        {rescheduleId && (
          <Modal onClose={() => setRescheduleId(null)} title={t('appointments.rescheduleTitle')} size="sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>{t('appointments.labelNewDate')}</label><input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} min={today} /></div>
              <div><label>{t('appointments.labelNewTime')}</label><select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}>{timeSlots.map(ts => <option key={ts} value={ts}>{ts}</option>)}</select></div>
              <ModalActions onCancel={() => setRescheduleId(null)} onConfirm={handleReschedule} confirmLabel={t('appointments.actionReschedule')} cancelLabel={t('action.cancel')} />
            </div>
          </Modal>
        )}

        {/* Cancel */}
        {cancelId && (
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
                          <div className="stat-value" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{apt.appointmentTime}</div>
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
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: pc.color, background: `${pc.color}12` }}>{t(priorityLabelKey[apt.priority])}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, color: sc.color, background: sc.bg }}>{t(statusLabelKey[apt.status])}</span>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {apt.status === 'scheduled' && (
                            <button onClick={() => { handleStatusChange(apt._id, 'confirmed'); }} title={t('appointments.actionApprove')} style={miniBtn('var(--accent-primary)')}>
                              <CheckCircle2 size={12} />
                            </button>
                          )}
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
        {editingApt && (() => {
          const apt = appointments.find(a => a._id === editingApt);
          if (!apt) return null;
          return (
            <Modal onClose={() => setEditingApt(null)} title={t('appointments.editTitle')} size="lg">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'stretch', gap: 12 }}>
                  <div><label>{t('frontDesk.date')}</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} min={today} /></div>
                  <div><label>{t('frontDesk.colTime')}</label><select value={formTime} onChange={e => setFormTime(e.target.value)}>{timeSlots.map(ts => <option key={ts} value={ts}>{ts}</option>)}</select></div>
                  <div><label>{t('appointments.labelDuration')}</label><select value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}>{[15, 20, 30, 45, 60, 90].map(d => <option key={d} value={d}>{t('appointments.durationMin', { count: d })}</option>)}</select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 12 }}>
                  <div><label>{t('appointments.labelType')}</label><select value={formType} onChange={e => setFormType(e.target.value as AppointmentType)}>{appointmentTypes.filter(at => at.value !== 'walk_in').map(at => <option key={at.value} value={at.value}>{t(typeLabelKey[at.value])}</option>)}</select></div>
                  <div><label>{t('appointments.labelPriority')}</label><select value={formPriority} onChange={e => setFormPriority(e.target.value as AppointmentPriority)}><option value="routine">{t('appointments.priorityRoutine')}</option><option value="urgent">{t('appointments.priorityUrgent')}</option><option value="emergency">{t('appointments.priorityEmergency')}</option></select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 12 }}>
                  <div><label>{t('appointments.labelDepartment')}</label><select value={formDepartment} onChange={e => setFormDepartment(e.target.value)}>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  <div><label>{t('appointments.labelProvider')}</label><input value={formProvider} onChange={e => setFormProvider(e.target.value)} placeholder={t('appointments.providerPlaceholder')} /></div>
                </div>
                <div><label>{t('appointments.detailReason')}</label><textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
                <div><label>{t('appointments.labelNotes')}</label><textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
                <ModalActions
                  onCancel={() => setEditingApt(null)}
                  onConfirm={async () => {
                    try {
                      await update(apt._id, {
                        appointmentDate: formDate, appointmentTime: formTime, duration: formDuration,
                        appointmentType: formType, priority: formPriority, department: formDepartment,
                        providerName: formProvider, reason: formReason, notes: formNotes,
                      });
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

function Modal({ children, onClose, title, titleColor, icon, size = 'md', nav }: {
  children: React.ReactNode; onClose: () => void; title: string; titleColor?: string;
  icon?: React.ReactNode; size?: 'sm' | 'md' | 'lg'; nav?: React.ReactNode;
}) {
  const sizeClass = size === 'sm' ? 'modal-panel--sm' : size === 'lg' ? 'modal-panel--lg' : 'modal-panel--md';
  const width = size === 'sm' ? 440 : size === 'lg' ? 820 : 600;
  return (
    <PortalModal onClose={onClose} width={width}>
      <div className={`modal-panel ${sizeClass}`} style={{ maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', width: '100%' }}>
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

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{value}</div>
    </div>
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
