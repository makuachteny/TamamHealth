'use client';

import TopBar from '@/components/TopBar';
import { useTranslation } from '@/lib/i18n/useTranslation';
import WardWorkflow from '@/components/nurse/WardWorkflow';

export default function NurseWardPage() {
  const { t } = useTranslation();
  // The ward board has no inline search of its own — on this standalone page
  // the platform-wide top search drives it (globalSearch, consumed inside
  // useWardRoster); on the nurse station the left-rail search does.
  return (
    <>
      <TopBar title={t('nurse.wardPatients')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <WardWorkflow />
      </main>
    </>
  );
}
