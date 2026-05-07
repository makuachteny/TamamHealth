import React, { useId, type ReactNode } from 'react';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  G,
  Path,
  Rect,
  Circle,
  Ellipse,
  Text as SvgText,
} from 'react-native-svg';

// Taban Icon Library v2 (React Native port)
// Uses react-native-svg. Filter-based drop shadows are not supported on RN,
// so the lighting/shadow layer is omitted; gradients + accent shine remain.

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

export interface TabanIconProps {
  size?: number;
  accent?: string;
  /** Alias for accent. */
  color?: string;
}

type Ctx = { id: string; a: string };

interface IconBaseProps extends TabanIconProps {
  children: (ctx: Ctx) => ReactNode;
}

function IconBase({ size = 24, accent, color, children }: IconBaseProps) {
  const rawId = useId();
  const id = `t${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const a = accent || color || TABAN_ACCENT_DEFAULT;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={a} stopOpacity="0.42" />
          <Stop offset="0.55" stopColor={a} stopOpacity="0.25" />
          <Stop offset="1" stopColor={a} stopOpacity="0.14" />
        </LinearGradient>
        <LinearGradient id={`${id}-accent`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={a} stopOpacity="1" />
          <Stop offset="1" stopColor={a} stopOpacity="0.78" />
        </LinearGradient>
        <RadialGradient
          id={`${id}-shine`}
          cx="0.3"
          cy="0.2"
          r="0.7"
          gradientUnits="objectBoundingBox"
        >
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <Stop offset="0.55" stopColor="#ffffff" stopOpacity="0.08" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G>{children({ id, a })}</G>
    </Svg>
  );
}

const bodyFill = (id: string) => `url(#${id}-body)`;
const shineFill = (id: string) => `url(#${id}-shine)`;
const solidFill = (id: string) => `url(#${id}-accent)`;

const STROKE_PROPS = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

// ───────────────────────────────────────────────────────────────────────────
// Vitals
// ───────────────────────────────────────────────────────────────────────────

export const TabanHeart = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M12 20.5c-.7 0-1.4-.25-1.95-.72l-6.2-5.5A5.25 5.25 0 0 1 9.5 5.5c1.05 0 2.05.35 2.5.95.45-.6 1.45-.95 2.5-.95a5.25 5.25 0 0 1 5.65 8.78l-6.2 5.5c-.55.47-1.25.72-1.95.72Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M12 20.5c-.7 0-1.4-.25-1.95-.72l-6.2-5.5A5.25 5.25 0 0 1 9.5 5.5c1.05 0 2.05.35 2.5.95.45-.6 1.45-.95 2.5-.95a5.25 5.25 0 0 1 5.65 8.78l-6.2 5.5c-.55.47-1.25.72-1.95.72Z"
          stroke={a}
          strokeWidth="1.4"
          {...STROKE_PROPS}
        />
        <Path
          d="M6.5 12.5h2.3l1.1-2 1.8 4 1.3-2.4h4.5"
          stroke={a}
          strokeWidth="1.7"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
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
        <Rect x="2.5" y="6" width="19" height="12" rx="2.5" fill={bodyFill(id)} />
        <Rect
          x="2.5"
          y="6"
          width="19"
          height="12"
          rx="2.5"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Rect x="2.5" y="6" width="19" height="6" rx="2.5" fill={shineFill(id)} />
        <Path
          d="M4.5 12h3l1.2-3 2.3 6 1.6-4 1.2 2 1.1-1h4.6"
          stroke={a}
          strokeWidth="1.8"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanStethoscope = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Circle cx="17" cy="15" r="2.7" fill={solidFill(id)} />
        <Circle cx="17" cy="15" r="2.7" stroke={a} strokeWidth="1.4" fill="none" />
        <Circle cx="16.4" cy="14.4" r="0.8" fill="#fff" fillOpacity="0.55" />
        <Path d="M6 3v5a4 4 0 0 0 8 0V3" fill={bodyFill(id)} />
        <Path
          d="M6 3v5a4 4 0 0 0 8 0V3"
          stroke={a}
          strokeWidth="1.6"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M6 3h1.5M12.5 3H14"
          stroke={a}
          strokeWidth="1.8"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M10 12v2a4.5 4.5 0 0 0 4.5 4.5H17"
          stroke={a}
          strokeWidth="1.6"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanLungs = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M9 8c0 3-2.5 4-3.5 6.5-.9 2.25.5 4.5 2.5 4.5 1.8 0 3-1.2 3-3V8"
          fill={bodyFill(id)}
        />
        <Path
          d="M15 8c0 3 2.5 4 3.5 6.5.9 2.25-.5 4.5-2.5 4.5-1.8 0-3-1.2-3-3V8"
          fill={bodyFill(id)}
        />
        <Path
          d="M9 8c0 3-2.5 4-3.5 6.5-.9 2.25.5 4.5 2.5 4.5 1.8 0 3-1.2 3-3V8"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M15 8c0 3 2.5 4 3.5 6.5.9 2.25-.5 4.5-2.5 4.5-1.8 0-3-1.2-3-3V8"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M12 4v8.5" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
      </>
    )}
  </IconBase>
);

export const TabanThermometer = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M14 4a2 2 0 0 0-4 0v10.2a3.5 3.5 0 1 0 4 0V4Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M14 4a2 2 0 0 0-4 0v10.2a3.5 3.5 0 1 0 4 0V4Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="12" cy="17" r="1.8" fill={solidFill(id)} />
        <Circle cx="11.4" cy="16.4" r="0.5" fill="#fff" fillOpacity="0.55" />
        <Path d="M12 7v7" stroke={a} strokeWidth="1.5" fill="none" {...STROKE_PROPS} />
      </>
    )}
  </IconBase>
);

export const TabanBloodPressure = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="3" y="8" width="13" height="8" rx="1.8" fill={bodyFill(id)} />
        <Rect x="3" y="8" width="13" height="3" rx="1.8" fill={shineFill(id)} />
        <Rect
          x="3"
          y="8"
          width="13"
          height="8"
          rx="1.8"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M6 12h2l1-2 1.5 4 1-2h3.5"
          stroke="#1A2C2A"
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M16 12h5M18.5 9.5v5"
          stroke={a}
          strokeWidth="1.6"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanOxygen = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Circle cx="12" cy="12" r="8.5" fill={bodyFill(id)} />
        <Circle cx="12" cy="12" r="8.5" stroke={a} strokeWidth="1.4" fill="none" />
        <Ellipse cx="9" cy="8.5" rx="5" ry="3" fill={shineFill(id)} />
        <SvgText
          x="12"
          y="15.5"
          textAnchor="middle"
          fontWeight="800"
          fontSize="7.5"
          fill={a}
        >
          O₂
        </SvgText>
      </>
    )}
  </IconBase>
);

export const TabanBrain = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M12 4.5c-1-1.2-3.2-1.2-4.5.2-.8.9-.7 1.8-.4 2.4-1.1.3-2 1.3-2 2.6 0 .9.4 1.6 1 2-.6.5-1 1.2-1 2.1 0 1.4 1.1 2.5 2.4 2.7.1 1.3 1.1 2.3 2.6 2.3 1 0 1.7-.4 2-1V4.5Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M12 4.5c1-1.2 3.2-1.2 4.5.2.8.9.7 1.8.4 2.4 1.1.3 2 1.3 2 2.6 0 .9-.4 1.6-1 2 .6.5 1 1.2 1 2.1 0 1.4-1.1 2.5-2.4 2.7-.1 1.3-1.1 2.3-2.6 2.3-1 0-1.7-.4-2-1V4.5Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M12 4.5c-1-1.2-3.2-1.2-4.5.2-.8.9-.7 1.8-.4 2.4-1.1.3-2 1.3-2 2.6 0 .9.4 1.6 1 2-.6.5-1 1.2-1 2.1 0 1.4 1.1 2.5 2.4 2.7.1 1.3 1.1 2.3 2.6 2.3 1 0 1.7-.4 2-1V4.5Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M12 4.5c1-1.2 3.2-1.2 4.5.2.8.9.7 1.8.4 2.4 1.1.3 2 1.3 2 2.6 0 .9-.4 1.6-1 2 .6.5 1 1.2 1 2.1 0 1.4-1.1 2.5-2.4 2.7-.1 1.3-1.1 2.3-2.6 2.3-1 0-1.7-.4-2-1V4.5Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M9.5 9c.5.3.8.8.8 1.4M14.5 9c-.5.3-.8.8-.8 1.4M12 13v2"
          stroke={a}
          strokeWidth="1.3"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanWeight = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M4.5 7.5h15l-1.2 11.3a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z"
          fill={bodyFill(id)}
        />
        <Path d="M4.5 7.5h15l-.4 3.5H4.9L4.5 7.5Z" fill={shineFill(id)} />
        <Path
          d="M4.5 7.5h15l-1.2 11.3a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M9 7.5a3 3 0 1 1 6 0"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M10.5 12.5 12 15l1.5-2.5"
          stroke={a}
          strokeWidth="1.6"
          fill="none"
          {...STROKE_PROPS}
        />
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
        <Path
          d="M9 3h6v4.5l4.2 9A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.2-3.5L9 7.5V3Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M5.6 14.5h12.8l.8 2A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.2-3.5l.8-2Z"
          fill={a}
          fillOpacity="0.55"
        />
        <Path
          d="M9 3h6v4.5l4.2 9A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.2-3.5L9 7.5V3Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M7.5 3h9" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Circle cx="10" cy="17" r="0.8" fill="#fff" fillOpacity="0.7" />
        <Circle cx="13.5" cy="16" r="0.6" fill="#fff" fillOpacity="0.7" />
        <Circle cx="14.5" cy="18" r="0.5" fill="#fff" fillOpacity="0.5" />
      </>
    )}
  </IconBase>
);

export const TabanTestTube = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M8.5 3h7v13.5a3.5 3.5 0 0 1-7 0V3Z" fill={bodyFill(id)} />
        <Path
          d="M8.5 12h7v4.5a3.5 3.5 0 0 1-7 0V12Z"
          fill={a}
          fillOpacity="0.5"
        />
        <Path
          d="M8.5 3h7v13.5a3.5 3.5 0 0 1-7 0V3Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M7.5 3h9" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Circle cx="10.5" cy="16" r="0.7" fill="#fff" fillOpacity="0.7" />
        <Circle cx="13" cy="15" r="0.5" fill="#fff" fillOpacity="0.7" />
      </>
    )}
  </IconBase>
);

export const TabanMicroscope = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M9.5 3.5 14 5.5l-2 4-4.5-2 2-4Z" fill={bodyFill(id)} />
        <Path
          d="M9.5 3.5 14 5.5l-2 4-4.5-2 2-4Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="m10.5 9.5-2.5 5"
          stroke={a}
          strokeWidth="1.6"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M6 16h7" stroke={a} strokeWidth="1.8" fill="none" {...STROKE_PROPS} />
        <Path d="M4 20h16" stroke={a} strokeWidth="1.8" fill="none" {...STROKE_PROPS} />
        <Path
          d="M12 16a4 4 0 0 0 4-4"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="11" cy="6" r="0.6" fill="#fff" fillOpacity="0.7" />
      </>
    )}
  </IconBase>
);

export const TabanPill = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="3" y="8" width="18" height="8" rx="4" fill={bodyFill(id)} />
        <Rect x="12" y="8" width="9" height="8" rx="4" fill={a} fillOpacity="0.55" />
        <Rect x="3" y="8" width="18" height="3.5" rx="4" fill={shineFill(id)} />
        <Rect
          x="3"
          y="8"
          width="18"
          height="8"
          rx="4"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Path d="M12 8v8" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
      </>
    )}
  </IconBase>
);

export const TabanSyringe = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect
          x="11"
          y="8.5"
          width="8.5"
          height="4.5"
          rx="0.6"
          transform="rotate(-45 11 8.5)"
          fill={bodyFill(id)}
        />
        <Rect
          x="11"
          y="8.5"
          width="8.5"
          height="4.5"
          rx="0.6"
          transform="rotate(-45 11 8.5)"
          stroke={a}
          strokeWidth="1.3"
          fill="none"
        />
        <Path d="m14 4 6 6" stroke={a} strokeWidth="1.8" fill="none" {...STROKE_PROPS} />
        <Path
          d="m16.5 6.5 2-2"
          stroke={a}
          strokeWidth="1.8"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M13.5 9.5l-8 8M5 17l-1.5 1.5"
          stroke={a}
          strokeWidth="1.5"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="m8 14 2 2" stroke={a} strokeWidth="1.5" fill="none" {...STROKE_PROPS} />
      </>
    )}
  </IconBase>
);

export const TabanPrescription = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="4" y="3" width="16" height="18" rx="2" fill={bodyFill(id)} />
        <Rect x="4" y="3" width="16" height="6" rx="2" fill={shineFill(id)} />
        <Rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Path
          d="M8 8v6M8 8h2.5a1.5 1.5 0 0 1 0 3H8"
          stroke={a}
          strokeWidth="1.6"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="m10.5 11 3 3M14 14l2.5 2.5"
          stroke="#1A2C2A"
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M12 18h5" stroke={a} strokeWidth="1.4" fill="none" {...STROKE_PROPS} />
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
        <Circle cx="12" cy="5" r="2.2" fill={solidFill(id)} />
        <Circle cx="11.5" cy="4.5" r="0.7" fill="#fff" fillOpacity="0.55" />
        <Path
          d="M14 9c-1 0-1.6.4-2 1-.4-.6-1-1-2-1-1.5 0-3 1.5-3 4 0 1.8 1 3 2 3.5v4h5v-4c1.3-.4 2.8-1 2.8-3.5 0-2-1.3-4-2.8-4Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M14 9c-1 0-1.6.4-2 1-.4-.6-1-1-2-1-1.5 0-3 1.5-3 4 0 1.8 1 3 2 3.5v4h5v-4c1.3-.4 2.8-1 2.8-3.5 0-2-1.3-4-2.8-4Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="14" cy="13" r="1.4" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanBaby = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Circle cx="12" cy="9" r="5" fill={bodyFill(id)} />
        <Circle cx="12" cy="9" r="5" stroke={a} strokeWidth="1.4" fill="none" />
        <Ellipse cx="10.5" cy="7" rx="2.5" ry="1.5" fill={shineFill(id)} />
        <Circle cx="10" cy="9" r="0.7" fill="#1A2C2A" />
        <Circle cx="14" cy="9" r="0.7" fill="#1A2C2A" />
        <Path
          d="M10.5 11.5c.4.4 1 .6 1.5.6s1.1-.2 1.5-.6"
          stroke="#1A2C2A"
          strokeWidth="1.2"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M9 14.5c-2 .8-3.5 2.5-3.5 5M15 14.5c2 .8 3.5 2.5 3.5 5"
          stroke={a}
          strokeWidth="1.5"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanVaccine = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect
          x="8.5"
          y="10.5"
          width="8"
          height="3"
          rx="0.4"
          transform="rotate(-45 8.5 10.5)"
          fill={bodyFill(id)}
        />
        <Rect
          x="8.5"
          y="10.5"
          width="8"
          height="3"
          rx="0.4"
          transform="rotate(-45 8.5 10.5)"
          stroke={a}
          strokeWidth="1.3"
          fill="none"
        />
        <Path
          d="m16 3 5 5M18.5 5.5l2-2"
          stroke={a}
          strokeWidth="1.8"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M10 11l6 6M14 7l3 3"
          stroke={a}
          strokeWidth="1.5"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="m3 21 4-4M6 14l4 4"
          stroke={a}
          strokeWidth="1.5"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanGrowth = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M4 20h16" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Path d="M4 20V6" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Path d="M7 16v-3" stroke={a} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.85" />
        <Path d="M11 16v-7" stroke={a} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.85" />
        <Path d="M15 16v-4" stroke={a} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.85" />
        <Path d="M19 16V5" stroke={a} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.85" />
        <Path
          d="M4 13c2-1 4-1 6-3s4-3 6-3 2.5.5 4 1"
          stroke="#1A2C2A"
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="20" cy="8" r="1.7" fill={solidFill(id)} />
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
        <Rect x="3" y="6" width="18" height="13" rx="2.5" fill={bodyFill(id)} />
        <Rect x="3" y="6" width="18" height="4" rx="2.5" fill={shineFill(id)} />
        <Rect
          x="3"
          y="6"
          width="18"
          height="13"
          rx="2.5"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Path d="M3 10h18" stroke={a} strokeWidth="1.4" fill="none" {...STROKE_PROPS} />
        <Circle cx="16.5" cy="14.5" r="1.4" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanShield = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M12 3.5 5 6v5.5c0 4 2.8 7.6 7 9 4.2-1.4 7-5 7-9V6l-7-2.5Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M12 3.5 5 6v5.5c0 4 2.8 7.6 7 9 4.2-1.4 7-5 7-9V6l-7-2.5Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M5 6 12 3.5 12 11.5 5 13z" fill={shineFill(id)} />
        <Path
          d="m9 12 2 2 4-4"
          stroke={a}
          strokeWidth="1.9"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanReceipt = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21V3Z"
          fill={bodyFill(id)}
        />
        <Path d="M5 3h14v6H5z" fill={shineFill(id)} />
        <Path
          d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21V3Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M8 8h8M8 12h8M8 16h5"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanCreditCard = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="2.5" y="6" width="19" height="12" rx="2" fill={bodyFill(id)} />
        <Rect x="2.5" y="6" width="19" height="3" rx="2" fill={shineFill(id)} />
        <Rect
          x="2.5"
          y="6"
          width="19"
          height="12"
          rx="2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Path d="M2.5 10.5h19" stroke={a} strokeWidth="2.2" />
        <Path
          d="M6 14.5h3M12 14.5h5"
          stroke={a}
          strokeWidth="1.5"
          fill="none"
          {...STROKE_PROPS}
        />
        <Rect
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
        <Path
          d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          fill={bodyFill(id)}
        />
        <Path d="M6 3h8v6h5l-.5-.5L14 3H6Z" fill={shineFill(id)} />
        <Path
          d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M14 3v5h5" stroke={a} strokeWidth="1.4" fill="none" {...STROKE_PROPS} />
        <Path
          d="M8 13h5M8 16h8"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="15.5" cy="13" r="2" fill="#fff" stroke={a} strokeWidth="1.4" />
        <Path
          d="m16.8 14.3 1.5 1.5"
          stroke={a}
          strokeWidth="1.6"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanMobileMoney = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="7" y="2.5" width="10" height="19" rx="2" fill={bodyFill(id)} />
        <Rect x="7" y="2.5" width="10" height="6" rx="2" fill={shineFill(id)} />
        <Rect
          x="7"
          y="2.5"
          width="10"
          height="19"
          rx="2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Path d="M10 5.5h4" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Circle cx="12" cy="18.5" r="1.1" fill={solidFill(id)} />
        <SvgText
          x="12"
          y="14.5"
          textAnchor="middle"
          fontWeight="800"
          fontSize="6.5"
          fill={a}
        >
          $
        </SvgText>
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
        <Circle cx="12" cy="8" r="3.6" fill={bodyFill(id)} />
        <Circle cx="12" cy="8" r="3.6" stroke={a} strokeWidth="1.4" fill="none" />
        <Ellipse cx="10.8" cy="6.8" rx="1.6" ry="1" fill={shineFill(id)} />
        <Path
          d="M4.5 20c.5-3.8 3.8-6 7.5-6s7 2.2 7.5 6"
          fill={bodyFill(id)}
        />
        <Path
          d="M4.5 20c.5-3.8 3.8-6 7.5-6s7 2.2 7.5 6"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanRecord = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="4" y="3" width="16" height="18" rx="2" fill={bodyFill(id)} />
        <Rect x="4" y="3" width="16" height="6" rx="2" fill={shineFill(id)} />
        <Rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Path
          d="M8 8h8M8 12h8M8 16h5"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M10 3h4v3h-4z" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanReferral = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="2.5" y="5.5" width="8" height="13" rx="1.5" fill={bodyFill(id)} />
        <Rect
          x="2.5"
          y="5.5"
          width="8"
          height="13"
          rx="1.5"
          stroke={a}
          strokeWidth="1.3"
          fill="none"
        />
        <Rect x="13.5" y="5.5" width="8" height="13" rx="1.5" fill={bodyFill(id)} />
        <Rect
          x="13.5"
          y="5.5"
          width="8"
          height="13"
          rx="1.5"
          stroke={a}
          strokeWidth="1.3"
          fill="none"
        />
        <Rect x="2.5" y="5.5" width="8" height="3" rx="1.5" fill={shineFill(id)} />
        <Rect x="13.5" y="5.5" width="8" height="3" rx="1.5" fill={shineFill(id)} />
        <Path d="M10.8 12h2.5" stroke={a} strokeWidth="2.2" strokeLinecap="round" />
        <Path
          d="m12 10.5 1.5 1.5-1.5 1.5"
          stroke={a}
          strokeWidth="2"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanMessage = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M5 5h14a1 1 0 0 1 1 1v3H5V6a1 1 0 0 1 1-1Z"
          fill={shineFill(id)}
        />
        <Path
          d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="9" cy="11" r="0.9" fill={solidFill(id)} />
        <Circle cx="12.5" cy="11" r="0.9" fill={solidFill(id)} />
        <Circle cx="16" cy="11" r="0.9" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanAlert = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M12 3.5 2.5 20h19L12 3.5Z" fill={bodyFill(id)} />
        <Path d="M12 3.5 7 12h10L12 3.5Z" fill={shineFill(id)} />
        <Path
          d="M12 3.5 2.5 20h19L12 3.5Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M12 10v4.5" stroke={a} strokeWidth="2.2" strokeLinecap="round" />
        <Circle cx="12" cy="17" r="1" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanEdit = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M4 20h4l10-10-4-4L4 16v4Z" fill={bodyFill(id)} />
        <Path
          d="M4 20h4l10-10-4-4L4 16v4Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="m14 6 4 4" stroke={a} strokeWidth="1.5" fill="none" {...STROKE_PROPS} />
        <Path d="m17 3 4 4-2 2-4-4 2-2Z" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanTimeline = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M12 3v18" stroke={a} strokeWidth="1.4" fill="none" {...STROKE_PROPS} />
        <Circle cx="12" cy="6" r="2.4" fill={solidFill(id)} />
        <Circle cx="12" cy="12" r="2.4" fill={bodyFill(id)} />
        <Circle cx="12" cy="12" r="2.4" stroke={a} strokeWidth="1.3" fill="none" />
        <Circle cx="12" cy="18" r="2.4" fill={bodyFill(id)} />
        <Circle cx="12" cy="18" r="2.4" stroke={a} strokeWidth="1.3" fill="none" />
        <Path
          d="M14.5 6h5M14.5 12h3.5M14.5 18h5"
          stroke={a}
          strokeWidth="1.5"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanChart = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="3" y="3" width="18" height="18" rx="2" fill={bodyFill(id)} />
        <Rect x="3" y="3" width="18" height="6" rx="2" fill={shineFill(id)} />
        <Rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Rect x="6" y="13" width="2.4" height="3" rx="0.5" fill={solidFill(id)} />
        <Rect x="10" y="10" width="2.4" height="6" rx="0.5" fill={solidFill(id)} />
        <Rect x="14" y="12" width="2.4" height="4" rx="0.5" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanCalendar = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="3.5" y="5" width="17" height="15" rx="2" fill={bodyFill(id)} />
        <Rect x="3.5" y="5" width="17" height="5" rx="2" fill={solidFill(id)} />
        <Rect
          x="3.5"
          y="5"
          width="17"
          height="15"
          rx="2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Path d="M3.5 10h17" stroke={a} strokeWidth="1.4" fill="none" {...STROKE_PROPS} />
        <Path
          d="M8 3v4M16 3v4"
          stroke="#1A2C2A"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx="8" cy="14.5" r="1.1" fill={solidFill(id)} />
        <Circle cx="12" cy="14.5" r="1.1" fill={a} fillOpacity="0.45" />
        <Circle cx="16" cy="14.5" r="1.1" fill={a} fillOpacity="0.45" />
      </>
    )}
  </IconBase>
);

export const TabanClock = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Circle cx="12" cy="12" r="9" fill={bodyFill(id)} />
        <Circle cx="12" cy="12" r="9" stroke={a} strokeWidth="1.4" fill="none" />
        <Ellipse cx="9" cy="8" rx="5" ry="3" fill={shineFill(id)} />
        <Path
          d="M12 7v5.2l3 2"
          stroke={a}
          strokeWidth="1.8"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="12" cy="12" r="0.9" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanBuilding = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M6 20V7l6-3 6 3v13" fill={bodyFill(id)} />
        <Path d="M6 7l6-3 6 3v3H6V7Z" fill={shineFill(id)} />
        <Path
          d="M6 20V7l6-3 6 3v13"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M4 20h16" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Path
          d="M10 20v-4h4v4"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Rect x="8.3" y="9.3" width="1.4" height="1.4" rx="0.2" fill={solidFill(id)} />
        <Rect x="11.3" y="9.3" width="1.4" height="1.4" rx="0.2" fill={solidFill(id)} />
        <Rect x="14.3" y="9.3" width="1.4" height="1.4" rx="0.2" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanMapPin = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M12 2.5c-3.9 0-7 3-7 6.8 0 5 7 12.2 7 12.2s7-7.2 7-12.2c0-3.7-3.1-6.8-7-6.8Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M12 2.5c-3.9 0-7 3-7 6.8 0 1.2.4 2.4 1 3.5l6 9 6-9c.6-1.1 1-2.3 1-3.5 0-3.7-3.1-6.8-7-6.8Z"
          fill={shineFill(id)}
        />
        <Path
          d="M12 2.5c-3.9 0-7 3-7 6.8 0 5 7 12.2 7 12.2s7-7.2 7-12.2c0-3.7-3.1-6.8-7-6.8Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Circle cx="12" cy="9.5" r="2.7" fill={solidFill(id)} />
        <Circle cx="11.4" cy="8.9" r="0.7" fill="#fff" fillOpacity="0.6" />
      </>
    )}
  </IconBase>
);

export const TabanSearch = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Circle cx="11" cy="11" r="6.8" fill={bodyFill(id)} />
        <Circle cx="11" cy="11" r="6.8" stroke={a} strokeWidth="1.4" fill="none" />
        <Ellipse cx="9" cy="8" rx="3.5" ry="2" fill={shineFill(id)} />
        <Path d="m16 16 4.5 4.5" stroke={a} strokeWidth="2.2" strokeLinecap="round" />
      </>
    )}
  </IconBase>
);

export const TabanCheck = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Circle cx="12" cy="12" r="9" fill={bodyFill(id)} />
        <Circle cx="12" cy="12" r="9" stroke={a} strokeWidth="1.4" fill="none" />
        <Ellipse cx="9" cy="8" rx="5.5" ry="3" fill={shineFill(id)} />
        <Path
          d="m7.5 12 3 3 6-6"
          stroke={a}
          strokeWidth="2.2"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanQR = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="3" y="3" width="7" height="7" rx="1" fill={bodyFill(id)} />
        <Rect x="3" y="3" width="7" height="7" rx="1" stroke={a} strokeWidth="1.3" fill="none" />
        <Rect x="14" y="3" width="7" height="7" rx="1" fill={bodyFill(id)} />
        <Rect x="14" y="3" width="7" height="7" rx="1" stroke={a} strokeWidth="1.3" fill="none" />
        <Rect x="3" y="14" width="7" height="7" rx="1" fill={bodyFill(id)} />
        <Rect x="3" y="14" width="7" height="7" rx="1" stroke={a} strokeWidth="1.3" fill="none" />
        <Rect x="5.5" y="5.5" width="2" height="2" rx="0.3" fill={solidFill(id)} />
        <Rect x="16.5" y="5.5" width="2" height="2" rx="0.3" fill={solidFill(id)} />
        <Rect x="5.5" y="16.5" width="2" height="2" rx="0.3" fill={solidFill(id)} />
        <Path
          d="M14 14h3v3M14 18h1M17 14v3M19 14v1M19 17h2M17 19v2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    )}
  </IconBase>
);

export const TabanWifi = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M3 9c5-4 13-4 18 0" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Path
          d="M6 13c3.5-2.5 8.5-2.5 12 0"
          stroke={a}
          strokeWidth="1.8"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M9 17c2-1.3 4-1.3 6 0" stroke={a} strokeWidth="1.8" fill="none" {...STROKE_PROPS} />
        <Circle cx="12" cy="20" r="1.5" fill={solidFill(id)} />
      </>
    )}
  </IconBase>
);

export const TabanPhone = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M5 4.5h3l2 5-2 1.5a11 11 0 0 0 5 5l1.5-2 5 2v3c0 1.1-.9 2-2 2A16 16 0 0 1 3 6.5c0-1.1.9-2 2-2Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M5 4.5h3l2 5-2 1.5C8 11.5 7 11 6 10c-1-1-1.5-2-2.5-3.5C3.5 5.4 4 4.5 5 4.5Z"
          fill={shineFill(id)}
        />
        <Path
          d="M5 4.5h3l2 5-2 1.5a11 11 0 0 0 5 5l1.5-2 5 2v3c0 1.1-.9 2-2 2A16 16 0 0 1 3 6.5c0-1.1.9-2 2-2Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanPrinter = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path d="M7 9V4h10v5" stroke={a} strokeWidth="1.4" fill="none" {...STROKE_PROPS} />
        <Rect x="3.5" y="9" width="17" height="8" rx="1.5" fill={bodyFill(id)} />
        <Rect x="3.5" y="9" width="17" height="3" rx="1.5" fill={shineFill(id)} />
        <Rect
          x="3.5"
          y="9"
          width="17"
          height="8"
          rx="1.5"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Rect
          x="7"
          y="14"
          width="10"
          height="6"
          rx="1"
          fill="#fff"
          stroke={a}
          strokeWidth="1.4"
        />
        <Circle cx="17" cy="12" r="0.9" fill={solidFill(id)} />
        <Path d="M9 17h6M9 19h4" stroke={a} strokeWidth="1.2" fill="none" {...STROKE_PROPS} />
      </>
    )}
  </IconBase>
);

export const TabanDownload = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          fill={bodyFill(id)}
        />
        <Path
          d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path d="M12 3v12" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Path
          d="m7 10 5 5 5-5"
          stroke={a}
          strokeWidth="2"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanPlus = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Circle cx="12" cy="12" r="9" fill={bodyFill(id)} />
        <Ellipse cx="9" cy="8" rx="5.5" ry="3" fill={shineFill(id)} />
        <Circle cx="12" cy="12" r="9" stroke={a} strokeWidth="1.4" fill="none" />
        <Path d="M12 8v8M8 12h8" stroke={a} strokeWidth="2.2" strokeLinecap="round" />
      </>
    )}
  </IconBase>
);

export const TabanArrowLeft = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ a }) => (
      <>
        <Path d="M3 12h18" stroke={a} strokeWidth="1.6" fill="none" {...STROKE_PROPS} />
        <Path
          d="m10 5-7 7 7 7"
          stroke={a}
          strokeWidth="2.2"
          fill="none"
          {...STROKE_PROPS}
        />
      </>
    )}
  </IconBase>
);

export const TabanChevronRight = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ a }) => (
      <Path
        d="m9 5 7 7-7 7"
        stroke={a}
        strokeWidth="2.2"
        fill="none"
        {...STROKE_PROPS}
      />
    )}
  </IconBase>
);

export const TabanSparkle = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Path
          d="M12 3c0 3.5 2 6 6 7-4 1-6 3.5-6 7 0-3.5-2-6-6-7 4-1 6-3.5 6-7Z"
          fill={bodyFill(id)}
        />
        <Path
          d="M12 3c0 3.5 2 6 6 7-4 1-6 3.5-6 7 0-3.5-2-6-6-7 4-1 6-3.5 6-7Z"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
          {...STROKE_PROPS}
        />
        <Path
          d="M19 3.5c0 1.4.8 2.4 2.4 2.8-1.6.4-2.4 1.4-2.4 2.8 0-1.4-.8-2.4-2.4-2.8 1.6-.4 2.4-1.4 2.4-2.8Z"
          fill={solidFill(id)}
        />
      </>
    )}
  </IconBase>
);

export const TabanDiagnosis = (p: TabanIconProps) => (
  <IconBase {...p}>
    {({ id, a }) => (
      <>
        <Rect x="3" y="4" width="18" height="16" rx="2" fill={bodyFill(id)} />
        <Rect x="3" y="4" width="18" height="5" rx="2" fill={shineFill(id)} />
        <Rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
          stroke={a}
          strokeWidth="1.4"
          fill="none"
        />
        <Circle cx="12" cy="12" r="3.7" fill="#fff" stroke={a} strokeWidth="1.4" />
        <Path
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
// Registry
// ───────────────────────────────────────────────────────────────────────────

export interface TabanRegistryEntry {
  Component: (p: TabanIconProps) => ReactNode;
  category: TabanCategory;
  label: string;
}

export const TABAN_ICONS: Record<string, TabanRegistryEntry> = {
  heart: { Component: TabanHeart, category: 'Vitals', label: 'Heart' },
  pulse: { Component: TabanPulse, category: 'Vitals', label: 'Pulse / ECG' },
  bloodPressure: { Component: TabanBloodPressure, category: 'Vitals', label: 'Blood Pressure' },
  oxygen: { Component: TabanOxygen, category: 'Vitals', label: 'Oxygen Sat' },
  thermometer: { Component: TabanThermometer, category: 'Vitals', label: 'Temperature' },
  lungs: { Component: TabanLungs, category: 'Vitals', label: 'Lungs' },
  brain: { Component: TabanBrain, category: 'Vitals', label: 'Neurological' },
  weight: { Component: TabanWeight, category: 'Vitals', label: 'Weight / BMI' },
  stethoscope: { Component: TabanStethoscope, category: 'Clinical', label: 'Consultation' },
  diagnosis: { Component: TabanDiagnosis, category: 'Clinical', label: 'Diagnosis' },
  record: { Component: TabanRecord, category: 'Clinical', label: 'Medical Record' },
  referral: { Component: TabanReferral, category: 'Clinical', label: 'Referral' },
  prescription: { Component: TabanPrescription, category: 'Clinical', label: 'Prescription' },
  sparkle: { Component: TabanSparkle, category: 'Clinical', label: 'AI Assist' },
  alert: { Component: TabanAlert, category: 'Clinical', label: 'Clinical Alert' },
  flask: { Component: TabanFlask, category: 'Lab & Pharmacy', label: 'Lab Order' },
  testTube: { Component: TabanTestTube, category: 'Lab & Pharmacy', label: 'Specimen' },
  microscope: { Component: TabanMicroscope, category: 'Lab & Pharmacy', label: 'Microscopy' },
  pill: { Component: TabanPill, category: 'Lab & Pharmacy', label: 'Medication' },
  syringe: { Component: TabanSyringe, category: 'Lab & Pharmacy', label: 'Injection' },
  pregnant: { Component: TabanPregnant, category: 'Maternal & Child', label: 'Antenatal Care' },
  baby: { Component: TabanBaby, category: 'Maternal & Child', label: 'Newborn' },
  vaccine: { Component: TabanVaccine, category: 'Maternal & Child', label: 'Immunization' },
  growth: { Component: TabanGrowth, category: 'Maternal & Child', label: 'Growth Curve' },
  wallet: { Component: TabanWallet, category: 'Billing', label: 'Wallet / Balance' },
  shield: { Component: TabanShield, category: 'Billing', label: 'Insurance' },
  receipt: { Component: TabanReceipt, category: 'Billing', label: 'Receipt' },
  creditCard: { Component: TabanCreditCard, category: 'Billing', label: 'Card Payment' },
  claim: { Component: TabanClaim, category: 'Billing', label: 'Claim' },
  mobileMoney: { Component: TabanMobileMoney, category: 'Billing', label: 'Mobile Money' },
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

export type TabanIconName = keyof typeof TABAN_ICONS;
