'use client';

import { useState, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { Package, Plus, X, Search, AlertTriangle, CheckCircle2, Clock, Settings as Wrench } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useAssets } from '@/lib/hooks/useAssets';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { AssetDoc, AssetCategory, AssetStatus } from '@/lib/db-types-asset';

const CATEGORIES: { id: AssetCategory; labelKey: string }[] = [
  { id: 'medical_equipment', labelKey: 'equipment.categoryMedicalEquipment' },
  { id: 'imaging', labelKey: 'equipment.categoryImaging' },
  { id: 'lab', labelKey: 'equipment.categoryLab' },
  { id: 'surgical', labelKey: 'equipment.categorySurgical' },
  { id: 'vehicle', labelKey: 'equipment.categoryVehicle' },
  { id: 'it', labelKey: 'equipment.categoryIt' },
  { id: 'furniture', labelKey: 'equipment.categoryFurniture' },
  { id: 'utility', labelKey: 'equipment.categoryUtility' },
  { id: 'cold_chain', labelKey: 'equipment.categoryColdChain' },
  { id: 'other', labelKey: 'equipment.categoryOther' },
];

const STATUS_TOKENS: Record<AssetStatus, { labelKey: string; color: string; bg: string }> = {
  operational:    { labelKey: 'equipment.statusOperational',     color: '#15795C', bg: 'rgba(27, 158, 119, 0.12)' },
  needs_service:  { labelKey: 'equipment.statusNeedsService',   color: '#B8741C', bg: 'rgba(228, 168, 75, 0.16)' },
  under_repair:   { labelKey: 'equipment.statusUnderRepair',    color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  decommissioned: { labelKey: 'equipment.statusDecommissioned',  color: '#5A7370', bg: 'rgba(90, 115, 112, 0.14)' },
  lost_or_stolen: { labelKey: 'equipment.statusLostOrStolen',   color: '#C44536', bg: 'rgba(196, 69, 54, 0.14)' },
};

export default function AssetsPage() {
  const { currentUser } = useApp();
  const { assets, summary, create, setStatus, logService } = useAssets();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [filter, setFilter] = useState<AssetCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('');
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [serviceFor, setServiceFor] = useState<AssetDoc | null>(null);

  const [form, setForm] = useState({
    name: '', assetTag: '', serialNumber: '', category: 'medical_equipment' as AssetCategory,
    manufacturer: '', model: '', department: '', location: '',
    condition: 'good' as AssetDoc['condition'],
    cost: 0, costCurrency: 'SSP', donor: '',
    warrantyExpiresAt: '', serviceIntervalMonths: 12,
    notes: '',
  });

  const [serviceForm, setServiceForm] = useState({ type: 'service' as 'inspection' | 'repair' | 'calibration' | 'service', notes: '', cost: 0 });

  const facility = useMemo(() => ({
    id: currentUser?.hospitalId || '',
    name: currentUser?.hospitalName || 'Facility',
    level: 'county' as AssetDoc['facilityLevel'],
  }), [currentUser]);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (filter && a.category !== filter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (
          !a.name.toLowerCase().includes(needle) &&
          !a.assetTag.toLowerCase().includes(needle) &&
          !(a.serialNumber || '').toLowerCase().includes(needle) &&
          !(a.location || '').toLowerCase().includes(needle)
        ) return false;
      }
      return true;
    });
  }, [assets, filter, statusFilter, q]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.assetTag.trim()) {
      showToast(t('equipment.toastNameTagRequired'), 'error');
      return;
    }
    if (!facility.id) {
      showToast(t('equipment.toastNoFacility'), 'error');
      return;
    }
    try {
      await create({
        ...form,
        facilityId: facility.id,
        facilityName: facility.name,
        facilityLevel: facility.level,
        cost: form.cost || undefined,
        warrantyExpiresAt: form.warrantyExpiresAt || undefined,
        createdBy: currentUser?._id || currentUser?.username,
        createdByName: currentUser?.name,
      });
      showToast(t('equipment.toastRegistered', { name: form.name }), 'success');
      setCreateOpen(false);
      setForm({ name: '', assetTag: '', serialNumber: '', category: 'medical_equipment', manufacturer: '', model: '', department: '', location: '', condition: 'good', cost: 0, costCurrency: 'SSP', donor: '', warrantyExpiresAt: '', serviceIntervalMonths: 12, notes: '' });
    } catch (err) {
      console.error(err);
      showToast(t('equipment.toastRegisterFailed'), 'error');
    }
  };

  const handleLogService = async () => {
    if (!serviceFor || !currentUser) return;
    if (!serviceForm.notes.trim()) {
      showToast(t('equipment.toastServiceNoteRequired'), 'error');
      return;
    }
    try {
      await logService(serviceFor._id, {
        type: serviceForm.type,
        notes: serviceForm.notes.trim(),
        cost: serviceForm.cost || undefined,
        performedBy: currentUser._id || currentUser.username || 'unknown',
        performedByName: currentUser.name,
      });
      showToast(t('equipment.toastLogged', { type: serviceForm.type, name: serviceFor.name }), 'success');
      setServiceFor(null);
      setServiceForm({ type: 'service', notes: '', cost: 0 });
    } catch (err) {
      console.error(err);
      showToast(t('equipment.toastLogFailed'), 'error');
    }
  };

  return (
    <>
      <TopBar title={t('equipment.topBarTitle')} />
      <main className="page-container page-enter">
        <PageHeader
          icon={Package}
          title={t('equipment.pageTitle')}
          subtitle={t('equipment.pageSubtitle', { facility: facility.name, count: summary?.total ?? 0 })}
          actions={
            <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('equipment.registerAsset')}
            </button>
          }
        />

        {/* KPI strip */}
        {summary && (
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch' }}>
            {[
              { label: t('equipment.kpiTotal'), value: summary.total, accent: 'var(--accent-primary)', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.22)' },
              { label: t('equipment.kpiOperational'), value: summary.operational, accent: '#15795C', bg: 'rgba(27, 158, 119, 0.10)', border: 'rgba(27, 158, 119, 0.26)' },
              { label: t('equipment.kpiNeedsService'), value: summary.needsService, accent: '#B8741C', bg: 'rgba(228, 168, 75, 0.12)', border: 'rgba(228, 168, 75, 0.30)' },
              { label: t('equipment.kpiUnderRepair'), value: summary.underRepair, accent: '#3b82f6', bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.26)' },
              { label: t('equipment.kpiServiceDueSoon'), value: summary.serviceDueSoon, accent: '#C44536', bg: 'rgba(196, 69, 54, 0.10)', border: 'rgba(196, 69, 54, 0.26)' },
            ].map(k => (
              <div key={k.label} style={{ padding: '14px 16px', borderRadius: 10, background: k.bg, border: `1px solid ${k.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: k.accent }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + filters */}
        <div className="dash-card p-3 mb-3">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input className="pl-9 search-icon-input" placeholder={t('equipment.searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} style={{ background: 'var(--overlay-subtle)' }} />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value as AssetCategory | '')} className="text-sm">
              <option value="">{t('equipment.allCategories')}</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as AssetStatus | '')} className="text-sm">
              <option value="">{t('equipment.allStatuses')}</option>
              {(Object.entries(STATUS_TOKENS) as [AssetStatus, typeof STATUS_TOKENS[AssetStatus]][]).map(([id, tok]) => (
                <option key={id} value={id}>{t(tok.labelKey)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Asset table */}
        <div className="dash-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('equipment.colAsset')}</th>
                <th>{t('equipment.colCategory')}</th>
                <th>{t('equipment.colLocation')}</th>
                <th>{t('equipment.colStatus')}</th>
                <th>{t('equipment.colService')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>{t('equipment.noAssetsMatch')}</td></tr>
              )}
              {filtered.map(a => {
                const tok = STATUS_TOKENS[a.status];
                const dueSoon = a.nextServiceDueAt && (new Date(a.nextServiceDueAt).getTime() - Date.now()) < 30 * 86400000;
                return (
                  <tr key={a._id}>
                    <td>
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{a.name}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {t('equipment.tagLabel')} <span className="font-mono">{a.assetTag}</span>{a.serialNumber ? ` · ${t('equipment.snLabel')} ${a.serialNumber}` : ''}
                      </div>
                    </td>
                    <td className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{(() => { const cat = CATEGORIES.find(c => c.id === a.category); return cat ? t(cat.labelKey) : a.category; })()}</td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {a.department || '—'}
                      {a.location && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.location}</div>}
                    </td>
                    <td>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: tok.bg, color: tok.color, border: `1px solid ${tok.color}40` }}>
                        {t(tok.labelKey)}
                      </span>
                    </td>
                    <td className="text-xs">
                      {a.nextServiceDueAt ? (
                        <span style={{ color: dueSoon ? '#C44536' : 'var(--text-secondary)' }} className="inline-flex items-center gap-1">
                          {dueSoon ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {a.nextServiceDueAt}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary btn-sm" onClick={() => setServiceFor(a)} title={t('equipment.logServiceTitle')}><Wrench className="w-3 h-3" /></button>
                        {a.status !== 'operational' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setStatus(a._id, 'operational', { id: currentUser?._id || 'unknown', name: currentUser?.name || 'Staff' })} title={t('equipment.markOperationalTitle')}>
                            <CheckCircle2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Register modal */}
        {createOpen && (
          <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-2xl w-full" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('equipment.registerModalTitle')}</h3>
                <button onClick={() => setCreateOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelName')}</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('equipment.placeholderName')} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelAssetTag')}</label>
                  <input value={form.assetTag} onChange={e => setForm({ ...form, assetTag: e.target.value })} placeholder="JTH-US-001" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelCategory')}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as AssetCategory })}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelCondition')}</label>
                  <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value as AssetDoc['condition'] })}>
                    <option value="new">{t('equipment.conditionNew')}</option><option value="good">{t('equipment.conditionGood')}</option><option value="fair">{t('equipment.conditionFair')}</option><option value="poor">{t('equipment.conditionPoor')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelManufacturer')}</label>
                  <input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelModel')}</label>
                  <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelSerialNumber')}</label>
                  <input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelDepartment')}</label>
                  <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder={t('equipment.placeholderDepartment')} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelLocation')}</label>
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={t('equipment.placeholderLocation')} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelDonor')}</label>
                  <input value={form.donor} onChange={e => setForm({ ...form, donor: e.target.value })} placeholder={t('equipment.placeholderDonor')} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelCost', { currency: form.costCurrency })}</label>
                  <input type="number" min={0} value={form.cost || ''} onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelWarrantyExpires')}</label>
                  <input type="date" value={form.warrantyExpiresAt} onChange={e => setForm({ ...form, warrantyExpiresAt: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelServiceInterval')}</label>
                  <input type="number" min={0} value={form.serviceIntervalMonths || ''} onChange={e => setForm({ ...form, serviceIntervalMonths: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelNotes')}</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setCreateOpen(false)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                <button onClick={handleCreate} className="btn btn-primary flex-1">{t('equipment.register')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Maintenance modal */}
        {serviceFor && (
          <div className="modal-backdrop" onClick={() => setServiceFor(null)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold">{t('equipment.logServiceTitle')}</h3>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{serviceFor.name} · {t('equipment.tagLabel')} {serviceFor.assetTag}</p>
                </div>
                <button onClick={() => setServiceFor(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelType')}</label>
                  <select value={serviceForm.type} onChange={e => setServiceForm({ ...serviceForm, type: e.target.value as typeof serviceForm.type })}>
                    <option value="inspection">{t('equipment.serviceTypeInspection')}</option>
                    <option value="service">{t('equipment.serviceTypeRoutine')}</option>
                    <option value="repair">{t('equipment.serviceTypeRepair')}</option>
                    <option value="calibration">{t('equipment.serviceTypeCalibration')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelServiceCost')}</label>
                  <input type="number" min={0} value={serviceForm.cost || ''} onChange={e => setServiceForm({ ...serviceForm, cost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('equipment.labelServiceNotes')}</label>
                  <textarea rows={3} value={serviceForm.notes} onChange={e => setServiceForm({ ...serviceForm, notes: e.target.value })} placeholder={t('equipment.placeholderServiceNotes')} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setServiceFor(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                <button onClick={handleLogService} className="btn btn-primary flex-1">{t('equipment.saveLog')}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
