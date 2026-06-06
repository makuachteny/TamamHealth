'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import {
  Calendar, Plus, Clock, CheckCircle2, XCircle, User, Search,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone, AlertTriangle, RefreshCw,
  Video, Stethoscope, Syringe, HeartPulse, FlaskConical,
  Building2, Bell, X, UserPlus, ClipboardList,
  Filter, ExternalLink,
} from '@/components/icons/lucide';
import { useAppointments, useAppointmentStats } from '@/lib/hooks/useAppointments';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { AppointmentType, AppointmentPriority, AppointmentStatus, FacilityLevel } from '@/lib/db-types';

/* ─── Config ─── */
const appointmentTypes: { value: AppointmentType; label: string; icon: typeof Calendar; color: string; bg: string }[] = [
  { value: 'general', label: 'General Consultation', icon: Stethoscope, color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
  { value: 'follow_up', label: 'Follow-Up', icon: RefreshCw, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'specialist', label: 'Specialist', icon: User, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'anc', label: 'Antenatal Care', icon: HeartPulse, color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
  { value: 'immunization', label: 'Immunization', icon: Syringe, color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  { value: 'lab', label: 'Laboratory', icon: FlaskConical, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'telehealth', label: 'Telehealth', icon: Video, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  { value: 'surgical', label: 'Surgical', icon: Stethoscope, color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
  { value: 'dental', label: 'Dental', icon: Stethoscope, color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
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
  completed: { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.08)', label: 'Completed' },
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ─── Helpers ─── */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ─── Page ─── */
export default function AppointmentsPage() {
  const { appointments, create, updateStatus, reschedule, update } = useAppointments();
  const { stats } = useAppointmentStats();
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

  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [calView, setCalView] = useState<'month' | 'week' | 'day'>('month');
  const [showNewForm, setShowNewForm] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
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

  // Calendar state
  const todayObj = new Date();
  const [calMonth, setCalMonth] = useState(todayObj.getMonth());
  const [calYear, setCalYear] = useState(todayObj.getFullYear());

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

  // Calendar data
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const days: { day: number; date: string; isToday: boolean; isCurrentMonth: boolean }[] = [];
    // Previous month padding
    const prevMonthDays = getDaysInMonth(calYear, calMonth - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = calMonth === 0 ? 11 : calMonth - 1;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      days.push({ day: d, date: formatDate(y, m, d), isToday: false, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = formatDate(calYear, calMonth, d);
      days.push({ day: d, date, isToday: date === today, isCurrentMonth: true });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = calMonth === 11 ? 0 : calMonth + 1;
      const y = calMonth === 11 ? calYear + 1 : calYear;
      days.push({ day: d, date: formatDate(y, m, d), isToday: false, isCurrentMonth: false });
    }
    return days;
  }, [calYear, calMonth, today]);

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

  // Appointment counts by date
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, { total: number; pending: number; confirmed: number; walkIn: number }> = {};
    appointments.forEach(a => {
      if (!map[a.appointmentDate]) map[a.appointmentDate] = { total: 0, pending: 0, confirmed: 0, walkIn: 0 };
      map[a.appointmentDate].total++;
      if (a.status === 'scheduled') map[a.appointmentDate].pending++;
      if (a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress') map[a.appointmentDate].confirmed++;
      if (a.appointmentType === 'walk_in') map[a.appointmentDate].walkIn++;
    });
    return map;
  }, [appointments]);

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

  // Pending approvals
  const pendingApprovals = useMemo(() => appointments.filter(a => a.status === 'scheduled' && a.appointmentDate >= today), [appointments, today]);
  const walkIns = useMemo(() => appointments.filter(a => a.appointmentType === 'walk_in' && a.appointmentDate === today), [appointments, today]);

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

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };
  const goToday = () => { setCalMonth(todayObj.getMonth()); setCalYear(todayObj.getFullYear()); setSelectedDate(today); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <TopBar />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PageHeader
          icon={Calendar}
          title={t('appointments.title')}
          subtitle={t('appointments.subtitle')}
        />

        {/* ═══ Quick Stats ═══ */}
        {stats && (
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            {[
              { label: t('appointments.statTodaysAppointments'), value: stats.todayTotal, icon: Calendar, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
              { label: t('appointments.statPendingApproval'), value: pendingApprovals.length, icon: Clock, color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
              { label: t('appointments.statWalkInsToday'), value: walkIns.length, icon: UserPlus, color: 'var(--accent-primary)', bg: 'var(--accent-light)' },
              { label: t('appointments.statCompleted'), value: stats.todayCompleted, icon: CheckCircle2, color: 'var(--color-success)', bg: 'rgba(5,150,105,0.12)' },
              { label: t('appointments.statNoShowRate'), value: `${stats.noShowRate}%`, icon: XCircle, color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.12)' },
            ].map((c, i) => (
              <div key={i} className="card-elevated" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div className="icon-box-sm" style={{ background: c.bg }}>
                    <c.icon size={15} style={{ color: c.color }} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                </div>
                <div className="stat-value text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

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
          <div className="card-elevated" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('appointments.searchPlaceholder')}
                style={{ paddingLeft: 32 }} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">{t('appointments.allStatus')}</option>
              {Object.keys(statusConfig).map(k => <option key={k} value={k}>{t(statusLabelKey[k as AppointmentStatus])}</option>)}
            </select>
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                <X size={12} /> {t('appointments.clearDate')}
              </button>
            )}
          </div>
        )}

        {/* ═══ Calendar View ═══ */}
        {view === 'calendar' && (
          <div className="card-elevated" style={{ padding: 0, overflow: 'hidden', marginBottom: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Calendar header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid var(--border-medium)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={prevMonth} style={calNavBtn}><ChevronLeft size={44} /></button>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>
                  {calView === 'day' && selectedDate
                    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                    : `${MONTHS[calMonth]} ${calYear}`}
                </h3>
                <button onClick={nextMonth} style={calNavBtn}><ChevronRight size={44} /></button>
              </div>
              <button onClick={goToday} className="btn btn-secondary btn-sm">{t('appointments.today')}</button>
            </div>

            {/* ── Month View ── */}
            {calView === 'month' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {WEEKDAYS.map(d => (
                    <div key={d} style={{
                      padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderBottom: '1px solid var(--border-medium)',
                    }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gridAutoRows: '1fr' }}>
                  {calendarDays.map((day, i) => {
                    const counts = appointmentsByDate[day.date];
                    const isSelected = selectedDate === day.date;
                    return (
                      <button key={i} onClick={() => { const d = isSelected ? null : day.date; setSelectedDate(d); if (d) { setShowDayPopup(true); setFormDate(d); } else { setShowDayPopup(false); } }} style={{
                        padding: '10px 4px', minHeight: 0, border: 'none', cursor: 'pointer',
                        background: isSelected ? 'var(--accent-light)' : day.isToday ? 'rgba(16,185,129,0.04)' : 'transparent',
                        borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border-medium)' : 'none',
                        borderBottom: '1px solid var(--border-medium)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        opacity: day.isCurrentMonth ? 1 : 0.35,
                        transition: 'background 0.15s',
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: day.isToday ? 700 : 500,
                          color: day.isToday ? '#fff' : isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                          width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: day.isToday ? 'var(--accent-primary)' : 'transparent',
                        }}>{day.day}</span>
                        {counts && (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {counts.pending > 0 && <span style={dotStyle('var(--color-warning)')} title={`${counts.pending} ${t('appointments.legendPending').toLowerCase()}`} />}
                            {counts.confirmed > 0 && <span style={dotStyle('var(--color-success)')} title={`${counts.confirmed} ${t('appointments.legendActive').toLowerCase()}`} />}
                            {counts.walkIn > 0 && <span style={dotStyle('var(--accent-primary)')} title={`${counts.walkIn} ${t('appointments.legendWalkIn').toLowerCase()}`} />}
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{counts.total}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Week View ── */}
            {calView === 'week' && (() => {
              const sel = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
              const dayOfWeek = sel.getDay();
              const weekStart = new Date(sel);
              weekStart.setDate(sel.getDate() - dayOfWeek);
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                return { date: formatDate(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), dayName: WEEKDAYS[d.getDay()], isToday: formatDate(d.getFullYear(), d.getMonth(), d.getDate()) === today };
              });
              const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7am to 6pm
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', flex: 1, minHeight: 480 }}>
                  {/* Header row */}
                  <div style={{ borderBottom: '1px solid var(--border-medium)', borderRight: '1px solid var(--border-medium)', padding: 4 }} />
                  {weekDays.map(wd => (
                    <button key={wd.date} onClick={() => { setSelectedDate(wd.date); setCalView('day'); }} style={{
                      padding: '8px 4px', borderBottom: '1px solid var(--border-medium)', borderRight: '1px solid var(--border-medium)',
                      textAlign: 'center', cursor: 'pointer', border: 'none', borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: 'var(--border-medium)',
                      borderRightStyle: 'solid', borderRightWidth: 1, borderRightColor: 'var(--border-medium)',
                      background: wd.isToday ? 'var(--accent-light)' : 'transparent',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{wd.dayName}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: wd.isToday ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{wd.day}</div>
                      {appointmentsByDate[wd.date] && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-primary)', marginTop: 2 }}>{appointmentsByDate[wd.date].total} apt{appointmentsByDate[wd.date].total !== 1 ? 's' : ''}</div>
                      )}
                    </button>
                  ))}
                  {/* Time rows */}
                  {hours.map(h => (
                    <React.Fragment key={h}>
                      <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border-medium)', borderBottom: '1px solid var(--border-light)' }}>
                        {h.toString().padStart(2, '0')}:00
                      </div>
                      {weekDays.map(wd => {
                        const dayApts = appointments.filter(a => a.appointmentDate === wd.date && a.appointmentTime.startsWith(h.toString().padStart(2, '0')));
                        return (
                          <div key={wd.date + h} onClick={() => { setSelectedDate(wd.date); setFormDate(wd.date); setFormTime(`${h.toString().padStart(2, '0')}:00`); setShowNewForm(true); }}
                            style={{ borderRight: '1px solid var(--border-medium)', borderBottom: '1px solid var(--border-light)', padding: 2, cursor: 'pointer', minHeight: 36 }}>
                            {dayApts.map(a => (
                              <div key={a._id} onClick={e => { e.stopPropagation(); setSelectedDate(wd.date); setShowDayPopup(true); }}
                                style={{ fontSize: 10, fontWeight: 600, padding: '2px 4px', borderRadius: 4, marginBottom: 1, background: 'var(--accent-light)', color: 'var(--accent-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {a.appointmentTime} {a.patientName.split(' ')[0]}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              );
            })()}

            {/* ── Day View ── */}
            {calView === 'day' && (() => {
              const dayDate = selectedDate || today;
              const dayApts = appointments.filter(a => a.appointmentDate === dayDate).sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
              const hours = Array.from({ length: 12 }, (_, i) => i + 7);
              return (
                <div>
                  {/* Time grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr' }}>
                    {hours.map(h => {
                      const hourApts = dayApts.filter(a => a.appointmentTime.startsWith(h.toString().padStart(2, '0')));
                      return (
                        <React.Fragment key={h}>
                          <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', borderRight: '1px solid var(--border-medium)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                            {h.toString().padStart(2, '0')}:00
                          </div>
                          <div
                            onClick={() => { setFormDate(dayDate); setFormTime(`${h.toString().padStart(2, '0')}:00`); setShowNewForm(true); }}
                            style={{ borderBottom: '1px solid var(--border-light)', padding: '4px 8px', cursor: 'pointer', minHeight: 48 }}
                          >
                            {hourApts.map(a => {
                              const sc = statusConfig[a.status];
                              return (
                                <div key={a._id} onClick={e => { e.stopPropagation(); setExpandedId(expandedId === a._id ? null : a._id); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, marginBottom: 4, background: 'var(--accent-light)', cursor: 'pointer' }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 44 }}>{a.appointmentTime}</div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.patientName}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.department} · {a.providerName}</div>
                                  </div>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${sc?.color || 'var(--accent-primary)'}12`, color: sc?.color || 'var(--accent-primary)' }}>{sc ? t(statusLabelKey[a.status]) : a.status}</span>
                                </div>
                              );
                            })}
                            {hourApts.length === 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.4, padding: '4px 0' }}>{t('appointments.clickToBook')}</div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, padding: '10px 20px', borderTop: '1px solid var(--border-medium)', flexWrap: 'wrap' }}>
              {[
                { color: 'var(--color-warning)', label: t('appointments.legendPending') },
                { color: 'var(--color-success)', label: t('appointments.legendActive') },
                { color: 'var(--accent-primary)', label: t('appointments.legendWalkIn') },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ ...dotStyle(l.color), position: 'relative' }} />
                  {l.label}
                </div>
              ))}
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
                              {apt.patientName}
                              <ExternalLink size={11} style={{ opacity: 0.55 }} />
                            </Link>
                          ) : (
                            apt.patientName
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
                            {apt.status === 'in_progress' && <ActionBtn color="#10B981" icon={<CheckCircle2 size={13} />} label={t('appointments.actionComplete')} onClick={() => handleStatusChange(apt._id, 'completed')} />}
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
                                {apt.patientName}
                                <ExternalLink size={10} style={{ opacity: 0.55 }} />
                              </Link>
                            ) : (
                              apt.patientName
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
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-panel ${sizeClass}`}>
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
    </div>
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
const calNavBtn: React.CSSProperties = {
  background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)',
  borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
};

function dotStyle(color: string): React.CSSProperties {
  return { width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' };
}

function miniBtn(color: string): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 'var(--card-radius)', border: `1px solid ${color}25`,
    background: `${color}08`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, padding: 0,
  };
}
