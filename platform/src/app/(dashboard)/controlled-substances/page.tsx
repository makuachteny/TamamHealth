'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { Pill, Plus, X, UserCheck } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import {
  getAllMovements,
  recordMovement,
  type RecordMovementInput,
} from '@/lib/services/controlled-substance-service';
import type { ControlledSubstanceLogDoc } from '@/lib/db-types';

const SCHEDULES: ControlledSubstanceLogDoc['schedule'][] = ['I', 'II', 'III', 'IV', 'V'];
const MOVEMENTS: ControlledSubstanceLogDoc['movement'][] = ['intake', 'dispense', 'waste', 'reconciliation', 'transfer'];

const MOVEMENT_LABELS: Record<ControlledSubstanceLogDoc['movement'], string> = {
  intake: 'Intake',
  dispense: 'Dispense',
  waste: 'Waste',
  reconciliation: 'Reconciliation',
  transfer: 'Transfer',
};

/** Color per movement type for the small status pill. */
function movementColor(m: ControlledSubstanceLogDoc['movement']): string {
  switch (m) {
    case 'intake': return '#15795C';
    case 'dispense': return '#3b82f6';
    case 'waste': return '#C44536';
    case 'transfer': return '#B8741C';
    default: return 'var(--accent-primary)';
  }
}

/** Turn a free-typed witness name into a stable id so it differs from the operator. */
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const blankForm = {
  medicationName: '',
  schedule: 'II' as ControlledSubstanceLogDoc['schedule'],
  movement: 'dispense' as ControlledSubstanceLogDoc['movement'],
  quantity: '',
  unit: 'mg',
  beforeBalance: '',
  operatorName: '',
  witnessName: '',
  patientName: '',
  reason: '',
};

export default function ControlledSubstancesPage() {
  const { currentUser } = useApp();
  const { showToast } = useToast();

  const [movements, setMovements] = useState<ControlledSubstanceLogDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...blankForm });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAllMovements();
      setMovements(rows);
    } catch (err) {
      console.error(err);
      showToast('Failed to load controlled-substance log.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const openModal = () => {
    setForm({ ...blankForm, operatorName: currentUser?.name || '' });
    setOpen(true);
  };

  const facilityId = currentUser?.hospitalId || currentUser?.hospital?._id || '';
  const facilityName = currentUser?.hospital?.name || currentUser?.hospitalName || '';

  const handleSubmit = async () => {
    if (!currentUser) {
      showToast('You must be signed in to record a movement.', 'error');
      return;
    }
    const operatorId = currentUser._id || '';
    const witnessId = slugify(form.witnessName);
    if (!form.medicationName.trim()) {
      showToast('Medication name is required.', 'error');
      return;
    }
    if (!form.witnessName.trim()) {
      showToast('A witness is required for controlled-substance movements.', 'error');
      return;
    }
    if (operatorId && witnessId && operatorId === witnessId) {
      showToast('Operator and witness must be two different staff members.', 'error');
      return;
    }
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showToast('Movement quantity must be greater than zero.', 'error');
      return;
    }

    const input: RecordMovementInput = {
      inventoryId: `csub-${slugify(form.medicationName) || 'item'}`,
      medicationName: form.medicationName.trim(),
      schedule: form.schedule,
      movement: form.movement,
      quantity,
      unit: form.unit.trim() || 'unit',
      beforeBalance: Number(form.beforeBalance) || 0,
      operatorId,
      operatorName: form.operatorName.trim() || currentUser.name || '',
      witnessId,
      witnessName: form.witnessName.trim(),
      reason: form.reason.trim() || undefined,
      patientName: form.patientName.trim() || undefined,
      facilityId,
      facilityName,
    };

    setSaving(true);
    try {
      await recordMovement(input);
      showToast(`${MOVEMENT_LABELS[form.movement]} of ${input.medicationName} recorded.`, 'success');
      setOpen(false);
      setForm({ ...blankForm });
      await load();
    } catch (err) {
      // recordMovement throws on missing/duplicate signatories and bad math.
      const message = err instanceof Error ? err.message : 'Failed to record movement.';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Controlled Substances" />
      <main className="page-container page-enter">
        <PageHeader
          icon={Pill}
          title="Controlled Substance Register"
          subtitle="Two-signature audit log of every Schedule I–V drug movement, for regulatory compliance."
          actions={
            <button onClick={openModal} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Record movement
            </button>
          }
        />

        <div className="dash-card">
          <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-light)' }}>
            <span className="icon-box-sm" style={{ background: 'rgba(196, 69, 54, 0.12)' }}>
              <Pill className="w-4 h-4" style={{ color: '#C44536' }} />
            </span>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Movement log</h3>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
              {movements.length} {movements.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading log…</div>
          ) : movements.length === 0 ? (
            <div className="p-10 text-center">
              <span className="icon-box-sm mx-auto mb-3" style={{ background: 'rgba(196, 69, 54, 0.12)', display: 'inline-flex' }}>
                <Pill className="w-4 h-4" style={{ color: '#C44536' }} />
              </span>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No movements recorded yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Record the first controlled-substance movement to start the audit trail.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Schedule</th>
                    <th>Movement</th>
                    <th>Qty</th>
                    <th>Operator</th>
                    <th>Witness</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => {
                    const color = movementColor(m.movement);
                    return (
                      <tr key={m._id}>
                        <td className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{m.medicationName}</td>
                        <td>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}>
                            Sch {m.schedule}
                          </span>
                        </td>
                        <td>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: `${color}1A`, color, border: `1px solid ${color}40` }}>
                            {MOVEMENT_LABELS[m.movement]}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{m.quantity} {m.unit}</td>
                        <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.operatorName}</td>
                        <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.witnessName}</td>
                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.reason || '—'}</td>
                        <td className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                          {m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {open && (
          <Modal onClose={() => setOpen(false)}>
            <div className="modal-panel modal-panel--md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Record controlled-substance movement</h3>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Medication</label>
                  <input type="text" value={form.medicationName} onChange={e => setForm({ ...form, medicationName: e.target.value })} placeholder="e.g. Morphine sulfate" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Schedule</label>
                    <select value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value as ControlledSubstanceLogDoc['schedule'] })}>
                      {SCHEDULES.map(s => <option key={s} value={s}>Schedule {s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Movement</label>
                    <select value={form.movement} onChange={e => setForm({ ...form, movement: e.target.value as ControlledSubstanceLogDoc['movement'] })}>
                      {MOVEMENTS.map(m => <option key={m} value={m}>{MOVEMENT_LABELS[m]}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Quantity</label>
                    <input type="number" min={0} step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Unit</label>
                    <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="mg" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Before balance</label>
                    <input type="number" min={0} step="any" value={form.beforeBalance} onChange={e => setForm({ ...form, beforeBalance: e.target.value })} placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Patient (optional)</label>
                  <input type="text" value={form.patientName} onChange={e => setForm({ ...form, patientName: e.target.value })} placeholder="For dispense movements" />
                </div>

                <hr className="section-divider" />

                <div className="rounded-lg p-3" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-light)' }}>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                    <UserCheck className="w-3 h-3" /> Two-signature audit
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Operator</label>
                      <input type="text" value={form.operatorName} onChange={e => setForm({ ...form, operatorName: e.target.value })} placeholder="Operator name" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Witness</label>
                      <input type="text" value={form.witnessName} onChange={e => setForm({ ...form, witnessName: e.target.value })} placeholder="Witness name" />
                    </div>
                  </div>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                    The operator (you) and the witness must be two different staff members.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Reason (optional)</label>
                  <textarea rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason / notes for this movement" />
                </div>
              </div>

              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setOpen(false)} className="btn btn-secondary flex-1" disabled={saving}>Cancel</button>
                <button onClick={handleSubmit} className="btn btn-primary flex-1" disabled={saving}>
                  {saving ? 'Recording…' : 'Record movement'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </>
  );
}
