import { getPrimaryShortcutItems, uniqueAllowedNavItems } from '@/components/ehr/ehr-navigation';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
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
});
