'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/Modal';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import PatientName from '@/components/PatientName';
import { BedDouble, ChevronRight, Plus, X, AlertTriangle, CheckCircle2, Search } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useWards } from '@/lib/hooks/useWards';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { AdmissionDoc } from '@/lib/db-types-ward';

export default function WardsPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  const { wards, activeAdmissions, totalBeds, occupiedBeds, availableBeds, occupancyRate, admit, discharge } = useWards();
  const { showToast } = useToast();

  const [admitOpen, setAdmitOpen] = useState(false);
  const [dischargeFor, setDischargeFor] = useState<AdmissionDoc | null>(null);
  const [filterWard, setFilterWard] = useState<string>('');
  const [admissionSearch, setAdmissionSearch] = useState('');

  const [admitForm, setAdmitForm] = useState({
    patientId: '',
    admittingDiagnosis: '',
    severity: 'moderate' as AdmissionDoc['severity'],
    wardId: '',
    bedNumber: '',
    isolationRequired: false,
  });

  const [dischargeForm, setDischargeForm] = useState({
    dischargeType: 'normal' as NonNullable<AdmissionDoc['dischargeType']>,
    dischargeSummary: '',
    followUpRequired: false,
  });

  const facilityId = currentUser?.hospitalId || currentUser?.hospital?._id;
  const facilityName = currentUser?.hospital?.name || currentUser?.hospitalName || t('ward.facilityFallback');
  const facilityWards = useMemo(
    () => facilityId ? wards.filter(w => w.facilityId === facilityId) : wards,
    [wards, facilityId],
  );
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
      <TopBar title={t('ward.topBarTitle')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <PageHeader
          icon={BedDouble}
          title={t('ward.pageTitle')}
          subtitle={facilityWards.length === 1
            ? t('ward.subtitleSingular', { facility: facilityName, count: facilityWards.length })
            : t('ward.subtitlePlural', { facility: facilityName, count: facilityWards.length })}
          actions={
            <button onClick={() => setAdmitOpen(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('ward.admitPatient')}
            </button>
          }
        />

        {/* Active admissions — now also carries the bed-occupancy numbers and
            the ward filter (the standalone ward grid + KPI strip were folded in here). */}
        <div className="dash-card flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-sm">{t('ward.currentAdmissions')}</h3>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                  {t('ward.activeCount', { count: filteredAdmissions.length })}
                </span>
              </div>
              {/* Bed occupancy numbers */}
              <div className="flex items-center gap-4 sm:gap-5">
                {[
                  { label: t('ward.kpiTotalBeds'), value: totalBeds, color: 'var(--accent-primary)' },
                  { label: t('ward.kpiOccupied'), value: occupiedBeds, color: '#3b82f6' },
                  { label: t('ward.kpiAvailable'), value: availableBeds, color: '#15795C' },
                  { label: t('ward.kpiOccupancy'), value: `${occupancyRate}%`, color: occupancyRate > 90 ? '#C44536' : occupancyRate > 75 ? '#B8741C' : 'var(--accent-primary)' },
                ].map(s => (
                  <div key={s.label} className="text-center leading-tight">
                    <div className="text-base font-bold" style={{ color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Search + ward filter — styled like the patient registry */}
            <div className="flex items-center gap-3 flex-wrap mt-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="search"
                  value={admissionSearch}
                  onChange={(e) => setAdmissionSearch(e.target.value)}
                  placeholder="Search patient, diagnosis, bed…"
                  className="pl-9 search-icon-input w-full"
                  style={{ background: 'var(--overlay-subtle)' }}
                />
              </div>
              {facilityWards.length > 0 && (
                <select
                  value={filterWard}
                  onChange={(e) => setFilterWard(e.target.value)}
                  className="w-full sm:w-56"
                  style={{ background: 'var(--overlay-subtle)' }}
                  aria-label="Filter by ward"
                >
                  <option value="">All wards</option>
                  {facilityWards.map(w => (
                    <option key={w._id} value={w._id}>{w.name} ({w.occupiedBeds}/{w.totalBeds})</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {filteredAdmissions.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              {filterWard ? t('ward.noActiveAdmissionsInWard') : t('ward.noActiveAdmissions')}
            </div>
          ) : (
            <div>
              {filteredAdmissions.map(a => {
                const sev = a.severity === 'critical' ? '#C44536' : a.severity === 'severe' ? '#B8741C' : a.severity === 'moderate' ? '#3b82f6' : '#15795C';
                const days = Math.max(1, Math.ceil((Date.now() - new Date(a.admissionDate).getTime()) / 86400000));
                return (
                  <div key={a._id} className="data-row">
                    <div className="data-row__icon" style={{ background: `${sev}1A`, color: sev }}>
                      <BedDouble className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="data-row__label">{a.wardName}{a.bedNumber ? t('ward.bedLabel', { bed: a.bedNumber }) : ''}</div>
                      <div className="data-row__value truncate"><PatientName name={a.patientName} nameClassName="data-row__value" /></div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {t('ward.diagnosisDay', { diagnosis: a.admittingDiagnosis, day: days })}
                        {a.isolationRequired && <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(196, 69, 54, 0.14)', color: '#8B2E24' }}>{t('ward.isolation')}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: `${sev}1A`, color: sev, border: `1px solid ${sev}40` }}>
                      {a.severity}
                    </span>
                    <button onClick={() => setDischargeFor(a)} className="btn btn-secondary btn-sm">{t('ward.discharge')} <ChevronRight className="w-3 h-3" /></button>
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
