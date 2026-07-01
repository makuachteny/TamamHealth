'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';

export type QueueType = 'all' | 'walk-in' | 'appointment' | 'referral';
export type QueueSort = 'priority' | 'name' | 'time' | 'status';

/**
 * Patient-queue filter control — a "Filters" button that drops a panel of
 * structured controls (queue type + sort order). Docked beside the platform-wide
 * search bar (via the TopBar `searchTrailing` slot); free-text search lives in
 * the search bar itself. Replaces the old inline toolbar above the queue table.
 */
export default function QueueFilters({
  filter,
  setFilter,
  sort,
  setSort,
  counts,
}: {
  filter: QueueType;
  setFilter: (v: QueueType) => void;
  sort: QueueSort;
  setSort: (v: QueueSort) => void;
  counts: Record<QueueType, number>;
}) {
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

  // Anything other than the defaults (all / priority) counts as an active filter.
  const activeCount = (filter !== 'all' ? 1 : 0) + (sort !== 'priority' ? 1 : 0);
  const clear = () => { setFilter('all'); setSort('priority'); };

  const TYPES: { v: QueueType; l: string }[] = [
    { v: 'all', l: t('frontDesk.tabAll') },
    { v: 'walk-in', l: t('frontDesk.tabWalkIns') },
    { v: 'appointment', l: t('frontDesk.tabAppts') },
    { v: 'referral', l: t('frontDesk.tabReferrals') },
  ];

  const fieldStyle = { background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', borderRadius: 8, minWidth: 0 } as const;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors hover:bg-[var(--overlay-subtle)]"
        style={{
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-card-solid)',
          borderRadius: 'var(--input-radius)',
          boxShadow: 'var(--card-shadow)',
          color: activeCount ? 'var(--accent-primary)' : 'var(--text-secondary)',
        }}
        title={t('patients.filtersTitle')}
        aria-expanded={open}
      >
        <Filter className="w-4 h-4" style={{ color: activeCount ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
        <span>{t('patients.filtersTitle')}</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 mt-2 rounded-2xl overflow-hidden z-50"
          style={{ width: 'min(92vw, 320px)', background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg, 0 16px 48px rgba(0,0,0,0.2))' }}
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

          <div className="p-4 flex flex-col gap-4">
            {/* Queue type — toggle rows with live counts */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('frontDesk.colType')}</span>
              <div className="flex flex-col gap-1">
                {TYPES.map(opt => {
                  const active = filter === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => setFilter(opt.v)}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
                      style={{
                        background: active ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                        color: active ? '#fff' : 'var(--text-primary)',
                        border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                      }}
                    >
                      <span>{opt.l}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums" style={{ background: active ? 'rgba(255,255,255,0.22)' : 'var(--border-light)', color: active ? '#fff' : 'var(--text-secondary)' }}>
                        {counts[opt.v] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort order */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.sortBy')}</span>
              <select value={sort} onChange={e => setSort(e.target.value as QueueSort)} className="w-full text-sm py-2 px-3" style={fieldStyle}>
                <option value="priority">{t('frontDesk.sortPriority')}</option>
                <option value="name">{t('frontDesk.sortName')}</option>
                <option value="time">{t('frontDesk.sortTime')}</option>
                <option value="status">{t('frontDesk.sortStatus')}</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
