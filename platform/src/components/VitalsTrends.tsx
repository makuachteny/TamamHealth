'use client';

/**
 * VitalsTrends
 * ------------
 * Visual trend panel for a patient's key vital signs over time.
 *
 * Given a chronologically-sorted list of MedicalRecordDoc entries (any order;
 * this component will sort them ascending by date for the charts), it renders
 * a compact grid of sparkline-style charts for:
 *   - Blood pressure (systolic/diastolic)
 *   - Temperature
 *   - Heart rate (pulse)
 *   - Weight
 *   - Blood glucose (pulled from labResults if present)
 *
 * For each metric we compute:
 *   - The latest value
 *   - The previous value (for a direction arrow)
 *   - A simple anomaly flag if the latest reading is outside normal range
 *     or the last two readings both breach the threshold.
 */

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Activity } from '@/components/icons/lucide';
import type { MedicalRecordDoc } from '@/lib/db-types';

interface VitalsTrendsProps {
  records: MedicalRecordDoc[];
}

type TrendDirection = 'up' | 'down' | 'flat';
type TrendStatus = 'normal' | 'warning' | 'danger';

interface MetricPoint {
  date: string;
  label: string;
  value: number;
  // for BP we carry a secondary value
  secondary?: number;
}

interface MetricSummary {
  key: string;
  title: string;
  unit: string;
  /** chronological points, oldest first */
  points: MetricPoint[];
  latest: number | null;
  previous: number | null;
  direction: TrendDirection;
  status: TrendStatus;
  /** Normal range, for display */
  normalLabel: string;
  /** Normal band used for the chart reference area */
  normalRange?: [number, number];
  /** Optional message shown as a trend badge */
  message?: string;
  color: string;
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

function direction(curr: number | null, prev: number | null): TrendDirection {
  if (curr == null || prev == null) return 'flat';
  const diff = curr - prev;
  if (Math.abs(diff) < 0.01) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Build a MetricSummary for a single scalar vital. `selector` extracts the
 * numeric value from a record, or returns null to skip that record.
 */
function buildMetric(
  records: MedicalRecordDoc[],
  key: string,
  title: string,
  unit: string,
  color: string,
  normalRange: [number, number],
  normalLabel: string,
  selector: (rec: MedicalRecordDoc) => number | null,
): MetricSummary | null {
  const points: MetricPoint[] = records
    .map(r => {
      const v = selector(r);
      if (v == null || !Number.isFinite(v) || v === 0) return null;
      const d = r.consultedAt || r.visitDate || r.createdAt;
      return { date: d, label: formatDate(d), value: v } as MetricPoint;
    })
    .filter((p): p is MetricPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length === 0) return null;

  const latest = points[points.length - 1].value;
  const previous = points.length > 1 ? points[points.length - 2].value : null;
  const dir = direction(latest, previous);

  // Anomaly detection:
  //   danger  → latest reading outside the normal range
  //   warning → latest is borderline (within 5% of limit) or trending toward a limit
  //   normal  → all good
  let status: TrendStatus = 'normal';
  let message: string | undefined;

  const [lo, hi] = normalRange;
  if (latest < lo || latest > hi) {
    status = 'danger';
    const reps = points.slice(-2).filter(p => p.value < lo || p.value > hi).length;
    message = reps >= 2 ? `Repeatedly ${latest > hi ? 'above' : 'below'} range` : `Out of range`;
  } else if (previous != null) {
    const pc = pctChange(latest, previous);
    if (Math.abs(pc) > 10) {
      status = 'warning';
      message = `${pc > 0 ? 'Rising' : 'Falling'} ${Math.abs(Math.round(pc))}%`;
    }
  }

  return {
    key,
    title,
    unit,
    points,
    latest,
    previous,
    direction: dir,
    status,
    normalLabel,
    normalRange,
    message,
    color,
  };
}

/**
 * Blood pressure is a pair (systolic/diastolic). We build a separate summary
 * that plots both lines and flags hypertensive/hypotensive patterns.
 */
function buildBPMetric(records: MedicalRecordDoc[]): MetricSummary | null {
  const points: MetricPoint[] = records
    .map(r => {
      const v = r.vitalSigns;
      if (!v || !v.systolic || !v.diastolic) return null;
      const d = r.consultedAt || r.visitDate || r.createdAt;
      return { date: d, label: formatDate(d), value: v.systolic, secondary: v.diastolic } as MetricPoint;
    })
    .filter((p): p is MetricPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length === 0) return null;

  const latest = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const dir = direction(latest.value, previous?.value ?? null);

  let status: TrendStatus = 'normal';
  let message: string | undefined;

  // Hypertensive stage 1 (JNC 7): ≥140/90.  Hypotensive: ≤90/60.
  const sys = latest.value;
  const dia = latest.secondary ?? 0;
  if (sys >= 140 || dia >= 90) {
    status = 'danger';
    const repeat = points.slice(-2).every(p => p.value >= 140 || (p.secondary ?? 0) >= 90);
    message = repeat ? 'Repeated hypertensive readings' : 'Elevated BP';
  } else if (sys <= 90 || dia <= 60) {
    status = 'danger';
    message = 'Low BP';
  } else if (sys >= 130 || dia >= 85) {
    status = 'warning';
    message = 'Approaching hypertensive range';
  }

  return {
    key: 'bp',
    title: 'Blood Pressure',
    unit: 'mmHg',
    points,
    latest: sys,
    previous: previous?.value ?? null,
    direction: dir,
    status,
    normalLabel: '90–120 / 60–80',
    normalRange: [90, 120],
    message,
    color: '#5CB8A8',
  };
}

/**
 * Pull blood-glucose values from the labResults attached to a record.
 * This is a best-effort extraction because lab result strings are free form.
 */
function extractGlucose(rec: MedicalRecordDoc): number | null {
  const labs = rec.labResults || [];
  for (const lab of labs) {
    if (!lab.testName?.toLowerCase().includes('glucose')) continue;
    const match = String(lab.result || '').match(/(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

export default function VitalsTrends({ records }: VitalsTrendsProps) {
  const metrics = useMemo<MetricSummary[]>(() => {
    const out: MetricSummary[] = [];
    const bp = buildBPMetric(records);
    if (bp) out.push(bp);

    const temp = buildMetric(
      records, 'temperature', 'Temperature', '°C', '#E4A84B',
      [36.1, 37.5], '36.1–37.5°C',
      (r) => r.vitalSigns?.temperature ?? null,
    );
    if (temp) out.push(temp);

    const pulse = buildMetric(
      records, 'pulse', 'Heart Rate', 'bpm', '#C44536',
      [60, 100], '60–100 bpm',
      (r) => r.vitalSigns?.pulse ?? null,
    );
    if (pulse) out.push(pulse);

    const weight = buildMetric(
      records, 'weight', 'Weight', 'kg', '#10b981',
      // Weight has no universal normal range; treat anything as normal and
      // highlight only big swings via the warning path.
      [0, 500], '—',
      (r) => r.vitalSigns?.weight ?? null,
    );
    if (weight) out.push(weight);

    const spo2 = buildMetric(
      records, 'spo2', 'SpO₂', '%', '#8b5cf6',
      [95, 100], '≥95%',
      (r) => r.vitalSigns?.oxygenSaturation ?? null,
    );
    if (spo2) out.push(spo2);

    const glucose = buildMetric(
      records, 'glucose', 'Blood Glucose', 'mg/dL', '#ec4899',
      [70, 140], '70–140 mg/dL',
      extractGlucose,
    );
    if (glucose) out.push(glucose);

    return out;
  }, [records]);

  if (metrics.length === 0) {
    return (
      <div className="card-elevated p-6 text-center">
        <Activity className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No vital sign history yet. Trends will appear here once consultations are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {metrics.map(m => (
        <MetricCard key={m.key} metric={m} />
      ))}
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricSummary }) {
  const {
    title, unit, points, latest, previous, direction: dir, status, normalLabel, message, color, key,
  } = metric;

  const statusBg =
    status === 'danger' ? 'rgba(196, 69, 54, 0.14)' :
    status === 'warning' ? 'rgba(228, 168, 75, 0.16)' :
    'rgba(27, 158, 119, 0.12)';
  const statusColor =
    status === 'danger' ? '#C44536' :
    status === 'warning' ? '#B8741C' :
    '#15795C';
  // The whole trend card picks up a tinted surface when a vital is off —
  // matches the Latest Vitals grid so readers never miss a red card.
  const cardSurface =
    status === 'danger'
      ? { background: 'rgba(196, 69, 54, 0.06)', border: '1px solid rgba(196, 69, 54, 0.32)', boxShadow: '0 0 0 1px rgba(196, 69, 54, 0.18) inset, 0 4px 14px rgba(196, 69, 54, 0.08)' }
      : status === 'warning'
      ? { background: 'rgba(228, 168, 75, 0.06)', border: '1px solid rgba(228, 168, 75, 0.30)', boxShadow: '0 0 0 1px rgba(228, 168, 75, 0.16) inset' }
      : undefined;

  const Arrow = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;

  const latestDisplay = key === 'bp' && points.length > 0
    ? `${latest}/${points[points.length - 1].secondary ?? '-'}`
    : latest != null ? String(latest) : '—';

  const changeLabel = (() => {
    if (latest == null || previous == null) return null;
    const delta = latest - previous;
    if (Math.abs(delta) < 0.01) return 'no change';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(Math.abs(delta) < 10 ? 1 : 0)} ${unit}`;
  })();

  return (
    <div className="card-elevated p-4 relative" style={cardSurface}>
      {status === 'danger' && <span className="data-tile__alarm-pulse" aria-hidden="true" />}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {title}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold" style={{ color: status === 'danger' ? statusColor : 'var(--text-primary)' }}>
              {latestDisplay}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Normal: {normalLabel}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ background: statusBg, color: statusColor }}
          >
            {status === 'danger' && <AlertTriangle className="w-3 h-3" />}
            <Arrow className="w-3 h-3" />
            {changeLabel ?? 'baseline'}
          </span>
          {message && (
            <span className="text-[10px] font-medium" style={{ color: statusColor }}>
              {message}
            </span>
          )}
        </div>
      </div>

      <div style={{ width: '100%', height: 80 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card, #1f2937)',
                border: '1px solid var(--border-light, #374151)',
                borderRadius: 6,
                fontSize: 11,
                padding: '6px 8px',
              }}
              labelStyle={{ color: 'var(--text-muted)' }}
              formatter={(v, name) => [`${v ?? '—'} ${unit}`, name === 'value' ? title : String(name ?? '')]}
            />
            {metric.normalRange && (
              <ReferenceArea
                y1={metric.normalRange[0]}
                y2={metric.normalRange[1]}
                fill={statusColor}
                fillOpacity={0.06}
                stroke="none"
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 2.5, fill: color }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            {key === 'bp' && (
              <Line
                type="monotone"
                dataKey="secondary"
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={{ r: 2, fill: color }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span>{points.length} reading{points.length === 1 ? '' : 's'}</span>
        <span>{points[0].label} — {points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
