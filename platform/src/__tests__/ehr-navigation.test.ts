import fs from 'fs';
import path from 'path';
import { activeNavItem, getPrimaryShortcutItems, uniqueAllowedNavItems } from '@/components/ehr/ehr-navigation';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import type { NavItem } from '@/lib/permissions';
import type { UserRole } from '@/lib/db-types';

describe('header navigation shortcuts', () => {
  it('provides four permitted destinations for every configured role', () => {
    for (const [role, config] of Object.entries(ROLE_PERMISSIONS) as [UserRole, (typeof ROLE_PERMISSIONS)[UserRole]][]) {
      const shortcuts = getPrimaryShortcutItems(uniqueAllowedNavItems(config.navItems, config.allowedRoutes), role, 4);

      expect(shortcuts).toHaveLength(4);
      expect(new Set(shortcuts.map(item => item.href)).size).toBe(4);
      expect(shortcuts.every(item => config.allowedRoutes.some(route =>
        item.href === route || item.href.startsWith(`${route}/`),
      ))).toBe(true);
    }
  });

  // Asserts the rule rather than a frozen row: the previous version hard-coded
  // the four nurse hrefs, so adding any nav item to the nursing station broke
  // it even when the ordering rule still held.
  it('prefers routes without dashboard duplicates before filling the row', () => {
    const items = uniqueAllowedNavItems(ROLE_PERMISSIONS.nurse.navItems, ROLE_PERMISSIONS.nurse.allowedRoutes);
    const shortcuts = getPrimaryShortcutItems(items, 'nurse', 4);

    expect(shortcuts).toHaveLength(4);

    // The role's own dashboard is filler — it may only appear once every
    // non-dashboard destination has been used.
    const hrefs = shortcuts.map(item => item.href);
    const firstDashboard = hrefs.findIndex(h => h.startsWith('/dashboard'));
    if (firstDashboard !== -1) {
      expect(hrefs.slice(firstDashboard).every(h => h.startsWith('/dashboard'))).toBe(true);
    }
    // And a real destination is preferred over it.
    expect(hrefs[0].startsWith('/dashboard')).toBe(false);
  });

  it('keeps the dashboard out of the row when the role has enough destinations', () => {
    // The module trigger beside this row carries the dashboard glyph and opens
    // a menu led by Dashboard, so a shortcut to it put the same destination in
    // two adjacent buttons. It may still backfill a short menu — hence the
    // length check rather than a blanket ban.
    for (const [role, config] of Object.entries(ROLE_PERMISSIONS) as [UserRole, (typeof ROLE_PERMISSIONS)[UserRole]][]) {
      const items = uniqueAllowedNavItems(config.navItems, config.allowedRoutes);
      const nonDashboard = items.filter(i => !i.href.startsWith('/dashboard'));
      const shortcuts = getPrimaryShortcutItems(items, role, 4);
      if (nonDashboard.length >= 4) {
        expect(shortcuts.some(i => i.href.startsWith('/dashboard'))).toBe(false);
      }
      // Whatever the menu size, the row is still filled.
      expect(shortcuts).toHaveLength(4);
    }
  });
});

describe('activeNavItem — which module the user is in', () => {
  const item = (href: string): NavItem => ({ href, label: href, icon: (() => null) as unknown as NavItem['icon'] });

  it('matches the exact route', () => {
    expect(activeNavItem([item('/notes'), item('/wards')], '/notes')?.href).toBe('/notes');
  });

  it('keeps a child route inside its module', () => {
    expect(activeNavItem([item('/notes')], '/notes/abc123')?.href).toBe('/notes');
  });

  it('picks the deepest module, never two at once', () => {
    // The bug this guards: a prefix match lit up Dashboard *and* Lab, so the
    // dropdown highlighted two rows and neither matched the trigger icon.
    const items = [item('/dashboard'), item('/dashboard/lab')];
    expect(activeNavItem(items, '/dashboard/lab')?.href).toBe('/dashboard/lab');
  });

  it('is not fooled by a shared name prefix', () => {
    expect(activeNavItem([item('/patients')], '/patient-intake')).toBeNull();
  });

  it('ignores the query string when deciding the module', () => {
    expect(activeNavItem([item('/patients')], '/patients/p-1?tab=labs')?.href).toBe('/patients');
  });

  it('returns nothing when the path is outside every module', () => {
    expect(activeNavItem([item('/notes')], '/settings')).toBeNull();
    expect(activeNavItem([item('/notes')], null)).toBeNull();
  });
});

describe('module menu destinations', () => {
  // Every module in every role's dropdown must land on a page that exists —
  // a dead entry is invisible until a clinician taps it and gets a 404.
  it('points every nav item at a real route', () => {
    const appDir = path.join(process.cwd(), 'src', 'app');
    const routes = new Set<string>();
    const walk = (dir: string, urlPath: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          if (entry.name === 'page.tsx') routes.add(urlPath || '/');
          continue;
        }
        // Route groups "(dashboard)" add no URL segment; "[id]" matches anything.
        const segment = entry.name.startsWith('(') ? '' : `/${entry.name}`;
        walk(path.join(dir, entry.name), urlPath + segment);
      }
    };
    walk(appDir, '');

    const matches = (href: string) => {
      const target = href.split('?')[0];
      for (const route of routes) {
        const a = route.split('/').filter(Boolean);
        const b = target.split('/').filter(Boolean);
        if (a.length !== b.length) continue;
        if (a.every((seg, i) => seg.startsWith('[') || seg === b[i])) return true;
      }
      return false;
    };

    const dead: string[] = [];
    for (const config of Object.values(ROLE_PERMISSIONS)) {
      for (const nav of config.navItems) {
        if (nav.href && !matches(nav.href)) dead.push(nav.href);
      }
    }
    expect([...new Set(dead)]).toEqual([]);
  });
});
