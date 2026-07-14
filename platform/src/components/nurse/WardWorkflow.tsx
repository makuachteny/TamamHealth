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
import WardFilters, { type WardFilterState } from './WardFilters';
import ListSearch from './ListSearch';

export default function WardWorkflow({ filters, setFilters }: { filters: WardFilterState; setFilters: (f: WardFilterState) => void }) {
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

  // Free-text search lives inline in the list header (below); structured filters
  // (gender / age / status) come from the WardFilters dropdown beside it.
  const [search, setSearch] = useState('');
  // Acuity quick-filter driven by the summary chips (RED / YELLOW). Kept local
  // rather than in the shared WardFilterState since it's a board-only shortcut.
  const [acuity, setAcuity] = useState<'' | 'RED' | 'YELLOW'>('');
  // Ward/location quick-filter (mirrors the reference "Filter by location").
  const [wardFilter, setWardFilter] = useState('');
  const ageBandOf = (age?: number) => age == null ? null : age < 18 ? 'child' : age < 65 ? 'adult' : 'elderly';
  const q = search.trim().toLowerCase();

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
    if (filters.gender && p.gender !== filters.gender) return false;
    if (filters.age && ageBandOf(p.estimatedAge) !== filters.age) return false;
    if (filters.status && status !== filters.status) return false;
    if (acuity && priority !== acuity) return false;
    if (wardFilter && admissionByPatient.get(p._id)?.wardName !== wardFilter) return false;
    return true;
  }), [wardPatients, patientTriageMap, filters, q, acuity, wardFilter, admissionByPatient]);

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
  const toggleStatus = (v: string) => { setAcuity(''); setFilters({ ...filters, status: filters.status === v ? '' : v }); };
  const toggleAcuity = (v: 'RED' | 'YELLOW') => { setFilters({ ...filters, status: '' }); setAcuity(acuity === v ? '' : v); };

  // Only surface the Location column + ward filter when at least one patient on
  // the board is actually admitted to a bed — otherwise it's a column of dashes.
  const showLocation = wardOptions.length > 0;
  const gridCols = showLocation
    ? 'minmax(0,1.9fr) minmax(0,0.9fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,0.9fr)'
    : 'minmax(0,2fr) minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)';


  // Assign-doctor modal
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);

  // Per-row "Actions" dropdown — holds the patient id whose menu is open.
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);

  // Vitals modal
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsPatient, setVitalsPatient] = useState<{ id: string; name: string } | null>(null);
  const [vitalsForm, setVitalsForm] = useState<VitalsFormData>({
    systolic: '', diastolic: '', temperature: '', pulse: '', spo2: '', weight: '', respiratoryRate: '', notes: '',
    painScore: '', bloodGlucose: '', gcs: '', muac: '',
    oralIntakeMl: '', ivIntakeMl: '', urineOutputMl: '', otherOutputMl: '',
  });
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [vitalsSaved, setVitalsSaved] = useState(false);

  const vitalFlags = getVitalFlags(vitalsForm);

  // Start triage for a specific patient — always routes to the triage page.
  const startTriage = (patientId: string) => {
    router.push(`/dashboard/nurse/triage?patient=${patientId}`);
  };

  // Save vitals to PouchDB
  const handleSaveVitals = async () => {
    if (!vitalsPatient) return;
    const { validateVitalSigns } = await import('@/lib/validation');
    const vitalErrors = validateVitalSigns({
      temperature: vitalsForm.temperature || undefined,
      systolicBP: vitalsForm.systolic || undefined,
      diastolicBP: vitalsForm.diastolic || undefined,
      pulse: vitalsForm.pulse || undefined,
      respiratoryRate: vitalsForm.respiratoryRate || undefined,
      oxygenSaturation: vitalsForm.spo2 || undefined,
      weight: vitalsForm.weight || undefined,
    });
    if (Object.keys(vitalErrors).length > 0) {
      showToast(Object.values(vitalErrors)[0], 'error');
      return;
    }
    // Require at least one measured vital (notes alone is not an observation).
    const hasAnyVital = [
      vitalsForm.systolic, vitalsForm.diastolic, vitalsForm.temperature, vitalsForm.pulse,
      vitalsForm.spo2, vitalsForm.weight, vitalsForm.respiratoryRate,
      vitalsForm.painScore, vitalsForm.bloodGlucose, vitalsForm.gcs, vitalsForm.muac,
      vitalsForm.oralIntakeMl, vitalsForm.ivIntakeMl, vitalsForm.urineOutputMl, vitalsForm.otherOutputMl,
    ].some(v => v?.trim());
    if (!hasAnyVital) {
      showToast(t('nurse.enterAtLeastOneVital'), 'error');
      return;
    }
    setVitalsSaving(true);
    try {
      // Persist as a real medical_record (vitalSigns) — retrievable on the
      // patient chart / vitals trends and synced. Replaces the old write to an
      // orphan `tamamhealth_vitals` DB that nothing read.
      const { recordNursingVitals } = await import('@/lib/services/medical-record-service');
      // Only attach a fluidBalance block when at least one of its fields is filled.
      const hasFluidBalance = [
        vitalsForm.oralIntakeMl, vitalsForm.ivIntakeMl, vitalsForm.urineOutputMl, vitalsForm.otherOutputMl,
      ].some(v => v?.trim());
      await recordNursingVitals({
        patientId: vitalsPatient.id,
        patientName: vitalsPatient.name,
        hospitalId: currentUser?.hospitalId || '',
        hospitalName: currentUser?.hospitalName,
        orgId: currentUser?.orgId,
        recordedById: currentUser?._id,
        recordedByName: currentUser?.name,
        vitals: {
          systolic: vitalsForm.systolic,
          diastolic: vitalsForm.diastolic,
          temperature: vitalsForm.temperature,
          pulse: vitalsForm.pulse,
          spo2: vitalsForm.spo2,
          weight: vitalsForm.weight,
          respiratoryRate: vitalsForm.respiratoryRate,
          painScore: vitalsForm.painScore,
          bloodGlucose: vitalsForm.bloodGlucose,
          gcs: vitalsForm.gcs,
          muac: vitalsForm.muac,
          notes: vitalsForm.notes,
        },
        fluidBalance: hasFluidBalance ? {
          oralIntakeMl: vitalsForm.oralIntakeMl,
          ivIntakeMl: vitalsForm.ivIntakeMl,
          urineOutputMl: vitalsForm.urineOutputMl,
          otherOutputMl: vitalsForm.otherOutputMl,
        } : undefined,
      });
      showToast(t('nurse.vitalsSavedToast'), 'success');
      setVitalsSaved(true);
      setTimeout(() => {
        setVitalsSaved(false);
        setVitalsModalOpen(false);
        setVitalsForm({
          systolic: '', diastolic: '', temperature: '', pulse: '', spo2: '', weight: '', respiratoryRate: '', notes: '',
          painScore: '', bloodGlucose: '', gcs: '', muac: '',
          oralIntakeMl: '', ivIntakeMl: '', urineOutputMl: '', otherOutputMl: '',
        });
      }, 1500);
    } catch (err) {
      console.error('Failed to save vitals:', err);
      showToast(t('nurse.vitalsSaveFailedToast'), 'error');
    } finally {
      setVitalsSaving(false);
    }
  };

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
          {/* Inline search + structured filters — lives in the list header rather
              than the platform-wide top search bar. */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="flex-shrink-0">Ward patients</h3>
            <ListSearch value={search} onChange={setSearch} placeholder={t('nurse.searchPatientPlaceholder')} />
            {wardOptions.length > 0 && (
              <select
                className="ward-location-select"
                value={wardFilter}
                onChange={e => setWardFilter(e.target.value)}
                aria-label={t('nurse.colLocation')}
              >
                <option value="">{t('nurse.allWards')}</option>
                {wardOptions.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            )}
            <WardFilters filters={filters} setFilters={setFilters} />
            {/* At-a-glance roster summary, patients-registry style: inline
                dot-stat chips, right-aligned on the header row. Acuity +
                status chips still double as one-tap filters. */}
            <div className="ward-stat-inline ml-auto" role="group" aria-label={t('nurse.wardPatients')}>
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
                className={`ward-stat-chip ${filters.status === 'pending' ? 'is-active' : ''}`}
                onClick={() => toggleStatus('pending')}
                aria-pressed={filters.status === 'pending'}
              >
                <span className="ward-stat-dot" style={{ background: '#2191D0' }} />
                {t('nurse.statusWaiting')} ({summary.waiting})
              </button>
              <button
                type="button"
                className={`ward-stat-chip ${filters.status === 'seen' ? 'is-active' : ''}`}
                onClick={() => toggleStatus('seen')}
                aria-pressed={filters.status === 'seen'}
              >
                <span className="ward-stat-dot" style={{ background: '#15795C' }} />
                {t('nurse.statusInConsult')} ({summary.inConsult})
              </button>
              <button
                type="button"
                className={`ward-stat-chip ${filters.status === 'none' ? 'is-active' : ''}`}
                onClick={() => toggleStatus('none')}
                aria-pressed={filters.status === 'none'}
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
                <span>{t('nurse.colActions')}</span>
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
                  <span className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
                    {patient._demo ? (
                      <span className="text-[10px] font-medium px-2 py-1 rounded-md" style={{ color: 'var(--text-muted)', background: 'var(--overlay-subtle)' }}>{t('nurse.demoRow')}</span>
                    ) : (
                    <button
                      onClick={() => setOpenActionsFor(openActionsFor === patient._id ? null : patient._id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors hover:bg-[var(--overlay-subtle)]"
                      style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
                    >
                      {t('nurse.colActions')}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    )}
                    {!patient._demo && openActionsFor === patient._id && (
                      <>
                        {/* Click-away backdrop */}
                        <div className="fixed inset-0 z-10" onClick={() => setOpenActionsFor(null)} />
                        <div
                          className="absolute right-0 top-full mt-1 z-20 py-1 rounded-xl overflow-hidden min-w-[170px]"
                          style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg)' }}
                        >
                          <button
                            onClick={() => {
                              setOpenActionsFor(null);
                              setVitalsPatient({ id: patient._id, name: patientFullName(patient) });
                              setVitalsForm({
                                systolic: '', diastolic: '', temperature: '', pulse: '', spo2: '', weight: '', respiratoryRate: '', notes: '',
                                painScore: '', bloodGlucose: '', gcs: '', muac: '',
                                oralIntakeMl: '', ivIntakeMl: '', urineOutputMl: '', otherOutputMl: '',
                              });
                              setVitalsSaved(false);
                              setVitalsModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--overlay-subtle)]"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <Activity className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
                            {t('nurse.actionVitals')}
                          </button>
                          {(!triage || triageStatus === 'none') && (
                            <button
                              onClick={() => {
                                setOpenActionsFor(null);
                                startTriage(patient._id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--overlay-subtle)]"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C2410C' }} />
                              {t('nurse.actionTriage')}
                            </button>
                          )}
                          {triageStatus === 'pending' && (
                            <button
                              onClick={() => {
                                setOpenActionsFor(null);
                                setAssignTarget({
                                  patientId: patient._id,
                                  patientName: patientFullName(patient),
                                  hospitalNumber: patient.hospitalNumber,
                                  triageId: realTriage?._id,
                                  currentDoctorId: patient.assignedDoctor,
                                });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--overlay-subtle)]"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              <UserPlus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                              {t('nurse.actionAssign')}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
      </section>

      {assignTarget && (
        <AssignDoctorModal
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => { setAssignTarget(null); reload(); }}
        />
      )}

      {/* MODAL: Quick Vitals Entry */}
      {vitalsModalOpen && vitalsPatient && (
        <Modal onClose={() => setVitalsModalOpen(false)} width={512}>
          <div
            className="modal-content card-elevated"
            style={{ width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Thermometer className="w-5 h-5" style={{ color: ACCENT }} />
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.quickVitalsEntry')}</h2>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{vitalsPatient.name}</p>
                </div>
              </div>
              <button onClick={() => setVitalsModalOpen(false)} className="p-1 rounded-lg transition-all" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Success State */}
            {vitalsSaved ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <Check className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>{t('nurse.vitalsSavedSuccess')}</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Blood Pressure */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.bloodPressureMmhg')}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder={t('nurse.systolic')}
                        value={vitalsForm.systolic}
                        onChange={e => setVitalsForm(prev => ({ ...prev, systolic: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.systolic ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.systolic ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.systolic ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <span className="self-center text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder={t('nurse.diastolic')}
                        value={vitalsForm.diastolic}
                        onChange={e => setVitalsForm(prev => ({ ...prev, diastolic: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.diastolic ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.diastolic ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.diastolic ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </div>
                  {(vitalFlags.systolic || vitalFlags.diastolic) && (
                    <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                      <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.abnormalBpDetected')}
                    </p>
                  )}
                </div>

                {/* Temperature */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.temperatureC')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="36.5"
                    value={vitalsForm.temperature}
                    onChange={e => setVitalsForm(prev => ({ ...prev, temperature: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: vitalFlags.temperature ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                      border: `1px solid ${vitalFlags.temperature ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                      color: vitalFlags.temperature ? 'var(--color-danger)' : 'var(--text-primary)',
                    }}
                  />
                  {vitalFlags.temperature && (
                    <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                      <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.feverDetected')}
                    </p>
                  )}
                </div>

                {/* Pulse & SpO2 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.pulseRateBpm')}
                    </label>
                    <input
                      type="number"
                      placeholder="72"
                      value={vitalsForm.pulse}
                      onChange={e => setVitalsForm(prev => ({ ...prev, pulse: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: vitalFlags.pulse ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                        border: `1px solid ${vitalFlags.pulse ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                        color: vitalFlags.pulse ? 'var(--color-danger)' : 'var(--text-primary)',
                      }}
                    />
                    {vitalFlags.pulse && (
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.abnormalPulse')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.spo2Label')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="98"
                      value={vitalsForm.spo2}
                      onChange={e => setVitalsForm(prev => ({ ...prev, spo2: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: vitalFlags.spo2 ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                        border: `1px solid ${vitalFlags.spo2 ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                        color: vitalFlags.spo2 ? 'var(--color-danger)' : 'var(--text-primary)',
                      }}
                    />
                    {vitalFlags.spo2 && (
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.lowSpo2')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Weight & Respiratory Rate */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.weightKgLabel')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="65.0"
                      value={vitalsForm.weight}
                      onChange={e => setVitalsForm(prev => ({ ...prev, weight: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.respiratoryRate')}
                    </label>
                    <input
                      type="number"
                      placeholder="18"
                      value={vitalsForm.respiratoryRate}
                      onChange={e => setVitalsForm(prev => ({ ...prev, respiratoryRate: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: vitalFlags.respiratoryRate ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                        border: `1px solid ${vitalFlags.respiratoryRate ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                        color: vitalFlags.respiratoryRate ? 'var(--color-danger)' : 'var(--text-primary)',
                      }}
                    />
                    {vitalFlags.respiratoryRate && (
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.abnormalRr')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Additional vitals */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.additionalVitals')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.painScore')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="0–10"
                        value={vitalsForm.painScore}
                        onChange={e => setVitalsForm(prev => ({ ...prev, painScore: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.painScore ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.painScore ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.painScore ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.bloodGlucose')}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="mmol/L"
                        value={vitalsForm.bloodGlucose}
                        onChange={e => setVitalsForm(prev => ({ ...prev, bloodGlucose: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.bloodGlucose ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.bloodGlucose ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.bloodGlucose ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.gcs')}
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="15"
                        placeholder="3–15"
                        value={vitalsForm.gcs}
                        onChange={e => setVitalsForm(prev => ({ ...prev, gcs: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.gcs ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.gcs ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.gcs ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.muac')}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="cm"
                        value={vitalsForm.muac}
                        onChange={e => setVitalsForm(prev => ({ ...prev, muac: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.muac ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.muac ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.muac ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Fluid balance (mL) */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.fluidBalance')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.oralIntake')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="mL"
                        value={vitalsForm.oralIntakeMl}
                        onChange={e => setVitalsForm(prev => ({ ...prev, oralIntakeMl: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.ivIntake')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="mL"
                        value={vitalsForm.ivIntakeMl}
                        onChange={e => setVitalsForm(prev => ({ ...prev, ivIntakeMl: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.urineOutput')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="mL"
                        value={vitalsForm.urineOutputMl}
                        onChange={e => setVitalsForm(prev => ({ ...prev, urineOutputMl: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.otherOutput')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="mL"
                        value={vitalsForm.otherOutputMl}
                        onChange={e => setVitalsForm(prev => ({ ...prev, otherOutputMl: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                  {[vitalsForm.oralIntakeMl, vitalsForm.ivIntakeMl, vitalsForm.urineOutputMl, vitalsForm.otherOutputMl].some(v => v?.trim()) && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.netBalance')}: {
                        (Number(vitalsForm.oralIntakeMl || 0) + Number(vitalsForm.ivIntakeMl || 0))
                        - (Number(vitalsForm.urineOutputMl || 0) + Number(vitalsForm.otherOutputMl || 0))
                      } mL
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.notes')}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t('nurse.additionalObservations')}
                    value={vitalsForm.notes}
                    onChange={e => setVitalsForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: 'var(--overlay-subtle)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {/* Abnormal flags summary */}
                {Object.keys(vitalFlags).length > 0 && (
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>{t('nurse.abnormalValuesDetected')}</span>
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--color-danger)' }}>
                      {t('nurse.valuesFlagged', { values: Object.keys(vitalFlags).map(k => {
                        const labels: Record<string, string> = { systolic: t('nurse.flagSystolic'), diastolic: t('nurse.flagDiastolic'), temperature: t('nurse.flagTemperature'), spo2: t('nurse.flagSpo2'), pulse: t('nurse.flagPulse'), respiratoryRate: t('nurse.flagRespiratoryRate') };
                        return labels[k] || k;
                      }).join(', ') })}
                    </p>
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveVitals}
                  disabled={vitalsSaving}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: vitalsSaving ? 'var(--text-muted)' : ACCENT }}
                >
                  {vitalsSaving ? t('nurse.savingDots') : t('nurse.saveVitals')}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
