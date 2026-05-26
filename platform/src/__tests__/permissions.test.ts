/**
 * Tests for role-based permissions and route access control
 */
import { getRoleConfig, isRouteAllowed, getDefaultDashboard, ROLE_PERMISSIONS } from '../lib/permissions';
import type { UserRole } from '../lib/db-types';

const ALL_ROLES: UserRole[] = ['doctor', 'clinical_officer', 'nurse', 'lab_tech', 'pharmacist', 'front_desk', 'government'];

describe('permissions', () => {
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

    test('lab_tech cannot access /patients', () => {
      expect(isRouteAllowed('lab_tech', '/patients')).toBe(false);
    });

    test('all roles can access /settings', () => {
      for (const role of ALL_ROLES) {
        expect(isRouteAllowed(role, '/settings')).toBe(true);
      }
    });

    test('all roles can access /messages', () => {
      for (const role of ALL_ROLES) {
        if (role === 'government') return; // government doesn't have messages
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
        const isAllowed = config.allowedRoutes.some(
          route => item.href === route || item.href.startsWith(route + '/')
        );
        expect(isAllowed).toBe(true);
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
  });
});
