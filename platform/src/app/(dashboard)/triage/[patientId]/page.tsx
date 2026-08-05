'use client';

/**
 * Triage, one patient at a time.
 *
 * The nursing station's triage board is a facility-wide surface: a search box
 * to find anyone, one blank ETAT form, and everybody's recent triages beside
 * it. That is the right shape for "who is next", and the wrong shape once a
 * nurse has a patient in front of them — the first thing they have to do is
 * find that person again in a search box, and everything else on screen is
 * about other people.
 *
 * This page is the second shape. The patient is fixed by the URL, so the form
 * cannot drift onto someone else mid-assessment, the list beside it is that
 * patient's own triage history, and the page is addressable — a queue row, a
 * notification, or a handover message can send a nurse straight to the person
 * they need to assess.
 */

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import { useAppointments } from '@/lib/hooks/useAppointments';
import AppointmentStatusSelect from '@/components/appointments/AppointmentStatusSelect';
import { APPOINTMENT_CLOSED_STATUSES, APPOINTMENT_STATUS_FLOW, APPOINTMENT_STATUS_EXITS, APPOINTMENT_STATUS_TONES, appointmentStatusLabel } from '@/lib/appointment-status';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { jubaDate } from '@/lib/time-juba';
import { patientFullName, patientGenderAge, initials, stateTint } from '@/lib/patient-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { ArrowLeft, FileText } from '@/components/icons/lucide';
import TriageWorkflow from '@/components/nurse/TriageWorkflow';
import { PRIORITY_META } from '@/components/ehr/EhrVisitPopup';

export default function PatientTriagePage() {

  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const patientId = String(params?.patientId || '');
  const { patients, loading } = usePatients();
  const { triages } = useTriage();
  const { appointments, updateStatus } = useAppointments();
  const {
    canConfirmAppointments, canCheckInAppointments, canAdvanceAppointments, canManageAppointmentSchedule,
  } = usePermissions();
  // Same split the appointments list and ward board use: forward progression
  // for anyone who can move a visit along, the exits reserved for
  // schedule-management roles — a triage nurse here has check-in/advance
  // permission but no business cancelling or no-showing the visit she is
  // actively assessing. `cancelled` stays off this control entirely: it needs
  // a reason, which only the dedicated Cancel flow (on the appointments list)
  // collects.
  const canChangeVisitStatus = canConfirmAppointments || canCheckInAppointments || canAdvanceAppointments;
  const visitStatusOptions = useMemo(() => [
    ...APPOINTMENT_STATUS_FLOW,
    ...(canManageAppointmentSchedule ? APPOINTMENT_STATUS_EXITS.filter(s => s !== 'cancelled') : []),
  ], [canManageAppointmentSchedule]);

  // Today's open visit, if there is one. Saving a triage puts it on the Triaged
  // rung; the nurse's next step — Roomed — is the next option in this same
  // control, so rooming happens where the assessment was just written rather
  // than back on some other board.
  const visit = useMemo(() => {
    const today = jubaDate();
    return appointments.find(appointment =>
      appointment.patientId === patientId &&
      appointment.appointmentDate === today &&
      !APPOINTMENT_CLOSED_STATUSES.includes(appointment.status)) || null;
  }, [appointments, patientId]);

  const patient = useMemo(
    () => patients.find(p => p._id === patientId) || null,
    [patients, patientId],
  );

  // Most recent triage for this patient — the header says where they already
  // are in the queue, so a nurse can tell a re-assessment from a first one.
  const latestTriage = useMemo(() => (
    triages
      .filter(tr => tr.patientId === patientId)
      .sort((a, b) => (b.triagedAt || '').localeCompare(a.triagedAt || ''))[0] || null
  ), [triages, patientId]);

  if (loading || !patient) {
    return (
      <main className="page-container flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {loading ? t('status.loading') : t('patient.notFound')}
        </p>
      </main>
    );
  }

  const name = patientFullName(patient);
  const photo = (patient as { photoUrl?: string }).photoUrl;
  const acuity = latestTriage?.priority as 'RED' | 'YELLOW' | 'GREEN' | undefined;

  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Not `.ehr-chart-back` — globals hides that class outright; it belongs
          to the chart, which has its own way back. */}
      <button
        type="button"
        onClick={() => router.push('/dashboard/nurse?station=triage')}
        className="flex items-center gap-1.5 text-[12px] font-bold mb-2 no-print"
        style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <ArrowLeft className="w-4 h-4" style={{ stroke: 'currentColor' }} /> Triage station
      </button>

      {/* Who is being triaged, stated once at the top — the form below has no
          patient picker, so this line is the only place it is said. */}
      <div
        className="card-elevated flex items-center gap-3 px-4 py-3 mb-3 flex-shrink-0"
        style={{ borderRadius: 12 }}
      >
        <span className="ehr-patient-icon" style={stateTint(acuity)} aria-hidden>
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} alt="" className="ehr-patient-icon-photo" />
            : initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{name}</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {[patient.hospitalNumber, patientGenderAge(patient)].filter(Boolean).join(' · ')}
          </p>
        </div>
        {acuity && (
          <span className="ehr-queue-pill flex-shrink-0" data-tone={PRIORITY_META[acuity].tone}>
            {PRIORITY_META[acuity].label}
          </span>
        )}
        {visit && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Visit</span>
            {canChangeVisitStatus ? (
              <AppointmentStatusSelect
                status={visit.status}
                layout="bare"
                label={`Visit status for ${name}`}
                allowedStatuses={visitStatusOptions}
                onChange={status => updateStatus(visit._id, status)}
              />
            ) : (
              <span className={`appointment-status-pill status-${APPOINTMENT_STATUS_TONES[visit.status]}`}>
                {appointmentStatusLabel(visit.status)}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => router.push(`/patients/${patient._id}`)}
          className="flex items-center gap-1.5 px-3 h-[32px] rounded-lg text-[12px] font-semibold flex-shrink-0"
          style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', color: 'var(--text-secondary)' }}
        >
          <FileText className="w-4 h-4" style={{ stroke: 'currentColor' }} /> Open chart
        </button>
      </div>

      <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        <TriageWorkflow lockedPatientId={patient._id} />
      </div>
    </main>
  );
}
