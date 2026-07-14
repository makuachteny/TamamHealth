'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '@/components/Modal';
import TopBar from '@/components/TopBar';
import { Droplets, Plus, X } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { getAllUnits, addUnit } from '@/lib/services/blood-bank-service';
import type { BloodBankDoc } from '@/lib/db-types';
import Badge, { type BadgeTone } from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/lib/format-utils';
import EhrListHeader, { LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';

const BLOOD_GROUPS: BloodBankDoc['bloodGroup'][] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMPONENTS: { value: BloodBankDoc['component']; label: string }[] = [
  { value: 'whole_blood', label: 'Whole blood' },
  { value: 'packed_rbc', label: 'Packed RBC' },
  { value: 'platelets', label: 'Platelets' },
  { value: 'ffp', label: 'Fresh frozen plasma' },
  { value: 'cryoprecipitate', label: 'Cryoprecipitate' },
];

const COMPONENT_LABEL: Record<BloodBankDoc['component'], string> =
  Object.fromEntries(COMPONENTS.map(c => [c.value, c.label])) as Record<BloodBankDoc['component'], string>;

// Unit status → semantic Badge tone (available→success, reserved/crossmatched→
// warning, transfused→neutral, expired/discarded→danger).
const STATUS_TONE: Record<BloodBankDoc['status'], BadgeTone> = {
  available: 'success',
  reserved: 'warning',
  crossmatched: 'warning',
  transfused: 'neutral',
  expired: 'danger',
  discarded: 'danger',
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysUntil = (date: string) =>
  Math.ceil((new Date(date).getTime() - new Date(todayStr()).getTime()) / 86400000);

export default function BloodBankPage() {
  const { currentUser } = useApp();
  const { showToast } = useToast();

  const [units, setUnits] = useState<BloodBankDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const facilityId = currentUser?.hospitalId || '';
  const facilityName = currentUser?.hospitalName || 'Facility';

  const suggestUnitId = useCallback(
    () => `BU-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    [],
  );

  const emptyForm = useCallback(() => ({
    unitId: suggestUnitId(),
    bloodGroup: 'O+' as BloodBankDoc['bloodGroup'],
    component: 'whole_blood' as BloodBankDoc['component'],
    volume: 450,
    collectionDate: todayStr(),
    expiryDate: new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10),
    donorName: '',
    notes: '',
  }), [suggestUnitId]);

  const [form, setForm] = useState(emptyForm);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllUnits();
      setUnits(all);
    } catch (err) {
      console.error(err);
      showToast('Failed to load blood units', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  // Available-unit counts per blood group (client-side from getAllUnits so the
  // summary tiles always match the table, regardless of the summary helper shape).
  const availableByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of BLOOD_GROUPS) counts[g] = 0;
    const now = new Date();
    for (const u of units) {
      if (u.status === 'available' && new Date(u.expiryDate) > now) {
        counts[u.bloodGroup] = (counts[u.bloodGroup] || 0) + 1;
      }
    }
    return counts;
  }, [units]);

  // Header stat chips — computed from the units already loaded on this page.
  const unitStats = useMemo(() => {
    const now = new Date();
    let available = 0, reserved = 0, expiringSoon = 0;
    for (const u of units) {
      if (u.status === 'available') available += 1;
      if (u.status === 'reserved' || u.status === 'crossmatched') reserved += 1;
      const days = daysUntil(u.expiryDate);
      if (u.status !== 'expired' && u.status !== 'discarded' && u.status !== 'transfused' && new Date(u.expiryDate) >= now && days <= 7) {
        expiringSoon += 1;
      }
    }
    return { total: units.length, available, reserved, expiringSoon };
  }, [units]);

  const openModal = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const handleAdd = async () => {
    if (!form.unitId.trim()) {
      showToast('Unit ID is required', 'error');
      return;
    }
    if (!form.collectionDate || !form.expiryDate) {
      showToast('Collection and expiry dates are required', 'error');
      return;
    }
    if (!facilityId) {
      showToast('No facility assigned to your account', 'error');
      return;
    }
    try {
      await addUnit({
        unitId: form.unitId.trim(),
        bloodGroup: form.bloodGroup,
        component: form.component,
        volume: form.volume,
        collectionDate: form.collectionDate,
        expiryDate: form.expiryDate,
        donorName: form.donorName.trim() || undefined,
        status: 'available',
        facilityId,
        facilityName,
        notes: form.notes.trim() || undefined,
      });
      showToast(`Blood unit ${form.unitId.trim()} stocked`, 'success');
      setOpen(false);
      await loadUnits();
    } catch (err) {
      console.error(err);
      showToast('Failed to stock blood unit', 'error');
    }
  };

  return (
    <>
      <TopBar title="Blood Bank" />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* Availability by blood group — one tile per group, count of AVAILABLE units */}
        <div className="dash-card mb-4">
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="font-semibold text-sm">Availability by blood group</h3>
          </div>
          <div className="p-3 overflow-x-auto">
            <table className="w-full text-center" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {BLOOD_GROUPS.map((g, i) => (
                    <th
                      key={g}
                      className="text-[11px] font-bold uppercase tracking-wider px-2 py-1.5"
                      style={{ color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-light)', borderLeft: i === 0 ? undefined : '1px solid var(--border-light)' }}
                    >
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {BLOOD_GROUPS.map((g, i) => {
                    const count = availableByGroup[g] || 0;
                    const color = count === 0 ? 'var(--color-danger)' : count <= 2 ? 'var(--color-warning)' : 'var(--color-success)';
                    return (
                      <td
                        key={g}
                        className="text-base font-bold px-2 py-2"
                        style={{ color, fontVariantNumeric: 'tabular-nums', borderLeft: i === 0 ? undefined : '1px solid var(--border-light)' }}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Units table */}
        <div className="dash-card flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          <EhrListHeader
            title="Blood units"
            stats={[
              { label: 'Units', value: unitStats.total, color: LIST_STAT_COLORS.muted },
              { label: 'Available', value: unitStats.available, color: LIST_STAT_COLORS.blue },
              { label: 'Reserved', value: unitStats.reserved, color: LIST_STAT_COLORS.amber },
              { label: 'Expiring ≤7d', value: unitStats.expiringSoon, color: LIST_STAT_COLORS.green },
            ]}
            actions={
              <button onClick={openModal} className="btn btn-primary" style={{ height: 38, whiteSpace: 'nowrap' }}>
                <Plus className="w-4 h-4" /> Add unit
              </button>
            }
          />
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : units.length === 0 ? (
            <EmptyState
              icon={Droplets}
              title="No blood units stocked yet"
              message="Use “Add unit” to register one."
            />
          ) : (
            <table className="data-table" style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  <th>Unit ID</th>
                  <th>Blood group</th>
                  <th>Component</th>
                  <th>Volume (ml)</th>
                  <th>Collected</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map(u => {
                  const days = daysUntil(u.expiryDate);
                  const expired = u.status === 'expired' || days < 0;
                  const expiringSoon = !expired && days < 7;
                  const expiryColor = expired ? 'var(--color-danger)' : expiringSoon ? 'var(--color-warning)' : 'var(--text-muted)';
                  return (
                    <tr key={u._id}>
                      <td className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{u.unitId}</td>
                      <td>
                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                          {u.bloodGroup}
                        </span>
                      </td>
                      <td className="text-sm">{COMPONENT_LABEL[u.component] || u.component}</td>
                      <td className="text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>{u.volume}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(u.collectionDate)}</td>
                      <td className="text-xs font-medium" style={{ color: expiryColor }}>
                        {formatDate(u.expiryDate)}
                        {expired ? ' · expired' : expiringSoon ? ` · ${days}d left` : ''}
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          </div>
        </div>

        {/* Add unit modal */}
        {open && (
          <Modal onClose={() => setOpen(false)}>
            <div className="modal-panel modal-panel--md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="icon-box-sm">
                    <Droplets className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <h3 className="text-base font-semibold">Add blood unit</h3>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Unit ID</label>
                  <input
                    type="text"
                    value={form.unitId}
                    onChange={e => setForm({ ...form, unitId: e.target.value })}
                    placeholder="BU-2026-XXXXX"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Blood group</label>
                    <select value={form.bloodGroup} onChange={e => setForm({ ...form, bloodGroup: e.target.value as BloodBankDoc['bloodGroup'] })}>
                      {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Component</label>
                    <select value={form.component} onChange={e => setForm({ ...form, component: e.target.value as BloodBankDoc['component'] })}>
                      {COMPONENTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Volume (ml)</label>
                    <input
                      type="number"
                      min={1}
                      value={form.volume || ''}
                      onChange={e => setForm({ ...form, volume: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Donor name</label>
                    <input
                      type="text"
                      value={form.donorName}
                      onChange={e => setForm({ ...form, donorName: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Collection date</label>
                    <input type="date" value={form.collectionDate} onChange={e => setForm({ ...form, collectionDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Expiry date</label>
                    <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdd} className="btn btn-primary flex-1">Stock unit</button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </>
  );
}
