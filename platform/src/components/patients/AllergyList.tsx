'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import type { PatientDoc } from '@/lib/db-types';
import type { AllergyEntry } from '@/data/mock';
import { AlertTriangle, Plus, X } from '@/components/icons/lucide';
import { isNoAllergySentinel } from '@/lib/clinical-roles';

const CRIT_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  severe: { bg: 'var(--color-danger-bg, rgba(196,69,54,0.12))', fg: 'var(--color-danger)', label: 'Severe' },
  moderate: { bg: 'rgba(217,119,6,0.12)', fg: '#B45309', label: 'Moderate' },
  mild: { bg: 'rgba(21,121,92,0.12)', fg: 'var(--color-success)', label: 'Mild' },
  unknown: { bg: 'var(--overlay-subtle)', fg: 'var(--text-muted)', label: 'Unknown' },
};

const CLASSIFICATIONS: AllergyEntry['classification'][] = ['drug', 'food', 'environmental', 'biologic', 'other'];
const CRITICALITIES: NonNullable<AllergyEntry['criticality']>[] = ['mild', 'moderate', 'severe', 'unknown'];

/**
 * Structured allergy list for the patient chart (P0.3). Add with substance,
 * classification, criticality and reaction; remove with a required reason
 * (entries are deactivated, never hard-deleted, to preserve the audit trail).
 */
export default function AllergyList({ patient, hideAddButton = false }: { patient: PatientDoc; hideAddButton?: boolean }) {
  const { currentUser } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [form, setForm] = useState<{ substance: string; classification: AllergyEntry['classification']; criticality: NonNullable<AllergyEntry['criticality']>; reaction: string; onsetDate: string }>(
    { substance: '', classification: 'drug', criticality: 'unknown', reaction: '', onsetDate: '' },
  );

  // Source of truth is structuredAllergies; fall back to a derived view from the
  // legacy string list for patients not yet migrated.
  const entries = useMemo<AllergyEntry[]>(() => {
    if (patient.structuredAllergies !== undefined) return patient.structuredAllergies;
    return (patient.allergies || [])
      .filter((a) => a && !isNoAllergySentinel(a))
      .map((substance) => ({ id: substance, substance, criticality: 'unknown' as const, status: 'active' as const, recordedAt: '' }));
  }, [patient.structuredAllergies, patient.allergies]);

  const active = entries.filter((e) => e.status === 'active');
  const author = { recordedBy: currentUser?._id, recordedByName: currentUser?.name || currentUser?.username };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setAdding(false);
      setRemovingId(null);
      setRemovalReason('');
      setForm({ substance: '', classification: 'drug', criticality: 'unknown', reaction: '', onsetDate: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function doAdd() {
    const svc = await import('@/lib/services/allergy-service');
    await svc.addAllergy(patient._id, { ...form, ...author });
  }
  async function doRemove(id: string) {
    const svc = await import('@/lib/services/allergy-service');
    await svc.removeAllergy(patient._id, id, removalReason);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <AlertTriangle className="w-3 h-3" style={{ color: 'var(--color-danger)' }} /> Allergies
        </p>
        {!adding && !hideAddButton && (
          <button className="btn btn-xs btn-secondary" disabled={busy} onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {active.length === 0 && !adding && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No known allergies recorded.</p>
      )}

      <ul className="space-y-1.5" style={{ maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
        {active.map((a) => {
          const cs = CRIT_STYLE[a.criticality || 'unknown'] || CRIT_STYLE.unknown;
          return (
            <li key={a.id} className="rounded-lg p-2.5" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{a.substance}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: cs.bg, color: cs.fg }}>{cs.label}</span>
                {a.classification && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>· {a.classification}</span>}
                <span className="flex-1" />
                {a.recordedAt && removingId !== a.id && (
                  <button className="btn btn-xs btn-secondary" disabled={busy} onClick={() => setRemovingId(a.id)}>
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>
              {a.reaction && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Reaction: {a.reaction}</p>}
              {removingId === a.id && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <input
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    placeholder="Reason for removal (required)"
                    className="flex-1 min-w-[160px] p-1.5 rounded-md text-[12px]"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                  />
                  <button className="btn btn-xs btn-primary" disabled={busy || removalReason.trim().length === 0} onClick={() => run(() => doRemove(a.id))}>Confirm</button>
                  <button className="btn btn-xs btn-secondary" disabled={busy} onClick={() => { setRemovingId(null); setRemovalReason(''); }}>Cancel</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="mt-2 rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <input
            value={form.substance}
            onChange={(e) => setForm({ ...form, substance: e.target.value })}
            placeholder="Substance (e.g. Penicillin)"
            className="w-full p-2 rounded-md text-[13px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value as AllergyEntry['classification'] })}
              className="p-2 rounded-md text-[12px]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as NonNullable<AllergyEntry['criticality']> })}
              className="p-2 rounded-md text-[12px]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input
            value={form.reaction}
            onChange={(e) => setForm({ ...form, reaction: e.target.value })}
            placeholder="Reaction (e.g. anaphylaxis, rash)"
            className="w-full p-2 rounded-md text-[13px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-2">
            <button className="btn btn-sm btn-primary" disabled={busy || form.substance.trim().length === 0} onClick={() => run(doAdd)}>Save allergy</button>
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px]" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
