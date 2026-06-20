'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useTranslation } from '@/lib/i18n/useTranslation';
import TriageWorkflow from '@/components/nurse/TriageWorkflow';

function TriageRoute() {
  const { t } = useTranslation();
  const patient = useSearchParams().get('patient') ?? undefined;
  return (
    <>
      <TopBar title={t('nurse.etatTriageAssessment')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>
        <TriageWorkflow initialPatientId={patient} />
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TriageRoute />
    </Suspense>
  );
}
