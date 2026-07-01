'use client';

import TopBar from '@/components/TopBar';
import { useTranslation } from '@/lib/i18n/useTranslation';
import HandoffWorkflow from '@/components/nurse/HandoffWorkflow';

export default function NurseHandoffPage() {
  const { t } = useTranslation();
  return (
    <>
      <TopBar title={t('nurse.shiftHandoffReport')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>
        <HandoffWorkflow variant="page" />
      </main>
    </>
  );
}
