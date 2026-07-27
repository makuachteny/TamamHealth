'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TriageWorkflow from '@/components/nurse/TriageWorkflow';

function TriageRoute() {
  const patient = useSearchParams().get('patient') ?? undefined;
  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>
      <TriageWorkflow initialPatientId={patient} />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TriageRoute />
    </Suspense>
  );
}
