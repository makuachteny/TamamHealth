import type { NavItem } from '@/lib/permissions';
import type { UserRole } from '@/lib/db-types';

// Routes dropped from a role's top-rail quick-shortcut row because that
// role's own default dashboard body already has a dedicated, same-intent
// button for the same route (e.g. Nurse's action strip already has a
// "Patients" button, so the header doesn't need one too). Only routes with
// a *verified* body-level duplicate are listed here — a route missing from
// a role's list still shows in the header as normal.
const HEADER_SHORTCUT_DUPLICATE_ROUTES: Partial<Record<UserRole, string[]>> = {
  doctor: ['/patient-intake'],
  clinical_officer: ['/patient-intake'],
  clinician: ['/patient-intake'],
  medical_superintendent: ['/payments'],
  nurse: ['/patients', '/wards', '/appointments', '/patient-intake', '/lab', '/immunizations', '/anc'],
  midwife: ['/patients', '/appointments', '/wards', '/anc', '/immunizations', '/referrals'],
  triage_nurse: ['/patients', '/wards', '/appointments', '/patient-intake', '/lab', '/immunizations', '/anc'],
  rooming_nurse: ['/patients', '/wards', '/appointments', '/patient-intake', '/lab', '/immunizations', '/anc'],
  front_desk: ['/check-in', '/patient-intake', '/patients', '/referrals', '/appointments'],
  central_registration_clerk: ['/patients', '/appointments', '/referrals'],
  clinic_clerk: ['/patients', '/appointments'],
  lab_tech: ['/lab'],
  pharmacist: ['/pharmacy', '/controlled-substances'],
  data_entry_clerk: ['/facility-assessments', '/data-quality', '/vital-statistics', '/immunizations', '/anc', '/births', '/deaths'],
  hrio: ['/patients', '/reports', '/data-quality', '/vital-statistics', '/immunizations', '/anc', '/births', '/deaths', '/facility-assessments'],
  records_hmis_officer: ['/patients', '/reports', '/data-quality', '/vital-statistics', '/facility-assessments'],
  nutritionist: ['/patients'],
  radiologist: ['/patients', '/lab'],
  county_health_director: ['/reports', '/surveillance', '/hospitals', '/mch-analytics'],
  org_admin: ['/patients', '/reports', '/wards', '/hr'],
  hospital_manager: ['/patients', '/reports', '/wards', '/hr'],
};

const PRIMARY_SHORTCUT_PRIORITY = [
  '/payments',
  '/payments/claims',
  '/consultation',
  '/patients',
  '/patient-intake',
  '/appointments',
  '/lab',
  '/reports',
  '/system-admin',
  '/surveillance',
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
  // Nav items may deep-link with a query string (e.g. /data-quality?view=x) —
  // permission is decided by the path alone.
  const path = href.split('?')[0];
  return allowedRoutes.some(route => path === route || path.startsWith(route + '/'));
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

/** Sort a nav-item list by top-rail shortcut priority, then original order. */
function sortByShortcutPriority(list: NavItem[]): NavItem[] {
  return list
    .map((item, index) => ({ item, index, priority: PRIMARY_SHORTCUT_PRIORITY.indexOf(item.href) }))
    .sort((a, b) => {
      const aPriority = a.priority === -1 ? Number.MAX_SAFE_INTEGER : a.priority;
      const bPriority = b.priority === -1 ? Number.MAX_SAFE_INTEGER : b.priority;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.index - b.index;
    })
    .map(entry => entry.item);
}

/**
 * The top-rail shortcut row next to the module dropdown. Returns up to
 * `maxItems` shortcuts from the active role's permitted navigation. Routes
 * already represented by the role dashboard are preferred only as fallbacks,
 * so the header stays useful without introducing unauthorized or unrelated
 * destinations. The fallback also keeps specialist roles with small menus
 * from ending up with an incomplete header.
 *
 * Tiers, in fill order:
 *   1. Primary destinations — not the home dashboard, messages, or a route the
 *      role's own dashboard body already duplicates.
 *   2. Messages, then the role dashboard — preferred before reusing a route
 *      already represented by the dashboard.
 *   3. Dashboard-duplicate destinations — used only when still needed to
 *      reach the requested header size.
 */
export function getPrimaryShortcutItems(items: NavItem[], role?: UserRole, maxItems = 5) {
  const duplicateRoutes = role ? HEADER_SHORTCUT_DUPLICATE_ROUTES[role] : undefined;
  const isDashboard = (href: string) => href === '/dashboard' || href.startsWith('/dashboard/');

  const tier1 = sortByShortcutPriority(
    items.filter(item => !isDashboard(item.href) && item.href !== '/messages' && !duplicateRoutes?.includes(item.href)),
  );
  const duplicateFallbacks = sortByShortcutPriority(
    items.filter(item => !isDashboard(item.href) && item.href !== '/messages' && duplicateRoutes?.includes(item.href)),
  );
  const messagesFallback = sortByShortcutPriority(items.filter(item => item.href === '/messages'));
  const dashboardFallback = sortByShortcutPriority(items.filter(item => isDashboard(item.href)));

  // De-duplicate by href across tiers (defensive; nav items are already unique).
  const seen = new Set<string>();
  const ordered = [...tier1, ...messagesFallback, ...dashboardFallback, ...duplicateFallbacks].filter(item => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  return ordered.slice(0, maxItems);
}
