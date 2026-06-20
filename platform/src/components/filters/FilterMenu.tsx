'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Filter, X } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface FilterMenuProps {
  /** Number of filters currently applied. Drives the count badge + accent
   *  (`is-active`) treatment so users can see at a glance the list is narrowed. */
  activeCount?: number;
  /** Clears every filter. The "Clear all" link only renders when this is set. */
  onClear?: () => void;
  /** Heading shown at the top of the dropdown. Defaults to the button label. */
  title?: string;
  /** Button text. Defaults to the shared "Filters" translation. */
  label?: string;
  /** Max dropdown width in px (clamped to the viewport). */
  width?: number;
  /** Compact button to sit alongside `btn-sm` actions. */
  size?: 'sm' | 'md';
  /** The page-specific filter fields. Use <FilterMenu.Field> for labeled rows. */
  children: ReactNode;
}

/**
 * The single, consistent "Filters" control used next to the search bar on every
 * list page. It owns the button (with open/active accent styling via the shared
 * `.btn-filter` class), a count badge, and a dropdown panel that lays its
 * children out in a responsive two-column grid. The dropdown closes on outside
 * click or Escape. Each page supplies its own filter fields as children, so the
 * contents are always contextual to what that page filters on.
 */
export default function FilterMenu({
  activeCount = 0,
  onClear,
  title,
  label,
  width = 560,
  size = 'md',
  children,
}: FilterMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtersLabel = label ?? t('patients.filtersTitle');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`btn btn-secondary btn-filter${size === 'sm' ? ' btn-sm' : ''}${activeCount ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        title={filtersLabel}
      >
        <Filter className="w-4 h-4" />
        <span className="hidden sm:inline">{filtersLabel}</span>
        {activeCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
            style={{ background: 'var(--accent-primary)', color: '#fff' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-2xl overflow-hidden z-50"
          style={{
            width: `min(92vw, ${width}px)`,
            background: 'var(--bg-card-solid)',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--card-shadow-lg, 0 16px 48px rgba(0,0,0,0.2))',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title ?? filtersLabel}</span>
            <div className="flex items-center gap-2">
              {activeCount > 0 && onClear && (
                <button type="button" onClick={onClear} className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>
                  {t('nurse.clearAllFilters')}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--overlay-subtle)]" aria-label={t('action.close')}>
                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/** A labeled filter row for use inside <FilterMenu>. Pass the control as children. */
function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1${full ? ' sm:col-span-2' : ''}`}>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}

FilterMenu.Field = Field;
