'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';
import type { PatientDoc } from '@/lib/db-types';
import type { CareAlertCategory } from '@/data/mock';
import { AlertTriangle, Plus, X } from '@/components/icons/lucide';

const CATEGORY_LABELS: Record<CareAlertCategory, string> = {
  clinical_risk: 'Clinical risk',
  safety: 'Safety',
  infection_control: 'Infection control',
  administrative: 'Administrative',
  other: 'Other',
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as CareAlertCategory[];

/**
 * Chart-permanent care alerts (P1.2). Active alerts render as a prominent
 * banner so patient-safety information (fall risk, difficult IV access, etc.)
 * is seen on every visit. Add and resolve inline; resolving requires a reason
 * (alerts are retained, never hard-deleted).
 */
export default function CareAlertsBanner({ patient, hideAddButton = false }: { patient: PatientDoc; hideAddButton?: boolean }) {
  const { currentUser } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState<{ category: CareAlertCategory; message: string; priority: 'high' | 'normal' }>(
    { category: 'clinical_risk', message: '', priority: 'high' },
  );

  const active = (patient.careAlerts ?? []).filter((a) => a.status === 'active');
  const author = { recordedBy: currentUser?._id, recordedByName: currentUser?.name || currentUser?.username };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setAdding(false);
      setResolvingId(null);
      setReason('');
      setForm({ category: 'clinical_risk', message: '', priority: 'high' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }
  async function doAdd() {
    const svc = await import('@/lib/services/care-alert-service');
    await svc.addCareAlert(patient._id, { ...form, ...author });
  }
  async function doResolve(id: string) {
    const svc = await import('@/lib/services/care-alert-service');
    await svc.resolveCareAlert(patient._id, id, reason);
  }

  // Nothing active and not composing → a slim "add" affordance only. When the
  // add control is hosted elsewhere (ChartSafetyActions toolbar), render nothing.
  if (active.length === 0 && !adding) {
    if (hideAddButton) return null;
    return (
      <div className="lg:col-span-3 lg:order-1 flex justify-end">
        <button className="btn btn-xs btn-secondary" onClick={() => setAdding(true)}>
          <Plus className="w-3 h-3" /> Add care alert
        </button>
      </div>
    );
  }

  return (
    <div className="lg:col-span-3 lg:order-1 space-y-2">
      {active.map((a) => {
        const high = a.priority === 'high';
        const bg = high ? 'rgba(229,46,66,0.12)' : 'rgba(217,119,6,0.12)';
        const color = high ? 'var(--color-danger)' : '#B45309';
        return (
          <div key={a.id} className="card-elevated p-3 flex items-center gap-3" style={{ background: bg, border: `1px solid ${color}40` }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#fff', color }}>{CATEGORY_LABELS[a.category]}</span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{a.message}</span>
              </div>
              {a.recordedByName && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Added by {a.recordedByName}</span>}
            </div>
            {resolvingId !== a.id ? (
              <button className="btn btn-xs btn-secondary flex-shrink-0" disabled={busy} onClick={() => setResolvingId(a.id)}>
                <X className="w-3 h-3" /> Resolve
              </button>
            ) : (
              <span className="inline-flex items-center gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Resolution reason"
                  className="p-1.5 rounded-md text-[12px]"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
                <button className="btn btn-xs btn-primary" disabled={busy || reason.trim().length === 0} onClick={() => run(() => doResolve(a.id))}>Confirm</button>
                <button className="btn btn-xs btn-secondary" disabled={busy} onClick={() => { setResolvingId(null); setReason(''); }}>Cancel</button>
              </span>
            )}
          </div>
        );
      })}

      {!adding ? (
        hideAddButton ? null : (
          <div className="flex justify-end">
            <button className="btn btn-xs btn-secondary" onClick={() => setAdding(true)}>
              <Plus className="w-3 h-3" /> Add care alert
            </button>
          </div>
        )
      ) : (
        <div className="card-elevated p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CareAlertCategory })}
              className="p-2 rounded-md text-[12px]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as 'high' | 'normal' })}
              className="p-2 rounded-md text-[12px]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              <option value="high">High priority</option>
              <option value="normal">Normal</option>
            </select>
          </div>
          <input
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Alert (e.g. High fall risk; do not use right arm for BP)"
            className="w-full p-2 rounded-md text-[13px]"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-2">
            <button className="btn btn-sm btn-primary" disabled={busy || form.message.trim().length === 0} onClick={() => run(doAdd)}>Save alert</button>
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px]" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
