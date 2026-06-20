'use client';

import TopBar from '@/components/TopBar';
import { useTranslation } from '@/lib/i18n/useTranslation';
import MarWorkflow from '@/components/nurse/MarWorkflow';

export default function NurseMarPage() {
  const { t } = useTranslation();
  return (
    <>
      <TopBar title={t('nurse.marTitle')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>
        <MarWorkflow />
      </main>
    </>
  );
}
