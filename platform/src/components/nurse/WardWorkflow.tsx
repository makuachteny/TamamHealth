'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useWards } from '@/lib/hooks/useWards';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import { patientFullName, patientAgeLabel, initials } from '@/lib/patient-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  ChevronDown, Thermometer, Activity, ClipboardList, UserPlus,
  X, Check, AlertTriangle, AlertCircle,
} from '@/components/icons/lucide';
import {
  ACCENT, getVitalFlags, useWardRoster,
  type VitalsFormData,
} from './shared';
/**
 * Ward patient board. Free-text search comes from OUTSIDE: the nurse-station
 * left rail passes `search` down; the standalone /dashboard/nurse/ward page
 * relies on the platform-wide top search (globalSearch, consumed inside
 * useWardRoster). The board keeps only its one-tap quick filters — the
 * acuity/status stat chips and the ward-location select.
 */
export default function WardWorkflow({ search }: { search?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { showToast } = useToast();

  const { reload, wardPatients, patientTriageMap } = useWardRoster();
  const { activeAdmissions } = useWards();

  // patientId → their active ward/bed placement, for the Location column and
  // the ward filter. Only admitted patients appear here; the rest show "—".
  const admissionByPatient = useMemo(() => {
    const map = new Map<string, { wardName: string; bedNumber?: string }>();
    for (const a of activeAdmissions) {
      if (!map.has(a.patientId)) map.set(a.patientId, { wardName: a.wardName, bedNumber: a.bedNumber });
    }
    return map;
  }, [activeAdmissions]);

  // Quick filters driven by the summary chips — acuity (RED/YELLOW) and
  // workflow status. Both local: they're one-tap board shortcuts.
  const [acuity, setAcuity] = useState<'' | 'RED' | 'YELLOW'>('');
  const [statusFilter, setStatusFilter] = useState('');
  // Ward/location quick-filter (mirrors the reference "Filter by location").
  const [wardFilter, setWardFilter] = useState('');
  const q = (search ?? '').trim().toLowerCase();

  // Distinct wards actually represented in the current roster — the filter only
  // offers wards that have someone on the board, and hides entirely if none.
  const wardOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of wardPatients) {
      const a = admissionByPatient.get(p._id);
      if (a?.wardName) set.add(a.wardName);
    }
    return [...set].sort();
  }, [wardPatients, admissionByPatient]);

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
    if (statusFilter && status !== statusFilter) return false;
    if (acuity && priority !== acuity) return false;
    if (wardFilter && admissionByPatient.get(p._id)?.wardName !== wardFilter) return false;
    return true;
  }), [wardPatients, patientTriageMap, statusFilter, q, acuity, wardFilter, admissionByPatient]);

  // At-a-glance counts across the whole roster (unfiltered), powering the
  // summary strip above the table. Acuity + workflow-status breakdown.
  const summary = useMemo(() => {
    let critical = 0, urgent = 0, waiting = 0, inConsult = 0, notTriaged = 0;
    for (const p of wardPatients) {
      const triage = patientTriageMap.get(p._id) || p._triage;
      const priority = triage?.priority || '';
      const status = triage?.status || 'none';
      if (priority === 'RED') critical++;
      else if (priority === 'YELLOW') urgent++;
      if (status === 'pending') waiting++;
      else if (status === 'seen') inConsult++;
      else if (status === 'none') notTriaged++;
    }
    return { total: wardPatients.length, critical, urgent, waiting, inConsult, notTriaged };
  }, [wardPatients, patientTriageMap]);

  // Toggling a status chip clears any acuity filter and vice-versa, so the two
  // quick-filters never fight each other.
  const toggleStatus = (v: string) => { setAcuity(''); setStatusFilter(s => (s === v ? '' : v)); };
  const toggleAcuity = (v: 'RED' | 'YELLOW') => { setStatusFilter(''); setAcuity(a => (a === v ? '' : v)); };

  // Only surface the Location column + ward filter when at least one patient on
  // the board is actually admitted to a bed — otherwise it's a column of dashes.
  const showLocation = wardOptions.length > 0;
  const gridCols = showLocation
    ? 'minmax(0,1.9fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,0.9fr)'
    : 'minmax(0,2fr) minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)';



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
          {/* Header, patients-registry style: row 1 = title + inline dot-stat
              chips (right-aligned); row 2 = search + ward select + filters.
              Acuity/status chips still double as one-tap filters. */}
          <div className="ward-header-row">
            <h3 className="flex-shrink-0">Ward patients</h3>
            <div className="ward-stat-inline" role="group" aria-label={t('nurse.wardPatients')}>
              <span className="ward-stat-chip">
                <span className="ward-stat-dot" style={{ background: 'var(--text-muted)' }} />
                {t('nurse.summaryTotal')} ({summary.total})
              </span>
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
                className={`ward-stat-chip ${statusFilter === 'pending' ? 'is-active' : ''}`}
                onClick={() => toggleStatus('pending')}
                aria-pressed={statusFilter === 'pending'}
              >
                <span className="ward-stat-dot" style={{ background: '#2191D0' }} />
                {t('nurse.statusWaiting')} ({summary.waiting})
              </button>
              <button
                type="button"
                className={`ward-stat-chip ${statusFilter === 'seen' ? 'is-active' : ''}`}
                onClick={() => toggleStatus('seen')}
                aria-pressed={statusFilter === 'seen'}
              >
                <span className="ward-stat-dot" style={{ background: '#15795C' }} />
                {t('nurse.statusInConsult')} ({summary.inConsult})
              </button>
              <button
                type="button"
                className={`ward-stat-chip ${statusFilter === 'none' ? 'is-active' : ''}`}
                onClick={() => toggleStatus('none')}
                aria-pressed={statusFilter === 'none'}
              >
                <span className="ward-stat-dot" style={{ background: '#B8741C' }} />
                {t('nurse.statusNotTriaged')} ({summary.notTriaged})
              </button>
            </div>
          </div>

          <div className="ehr-worklist-table">
            {displayedPatients.length > 0 && (
              <div className="ehr-worklist-head" style={{ gridTemplateColumns: gridCols, minWidth: 0 }}>
                <span>{t('nurse.colPatientName')}</span>
                <span>{t('nurse.colAge')} / {t('nurse.colGender')}</span>
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
                  onClick={patient._demo ? undefined : () => router.push(`/patients/${patient._id}`)}
                  onKeyDown={patient._demo ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/patients/${patient._id}`); } }}
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
                  <span className="ehr-worklist-room">{patientAgeLabel(patient)} · {patient.gender || '—'}</span>
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
