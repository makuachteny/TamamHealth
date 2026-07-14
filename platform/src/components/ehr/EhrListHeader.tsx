'use client';

/**
 * EhrListHeader — the shared list-page header, extracted from the patients
 * registry so every module presents the same shape:
 *
 *   Title (24px, left)                    ● Stat (n)  ● Stat (n)  ● Stat (n)
 *   [ rounded search input………………………………… ]  [Filters] [Download] [custom…]
 *
 * The stats row is dot-chips, right-aligned, using the flat palette from the
 * patients header (muted/blue/amber/green/bronze). Search and actions are
 * optional slots so pages keep their own filter popovers and buttons.
 */
import { useEffect, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import { Filter, X } from '@/components/icons/lucide';

export interface EhrListHeaderStat {
  label: string;
  value: number | string;
  /** Dot color. Defaults to the muted grey used by lead stats. */
  color?: string;
}

/** Flat stat-dot palette shared with the patients registry header. */
export const LIST_STAT_COLORS = {
  muted: 'var(--text-muted)',
  blue: '#2191D0',
  amber: '#D97706',
  green: '#15795C',
  bronze: '#B8741C',
} as const;

export default function EhrListHeader({
  title,
  stats = [],
  search,
  actions,
  className = '',
}: {
  title: ReactNode;
  stats?: EhrListHeaderStat[];
  /** Omit to render no search row; pass `actions` alone to get a right-aligned action row. */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    ariaLabel?: string;
  };
  /** Rendered to the right of the search input (filter buttons, download, etc.). */
  actions?: ReactNode;
  className?: string;
}) {
  const hasSecondRow = Boolean(search || actions);
  return (
    <div className={`px-4 pt-4 pb-3 flex-shrink-0 ${className}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
      <div className={`flex items-end justify-between gap-3 flex-wrap ${hasSecondRow ? 'mb-3' : ''}`}>
        <span style={{ fontFamily: 'var(--font-platform)', fontWeight: 500, fontSize: 24, lineHeight: '100%', letterSpacing: 0, color: 'var(--text-primary)' }}>
          {title}
        </span>
        {stats.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap justify-end pb-0.5">
            {stats.map(s => (
              <span key={s.label} className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color || LIST_STAT_COLORS.muted }} />
                {s.label} ({typeof s.value === 'number' ? s.value.toLocaleString() : s.value})
              </span>
            ))}
          </div>
        )}
      </div>
      {hasSecondRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {search && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={search.value}
                onChange={(e: ChangeEvent<HTMLInputElement>) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                aria-label={search.ariaLabel || search.placeholder}
                style={{ width: '100%', padding: '9px 18px', height: 38, borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * EhrListHeaderButton — pill button matching the patients header's Filters /
 * Download controls. `active` renders the blue-tinted state used when filters
 * are applied.
 */
export function EhrListHeaderButton({
  onClick,
  active = false,
  children,
  ariaExpanded,
  ariaLabel,
}: {
  onClick?: () => void;
  active?: boolean;
  children: ReactNode;
  ariaExpanded?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-light)'}`,
        background: active ? 'rgba(33,145,208,0.08)' : 'var(--bg-card-solid)',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

/**
 * EhrListFilters — the "Filters" pill + popover pattern from the patients
 * registry header. Renders an `EhrListHeaderButton` (with an active-count
 * badge) that toggles a dropdown panel; the panel's contents (selects,
 * chips, whatever a page needs) are passed as `children`. Closes on outside
 * click or Escape, same as the patients filter panel.
 */
export function EhrListFilters({
  activeCount,
  onClear,
  children,
  label = 'Filters',
  panelWidth = 320,
}: {
  /** Number of filters currently applied — drives the badge and the active/blue button state. */
  activeCount: number;
  /** Optional "Clear all" affordance in the panel header, shown only when activeCount > 0. */
  onClear?: () => void;
  children: ReactNode;
  label?: string;
  panelWidth?: number | string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <EhrListHeaderButton onClick={() => setOpen(o => !o)} active={activeCount > 0} ariaExpanded={open} ariaLabel={label}>
        <Filter className="w-3.5 h-3.5" />
        {label}
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: '#2191D0', color: '#fff' }}>
            {activeCount}
          </span>
        )}
      </EhrListHeaderButton>
      {open && (
        <div
          className="absolute right-0 mt-2 rounded-2xl overflow-hidden z-50"
          style={{ width: panelWidth, maxWidth: '92vw', background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg, 0 16px 48px rgba(0,0,0,0.2))' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
            <div className="flex items-center gap-2">
              {activeCount > 0 && onClear && (
                <button type="button" onClick={onClear} className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>Clear all</button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--overlay-subtle)]" aria-label="Close">
                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">{children}</div>
        </div>
      )}
    </div>
  );
}
