'use client';

/**
 * Procedures tab content — this app has no procedure data model (grepped
 * db-types.ts / data/mock.ts: no `Procedure`/`procedure` document type
 * exists). Rather than invent one, this is a faithful OpenMRS empty state
 * that routes to the consultation flow, where procedures performed during a
 * visit are actually captured today (as part of the treatment plan / notes).
 */

import ChartSection, { OmrsEmptyState } from '../ChartSection';
import type { ChartPanelRouter } from '../panels/types';

interface ProceduresSectionProps {
  patientId: string;
  canConsult: boolean;
  router: ChartPanelRouter;
}

export default function ProceduresSection({ patientId, canConsult, router }: ProceduresSectionProps) {
  return (
    <ChartSection title="Procedures">
      <OmrsEmptyState
        itemLabel="procedures"
        actionLabel="Record procedures"
        onAction={canConsult ? () => router.push(`/consultation?patientId=${patientId}`) : undefined}
        disabledReason={canConsult ? undefined : 'Requires consultation permission'}
      />
    </ChartSection>
  );
}
