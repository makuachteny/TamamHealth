'use client';

// Small colour key for the patient-avatar palette.
// Colours: critical (red), watch (orange), stable (green).
const ITEMS: { label: string; color: string }[] = [
  { label: 'critical', color: '#F8593E' },
  { label: 'watch', color: '#FF7F00' },
  { label: 'stable', color: '#00A95D' },
];

export default function AvatarLegend({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-muted)',
        ...style,
      }}
      aria-label="Patient status colour key"
    >
      {ITEMS.map(item => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, flexShrink: 0 }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
