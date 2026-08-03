/**
 * Tests for role-based permissions and route access control
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getRoleConfig, isRouteAllowed, getDefaultDashboard, ROLE_PERMISSIONS } from '../lib/permissions';
import { ROLE_ROUTE_TABLE, isPathAllowed } from '../lib/role-routes';
import type { UserRole } from '../lib/db-types';

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[];

describe('permissions', () => {
  test('covers every route-gated role', () => {
    expect(new Set(Object.keys(ROLE_PERMISSIONS))).toEqual(new Set(Object.keys(ROLE_ROUTE_TABLE)));
  });

  describe('getRoleConfig', () => {
    test.each(ALL_ROLES)('returns config for role: %s', (role) => {
      const config = getRoleConfig(role);
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.defaultDashboard).toBeTruthy();
      expect(config.allowedRoutes.length).toBeGreaterThan(0);
      expect(config.navItems.length).toBeGreaterThan(0);
      expect(config.color).toMatch(/^#/);
    });

    test('returns doctor config for unknown role', () => {
      const config = getRoleConfig('unknown_role' as UserRole);
      expect(config).toEqual(ROLE_PERMISSIONS.doctor);
    });
  });

  describe('isRouteAllowed', () => {
    test('doctor can access /dashboard', () => {
      expect(isRouteAllowed('doctor', '/dashboard')).toBe(true);
    });

    test('doctor can access /patients', () => {
      expect(isRouteAllowed('doctor', '/patients')).toBe(true);
    });

    test('doctor can access /patients/123', () => {
      expect(isRouteAllowed('doctor', '/patients/123')).toBe(true);
    });

    test('doctor cannot access /government', () => {
      expect(isRouteAllowed('doctor', '/government')).toBe(false);
    });

    test('government can access /government', () => {
      expect(isRouteAllowed('government', '/government')).toBe(true);
    });

    test('government cannot access /dashboard', () => {
      expect(isRouteAllowed('government', '/dashboard')).toBe(false);
    });

    test('nurse can access /dashboard/nurse', () => {
      expect(isRouteAllowed('nurse', '/dashboard/nurse')).toBe(true);
    });

    test('nurse cannot access /dashboard (doctor dashboard)', () => {
      // Nurse has /dashboard/nurse but not /dashboard
      expect(isRouteAllowed('nurse', '/dashboard')).toBe(false);
    });

    test('lab_tech can access /lab', () => {
      expect(isRouteAllowed('lab_tech', '/lab')).toBe(true);
    });

    // Lab technicians work orders inside the patient chart (the bench steps
    // live on /patients/<id>?tab=labs), so the route is open to them. The chart
    // itself renders only the overview + labs tabs for this role — see
    // LAB_TAB_IDS in the patient chart page — so the grant stays minimum
    // necessary rather than opening notes, medications or the problem list.
    test('lab_tech can access /patients to work orders in the chart', () => {
      expect(isRouteAllowed('lab_tech', '/patients')).toBe(true);
    });

    test('lab_tech still has no access to clinical workspaces', () => {
      expect(isRouteAllowed('lab_tech', '/consultation')).toBe(false);
      expect(isRouteAllowed('lab_tech', '/pharmacy')).toBe(false);
    });

    test('all roles can access /settings', () => {
      for (const role of ALL_ROLES) {
        expect(isRouteAllowed(role, '/settings')).toBe(true);
      }
    });

    // /notifications is a universal route (see UNIVERSAL_ROUTES in
    // role-routes.ts): every role has the bell, so every role must be able to
    // open the full feed behind it — including roles whose module allow-list
    // never lists it.
    test('all roles can access /notifications', () => {
      for (const role of ALL_ROLES) {
        expect(isRouteAllowed(role, '/notifications')).toBe(true);
      }
    });

    test('all roles can access /messages', () => {
      for (const role of ALL_ROLES) {
        // `continue`, not `return`: government sits 11th in ROLE_PERMISSIONS,
        // so returning here exited the whole test and silently skipped the
        // 14 roles declared after it.
        if (role === 'government') continue; // government doesn't have messages
        expect(isRouteAllowed(role, '/messages')).toBe(true);
      }
    });
  });

  describe('getDefaultDashboard', () => {
    test('doctor defaults to /dashboard', () => {
      expect(getDefaultDashboard('doctor')).toBe('/dashboard');
    });

    test('nurse defaults to /dashboard/nurse', () => {
      expect(getDefaultDashboard('nurse')).toBe('/dashboard/nurse');
    });

    test('government defaults to /government', () => {
      expect(getDefaultDashboard('government')).toBe('/government');
    });

    test('lab_tech defaults to /dashboard/lab', () => {
      expect(getDefaultDashboard('lab_tech')).toBe('/dashboard/lab');
    });

    test('pharmacist defaults to /dashboard/pharmacy', () => {
      expect(getDefaultDashboard('pharmacist')).toBe('/dashboard/pharmacy');
    });

    test('front_desk defaults to /dashboard/front-desk', () => {
      expect(getDefaultDashboard('front_desk')).toBe('/dashboard/front-desk');
    });
  });

  describe('navItems consistency', () => {
    test.each(ALL_ROLES)('all navItem hrefs are in allowedRoutes for role: %s', (role) => {
      const config = getRoleConfig(role);
      for (const item of config.navItems) {
        // Uses the shared matcher so nav hrefs carrying a query string
        // (e.g. "/data-quality?view=completeness") resolve to their route.
        expect(isPathAllowed(role, item.href)).toBe(true);
      }
    });

    test.each(ALL_ROLES)('defaultDashboard is in allowedRoutes for role: %s', (role) => {
      const config = getRoleConfig(role);
      expect(config.allowedRoutes).toContain(config.defaultDashboard);
    });

    test.each(ALL_ROLES)('all navItems have icons for role: %s', (role) => {
      const config = getRoleConfig(role);
      for (const item of config.navItems) {
        expect(item.icon).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.href).toBeTruthy();
      }
    });

    test.each(ALL_ROLES)('navItems contain no duplicate hrefs for role: %s', (role) => {
      const hrefs = getRoleConfig(role).navItems.map(i => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });
  });

  /**
   * The allow-list and the App Router are maintained independently, so a route
   * can be granted to a role while no page exists to serve it — the nav renders
   * a link that 404s, and the role's landing redirect can dead-end. Everything
   * else in this file checks the tables against each other; this checks them
   * against what is actually on disk.
   */
  describe('routes resolve to real pages', () => {
    /** Concrete routes that have a page.tsx, with route groups `(x)` stripped. */
    const collectRoutes = (dir: string, prefix = ''): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) {
          if (entry === 'page.tsx') out.push(prefix || '/');
          continue;
        }
        const seg = /^\(.*\)$/.test(entry) ? '' : `/${entry}`;
        out.push(...collectRoutes(full, prefix + seg));
      }
      return out;
    };

    const realRoutes = collectRoutes(join(__dirname, '..', 'app'));
    const realSet = new Set(realRoutes);
    // A dynamic page (/billing/[id]) also serves its parent's children.
    const dynamicParents = realRoutes
      .filter(r => r.includes('['))
      .map(r => r.slice(0, r.indexOf('/[')));

    const resolves = (route: string) =>
      realSet.has(route) || dynamicParents.some(p => route === p || route.startsWith(p + '/'));

    test('the app has pages at all (guards against a bad glob)', () => {
      expect(realRoutes.length).toBeGreaterThan(50);
    });

    test.each(ALL_ROLES)('every allowed route has a page for role: %s', (role) => {
      const dead = ROLE_ROUTE_TABLE[role].allowed.filter(r => !resolves(r));
      expect(dead).toEqual([]);
    });

    test.each(ALL_ROLES)('the landing dashboard has a page for role: %s', (role) => {
      expect(resolves(getDefaultDashboard(role))).toBe(true);
    });
  });
});
