'use client';

/**
 * Conditions tab content — OpenMRS-style table (Condition / Date of onset /
 * Status) with a "Show: Active/Inactive/All" filter. Reuses the SAME
 * `useProblems` hook + `create()` service call ProblemList uses internally,
 * and the SAME ICD-11 coded-search add pattern (CodedSearchField +
 * COMMON_ICD11_CODES) — no new data layer. The full ProblemList widget still
 * lives on the Facesheet view; this tab is the OpenMRS-shaped read+add view.
 */

import { useMemo, useState } from 'react';
import ChartSection, { OmrsEmptyState } from '../ChartSection';
import CodedSearchField from '@/components/CodedSearchField';
import Modal from '@/components/Modal';
import { X } from '@/components/icons/lucide';
import { useToast } from '@/components/Toast';
import { useApp } from '@/lib/context';
import { useProblems } from '@/lib/hooks/useProblems';
import { COMMON_ICD11_CODES } from '@/lib/icd11-codes';
import { formatDate } from '@/lib/format-utils';
import type { ProblemStatus } from '@/lib/db-types';

type ShowFilter = 'active' | 'inactive' | 'all';

const STATUS_BADGE: Record<ProblemStatus, string> = {
  active: 'omrs-panel-badge omrs-panel-badge--active',
  chronic: 'omrs-panel-badge omrs-panel-badge--active',
  resolved: 'omrs-panel-badge omrs-panel-badge--done',
  inactive: 'omrs-panel-badge omrs-panel-badge--muted',
};

interface ConditionsSectionProps {
  patientId: string;
  patientName: string;
}

export default function ConditionsSection({ patientId, patientName }: ConditionsSectionProps) {
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const { problems, create } = useProblems(patientId);
  const [show, setShow] = useState<ShowFilter>('active');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [pickedCode, setPickedCode] = useState<{ code: string; title: string; chapter: string } | null>(null);
  const [onsetDate, setOnsetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const icdOptions = useMemo(() => COMMON_ICD11_CODES.map(c => ({ code: c.code, name: c.title, meta: c.chapter, keywords: c.keywords })), []);

  const filtered = useMemo(() => {
    if (show === 'active') return problems.filter(p => p.status === 'active' || p.status === 'chronic');
    if (show === 'inactive') return problems.filter(p => p.status === 'resolved' || p.status === 'inactive');
    return problems;
  }, [problems, show]);

  const resetForm = () => { setSearch(''); setPickedCode(null); setOnsetDate(''); setAdding(false); };

  const handleSubmit = async () => {
    if (!pickedCode) { showToast('Pick a diagnosis first', 'error'); return; }
    try {
      setSubmitting(true);
      await create({
        patientId,
        patientName,
        name: pickedCode.title,
        icd11Code: pickedCode.code,
        status: 'active',
        onsetDate: onsetDate || undefined,
        recordedBy: currentUser?._id || currentUser?.username,
        recordedByName: currentUser?.name,
        hospitalId: currentUser?.hospitalId,
        hospitalName: currentUser?.hospitalName,
        orgId: currentUser?.orgId,
      });
      showToast('Condition added', 'success');
      resetForm();
    } catch (err) {
      console.error(err);
      showToast('Could not add this condition. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filterSlot = (
    <label className="omrs-section-filter">
      Show:
      <select value={show} onChange={e => setShow(e.target.value as ShowFilter)}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All</option>
      </select>
    </label>
  );

  return (
    <>
      <ChartSection title="Conditions" addLabel="Add" onAdd={() => setAdding(true)} filterSlot={filterSlot}>
        {filtered.length === 0 ? (
          <OmrsEmptyState itemLabel="conditions" actionLabel="Record conditions" onAction={() => setAdding(true)} />
        ) : (
          <table className="omrs-table">
            <thead>
              <tr>
                <th>Condition</th>
                <th>Date of onset</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600 }}>{p.name}{p.icd11Code ? <span style={{ color: 'var(--ehr-muted, #8395A8)', fontWeight: 400 }}> · {p.icd11Code}</span> : null}</td>
                  <td>{p.onsetDate ? formatDate(p.onsetDate) : '—'}</td>
                  <td><span className={STATUS_BADGE[p.status]}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartSection>

      {adding && (
        <Modal onClose={() => !submitting && resetForm()} width={480} labelledBy="add-condition-title">
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center justify-between">
              <h2 id="add-condition-title" className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Add condition</h2>
              <button className="p-1 rounded" onClick={() => !submitting && resetForm()} style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
            </div>
            {pickedCode ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-accent)' }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{pickedCode.title}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>ICD-11 · {pickedCode.code} · {pickedCode.chapter}</div>
                </div>
                <button onClick={() => setPickedCode(null)} className="text-xs font-semibold underline shrink-0" style={{ color: 'var(--accent-primary)' }}>Change</button>
              </div>
            ) : (
              <CodedSearchField
                label="Diagnosis"
                placeholder="Search ICD-11 diagnoses…"
                options={icdOptions}
                value={search}
                onChange={setSearch}
                onSelect={c => { setPickedCode({ code: c.code, title: c.name, chapter: c.meta || '' }); setSearch(''); }}
                autoFocus
              />
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Date of onset</label>
              <input
                type="date"
                value={onsetDate}
                onChange={e => setOnsetDate(e.target.value)}
                className="w-full p-2.5 rounded-md text-[13px]"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button className="btn btn-sm btn-secondary" disabled={submitting} onClick={resetForm}>Cancel</button>
              <button className="btn btn-sm btn-primary" disabled={submitting || !pickedCode} onClick={handleSubmit}>
                {submitting ? 'Saving…' : 'Save condition'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
