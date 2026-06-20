'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';
import type { PatientDoc } from '@/lib/db-types';
import type { DirectiveType } from '@/data/mock';
import { ShieldCheck, Plus, X } from '@/components/icons/lucide';

const TYPE_LABELS: Record<DirectiveType, string> = {
  informed_consent: 'Informed consent',
  abn_noncovered: 'Non-covered service (ABN)',
  privacy_consent: 'Privacy / communication consent',
  advance_directive: 'Advance directive',
  release_of_information: 'Release of information',
  other: 'Other',
};

const TYPE_OPTIONS = Object.keys(TYPE_LABELS) as DirectiveType[];

/**
 * Directives / consent list for the patient chart (P2.1). Mirrors the
 * Centricity Directives window: add informed consent, ABN, privacy and advance
 * directives once; they persist on the chart instead of being re-collected each
 * visit. Removal requires a reason (entries are revoked, never hard-deleted).
 */
export default function DirectiveList({ patient, hideAddButton = false }: { patient: PatientDoc; hideAddButton?: boolean }) {
  const { currentUser } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [form, setForm] = useState<{ type: DirectiveType; description: string; startDate: string }>(
    { type: 'informed_consent', description: '', startDate: '' },
  );

  const entries = patient.directives ?? [];
  const active = entries.filter((d) => d.status === 'active');
  const author = { recordedBy: currentUser?._id, recordedByName: currentUser?.name || currentUser?.username };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setAdding(false);
      setRemovingId(null);
      setRemovalReason('');
      setForm({ type: 'informed_consent', description: '', startDate: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function doAdd() {
    const svc = await import('@/lib/services/directive-service');
    await svc.addDirective(patient._id, { ...form, ...author });
  }
  async function doRemove(id: string) {
    const svc = await import('@/lib/services/directive-service');
    await svc.removeDirective(patient._id, id, removalReason);
  }

  const typeLabel = (t: DirectiveType) => TYPE_LABELS[t] || t;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <ShieldCheck className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} /> Directives &amp; consent
        </p>
        {!adding && !hideAddButton && (
          <button className="btn btn-xs btn-secondary" disabled={busy} onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {active.length === 0 && !adding && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No directives on file.</p>
      )}

      <ul className="space-y-1.5" style={{ maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
        {active.map((d) => (
          <li key={d.id} className="rounded-lg p-2.5" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{typeLabel(d.type)}</span>
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{d.description}</span>
              {d.startDate && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>· from {d.startDate}</span>}
              <span className="flex-1" />
              {removingId !== d.id && (
                <button className="btn btn-xs btn-secondary" disabled={busy} onClick={() => setRemovingId(d.id)}>
                  <X className="w-3 h-3" /> Revoke
                </button>
              )}
            </div>
            {removingId === d.id && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <input
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  placeholder="Reason for revoking (required)"
                  className="flex-1 min-w-[160px] p-1.5 rounded-md text-[12px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
                <button className="btn btn-xs btn-primary" disabled={busy || removalReason.trim().length === 0} onClick={() => run(() => doRemove(d.id))}>Confirm</button>
                <button className="btn btn-xs btn-secondary" disabled={busy} onClick={() => { setRemovingId(null); setRemovalReason(''); }}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-2 rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DirectiveType })}
            className="w-full p-2 rounded-md text-[12px]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (e.g. Consent to treat signed)"
            className="w-full p-2 rounded-md text-[13px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-2">
            <button className="btn btn-sm btn-primary" disabled={busy || form.description.trim().length === 0} onClick={() => run(doAdd)}>Save directive</button>
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px]" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
