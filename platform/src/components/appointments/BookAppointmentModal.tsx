'use client';

/**
 * BookAppointmentModal — the booking form as a dialog, wherever booking starts.
 *
 * The clinician dashboard's "New appointments" button used to route to
 * `/appointments?new=1`, which loaded the whole schedule module just to open
 * this form over it and left the clinician somewhere else once they were done.
 * Booking is a form and a save; it belongs on the page the person is already
 * working from.
 *
 * The form owns its own state so a caller only has to mount it. Fields, order
 * and the create() payload match the appointments page's booking form — the
 * same booking wherever it is started from.
 */

import { useMemo, useState } from 'react';
import PortalModal from '@/components/Modal';
import AppointmentStatusSelect from '@/components/appointments/AppointmentStatusSelect';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { usePatients } from '@/lib/hooks/usePatients';
import { useUsers } from '@/lib/hooks/useUsers';
import { staffOptionLabel, type StaffSlotContext } from '@/lib/appointment-staff';
import { useAuth } from '@/lib/context';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { jubaDate } from '@/lib/time-juba';
import { X } from '@/components/icons/lucide';
import type {
  AppointmentType, AppointmentPriority, AppointmentStatus, FacilityLevel,
} from '@/lib/db-types';

const FALLBACK_DEPARTMENTS = [
  'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'Surgery',
  'Emergency', 'Cardiology', 'Orthopedics', 'Ophthalmology', 'Neurology',
  'Dermatology', 'ENT', 'Outpatient',
];

/** 07:00 → 18:30 on the half hour, the facility's booking day. */
const TIME_SLOTS = Array.from({ length: 24 }, (_, h) =>
  ['00', '30'].map(m => `${h.toString().padStart(2, '0')}:${m}`),
).flat().filter(slot => {
  const hour = parseInt(slot.split(':')[0], 10);
  return hour >= 7 && hour <= 18;
});

const TYPE_OPTIONS: { value: AppointmentType; labelKey: string }[] = [
  { value: 'general', labelKey: 'appointments.typeGeneral' },
  { value: 'follow_up', labelKey: 'appointments.typeFollowUp' },
  { value: 'specialist', labelKey: 'appointments.typeSpecialist' },
  { value: 'anc', labelKey: 'appointments.typeAnc' },
  { value: 'immunization', labelKey: 'appointments.typeImmunization' },
  { value: 'lab', labelKey: 'appointments.typeLab' },
  { value: 'telehealth', labelKey: 'appointments.typeTelehealth' },
  { value: 'surgical', labelKey: 'appointments.typeSurgical' },
  { value: 'dental', labelKey: 'appointments.typeDental' },
  { value: 'mental_health', labelKey: 'appointments.typeMentalHealth' },
];

export default function BookAppointmentModal({
  onClose,
  onBooked,
  defaultDate,
  defaultPatientId,
}: {
  onClose: () => void;
  /** Fires after a successful booking, before the dialog closes. */
  onBooked?: () => void;
  /** Pre-selected day — the dashboard passes whichever day is being viewed. */
  defaultDate?: string;
  defaultPatientId?: string;
}) {
  const { t } = useTranslation();
  const { create, appointments } = useAppointments();
  const { patients } = usePatients();
  const { users } = useUsers();
  const { currentUser } = useAuth();
  const { departments: facilityDepartments } = useSettings();
  const { showToast } = useToast();
  const departments = facilityDepartments.length ? facilityDepartments : FALLBACK_DEPARTMENTS;
  const today = jubaDate();

  const [patientId, setPatientId] = useState(defaultPatientId || '');
  // Provider is a staff-directory pick (id + name), not free text — the id is
  // what arms the service's double-booking guard.
  const [providerId, setProviderId] = useState('');
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState(defaultDate || today);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState<AppointmentType>('general');
  const [priority, setPriority] = useState<AppointmentPriority>('routine');
  const [status, setStatus] = useState<AppointmentStatus>('scheduled');
  const [department, setDepartment] = useState('Outpatient');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly'>('monthly');

  // Same roster + availability labels as the appointments page: clinicians at
  // this facility, each stating free-or-busy at the slot in the form.
  const providerOptions = useMemo(() => users
    .filter(u => (u.role === 'doctor' || u.role === 'clinical_officer')
      && u.isActive !== false
      && (!currentUser?.hospitalId || u.hospitalId === currentUser.hospitalId))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '')), [users, currentUser?.hospitalId]);
  const providerSlotContext = useMemo<StaffSlotContext>(() => ({
    appointments, date, time, duration,
  }), [appointments, date, time, duration]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!patientId || !date || !time || !reason) {
      showToast(t('appointments.toastFillRequired'), 'error');
      return;
    }
    const patient = patients.find(p => p._id === patientId);
    if (!patient) {
      showToast(t('appointments.toastSelectValidPatient'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await create({
        patientId: patient._id,
        patientName: `${patient.firstName} ${patient.surname}`,
        patientPhone: patient.phone || undefined,
        providerId,
        providerName: provider,
        facilityId: currentUser?.hospitalId || '',
        facilityName: currentUser?.hospitalName || '',
        facilityLevel: 'payam' as FacilityLevel,
        appointmentDate: date,
        appointmentTime: time,
        duration,
        appointmentType: type,
        priority,
        department,
        reason,
        notes: notes || undefined,
        status,
        reminderSent: false,
        isRecurring: recurring,
        recurrencePattern: recurring ? recurrencePattern : undefined,
        bookedBy: currentUser?._id || '',
        bookedByName: currentUser?.name || '',
        state: '',
        orgId: currentUser?.orgId,
      });
      showToast(t('appointments.toastBooked'), 'success');
      onBooked?.();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('appointments.toastFailedBook'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalModal onClose={onClose} width={720}>
      <div className="modal-panel modal-panel--lg" style={{ maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10 }}>
          <h2 className="truncate" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('appointments.bookAppointment')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer',
              width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>{t('appointments.labelPatient')}</label>
            <select value={patientId} onChange={e => setPatientId(e.target.value)}>
              <option value="">{t('appointments.selectPatient')}</option>
              {patients.map(p => (
                <option key={p._id} value={p._id}>
                  {p.firstName} {p.surname} {p.hospitalNumber ? `(${p.hospitalNumber})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'stretch', gap: 12 }}>
            <div><label>{t('appointments.labelDate')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} min={today} /></div>
            <div><label>{t('appointments.labelTime')}</label><select value={time} onChange={e => setTime(e.target.value)}>{TIME_SLOTS.map(ts => <option key={ts} value={ts}>{ts}</option>)}</select></div>
            <div><label>{t('appointments.labelDuration')}</label><select value={duration} onChange={e => setDuration(Number(e.target.value))}>{[15, 20, 30, 45, 60, 90].map(d => <option key={d} value={d}>{t('appointments.durationMin', { count: d })}</option>)}</select></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 12 }}>
            <div><label>{t('appointments.labelType')}</label><select value={type} onChange={e => setType(e.target.value as AppointmentType)}>{TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}</select></div>
            <div>
              <label>{t('appointments.labelPriority')}</label>
              <select value={priority} onChange={e => setPriority(e.target.value as AppointmentPriority)}>
                <option value="routine">{t('appointments.priorityRoutine')}</option>
                <option value="urgent">{t('appointments.priorityUrgent')}</option>
                <option value="emergency">{t('appointments.priorityEmergency')}</option>
              </select>
            </div>
            {/* Usually left at Scheduled, but the desk books patients already
                standing at the window, and data entry back-fills visits that
                have happened — both need to start on a different rung. */}
            <div><label>{t('appointments.labelStatus')}</label><AppointmentStatusSelect status={status} layout="bare" onChange={setStatus} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 12 }}>
            <div><label>{t('appointments.labelDepartment')}</label><select value={department} onChange={e => setDepartment(e.target.value)}>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div><label>{t('appointments.labelProvider')}</label>
              <select
                value={providerId}
                onChange={e => {
                  const person = providerOptions.find(p => p._id === e.target.value);
                  setProviderId(e.target.value);
                  setProvider(person ? (person.name || person.username || '') : '');
                }}
              >
                <option value="">Unassigned</option>
                {providerOptions.map(person => (
                  <option key={person._id} value={person._id}>{staffOptionLabel(person, providerSlotContext)}</option>
                ))}
              </select>
            </div>
          </div>

          <div><label>{t('appointments.labelReason')}</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder={t('appointments.reasonPlaceholder')} /></div>
          <div><label>{t('appointments.labelNotes')}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('appointments.notesPlaceholder')} /></div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: 13 }}>
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} /> {t('appointments.recurringAppointment')}
            {recurring && (
              <select value={recurrencePattern} onChange={e => setRecurrencePattern(e.target.value as typeof recurrencePattern)} style={{ width: 'auto' }}>
                <option value="weekly">{t('appointments.recurrenceWeekly')}</option>
                <option value="biweekly">{t('appointments.recurrenceBiweekly')}</option>
                <option value="monthly">{t('appointments.recurrenceMonthly')}</option>
                <option value="quarterly">{t('appointments.recurrenceQuarterly')}</option>
              </select>
            )}
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>{t('action.cancel')}</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary"
              style={{ flex: 1, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? t('appointments.booking') : t('appointments.bookAppointment')}
            </button>
          </div>
        </div>
      </div>
    </PortalModal>
  );
}
