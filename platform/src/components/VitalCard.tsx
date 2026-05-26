import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import {
  getVitalStatus,
  getBloodPressureStatus,
  getVitalHint,
  SEVERITY_TOKENS,
  type VitalKey,
  type VitalSeverity,
} from '@/lib/clinical-guidelines';

interface VitalCardProps {
  // 'bp' is a composite (pass systolic/diastolic).
  // 'none' opts out of threshold coloring — use for non-clinical readings
  // like weight/height where there's no universal alarm range.
  vitalKey: VitalKey | 'bp' | 'none';
  icon: IconName;
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  systolic?: number;
  diastolic?: number;
  trend?: { delta: string; direction: 'up' | 'down' | 'flat' };
  subtitle?: ReactNode;
  className?: string;
}

// A single vital-reading tile. The tile's tint + border + badge are all
// driven by clinical thresholds — a normal reading reads as a quiet neutral
// tile, a warning reads amber, a danger reads red with an inset ring.
export function VitalCard({
  vitalKey, icon, label, value, unit, systolic, diastolic, trend, subtitle, className,
}: VitalCardProps) {
  const severity: VitalSeverity =
    vitalKey === 'bp'
      ? getBloodPressureStatus(systolic, diastolic)
      : vitalKey === 'none'
      ? 'normal'
      : getVitalStatus(vitalKey, typeof value === 'number' ? value : Number(value));
  const tokens = SEVERITY_TOKENS[severity];
  const hint =
    vitalKey === 'bp'
      ? (severity === 'danger' ? 'Hypertensive' : severity === 'warning' ? 'Elevated' : null)
      : vitalKey === 'none'
      ? null
      : getVitalHint(vitalKey, typeof value === 'number' ? value : Number(value));

  const display = vitalKey === 'bp'
    ? (systolic != null && diastolic != null ? `${systolic}/${diastolic}` : '—')
    : (value != null && value !== '' ? String(value) : '—');

  return (
    <div
      className={`vital-card ${className || ''}`}
      style={{
        background: tokens.tile,
        border: `1px solid ${tokens.tileBorder}`,
        borderRadius: 12,
        padding: 14,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: severity === 'danger'
          ? `0 0 0 1px ${tokens.ring} inset, 0 4px 12px rgba(196, 69, 54, 0.10)`
          : severity === 'warning'
          ? `0 0 0 1px ${tokens.ring} inset`
          : '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      {/* Icon + alarm flag row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: severity === 'normal' ? 'rgba(27, 154, 170, 0.12)' : tokens.badge,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={44} color={tokens.accent} accent={tokens.accent} />
        </div>
        {severity !== 'normal' && (
          <div
            aria-label={severity === 'danger' ? 'Abnormal — critical' : 'Abnormal'}
            style={{
              width: 22, height: 22, borderRadius: 7,
              background: tokens.badge,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="alert" size={13} color={tokens.accent} accent={tokens.accent} />
          </div>
        )}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: severity === 'normal' ? 'var(--text-muted)' : tokens.accent,
          marginBottom: 4,
        }}
      >
        {label}
      </div>

      {/* Value + unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <div
          style={{
            fontSize: 22, fontWeight: 800, letterSpacing: -0.4,
            color: tokens.text,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.05,
          }}
        >
          {display}
        </div>
        {unit && display !== '—' && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{unit}</div>
        )}
      </div>

      {/* Status / trend — plain text (no pill chrome) so the row scans cleanly.
          Severity-tinted color carries the meaning. */}
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, minHeight: 14 }}>
        {hint ? (
          <span
            style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: 0.1,
              color: tokens.accent,
            }}
          >
            {hint}
          </span>
        ) : vitalKey !== 'none' ? (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#15795C' }}>Normal</span>
        ) : null}
        {trend && (
          <span
            style={{
              fontSize: 11, fontWeight: 700,
              color: trend.direction === 'up' ? '#15795C' : trend.direction === 'down' ? '#C44536' : 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '−' : ''}{trend.delta}
          </span>
        )}
        {subtitle && (
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{subtitle}</span>
        )}
      </div>
    </div>
  );
}

export default VitalCard;
