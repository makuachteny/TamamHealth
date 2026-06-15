import type { ComponentType, ReactNode, SVGProps, CSSProperties } from 'react';

type IconComponent = ComponentType<
  Omit<SVGProps<SVGSVGElement>, 'color'> & {
    size?: number | string;
    strokeWidth?: number | string;
    color?: string;
    style?: CSSProperties;
    className?: string;
    absoluteStrokeWidth?: boolean;
  }
>;

/**
 * Unified page header used across every dashboard route so the look is
 * consistent regardless of which role the user is logged in as.
 *
 * Layout:
 *   [icon]  Title                          [actions]
 *           Subtitle
 *
 * The icon is vertically centered against the stacked title + subtitle so the
 * text reads as a single cohesive block. Styles live in globals.css under
 * `.page-header*`. The right-side action slot is optional.
 */
/** Compact metric shown inline in the header instead of a separate KPI card row. */
export interface PageHeaderStat {
  label: string;
  value: ReactNode;
  /** Value color (defaults to primary text). */
  color?: string;
}

export interface PageHeaderProps {
  icon: IconComponent;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /**
   * Inline summary metrics rendered in the header's right cluster (left of any
   * actions). Use this to fold a page's top KPI numbers into the header rather
   * than rendering a separate row of stat cards. Hidden on small screens.
   */
  stats?: PageHeaderStat[];
}

export default function PageHeader({ icon: Icon, title, subtitle, actions, stats }: PageHeaderProps) {
  const hasStats = !!stats?.length;
  return (
    <div className="page-header-row">
      <div className="page-header">
        <div className="page-header__icon">
          <Icon size={34} strokeWidth={1.8} />
        </div>
        <div className="page-header__text">
          <h1 className="page-header__title">{title}</h1>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {(hasStats || actions) && (
        <div className="page-header__actions">
          {hasStats && (
            <div className="hidden md:flex items-center gap-5 mr-1">
              {stats!.map(s => (
                <div key={s.label} className="text-right leading-tight">
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{s.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
