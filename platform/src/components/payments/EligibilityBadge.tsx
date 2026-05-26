'use client';

import { Shield, ShieldAlert, ShieldOff, ShieldQuestion, ShieldCheck } from '@/components/icons/lucide';

interface EligibilityBadgeProps {
  status: 'verified' | 'unverified' | 'expired' | 'denied' | 'cached' | 'none';
  compact?: boolean;
}

const statusConfig = {
  verified:   { label: 'Verified',   color: 'var(--success)',  icon: ShieldCheck },
  cached:     { label: 'Cached',     color: 'var(--success)',  icon: ShieldCheck },
  unverified: { label: 'Unverified', color: 'var(--warning)',  icon: ShieldQuestion },
  expired:    { label: 'Expired',    color: 'var(--error)',    icon: ShieldAlert },
  denied:     { label: 'Denied',     color: 'var(--error)',    icon: ShieldOff },
  none:       { label: 'No Insurance', color: 'var(--text-muted)', icon: Shield },
};

export default function EligibilityBadge({ status, compact }: EligibilityBadgeProps) {
  const config = statusConfig[status] || statusConfig.none;
  const Icon = config.icon;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: compact ? '2px 8px' : '4px 12px',
      borderRadius: 20,
      fontSize: compact ? 11 : 12,
      fontWeight: 600,
      color: config.color,
      background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={compact ? 12 : 14} />
      {!compact && config.label}
    </span>
  );
}
