'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';

const SEGMENT_KEYS: Record<string, string> = {
  dashboard: 'breadcrumb.dashboard',
  patients: 'breadcrumb.patients',
  referrals: 'breadcrumb.referrals',
  settings: 'breadcrumb.settings',
  messages: 'breadcrumb.messages',
  pharmacy: 'breadcrumb.pharmacy',
  surveillance: 'breadcrumb.surveillance',
  admin: 'breadcrumb.admin',
  'org-admin': 'breadcrumb.orgAdmin',
  lab: 'breadcrumb.lab',
  'new': 'breadcrumb.new',
  'my-facility': 'breadcrumb.myFacility',
  government: 'breadcrumb.government',
  deaths: 'breadcrumb.deaths',
  'facility-assessments': 'breadcrumb.facilityAssessments',
  'mch-analytics': 'breadcrumb.mchAnalytics',
  'public-stats': 'breadcrumb.publicStats',
  'data-quality': 'breadcrumb.dataQuality',
  users: 'breadcrumb.users',
  organizations: 'breadcrumb.organizations',
  system: 'breadcrumb.system',
};

function getSegmentName(segment: string, t: (key: string) => string): string {
  const key = SEGMENT_KEYS[segment];
  if (key) return t(key);
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  if (!pathname || pathname === '/dashboard') return null;

  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  return (
    <nav
      aria-label={t('breadcrumb.label')}
      className="flex items-center gap-1 px-4 py-2 no-print"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 transition-colors"
        style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
      >
        <Home className="w-3 h-3" aria-hidden="true" />
        <span>{t('breadcrumb.home')}</span>
      </Link>

      {segments.map((segment, index) => {
        const path = '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        const name = getSegmentName(segment, t);

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
