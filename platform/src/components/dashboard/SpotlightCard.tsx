'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from '@/components/icons/lucide';

/**
 * Spotlight — a brand-gradient metric card (same treatment as Next Appointment)
 * used as each dashboard's role-specific second card: the one number that
 * matters most for that role, with an optional caption and "view all" arrow.
 */
export default function SpotlightCard({
  title,
  value,
  caption,
  href,
  className = '',
}: {
  title: string;
  value: ReactNode;
  caption?: ReactNode;
  href?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={`hero-banner flex flex-col justify-between ${className}`} style={{ minHeight: 188, padding: 22 }}>
      <div className="relative z-[1] flex items-start justify-between">
        <span style={{ fontFamily: "var(--font-platform)", fontWeight: 600, fontSize: 17, color: '#fff' }}>{title}</span>
        {href && (
          <button
            onClick={() => router.push(href)}
            className="flex items-center justify-center flex-shrink-0 transition-transform"
            style={{ width: 37, height: 37, borderRadius: 10, background: '#fff' }}
            aria-label={`Open ${title}`}
            title={`Open ${title}`}
          >
            <ArrowUpRight className="w-[18px] h-[18px]" style={{ color: 'var(--accent-primary)' }} />
          </button>
        )}
      </div>
      <div className="relative z-[1]">
        <div className="tabular-nums" style={{ fontFamily: "var(--font-platform)", fontWeight: 700, fontSize: 56, lineHeight: 1 }}>{value}</div>
        {caption && (
          <div className="mt-1.5" style={{ fontFamily: "var(--font-platform)", fontWeight: 300, fontSize: 13, color: 'rgba(255,255,255,0.88)' }}>{caption}</div>
        )}
      </div>
    </div>
  );
}
