'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from '@/components/icons/lucide';

/**
 * Spotlight — a flat metric card (dash-card treatment, matching the
 * ehr-schedule-header visual language) used as each dashboard's role-specific
 * second card: the one number that matters most for that role, with an
 * optional caption and "view all" arrow.
 */
export default function SpotlightCard({
  title,
  value,
  caption,
  href,
  className = '',
}: {
  title: string;
  value: ReactNode;
  caption?: ReactNode;
  href?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={`dash-card flex flex-col justify-between ${className}`} style={{ minHeight: 188, padding: 22 }}>
      <div className="flex items-start justify-between">
        <span style={{ fontFamily: "var(--font-platform)", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{title}</span>
        {href && (
          <button
            onClick={() => router.push(href)}
            className="flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
            style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--overlay-subtle)' }}
            aria-label={`Open ${title}`}
            title={`Open ${title}`}
          >
            <ArrowUpRight className="w-[16px] h-[16px]" style={{ color: 'var(--accent-primary)' }} />
          </button>
        )}
      </div>
      <div>
        <div className="dash-stat__value tabular-nums" style={{ fontSize: 44 }}>{value}</div>
        {caption && (
          <div className="dash-stat__label mt-1">{caption}</div>
        )}
      </div>
    </div>
  );
}
