'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { formatAppointmentTimeUntil, formatClockTime } from '@/lib/format-utils';
import { patientFullName, patientAgeLabel, initials, stateTint } from '@/lib/patient-utils';
import { buildQueueFromTriage, stageForAppointmentStatus, STAGE_LABELS, type QueueEntry } from '@/lib/services/patient-queue-service';
import { waitLabel } from '@/components/ehr/EhrVisitPopup';
import { APPOINTMENT_STATUS_TONES, APPOINTMENT_STATUS_FLOW, APPOINTMENT_STATUS_EXITS, appointmentStatusLabel } from '@/lib/appointment-status';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { AppointmentStatus } from '@/lib/db-types';

// Nurse-station acuity vocabulary (design 02): Critical / Watch / Stable —
// deliberately different from the clinic-facing Emergency/Urgent/Routine
// labels in PRIORITY_META.
const ACUITY_META: Record<'RED' | 'YELLOW' | 'GREEN', { label: string; tone: string }> = {
  RED: { label: 'Critical', tone: 'red' },
  YELLOW: { label: 'Watch', tone: 'yellow' },
  GREEN: { label: 'Stable', tone: 'green' },
};

// Tone → shared pill class, mirroring EhrCareDashboard's statusPillClass
// mapping (the front desk's control) so a ward visit's status pill takes the
// identical front-desk colour. Kept as its own map here rather than a
// `status-${tone}` template — the tone names ('ready', 'active', 'danger'...)
// are not themselves class names in globals.css, only these curated targets are.
const STATUS_TONE_PILL_CLASS: Record<string, string> = {
  done: 'status-completed',
  active: 'status-checked-in',
  ready: 'status-confirmed',
  danger: 'status-no-show',
  warning: 'status-attention',
  scheduled: 'status-scheduled',
};
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useWardRoster, severityAcuity } from './shared';
/**
 * Ward patient board. Free-text search comes from OUTSIDE: the nurse-station
 * left rail passes `search` down; the standalone /dashboard/nurse/ward page
 * relies on the platform-wide top search (globalSearch, consumed inside
 * useWardRoster). The board keeps only its one-tap quick filters — the
 * acuity/status stat chips. Rows carry no action menu: clicking a patient
 * goes straight to their chart, landing on Vitals & Biometrics.
 */
export default function WardWorkflow({ search, showHeader = true }: { search?: string; showHeader?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();

  const { wardPatients, patientTriageMap, admissionByPatient } = useWardRoster();
  const { appointments, updateStatus } = useAppointments();
  const { showToast } = useToast();

  // Writes the picked rung; when it's Rescheduled — which drops the visit off
  // the live board — the toast carries an Undo that restores the previous rung.
  const today = new Date().toISOString().slice(0, 10);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Same queue derivation as the Clinical Officer worklist: the patient's
  // latest triage runs through the canonical stage machine, so the nurse
  // reads the identical Source / Priority / Status / Queue / Wait columns
  // the doctor and reception see for the same patient — including the same
  // 24h cutoff (older triage docs are unclosed visits, not still-waiting
  // patients; without the cutoff an abandoned triage would sit on the board
  // forever with an ever-growing wait).
  const [boardOpenedMs] = useState(() => Date.now());
  const queueEntryByPatient = useMemo(() => {
    const cutoff = boardOpenedMs - 24 * 60 * 60 * 1000;
    const active = [...patientTriageMap.values()].filter(doc => new Date(doc.triagedAt).getTime() >= cutoff);
    const entries = buildQueueFromTriage(active);
    const map = new Map<string, QueueEntry>();
    for (const entry of entries) map.set(entry.patientId, entry);
    return map;
  }, [patientTriageMap, boardOpenedMs]);

  // One quick filter: the three acuity chips (Critical / Urgent / Stable).
  // GREEN is the "stable" bucket — everything not RED/YELLOW, including
  // patients not yet triaged.
  const [acuity, setAcuity] = useState<'' | 'RED' | 'YELLOW' | 'GREEN'>('');
  const q = (search ?? '').trim().toLowerCase();

  const appointmentByPatient = useMemo(() => {
    const byPatient = new Map<string, typeof appointments[number]>();
    const byName = new Map<string, typeof appointments[number]>();
    for (const appointment of appointments
      .filter(appointment => appointment.appointmentDate === today)
      .filter(appointment => !['cancelled', 'no_show'].includes(appointment.status))
      .sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''))
    ) {
      if (appointment.patientId && !byPatient.has(appointment.patientId)) byPatient.set(appointment.patientId, appointment);
      if (appointment.patientName && !byName.has(appointment.patientName.toLowerCase())) byName.set(appointment.patientName.toLowerCase(), appointment);
    }
    return { byPatient, byName };
  }, [appointments, today]);

  const displayedPatients = useMemo(() => wardPatients.filter(p => {
    const triage = patientTriageMap.get(p._id) || p._triage;
    const appointment = appointmentByPatient.byPatient.get(p._id) || appointmentByPatient.byName.get(patientFullName(p).toLowerCase());
    const appointmentTime = appointment?.appointmentTime ? formatClockTime(appointment.appointmentTime).toLowerCase() : '';
    const priority = triage?.priority || severityAcuity(admissionByPatient.get(p._id)?.severity) || '';
    const complaint = (triage?.chiefComplaint || '').toLowerCase();
    if (q && !(
      patientFullName(p).toLowerCase().includes(q) ||
      (p.hospitalNumber || '').toLowerCase().includes(q) ||
      complaint.includes(q) ||
      appointmentTime.includes(q)
    )) return false;
    if (acuity === 'GREEN' && (priority === 'RED' || priority === 'YELLOW')) return false;
    if ((acuity === 'RED' || acuity === 'YELLOW') && priority !== acuity) return false;
    return true;
  }), [wardPatients, patientTriageMap, admissionByPatient, appointmentByPatient, q, acuity]);

  // At-a-glance acuity counts across the whole roster (unfiltered), powering
  // the three chips. Stable = everything not RED/YELLOW (incl. not triaged).
  const summary = useMemo(() => {
    let critical = 0, urgent = 0;
    for (const p of wardPatients) {
      // Same acuity derivation as the rows below: triage first, then what the
      // admission severity implies — so the chips agree with the board.
      const priority = (patientTriageMap.get(p._id) || p._triage)?.priority
        || severityAcuity(admissionByPatient.get(p._id)?.severity) || '';
      if (priority === 'RED') critical++;
      else if (priority === 'YELLOW') urgent++;
    }
    return { critical, urgent, stable: wardPatients.length - critical - urgent };
  }, [wardPatients, patientTriageMap, admissionByPatient]);

  const toggleAcuity = (v: 'RED' | 'YELLOW' | 'GREEN') => setAcuity(a => (a === v ? '' : v));

  return (
    <>
      {/* Ward Patient table — same .ehr-worklist-panel card the Clinical
          Officer's "Assigned patients" list uses, so both dashboards render
          this list identically instead of the ward view having its own
          bespoke bordered card. A single top-level element here, matching
          MarWorkflow/TriageWorkflow — EhrCareDashboard already wraps
          `children` in its own .ehr-worklist-panel.ehr-care-workflow div, so
          an extra wrapper here double-nests the class and breaks its width
          (the child of .ehr-care-workflow shrinks to content width instead
          of stretching, since the inline flex:1 needs to be on THIS element
          directly to win over `.ehr-care-workflow > *`). */}
      <section data-tour="ward-board" className={`ehr-worklist-panel ward-workflow-panel ${showHeader ? '' : 'ward-workflow-panel--merged'}`.trim()} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          {showHeader && (
            <div className="ward-header-row">
              <h3 className="flex-shrink-0">Ward patients</h3>
              <div className="ward-stat-inline" role="group" aria-label={t('nurse.wardPatients')}>
                <button
                  type="button"
                  className={`ward-stat-chip ${acuity === 'RED' ? 'is-active' : ''}`}
                  onClick={() => toggleAcuity('RED')}
                  aria-pressed={acuity === 'RED'}
                >
                  <span className="ward-stat-dot" style={{ background: '#DC2626' }} />
                  {t('nurse.summaryCritical')} ({summary.critical})
                </button>
                <button
                  type="button"
                  className={`ward-stat-chip ${acuity === 'YELLOW' ? 'is-active' : ''}`}
                  onClick={() => toggleAcuity('YELLOW')}
                  aria-pressed={acuity === 'YELLOW'}
                >
                  <span className="ward-stat-dot" style={{ background: '#D97706' }} />
                  {t('nurse.summaryUrgent')} ({summary.urgent})
                </button>
                <button
                  type="button"
                  className={`ward-stat-chip ${acuity === 'GREEN' ? 'is-active' : ''}`}
                  onClick={() => toggleAcuity('GREEN')}
                  aria-pressed={acuity === 'GREEN'}
                >
                  <span className="ward-stat-dot" style={{ background: '#15795C' }} />
                  {t('nurse.summaryStable')} ({summary.stable})
                </button>
              </div>
            </div>
          )}

          <div className="ehr-worklist-table">
            {displayedPatients.length === 0 && (
              <div className="ehr-worklist-empty">
                {t('patients.patientsFound', { count: 0 })}
              </div>
            )}
            {displayedPatients.length > 0 && (
              <div className="appointment-card-surface">
                {/* Patient / Time / Care team / Context / Status, with every
                    data column using the same primary + secondary hierarchy. */}
                <div className="appointment-card-flow">
                <div className="appointment-card-head" aria-hidden="true">
                  {['Patient', 'Time', 'Care team', 'Context', 'Status'].map(head => (
                    <span key={head}>{head}</span>
                  ))}
                </div>
                {displayedPatients.map((patient) => {
                  // Identical column derivation to the doctor's worklist
                  // (EhrClinicalDashboard.rowQueueColumns): queue entry when
                  // the patient has arrived, appointment facts when they
                  // haven't. Demo rows carry a minimal inline `_triage`, so
                  // they fall back to the same vocabulary without an entry.
                  const entry = queueEntryByPatient.get(patient._id);
                  const demoTriage = patient._triage;
                  const triage = patientTriageMap.get(patient._id) || demoTriage;
                  const appointment = appointmentByPatient.byPatient.get(patient._id)
                    || appointmentByPatient.byName.get(patientFullName(patient).toLowerCase());
                  const admission = admissionByPatient.get(patient._id);

                  // Acuity: latest triage wins; an untriaged inpatient falls
                  // back to what their admission severity implies rather than
                  // reading "Stable" while in a sickle-cell crisis.
                  const priority: 'RED' | 'YELLOW' | 'GREEN' =
                    triage?.priority || severityAcuity(admission?.severity) || 'GREEN';
                  const inService = Boolean(entry?.assignedToId);
                  // The board speaks the front desk's vocabulary now — Checked
                  // In, Triaged, Roomed — rather than a private set ("Waiting",
                  // "In consult", "Not triaged") that named the same rungs
                  // differently and could not be acted on. Where the patient has
                  // a visit today, the cell IS the shared status dropdown, so a
                  // nurse rooms a triaged patient from the board. Where there is
                  // no visit (an inpatient on the roster), the queue stage stands
                  // in as a plain pill — there is no ladder to move.
                  const visitStatus: AppointmentStatus | null = appointment?.status ?? null;
                  // Where this patient stands in the queue. The triage-derived
                  // entry wins when there is one; otherwise the visit's own
                  // status answers, so someone reception checked in but nobody
                  // has assessed yet reads "Awaiting Triage" here instead of
                  // falling through to a department name or a dash.
                  const visitStage = stageForAppointmentStatus(visitStatus ?? undefined);
                  const queueStageText = entry
                    ? STAGE_LABELS[entry.stage]
                    : demoTriage
                      ? (demoTriage.status === 'pending' ? STAGE_LABELS.awaiting_triage : STAGE_LABELS.awaiting_rooming)
                      : visitStage ? STAGE_LABELS[visitStage]
                      : null;
                  const fallbackStatusText = queueStageText ?? (admission ? 'Admitted' : '—');
                  // One lookup, not a ternary re-stating the table two dozen
                  // lines above it: the queue's live acuity when there is one,
                  // else the roster's.
                  const statusSubtext = ACUITY_META[entry?.acuity ?? priority].label;
                  // Location column (design): the admitted bed wins; otherwise
                  // the queue stage / appointment department stands in.
                  const location = admission
                    ? `${admission.wardName}${admission.bedNumber ? ` · Bed ${admission.bedNumber}` : ''}`
                    : queueStageText ?? appointment?.department ?? '—';
                  // Wait column, exactly like the doctor worklist: queue/slot
                  // time on top, elapsed/remaining hours-minutes below. For an
                  // inpatient with no queue entry or visit today, the admission
                  // itself is the time fact — not a dash over today's date.
                  const appointmentAt = appointment?.appointmentTime
                    ? new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`)
                    : null;
                  const admittedAt = admission ? new Date(admission.admissionDate) : null;
                  const admittedDays = admittedAt && !Number.isNaN(admittedAt.getTime())
                    ? Math.max(0, Math.floor((now.getTime() - admittedAt.getTime()) / 86_400_000))
                    : null;
                  const waitText = entry
                    ? formatClockTime(entry.enteredStageAt)
                    : appointment?.appointmentTime ? formatClockTime(appointment.appointmentTime)
                    : admission && admittedAt && !Number.isNaN(admittedAt.getTime()) ? formatClockTime(admission.admissionDate)
                    : '—';
                  const waitSubtext = entry
                    ? waitLabel(entry.minutesWaiting)
                    : appointmentAt && !Number.isNaN(appointmentAt.getTime()) ? formatAppointmentTimeUntil(appointmentAt, now)
                    : admittedDays !== null ? (admittedDays === 0 ? 'Admitted today' : `Admitted ${admittedDays}d ago`)
                    : today;
                  const overTarget = Boolean(entry?.flaggedForReassessment);
                  const subtitle = `${triage?.chiefComplaint || admission?.admittingDiagnosis || patient.hospitalNumber || 'No ID'} · ${patientAgeLabel(patient)} · ${patient.gender || 'Not recorded'}`;
                  const activate = patient._demo ? undefined : () => router.push(`/patients/${patient._id}?tab=vitals`);
                  const stageText = queueStageText ?? appointment?.department ?? '';
                  const careTeamDoctor = admission?.attendingPhysicianName || patient.assignedDoctorName || 'Doctor unassigned';
                  const careTeamNurse = admission?.nurseAssignedName || entry?.assignedToName || 'Nurse unassigned';
                  const statusPillClass = inService ? 'status-checked-in' : 'status-attention';
                  // Same tone→class resolution as the front desk's picker: a
                  // real visit status wins and is colored by its tone; a
                  // roster-only row (no visit today) falls back to the queue
                  // in-service/attention pill above.
                  const visitPillClass = visitStatus
                    ? STATUS_TONE_PILL_CLASS[APPOINTMENT_STATUS_TONES[visitStatus]]
                    : statusPillClass;
                  return (
                    <div
                      key={patient._id}
                      className="ehr-appointment-row appointment-card-row"
                      data-triage={priority}
                      role={patient._demo ? undefined : 'button'}
                      tabIndex={patient._demo ? undefined : 0}
                      onClick={activate}
                      onKeyDown={patient._demo ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate?.(); } }}
                      style={{ cursor: patient._demo ? 'default' : 'pointer' }}
                    >
                      <div className="ehr-appointment-identity">
                        <div className="ehr-patient-icon" style={stateTint(priority)}>
                          {(patient as { photoUrl?: string }).photoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={(patient as { photoUrl?: string }).photoUrl} alt="" className="ehr-patient-icon-photo" />
                            : initials(patientFullName(patient))}
                        </div>
                        <div className="ehr-appointment-main appointment-card-patient">
                          <strong className="ehr-queue-name">{patientFullName(patient)}</strong>
                          <p>{subtitle}</p>
                        </div>
                      </div>

                      <div className="ehr-appointment-time">
                        <strong style={overTarget ? { color: 'var(--color-danger)' } : undefined}>{waitText}</strong>
                        {waitSubtext && (
                          <span className={overTarget ? 'is-soon' : ''}>{waitSubtext}</span>
                        )}
                      </div>

                      <div className="appointment-card-provider">
                        <strong>{careTeamDoctor}</strong>
                        <span>{careTeamNurse}</span>
                      </div>

                      <div className="ehr-appointment-department">
                        <strong>{stageText || location || '—'}</strong>
                        <span>{admission ? location : appointment ? 'Appointment' : 'Ward'}</span>
                      </div>

                        <div
                          className="appointment-card-status"
                          // The row navigates to the chart; the picker inside it
                          // must not take the nurse there mid-change.
                          onClick={event => event.stopPropagation()}
                          onKeyDown={event => event.stopPropagation()}
                        >
                          {/* Display-only. Status is changed in the appointment
                              editor, so the board reports the visit rather than
                              steering it. */}
                          <span className={`appointment-status-pill ${visitPillClass}`.trim()}>
                            {visitStatus ? appointmentStatusLabel(visitStatus) : fallbackStatusText}
                          </span>
                          <small>{statusSubtext}</small>
                        </div>
                      </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
      </section>


    </>
  );
}
