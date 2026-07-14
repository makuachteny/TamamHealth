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

export function getPrimaryShortcutItems(items: NavItem[], role?: UserRole, maxItems = 5) {
  const duplicateRoutes = role ? HEADER_SHORTCUT_DUPLICATE_ROUTES[role] : undefined;
  const withPriority = items
    // Messaging lives in the module menu and mobile tab bar, not the top
    // rail — its rail slot belongs to the lab shortcut.
    .filter(item => item.href !== '/dashboard' && !item.href.startsWith('/dashboard/') && item.href !== '/messages')
    .filter(item => !duplicateRoutes?.includes(item.href))
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
