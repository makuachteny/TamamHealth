'use client';

/**
 * DemoModeBanner — inline notice shown above any screen that's rendering
 * sample/demo data instead of real records. Mounted by the page itself
 * (radiology, nutrition, payments portal, etc.) only when it decides to
 * fall back to bundled SAMPLE_* arrays.
 *
 * Visibility is the caller's responsibility — render this component only
 * when `NEXT_PUBLIC_DEMO_MODE !== 'false'` AND the page is actually about
 * to display demo data. We do NOT inspect the env var here so the banner
 * is reusable for any future demo-data surface.
 *
 * Visual style matches ConnectivityNotice: warning amber palette via
 * --color-warning, --card-radius, and a duotone alert icon.
 */

import { AlertTriangle } from '@/components/icons/lucide';

export interface DemoModeBannerProps {
  /** Compact spacing for placement directly above KPI strips. */
  dense?: boolean;
}

export default function DemoModeBanner({ dense = false }: DemoModeBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2"
      style={{
        padding: dense ? '6px 12px' : '10px 14px',
        marginBottom: dense ? 8 : 12,
        borderRadius: 'var(--card-radius)',
        background: 'rgba(228, 168, 75, 0.10)',
        border: '1px solid rgba(228, 168, 75, 0.30)',
        color: '#B8741C',
        fontSize: dense ? 11.5 : 12.5,
        fontWeight: 600,
      }}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        Demo Mode — data shown below is sample data for evaluation. Not real patient records.
      </span>
    </div>
  );
}
