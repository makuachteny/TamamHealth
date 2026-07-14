'use client';

/**
 * Orders tab content — a UNIFIED orders table merging this patient's drug
 * orders (usePrescriptions) and lab orders (useLabResults), matching the
 * OpenMRS Orders screenshot columns. "Add" reuses the same
 * PrescribeModal/OrderLabModal triggers as the Medications/Results tabs and
 * the Order Basket drawer panel — no new order-creation flow.
 */

import { useMemo, useState } from 'react';
import ChartSection, { OmrsEmptyState } from '../ChartSection';
import { Search, Pill, FlaskConical } from '@/components/icons/lucide';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { formatDate } from '@/lib/format-utils';

const PAGE_SIZE = 10;

type OrderTypeFilter = 'all' | 'drug' | 'lab';

interface UnifiedOrderRow {
  id: string;
  orderNumber: string;
  date: string;
  orderType: 'Drug order' | 'Lab order';
  description: string;
  priority: 'STAT' | 'Routine';
  orderedBy: string;
  status: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'omrs-panel-badge omrs-panel-badge--pending',
  in_progress: 'omrs-panel-badge omrs-panel-badge--active',
  dispensed: 'omrs-panel-badge omrs-panel-badge--done',
  completed: 'omrs-panel-badge omrs-panel-badge--done',
  discontinued: 'omrs-panel-badge omrs-panel-badge--muted',
};

interface OrdersSectionProps {
  patientId: string;
  canPrescribe: boolean;
  canOrderLabs: boolean;
  onAddDrug: () => void;
  onAddLab: () => void;
}

export default function OrdersSection({ patientId, canPrescribe, canOrderLabs, onAddDrug, onAddLab }: OrdersSectionProps) {
  const { prescriptions } = usePrescriptions();
  const { results } = useLabResults();
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const rows = useMemo<UnifiedOrderRow[]>(() => {
    const drugRows: UnifiedOrderRow[] = (prescriptions || [])
      .filter(rx => rx.patientId === patientId)
      .map(rx => ({
        id: rx._id,
        orderNumber: `ORD-${rx._id.slice(-6).toUpperCase()}`,
        date: rx.createdAt,
        orderType: 'Drug order',
        description: `${rx.medication} ${rx.dose} · ${rx.frequency}`.trim(),
        priority: rx.urgency === 'immediate' ? 'STAT' : 'Routine',
        orderedBy: rx.prescribedBy || '—',
        status: rx.status,
      }));
    const labRows: UnifiedOrderRow[] = (results || [])
      .filter(l => l.patientId === patientId)
      .map(l => ({
        id: l._id,
        orderNumber: `ORD-${l._id.slice(-6).toUpperCase()}`,
        date: l.orderedAt || l.createdAt,
        orderType: 'Lab order',
        description: l.testName,
        priority: 'Routine',
        orderedBy: l.orderedBy || '—',
        status: l.status,
      }));
    return [...drugRows, ...labRows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [prescriptions, results, patientId]);

  const filtered = useMemo(() => {
    let list = rows;
    if (typeFilter === 'drug') list = list.filter(r => r.orderType === 'Drug order');
    if (typeFilter === 'lab') list = list.filter(r => r.orderType === 'Lab order');
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r => r.description.toLowerCase().includes(q) || r.orderNumber.toLowerCase().includes(q));
    return list;
  }, [rows, typeFilter, search]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canAdd = canPrescribe || canOrderLabs;

  const filterSlot = (
    <label className="omrs-section-filter">
      Order type:
      <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as OrderTypeFilter); setPage(1); }}>
        <option value="all">All</option>
        <option value="drug">Drug</option>
        <option value="lab">Lab</option>
      </select>
    </label>
  );

  return (
    <ChartSection
      title="Orders"
      addLabel="Add"
      onAdd={canAdd ? () => setAddMenuOpen(v => !v) : undefined}
      filterSlot={filterSlot}
      pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
    >
      {canAdd && addMenuOpen && (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: -6, zIndex: 20 }} className="omrs-actions-menu" role="menu">
            {canPrescribe && (
              <button type="button" onClick={() => { setAddMenuOpen(false); onAddDrug(); }}><Pill /> Drug order</button>
            )}
            {canOrderLabs && (
              <button type="button" onClick={() => { setAddMenuOpen(false); onAddLab(); }}><FlaskConical /> Lab order</button>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="omrs-panel-search-wrap" style={{ marginBottom: 12 }}>
          <Search />
          <input
            type="text"
            className="omrs-panel-search"
            placeholder="Search orders…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <OmrsEmptyState
          itemLabel="orders"
          actionLabel="Record orders"
          onAction={canAdd ? () => setAddMenuOpen(true) : undefined}
          disabledReason={canAdd ? undefined : 'Requires prescribing or lab-ordering permission'}
        />
      ) : (
        <table className="omrs-table">
          <thead>
            <tr>
              <th>Order number</th>
              <th>Date of order</th>
              <th>Order type</th>
              <th>Order</th>
              <th>Priority</th>
              <th>Ordered by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(r => (
              <tr key={r.id}>
                <td className="font-mono" style={{ fontSize: 11 }}>{r.orderNumber}</td>
                <td>{formatDate(r.date)}</td>
                <td>{r.orderType}</td>
                <td>{r.description}</td>
                <td>
                  <span className={r.priority === 'STAT' ? 'omrs-panel-badge omrs-panel-badge--pending' : 'omrs-panel-badge omrs-panel-badge--muted'}>
                    {r.priority}
                  </span>
                </td>
                <td>{r.orderedBy}</td>
                <td><span className={STATUS_BADGE[r.status] || 'omrs-panel-badge omrs-panel-badge--active'}>{r.status.replace('_', ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartSection>
  );
}
