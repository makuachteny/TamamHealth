'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '@/components/Modal';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { Droplets, Plus, X } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { getAllUnits, addUnit } from '@/lib/services/blood-bank-service';
import type { BloodBankDoc } from '@/lib/db-types';

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

const STATUS_BADGE: Record<BloodBankDoc['status'], string> = {
  available: 'badge-normal',
  reserved: 'badge-warning',
  crossmatched: 'badge-warning',
  transfused: 'badge-normal',
  expired: 'badge-emergency',
  discarded: 'badge-emergency',
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
      <main className="page-container page-enter">
        <PageHeader
          icon={Droplets}
          title="Blood Bank"
          subtitle={`Register, track and stock blood units at ${facilityName}`}
          actions={
            <button onClick={openModal} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Add unit
            </button>
          }
        />

        {/* Availability by blood group — one tile per group, count of AVAILABLE units */}
        <div className="dash-card mb-4">
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="font-semibold text-sm">Availability by blood group</h3>
          </div>
          <div className="p-4 grid grid-cols-4 sm:grid-cols-8 gap-3">
            {BLOOD_GROUPS.map(g => {
              const count = availableByGroup[g] || 0;
              const color = count === 0 ? 'var(--color-danger)' : count <= 2 ? 'var(--color-warning)' : 'var(--color-success)';
              return (
                <div
                  key={g}
                  className="rounded-xl p-3 text-center"
                  style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent-primary)' }}>{g}</div>
                  <div className="text-2xl font-bold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>available</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Units table */}
        <div className="dash-card">
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-sm">Blood units</h3>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                {units.length} total
              </span>
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : units.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No blood units stocked yet. Use “Add unit” to register one.
            </div>
          ) : (
            <table className="data-table">
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
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.collectionDate}</td>
                      <td className="text-xs font-medium" style={{ color: expiryColor }}>
                        {u.expiryDate}
                        {expired ? ' · expired' : expiringSoon ? ` · ${days}d left` : ''}
                      </td>
                      <td>
                        <span className={`badge text-[10px] ${STATUS_BADGE[u.status]}`}>{u.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Add unit modal */}
        {open && (
          <Modal onClose={() => setOpen(false)}>
            <div className="modal-panel modal-panel--md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
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
