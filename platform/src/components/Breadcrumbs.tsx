'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from '@/components/icons/lucide';

const SEGMENT_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  patients: 'Patients',
  referrals: 'Referrals',
  settings: 'Settings',
  messages: 'Messages',
  pharmacy: 'Pharmacy',
  surveillance: 'Surveillance',
  admin: 'Admin',
  'org-admin': 'Organization',
  lab: 'Lab',
  'new': 'New',
  'my-facility': 'My Facility',
  government: 'Government',
  deaths: 'Deaths',
  'facility-assessments': 'Facility Assessments',
  'mch-analytics': 'MCH Analytics',
  'public-stats': 'Public Stats',
  'data-quality': 'Data Quality',
  users: 'Users',
  organizations: 'Organizations',
  system: 'System',
};

function getSegmentName(segment: string): string {
  return SEGMENT_NAMES[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (!pathname || pathname === '/dashboard') return null;

  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-4 py-2 no-print"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 transition-colors"
        style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
      >
        <Home className="w-3 h-3" aria-hidden="true" />
        <span>Home</span>
      </Link>

      {segments.map((segment, index) => {
        const path = '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        const name = getSegmentName(segment);

        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3" aria-hidden="true" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            {isLast ? (
              <span
                aria-current="page"
                className="font-semibold"
                style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}
              >
                {name}
              </span>
            ) : (
              <Link
                href={path}
                className="transition-colors hover:underline"
                style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
              >
                {name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
