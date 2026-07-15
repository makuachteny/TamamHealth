'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWards } from '@/lib/hooks/useWards';
import { patientFullName, patientAgeLabel, initials } from '@/lib/patient-utils';
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
export default function WardWorkflow({ search }: { search?: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  const { wardPatients, patientTriageMap } = useWardRoster();
  const { activeAdmissions } = useWards();

  // patientId → their active ward/bed placement, for the Location column.
  // Only admitted patients appear here; the rest show "—".
  const admissionByPatient = useMemo(() => {
    const map = new Map<string, { wardName: string; bedNumber?: string }>();
    for (const a of activeAdmissions) {
      if (!map.has(a.patientId)) map.set(a.patientId, { wardName: a.wardName, bedNumber: a.bedNumber });
    }
    return map;
  }, [activeAdmissions]);

  // One quick filter: the three acuity chips (Critical / Urgent / Stable).
  // GREEN is the "stable" bucket — everything not RED/YELLOW, including
  // patients not yet triaged.
  const [acuity, setAcuity] = useState<'' | 'RED' | 'YELLOW' | 'GREEN'>('');
  const q = (search ?? '').trim().toLowerCase();

  // Whether anyone on the board is actually admitted to a bed — drives the
  // Location column, which is otherwise a column of dashes.
  const hasAdmissions = useMemo(
    () => wardPatients.some(p => admissionByPatient.has(p._id)),
    [wardPatients, admissionByPatient],
  );

  const displayedPatients = useMemo(() => wardPatients.filter(p => {
    const triage = patientTriageMap.get(p._id) || p._triage;
    const status = triage?.status || 'none';
    const priority = triage?.priority || '';
    const complaint = (triage?.chiefComplaint || '').toLowerCase();
    if (q && !(
      patientFullName(p).toLowerCase().includes(q) ||
      (p.hospitalNumber || '').toLowerCase().includes(q) ||
      complaint.includes(q)
    )) return false;
    if (acuity === 'GREEN' && (priority === 'RED' || priority === 'YELLOW')) return false;
    if ((acuity === 'RED' || acuity === 'YELLOW') && priority !== acuity) return false;
    return true;
  }), [wardPatients, patientTriageMap, q, acuity]);

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

  const showLocation = hasAdmissions;
  const gridCols = showLocation
    ? 'minmax(0,1.9fr) minmax(0,0.5fr) minmax(0,0.7fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,0.9fr)'
    : 'minmax(0,2fr) minmax(0,0.5fr) minmax(0,0.7fr) minmax(0,1.6fr) minmax(0,1fr)';


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
      <section className="ehr-worklist-panel" style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          {/* Header, patients-registry style: title + inline dot-stat chips
              (right-aligned). Acuity/status chips double as one-tap filters. */}
          <div className="ward-header-row">
            <h3 className="flex-shrink-0">Ward patients</h3>
            {/* Exactly three chips — the triage triple. Each is a one-tap
                filter, and the same three colors paint the patient rows. */}
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

          <div className="ehr-worklist-table">
            {displayedPatients.length > 0 && (
              <div className="ehr-worklist-head" style={{ gridTemplateColumns: gridCols, minWidth: 0 }}>
                <span>{t('nurse.colPatientName')}</span>
                <span>{t('nurse.colAge')}</span>
                <span>{t('nurse.colGender')}</span>
                {showLocation && <span>{t('nurse.colLocation')}</span>}
                <span>{t('nurse.colChiefComplaint')}</span>
                <span>{t('nurse.colStatus')}</span>
              </div>
            )}
            {displayedPatients.length === 0 && (
              <div className="ehr-worklist-empty">
                {t('patients.patientsFound', { count: 0 })}
              </div>
            )}
            {displayedPatients.map((patient) => {
              const realTriage = patientTriageMap.get(patient._id);
              const triage = realTriage || patient._triage;
              const triagePriority = triage?.priority;
              const triageStatus = triage?.status || 'none';
              const statusLabel = triageStatus === 'pending' ? t('nurse.statusWaiting')
                : triageStatus === 'seen' ? t('nurse.statusInConsult')
                : (triageStatus === 'discharged' || triageStatus === 'admitted') ? triageStatus
                : t('nurse.statusNotTriaged');
              const statusTone = triageStatus === 'pending' ? 'ready'
                : triageStatus === 'seen' ? 'active'
                : (triageStatus === 'discharged' || triageStatus === 'admitted') ? 'active'
                : 'done';
              const admission = admissionByPatient.get(patient._id);
              const location = admission ? `${admission.wardName}${admission.bedNumber ? ` · ${admission.bedNumber}` : ''}` : '—';
              return (
                <div
                  key={patient._id}
                  className="ehr-worklist-row"
                  data-triage={triagePriority || 'GREEN'}
                  role={patient._demo ? undefined : 'button'}
                  tabIndex={patient._demo ? undefined : 0}
                  onClick={patient._demo ? undefined : () => router.push(`/patients/${patient._id}?tab=vitals`)}
                  onKeyDown={patient._demo ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/patients/${patient._id}?tab=vitals`); } }}
                  style={{
                    cursor: patient._demo ? 'default' : 'pointer',
                    gridTemplateColumns: gridCols,
                    minWidth: 0,
                  }}
                >
                  <span className="ehr-worklist-name">
                    <span className="ehr-patient-icon ehr-patient-icon--sm">{initials(patientFullName(patient))}</span>
                    <span>
                      <strong>{patientFullName(patient)}</strong>
                      <small>{patient.hospitalNumber || 'No ID'}</small>
                    </span>
                  </span>
                  <span className="ehr-worklist-room">{patientAgeLabel(patient)}</span>
                  <span className="ehr-worklist-room">{patient.gender || '—'}</span>
                  {showLocation && <span className={admission ? 'ward-location-cell' : 'ward-location-cell is-empty'}>{location}</span>}
                  <span><b className="ehr-department-pill opd">{triage?.chiefComplaint || '—'}</b></span>
                  <span><b className={`ehr-worklist-status ${statusTone}`}>{statusLabel}</b></span>
                </div>
              );
            })}
          </div>
      </section>

    </>
  );
}
