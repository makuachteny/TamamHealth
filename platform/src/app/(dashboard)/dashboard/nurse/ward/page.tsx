'use client';

import { useState } from 'react';
import TopBar from '@/components/TopBar';
import { useTranslation } from '@/lib/i18n/useTranslation';
import WardWorkflow from '@/components/nurse/WardWorkflow';
import { EMPTY_WARD_FILTERS, type WardFilterState } from '@/components/nurse/WardFilters';

export default function NurseWardPage() {
  const { t } = useTranslation();
  // Free-text search + structured filters live inline in the ward list
  // (WardWorkflow), so the platform-wide top search bar is hidden here.
  const [wardFilters, setWardFilters] = useState<WardFilterState>(EMPTY_WARD_FILTERS);
  return (
    <>
      <TopBar title={t('nurse.wardPatients')} hideSearch />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <WardWorkflow filters={wardFilters} setFilters={setWardFilters} />
      </main>
    </>
  );
}
