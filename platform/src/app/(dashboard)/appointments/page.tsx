'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, User,
  AlertTriangle, RefreshCw,
  Video, Stethoscope, Syringe, HeartPulse, FlaskConical,
  X, UserPlus,
  ChevronLeft, ChevronRight,
} from '@/components/icons/lucide';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { AppointmentType, AppointmentPriority, AppointmentStatus, FacilityLevel, PatientDoc, AppointmentDoc } from '@/lib/db-types';
import dynamic from 'next/dynamic';
import PortalModal from '@/components/Modal';
import { jubaDate, jubaNow } from '@/lib/time-juba';

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
  // Appointment opened in the click-to-view detail popup.
  const [eventApt, setEventApt] = useState<typeof appointments[0] | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingApt, setEditingApt] = useState<string | null>(null);

  // Deep link: ?new=1 opens the booking form straight away. Read on the client
  // to avoid needing a Suspense boundary around useSearchParams, then strip the param.
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

  useEffect(() => {
    if (typeof window === 'undefined' || appointments.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const appointmentId = params.get('appointment');
    if (!appointmentId) return;
    const appointment = appointments.find(a => a._id === appointmentId);
    if (!appointment) return;
    setEventApt(appointment);
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
  const [formDepartment, setFormDepartment] = useState('Outpatient');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRecurring, setFormRecurring] = useState(false);
  const [formRecurrencePattern, setFormRecurrencePattern] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly'>('monthly');
  const [submitting, setSubmitting] = useState(false);

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
    const q = globalSearch.toLowerCase().trim();
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
  }, [appointments, globalSearch]);

  const selectedAppointment = eventApt
    ? appointments.find(a => a._id === eventApt._id) || eventApt
    : null;
  const selectedPatient = selectedAppointment
    ? patients.find(p => p._id === selectedAppointment.patientId)
    : undefined;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* ═══ Calendar (react-big-calendar) ═══ */}
        <div className="card-elevated appointments-card">
          <div className={`appointments-workspace${selectedAppointment ? ' has-detail' : ''}`}>
            <div className="appointments-calendar-pane rbc-tamam">
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
            {selectedAppointment && (
              <>
                <button
                  type="button"
                  className="appointment-detail-backdrop"
                  aria-label="Close appointment details"
                  onClick={() => setEventApt(null)}
                />
                <AppointmentDetailSidebar
                  appointment={selectedAppointment}
                  patient={selectedPatient}
                  statusLabel={t(statusLabelKey[selectedAppointment.status])}
                  priorityLabel={t(priorityLabelKey[selectedAppointment.priority])}
                  typeLabel={t(typeLabelKey[selectedAppointment.appointmentType])}
                  onClose={() => setEventApt(null)}
                  onOpenPatient={() => {
                    const id = selectedAppointment.patientId;
                    setEventApt(null);
                    router.push(`/patients/${id}`);
                  }}
                  onEdit={() => {
                    loadEditForm(selectedAppointment);
                    setEditingApt(selectedAppointment._id);
                    setEventApt(null);
                  }}
                  onReschedule={() => {
                    setRescheduleId(selectedAppointment._id);
                    setRescheduleDate(selectedAppointment.appointmentDate);
                    setRescheduleTime(selectedAppointment.appointmentTime);
                    setEventApt(null);
                  }}
                  onCancel={() => {
                    setCancelId(selectedAppointment._id);
                    setEventApt(null);
                  }}
                  onUndo={PRIOR_STATUS[selectedAppointment.status] ? () => {
                    const id = selectedAppointment._id;
                    const to = PRIOR_STATUS[selectedAppointment.status]!;
                    setEventApt(null);
                    handleStatusChange(id, to);
                  } : undefined}
                  onReopen={(selectedAppointment.status === 'completed' || selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'no_show') ? () => {
                    const id = selectedAppointment._id;
                    setEventApt(null);
                    handleStatusChange(id, 'scheduled');
                  } : undefined}
                  canCancel={selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed'}
                />
              </>
            )}
          </div>
        </div>



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

function AppointmentDetailSidebar({
  appointment,
  patient,
  statusLabel,
  priorityLabel,
  typeLabel,
  onClose,
  onOpenPatient,
  onEdit,
  onReschedule,
  onCancel,
  onUndo,
  onReopen,
  canCancel,
}: {
  appointment: AppointmentDoc;
  patient?: PatientDoc;
  statusLabel: string;
  priorityLabel: string;
  typeLabel: string;
  onClose: () => void;
  onOpenPatient: () => void;
  onEdit: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onUndo?: () => void;
  onReopen?: () => void;
  canCancel: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'visit' | 'financial'>('visit');
  const patientMeta = formatPatientMeta(patient);
  const location = appointment.facilityName || appointment.department || 'Not assigned';
  const intakeStatus = appointment.reminderSent ? 'Sent to patient' : 'Not sent to patient';
  const noteStatus = appointment.notes ? 'Note started' : 'Note not started';
  const chargeStatus = appointment.status === 'completed' ? 'Ready for charge capture' : 'Charge not started';
  const visitRows = [
    { label: 'Resources', value: appointment.providerName || 'Unassigned' },
    { label: 'Appointment Mode', value: appointment.appointmentType === 'telehealth' ? 'Telehealth' : appointment.appointmentType === 'walk_in' ? 'Walk-in' : 'In Office' },
    { label: 'Location', value: location },
    { label: 'Visit Reason', value: appointment.reason || typeLabel },
    { label: 'Patient Intake', value: intakeStatus },
    { label: 'Date', value: formatAppointmentDate(appointment.appointmentDate) },
    { label: 'Time', value: formatAppointmentTimeRange(appointment) },
    { label: 'Duration', value: `${appointment.duration} minutes` },
    { label: 'Department', value: appointment.department || 'Not assigned' },
    { label: 'Phone', value: appointment.patientPhone || patient?.phone || 'Not recorded' },
    { label: 'Reminder', value: appointment.reminderSent ? `Sent${appointment.reminderChannel ? ` by ${appointment.reminderChannel}` : ''}` : 'Not sent' },
    { label: 'Recurring', value: appointment.isRecurring ? formatReadable(appointment.recurrencePattern || 'recurring') : 'No' },
    { label: 'Note', value: noteStatus },
    ...(appointment.cancelledReason ? [{ label: 'Cancel Reason', value: appointment.cancelledReason }] : []),
    ...(appointment.checkedInAt ? [{ label: 'Checked In', value: formatDateTime(appointment.checkedInAt) }] : []),
    ...(appointment.completedAt ? [{ label: 'Completed', value: formatDateTime(appointment.completedAt) }] : []),
    ...(appointment.notes ? [{ label: 'Notes', value: appointment.notes }] : []),
  ];
  const financialRows = [
    { label: 'Balance', value: '$0.00' },
    { label: 'Charge', value: chargeStatus },
    { label: 'Payment Responsibility', value: 'Not recorded' },
    { label: 'Insurance', value: 'Not recorded' },
    { label: 'Claim Status', value: 'Not started' },
    { label: 'Patient Intake', value: intakeStatus },
    { label: 'Facility', value: location },
    { label: 'Facility Level', value: formatReadable(appointment.facilityLevel) },
    { label: 'Booked By', value: appointment.bookedByName || appointment.bookedBy || 'Not recorded' },
    { label: 'Booked On', value: formatDateTime(appointment.createdAt) },
    { label: 'Last Updated', value: formatDateTime(appointment.updatedAt) },
  ];
  const rows = activeTab === 'visit' ? visitRows : financialRows;

  return (
    <aside className="appointment-detail-sidebar" aria-label="Appointment details" role="dialog" aria-modal="true">
      <div className="appointment-detail-sidebar__header">
        <button type="button" className="appointment-detail-sidebar__back" onClick={onClose} aria-label="Close appointment details">
          <ChevronLeft size={22} />
        </button>
        <div className="appointment-detail-sidebar__title">
          <h2>{formatAppointmentTimeRange(appointment)}</h2>
          <button type="button" onClick={onOpenPatient}>{appointment.patientName}</button>
          {patientMeta && <p>{patientMeta}</p>}
          <div className="appointment-detail-sidebar__status">
            <span>{statusLabel}</span>
            <span>{priorityLabel}</span>
          </div>
        </div>
        <button type="button" className="appointment-detail-sidebar__close" onClick={onClose} aria-label="Close appointment details">
          <X size={16} />
        </button>
      </div>

      <div className="appointment-detail-sidebar__tabs" role="tablist" aria-label="Appointment detail sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'visit'}
          className={activeTab === 'visit' ? 'active' : undefined}
          onClick={() => setActiveTab('visit')}
        >
          Visit Information
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'financial'}
          className={activeTab === 'financial' ? 'active' : undefined}
          onClick={() => setActiveTab('financial')}
        >
          Financial Information
        </button>
      </div>

      <div className="appointment-detail-sidebar__body" role="tabpanel">
        {rows.map(row => (
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      <div className="appointment-detail-sidebar__actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenPatient}>
          <User size={14} /> Open patient record
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>Edit</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReschedule}>Reschedule</button>
        {onUndo && <button type="button" className="btn btn-secondary btn-sm" onClick={onUndo}>Undo</button>}
        {onReopen && <button type="button" className="btn btn-secondary btn-sm" onClick={onReopen}>Reopen</button>}
        {canCancel && (
          <button type="button" className="btn btn-secondary btn-sm danger" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="appointment-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatAppointmentDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatAppointmentTimeRange(appointment: AppointmentDoc) {
  const [hours, minutes] = appointment.appointmentTime.split(':').map(Number);
  const start = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime || '00:00'}:00`);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return `${appointment.appointmentTime} · ${appointment.duration}m`;
  const end = appointment.endTime
    ? new Date(`${appointment.appointmentDate}T${appointment.endTime}:00`)
    : new Date(start.getTime() + appointment.duration * 60000);
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatReadable(value?: string) {
  if (!value) return 'Not recorded';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatPatientMeta(patient?: PatientDoc) {
  if (!patient) return '';
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.estimatedAge;
  const ageText = typeof age === 'number' ? `${age} y/o` : undefined;
  const sexText = patient.gender;
  if (patient.dateOfBirth && ageText) return `DOB: ${formatShortDate(patient.dateOfBirth)} (${ageText} ${sexText})`;
  if (ageText) return `${ageText} ${sexText}`;
  return sexText || '';
}

function calculateAge(dateOfBirth: string) {
  const dob = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

function formatShortDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

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
            <button onClick={onClose} style={{
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
