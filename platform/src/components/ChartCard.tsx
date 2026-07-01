'use client';

/**
 * ChartCard — reusable wrapper that adds chart-type toggling and
 * period selection to any Recharts chart.
 *
 * Usage:
 *   <ChartCard title="OPD Attendance" defaultPeriod="month">
 *     {({ chartType, period }) => <MyChart type={chartType} period={period} />}
 *   </ChartCard>
 */

import { useState, type ReactNode } from 'react';

export type ChartType = 'line' | 'area' | 'bar';
export type ChartPeriod = 'week' | 'month' | 'quarter' | 'year';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Which chart-type buttons to show. Defaults to all three. */
  chartTypes?: ChartType[];
  /** Which period options to show. Defaults to week/month/quarter. */
  periods?: ChartPeriod[];
  defaultType?: ChartType;
  defaultPeriod?: ChartPeriod;
  /** Extra controls rendered between the type buttons and period select */
  extraControls?: ReactNode;
  /** Card class overrides */
  className?: string;
  style?: React.CSSProperties;
  children: (controls: { chartType: ChartType; period: ChartPeriod }) => ReactNode;
}

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
};

export default function ChartCard({
  title,
  subtitle,
  chartTypes = ['line', 'area', 'bar'],
  periods = ['week', 'month', 'quarter'],
  defaultType = 'line',
  defaultPeriod = 'month',
  extraControls,
  className = '',
  style,
  children,
}: ChartCardProps) {
  const [chartType, setChartType] = useState<ChartType>(defaultType);
  const [period, setPeriod] = useState<ChartPeriod>(defaultPeriod);

  return (
    <div className={`card-elevated flex flex-col ${className}`} style={style}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 flex-shrink-0 flex-wrap gap-2"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', letterSpacing: -0.2, lineHeight: 1 }}>
            {title}
          </h3>
          {subtitle && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Chart type buttons */}
          {chartTypes.length > 1 && chartTypes.map(t => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                background: chartType === t ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                color: chartType === t ? '#fff' : 'var(--text-muted)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}

          {extraControls}

          {/* Period selector */}
          {periods.length > 1 && (
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as ChartPeriod)}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                background: 'var(--overlay-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: 7,
                padding: '3px 8px',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {periods.map(p => (
                <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Chart area ── */}
      <div className="flex-1 min-h-0 p-4">
        {children({ chartType, period })}
      </div>
    </div>
  );
}

/** Shared Recharts tooltip style — import in each chart page */
export const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-light)',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: 'none',
  },
  cursor: { stroke: 'var(--border-light)', strokeWidth: 1 },
};

/** Axis tick props shared across all charts */
export const axisTick = {
  fontSize: 11,
  fill: 'var(--text-muted)' as string,
  fontFamily: "'DM Sans', sans-serif",
};

/** Gradient defs for area charts — drop inside <defs> in an <AreaChart> */
export function AreaGradients({ id1 = 'grad1', id2 = 'grad2', color1 = 'var(--accent-primary)', color2 = 'var(--color-warning)' }) {
  return (
    <defs>
      <linearGradient id={id1} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={color1} stopOpacity={0.18} />
        <stop offset="95%" stopColor={color1} stopOpacity={0} />
      </linearGradient>
      <linearGradient id={id2} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={color2} stopOpacity={0.15} />
        <stop offset="95%" stopColor={color2} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}
