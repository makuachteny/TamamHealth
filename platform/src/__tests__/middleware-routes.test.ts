/**
 * Tests for middleware route configuration consistency
 * Ensures middleware ROLE_ROUTES stay in sync with permissions.ts
 */
import { ROLE_PERMISSIONS } from '../lib/permissions';
import type { UserRole } from '../lib/db-types';

// Mirror of the middleware route map (must stay in sync)
const MIDDLEWARE_ROLE_ROUTES: Record<string, { allowed: string[]; defaultDashboard: string }> = {
  doctor: {
    allowed: ['/dashboard', '/patients', '/consultation', '/referrals', '/messages', '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths', '/surveillance', '/reports', '/hospitals', '/settings', '/epidemic-intelligence', '/mch-analytics', '/my-facility', '/appointments', '/telehealth', '/payments', '/wards', '/feedback', '/hr'],
    defaultDashboard: '/dashboard',
  },
  clinical_officer: {
    allowed: ['/dashboard', '/patients', '/consultation', '/referrals', '/messages', '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths', '/surveillance', '/settings', '/my-facility', '/appointments', '/payments', '/wards', '/feedback'],
    defaultDashboard: '/dashboard',
  },
  nurse: {
    allowed: ['/dashboard/nurse', '/patients', '/messages', '/lab', '/immunizations', '/anc', '/births', '/deaths', '/settings', '/my-facility', '/appointments', '/payments', '/wards', '/feedback', '/hr'],
    defaultDashboard: '/dashboard/nurse',
  },
  lab_tech: {
    allowed: ['/dashboard/lab', '/lab', '/messages', '/settings'],
    defaultDashboard: '/dashboard/lab',
  },
  pharmacist: {
    allowed: ['/dashboard/pharmacy', '/pharmacy', '/messages', '/settings'],
    defaultDashboard: '/dashboard/pharmacy',
  },
  front_desk: {
    allowed: ['/dashboard/front-desk', '/patients', '/referrals', '/messages', '/settings', '/my-facility', '/appointments', '/payments', '/wards', '/feedback'],
    defaultDashboard: '/dashboard/front-desk',
  },
  government: {
    allowed: ['/government', '/dashboard/state', '/dashboard/payam', '/hospitals', '/vital-statistics', '/immunizations', '/anc', '/births', '/deaths', '/facility-assessments', '/data-quality', '/surveillance', '/reports', '/dhis2-export', '/public-stats', '/settings', '/epidemic-intelligence', '/mch-analytics', '/appointments'],
    defaultDashboard: '/government',
  },
  data_entry_clerk: {
    allowed: ['/dashboard/data-entry', '/facility-assessments', '/data-quality', '/immunizations', '/anc', '/births', '/deaths', '/vital-statistics', '/messages', '/settings', '/my-facility'],
    defaultDashboard: '/dashboard/data-entry',
  },
  medical_superintendent: {
    allowed: ['/dashboard', '/patients', '/consultation', '/referrals', '/messages', '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths', '/surveillance', '/reports', '/hospitals', '/settings', '/epidemic-intelligence', '/mch-analytics', '/my-facility', '/appointments', '/telehealth', '/facility-assessments', '/data-quality', '/payments', '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr', '/sync-conflicts'],
    defaultDashboard: '/dashboard',
  },
  hrio: {
    allowed: ['/dashboard/hr', '/dashboard/data-entry', '/patients', '/facility-assessments', '/data-quality', '/reports', '/vital-statistics', '/immunizations', '/anc', '/births', '/deaths', '/hospitals', '/messages', '/settings', '/my-facility', '/hr', '/feedback', '/sync-conflicts'],
    defaultDashboard: '/dashboard/hr',
  },
  community_health_volunteer: {
    allowed: ['/dashboard/boma', '/patients', '/messages', '/immunizations', '/anc', '/births', '/deaths'],
    defaultDashboard: '/dashboard/boma',
  },
  nutritionist: {
    allowed: ['/dashboard/nutrition', '/patients', '/messages', '/anc', '/immunizations', '/mch-analytics', '/settings', '/my-facility'],
    defaultDashboard: '/dashboard/nutrition',
  },
  radiologist: {
    allowed: ['/dashboard/radiology', '/patients', '/lab', '/messages', '/settings', '/my-facility'],
    defaultDashboard: '/dashboard/radiology',
  },
};

const ALL_ROLES: UserRole[] = ['doctor', 'clinical_officer', 'nurse', 'lab_tech', 'pharmacist', 'front_desk', 'government', 'data_entry_clerk', 'medical_superintendent', 'hrio', 'community_health_volunteer', 'nutritionist', 'radiologist'];

describe('middleware-routes sync with permissions', () => {
  test.each(ALL_ROLES)('defaultDashboard matches for role: %s', (role) => {
    const permConfig = ROLE_PERMISSIONS[role];
    const mwConfig = MIDDLEWARE_ROLE_ROUTES[role];
    expect(mwConfig.defaultDashboard).toBe(permConfig.defaultDashboard);
  });

  test.each(ALL_ROLES)('middleware allows all permission allowedRoutes for role: %s', (role) => {
    const permConfig = ROLE_PERMISSIONS[role];
    const mwConfig = MIDDLEWARE_ROLE_ROUTES[role];
    for (const route of permConfig.allowedRoutes) {
      const isInMiddleware = mwConfig.allowed.some(
        r => route === r || route.startsWith(r + '/')
      );
      expect(isInMiddleware).toBe(true);
    }
  });

  test.each(ALL_ROLES)('all nav items are accessible via middleware for role: %s', (role) => {
    const permConfig = ROLE_PERMISSIONS[role];
    const mwConfig = MIDDLEWARE_ROLE_ROUTES[role];
    for (const item of permConfig.navItems) {
      const isAllowed = mwConfig.allowed.some(
        r => item.href === r || item.href.startsWith(r + '/')
      );
      expect(isAllowed).toBe(true);
    }
  });

  test('all roles in permissions are also in middleware', () => {
    for (const role of ALL_ROLES) {
      expect(MIDDLEWARE_ROLE_ROUTES[role]).toBeDefined();
    }
  });
});
