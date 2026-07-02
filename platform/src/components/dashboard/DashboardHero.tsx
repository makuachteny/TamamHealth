'use client';

import type { ReactNode } from 'react';
import { useApp } from '@/lib/context';
import FacilitySyncCard from '@/components/dashboard/FacilitySyncCard';

export interface HeroStat {
  label: string;
  value: ReactNode;
}

/**
 * Dashboard top row — the clinical-officer treatment: a flat greeting panel
 * (dark "Welcome, {name}" headline, muted date, facility pill, flat stat
 * tiles) matching the ehr-schedule-header / dash-card visual language, with
 * the Facility Sync ring card on the same line to its right. Each dashboard
 * passes the 3–4 stats that matter for its role.
 *
 * The role-specific second card (Next/Today's Appointments, etc.) is placed by
 * each dashboard in its own quick-actions row, mirroring the CO layout.
 */
export default function DashboardHero({
  stats,
  title,
  className = '',
  showSync = true,
}: {
  stats: HeroStat[];
  /** Override the greeting headline (defaults to "Good Morning {name}"). */
  title?: string;
  className?: string;
  showSync?: boolean;
}) {
  const { currentUser } = useApp();
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const headline = title ?? `${greeting}${currentUser?.name ? ` ${currentUser.name}` : ''}`;
  const heroDate = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const facility = currentUser?.hospitalName;

  const hero = (
    <div className={`dash-card flex flex-col justify-between flex-shrink-0 ${showSync ? 'lg:col-span-2' : ''}`} style={{ minHeight: 224, padding: 22 }}>
      <div className="min-w-0">
        <h2 style={{ fontFamily: "var(--font-platform)", fontWeight: 700, fontSize: 22, lineHeight: 1.2, letterSpacing: 0, color: 'var(--text-primary)' }}>
          {headline}
        </h2>
        <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
          <span style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 13, lineHeight: 1, letterSpacing: 0, color: 'var(--text-muted)' }}>
            {heroDate}
          </span>
          {facility && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full"
              style={{ height: 24, padding: '0 10px 0 6px', background: 'var(--overlay-subtle)', fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}
            >
              <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: 'var(--color-success)' }} />
              {facility}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-end flex-wrap gap-6 sm:gap-10 mt-6 pt-5" style={{ borderTop: '1px solid var(--border-light)' }}>
        {stats.map(s => (
          <div key={s.label} className="text-left">
            <div className="dash-stat__label uppercase tracking-wider">
              {s.label}
            </div>
            <div className="dash-stat__value tabular-nums mt-1" style={{ fontSize: 32 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!showSync) {
    return <div className={className}>{hero}</div>;
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-5 flex-shrink-0 ${className}`}>
      {hero}
      <FacilitySyncCard className="lg:col-span-1" />
    </div>
  );
}
