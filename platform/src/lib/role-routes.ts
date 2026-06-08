// Edge-safe single source of truth for role -> route allow-list.
//
// IMPORTANT: This module is imported by `src/middleware.ts`, which runs on
// the Next.js Edge runtime. It MUST NOT import anything that pulls in
// lucide-react, node:fs, or any non-Edge-safe module. Only type-only imports
// from sibling files are permitted (types are erased at compile time).
//
// The richer `ROLE_PERMISSIONS` map in `./permissions.ts` derives its
// `allowedRoutes` from this table so the page-route gating in middleware and
// server/client `isRouteAllowed` checks share one list. Nav items, icons,
// labels, and colours stay in `permissions.ts` because they pull in icon
// components that are not Edge-safe.

import type { UserRole } from './db-types';

export interface RoleRouteConfig {
  readonly allowed: readonly string[];
  readonly defaultDashboard: string;
}

export const ROLE_ROUTE_TABLE: Readonly<Record<UserRole, RoleRouteConfig>> = {
  super_admin: {
    allowed: [
      '/admin', '/admin/organizations', '/admin/users', '/admin/system',
      '/admin/billing', '/admin/analytics',
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/hospitals', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/government',
      '/vital-statistics', '/facility-assessments', '/data-quality',
      '/dhis2-export', '/public-stats',
      '/appointments', '/telehealth',
      '/payments', '/payments/claims', '/payments/plans',
      '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr',
      '/sync-conflicts', 
    ],
    defaultDashboard: '/admin',
  },

  org_admin: {
    allowed: [
      '/org-admin', '/org-admin/users', '/org-admin/hospitals',
      '/org-admin/branding', '/org-admin/settings', '/org-admin/analytics',
      '/hospitals', '/reports', '/settings', '/my-facility',
      '/appointments',
      '/payments', '/payments/claims', '/payments/plans',
      '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr',
      '/sync-conflicts',
    ],
    defaultDashboard: '/org-admin',
  },

  doctor: {
    allowed: [
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/settings',
      '/appointments', '/telehealth',
      '/wards', '/alerts', 
    ],
    defaultDashboard: '/dashboard',
  },

  clinical_officer: {
    // Diagnoses, treats, prescribes, orders labs, refers. Clinical scope only —
    // payment processing belongs to cashier/biller, not clinicians.
    allowed: [
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/settings', '/my-facility',
      '/appointments',
      '/wards', '/feedback', 
    ],
    defaultDashboard: '/dashboard',
  },

  nurse: {
    // Ward & bedside care, immunisation, ANC support, vital-event documentation.
    // Not payment processing (cashier/biller).
    allowed: [
      '/dashboard/nurse', '/patients', '/messages',
      '/lab', '/immunizations', '/anc', '/births', '/deaths',
      '/settings', '/my-facility', '/appointments',
      '/wards', '/feedback', 
    ],
    defaultDashboard: '/dashboard/nurse',
  },

  midwife: {
    // ICM scope: antenatal care, conducting deliveries, postnatal & newborn
    // care, obstetric referrals, and maternal/perinatal vital events. Reuses the
    // nurse station dashboard. No general consultation/prescribing (clinician),
    // no payment handling, and no laboratory operations page — ANC lab results
    // are reviewed inside the patient/ANC record, not the lab orders queue.
    allowed: [
      '/dashboard/nurse', '/patients', '/messages',
      '/anc', '/births', '/deaths', '/immunizations',
      '/wards', '/referrals', '/appointments',
      '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard/nurse',
  },

  lab_tech: {
    allowed: [
      '/dashboard/lab', '/lab', '/messages', '/settings',
    ],
    defaultDashboard: '/dashboard/lab',
  },

  pharmacist: {
    allowed: [
      '/dashboard/pharmacy', '/pharmacy', '/messages', '/settings',
    ],
    defaultDashboard: '/dashboard/pharmacy',
  },

  front_desk: {
    // Reception: registration, appointment booking, referral intake, feedback.
    // Money handling moves to the dedicated cashier role; bed/ward management is
    // a nursing function. Insurance claims belong to the medical biller.
    allowed: [
      '/dashboard/front-desk', '/patients', '/referrals', '/messages',
      '/settings', '/my-facility',
      '/appointments',
      '/feedback', 
    ],
    defaultDashboard: '/dashboard/front-desk',
  },

  cashier: {
    // Point-of-service collections only: takes payments, records receipts, sets
    // up patient payment plans, looks up the patient/visit being billed. No
    // insurance claim adjudication (biller) and no clinical access.
    allowed: [
      '/payments', '/payments/plans', '/payments/portal',
      '/patients', '/appointments', '/messages', '/settings',
    ],
    defaultDashboard: '/payments',
  },

  boma_health_worker: {
    // Household visits, child & maternal health, plus community disease
    // surveillance/event reporting (part of the BHI standard package).
    allowed: [
      '/dashboard/boma', '/patients', '/messages',
      '/immunizations', '/anc', '/births', '/deaths', '/surveillance',
    ],
    defaultDashboard: '/dashboard/boma',
  },

  payam_supervisor: {
    allowed: [
      '/dashboard/payam', '/dashboard/boma', '/dashboard/state',
      '/patients', '/referrals', '/messages',
      '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/facility-assessments', '/data-quality',
      '/settings',
    ],
    defaultDashboard: '/dashboard/payam',
  },

  government: {
    allowed: [
      '/government', '/dashboard/state', '/dashboard/payam',
      '/hospitals', '/vital-statistics', '/immunizations',
      '/anc', '/births', '/deaths', '/facility-assessments', '/data-quality',
      '/surveillance', '/reports', '/dhis2-export', '/public-stats', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/appointments',
    ],
    defaultDashboard: '/government',
  },

  county_health_director: {
    // Sub-national (county) health-department oversight: supervises facilities &
    // payams, monitors surveillance/outbreaks, reviews data quality and vital
    // statistics, and owns DHIS2/HMIS reporting for the county. Aggregate views
    // only — no individual patient records, prescribing, dispensing, or billing.
    allowed: [
      '/dashboard/state', '/dashboard/payam',
      '/hospitals', '/surveillance', '/epidemic-intelligence', '/mch-analytics',
      '/vital-statistics', '/immunizations', '/anc', '/births', '/deaths',
      '/facility-assessments', '/data-quality', '/reports', '/dhis2-export',
      '/public-stats', '/messages', '/settings',
    ],
    defaultDashboard: '/dashboard/state',
  },

  data_entry_clerk: {
    allowed: [
      '/dashboard/data-entry', '/facility-assessments',
      '/data-quality', '/immunizations', '/anc',
      '/births', '/deaths', '/vital-statistics',
      '/messages', '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard/data-entry',
  },

  medical_superintendent: {
    allowed: [
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/hospitals', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/my-facility',
      '/appointments', '/telehealth', '/facility-assessments', '/data-quality',
      '/payments', '/payments/claims', '/payments/plans',
      '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr',
      '/sync-conflicts', 
    ],
    defaultDashboard: '/dashboard',
  },

  hrio: {
    // Health Records & Information Officer — records, data quality, and DHIS2
    // reporting. NOT human-resources/payroll (that belongs to the medical
    // superintendent / hospital manager / org admin).
    allowed: [
      '/dashboard/data-entry', '/patients', '/facility-assessments',
      '/data-quality', '/reports', '/vital-statistics',
      '/immunizations', '/anc', '/births', '/deaths',
      '/hospitals', '/messages', '/settings', '/my-facility',
      '/dhis2-export',
      '/sync-conflicts',
    ],
    defaultDashboard: '/dashboard/data-entry',
  },

  community_health_volunteer: {
    allowed: [
      '/dashboard/boma', '/patients', '/messages',
      '/immunizations', '/anc', '/births', '/deaths',
    ],
    defaultDashboard: '/dashboard/boma',
  },

  nutritionist: {
    // Nutrition assessment & counselling and MCH nutrition programmes. Vaccine
    // administration (/immunizations) is a nursing/clinical task, not dietetics;
    // antenatal clinical care (/anc) is a midwife/nurse/clinician function —
    // maternal-nutrition data is reviewed via MCH analytics and the patient record.
    allowed: [
      '/dashboard/nutrition', '/patients', '/messages',
      '/mch-analytics', '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard/nutrition',
  },

  radiologist: {
    allowed: [
      '/dashboard/radiology', '/patients', '/lab', '/messages', '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard/radiology',
  },

  hospital_manager: {
    allowed: [
      '/dashboard/hospital-manager',
      // Intelligence & population health
      '/epidemic-intelligence', '/mch-analytics', '/surveillance',
      // Network & facility
      '/hospitals', '/my-facility', '/facility-assessments',
      // Reporting
      '/reports', '/data-quality', '/vital-statistics', '/dhis2-export', '/public-stats',
      // Facility operations
      '/equipment', '/hr', '/dashboard/hr', '/feedback',
      // Finance oversight
      '/payments', '/payments/claims', '/payments/plans',
      // Clinical context (read). Lab/pharmacy are operational service queues run
      // by lab techs/pharmacists; the manager sees utilisation via reports, not
      // the live work queues.
      '/patients', '/wards', '/referrals', '/appointments', '/messages',
      '/settings', '/sync-conflicts',
    ],
    defaultDashboard: '/dashboard/hospital-manager',
  },

  medical_biller: {
    allowed: [
      '/billing',
      '/payments', '/payments/claims', '/payments/plans', '/payments/portal',
      '/patients', '/appointments', '/messages', '/settings',
    ],
    defaultDashboard: '/billing',
  },

  // ───────── Clinical-flow workflow stations (EHR Clinical Flow doc §4) ─────────
  central_registration_clerk: {
    allowed: [
      '/patients', '/appointments', '/referrals', '/messages',
      '/settings', '/my-facility', '/dashboard/front-desk', '/payments',
    ],
    defaultDashboard: '/dashboard/front-desk',
  },

  clinic_clerk: {
    allowed: [
      '/patients', '/appointments', '/messages',
      '/settings', '/my-facility', '/dashboard/front-desk',
    ],
    defaultDashboard: '/dashboard/front-desk',
  },

  triage_nurse: {
    // Triage station: records presenting complaint, vitals, and acuity, then
    // routes the patient. No lab operations page — orders are placed by the
    // clinician downstream.
    allowed: [
      '/patients', '/messages', '/settings', '/my-facility',
      '/dashboard/nurse', '/wards',
    ],
    defaultDashboard: '/dashboard/nurse',
  },

  rooming_nurse: {
    allowed: [
      '/patients', '/messages', '/settings', '/my-facility',
      '/dashboard/nurse', '/immunizations', '/anc', '/lab',
    ],
    defaultDashboard: '/dashboard/nurse',
  },

  clinician: {
    allowed: [
      '/dashboard', '/patients', '/consultation', '/referrals', '/messages',
      '/lab', '/pharmacy', '/immunizations', '/anc', '/births', '/deaths',
      '/appointments', '/telehealth', '/wards', '/alerts', '/settings', '/my-facility',
    ],
    defaultDashboard: '/dashboard',
  },

  records_hmis_officer: {
    allowed: [
      '/dashboard/data-entry', '/patients', '/facility-assessments', '/data-quality',
      '/reports', '/vital-statistics', '/immunizations', '/anc', '/births', '/deaths',
      '/hospitals', '/messages', '/settings', '/my-facility', '/dhis2-export',
      '/sync-conflicts', 
    ],
    defaultDashboard: '/dashboard/data-entry',
  },

  facility_administrator: {
    // Non-clinical facility manager: administration, oversight, finance, HR,
    // assets, records/data quality, and population reporting. NOT a consulting
    // clinician — no consultation/telehealth encounter tools and no lab/pharmacy
    // operations pages (those belong to clinicians, lab techs, and pharmacists).
    allowed: [
      '/dashboard', '/patients', '/referrals', '/messages',
      '/immunizations', '/anc', '/births', '/deaths',
      '/surveillance', '/reports', '/hospitals', '/settings',
      '/epidemic-intelligence', '/mch-analytics', '/my-facility',
      '/appointments', '/facility-assessments', '/data-quality',
      '/payments', '/payments/claims', '/payments/plans',
      '/wards', '/equipment', '/hr', '/feedback', '/dashboard/hr',
      '/sync-conflicts', '/org-admin/users',
    ],
    defaultDashboard: '/dashboard',
  },
};

const DEFAULT_DASHBOARD_FALLBACK = '/dashboard';

function getConfig(role: UserRole | string): RoleRouteConfig | undefined {
  return (ROLE_ROUTE_TABLE as Record<string, RoleRouteConfig>)[role];
}

/**
 * Returns true if `role` has an entry in `ROLE_ROUTE_TABLE`. Callers use this
 * to skip route gating for unknown/legacy roles instead of redirecting them
 * into a loop against an empty allow-list.
 */
export function hasRoleRouteConfig(role: UserRole | string): boolean {
  return getConfig(role) !== undefined;
}

/**
 * Returns true if a given role is allowed to navigate to `pathname`.
 * Uses an exact-match or path-prefix match (`pathname.startsWith(route + '/')`)
 * so that nested routes inherit access from their parent allow-list entry.
 *
 * NOTE: Returns `false` for unknown roles. Callers that need the previous
 * "unknown role is unrestricted" behaviour (e.g. middleware) should guard
 * with `hasRoleRouteConfig(role)` first.
 */
export function isPathAllowed(role: UserRole | string, pathname: string): boolean {
  const config = getConfig(role);
  if (!config) return false;
  return config.allowed.some(
    route => pathname === route || pathname.startsWith(route + '/'),
  );
}

/**
 * Returns the canonical landing page for a role. Falls back to `/dashboard`
 * for unknown roles so callers never have to handle `undefined`.
 */
export function getDefaultDashboard(role: UserRole | string): string {
  return getConfig(role)?.defaultDashboard ?? DEFAULT_DASHBOARD_FALLBACK;
}
