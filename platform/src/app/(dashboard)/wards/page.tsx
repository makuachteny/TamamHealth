'use client';

import { useState, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { BedDouble, ChevronRight, Plus, X, AlertTriangle, CheckCircle2 } from '@/components/icons/lucide';
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
    () => filterWard ? activeAdmissions.filter(a => a.wardId === filterWard) : activeAdmissions,
    [activeAdmissions, filterWard],
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
      <main className="page-container page-enter">
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

        {/* Census KPIs */}
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'stretch' }}>
          {[
            { label: t('ward.kpiTotalBeds'), value: totalBeds, accent: 'var(--accent-primary)', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.22)' },
            { label: t('ward.kpiOccupied'), value: occupiedBeds, accent: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.22)' },
            { label: t('ward.kpiAvailable'), value: availableBeds, accent: '#15795C', bg: 'rgba(27, 158, 119, 0.10)', border: 'rgba(27, 158, 119, 0.30)' },
            { label: t('ward.kpiOccupancy'), value: `${occupancyRate}%`, accent: occupancyRate > 90 ? '#C44536' : occupancyRate > 75 ? '#B8741C' : 'var(--accent-primary)', bg: occupancyRate > 90 ? 'rgba(196, 69, 54, 0.10)' : occupancyRate > 75 ? 'rgba(228, 168, 75, 0.12)' : 'rgba(59, 130, 246, 0.08)', border: occupancyRate > 90 ? 'rgba(196, 69, 54, 0.30)' : occupancyRate > 75 ? 'rgba(228, 168, 75, 0.30)' : 'rgba(59, 130, 246, 0.22)' },
          ].map(k => (
            <div key={k.label} style={{ padding: '14px 16px', borderRadius: 10, background: k.bg, border: `1px solid ${k.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: k.accent }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Ward grid */}
        <div className="dash-card mb-4">
          <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="font-semibold text-sm">{t('ward.wards')}</h3>
          </div>
          {facilityWards.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              {t('ward.noWardsConfigured', { facility: facilityName })}
            </div>
          ) : (
            <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'stretch' }}>
              {facilityWards.map(w => {
                const occ = w.totalBeds > 0 ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0;
                const accent = occ > 90 ? '#C44536' : occ > 75 ? '#B8741C' : '#15795C';
                return (
                  <button
                    key={w._id}
                    onClick={() => setFilterWard(filterWard === w._id ? '' : w._id)}
                    className="text-left"
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: filterWard === w._id ? 'var(--accent-light)' : 'var(--overlay-subtle)',
                      border: filterWard === w._id ? `1px solid var(--accent-primary)` : '1px solid var(--border-light)',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>{occ}%</span>
                    </div>
                    <div className="text-[11px] capitalize" style={{ color: 'var(--text-muted)' }}>{w.wardType.replace(/_/g, ' ')}</div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{w.occupiedBeds}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('ward.bedsOccupied', { count: w.totalBeds })}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                      <div style={{ width: `${occ}%`, height: '100%', background: accent }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active admissions */}
        <div className="dash-card">
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
            <div>
              <h3 className="font-semibold text-sm">{t('ward.currentAdmissions')}</h3>
              {filterWard && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)', marginTop: 1 }}>
                  {t('ward.filteredByWard')}<button onClick={() => setFilterWard('')} className="underline">{t('ward.clear')}</button>
                </p>
              )}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
              {t('ward.activeCount', { count: filteredAdmissions.length })}
            </span>
          </div>
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
                      <div className="data-row__value truncate">{a.patientName}</div>
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

        {/* Admit modal */}
        {admitOpen && (
          <div className="modal-backdrop" onClick={() => setAdmitOpen(false)}>
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
          </div>
        )}

        {/* Discharge modal */}
        {dischargeFor && (
          <div className="modal-backdrop" onClick={() => setDischargeFor(null)}>
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
          </div>
        )}
      </main>
    </>
  );
}
