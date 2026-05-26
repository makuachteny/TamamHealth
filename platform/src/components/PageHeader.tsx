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
 *           Subtitle (indented under title)
 *
 * The accompanying styles live in globals.css under `.page-header*`. The
 * right-side action slot is optional — pass it as a ReactNode fragment.
 */
export interface PageHeaderProps {
  icon: IconComponent;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header-row">
      <div className="page-header">
        <div className="page-header__top">
          <div className="page-header__icon">
            <Icon size={34} strokeWidth={1.8} />
          </div>
          <h1 className="page-header__title">{title}</h1>
        </div>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
