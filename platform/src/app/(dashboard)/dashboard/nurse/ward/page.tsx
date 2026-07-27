'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import WardWorkflow from '@/components/nurse/WardWorkflow';

export default function NurseWardPage() {
  const { t } = useTranslation();
  const { globalSearch, setGlobalSearch } = useApp();
  // The ward board has no inline search of its own — on this standalone page
  // WardWorkflow's roster (useWardRoster) reads `globalSearch` directly, so
  // this in-card box is the same search entry point the removed TopBar used
  // to render (debounced the same way GlobalSearchBar was); on the nurse
  // station the left-rail search feeds the component's `search` prop instead.
  const [localSearch, setLocalSearch] = useState(globalSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocalSearch(globalSearch); }, [globalSearch]);
  const handleSearch = (value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setGlobalSearch(value), 300);
  };

  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div className="mx-[10px] mt-[10px] flex-shrink-0 relative" style={{ maxWidth: 360 }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px]" style={{ color: 'var(--text-muted)' }} />
        <input
          type="search"
          value={localSearch}
          onChange={e => handleSearch(e.target.value)}
          placeholder={t('topbar.searchPlaceholder')}
          aria-label={t('nurse.wardPatients')}
          className="search-icon-input w-full py-2.5 pr-4 text-sm"
          style={{
            border: '1px solid var(--border-medium)',
            background: 'var(--bg-card-solid)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--input-radius)',
          }}
        />
      </div>
      <WardWorkflow />
    </main>
  );
}
