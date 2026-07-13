'use client';

/**
 * Medications tab content — OpenMRS-style medication list. Reads from the
 * same `usePrescriptions()` collection the Order Basket drawer panel and
 * PrescribeModal already write to (switched from the legacy per-visit
 * `record.prescriptions` embed so newly-added orders actually show up here).
 * "Add" reuses the existing PrescribeModal via the page's
 * `setShowPrescribeModal` — no new add flow.
 */

import { useMemo, useState } from 'react';
import ChartSection, { OmrsEmptyState } from '../ChartSection';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { formatDate } from '@/lib/format-utils';

const PAGE_SIZE = 8;

const STATUS_BADGE: Record<string, string> = {
  pending: 'omrs-panel-badge omrs-panel-badge--pending',
  dispensed: 'omrs-panel-badge omrs-panel-badge--done',
  discontinued: 'omrs-panel-badge omrs-panel-badge--muted',
};

interface MedicationsSectionProps {
  patientId: string;
  canPrescribe: boolean;
  onAdd: () => void;
}

export default function MedicationsSection({ patientId, canPrescribe, onAdd }: MedicationsSectionProps) {
  const { prescriptions } = usePrescriptions();
  const [page, setPage] = useState(1);

  const patientRx = useMemo(
    () => (prescriptions || [])
      .filter(rx => rx.patientId === patientId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [prescriptions, patientId],
  );

  const pageRows = patientRx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <ChartSection
      title="Medications"
      addLabel="Add"
      onAdd={canPrescribe ? onAdd : undefined}
      pagination={{ page, pageSize: PAGE_SIZE, total: patientRx.length, onPageChange: setPage }}
    >
      {patientRx.length === 0 ? (
        <OmrsEmptyState itemLabel="medications" actionLabel="Record medications" onAction={canPrescribe ? onAdd : undefined} disabledReason={canPrescribe ? undefined : 'Requires prescribing permission'} />
      ) : (
        <table className="omrs-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dosage instructions</th>
              <th>Status</th>
              <th>Start date</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(rx => (
              <tr key={rx._id}>
                <td style={{ fontWeight: 600 }}>{rx.medication}</td>
                <td>{rx.dose} · {rx.route} · {rx.frequency}{rx.duration ? ` · ${rx.duration}` : ''}</td>
                <td><span className={STATUS_BADGE[rx.status] || 'omrs-panel-badge omrs-panel-badge--active'}>{rx.status}</span></td>
                <td>{formatDate(rx.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartSection>
  );
}
