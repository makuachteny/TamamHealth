'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWards } from '@/lib/hooks/useWards';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { formatClockTime, formatTimeUntil } from '@/lib/format-utils';
import { patientFullName, patientAgeLabel, initials } from '@/lib/patient-utils';
import { buildQueueFromTriage, STAGE_LABELS, type QueueEntry } from '@/lib/services/patient-queue-service';
import { waitLabel } from '@/components/ehr/EhrVisitPopup';

// Nurse-station acuity vocabulary (design 02): Critical / Watch / Stable —
// deliberately different from the clinic-facing Emergency/Urgent/Routine
// labels in PRIORITY_META.
const ACUITY_META: Record<'RED' | 'YELLOW' | 'GREEN', { label: string; tone: string }> = {
  RED: { label: 'Critical', tone: 'red' },
  YELLOW: { label: 'Watch', tone: 'yellow' },
  GREEN: { label: 'Stable', tone: 'green' },
};
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useWardRoster } from './shared';
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

  const { wardPatients, patientTriageMap } = useWardRoster();
  const { activeAdmissions } = useWards();
  const { appointments } = useAppointments();
  const today = new Date().toISOString().slice(0, 10);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // patientId → their active admission (ward/bed, severity, admitting
  // diagnosis, admission date). Only admitted patients appear here; the rest
  // read as "Stable" / "—" in the row below.
  const admissionByPatient = useMemo(() => {
    const map = new Map<string, typeof activeAdmissions[number]>();
    for (const a of activeAdmissions) {
      if (!map.has(a.patientId)) map.set(a.patientId, a);
    }
    return map;
  }, [activeAdmissions]);

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
    const priority = triage?.priority || '';
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
  }), [wardPatients, patientTriageMap, appointmentByPatient, q, acuity]);

  // At-a-glance acuity counts across the whole roster (unfiltered), powering
  // the three chips. Stable = everything not RED/YELLOW (incl. not triaged).
  const summary = useMemo(() => {
    let critical = 0, urgent = 0;
    for (const p of wardPatients) {
      const priority = (patientTriageMap.get(p._id) || p._triage)?.priority || '';
      if (priority === 'RED') critical++;
      else if (priority === 'YELLOW') urgent++;
    }
    return { critical, urgent, stable: wardPatients.length - critical - urgent };
  }, [wardPatients, patientTriageMap]);

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
      <section className={`ehr-worklist-panel ward-workflow-panel ${showHeader ? '' : 'ward-workflow-panel--merged'}`.trim()} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
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
              <div className="ehr-queue-cards">
                <div className="ehr-queue-guide" aria-hidden="true">
                  {['Patient', 'Location', 'Acuity', 'Status', 'Wait'].map(head => (
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

                  const priority: 'RED' | 'YELLOW' | 'GREEN' = triage?.priority || 'GREEN';
                  const inService = Boolean(entry?.assignedToId);
                  const waiting = !inService && Boolean(entry || demoTriage);
                  const notTriaged = !entry && !demoTriage && !appointment;
                  const statusText = inService
                    ? `In service${entry?.assignedToName ? ` · ${entry.assignedToName}` : ''}`
                    : (entry || demoTriage) ? (demoTriage && !entry && demoTriage.status === 'seen' ? t('nurse.statusInConsult') : t('nurse.statusWaiting'))
                    : appointment ? 'Scheduled' : t('nurse.statusNotTriaged');
                  // Location column (design): the admitted bed wins; otherwise
                  // the queue stage / appointment department stands in.
                  const location = admission
                    ? `${admission.wardName}${admission.bedNumber ? ` · Bed ${admission.bedNumber}` : ''}`
                    : entry
                    ? STAGE_LABELS[entry.stage]
                    : demoTriage
                    ? (demoTriage.status === 'pending' ? STAGE_LABELS.awaiting_triage : STAGE_LABELS.awaiting_rooming)
                    : appointment?.department || '—';
                  // Wait column, exactly like the doctor worklist: queue/slot
                  // time on top, elapsed/remaining hours-minutes below.
                  const appointmentAt = appointment?.appointmentTime
                    ? new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`)
                    : null;
                  const waitText = entry
                    ? formatClockTime(entry.enteredStageAt)
                    : appointment?.appointmentTime ? formatClockTime(appointment.appointmentTime) : '—';
                  const waitSubtext = entry
                    ? waitLabel(entry.minutesWaiting)
                    : appointmentAt && !Number.isNaN(appointmentAt.getTime()) ? formatTimeUntil(appointmentAt.toISOString(), now) : '';
                  const overTarget = Boolean(entry?.flaggedForReassessment);
                  const subtitle = `${triage?.chiefComplaint || patient.hospitalNumber || 'No ID'} · ${patientAgeLabel(patient)} · ${patient.gender || 'Not recorded'}`;
                  const activate = patient._demo ? undefined : () => router.push(`/patients/${patient._id}?tab=vitals`);
                  return (
                    <div
                      key={patient._id}
                      className="ehr-queue-card ehr-queue-card--worklist"
                      data-triage={priority}
                      role={patient._demo ? undefined : 'button'}
                      tabIndex={patient._demo ? undefined : 0}
                      onClick={activate}
                      onKeyDown={patient._demo ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate?.(); } }}
                      style={{ cursor: patient._demo ? 'default' : 'pointer' }}
                    >
                      <div className="ehr-queue-patient">
                        <span className="ehr-patient-icon" data-acuity={priority}>{initials(patientFullName(patient))}</span>
                        <div className="ehr-queue-patient-text">
                          <strong className="ehr-queue-name">{patientFullName(patient)}</strong>
                          <p>{subtitle}</p>
                        </div>
                      </div>

                      <div className="ehr-queue-cell ehr-queue-muted-cell">{location}</div>

                      <div className="ehr-queue-cell">
                        <span className="ehr-queue-pill" data-tone={ACUITY_META[priority].tone}>{ACUITY_META[priority].label}</span>
                      </div>

                      <div className="ehr-queue-cell">
                        <span className="ehr-queue-status">{statusText}</span>
                      </div>

                      <div className="ehr-queue-cell ehr-queue-num-col">
                        <div className={`ehr-queue-wait ${overTarget ? 'ehr-queue-wait-over' : ''}`.trim()}>
                          <strong>{waitText}</strong>
                          {waitSubtext && <small>{waitSubtext}</small>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </section>

    </>
  );
}
