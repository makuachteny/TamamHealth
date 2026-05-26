'use client';

/**
 * ProblemList — longitudinal "Active / Chronic / Resolved" problem panel
 * for one patient. The Storyboard sidebar and SBAR handoff both read from
 * the same source so a problem documented here propagates everywhere.
 *
 * Add flow: type-ahead against COMMON_ICD11_CODES so clinicians don't
 * invent free-text labels. Resolve flow: stamps resolvedDate and moves
 * the row into the resolved section without losing audit history.
 */

import { useMemo, useState } from 'react';
import {
  Plus, X, AlertTriangle, CheckCircle2, Activity, Search,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useProblems } from '@/lib/hooks/useProblems';
import { useToast } from '@/components/Toast';
import { COMMON_ICD11_CODES } from '@/lib/icd11-codes';
import type { ProblemStatus, ProblemDoc } from '@/lib/db-types';

interface ProblemListProps {
  patientId: string;
  patientName?: string;
}

const STATUS_TINT: Record<ProblemStatus, { bg: string; color: string; ring: string; label: string }> = {
  active:   { bg: 'rgba(196,69,54,0.10)',  color: 'var(--tamamhealth-red)', ring: 'rgba(196,69,54,0.20)', label: 'Active' },
  chronic:  { bg: 'rgba(124,58,237,0.10)', color: '#6D28D9',                ring: 'rgba(124,58,237,0.22)', label: 'Chronic' },
  inactive: { bg: 'rgba(100,116,139,0.10)',color: '#475569',                ring: 'rgba(100,116,139,0.22)', label: 'Inactive' },
  resolved: { bg: 'rgba(16,185,129,0.10)', color: '#047857',                ring: 'rgba(16,185,129,0.22)', label: 'Resolved' },
};

function ProblemRow({
  problem, onResolve, onReactivate,
}: {
  problem: ProblemDoc;
  onResolve?: (id: string) => void;
  onReactivate?: (id: string) => void;
}) {
  const tint = STATUS_TINT[problem.status];
  return (
    <li
      className="card-elevated p-3 flex items-start gap-3"
      style={{ borderColor: tint.ring }}
    >
      <div
        className="icon-box shrink-0"
        style={{ background: tint.bg, color: tint.color }}
      >
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {problem.name}
          </span>
          <span
            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ background: tint.bg, color: tint.color, letterSpacing: '0.06em' }}
          >
            {tint.label}
          </span>
          {problem.icd11Code && (
            <span
              className="text-[10.5px] font-medium"
              style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
            >
              ICD-11 · {problem.icd11Code}
            </span>
          )}
        </div>
        {(problem.onsetDate || problem.notes || problem.recordedByName) && (
          <div className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {problem.onsetDate && <span>Onset {problem.onsetDate}</span>}
            {problem.onsetDate && problem.recordedByName && <span> · </span>}
            {problem.recordedByName && <span>by {problem.recordedByName}</span>}
            {problem.notes && (
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{problem.notes}</p>
            )}
          </div>
        )}
        {problem.resolvedDate && (
          <div className="mt-1 text-[11px]" style={{ color: '#047857' }}>
            Resolved {problem.resolvedDate}
          </div>
        )}
      </div>
      {onResolve && (
        <button
          onClick={() => onResolve(problem._id)}
          className="text-xs font-bold inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-50 transition"
          style={{ color: '#047857' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
        </button>
      )}
      {onReactivate && (
        <button
          onClick={() => onReactivate(problem._id)}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          Reactivate
        </button>
      )}
    </li>
  );
}

export default function ProblemList({ patientId, patientName }: ProblemListProps) {
  const { currentUser } = useApp();
  const { active, resolved, problems, create, setStatus, loading } = useProblems(patientId);
  const { showToast } = useToast();

  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [pickedCode, setPickedCode] = useState<{ code: string; title: string; chapter: string } | null>(null);
  const [status, setStatusInput] = useState<ProblemStatus>('active');
  const [onsetDate, setOnsetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return COMMON_ICD11_CODES.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.keywords || []).some(k => k.includes(q))
    ).slice(0, 8);
  }, [search]);

  const reset = () => {
    setAdding(false);
    setSearch('');
    setPickedCode(null);
    setStatusInput('active');
    setOnsetDate('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!pickedCode) {
      showToast('Pick an ICD-11 code first', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await create({
        patientId,
        patientName,
        name: pickedCode.title,
        icd11Code: pickedCode.code,
        status,
        onsetDate: onsetDate || undefined,
        notes: notes.trim() || undefined,
        recordedBy: currentUser?._id || currentUser?.username,
        recordedByName: currentUser?.name,
        hospitalId: currentUser?.hospitalId,
        hospitalName: currentUser?.hospitalName,
        orgId: currentUser?.orgId,
      });
      showToast('Problem added to list', 'success');
      reset();
    } catch (err) {
      console.error(err);
      showToast('Failed to add problem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await setStatus(id, 'resolved');
      showToast('Problem resolved', 'success');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await setStatus(id, 'active');
      showToast('Problem reactivated', 'success');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-elevated p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="icon-box-lg" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <Activity className="w-5 h-5" style={{ color: '#7C3AED' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Problem List</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Longitudinal record. Anything here surfaces in the Storyboard sidebar and SBAR handoff.
            </p>
          </div>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn btn-primary inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add problem
          </button>
        )}
      </div>

      {/* Add panel */}
      {adding && (
        <div className="card-elevated overflow-hidden">
          <header
            className="px-5 py-3 border-b flex items-center justify-between gap-2"
            style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                <Plus className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New problem</h3>
            </div>
            <button onClick={reset} aria-label="Cancel" className="p-1 rounded hover:bg-gray-100">
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </header>
          <div className="p-5 space-y-4">
            {pickedCode ? (
              <div
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                style={{
                  background: 'var(--accent-light)',
                  border: '1px solid var(--border-accent)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {pickedCode.title}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    ICD-11 · {pickedCode.code} · {pickedCode.chapter}
                  </div>
                </div>
                <button
                  onClick={() => setPickedCode(null)}
                  className="text-xs font-semibold underline shrink-0"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase mb-1.5" style={{
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                }}>
                  Diagnosis
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full"
                    style={{ paddingLeft: 36 }}
                    placeholder="Search ICD-11 (e.g. malaria, tuberculosis, hypertension)"
                    autoFocus
                  />
                </div>
                {matches.length > 0 && (
                  <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg" style={{
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-card-solid)',
                  }}>
                    {matches.map(c => (
                      <li key={c.code}>
                        <button
                          type="button"
                          onClick={() => { setPickedCode({ code: c.code, title: c.title, chapter: c.chapter }); setSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                          style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {c.title}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {c.code} · {c.chapter}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase mb-1.5" style={{
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                }}>Status</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['active', 'chronic', 'inactive'] as const).map(s => {
                    const tint = STATUS_TINT[s];
                    const on = status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusInput(s)}
                        className="px-2 py-2 text-xs font-bold uppercase rounded transition-all"
                        style={{
                          background: on ? tint.bg : 'transparent',
                          color: on ? tint.color : 'var(--text-secondary)',
                          border: `1px solid ${on ? tint.color : 'var(--border-light)'}`,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {tint.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1.5" style={{
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                }}>Onset date</label>
                <input
                  type="date"
                  value={onsetDate}
                  onChange={(e) => setOnsetDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase mb-1.5" style={{
                color: 'var(--text-muted)', letterSpacing: '0.06em',
              }}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full"
                placeholder="Clinical context (optional)"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={reset} className="btn btn-secondary">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!pickedCode || submitting}
                className="btn btn-primary inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {submitting ? 'Saving…' : 'Add to list'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active + Chronic */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <h3 className="text-[11px] font-bold uppercase" style={{
            color: 'var(--text-secondary)', letterSpacing: '0.08em',
          }}>
            Active &amp; Chronic
          </h3>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>· {active.length}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
        </div>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : active.length === 0 ? (
          <div
            className="card-elevated p-5 text-center"
            style={{ borderStyle: 'dashed' }}
          >
            <div className="icon-box-lg mx-auto" style={{ background: 'var(--overlay-subtle)' }}>
              <Activity className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm font-medium mt-2" style={{ color: 'var(--text-secondary)' }}>
              No active problems on file.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Add one to start the longitudinal record.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map(p => (
              <ProblemRow key={p._id} problem={p} onResolve={handleResolve} />
            ))}
          </ul>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <h3 className="text-[11px] font-bold uppercase" style={{
              color: 'var(--text-secondary)', letterSpacing: '0.08em',
            }}>
              Resolved
            </h3>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>· {resolved.length}</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
          </div>
          <ul className="space-y-2">
            {resolved.map(p => (
              <ProblemRow key={p._id} problem={p} onReactivate={handleReactivate} />
            ))}
          </ul>
        </section>
      )}

      {!loading && problems.length === 0 && !adding && (
        <p className="text-[11.5px] italic px-1" style={{ color: 'var(--text-muted)' }}>
          Tip: the problem list is what makes care continuous across visits and shifts. Items added here
          surface in the Storyboard sidebar and SBAR handoff for every clinician who opens this chart.
        </p>
      )}
    </div>
  );
}
