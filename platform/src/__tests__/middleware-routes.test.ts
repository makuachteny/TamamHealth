/**
 * Tests for middleware route configuration consistency.
 *
 * The Edge middleware (`src/middleware.ts`) gates pages using the allow-list in
 * `lib/role-routes.ts` (`ROLE_ROUTE_TABLE`). The richer `ROLE_PERMISSIONS` map
 * in `lib/permissions.ts` derives its `allowedRoutes` from the same table. These
 * tests assert the two stay consistent for EVERY role — including new roles —
 * so navigation links can never point at a route the middleware would block.
 */
import { ROLE_PERMISSIONS } from '../lib/permissions';
import { ROLE_ROUTE_TABLE } from '../lib/role-routes';
import type { UserRole } from '../lib/db-types';

const ALL_ROLES = Object.keys(ROLE_ROUTE_TABLE) as UserRole[];

function allowedByTable(role: UserRole, path: string): boolean {
  return ROLE_ROUTE_TABLE[role].allowed.some(
    r => path === r || path.startsWith(r + '/'),
  );
}

describe('middleware-routes sync with permissions', () => {
  test('every role in permissions has a route-table entry', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_ROUTE_TABLE[role]).toBeDefined();
    }
  });

  test.each(ALL_ROLES)('defaultDashboard matches the route table for role: %s', (role) => {
    expect(ROLE_PERMISSIONS[role].defaultDashboard).toBe(ROLE_ROUTE_TABLE[role].defaultDashboard);
  });

  test.each(ALL_ROLES)('defaultDashboard is itself an allowed route for role: %s', (role) => {
    expect(allowedByTable(role, ROLE_ROUTE_TABLE[role].defaultDashboard)).toBe(true);
  });

  test.each(ALL_ROLES)('all permission allowedRoutes are gated-in by the route table for role: %s', (role) => {
    for (const route of ROLE_PERMISSIONS[role].allowedRoutes) {
      expect(allowedByTable(role, route)).toBe(true);
    }
  });

  test.each(ALL_ROLES)('all nav-item hrefs are reachable through the middleware for role: %s', (role) => {
    for (const item of ROLE_PERMISSIONS[role].navItems) {
      expect(allowedByTable(role, item.href)).toBe(true);
    }
  });
});
