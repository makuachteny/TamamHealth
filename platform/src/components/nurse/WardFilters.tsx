'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';

export type WardFilterState = { gender: string; age: string; status: string };
export const EMPTY_WARD_FILTERS: WardFilterState = { gender: '', age: '', status: '' };

/**
 * Ward-queue filter control — a single icon button that drops a panel of
 * structured filters (gender / age band / status). Docked directly beside the
 * platform-wide search bar (via the TopBar `searchTrailing` slot); free-text
 * search lives in the search bar itself. Replaces the old per-column filter
 * inputs in the ward table header.
 */
export default function WardFilters({ filters, setFilters }: { filters: WardFilterState; setFilters: (f: WardFilterState) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const set = (k: keyof WardFilterState, v: string) => setFilters({ ...filters, [k]: v });
  const activeCount = Object.values(filters).filter(Boolean).length;
  const clear = () => setFilters({ ...EMPTY_WARD_FILTERS });

  const fieldStyle = { background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', borderRadius: 8, minWidth: 0 } as const;

  const OPTS: Record<keyof WardFilterState, { label: string; opts: { v: string; l: string }[] }> = {
    gender: { label: t('nurse.colGender'), opts: [{ v: 'Male', l: t('patient.male') }, { v: 'Female', l: t('patient.female') }] },
    age: { label: t('nurse.colAge'), opts: [{ v: 'child', l: t('nurse.ageChild') }, { v: 'adult', l: t('nurse.ageAdult') }, { v: 'elderly', l: t('nurse.ageElderly') }] },
    status: { label: t('nurse.colStatus'), opts: [
      { v: 'pending', l: t('nurse.statusWaiting') }, { v: 'seen', l: t('nurse.statusInConsult') },
      { v: 'admitted', l: t('nurse.statusAdmitted') }, { v: 'discharged', l: t('nurse.statusDischarged') },
    ] },
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center px-3 py-3 transition-colors hover:bg-[var(--overlay-subtle)]"
        style={{
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-card-solid)',
          borderRadius: 'var(--input-radius)',
          boxShadow: 'var(--card-shadow)',
        }}
        title={t('patients.filtersTitle')}
        aria-label={t('patients.filtersTitle')}
        aria-expanded={open}
      >
        <Filter className="w-[18px] h-[18px]" style={{ color: activeCount ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute left-0 mt-2 rounded-2xl overflow-hidden z-50"
          style={{ width: 'min(92vw, 360px)', background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'none' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('patients.filtersTitle')}</span>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button onClick={clear} className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>{t('nurse.clearAllFilters')}</button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--overlay-subtle)]" aria-label={t('action.close')}>
                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {(Object.keys(OPTS) as (keyof WardFilterState)[]).map(key => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{OPTS[key].label}</span>
                <select value={filters[key]} onChange={e => set(key, e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle}>
                  <option value="">{t('patients.all')}</option>
                  {OPTS[key].opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
