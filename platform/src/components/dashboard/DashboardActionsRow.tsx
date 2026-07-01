'use client';

import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface QuickAction {
  label: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  href?: string;
  onClick?: () => void;
  /** Icon colour (defaults to accent blue). */
  color?: string;
}

/**
 * Dashboard "row 2" — the clinical-officer pattern: a Quick Actions card (2/3)
 * paired on the same line with a role-specific second card (1/3), e.g. Next
 * Appointment, Today's Appointments, or a Spotlight metric.
 */
export default function DashboardActionsRow({
  actions,
  secondaryCard,
  title = 'Quick Actions',
  className = '',
}: {
  actions: QuickAction[];
  secondaryCard: ReactNode;
  title?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-5 flex-shrink-0 ${className}`}>
      <div className="lg:col-span-2 flex flex-col">
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          {actions.map(a => (
            <button
              key={a.label}
              onClick={() => (a.onClick ? a.onClick() : a.href ? router.push(a.href) : undefined)}
              className="card-elevated flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:border-[var(--accent-primary)]"
            >
              <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 40, height: 40, background: a.color ? `color-mix(in srgb, ${a.color} 14%, transparent)` : 'var(--accent-light)' }}>
                <a.icon className="w-[19px] h-[19px]" style={{ color: a.color || 'var(--accent-primary)' }} />
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="lg:col-span-1 flex flex-col">{secondaryCard}</div>
    </div>
  );
}
