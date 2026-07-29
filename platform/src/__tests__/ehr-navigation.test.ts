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

  it('prefers routes without dashboard duplicates before filling the row', () => {
    const items = uniqueAllowedNavItems(ROLE_PERMISSIONS.nurse.navItems, ROLE_PERMISSIONS.nurse.allowedRoutes);
    const shortcuts = getPrimaryShortcutItems(items, 'nurse', 4);

    expect(shortcuts).toHaveLength(4);
    expect(shortcuts.map(item => item.href)).toEqual(['/births', '/deaths', '/messages', '/dashboard/nurse']);
  });
});
