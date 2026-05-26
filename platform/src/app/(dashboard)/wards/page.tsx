'use client';

import { useState, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { BedDouble, ChevronRight, Plus, X, AlertTriangle, CheckCircle2 } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useWards } from '@/lib/hooks/useWards';
import { useToast } from '@/components/Toast';
import type { AdmissionDoc } from '@/lib/db-types-ward';

export default function WardsPage() {
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
  const facilityName = currentUser?.hospital?.name || currentUser?.hospitalName || 'Facility';
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
      showToast('Select a patient and a ward', 'error');
      return;
    }
    if (!admitForm.admittingDiagnosis.trim()) {
      showToast('Admitting diagnosis is required', 'error');
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
      showToast(`Admitted ${patient.firstName} ${patient.surname} to ${ward.name}`, 'success');
      setAdmitOpen(false);
      setAdmitForm({ patientId: '', admittingDiagnosis: '', severity: 'moderate', wardId: '', bedNumber: '', isolationRequired: false });
    } catch (err) {
      console.error(err);
      showToast('Failed to admit patient', 'error');
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
      showToast(`Discharged ${dischargeFor.patientName}`, 'success');
      setDischargeFor(null);
      setDischargeForm({ dischargeType: 'normal', dischargeSummary: '', followUpRequired: false });
    } catch (err) {
      console.error(err);
      showToast('Failed to discharge patient', 'error');
    }
  };

  return (
    <>
      <TopBar title="Wards & Inpatient" />
      <main className="page-container page-enter">
        <PageHeader
          icon={BedDouble}
          title="Wards & Inpatient Care"
          subtitle={`${facilityName} · ${facilityWards.length} ${facilityWards.length === 1 ? 'ward' : 'wards'}`}
          actions={
            <button onClick={() => setAdmitOpen(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Admit Patient
            </button>
          }
        />

        {/* Census KPIs */}
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'stretch' }}>
          {[
            { label: 'Total Beds', value: totalBeds, accent: 'var(--accent-primary)', bg: 'rgba(27, 154, 170, 0.08)', border: 'rgba(27, 154, 170, 0.22)' },
            { label: 'Occupied', value: occupiedBeds, accent: '#1B9AAA', bg: 'rgba(27, 154, 170, 0.08)', border: 'rgba(27, 154, 170, 0.22)' },
            { label: 'Available', value: availableBeds, accent: '#15795C', bg: 'rgba(27, 158, 119, 0.10)', border: 'rgba(27, 158, 119, 0.30)' },
            { label: 'Occupancy', value: `${occupancyRate}%`, accent: occupancyRate > 90 ? '#C44536' : occupancyRate > 75 ? '#B8741C' : 'var(--accent-primary)', bg: occupancyRate > 90 ? 'rgba(196, 69, 54, 0.10)' : occupancyRate > 75 ? 'rgba(228, 168, 75, 0.12)' : 'rgba(27, 154, 170, 0.08)', border: occupancyRate > 90 ? 'rgba(196, 69, 54, 0.30)' : occupancyRate > 75 ? 'rgba(228, 168, 75, 0.30)' : 'rgba(27, 154, 170, 0.22)' },
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
            <h3 className="font-semibold text-sm">Wards</h3>
          </div>
          {facilityWards.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No wards configured for {facilityName}. Ask an administrator to set up wards in facility settings.
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
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {w.totalBeds} occupied</span>
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
              <h3 className="font-semibold text-sm">Current Admissions</h3>
              {filterWard && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)', marginTop: 1 }}>
                  Filtered by ward · <button onClick={() => setFilterWard('')} className="underline">clear</button>
                </p>
              )}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
              {filteredAdmissions.length} active
            </span>
          </div>
          {filteredAdmissions.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No active admissions{filterWard ? ' in this ward' : ''}.
            </div>
          ) : (
            <div>
              {filteredAdmissions.map(a => {
                const sev = a.severity === 'critical' ? '#C44536' : a.severity === 'severe' ? '#B8741C' : a.severity === 'moderate' ? '#1B9AAA' : '#15795C';
                const days = Math.max(1, Math.ceil((Date.now() - new Date(a.admissionDate).getTime()) / 86400000));
                return (
                  <div key={a._id} className="data-row">
                    <div className="data-row__icon" style={{ background: `${sev}1A`, color: sev }}>
                      <BedDouble className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="data-row__label">{a.wardName}{a.bedNumber ? ` · Bed ${a.bedNumber}` : ''}</div>
                      <div className="data-row__value truncate">{a.patientName}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {a.admittingDiagnosis} · day {days}
                        {a.isolationRequired && <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(196, 69, 54, 0.14)', color: '#8B2E24' }}>Isolation</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: `${sev}1A`, color: sev, border: `1px solid ${sev}40` }}>
                      {a.severity}
                    </span>
                    <button onClick={() => setDischargeFor(a)} className="btn btn-secondary btn-sm">Discharge <ChevronRight className="w-3 h-3" /></button>
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
                <h3 className="text-base font-semibold">Admit Patient</h3>
                <button onClick={() => setAdmitOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Patient *</label>
                  <select value={admitForm.patientId} onChange={e => setAdmitForm({ ...admitForm, patientId: e.target.value })}>
                    <option value="">Select patient…</option>
                    {patients.slice(0, 200).map(p => (
                      <option key={p._id} value={p._id}>{p.firstName} {p.surname} · {p.hospitalNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Admitting Diagnosis *</label>
                  <input type="text" value={admitForm.admittingDiagnosis} onChange={e => setAdmitForm({ ...admitForm, admittingDiagnosis: e.target.value })} placeholder="e.g. Severe malaria with anemia" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Severity</label>
                    <select value={admitForm.severity} onChange={e => setAdmitForm({ ...admitForm, severity: e.target.value as AdmissionDoc['severity'] })}>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Ward *</label>
                    <select value={admitForm.wardId} onChange={e => setAdmitForm({ ...admitForm, wardId: e.target.value })}>
                      <option value="">Select ward…</option>
                      {facilityWards.filter(w => w.availableBeds > 0).map(w => (
                        <option key={w._id} value={w._id}>{w.name} ({w.availableBeds} free)</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Bed Number</label>
                    <input type="text" value={admitForm.bedNumber} onChange={e => setAdmitForm({ ...admitForm, bedNumber: e.target.value })} placeholder="Optional" />
                  </div>
                  <label className="flex items-center gap-2 mt-5 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={admitForm.isolationRequired} onChange={e => setAdmitForm({ ...admitForm, isolationRequired: e.target.checked })} />
                    Isolation required
                  </label>
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setAdmitOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdmit} className="btn btn-primary flex-1">Admit</button>
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
                  <h3 className="text-base font-semibold">Discharge Patient</h3>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{dischargeFor.patientName} · {dischargeFor.wardName}</p>
                </div>
                <button onClick={() => setDischargeFor(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Discharge Type</label>
                  <select value={dischargeForm.dischargeType} onChange={e => setDischargeForm({ ...dischargeForm, dischargeType: e.target.value as NonNullable<AdmissionDoc['dischargeType']> })}>
                    <option value="normal">Normal</option>
                    <option value="against_medical_advice">Against medical advice</option>
                    <option value="transfer">Transfer to another facility</option>
                    <option value="death">Death</option>
                    <option value="absconded">Absconded</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Discharge Summary</label>
                  <textarea rows={3} value={dischargeForm.dischargeSummary} onChange={e => setDischargeForm({ ...dischargeForm, dischargeSummary: e.target.value })} placeholder="Brief summary of clinical course…" />
                </div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={dischargeForm.followUpRequired} onChange={e => setDischargeForm({ ...dischargeForm, followUpRequired: e.target.checked })} />
                  Follow-up appointment required
                </label>
                {dischargeForm.dischargeType === 'death' ? (
                  <div className="text-[12px] flex items-center gap-2" style={{ color: '#8B2E24' }}>
                    <AlertTriangle className="w-3.5 h-3.5" /> A death record will need to be created from the Deaths module.
                  </div>
                ) : (
                  <div className="text-[12px] flex items-center gap-2" style={{ color: '#15795C' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Bed will be released and queued for cleaning.
                  </div>
                )}
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setDischargeFor(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleDischarge} className="btn btn-primary flex-1">Discharge</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
