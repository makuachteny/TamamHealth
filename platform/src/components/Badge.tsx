'use client';

import type { ReactNode } from 'react';

/**
 * Shared status/label badge. Standardizes the dozens of hand-rolled
 * `rounded-full px-2 py-0.5` status pills (each with its own colour ternary)
 * into one consistent pill driven by a semantic `tone`. Tones map to the
 * theme's tint tokens so light/dark + branding stay consistent.
 */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const TONE_STYLES: Record<BadgeTone, { bg: string; color: string }> = {
  neutral: { bg: 'var(--overlay-subtle)', color: 'var(--text-secondary)' },
  info: { bg: 'var(--color-info-bg)', color: 'var(--color-info-text)' },
  success: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
  warning: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  danger: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' },
  accent: { bg: 'var(--accent-light)', color: 'var(--accent-primary)' },
};

interface BadgeProps {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  /** Render as uppercase micro-label (false by default — sentence/label case). */
  uppercase?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Badge({ tone = 'neutral', size = 'sm', uppercase = false, className = '', children }: BadgeProps) {
  const s = TONE_STYLES[tone];
  const sizing = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${sizing} ${uppercase ? 'uppercase tracking-wide' : ''} ${className}`}
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

/**
 * Best-effort mapping from a free-text status to a semantic tone, covering the
 * common vocabulary across the app's domains (queue, orders, payments,
 * appointments, referrals). Pages with bespoke statuses can pass `tone`
 * directly to <Badge> instead.
 */
export function toneForStatus(status?: string | null): BadgeTone {
  const s = (status || '').toLowerCase();
  if (/(active|completed|complete|paid|approved|accepted|resolved|dispensed|done|seen|success|in stock|available|verified|signed|acknowledged)/.test(s)) return 'success';
  if (/(pending|waiting|scheduled|draft|upcoming|in progress|in_progress|in consult|processing|ordered|requested|submitted|low stock)/.test(s)) return 'warning';
  if (/(cancelled|canceled|failed|declined|rejected|overdue|expired|critical|error|out of stock|discarded|void|inactive)/.test(s)) return 'danger';
  if (/(referred|review|in review|checked.?in|confirmed|new|info)/.test(s)) return 'info';
  return 'neutral';
}
