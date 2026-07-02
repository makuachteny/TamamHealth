'use client';

import type { ReactNode } from 'react';
import { useApp } from '@/lib/context';

export interface HeroStat {
  label: string;
  value: ReactNode;
}

/**
 * Dashboard top row — the clinical-officer treatment: a brand-colored greeting
 * banner using the platform type scale for greeting, date, facility pill,
 * and stats. Each dashboard passes the 3–4 stats that matter for its role.
 *
 * The role-specific second card (Next/Today's Appointments, etc.) is placed by
 * each dashboard in its own quick-actions row, mirroring the CO layout.
 */
export default function DashboardHero({
  stats,
  title,
  className = '',
}: {
  stats: HeroStat[];
  /** Override the greeting headline (defaults to "Welcome, {name}"). */
  title?: string;
  className?: string;
}) {
  const { currentUser } = useApp();
  const now = new Date();
  const headline = title ?? `Welcome${currentUser?.name ? `, ${currentUser.name}` : ''}`;
  const heroDate = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const facility = currentUser?.hospitalName;

  const hero = (
    <div className="hero-banner flex flex-col justify-between flex-shrink-0" style={{ minHeight: 224 }}>
      {/* Decorative brand "union" motif — matches the clinical-officer hero. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden
        src="/assets/union.png"
        alt=""
        style={{ position: 'absolute', width: 420, height: 420, top: -80, right: -60, zIndex: 0, pointerEvents: 'none', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.18, transform: 'rotate(10deg)' }}
      />
      <div className="relative z-[1] min-w-0">
        <h2 style={{ fontFamily: "var(--font-platform)", fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: 0 }}>
          {headline}
        </h2>
        <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
          <span style={{ fontFamily: "var(--font-platform)", fontWeight: 300, fontSize: 14, lineHeight: 1, letterSpacing: 0, color: 'rgba(255,255,255,0.9)' }}>
            {heroDate}
          </span>
          {facility && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full"
              style={{ height: 26, padding: '0 10px 0 6px', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.5)', fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 12, color: '#fff' }}
            >
              <span className="rounded-full flex-shrink-0" style={{ width: 20, height: 20, background: 'var(--color-success)' }} />
              {facility}
            </span>
          )}
        </div>
      </div>
      <div className="relative z-[1] flex items-end flex-wrap gap-8 sm:gap-12 mt-6">
        {stats.map(s => (
          <div key={s.label} className="text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {s.label}
            </div>
            <div className="mt-2 tabular-nums" style={{ fontFamily: "var(--font-platform)", fontWeight: 700, fontSize: 48, lineHeight: 1, letterSpacing: -0.5 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return <div className={className}>{hero}</div>;
}
