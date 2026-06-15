'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import AvailabilityModal from '@/components/AvailabilityModal';
import {
  Calendar, Plus, Clock, CheckCircle2, XCircle, User,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone, AlertTriangle, RefreshCw,
  Video, Stethoscope, Syringe, HeartPulse, FlaskConical,
  Building2, Bell, X, UserPlus, ClipboardList,
  Filter, ExternalLink,
} from '@/components/icons/lucide';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { FilterBar, SearchInput, FilterSelect } from '@/components/filters';
import type { AppointmentType, AppointmentPriority, AppointmentStatus, FacilityLevel, AppointmentDoc } from '@/lib/db-types';
import { Calendar as BigCalendar, dateFnsLocalizer, type View, type ToolbarProps } from 'react-big-calendar';
import { format as dfFormat, parse as dfParse, startOfWeek as dfStartOfWeek, getDay as dfGetDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import PortalModal from '@/components/Modal';
import PatientName from '@/components/PatientName';

// Google-Calendar-style localizer (date-fns, MIT) shared by the calendar view.
const calendarLocalizer = dateFnsLocalizer({
  format: dfFormat,
  parse: dfParse,
  startOfWeek: () => dfStartOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay: dfGetDay,
  locales: { 'en-US': enUS },
});

// Event shape fed to react-big-calendar; keeps the full appointment on `resource`.
type CalEvent = { id: string; title: string; start: Date; end: Date; resource: AppointmentDoc };

/* ─── Config ─── */
const appointmentTypes: { value: AppointmentType; label: string; icon: typeof Calendar; color: string; bg: string }[] = [
  { value: 'general', label: 'General Consultation', icon: Stethoscope, color: '#1E3A8A', bg: 'rgba(13,148,136,0.12)' },
  { value: 'follow_up', label: 'Follow-Up', icon: RefreshCw, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'specialist', label: 'Specialist', icon: User, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'anc', label: 'Antenatal Care', icon: HeartPulse, color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
  { value: 'immunization', label: 'Immunization', icon: Syringe, color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  { value: 'lab', label: 'Laboratory', icon: FlaskConical, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'telehealth', label: 'Telehealth', icon: Video, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'surgical', label: 'Surgical', icon: Stethoscope, color: '#1E3A8A', bg: 'rgba(13,148,136,0.12)' },
  { value: 'dental', label: 'Dental', icon: Stethoscope, color: '#1E3A8A', bg: 'rgba(13,148,136,0.12)' },
  { value: 'mental_health', label: 'Mental Health', icon: HeartPulse, color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
  { value: 'walk_in', label: 'Walk-In', icon: UserPlus, color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
];

const departments = [
  'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'Surgery',
  'Emergency', 'Cardiology', 'Orthopedics', 'Ophthalmology', 'Neurology',
  'Dermatology', 'ENT', 'Outpatient', 'Dental', 'Mental Health', 'Maternity',
];

const statusConfig: Record<AppointmentStatus, { color: string; bg: string; label: string }> = {
  scheduled: { color: 'var(--accent-primary)', bg: 'var(--accent-light)', label: 'Scheduled' },
  confirmed: { color: 'var(--accent-primary)', bg: 'rgba(124,58,237,0.08)', label: 'Confirmed' },
  checked_in: { color: 'var(--color-warning)', bg: 'rgba(217,119,6,0.08)', label: 'Checked In' },
  in_progress: { color: 'var(--color-success)', bg: 'rgba(5,150,105,0.08)', label: 'In Progress' },
  completed: { color: 'var(--color-success)', bg: 'rgba(31, 157, 111,0.08)', label: 'Completed' },
  cancelled: { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.08)', label: 'Cancelled' },
  no_show: { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', label: 'No Show' },
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
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [calView, setCalView] = useState<'month' | 'week' | 'day'>('month');
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [patientInsurance, setPatientInsurance] = useState<Record<string, boolean>>({});

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

  // Date the react-big-calendar view is centered on (Google-Calendar-style nav).
  const [calDate, setCalDate] = useState<Date>(new Date());

  // Form state
  const [formPatient, setFormPatient] = useState('');
  const [formProvider, setFormProvider] = useState(currentUser?.name || '');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
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

  const today = new Date().toISOString().slice(0, 10);

  // Load insurance status for all patients.
  //
  // The effect runs whenever the appointments list changes; we guard against
  // a race where a slower outer fetch finishes after a newer one and clobbers
  // the fresh state. The `cancelled` flag in the cleanup ensures only the
  // latest invocation publishes its insuranceMap.
  useEffect(() => {
    if (appointments.length === 0) return;
    let cancelled = false;
    const loadInsurance = async () => {
      try {
        const { getPatientInsurancePolicies } = await import('@/lib/services/payment-service');
        const insuranceMap: Record<string, boolean> = {};
        const patientIds = [...new Set(appointments.map(a => a.patientId))];
        for (const pid of patientIds) {
          if (cancelled) return;
          const policies = await getPatientInsurancePolicies(pid);
          insuranceMap[pid] = policies.some((p: { isActive: boolean }) => p.isActive);
        }
        if (!cancelled) setPatientInsurance(insuranceMap);
      } catch {
        // Silently ignore errors in loading insurance
      }
    };
    loadInsurance();
    return () => { cancelled = true; };
  }, [appointments]);

  // Appointments → react-big-calendar events. Each event keeps the full
  // appointment on `resource` so clicking can open the existing detail/edit flow.
  const calendarEvents = useMemo(() => appointments.map(a => {
    const start = new Date(`${a.appointmentDate}T${(a.appointmentTime || '00:00')}:00`);
    const end = new Date(start.getTime() + (a.duration || 30) * 60000);
    return {
      id: a._id,
      title: `${a.patientName}${a.reason ? ' · ' + a.reason : ''}`,
      start,
      end,
      resource: a,
    };
  }), [appointments]);

  // Filtered list
  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (selectedDate) {
      list = list.filter(a => a.appointmentDate === selectedDate);
    }
    if (filterStatus !== 'all') list = list.filter(a => a.status === filterStatus);
    const q = `${search} ${globalSearch}`.toLowerCase().trim();
    if (q) list = list.filter(a =>
      a.patientName.toLowerCase().includes(q) ||
      a.providerName.toLowerCase().includes(q) ||
      a.department.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q)
    );
    // Copy before sorting so we never mutate the `appointments` state in-place
    // (which would happen when no filter applies and `list === appointments`).
    return [...list].sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  }, [appointments, selectedDate, filterStatus, search, globalSearch]);

  // Same scope as the list (date + search) but WITHOUT the status filter, so the
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
    setFormPatient(''); setFormDate(new Date().toISOString().slice(0, 10)); setFormTime('09:00');
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
      const now = new Date();
      await create({
        patientId: patient._id, patientName: `${patient.firstName} ${patient.surname}`,
        patientPhone: patient.phone || undefined, providerId: currentUser?._id || '',
        providerName: currentUser?.name || '', facilityId: currentUser?.hospitalId || '',
        facilityName: currentUser?.hospitalName || '', facilityLevel: 'payam' as FacilityLevel,
        appointmentDate: today, appointmentTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <TopBar />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PageHeader
          icon={Calendar}
          title={t('appointments.title')}
          subtitle={t('appointments.subtitle')}
        />

        {/* ═══ Action Bar ═══ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
            {(['calendar', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: view === v ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}>
                {v === 'calendar' ? t('appointments.viewCalendar') : t('appointments.viewList')}
              </button>
            ))}
          </div>

          {/* Calendar sub-view toggle */}
          {view === 'calendar' && (
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => { setCalView(v); if (v === 'day' && !selectedDate) setSelectedDate(today); }} style={{
                  padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: calView === v ? 'var(--accent-primary)' : 'var(--bg-card)',
                  color: calView === v ? '#fff' : 'var(--text-secondary)',
                  textTransform: 'capitalize',
                }}>
                  {v}
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary" style={{ gap: 6 }}>
            <Filter size={14} /> {t('appointments.filters')}
          </button>

          <div style={{ flex: 1 }} />

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

        {/* Filters bar */}
        {showFilters && (
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder={t('appointments.searchPlaceholder')} />
            <FilterSelect
              aria-label={t('appointments.allStatus')}
              value={filterStatus}
              onChange={setFilterStatus}
              options={statusTabs.map(tab => ({ value: tab.key, label: `${tab.label} (${tab.count})` }))}
            />
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                <X size={12} /> {t('appointments.clearDate')}
              </button>
            )}
          </FilterBar>
        )}

        {/* ═══ Calendar View (react-big-calendar) ═══ */}
        {view === 'calendar' && (
          <div className="card-elevated" style={{ padding: 16, overflow: 'hidden', marginBottom: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="rbc-tamam" style={{ flex: 1, minHeight: 560 }}>
              <BigCalendar<CalEvent, object>
                localizer={calendarLocalizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                date={calDate}
                onNavigate={(d: Date) => setCalDate(d)}
                view={calView as View}
                onView={(v: View) => setCalView(v as 'month' | 'week' | 'day')}
                views={['month', 'week', 'day']}
                popup
                style={{ height: '72vh' }}
                scrollToTime={new Date(1970, 0, 1, 7, 0, 0)}
                components={{ toolbar: CalToolbar }}
                onSelectEvent={(e: { resource: typeof appointments[0] }) => setEventApt(e.resource)}
                selectable
                onSelectSlot={(slot: { start: Date }) => {
                  const d = slot.start;
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setFormDate(iso);
                  if (calView !== 'month') {
                    setFormTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                  }
                  setShowNewForm(true);
                }}
                eventPropGetter={(e: { resource: typeof appointments[0] }) => {
                  const a = e.resource;
                  const color = a.appointmentType === 'walk_in'
                    ? '#7C3AED'
                    : (statusConfig[a.status]?.color || 'var(--accent-primary)');
                  return { style: { backgroundColor: color, borderColor: color, color: '#fff', borderRadius: 6, border: 'none', fontSize: 12, padding: '1px 6px' } };
                }}
                dayPropGetter={(d: Date) => {
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  return iso === today ? { style: { backgroundColor: 'var(--accent-light)' } } : {};
                }}
              />
            </div>
          </div>
        )}

        {/* ═══ Pending Approvals Banner ═══ */}
        {pendingApprovals.length > 0 && (
          <div className="card-elevated" style={{
            padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div className="icon-box-sm" style={{ background: 'rgba(217,119,6,0.12)', flexShrink: 0 }}>
              <Clock size={15} style={{ color: '#D97706' }} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('appointments.pendingApprovalBanner', { count: pendingApprovals.length, plural: pendingApprovals.length > 1 ? 's' : '' })}
              </span>
            </div>
            <button onClick={() => { setFilterStatus('scheduled'); setSelectedDate(null); setView('list'); }}
              className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
              <ClipboardList size={14} /> {t('appointments.review')}
            </button>
          </div>
        )}

        {/* ═══ Selected Date Header ═══ */}
        {selectedDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('appointments.appointmentsCount', { count: filteredAppointments.length })}</span>
          </div>
        )}

        {/* ═══ Appointment List ═══ */}
        {(view === 'list' || selectedDate) && (
          <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredAppointments.length === 0 ? (
              <div className="card-elevated" style={{ textAlign: 'center', padding: 48 }}>
                <Calendar size={56} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{selectedDate ? t('appointments.noneOnDate') : t('appointments.noneFound')}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {canBookAppointments && <button onClick={() => setShowNewForm(true)} className="btn btn-primary btn-sm" style={{ gap: 4 }}>
                    <Plus size={14} /> {t('appointments.bookAppointment')}
                  </button>}
                  {canBookAppointments && <button onClick={() => setShowWalkIn(true)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                    <UserPlus size={14} /> {t('appointments.walkIn')}
                  </button>}
                </div>
              </div>
            ) : (
              filteredAppointments.map(apt => {
                const sc = statusConfig[apt.status]; const pc = priorityConfig[apt.priority];
                const isExpanded = expandedId === apt._id;
                const typeInfo = appointmentTypes.find(t => t.value === apt.appointmentType);
                const isWalkIn = apt.appointmentType === 'walk_in';

                return (
                  <div key={apt._id} className="card-elevated" style={{ overflow: 'hidden' }}>
                    <div onClick={() => setExpandedId(isExpanded ? null : apt._id)} style={{
                      display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 12, flexWrap: 'wrap',
                    }}>
                      <div style={{ minWidth: 52, textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{apt.appointmentTime}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('appointments.minShort', { count: apt.duration })}</div>
                      </div>
                      <div className="icon-box-sm" style={{
                        background: typeInfo?.bg || sc.bg, flexShrink: 0,
                      }}>
                        {typeInfo ? <typeInfo.icon size={15} style={{ color: typeInfo.color }} /> : <Calendar size={15} style={{ color: '#6366F1' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {apt.patientId ? (
                            <Link
                              href={`/patients/${apt.patientId}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              className="hover:underline"
                              title={t('appointments.viewPatientRecord')}
                            >
                              <PatientName name={apt.patientName} nameClassName="text-[13px] font-semibold" />
                              <ExternalLink size={11} style={{ opacity: 0.55 }} />
                            </Link>
                          ) : (
                            <PatientName name={apt.patientName} nameClassName="text-[13px] font-semibold" />
                          )}
                          {isWalkIn && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)' }}>{t('appointments.walkInBadge')}</span>}
                          {patientInsurance[apt.patientId] && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: '#05966915', color: 'var(--color-success)' }}>
                              {t('appointments.insured')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {typeInfo ? t(typeLabelKey[apt.appointmentType]) : apt.appointmentType} &middot; {apt.department}
                        </div>
                      </div>
                      {!selectedDate && <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70 }}>{apt.appointmentDate}</div>}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: pc.color, background: `${pc.color}12` }}>{t(priorityLabelKey[apt.priority])}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, color: sc.color, background: sc.bg }}>{t(statusLabelKey[apt.status])}</span>
                      {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-medium)', paddingTop: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'stretch', gap: 14 }}>
                          <Detail label={t('appointments.detailReason')} value={apt.reason} />
                          {apt.notes && <Detail label={t('appointments.detailNotes')} value={apt.notes} />}
                          <Detail label={t('appointments.detailProvider')} value={t('appointments.providerPrefix', { name: apt.providerName })} />
                          <Detail label={t('appointments.detailFacility')} value={apt.facilityName || t('appointments.notAvailable')} icon={<Building2 size={13} />} />
                          {apt.patientPhone && <Detail label={t('appointments.detailPhone')} value={apt.patientPhone} icon={<Phone size={13} />} />}
                          <Detail label={t('appointments.detailBookedBy')} value={apt.bookedByName} />
                          {apt.isRecurring && <Detail label={t('appointments.detailRecurrence')} value={apt.recurrencePattern || ''} icon={<RefreshCw size={13} />} />}
                          {apt.reminderSent && <Detail label={t('appointments.detailReminder')} value={t('appointments.reminderSent')} icon={<Bell size={13} />} />}
                        </div>
                        {apt.status !== 'completed' && apt.status !== 'cancelled' && apt.status !== 'no_show' && (
                          <>
                          <hr className="section-divider" />
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {apt.status === 'scheduled' && <ActionBtn color="#7C3AED" icon={<CheckCircle2 size={13} />} label={t('appointments.actionApprove')} onClick={() => handleStatusChange(apt._id, 'confirmed')} />}
                            {(apt.status === 'scheduled' || apt.status === 'confirmed') && <ActionBtn color="#D97706" icon={<User size={13} />} label={t('appointments.actionCheckIn')} onClick={() => handleStatusChange(apt._id, 'checked_in')} />}
                            {apt.status === 'checked_in' && <ActionBtn color="#059669" icon={<Stethoscope size={13} />} label={t('appointments.actionStart')} onClick={() => handleStatusChange(apt._id, 'in_progress')} />}
                            {apt.status === 'in_progress' && <ActionBtn color="#1F9D6F" icon={<CheckCircle2 size={13} />} label={t('appointments.actionComplete')} onClick={() => handleStatusChange(apt._id, 'completed')} />}
                            <ActionBtn color="var(--accent-primary)" icon={<RefreshCw size={13} />} label={t('appointments.actionReschedule')} onClick={() => { setRescheduleId(apt._id); setRescheduleDate(apt.appointmentDate); setRescheduleTime(apt.appointmentTime); }} />
                            {(apt.status === 'scheduled' || apt.status === 'confirmed') && <ActionBtn color="#6B7280" icon={<XCircle size={13} />} label={t('appointments.actionNoShow')} onClick={() => handleStatusChange(apt._id, 'no_show')} />}
                            <ActionBtn color="#EF4444" icon={<X size={13} />} label={t('appointments.actionCancel')} onClick={() => setCancelId(apt._id)} />
                          </div>
                          </>
                        )}
                        {apt.status === 'cancelled' && apt.cancelledReason && (
                          <>
                            <hr className="section-divider" />
                            <div style={{ padding: 10, background: 'rgba(239,68,68,0.04)', borderRadius: 8, fontSize: 12, color: 'var(--color-danger)' }}>
                              <strong>{t('appointments.cancellationLabel')}</strong> {apt.cancelledReason}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

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

        {/* Appointment detail — opens when an event on the calendar is clicked */}
        {eventApt && (
          <Modal onClose={() => setEventApt(null)} title={eventApt.patientName} size="md">
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
              {eventApt.status !== 'cancelled' && eventApt.status !== 'completed' && (
                <button onClick={() => { setCancelId(eventApt._id); setEventApt(null); }} className="btn btn-secondary btn-sm" style={{ color: 'var(--color-danger)' }}>{t('appointments.actionCancel')}</button>
              )}
            </div>
          </Modal>
        )}

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
                        <div className="icon-box-sm" style={{ background: typeInfo?.bg || sc.bg, flexShrink: 0 }}>
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
                                <PatientName name={apt.patientName} nameClassName="text-[13px] font-semibold" />
                                <ExternalLink size={10} style={{ opacity: 0.55 }} />
                              </Link>
                            ) : (
                              <PatientName name={apt.patientName} nameClassName="text-[13px] font-semibold" />
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
                            <button onClick={() => { handleStatusChange(apt._id, 'confirmed'); }} title={t('appointments.actionApprove')} style={miniBtn('#7C3AED')}>
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

function Modal({ children, onClose, title, titleColor, icon, size = 'md' }: {
  children: React.ReactNode; onClose: () => void; title: string; titleColor?: string;
  icon?: React.ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'sm' ? 'modal-panel--sm' : size === 'lg' ? 'modal-panel--lg' : 'modal-panel--md';
  const width = size === 'sm' ? 440 : size === 'lg' ? 820 : 600;
  return (
    <PortalModal onClose={onClose} width={width}>
      <div className={`modal-panel ${sizeClass}`} style={{ maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: titleColor || 'var(--text-primary)' }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer',
            width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', transition: 'background 0.15s',
          }}><X size={16} /></button>
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

// Calendar toolbar: only icon prev/next + the period label. The view switcher
// (month/week/day) and Today live in the page's own toolbar above, so they're
// intentionally omitted here to avoid duplicate controls.
const rbcNavBtn: React.CSSProperties = {
  background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)',
  borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
};
function CalToolbar({ label, onNavigate }: ToolbarProps<CalEvent, object>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <button type="button" onClick={() => onNavigate('PREV')} aria-label="Previous" style={rbcNavBtn}><ChevronLeft size={18} /></button>
      <button type="button" onClick={() => onNavigate('NEXT')} aria-label="Next" style={rbcNavBtn}><ChevronRight size={18} /></button>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{label}</h3>
    </div>
  );
}

function ActionBtn({ color, icon, label, onClick }: { color: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
      borderRadius: 8, border: `1px solid ${color}20`, background: `${color}08`,
      color, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
    }}>{icon} {label}</button>
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
