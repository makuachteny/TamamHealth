// Canonical money/stat tile used for every KPI card across billing, payments,
// plans, claims, and admin dashboards so the look is identical everywhere.
// Wraps the `.data-tile` CSS system (see globals.css). `tone` adds the severity
// tint ONLY where it carries meaning (paid = 'ok', overdue/owing = 'danger',
// at-risk = 'warning'); plain totals stay the neutral default.

import type { CSSProperties, ReactNode } from 'react';

export type DataTileTone = 'default' | 'ok' | 'warning' | 'danger';

const TONE_CLASS: Record<DataTileTone, string> = {
  default: '',
  ok: ' data-tile--ok',
  warning: ' data-tile--warning',
  danger: ' data-tile--danger',
};

export default function DataTile({
  label,
  value,
  hint,
  tone = 'default',
  pulse = false,
  className,
  style,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: DataTileTone;
  /** Show the attention pulse dot (danger tiles that need action). */
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`data-tile${TONE_CLASS[tone]}${className ? ` ${className}` : ''}`}
      style={{ position: pulse ? 'relative' : undefined, ...style }}
    >
      {pulse && <span className="data-tile__alarm-pulse" aria-hidden />}
      <div className="data-tile__label">{label}</div>
      <div className="data-tile__value">{value}</div>
      {hint != null && hint !== '' && <div className="data-tile__hint">{hint}</div>}
    </div>
  );
}
