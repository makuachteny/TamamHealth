'use client';

import type { ComponentType, CSSProperties } from 'react';
import { useTranslation } from '@/lib/i18n/useTranslation';

/** Any icon component that accepts className + style (the duotone icon set). */
type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>;

export interface QuickAction {
  label: string;
  icon: IconComponent;
  action: () => void;
  /** Icon colour. */
  color: string;
  /** Optional active state — renders the accent-tinted surface. */
  active?: boolean;
}

/**
 * The clinician/clinical-officer dashboard "Quick Actions" card, extracted so
 * the nurse dashboard reuses the exact same card + button styling and grid
 * arrangement. A 2/4-column grid of elevated icon-and-label buttons inside a
 * dash-card, matching the Centricity-style home screen.
 */
export default function QuickActionsCard({
  actions,
  title,
  className = '',
}: {
  actions: QuickAction[];
  title?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={`dash-card p-3 ${className}`}>
      <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        {title ?? t('dashboard.quickActions')}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.action}
            className="card-elevated flex items-center gap-3 px-3.5 py-3 text-left transition-all"
            style={action.active ? { borderColor: 'var(--accent-primary)', background: 'var(--accent-light)' } : undefined}
          >
            <action.icon className="w-[22px] h-[22px] flex-shrink-0" style={{ color: action.color }} />
            <span className="text-[12px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
