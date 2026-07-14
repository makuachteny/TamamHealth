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
  triage_nurse: ['/patients', '/wards'],
  rooming_nurse: ['/patients', '/lab', '/immunizations', '/anc'],
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
 * The top-rail shortcut row next to the module dropdown. Returns between
 * `minItems` and `maxItems` shortcuts so every role has a usable row — never
 * the empty rail that lean-nav roles (e.g. triage_nurse, whose only non-dash
 * routes are both body-duplicates) used to get.
 *
 * Tiers, in fill order:
 *   1. Primary destinations — not the home dashboard, messages, or a route the
 *      role's own dashboard body already duplicates.
 *   2. Body-duplicate destinations — still real nav targets; pulled in only to
 *      reach the minimum.
 *   3. Messages, then the role's dashboard/home — last-resort fillers so even
 *      three-route roles show a populated row.
 * We show tier 1 up to `maxItems`; if tier 1 alone is under `minItems`, later
 * tiers backfill up to `minItems`.
 */
export function getPrimaryShortcutItems(items: NavItem[], role?: UserRole, maxItems = 5, minItems = 4) {
  const duplicateRoutes = role ? HEADER_SHORTCUT_DUPLICATE_ROUTES[role] : undefined;
  const isDashboard = (href: string) => href === '/dashboard' || href.startsWith('/dashboard/');

  const tier1 = sortByShortcutPriority(
    items.filter(item => !isDashboard(item.href) && item.href !== '/messages' && !duplicateRoutes?.includes(item.href)),
  );
  const tier2 = sortByShortcutPriority(
    items.filter(item => !isDashboard(item.href) && item.href !== '/messages' && duplicateRoutes?.includes(item.href)),
  );
  const tier3 = sortByShortcutPriority(
    items.filter(item => item.href === '/messages' || isDashboard(item.href)),
  );

  // De-duplicate by href across tiers (defensive; nav items are already unique).
  const seen = new Set<string>();
  const ordered = [...tier1, ...tier2, ...tier3].filter(item => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  // Aim for tier 1 (capped at maxItems); if that's short of the minimum, take
  // enough of the backfill tiers to reach it — bounded by what actually exists.
  const target = Math.min(ordered.length, Math.max(minItems, Math.min(tier1.length, maxItems)));
  return ordered.slice(0, target);
}
