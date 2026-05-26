// Edge-safe single source of truth for role -> route allow-list.
//
// IMPORTANT: This module is imported by `src/middleware.ts`, which runs on
// the Next.js Edge runtime. It MUST NOT import anything that pulls in
// lucide-react, node:fs, or any non-Edge-safe module. Only type-only imports
// from sibling files are permitted (types are erased at compile time).
//
// The richer `ROLE_PERMISSIONS` map in `./permissions.ts` derives its
// `allowedRoutes` from this table so the page-route gating in middleware and
// server/client `isRouteAllowed` checks share one list. Nav items, icons,
// labels, and colours stay in `permissions.ts` because they pull in icon
// components that are not Edge-safe.

import type { UserRole } from './db-types';

export interface RoleRouteConfig {
  readonly allowed: readonly string[];
  readonly defaultDashboard: string;
}

export const ROLE_ROUTE_TABLE: Readonly<Record<UserRole, RoleRouteConfig>> = {
  super_admin: {
    allowed: [
      '/admin', '/admin/organizations', '/admin/users', '/admin/system',
      '/admin/billing', '/admin/analytics',
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/hospitals', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/government',
      '/vital-statistics', '/facility-assessments', '/data-quality',
      '/dhis2-export', '/public-stats',
      '/appointments', '/telehealth',
      '/payments', '/payments/claims', '/payments/plans',
      '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr',
      '/sync-conflicts',
    ],
    defaultDashboard: '/admin',
  },

  org_admin: {
    allowed: [
      '/org-admin', '/org-admin/users', '/org-admin/hospitals',
      '/org-admin/branding', '/org-admin/settings', '/org-admin/analytics',
      '/hospitals', '/reports', '/settings', '/my-facility',
      '/appointments',
      '/payments', '/payments/claims', '/payments/plans',
      '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr',
      '/sync-conflicts',
    ],
    defaultDashboard: '/org-admin',
  },

  doctor: {
    allowed: [
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/hospitals', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/my-facility',
      '/appointments', '/telehealth',
      '/payments',
      '/wards', '/feedback', '/hr',
    ],
    defaultDashboard: '/dashboard',
  },

  clinical_officer: {
    allowed: [
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/settings', '/my-facility',
      '/appointments',
      '/payments',
      '/wards', '/feedback',
    ],
    defaultDashboard: '/dashboard',
  },

  nurse: {
    allowed: [
      '/dashboard/nurse', '/patients', '/messages',
      '/lab', '/immunizations', '/anc', '/births', '/deaths',
      '/settings', '/my-facility', '/appointments',
      '/payments',
      '/wards', '/feedback', '/hr',
    ],
    defaultDashboard: '/dashboard/nurse',
  },

  lab_tech: {
    allowed: [
      '/dashboard/lab', '/lab', '/messages', '/settings',
    ],
    defaultDashboard: '/dashboard/lab',
  },

  pharmacist: {
    allowed: [
      '/dashboard/pharmacy', '/pharmacy', '/messages', '/settings',
    ],
    defaultDashboard: '/dashboard/pharmacy',
  },

  front_desk: {
    allowed: [
      '/dashboard/front-desk', '/patients', '/referrals', '/messages',
      '/settings', '/my-facility',
      '/appointments',
      '/payments', '/payments/claims',
      '/wards', '/feedback',
    ],
    defaultDashboard: '/dashboard/front-desk',
  },

  boma_health_worker: {
    allowed: [
      '/dashboard/boma', '/patients', '/messages',
      '/immunizations', '/anc', '/births', '/deaths',
    ],
    defaultDashboard: '/dashboard/boma',
  },

  payam_supervisor: {
    allowed: [
      '/dashboard/payam', '/dashboard/boma', '/dashboard/state',
      '/patients', '/referrals', '/messages',
      '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/facility-assessments', '/data-quality',
      '/settings',
    ],
    defaultDashboard: '/dashboard/payam',
  },

  government: {
    allowed: [
      '/government', '/dashboard/state', '/dashboard/payam',
      '/hospitals', '/vital-statistics', '/immunizations',
      '/anc', '/births', '/deaths', '/facility-assessments', '/data-quality',
      '/surveillance', '/reports', '/dhis2-export', '/public-stats', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/appointments',
    ],
    defaultDashboard: '/government',
  },

  data_entry_clerk: {
    allowed: [
      '/dashboard/data-entry', '/facility-assessments',
      '/data-quality', '/immunizations', '/anc',
      '/births', '/deaths', '/vital-statistics',
      '/messages', '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard/data-entry',
  },

  medical_superintendent: {
    allowed: [
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/hospitals', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/my-facility',
      '/appointments', '/telehealth', '/facility-assessments', '/data-quality',
      '/payments', '/payments/claims', '/payments/plans',
      '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr',
      '/sync-conflicts',
    ],
    defaultDashboard: '/dashboard',
  },

  hrio: {
    allowed: [
      '/dashboard/hr', '/dashboard/data-entry', '/patients', '/facility-assessments',
      '/data-quality', '/reports', '/vital-statistics',
      '/immunizations', '/anc', '/births', '/deaths',
      '/hospitals', '/messages', '/settings', '/my-facility',
      '/hr', '/feedback',
      '/sync-conflicts',
    ],
    defaultDashboard: '/dashboard/hr',
  },

  community_health_volunteer: {
    allowed: [
      '/dashboard/boma', '/patients', '/messages',
      '/immunizations', '/anc', '/births', '/deaths',
    ],
    defaultDashboard: '/dashboard/boma',
  },

  nutritionist: {
    allowed: [
      '/dashboard/nutrition', '/patients', '/messages', '/anc',
      '/immunizations', '/mch-analytics', '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard/nutrition',
  },

  radiologist: {
    allowed: [
      '/dashboard/radiology', '/patients', '/lab', '/messages', '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard/radiology',
  },
};

const DEFAULT_DASHBOARD_FALLBACK = '/dashboard';

function getConfig(role: UserRole | string): RoleRouteConfig | undefined {
  return (ROLE_ROUTE_TABLE as Record<string, RoleRouteConfig>)[role];
}

/**
 * Returns true if `role` has an entry in `ROLE_ROUTE_TABLE`. Callers use this
 * to skip route gating for unknown/legacy roles instead of redirecting them
 * into a loop against an empty allow-list.
 */
export function hasRoleRouteConfig(role: UserRole | string): boolean {
  return getConfig(role) !== undefined;
}

/**
 * Returns true if a given role is allowed to navigate to `pathname`.
 * Uses an exact-match or path-prefix match (`pathname.startsWith(route + '/')`)
 * so that nested routes inherit access from their parent allow-list entry.
 *
 * NOTE: Returns `false` for unknown roles. Callers that need the previous
 * "unknown role is unrestricted" behaviour (e.g. middleware) should guard
 * with `hasRoleRouteConfig(role)` first.
 */
export function isPathAllowed(role: UserRole | string, pathname: string): boolean {
  const config = getConfig(role);
  if (!config) return false;
  return config.allowed.some(
    route => pathname === route || pathname.startsWith(route + '/'),
  );
}

/**
 * Returns the canonical landing page for a role. Falls back to `/dashboard`
 * for unknown roles so callers never have to handle `undefined`.
 */
export function getDefaultDashboard(role: UserRole | string): string {
  return getConfig(role)?.defaultDashboard ?? DEFAULT_DASHBOARD_FALLBACK;
}
