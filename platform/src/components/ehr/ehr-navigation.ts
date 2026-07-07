import type { NavItem } from '@/lib/permissions';

const PRIMARY_SHORTCUT_PRIORITY = [
  '/payments',
  '/payments/claims',
  '/consultation',
  '/patients',
  '/patient-intake',
  '/appointments',
  '/messages',
  '/reports',
  '/surveillance',
  '/lab',
  '/pharmacy',
  '/wards',
  '/facility-management',
  '/government',
  '/hospitals',
  '/data-quality',
  '/dhis2-export',
  '/settings',
];

export function isHrefAllowed(href: string, allowedRoutes: readonly string[]) {
  return allowedRoutes.some(route => href === route || href.startsWith(route + '/'));
}

export function uniqueAllowedNavItems(items: NavItem[], allowedRoutes: readonly string[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item.href || seen.has(item.href) || !isHrefAllowed(item.href, allowedRoutes)) return false;
    seen.add(item.href);
    return true;
  });
}

export function groupNavItemsBySection(items: NavItem[]): { section: string | null; items: NavItem[] }[] {
  const groups: { section: string | null; items: NavItem[] }[] = [];
  let current: { section: string | null; items: NavItem[] } | null = null;

  for (const item of items) {
    const section = item.section || null;
    if (!current || current.section !== section) {
      current = { section, items: [item] };
      groups.push(current);
    } else {
      current.items.push(item);
    }
  }

  return groups;
}

export function getPrimaryShortcutItems(items: NavItem[], maxItems = 5) {
  const withPriority = items
    .filter(item => item.href !== '/dashboard' && !item.href.startsWith('/dashboard/'))
    .map((item, index) => ({
      item,
      index,
      priority: PRIMARY_SHORTCUT_PRIORITY.indexOf(item.href),
    }));

  return withPriority
    .sort((a, b) => {
      const aPriority = a.priority === -1 ? Number.MAX_SAFE_INTEGER : a.priority;
      const bPriority = b.priority === -1 ? Number.MAX_SAFE_INTEGER : b.priority;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.index - b.index;
    })
    .slice(0, maxItems)
    .map(entry => entry.item);
}
