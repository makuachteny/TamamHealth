'use client';

/**
 * Results tab content — OpenMRS-style lab results table. Reads from the same
 * `useLabResults()` collection the Order Basket drawer panel and
 * OrderLabModal already write to (switched from the legacy per-visit
 * `record.labResults` embed so newly-ordered labs actually show up here).
 * "Add" reuses the existing OrderLabModal via the page's
 * `setShowOrderLabModal` — no new add flow.
 */

import { useEffect, useMemo, useState } from 'react';
import ChartSection, { OmrsEmptyState } from '../ChartSection';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { formatDate } from '@/lib/format-utils';

const PAGE_SIZE = 8;

const STATUS_BADGE: Record<string, string> = {
  pending: 'omrs-panel-badge omrs-panel-badge--pending',
  in_progress: 'omrs-panel-badge omrs-panel-badge--active',
  completed: 'omrs-panel-badge omrs-panel-badge--done',
};

interface ResultsSectionProps {
  patientId: string;
  canOrderLabs: boolean;
  onAdd: () => void;
  /** When set (e.g. deep-linked from the lab queue), the row with this result
   *  `_id` is paged-to, scrolled into view and highlighted. */
  focusId?: string;
}

export default function ResultsSection({ patientId, canOrderLabs, onAdd, focusId }: ResultsSectionProps) {
  const { results } = useLabResults();
  const [page, setPage] = useState(1);

  const patientLabs = useMemo(
    () => (results || [])
      .filter(l => l.patientId === patientId)
      .sort((a, b) => (b.orderedAt || b.createdAt || '').localeCompare(a.orderedAt || a.createdAt || '')),
    [results, patientId],
  );

  // Deep-link focus: jump to the page holding the focused result once the data
  // loads, then scroll it into view and let the highlight draw attention.
  useEffect(() => {
    if (!focusId) return;
    const idx = patientLabs.findIndex(l => l._id === focusId);
    if (idx < 0) return;
    setPage(Math.floor(idx / PAGE_SIZE) + 1);
  }, [focusId, patientLabs]);

  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`lab-row-${focusId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, page]);

  const pageRows = patientLabs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <ChartSection
      title="Results"
      addLabel="Add"
      onAdd={canOrderLabs ? onAdd : undefined}
      pagination={{ page, pageSize: PAGE_SIZE, total: patientLabs.length, onPageChange: setPage }}
    >
      {patientLabs.length === 0 ? (
        <OmrsEmptyState itemLabel="results" actionLabel="Record results" onAction={canOrderLabs ? onAdd : undefined} disabledReason={canOrderLabs ? undefined : 'Requires lab-ordering permission'} />
      ) : (
        <table className="omrs-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Reference range</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(l => (
              <tr
                key={l._id}
                id={`lab-row-${l._id}`}
                style={l._id === focusId ? { background: 'var(--accent-light)', boxShadow: 'inset 3px 0 0 var(--accent-primary)' } : undefined}
              >
                <td style={{ fontWeight: 600 }}>{l.testName}</td>
                <td style={{ color: l.abnormal ? (l.critical ? 'var(--color-danger)' : 'var(--color-warning)') : 'inherit', fontWeight: l.abnormal ? 700 : 400 }}>
                  {l.result || '—'}{l.unit ? ` ${l.unit}` : ''}
                </td>
                <td>{l.referenceRange || '—'}</td>
                <td><span className={STATUS_BADGE[l.status] || 'omrs-panel-badge omrs-panel-badge--pending'}>{l.status.replace('_', ' ')}</span></td>
                <td>{formatDate(l.completedAt || l.orderedAt || l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartSection>
  );
}
