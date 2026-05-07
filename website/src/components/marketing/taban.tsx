'use client';

import { useId } from 'react';
import type { CSSProperties, ReactNode, SVGProps } from 'react';

// Taban Icon Library v2 — illustrative duotone with lighting.
// Each icon defines its own gradients + soft inner highlight + drop shadow.
// Two layers: a gradient-filled "body" and a crisp foreground stroke + accent shapes.
// Designed to read well at 18-48px. Below 18px, falls back to a "flat" mode (no shadow).

export const TABAN_ACCENT_DEFAULT = '#2E9E7E';

export type TabanCategory =
  | 'Vitals'
  | 'Clinical'
  | 'Lab & Pharmacy'
  | 'Maternal & Child'
  | 'Billing'
  | 'Navigation'
  | 'Neutral';

export const TABAN_CATEGORY_ACCENTS: Record<
  TabanCategory,
  { base: string; light: string; deep: string }
> = {
  Vitals: { base: '#C44536', light: '#E27768', deep: '#8E2A1E' },
  Clinical: { base: '#2E9E7E', light: '#4FC9A6', deep: '#1A6B54' },
  'Lab & Pharmacy': { base: '#B07A2E', light: '#E0A858', deep: '#7A4F18' },
  'Maternal & Child': { base: '#D96E59', light: '#F09784', deep: '#9A4A38' },
  Billing: { base: '#1B7FA8', light: '#4AA8CE', deep: '#0F5577' },
  Navigation: { base: '#2E5E5E', light: '#4F8585', deep: '#1A3A3A' },
  Neutral: { base: '#3D5854', light: '#6B8884', deep: '#1A2C2A' },
};

export interface TabanIconProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  size?: number | string;
  /** Primary color (gradient + outline). */
  accent?: string;
  /** Alias for accent. */
  color?: string;
  /** Disable lighting/shadow effects. */
  flat?: boolean;
  style?: CSSProperties;
}

type Ctx = { id: string; a: string; showLighting: boolean };

interface IconBaseProps extends Omit<TabanIconProps, 'children'> {
  children: (ctx: Ctx) => ReactNode;
}

function IconBase({
  size = 24,
  accent,
  color,
  children,
  style,
  flat = false,
  ...rest
}: IconBaseProps) {
  const rawId = useId();
  const id = `t${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const a = accent || color || TABAN_ACCENT_DEFAULT;
  const num = typeof size === 'string' ? Number(size) || 24 : size;
  const showLighting = !flat && num >= 18;
  return (
    <svg
      width={num}
      height={num}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        overflow: 'visible',
        ...style,
      }}
      {...rest}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a} stopOpacity="0.42" />
          <stop offset="55%" stopColor={a} stopOpacity="0.25" />
          <stop offset="100%" stopColor={a} stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a} stopOpacity="1" />
          <stop offset="100%" stopColor={a} stopOpacity="0.78" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0.3" cy="0.2" r="0.7">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {showLighting && (
          <filter id={`${id}-shadow`} x="-20%" y="-10%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.55" />
            <feOffset dx="0" dy="0.6" result="o" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.35" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g filter={showLighting ? `url(#${id}-shadow)` : undefined}>
        {children({ id, a, showLighting })}
      </g>
    </svg>
  );
}

const body = (id: string) => ({ fill: `url(#${id}-body)`, stroke: 'none' });
const shine = (id: string) => ({ fill: `url(#${id}-shine)`, stroke: 'none' });
const outline = (a: string, w: number = 1.55) => ({
  fill: 'none',
  stroke: a,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});
const solid = (id: string) => ({ fill: `url(#${id}-accent)`, stroke: 'none' });

// ───────────────────────────────────────────────────────────────────────────
// Vitals
// ───────────────────────────────────────────────────────────────────────────

export const TabanHeart = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M12 20.5c-.7 0-1.4-.25-1.95-.72l-6.2-5.5A5.25 5.25 0 0 1 9.5 5.5c1.05 0 2.05.35 2.5.95.45-.6 1.45-.95 2.5-.95a5.25 5.25 0 0 1 5.65 8.78l-6.2 5.5c-.55.47-1.25.72-1.95.72Z"
          {...body(id)}
        />
        <path
          d="M12 20.5c-.7 0-1.4-.25-1.95-.72l-6.2-5.5A5.25 5.25 0 0 1 9.5 5.5c1.05 0 2.05.35 2.5.95.45-.6 1.45-.95 2.5-.95a5.25 5.25 0 0 1 5.65 8.78l-6.2 5.5c-.55.47-1.25.72-1.95.72Z"
          {...outline(a, 1.4)}
        />
        <path d="M6.5 12.5h2.3l1.1-2 1.8 4 1.3-2.4h4.5" {...outline(a, 1.7)} />
        <path
          d="M6 6c1.5-1 3-1.2 4-.5"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanPulse = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" {...body(id)} />
        <rect x="2.5" y="6" width="19" height="12" rx="2.5" {...outline(a, 1.4)} />
        <rect x="2.5" y="6" width="19" height="6" rx="2.5" {...shine(id)} />
        <path
          d="M4.5 12h3l1.2-3 2.3 6 1.6-4 1.2 2 1.1-1h4.6"
          {...outline(a, 1.8)}
        />
      </>
    )}
  </IconBase>
);

export const TabanStethoscope = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="17" cy="15" r="2.7" {...solid(id)} />
        <circle cx="17" cy="15" r="2.7" {...outline(a, 1.4)} />
        <circle cx="16.4" cy="14.4" r="0.8" fill="#fff" fillOpacity="0.55" />
        <path d="M6 3v5a4 4 0 0 0 8 0V3" {...outline(a, 1.6)} />
        <path d="M6 3v5a4 4 0 0 0 8 0V3" {...body(id)} />
        <path d="M6 3v5a4 4 0 0 0 8 0V3" {...outline(a, 1.6)} />
        <path d="M6 3h1.5M12.5 3H14" {...outline(a, 1.8)} />
        <path d="M10 12v2a4.5 4.5 0 0 0 4.5 4.5H17" {...outline(a, 1.6)} />
      </>
    )}
  </IconBase>
);

export const TabanLungs = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M9 8c0 3-2.5 4-3.5 6.5-.9 2.25.5 4.5 2.5 4.5 1.8 0 3-1.2 3-3V8"
          {...body(id)}
        />
        <path
          d="M15 8c0 3 2.5 4 3.5 6.5.9 2.25-.5 4.5-2.5 4.5-1.8 0-3-1.2-3-3V8"
          {...body(id)}
        />
        <path
          d="M9 8c0 3-2.5 4-3.5 6.5-.9 2.25.5 4.5 2.5 4.5 1.8 0 3-1.2 3-3V8"
          {...outline(a, 1.4)}
        />
        <path
          d="M15 8c0 3 2.5 4 3.5 6.5.9 2.25-.5 4.5-2.5 4.5-1.8 0-3-1.2-3-3V8"
          {...outline(a, 1.4)}
        />
        <path d="M12 4v8.5" {...outline(a, 1.6)} />
        <path
          d="M7.5 9c-.4.5-.7 1.2-.9 1.9"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M16.5 9c.4.5.7 1.2.9 1.9"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanThermometer = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M14 4a2 2 0 0 0-4 0v10.2a3.5 3.5 0 1 0 4 0V4Z"
          {...body(id)}
        />
        <path
          d="M14 4a2 2 0 0 0-4 0v10.2a3.5 3.5 0 1 0 4 0V4Z"
          {...outline(a, 1.4)}
        />
        <circle cx="12" cy="17" r="1.8" {...solid(id)} />
        <circle cx="11.4" cy="16.4" r="0.5" fill="#fff" fillOpacity="0.55" />
        <path d="M12 7v7" {...outline(a, 1.5)} />
        <path
          d="M11 5v0.5"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </>
    )}
  </IconBase>
);

export const TabanBloodPressure = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="3" y="8" width="13" height="8" rx="1.8" {...body(id)} />
        <rect x="3" y="8" width="13" height="3" rx="1.8" {...shine(id)} />
        <rect x="3" y="8" width="13" height="8" rx="1.8" {...outline(a, 1.4)} />
        <path d="M6 12h2l1-2 1.5 4 1-2h3.5" {...outline('#1A2C2A', 1.4)} />
        <path d="M16 12h5M18.5 9.5v5" {...outline(a, 1.6)} />
      </>
    )}
  </IconBase>
);

export const TabanOxygen = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="12" cy="12" r="8.5" {...body(id)} />
        <circle cx="12" cy="12" r="8.5" {...outline(a, 1.4)} />
        <ellipse cx="9" cy="8.5" rx="5" ry="3" {...shine(id)} />
        <text
          x="12"
          y="15.5"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="800"
          fontSize="7.5"
          fill={a}
        >
          {'O₂'}
        </text>
      </>
    )}
  </IconBase>
);

export const TabanBrain = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M12 4.5c-1-1.2-3.2-1.2-4.5.2-.8.9-.7 1.8-.4 2.4-1.1.3-2 1.3-2 2.6 0 .9.4 1.6 1 2-.6.5-1 1.2-1 2.1 0 1.4 1.1 2.5 2.4 2.7.1 1.3 1.1 2.3 2.6 2.3 1 0 1.7-.4 2-1V4.5Z"
          {...body(id)}
        />
        <path
          d="M12 4.5c1-1.2 3.2-1.2 4.5.2.8.9.7 1.8.4 2.4 1.1.3 2 1.3 2 2.6 0 .9-.4 1.6-1 2 .6.5 1 1.2 1 2.1 0 1.4-1.1 2.5-2.4 2.7-.1 1.3-1.1 2.3-2.6 2.3-1 0-1.7-.4-2-1V4.5Z"
          {...body(id)}
        />
        <path
          d="M12 4.5c-1-1.2-3.2-1.2-4.5.2-.8.9-.7 1.8-.4 2.4-1.1.3-2 1.3-2 2.6 0 .9.4 1.6 1 2-.6.5-1 1.2-1 2.1 0 1.4 1.1 2.5 2.4 2.7.1 1.3 1.1 2.3 2.6 2.3 1 0 1.7-.4 2-1V4.5Z"
          {...outline(a, 1.4)}
        />
        <path
          d="M12 4.5c1-1.2 3.2-1.2 4.5.2.8.9.7 1.8.4 2.4 1.1.3 2 1.3 2 2.6 0 .9-.4 1.6-1 2 .6.5 1 1.2 1 2.1 0 1.4-1.1 2.5-2.4 2.7-.1 1.3-1.1 2.3-2.6 2.3-1 0-1.7-.4-2-1V4.5Z"
          {...outline(a, 1.4)}
        />
        <path
          d="M9.5 9c.5.3.8.8.8 1.4M14.5 9c-.5.3-.8.8-.8 1.4M12 13v2"
          {...outline(a, 1.3)}
        />
        <path
          d="M8 6.5c-.6.4-1 1-1.2 1.6"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanWeight = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M4.5 7.5h15l-1.2 11.3a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z"
          {...body(id)}
        />
        <path d="M4.5 7.5h15l-.4 3.5H4.9L4.5 7.5Z" {...shine(id)} />
        <path
          d="M4.5 7.5h15l-1.2 11.3a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z"
          {...outline(a, 1.4)}
        />
        <path d="M9 7.5a3 3 0 1 1 6 0" {...outline(a, 1.4)} />
        <path d="M10.5 12.5 12 15l1.5-2.5" {...outline(a, 1.6)} />
      </>
    )}
  </IconBase>
);

// ───────────────────────────────────────────────────────────────────────────
// Lab & Pharmacy
// ───────────────────────────────────────────────────────────────────────────

export const TabanFlask = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M9 3h6v4.5l4.2 9A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.2-3.5L9 7.5V3Z"
          {...body(id)}
        />
        <path
          d="M5.6 14.5h12.8l.8 2A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.2-3.5l.8-2Z"
          fill={a}
          fillOpacity="0.55"
        />
        <path
          d="M9 3h6v4.5l4.2 9A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.2-3.5L9 7.5V3Z"
          {...outline(a, 1.4)}
        />
        <path d="M7.5 3h9" {...outline(a, 1.6)} />
        <circle cx="10" cy="17" r="0.8" fill="#fff" fillOpacity="0.7" />
        <circle cx="13.5" cy="16" r="0.6" fill="#fff" fillOpacity="0.7" />
        <circle cx="14.5" cy="18" r="0.5" fill="#fff" fillOpacity="0.5" />
        <path
          d="M10 4.5c-.5.3-.8.7-1 1.3"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanTestTube = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M8.5 3h7v13.5a3.5 3.5 0 0 1-7 0V3Z" {...body(id)} />
        <path
          d="M8.5 12h7v4.5a3.5 3.5 0 0 1-7 0V12Z"
          fill={a}
          fillOpacity="0.5"
        />
        <path d="M8.5 3h7v13.5a3.5 3.5 0 0 1-7 0V3Z" {...outline(a, 1.4)} />
        <path d="M7.5 3h9" {...outline(a, 1.6)} />
        <circle cx="10.5" cy="16" r="0.7" fill="#fff" fillOpacity="0.7" />
        <circle cx="13" cy="15" r="0.5" fill="#fff" fillOpacity="0.7" />
        <path
          d="M9.5 4.5v7"
          stroke="#fff"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </>
    )}
  </IconBase>
);

export const TabanMicroscope = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M9.5 3.5 14 5.5l-2 4-4.5-2 2-4Z" {...body(id)} />
        <path d="M9.5 3.5 14 5.5l-2 4-4.5-2 2-4Z" {...outline(a, 1.4)} />
        <path d="m10.5 9.5-2.5 5" {...outline(a, 1.6)} />
        <path d="M6 16h7" {...outline(a, 1.8)} />
        <path d="M4 20h16" {...outline(a, 1.8)} />
        <path d="M12 16a4 4 0 0 0 4-4" {...outline(a, 1.4)} />
        <circle cx="11" cy="6" r="0.6" fill="#fff" fillOpacity="0.7" />
      </>
    )}
  </IconBase>
);

export const TabanPill = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="3" y="8" width="18" height="8" rx="4" {...body(id)} />
        <rect
          x="12"
          y="8"
          width="9"
          height="8"
          rx="4"
          fill={a}
          fillOpacity="0.55"
        />
        <rect x="3" y="8" width="18" height="3.5" rx="4" {...shine(id)} />
        <rect x="3" y="8" width="18" height="8" rx="4" {...outline(a, 1.4)} />
        <path d="M12 8v8" {...outline(a, 1.6)} />
      </>
    )}
  </IconBase>
);

export const TabanSyringe = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect
          x="11"
          y="8.5"
          width="8.5"
          height="4.5"
          rx="0.6"
          transform="rotate(-45 11 8.5)"
          {...body(id)}
        />
        <rect
          x="11"
          y="8.5"
          width="8.5"
          height="4.5"
          rx="0.6"
          transform="rotate(-45 11 8.5)"
          {...outline(a, 1.3)}
        />
        <path d="m14 4 6 6" {...outline(a, 1.8)} />
        <path d="m16.5 6.5 2-2" {...outline(a, 1.8)} />
        <path d="M13.5 9.5l-8 8M5 17l-1.5 1.5" {...outline(a, 1.5)} />
        <path d="m8 14 2 2" {...outline(a, 1.5)} />
        <circle cx="20.5" cy="3.5" r="0.6" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

export const TabanPrescription = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" {...body(id)} />
        <rect x="4" y="3" width="16" height="6" rx="2" {...shine(id)} />
        <rect x="4" y="3" width="16" height="18" rx="2" {...outline(a, 1.4)} />
        <path d="M8 8v6M8 8h2.5a1.5 1.5 0 0 1 0 3H8" {...outline(a, 1.6)} />
        <path
          d="m10.5 11 3 3M14 14l2.5 2.5"
          {...outline('#1A2C2A', 1.4)}
        />
        <path d="M12 18h5" {...outline(a, 1.4)} />
      </>
    )}
  </IconBase>
);

// ───────────────────────────────────────────────────────────────────────────
// Maternal & Child
// ───────────────────────────────────────────────────────────────────────────

export const TabanPregnant = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="12" cy="5" r="2.2" {...solid(id)} />
        <circle cx="11.5" cy="4.5" r="0.7" fill="#fff" fillOpacity="0.55" />
        <path
          d="M14 9c-1 0-1.6.4-2 1-.4-.6-1-1-2-1-1.5 0-3 1.5-3 4 0 1.8 1 3 2 3.5v4h5v-4c1.3-.4 2.8-1 2.8-3.5 0-2-1.3-4-2.8-4Z"
          {...body(id)}
        />
        <path
          d="M14 9c-1 0-1.6.4-2 1-.4-.6-1-1-2-1-1.5 0-3 1.5-3 4 0 1.8 1 3 2 3.5v4h5v-4c1.3-.4 2.8-1 2.8-3.5 0-2-1.3-4-2.8-4Z"
          {...outline(a, 1.4)}
        />
        <circle cx="14" cy="13" r="1.4" {...solid(id)} />
        <circle cx="13.6" cy="12.6" r="0.4" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

export const TabanBaby = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="12" cy="9" r="5" {...body(id)} />
        <circle cx="12" cy="9" r="5" {...outline(a, 1.4)} />
        <ellipse cx="10.5" cy="7" rx="2.5" ry="1.5" {...shine(id)} />
        <circle cx="10" cy="9" r="0.7" fill="#1A2C2A" />
        <circle cx="14" cy="9" r="0.7" fill="#1A2C2A" />
        <path
          d="M10.5 11.5c.4.4 1 .6 1.5.6s1.1-.2 1.5-.6"
          {...outline('#1A2C2A', 1.2)}
        />
        <path
          d="M9 14.5c-2 .8-3.5 2.5-3.5 5M15 14.5c2 .8 3.5 2.5 3.5 5"
          {...outline(a, 1.5)}
        />
      </>
    )}
  </IconBase>
);

export const TabanVaccine = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect
          x="8.5"
          y="10.5"
          width="8"
          height="3"
          rx="0.4"
          transform="rotate(-45 8.5 10.5)"
          {...body(id)}
        />
        <rect
          x="8.5"
          y="10.5"
          width="8"
          height="3"
          rx="0.4"
          transform="rotate(-45 8.5 10.5)"
          {...outline(a, 1.3)}
        />
        <path d="m16 3 5 5M18.5 5.5l2-2" {...outline(a, 1.8)} />
        <path d="M10 11l6 6M14 7l3 3" {...outline(a, 1.5)} />
        <path d="m3 21 4-4M6 14l4 4" {...outline(a, 1.5)} />
        <circle cx="20" cy="3.5" r="0.7" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

export const TabanGrowth = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M4 20h16" {...outline(a, 1.6)} />
        <path d="M4 20V6" {...outline(a, 1.6)} />
        <path
          d="M7 16v-3"
          stroke={a}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M11 16v-7"
          stroke={a}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M15 16v-4"
          stroke={a}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M19 16V5"
          stroke={a}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M4 13c2-1 4-1 6-3s4-3 6-3 2.5.5 4 1"
          {...outline('#1A2C2A', 1.4)}
        />
        <circle cx="20" cy="8" r="1.7" {...solid(id)} />
        <circle cx="19.5" cy="7.5" r="0.5" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

// ───────────────────────────────────────────────────────────────────────────
// Billing
// ───────────────────────────────────────────────────────────────────────────

export const TabanWallet = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" {...body(id)} />
        <rect x="3" y="6" width="18" height="4" rx="2.5" {...shine(id)} />
        <rect x="3" y="6" width="18" height="13" rx="2.5" {...outline(a, 1.4)} />
        <path d="M3 10h18" {...outline(a, 1.4)} />
        <circle cx="16.5" cy="14.5" r="1.4" {...solid(id)} />
        <circle cx="16.1" cy="14.1" r="0.4" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

export const TabanShield = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M12 3.5 5 6v5.5c0 4 2.8 7.6 7 9 4.2-1.4 7-5 7-9V6l-7-2.5Z"
          {...body(id)}
        />
        <path
          d="M12 3.5 5 6v5.5c0 4 2.8 7.6 7 9 4.2-1.4 7-5 7-9V6l-7-2.5Z"
          {...outline(a, 1.4)}
        />
        <path d="M5 6 12 3.5 12 11.5 5 13z" {...shine(id)} />
        <path d="m9 12 2 2 4-4" {...outline(a, 1.9)} />
      </>
    )}
  </IconBase>
);

export const TabanReceipt = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21V3Z"
          {...body(id)}
        />
        <path d="M5 3h14v6H5z" {...shine(id)} />
        <path
          d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21V3Z"
          {...outline(a, 1.4)}
        />
        <path d="M8 8h8M8 12h8M8 16h5" {...outline(a, 1.4)} />
      </>
    )}
  </IconBase>
);

export const TabanCreditCard = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="2" {...body(id)} />
        <rect x="2.5" y="6" width="19" height="3" rx="2" {...shine(id)} />
        <rect x="2.5" y="6" width="19" height="12" rx="2" {...outline(a, 1.4)} />
        <path d="M2.5 10.5h19" stroke={a} strokeWidth="2.2" />
        <path d="M6 14.5h3M12 14.5h5" {...outline(a, 1.5)} />
        <rect
          x="14"
          y="11.5"
          width="3"
          height="2"
          rx="0.4"
          fill={a}
          fillOpacity="0.4"
        />
      </>
    )}
  </IconBase>
);

export const TabanClaim = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          {...body(id)}
        />
        <path d="M6 3h8v6h5l-.5-.5L14 3H6Z" {...shine(id)} />
        <path
          d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          {...outline(a, 1.4)}
        />
        <path d="M14 3v5h5" {...outline(a, 1.4)} />
        <path d="M8 13h5M8 16h8" {...outline(a, 1.4)} />
        <circle
          cx="15.5"
          cy="13"
          r="2"
          fill="#fff"
          stroke={a}
          strokeWidth="1.4"
        />
        <path d="m16.8 14.3 1.5 1.5" {...outline(a, 1.6)} />
      </>
    )}
  </IconBase>
);

export const TabanMobileMoney = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="7" y="2.5" width="10" height="19" rx="2" {...body(id)} />
        <rect x="7" y="2.5" width="10" height="6" rx="2" {...shine(id)} />
        <rect x="7" y="2.5" width="10" height="19" rx="2" {...outline(a, 1.4)} />
        <path d="M10 5.5h4" {...outline(a, 1.6)} />
        <circle cx="12" cy="18.5" r="1.1" {...solid(id)} />
        <text
          x="12"
          y="14.5"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="800"
          fontSize="6.5"
          fill={a}
        >
          $
        </text>
      </>
    )}
  </IconBase>
);

// ───────────────────────────────────────────────────────────────────────────
// Patient / Navigation / UI
// ───────────────────────────────────────────────────────────────────────────

export const TabanPatient = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="12" cy="8" r="3.6" {...body(id)} />
        <circle cx="12" cy="8" r="3.6" {...outline(a, 1.4)} />
        <ellipse cx="10.8" cy="6.8" rx="1.6" ry="1" {...shine(id)} />
        <path
          d="M4.5 20c.5-3.8 3.8-6 7.5-6s7 2.2 7.5 6"
          {...body(id)}
        />
        <path
          d="M4.5 20c.5-3.8 3.8-6 7.5-6s7 2.2 7.5 6"
          {...outline(a, 1.4)}
        />
      </>
    )}
  </IconBase>
);

export const TabanRecord = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" {...body(id)} />
        <rect x="4" y="3" width="16" height="6" rx="2" {...shine(id)} />
        <rect x="4" y="3" width="16" height="18" rx="2" {...outline(a, 1.4)} />
        <path d="M8 8h8M8 12h8M8 16h5" {...outline(a, 1.4)} />
        <path d="M10 3h4v3h-4z" {...solid(id)} />
      </>
    )}
  </IconBase>
);

export const TabanReferral = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="2.5" y="5.5" width="8" height="13" rx="1.5" {...body(id)} />
        <rect
          x="2.5"
          y="5.5"
          width="8"
          height="13"
          rx="1.5"
          {...outline(a, 1.3)}
        />
        <rect x="13.5" y="5.5" width="8" height="13" rx="1.5" {...body(id)} />
        <rect
          x="13.5"
          y="5.5"
          width="8"
          height="13"
          rx="1.5"
          {...outline(a, 1.3)}
        />
        <rect x="2.5" y="5.5" width="8" height="3" rx="1.5" {...shine(id)} />
        <rect x="13.5" y="5.5" width="8" height="3" rx="1.5" {...shine(id)} />
        <path
          d="M10.8 12h2.5"
          stroke={a}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="m12 10.5 1.5 1.5-1.5 1.5"
          stroke={a}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanMessage = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z"
          {...body(id)}
        />
        <path
          d="M5 5h14a1 1 0 0 1 1 1v3H5V6a1 1 0 0 1 1-1Z"
          {...shine(id)}
        />
        <path
          d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z"
          {...outline(a, 1.4)}
        />
        <circle cx="9" cy="11" r="0.9" {...solid(id)} />
        <circle cx="12.5" cy="11" r="0.9" {...solid(id)} />
        <circle cx="16" cy="11" r="0.9" {...solid(id)} />
      </>
    )}
  </IconBase>
);

export const TabanAlert = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M12 3.5 2.5 20h19L12 3.5Z" {...body(id)} />
        <path d="M12 3.5 7 12h10L12 3.5Z" {...shine(id)} />
        <path d="M12 3.5 2.5 20h19L12 3.5Z" {...outline(a, 1.4)} />
        <path
          d="M12 10v4.5"
          stroke={a}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="17" r="1" {...solid(id)} />
      </>
    )}
  </IconBase>
);

export const TabanEdit = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M4 20h4l10-10-4-4L4 16v4Z" {...body(id)} />
        <path d="M4 20h4l10-10-4-4L4 16v4Z" {...outline(a, 1.4)} />
        <path d="m14 6 4 4" {...outline(a, 1.5)} />
        <path d="m17 3 4 4-2 2-4-4 2-2Z" {...solid(id)} />
        <path
          d="M5 17l1.5-1.5"
          stroke="#fff"
          strokeOpacity="0.5"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanTimeline = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M12 3v18" {...outline(a, 1.4)} />
        <circle cx="12" cy="6" r="2.4" {...solid(id)} />
        <circle cx="11.5" cy="5.5" r="0.6" fill="#fff" fillOpacity="0.55" />
        <circle cx="12" cy="12" r="2.4" {...body(id)} />
        <circle cx="12" cy="12" r="2.4" {...outline(a, 1.3)} />
        <circle cx="12" cy="18" r="2.4" {...body(id)} />
        <circle cx="12" cy="18" r="2.4" {...outline(a, 1.3)} />
        <path
          d="M14.5 6h5M14.5 12h3.5M14.5 18h5"
          {...outline(a, 1.5)}
        />
      </>
    )}
  </IconBase>
);

export const TabanChart = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" {...body(id)} />
        <rect x="3" y="3" width="18" height="6" rx="2" {...shine(id)} />
        <rect x="3" y="3" width="18" height="18" rx="2" {...outline(a, 1.4)} />
        <rect x="6" y="13" width="2.4" height="3" rx="0.5" {...solid(id)} />
        <rect x="10" y="10" width="2.4" height="6" rx="0.5" {...solid(id)} />
        <rect x="14" y="12" width="2.4" height="4" rx="0.5" {...solid(id)} />
      </>
    )}
  </IconBase>
);

export const TabanCalendar = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" {...body(id)} />
        <rect x="3.5" y="5" width="17" height="5" rx="2" {...solid(id)} />
        <rect x="3.5" y="5" width="17" height="15" rx="2" {...outline(a, 1.4)} />
        <path d="M3.5 10h17" {...outline(a, 1.4)} />
        <path
          d="M8 3v4M16 3v4"
          stroke="#1A2C2A"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="8" cy="14.5" r="1.1" {...solid(id)} />
        <circle cx="12" cy="14.5" r="1.1" fill={a} fillOpacity="0.45" />
        <circle cx="16" cy="14.5" r="1.1" fill={a} fillOpacity="0.45" />
      </>
    )}
  </IconBase>
);

export const TabanClock = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="12" cy="12" r="9" {...body(id)} />
        <circle cx="12" cy="12" r="9" {...outline(a, 1.4)} />
        <ellipse cx="9" cy="8" rx="5" ry="3" {...shine(id)} />
        <path d="M12 7v5.2l3 2" {...outline(a, 1.8)} />
        <circle cx="12" cy="12" r="0.9" {...solid(id)} />
      </>
    )}
  </IconBase>
);

export const TabanBuilding = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M6 20V7l6-3 6 3v13" {...body(id)} />
        <path d="M6 7l6-3 6 3v3H6V7Z" {...shine(id)} />
        <path d="M6 20V7l6-3 6 3v13" {...outline(a, 1.4)} />
        <path d="M4 20h16" {...outline(a, 1.6)} />
        <path d="M10 20v-4h4v4" {...outline(a, 1.4)} />
        <rect
          x="8.3"
          y="9.3"
          width="1.4"
          height="1.4"
          rx="0.2"
          {...solid(id)}
        />
        <rect
          x="11.3"
          y="9.3"
          width="1.4"
          height="1.4"
          rx="0.2"
          {...solid(id)}
        />
        <rect
          x="14.3"
          y="9.3"
          width="1.4"
          height="1.4"
          rx="0.2"
          {...solid(id)}
        />
        <rect
          x="8.3"
          y="12.3"
          width="1.4"
          height="1.4"
          rx="0.2"
          fill={a}
          fillOpacity="0.5"
        />
        <rect
          x="14.3"
          y="12.3"
          width="1.4"
          height="1.4"
          rx="0.2"
          fill={a}
          fillOpacity="0.5"
        />
      </>
    )}
  </IconBase>
);

export const TabanMapPin = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M12 2.5c-3.9 0-7 3-7 6.8 0 5 7 12.2 7 12.2s7-7.2 7-12.2c0-3.7-3.1-6.8-7-6.8Z"
          {...body(id)}
        />
        <path
          d="M12 2.5c-3.9 0-7 3-7 6.8 0 1.2.4 2.4 1 3.5l6 9 6-9c.6-1.1 1-2.3 1-3.5 0-3.7-3.1-6.8-7-6.8Z"
          {...shine(id)}
        />
        <path
          d="M12 2.5c-3.9 0-7 3-7 6.8 0 5 7 12.2 7 12.2s7-7.2 7-12.2c0-3.7-3.1-6.8-7-6.8Z"
          {...outline(a, 1.4)}
        />
        <circle cx="12" cy="9.5" r="2.7" {...solid(id)} />
        <circle cx="11.4" cy="8.9" r="0.7" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

export const TabanSearch = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="11" cy="11" r="6.8" {...body(id)} />
        <circle cx="11" cy="11" r="6.8" {...outline(a, 1.4)} />
        <ellipse cx="9" cy="8" rx="3.5" ry="2" {...shine(id)} />
        <path
          d="m16 16 4.5 4.5"
          stroke={a}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </>
    )}
  </IconBase>
);

export const TabanCheck = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="12" cy="12" r="9" {...body(id)} />
        <circle cx="12" cy="12" r="9" {...outline(a, 1.4)} />
        <ellipse cx="9" cy="8" rx="5.5" ry="3" {...shine(id)} />
        <path
          d="m7.5 12 3 3 6-6"
          stroke={a}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanQR = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" {...body(id)} />
        <rect x="3" y="3" width="7" height="7" rx="1" {...outline(a, 1.3)} />
        <rect x="14" y="3" width="7" height="7" rx="1" {...body(id)} />
        <rect x="14" y="3" width="7" height="7" rx="1" {...outline(a, 1.3)} />
        <rect x="3" y="14" width="7" height="7" rx="1" {...body(id)} />
        <rect x="3" y="14" width="7" height="7" rx="1" {...outline(a, 1.3)} />
        <rect x="5.5" y="5.5" width="2" height="2" rx="0.3" {...solid(id)} />
        <rect x="16.5" y="5.5" width="2" height="2" rx="0.3" {...solid(id)} />
        <rect x="5.5" y="16.5" width="2" height="2" rx="0.3" {...solid(id)} />
        <path
          d="M14 14h3v3M14 18h1M17 14v3M19 14v1M19 17h2M17 19v2"
          stroke={a}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanWifi = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M3 9c5-4 13-4 18 0" {...outline(a, 1.6)} />
        <path d="M6 13c3.5-2.5 8.5-2.5 12 0" {...outline(a, 1.8)} />
        <path d="M9 17c2-1.3 4-1.3 6 0" {...outline(a, 1.8)} />
        <circle cx="12" cy="20" r="1.5" {...solid(id)} />
        <circle cx="11.6" cy="19.6" r="0.4" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

export const TabanPhone = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M5 4.5h3l2 5-2 1.5a11 11 0 0 0 5 5l1.5-2 5 2v3c0 1.1-.9 2-2 2A16 16 0 0 1 3 6.5c0-1.1.9-2 2-2Z"
          {...body(id)}
        />
        <path
          d="M5 4.5h3l2 5-2 1.5C8 11.5 7 11 6 10c-1-1-1.5-2-2.5-3.5C3.5 5.4 4 4.5 5 4.5Z"
          {...shine(id)}
        />
        <path
          d="M5 4.5h3l2 5-2 1.5a11 11 0 0 0 5 5l1.5-2 5 2v3c0 1.1-.9 2-2 2A16 16 0 0 1 3 6.5c0-1.1.9-2 2-2Z"
          {...outline(a, 1.4)}
        />
      </>
    )}
  </IconBase>
);

export const TabanPrinter = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path d="M7 9V4h10v5" {...outline(a, 1.4)} />
        <rect x="3.5" y="9" width="17" height="8" rx="1.5" {...body(id)} />
        <rect x="3.5" y="9" width="17" height="3" rx="1.5" {...shine(id)} />
        <rect x="3.5" y="9" width="17" height="8" rx="1.5" {...outline(a, 1.4)} />
        <rect
          x="7"
          y="14"
          width="10"
          height="6"
          rx="1"
          fill="#fff"
          stroke={a}
          strokeWidth="1.4"
        />
        <circle cx="17" cy="12" r="0.9" {...solid(id)} />
        <path d="M9 17h6M9 19h4" {...outline(a, 1.2)} />
      </>
    )}
  </IconBase>
);

export const TabanDownload = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          {...body(id)}
        />
        <path
          d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          {...outline(a, 1.4)}
        />
        <path d="M12 3v12" {...outline(a, 1.6)} />
        <path
          d="m7 10 5 5 5-5"
          stroke={a}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanPlus = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <circle cx="12" cy="12" r="9" {...body(id)} />
        <ellipse cx="9" cy="8" rx="5.5" ry="3" {...shine(id)} />
        <circle cx="12" cy="12" r="9" {...outline(a, 1.4)} />
        <path
          d="M12 8v8M8 12h8"
          stroke={a}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </>
    )}
  </IconBase>
);

export const TabanArrowLeft = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ a }) => (
      <>
        <path d="M3 12h18" {...outline(a, 1.6)} />
        <path
          d="m10 5-7 7 7 7"
          stroke={a}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    )}
  </IconBase>
);

export const TabanChevronRight = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ a }) => (
      <path
        d="m9 5 7 7-7 7"
        stroke={a}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    )}
  </IconBase>
);

export const TabanSparkle = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <path
          d="M12 3c0 3.5 2 6 6 7-4 1-6 3.5-6 7 0-3.5-2-6-6-7 4-1 6-3.5 6-7Z"
          {...body(id)}
        />
        <path
          d="M12 3c0 3.5 2 6 6 7-4 1-6 3.5-6 7 0-3.5-2-6-6-7 4-1 6-3.5 6-7Z"
          {...outline(a, 1.4)}
        />
        <path
          d="M19 3.5c0 1.4.8 2.4 2.4 2.8-1.6.4-2.4 1.4-2.4 2.8 0-1.4-.8-2.4-2.4-2.8 1.6-.4 2.4-1.4 2.4-2.8Z"
          {...solid(id)}
        />
        <circle cx="11" cy="7" r="0.6" fill="#fff" fillOpacity="0.7" />
      </>
    )}
  </IconBase>
);

export const TabanDiagnosis = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" {...body(id)} />
        <rect x="3" y="4" width="18" height="5" rx="2" {...shine(id)} />
        <rect x="3" y="4" width="18" height="16" rx="2" {...outline(a, 1.4)} />
        <circle
          cx="12"
          cy="12"
          r="3.7"
          fill="#fff"
          stroke={a}
          strokeWidth="1.4"
        />
        <path
          d="M12 9.5v5M9.5 12h5"
          stroke={a}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </>
    )}
  </IconBase>
);

// ───────────────────────────────────────────────────────────────────────────
// Registry — name → component + category accent
// ───────────────────────────────────────────────────────────────────────────

export interface TabanRegistryEntry {
  Component: (p: TabanIconProps) => ReactNode;
  category: TabanCategory;
  label: string;
}

export const TABAN_ICONS: Record<string, TabanRegistryEntry> = {
  // Vitals
  heart: { Component: TabanHeart, category: 'Vitals', label: 'Heart' },
  pulse: { Component: TabanPulse, category: 'Vitals', label: 'Pulse / ECG' },
  bloodPressure: { Component: TabanBloodPressure, category: 'Vitals', label: 'Blood Pressure' },
  oxygen: { Component: TabanOxygen, category: 'Vitals', label: 'Oxygen Sat' },
  thermometer: { Component: TabanThermometer, category: 'Vitals', label: 'Temperature' },
  lungs: { Component: TabanLungs, category: 'Vitals', label: 'Lungs' },
  brain: { Component: TabanBrain, category: 'Vitals', label: 'Neurological' },
  weight: { Component: TabanWeight, category: 'Vitals', label: 'Weight / BMI' },
  // Clinical
  stethoscope: { Component: TabanStethoscope, category: 'Clinical', label: 'Consultation' },
  diagnosis: { Component: TabanDiagnosis, category: 'Clinical', label: 'Diagnosis' },
  record: { Component: TabanRecord, category: 'Clinical', label: 'Medical Record' },
  referral: { Component: TabanReferral, category: 'Clinical', label: 'Referral' },
  prescription: { Component: TabanPrescription, category: 'Clinical', label: 'Prescription' },
  sparkle: { Component: TabanSparkle, category: 'Clinical', label: 'AI Assist' },
  alert: { Component: TabanAlert, category: 'Clinical', label: 'Clinical Alert' },
  // Lab & Pharmacy
  flask: { Component: TabanFlask, category: 'Lab & Pharmacy', label: 'Lab Order' },
  testTube: { Component: TabanTestTube, category: 'Lab & Pharmacy', label: 'Specimen' },
  microscope: { Component: TabanMicroscope, category: 'Lab & Pharmacy', label: 'Microscopy' },
  pill: { Component: TabanPill, category: 'Lab & Pharmacy', label: 'Medication' },
  syringe: { Component: TabanSyringe, category: 'Lab & Pharmacy', label: 'Injection' },
  // Maternal & Child
  pregnant: { Component: TabanPregnant, category: 'Maternal & Child', label: 'Antenatal Care' },
  baby: { Component: TabanBaby, category: 'Maternal & Child', label: 'Newborn' },
  vaccine: { Component: TabanVaccine, category: 'Maternal & Child', label: 'Immunization' },
  growth: { Component: TabanGrowth, category: 'Maternal & Child', label: 'Growth Curve' },
  // Billing
  wallet: { Component: TabanWallet, category: 'Billing', label: 'Wallet / Balance' },
  shield: { Component: TabanShield, category: 'Billing', label: 'Insurance' },
  receipt: { Component: TabanReceipt, category: 'Billing', label: 'Receipt' },
  creditCard: { Component: TabanCreditCard, category: 'Billing', label: 'Card Payment' },
  claim: { Component: TabanClaim, category: 'Billing', label: 'Claim' },
  mobileMoney: { Component: TabanMobileMoney, category: 'Billing', label: 'Mobile Money' },
  // Navigation
  patient: { Component: TabanPatient, category: 'Navigation', label: 'Patient' },
  timeline: { Component: TabanTimeline, category: 'Navigation', label: 'Timeline' },
  chart: { Component: TabanChart, category: 'Navigation', label: 'Analytics' },
  calendar: { Component: TabanCalendar, category: 'Navigation', label: 'Appointment' },
  clock: { Component: TabanClock, category: 'Navigation', label: 'Recent' },
  message: { Component: TabanMessage, category: 'Navigation', label: 'Messages' },
  building: { Component: TabanBuilding, category: 'Navigation', label: 'Facility' },
  mapPin: { Component: TabanMapPin, category: 'Navigation', label: 'Location' },
  search: { Component: TabanSearch, category: 'Navigation', label: 'Search' },
  check: { Component: TabanCheck, category: 'Navigation', label: 'Success' },
  qr: { Component: TabanQR, category: 'Navigation', label: 'Geocode ID' },
  wifi: { Component: TabanWifi, category: 'Navigation', label: 'Sync Status' },
  phone: { Component: TabanPhone, category: 'Navigation', label: 'Phone' },
  printer: { Component: TabanPrinter, category: 'Navigation', label: 'Print' },
  download: { Component: TabanDownload, category: 'Navigation', label: 'Export' },
  plus: { Component: TabanPlus, category: 'Navigation', label: 'Add' },
  arrowLeft: { Component: TabanArrowLeft, category: 'Navigation', label: 'Back' },
  chevronRight: { Component: TabanChevronRight, category: 'Navigation', label: 'Chevron' },
  edit: { Component: TabanEdit, category: 'Navigation', label: 'Edit' },
};

export function tabanAccentFor(name: string): string {
  const entry = TABAN_ICONS[name];
  if (!entry) return TABAN_ACCENT_DEFAULT;
  return TABAN_CATEGORY_ACCENTS[entry.category].base;
}

export function hasTabanIcon(name: string): boolean {
  return name in TABAN_ICONS;
}
