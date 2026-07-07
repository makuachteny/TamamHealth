'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import TopBar from '@/components/TopBar';
import PatientName from '@/components/PatientName';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { BedDouble, ChevronRight, Plus, X, AlertTriangle, CheckCircle2 } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useWards } from '@/lib/hooks/useWards';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { AdmissionDoc } from '@/lib/db-types-ward';

// Shared column template for the admissions table header + rows:
// Patient · Ward · Diagnosis · Severity · Discharge action
const ADMISSION_GRID = 'minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 2fr) 96px 132px';

export default function WardsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  const { wards, activeAdmissions, totalBeds, occupiedBeds, availableBeds, occupancyRate, admit, discharge } = useWards();
  const { showToast } = useToast();

  const [admitOpen, setAdmitOpen] = useState(false);
  const [dischargeFor, setDischargeFor] = useState<AdmissionDoc | null>(null);
  const [filterWard, setFilterWard] = useState<string>('');
  const [admissionSearch, setAdmissionSearch] = useState('');
  const [showWardFilter, setShowWardFilter] = useState(false);
  const wardFilterRef = useRef<HTMLDivElement>(null);
  const activeFilterCount = filterWard ? 1 : 0;
  const clearFilters = () => { setFilterWard(''); };

  const [admitForm, setAdmitForm] = useState({
    patientId: '',
    admittingDiagnosis: '',
    severity: 'moderate' as AdmissionDoc['severity'],
    wardId: '',
    bedNumber: '',
    isolationRequired: false,
  });
  const admissionPrefillApplied = useRef(false);

  const [dischargeForm, setDischargeForm] = useState({
    dischargeType: 'normal' as NonNullable<AdmissionDoc['dischargeType']>,
    dischargeSummary: '',
    followUpRequired: false,
  });

  const facilityId = currentUser?.hospitalId || currentUser?.hospital?._id;
  const facilityWards = useMemo(
    () => facilityId ? wards.filter(w => w.facilityId === facilityId) : wards,
    [wards, facilityId],
  );

  useEffect(() => {
    if (admissionPrefillApplied.current) return;
    const patientId = searchParams?.get('admitPatientId');
    if (!patientId) return;
    admissionPrefillApplied.current = true;
    setAdmitForm(prev => ({
      ...prev,
      patientId,
      admittingDiagnosis: searchParams?.get('diagnosis') || prev.admittingDiagnosis,
      severity: (searchParams?.get('severity') as AdmissionDoc['severity']) || prev.severity,
    }));
    setAdmitOpen(true);
  }, [searchParams]);
  const filteredAdmissions = useMemo(
    () => {
      const q = admissionSearch.trim().toLowerCase();
      return activeAdmissions.filter(a => {
        const matchesWard = !filterWard || a.wardId === filterWard;
        const haystack = `${a.patientName} ${a.admittingDiagnosis} ${a.wardName} ${a.bedNumber || ''} ${a.severity}`.toLowerCase();
        const matchesSearch = !q || q.split(/\s+/).every(term => haystack.includes(term));
        return matchesWard && matchesSearch;
      });
    },
    [activeAdmissions, filterWard, admissionSearch],
  );

  const handleAdmit = async () => {
    const patient = patients.find(p => p._id === admitForm.patientId);
    const ward = facilityWards.find(w => w._id === admitForm.wardId);
    if (!patient || !ward) {
      showToast(t('ward.selectPatientAndWard'), 'error');
      return;
    }
    if (!admitForm.admittingDiagnosis.trim()) {
      showToast(t('ward.diagnosisRequiredToast'), 'error');
      return;
    }
    if (!currentUser) return;
    try {
      await admit({
        patientId: patient._id,
        patientName: `${patient.firstName} ${patient.surname}`.trim(),
        hospitalNumber: patient.hospitalNumber,
        admittingDiagnosis: admitForm.admittingDiagnosis.trim(),
        severity: admitForm.severity,
        admittedBy: currentUser._id || currentUser.username || 'unknown',
        admittedByName: currentUser.name,
        wardId: ward._id,
        wardName: ward.name,
        bedNumber: admitForm.bedNumber || undefined,
        facilityId: ward.facilityId,
        facilityName: ward.facilityName,
        facilityLevel: ward.facilityLevel,
        attendingPhysician: currentUser._id || currentUser.username || 'unknown',
        attendingPhysicianName: currentUser.name,
        isolationRequired: admitForm.isolationRequired,
        // Prefer patient's geographic state; fall back to the admitting
        // facility's state. Previously this fell back to `ward.facilityName`,
        // which would write the hospital's name into the geographic state
        // field — corrupting downstream surveillance/analytics joins that
        // expect a state code (e.g. "Central Equatoria"), not a hospital
        // ("Juba Teaching Hospital").
        state: patient.state || currentUser.hospital?.state || '',
      });
      showToast(t('ward.admittedToast', { name: `${patient.firstName} ${patient.surname}`, ward: ward.name }), 'success');
      setAdmitOpen(false);
      setAdmitForm({ patientId: '', admittingDiagnosis: '', severity: 'moderate', wardId: '', bedNumber: '', isolationRequired: false });
    } catch (err) {
      console.error(err);
      showToast(t('ward.admitFailedToast'), 'error');
    }
  };

  const handleDischarge = async () => {
    if (!dischargeFor || !currentUser) return;
    try {
      await discharge(dischargeFor._id, {
        dischargeType: dischargeForm.dischargeType,
        dischargeSummary: dischargeForm.dischargeSummary.trim() || undefined,
        dischargedBy: currentUser._id || currentUser.username || 'unknown',
        dischargedByName: currentUser.name,
        followUpRequired: dischargeForm.followUpRequired,
      });
      showToast(t('ward.dischargedToast', { name: dischargeFor.patientName }), 'success');
      setDischargeFor(null);
      setDischargeForm({ dischargeType: 'normal', dischargeSummary: '', followUpRequired: false });
    } catch (err) {
      console.error(err);
      showToast(t('ward.dischargeFailedToast'), 'error');
    }
  };

  return (
    <>
      <TopBar title={t('ward.topBarTitle')} hideSearch />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

        <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          {/* ── Card toolbar ── */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-light)' }}>
            {/* Title + bed stats */}
            <div className="flex items-end justify-between gap-3 mb-3">
              <span style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 24, lineHeight: '100%', letterSpacing: 0, color: '#000000' }}>
                {t('ward.currentAdmissions')}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0 pb-0.5">
                {[
                  { label: t('ward.kpiTotalBeds'), value: totalBeds, color: 'var(--text-muted)' },
                  { label: t('ward.kpiOccupied'), value: occupiedBeds, color: '#2191D0' },
                  { label: t('ward.kpiAvailable'), value: availableBeds, color: '#15795C' },
                  { label: t('ward.kpiOccupancy'), value: `${occupancyRate}%`, color: occupancyRate > 90 ? '#C44536' : occupancyRate > 75 ? '#B8741C' : 'var(--accent-primary)' },
                ].map(s => (
                  <span key={s.label} className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    {s.label} ({s.value})
                  </span>
                ))}
              </div>
            </div>
            {/* Search + filter row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={admissionSearch}
                  onChange={e => setAdmissionSearch(e.target.value)}
                  placeholder="Search by patient, ward, or diagnosis…"
                  style={{ padding: '9px 18px', height: 38, borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              {facilityWards.length > 0 && (
                <div className="relative" ref={wardFilterRef}>
                  <button
                    onClick={() => setShowWardFilter(s => !s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 999,
                      border: `1px solid ${activeFilterCount ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                      background: activeFilterCount ? 'rgba(33,145,208,0.08)' : 'var(--bg-card-solid)',
                      color: activeFilterCount ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: '#2191D0', color: '#fff' }}>
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  {showWardFilter && (
                    <div className="absolute left-0 mt-2 rounded-2xl overflow-hidden z-50"
                      style={{ width: 240, background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'none' }}>
                      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Filter by ward</span>
                        {activeFilterCount > 0 && (
                          <button onClick={() => { clearFilters(); setShowWardFilter(false); }} className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>Clear</button>
                        )}
                      </div>
                      <div className="p-3">
                        <select value={filterWard} onChange={e => { setFilterWard(e.target.value); setShowWardFilter(false); }}
                          style={{ width: 'auto', minWidth: '100%', height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', fontSize: 13 }}>
                          <option value="">All wards</option>
                          {facilityWards.map(w => (
                            <option key={w._id} value={w._id}>{w.name} ({w.occupiedBeds}/{w.totalBeds})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setAdmitOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: 999, background: '#2191D0', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Plus className="w-4 h-4" /> {t('ward.admitPatient')}
              </button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {filteredAdmissions.length === 0 ? (
            <EmptyState
              icon={BedDouble}
              title={t('ward.currentAdmissions')}
              message={filterWard ? t('ward.noActiveAdmissionsInWard') : t('ward.noActiveAdmissions')}
            />
          ) : (
            <div>
              {/* Table header */}
              <div
                className="grid items-center gap-3 px-4 py-2.5 sticky top-0 z-10"
                style={{
                  gridTemplateColumns: ADMISSION_GRID,
                  background: 'var(--bg-card-solid)',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                {[t('ward.colPatient'), t('ward.colWard'), t('ward.colDiagnosis'), t('ward.severity'), ''].map((h, i) => (
                  <div key={i} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</div>
                ))}
              </div>
              {filteredAdmissions.map(a => {
                const sevTone = a.severity === 'critical' ? 'danger' : a.severity === 'severe' ? 'warning' : a.severity === 'moderate' ? 'info' : 'success';
                const days = Math.max(1, Math.ceil((Date.now() - new Date(a.admissionDate).getTime()) / 86400000));
                return (
                  <div
                    key={a._id}
                    className="grid items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--table-row-hover)]"
                    style={{
                      gridTemplateColumns: ADMISSION_GRID,
                      borderBottom: '1px solid var(--border-light)',
                      background: a.severity === 'critical' ? 'rgba(196, 69, 54, 0.04)' : 'transparent',
                    }}
                  >
                    {/* Patient */}
                    <div className="min-w-0">
                      <PatientName patientId={a.patientId} name={a.patientName} nameClassName="!font-normal text-[12.5px]" />
                    </div>
                    {/* Ward */}
                    <div className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{a.wardName}</div>
                    {/* Diagnosis + day */}
                    <div className="flex items-center gap-2 min-w-0 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      <span className="truncate">{a.admittingDiagnosis}</span>
                      <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>· {t('ward.dayCount', { day: days })}</span>
                      {a.isolationRequired && <Badge tone="danger" uppercase className="justify-self-start">{t('ward.isolation')}</Badge>}
                    </div>
                    {/* Severity */}
                    <span className="justify-self-start">
                      <Badge tone={sevTone} uppercase>{a.severity}</Badge>
                    </span>
                    {/* Action */}
                    <button onClick={() => setDischargeFor(a)} className="btn btn-secondary btn-sm justify-self-end">{t('ward.discharge')} <ChevronRight className="w-3 h-3" /></button>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Admit modal */}
        {admitOpen && (
          <Modal onClose={() => setAdmitOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-lg w-full" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('ward.admitPatient')}</h3>
                <button onClick={() => setAdmitOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('ward.patientRequired')}</label>
                  <select value={admitForm.patientId} onChange={e => setAdmitForm({ ...admitForm, patientId: e.target.value })}>
                    <option value="">{t('ward.selectPatient')}</option>
                    {patients.slice(0, 200).map(p => (
                      <option key={p._id} value={p._id}>{p.firstName} {p.surname} · {p.hospitalNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('ward.admittingDiagnosisRequired')}</label>
                  <input type="text" value={admitForm.admittingDiagnosis} onChange={e => setAdmitForm({ ...admitForm, admittingDiagnosis: e.target.value })} placeholder={t('ward.admittingDiagnosisPlaceholder')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('ward.severity')}</label>
                    <select value={admitForm.severity} onChange={e => setAdmitForm({ ...admitForm, severity: e.target.value as AdmissionDoc['severity'] })}>
                      <option value="mild">{t('ward.severityMild')}</option>
                      <option value="moderate">{t('ward.severityModerate')}</option>
                      <option value="severe">{t('ward.severitySevere')}</option>
                      <option value="critical">{t('ward.severityCritical')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('ward.wardRequired')}</label>
                    <select value={admitForm.wardId} onChange={e => setAdmitForm({ ...admitForm, wardId: e.target.value })}>
                      <option value="">{t('ward.selectWard')}</option>
                      {facilityWards.filter(w => w.availableBeds > 0).map(w => (
                        <option key={w._id} value={w._id}>{t('ward.wardFree', { name: w.name, count: w.availableBeds })}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('ward.bedNumber')}</label>
                    <input type="text" value={admitForm.bedNumber} onChange={e => setAdmitForm({ ...admitForm, bedNumber: e.target.value })} placeholder={t('ward.optional')} />
                  </div>
                  <label className="flex items-center gap-2 mt-5 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={admitForm.isolationRequired} onChange={e => setAdmitForm({ ...admitForm, isolationRequired: e.target.checked })} />
                    {t('ward.isolationRequired')}
                  </label>
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setAdmitOpen(false)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                <button onClick={handleAdmit} className="btn btn-primary flex-1">{t('ward.admit')}</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Discharge modal */}
        {dischargeFor && (
          <Modal onClose={() => setDischargeFor(null)}>
            <div className="modal-content card-elevated p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold">{t('ward.dischargePatient')}</h3>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{dischargeFor.patientName} · {dischargeFor.wardName}</p>
                </div>
                <button onClick={() => setDischargeFor(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('ward.dischargeType')}</label>
                  <select value={dischargeForm.dischargeType} onChange={e => setDischargeForm({ ...dischargeForm, dischargeType: e.target.value as NonNullable<AdmissionDoc['dischargeType']> })}>
                    <option value="normal">{t('ward.dischargeTypeNormal')}</option>
                    <option value="against_medical_advice">{t('ward.dischargeTypeAma')}</option>
                    <option value="transfer">{t('ward.dischargeTypeTransfer')}</option>
                    <option value="death">{t('ward.dischargeTypeDeath')}</option>
                    <option value="absconded">{t('ward.dischargeTypeAbsconded')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('ward.dischargeSummary')}</label>
                  <textarea rows={3} value={dischargeForm.dischargeSummary} onChange={e => setDischargeForm({ ...dischargeForm, dischargeSummary: e.target.value })} placeholder={t('ward.dischargeSummaryPlaceholder')} />
                </div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={dischargeForm.followUpRequired} onChange={e => setDischargeForm({ ...dischargeForm, followUpRequired: e.target.checked })} />
                  {t('ward.followUpRequired')}
                </label>
                {dischargeForm.dischargeType === 'death' ? (
                  <div className="text-[12px] flex items-center gap-2" style={{ color: '#8B2E24' }}>
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('ward.deathRecordNotice')}
                  </div>
                ) : (
                  <div className="text-[12px] flex items-center gap-2" style={{ color: '#15795C' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('ward.bedReleasedNotice')}
                  </div>
                )}
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setDischargeFor(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                <button onClick={handleDischarge} className="btn btn-primary flex-1">{t('ward.discharge')}</button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </>
  );
}
