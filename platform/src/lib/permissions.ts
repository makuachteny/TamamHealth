import type { ComponentType, CSSProperties, SVGProps } from 'react';
import type { UserRole } from './db-types';
import {
  ROLE_ROUTE_TABLE,
  isPathAllowed as isPathAllowedFromTable,
  getDefaultDashboard as getDefaultDashboardFromTable,
} from './role-routes';
// Clean single-stroke (Tailwind-style) outline icons straight from lucide-react
// so the sidebar nav renders flat blue icons rather than the duotone shim.
import {
  LayoutDashboard,
  Users,
  FileText,
  ArrowRightLeft,
  FlaskConical,
  Pill,
  Activity,
  BarChart3,
  Building2,
  Hospital as HospitalIcon,
  MessageSquare,
  Baby,
  Skull,
  Heart,
  Database,
  Download,
  ClipboardCheck,
  Syringe,
  HeartPulse,
  Globe,
  Bug,
  Palette,
  CreditCard,
  Settings,
  Calendar,
  Video,
  Scan,
  Server,
  Gauge,
  Receipt,
  Wallet,
  BedDouble,
  Stethoscope,
  Package,
  AlertTriangle,
} from 'lucide-react';

// Lenient shape so either lucide or our duotone wrappers type-check.
export type NavIcon = ComponentType<
  Omit<SVGProps<SVGSVGElement>, 'color'> & {
    size?: number | string;
    strokeWidth?: number | string;
    color?: string;
    style?: CSSProperties;
    className?: string;
    absoluteStrokeWidth?: boolean;
  }
>;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  section?: string;
  /**
   * When set, the item is rendered as an in-place trigger rather than a route
   * link. 'availability' opens the "Add availability" modal so providers can
   * publish bookable windows from the sidebar's Schedule tab. `href` is then
   * just a stable React key / sentinel and is never navigated to.
   */
  action?: 'availability';
}

export interface RoleConfig {
  label: string;
  defaultDashboard: string;
  allowedRoutes: string[];
  navItems: NavItem[];
  color: string;
  gradientFrom: string;
  gradientTo: string;
  badgeLabel: string;
}

/**
 * Facility-management sidebar (the hospital-admin nav from the reference design),
 * mapped to the platform's real routes. Shared by the roles that own the
 * Facility Management dashboard so the nav is defined once (no duplicates).
 * Duplicate reference items are collapsed onto a single real feature:
 * "Medicines" → Pharmacy (with Prescriptions), "IPD/OPD" → Wards (with Bed
 * Management).
 */
const FACILITY_NAV: NavItem[] = [
  { href: '/facility-management', label: 'Dashboard', icon: HospitalIcon, section: 'HOSPITAL' },
  { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'HOSPITAL' },
  { href: '/wards', label: 'Bed Management', icon: BedDouble, section: 'HOSPITAL' },
  { href: '/hr', label: 'Doctors & Staff', icon: Stethoscope, section: 'HOSPITAL' },
  { href: '/patients', label: 'Patients', icon: Users, section: 'HOSPITAL' },
  { href: '/pharmacy', label: 'Prescriptions & Medicines', icon: Pill, section: 'SERVICES' },
  { href: '/blood-bank', label: 'Blood Bank', icon: Heart, section: 'SERVICES' },
  { href: '/messages', label: 'Enquiries', icon: MessageSquare, section: 'SERVICES' },
  { href: '/reports', label: 'Reports', icon: BarChart3, section: 'SERVICES' },
];

export const ROLE_PERMISSIONS: Record<UserRole, RoleConfig> = {
  super_admin: {
    label: 'Super Admin',
    defaultDashboard: ROLE_ROUTE_TABLE.super_admin.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.super_admin.allowed],
    navItems: [
      ...FACILITY_NAV,
      // Platform-operator controls (kept so super-admin never loses tenant /
      // system access); no href duplicates the facility nav above.
      { href: '/admin', label: 'Platform Dashboard', icon: Gauge, section: 'PLATFORM' },
      { href: '/admin/organizations', label: 'Organizations', icon: Building2, section: 'PLATFORM' },
      { href: '/admin/users', label: 'All Users', icon: Users, section: 'PLATFORM' },
      { href: '/admin/billing', label: 'Billing', icon: CreditCard, section: 'PLATFORM' },
      { href: '/payments', label: 'Payments', icon: Wallet, section: 'PLATFORM' },
      { href: '/payments/claims', label: 'Claims', icon: Receipt, section: 'PLATFORM' },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, section: 'PLATFORM' },
      { href: '/admin/system', label: 'System Config', icon: Server, section: 'PLATFORM' },
    ],
    color: '#1e3a8a',
    gradientFrom: '#172554',
    gradientTo: '#1e3a8a',
    badgeLabel: 'Super Admin',
  },

  org_admin: {
    label: 'Organization Admin',
    defaultDashboard: ROLE_ROUTE_TABLE.org_admin.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.org_admin.allowed],
    navItems: [
      ...FACILITY_NAV,
      // Organization administration (no href duplicates the facility nav above).
      { href: '/org-admin', label: 'Org Dashboard', icon: LayoutDashboard, section: 'ORGANIZATION' },
      { href: '/org-admin/users', label: 'Manage Users', icon: Users, section: 'ORGANIZATION' },
      { href: '/hospitals', label: 'Hospital Network', icon: HospitalIcon, section: 'ORGANIZATION' },
      { href: '/equipment', label: 'Assets', icon: Package, section: 'ORGANIZATION' },
      { href: '/org-admin/branding', label: 'Branding', icon: Palette, section: 'ORGANIZATION' },
      { href: '/org-admin/pricing', label: 'Service Pricing', icon: Receipt, section: 'ORGANIZATION' },
      { href: '/emergency-preparedness', label: 'Emergency Prep', icon: Activity, section: 'ORGANIZATION' },
      { href: '/org-admin/analytics', label: 'Analytics', icon: BarChart3, section: 'ORGANIZATION' },
      { href: '/payments', label: 'Bills', icon: Wallet, section: 'ORGANIZATION' },
      { href: '/payments/claims', label: 'Claims', icon: Receipt, section: 'ORGANIZATION' },
      { href: '/org-admin/settings', label: 'Settings', icon: Settings, section: 'ORGANIZATION' },    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Org Admin',
  },

  doctor: {
    label: 'Doctor',
    defaultDashboard: ROLE_ROUTE_TABLE.doctor.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.doctor.allowed],
    navItems: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'CLINICAL' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/consultation', label: 'Consultation', icon: FileText, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CLINICAL' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'CLINICAL' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINICAL' },
      { href: '/telehealth', label: 'Telehealth', icon: Video, section: 'CLINICAL' },
      { href: '/lab', label: 'Laboratory', icon: FlaskConical, section: 'SERVICES' },
      { href: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'SERVICES' },
      { href: '/blood-bank', label: 'Blood Bank', icon: Heart, section: 'SERVICES' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'VITAL EVENTS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'VITAL EVENTS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Doctor',
  },

  clinical_officer: {
    label: 'Clinical Officer',
    defaultDashboard: ROLE_ROUTE_TABLE.clinical_officer.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.clinical_officer.allowed],
    navItems: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'CLINICAL' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/consultation', label: 'Consultation', icon: FileText, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CLINICAL' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'CLINICAL' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINICAL' },
      { href: '/lab', label: 'Laboratory', icon: FlaskConical, section: 'SERVICES' },
      { href: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'SERVICES' },
      { href: '/blood-bank', label: 'Blood Bank', icon: Heart, section: 'SERVICES' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'VITAL EVENTS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'VITAL EVENTS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Clinical Officer',
  },

  nurse: {
    label: 'Nurse',
    defaultDashboard: ROLE_ROUTE_TABLE.nurse.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.nurse.allowed],
    navItems: [
      { href: '/dashboard/nurse', label: 'Nurse Station', icon: LayoutDashboard, section: 'CLINICAL' },
      { href: '/dashboard/nurse/ward', label: 'Ward Patients', icon: BedDouble, section: 'STATION' },
      { href: '/dashboard/nurse/mar', label: 'Medication Admin', icon: Pill, section: 'STATION' },
      { href: '/dashboard/nurse/triage', label: 'Triage (ETAT)', icon: AlertTriangle, section: 'STATION' },
      { href: '/dashboard/nurse/handoff', label: 'Shift Handoff', icon: FileText, section: 'STATION' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINICAL' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'CLINICAL' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'CARE PROGRAMS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'CARE PROGRAMS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
      { href: '/lab', label: 'Lab Results', icon: FlaskConical, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Nurse',
  },

  midwife: {
    label: 'Midwife',
    defaultDashboard: ROLE_ROUTE_TABLE.midwife.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.midwife.allowed],
    navItems: [
      { href: '/dashboard/nurse', label: 'Midwife Station', icon: LayoutDashboard, section: 'MATERNITY' },
      { href: '/patients', label: 'Mothers & Babies', icon: Users, section: 'MATERNITY' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'MATERNITY' },
      { href: '/births', label: 'Deliveries', icon: Baby, section: 'MATERNITY' },
      { href: '/wards', label: 'Maternity Ward', icon: BedDouble, section: 'MATERNITY' },
      { href: '/immunizations', label: 'Newborn Immunizations', icon: Syringe, section: 'CARE' },
      { href: '/deaths', label: 'Maternal/Perinatal Deaths', icon: Skull, section: 'CARE' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CARE' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CARE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Midwife',
  },

  lab_tech: {
    label: 'Lab Technician',
    defaultDashboard: ROLE_ROUTE_TABLE.lab_tech.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.lab_tech.allowed],
    navItems: [
      { href: '/dashboard/lab', label: 'Lab Command Center', icon: LayoutDashboard, section: 'LABORATORY' },
      { href: '/lab', label: 'Lab Orders & Results', icon: FlaskConical, section: 'LABORATORY' },
      { href: '/blood-bank', label: 'Blood Bank', icon: Heart, section: 'LABORATORY' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Lab Tech',
  },

  pharmacist: {
    label: 'Pharmacist',
    defaultDashboard: ROLE_ROUTE_TABLE.pharmacist.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.pharmacist.allowed],
    navItems: [
      { href: '/dashboard/pharmacy', label: 'Pharmacy Ops', icon: LayoutDashboard, section: 'PHARMACY' },
      { href: '/pharmacy', label: 'Dispensing', icon: Pill, section: 'PHARMACY' },
      { href: '/controlled-substances', label: 'Controlled Substances', icon: ClipboardCheck, section: 'PHARMACY' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Pharmacist',
  },

  front_desk: {
    label: 'Medical Receptionist',
    defaultDashboard: ROLE_ROUTE_TABLE.front_desk.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.front_desk.allowed],
    navItems: [
      { href: '/dashboard/front-desk', label: 'Reception', icon: LayoutDashboard, section: 'RECEPTION' },
      { href: '/check-in', label: 'Check-In', icon: ClipboardCheck, section: 'RECEPTION' },
      { href: '/patients', label: 'Patient Registry', icon: Users, section: 'RECEPTION' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'RECEPTION' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'RECEPTION' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Medical Receptionist',
  },

  cashier: {
    label: 'Cashier',
    defaultDashboard: ROLE_ROUTE_TABLE.cashier.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.cashier.allowed],
    navItems: [
      { href: '/payments', label: 'Collect Payment', icon: Wallet, section: 'CASHIER' },
      { href: '/patients', label: 'Patient Lookup', icon: Users, section: 'CASHIER' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CASHIER' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Cashier',
  },

  government: {
    label: 'Government Admin',
    defaultDashboard: ROLE_ROUTE_TABLE.government.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.government.allowed],
    navItems: [
      { href: '/government', label: 'National Dashboard', icon: LayoutDashboard, section: 'OVERVIEW' },
      { href: '/facility-management', label: 'Hospital Management', icon: HospitalIcon, section: 'OVERVIEW' },
      { href: '/hospitals', label: 'Hospital Network', icon: HospitalIcon, section: 'OVERVIEW' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'POPULATION HEALTH' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'POPULATION HEALTH' },
      { href: '/anc', label: 'Maternal Health', icon: HeartPulse, section: 'POPULATION HEALTH' },
      { href: '/births', label: 'Births', icon: Baby, section: 'POPULATION HEALTH' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'POPULATION HEALTH' },
      { href: '/epidemic-intelligence', label: 'Epidemic Intelligence', icon: Bug, section: 'INTELLIGENCE' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'INTELLIGENCE' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'INTELLIGENCE' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'GOVERNANCE' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'GOVERNANCE' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'GOVERNANCE' },
      { href: '/dhis2-export', label: 'DHIS2 Export', icon: Download, section: 'GOVERNANCE' },
      { href: '/public-stats', label: 'Public Statistics', icon: Globe, section: 'GOVERNANCE' },
    ],
    color: '#1e3a8a',
    gradientFrom: '#172554',
    gradientTo: '#1e3a8a',
    badgeLabel: 'Super Admin',
  },

  county_health_director: {
    label: 'County Health Director',
    defaultDashboard: ROLE_ROUTE_TABLE.county_health_director.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.county_health_director.allowed],
    navItems: [
      { href: '/dashboard/state', label: 'County Overview', icon: LayoutDashboard, section: 'OVERSIGHT' },
      { href: '/hospitals', label: 'Facility Network', icon: HospitalIcon, section: 'OVERSIGHT' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'INTELLIGENCE' },
      { href: '/epidemic-intelligence', label: 'Epidemic Intelligence', icon: Bug, section: 'INTELLIGENCE' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'INTELLIGENCE' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'POPULATION HEALTH' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'POPULATION HEALTH' },
      { href: '/anc', label: 'Maternal Health', icon: HeartPulse, section: 'POPULATION HEALTH' },
      { href: '/births', label: 'Births', icon: Baby, section: 'POPULATION HEALTH' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'POPULATION HEALTH' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'GOVERNANCE' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'GOVERNANCE' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'GOVERNANCE' },
      { href: '/dhis2-export', label: 'DHIS2 Export', icon: Download, section: 'GOVERNANCE' },
      { href: '/public-stats', label: 'Public Statistics', icon: Globe, section: 'GOVERNANCE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'County Director',
  },

  data_entry_clerk: {
    label: 'Data Entry Clerk',
    defaultDashboard: ROLE_ROUTE_TABLE.data_entry_clerk.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.data_entry_clerk.allowed],
    navItems: [
      { href: '/dashboard/data-entry', label: 'Data Entry', icon: LayoutDashboard, section: 'FACILITY DATA' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'FACILITY DATA' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'FACILITY DATA' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'RECORDS' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'RECORDS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'RECORDS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'RECORDS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'RECORDS' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Data Entry',
  },

  medical_superintendent: {
    label: 'Medical Superintendent',
    defaultDashboard: ROLE_ROUTE_TABLE.medical_superintendent.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.medical_superintendent.allowed],
    navItems: [
      { href: '/dashboard', label: 'Hospital Dashboard', icon: LayoutDashboard, section: 'ADMINISTRATION' },
      { href: '/hospitals', label: 'Hospital Network', icon: HospitalIcon, section: 'ADMINISTRATION' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'ADMINISTRATION' },
      { href: '/facility-overview', label: 'Facility Overview', icon: Gauge, section: 'ADMINISTRATION' },      { href: '/hr', label: 'HR & Leave', icon: Users, section: 'ADMINISTRATION' },
      { href: '/equipment', label: 'Assets', icon: Package, section: 'ADMINISTRATION' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'ADMINISTRATION' },
      { href: '/emergency-preparedness', label: 'Emergency Prep', icon: Activity, section: 'ADMINISTRATION' },
      { href: '/controlled-substances', label: 'Controlled Substances', icon: ClipboardCheck, section: 'SERVICES' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'ADMINISTRATION' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/consultation', label: 'Consultation', icon: FileText, section: 'CLINICAL' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CLINICAL' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINICAL' },
      { href: '/telehealth', label: 'Telehealth', icon: Video, section: 'CLINICAL' },
      { href: '/lab', label: 'Laboratory', icon: FlaskConical, section: 'SERVICES' },
      { href: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'SERVICES' },
      { href: '/blood-bank', label: 'Blood Bank', icon: Heart, section: 'SERVICES' },
      { href: '/payments', label: 'Bills', icon: Wallet, section: 'SERVICES' },
      { href: '/payments/claims', label: 'Claims', icon: Receipt, section: 'SERVICES' },
      { href: '/epidemic-intelligence', label: 'Epidemic Intel', icon: Bug, section: 'INTELLIGENCE' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'INTELLIGENCE' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'INTELLIGENCE' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'MORE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#1e3a8a',
    gradientFrom: '#172554',
    gradientTo: '#1e3a8a',
    badgeLabel: 'Med. Supt.',
  },

  hrio: {
    label: 'Health Records Officer',
    defaultDashboard: ROLE_ROUTE_TABLE.hrio.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.hrio.allowed],
    navItems: [
      { href: '/dashboard/data-entry', label: 'Records Dashboard', icon: LayoutDashboard, section: 'RECORDS' },
      { href: '/patients', label: 'Patient Registry', icon: Users, section: 'RECORDS' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'RECORDS' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'RECORDS' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'VITAL EVENTS' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'VITAL EVENTS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'VITAL EVENTS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'GOVERNANCE' },
      { href: '/hospitals', label: 'Facility Network', icon: Building2, section: 'GOVERNANCE' },
      { href: '/dhis2-export', label: 'DHIS2 Export', icon: Download, section: 'GOVERNANCE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'HRIO',
  },

  nutritionist: {
    label: 'Nutritionist',
    defaultDashboard: ROLE_ROUTE_TABLE.nutritionist.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.nutritionist.allowed],
    navItems: [
      { href: '/dashboard/nutrition', label: 'Nutrition Dashboard', icon: LayoutDashboard, section: 'NUTRITION' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'NUTRITION' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'PROGRAMS' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Nutritionist',
  },

  radiologist: {
    label: 'Radiologist',
    defaultDashboard: ROLE_ROUTE_TABLE.radiologist.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.radiologist.allowed],
    navItems: [
      { href: '/dashboard/radiology', label: 'Imaging Dashboard', icon: LayoutDashboard, section: 'IMAGING' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'IMAGING' },
      { href: '/lab', label: 'Lab & Imaging', icon: Scan, section: 'IMAGING' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Radiology',
  },

  hospital_manager: {
    label: 'Hospital Manager',
    defaultDashboard: ROLE_ROUTE_TABLE.hospital_manager.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.hospital_manager.allowed],
    navItems: [
      { href: '/facility-management', label: 'Dashboard', icon: LayoutDashboard, section: 'OVERVIEW' },
      { href: '/epidemic-intelligence', label: 'Epidemic Intelligence', icon: Bug, section: 'INTELLIGENCE' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'INTELLIGENCE' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'INTELLIGENCE' },
      { href: '/hospitals', label: 'Hospital Network', icon: HospitalIcon, section: 'FACILITY' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'FACILITY' },
      { href: '/facility-overview', label: 'Facility Overview', icon: Gauge, section: 'FACILITY' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'FACILITY' },
      { href: '/equipment', label: 'Assets & Equipment', icon: Package, section: 'FACILITY' },      { href: '/hr', label: 'HR & Leave', icon: Users, section: 'FACILITY' },
      { href: '/payments', label: 'Revenue & Bills', icon: Wallet, section: 'FINANCE' },
      { href: '/payments/claims', label: 'Insurance Claims', icon: Receipt, section: 'FINANCE' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'REPORTING' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'REPORTING' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'REPORTING' },
      { href: '/dhis2-export', label: 'DHIS2 Export', icon: Download, section: 'REPORTING' },
      { href: '/public-stats', label: 'Public Statistics', icon: Globe, section: 'REPORTING' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CLINICAL' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#1e3a8a',
    gradientFrom: '#172554',
    gradientTo: '#1e3a8a',
    badgeLabel: 'Hospital Manager',
  },

  medical_biller: {
    label: 'Medical Biller',
    defaultDashboard: ROLE_ROUTE_TABLE.medical_biller.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.medical_biller.allowed],
    navItems: [
      { href: '/payments', label: 'Bills & Invoices', icon: Receipt, section: 'BILLING' },
      { href: '/payments/claims', label: 'Insurance Claims', icon: ClipboardCheck, section: 'BILLING' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'PATIENTS' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'PATIENTS' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6',
    gradientFrom: '#1e3a8a',
    gradientTo: '#3b82f6',
    badgeLabel: 'Medical Biller',
  },

  // ───────── Clinical-flow workflow stations (EHR Clinical Flow doc §4) ─────────
  central_registration_clerk: {
    label: 'Registration Clerk',
    defaultDashboard: ROLE_ROUTE_TABLE.central_registration_clerk.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.central_registration_clerk.allowed],
    navItems: [
      { href: '/dashboard/front-desk', label: 'Reception', icon: LayoutDashboard, section: 'RECEPTION' },
      { href: '/patients', label: 'Patient Registry', icon: Users, section: 'RECEPTION' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'RECEPTION' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'RECEPTION' },
      { href: '/payments', label: 'Checkout Payments', icon: Wallet, section: 'CHECKOUT' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6', gradientFrom: '#1e3a8a', gradientTo: '#3b82f6', badgeLabel: 'Registration',
  },

  clinic_clerk: {
    label: 'Clinic Clerk',
    defaultDashboard: ROLE_ROUTE_TABLE.clinic_clerk.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.clinic_clerk.allowed],
    navItems: [
      { href: '/dashboard/front-desk', label: 'Reception', icon: LayoutDashboard, section: 'CLINIC' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINIC' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINIC' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6', gradientFrom: '#1e3a8a', gradientTo: '#3b82f6', badgeLabel: 'Clinic Clerk',
  },

  triage_nurse: {
    label: 'Triage Nurse',
    defaultDashboard: ROLE_ROUTE_TABLE.triage_nurse.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.triage_nurse.allowed],
    navItems: [
      { href: '/dashboard/nurse', label: 'Triage Station', icon: LayoutDashboard, section: 'TRIAGE' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'TRIAGE' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'TRIAGE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6', gradientFrom: '#1e3a8a', gradientTo: '#3b82f6', badgeLabel: 'Triage',
  },

  rooming_nurse: {
    label: 'Rooming Nurse',
    defaultDashboard: ROLE_ROUTE_TABLE.rooming_nurse.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.rooming_nurse.allowed],
    navItems: [
      { href: '/dashboard/nurse', label: 'Rooming Station', icon: LayoutDashboard, section: 'CLINIC' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINIC' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'CARE' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'CARE' },
      { href: '/lab', label: 'Lab', icon: FlaskConical, section: 'MORE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6', gradientFrom: '#1e3a8a', gradientTo: '#3b82f6', badgeLabel: 'Rooming',
  },

  clinician: {
    label: 'Clinician',
    defaultDashboard: ROLE_ROUTE_TABLE.clinician.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.clinician.allowed],
    navItems: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'CLINICAL' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/consultation', label: 'Consultation', icon: FileText, section: 'CLINICAL' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINICAL' },
      { href: '/telehealth', label: 'Telehealth', icon: Video, section: 'CLINICAL' },
      { href: '/lab', label: 'Laboratory', icon: FlaskConical, section: 'SERVICES' },
      { href: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'SERVICES' },
      { href: '/blood-bank', label: 'Blood Bank', icon: Heart, section: 'SERVICES' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'VITAL EVENTS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'VITAL EVENTS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6', gradientFrom: '#1e3a8a', gradientTo: '#3b82f6', badgeLabel: 'Clinician',
  },

  records_hmis_officer: {
    label: 'Records / HMIS Officer',
    defaultDashboard: ROLE_ROUTE_TABLE.records_hmis_officer.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.records_hmis_officer.allowed],
    navItems: [
      { href: '/dashboard/data-entry', label: 'Records Dashboard', icon: LayoutDashboard, section: 'RECORDS' },
      { href: '/patients', label: 'Patient Registry', icon: Users, section: 'RECORDS' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'RECORDS' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'RECORDS' },
      { href: '/dhis2-export', label: 'DHIS2 Export', icon: Download, section: 'GOVERNANCE' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'VITAL EVENTS' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'GOVERNANCE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#3b82f6', gradientFrom: '#1e3a8a', gradientTo: '#3b82f6', badgeLabel: 'HMIS',
  },

  facility_administrator: {
    label: 'Facility Administrator',
    defaultDashboard: ROLE_ROUTE_TABLE.facility_administrator.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.facility_administrator.allowed],
    navItems: [
      { href: '/facility-overview', label: 'Facility Dashboard', icon: LayoutDashboard, section: 'ADMINISTRATION' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'ADMINISTRATION' },      { href: '/hr', label: 'HR & Leave', icon: Users, section: 'ADMINISTRATION' },
      { href: '/equipment', label: 'Assets', icon: Package, section: 'ADMINISTRATION' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'ADMINISTRATION' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CLINICAL' },
      { href: '/blood-bank', label: 'Blood Bank', icon: Heart, section: 'CLINICAL' },
      { href: '/emergency-preparedness', label: 'Emergency Prep', icon: Activity, section: 'CLINICAL' },
      { href: '/controlled-substances', label: 'Controlled Substances', icon: ClipboardCheck, section: 'COMPLIANCE' },
      { href: '/payments', label: 'Bills', icon: Wallet, section: 'FINANCE' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'REPORTING' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'REPORTING' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#1e3a8a', gradientFrom: '#172554', gradientTo: '#1e3a8a', badgeLabel: 'Facility Admin',
  },
};

export function getRoleConfig(role: UserRole): RoleConfig {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.doctor;
}

// Both helpers delegate to `role-routes.ts` so the page-route gating logic
// is identical between Edge middleware and server/client callers. The route
// arrays embedded in `ROLE_PERMISSIONS` come from the same table, so this is
// just guaranteeing consistency at the call site too.
export function isRouteAllowed(role: UserRole, pathname: string): boolean {
  return isPathAllowedFromTable(role, pathname);
}

export function getDefaultDashboard(role: UserRole): string {
  return getDefaultDashboardFromTable(role);
}

/**
 * Roles authorized to view and act on the Conflict Reconciliation queue.
 * Kept here (not duplicated in pages) so middleware, UI, and tests share one source.
 */
export const CONFLICT_RESOLUTION_ROLES: UserRole[] = [
  'super_admin',
  'org_admin',
  'medical_superintendent',
  'hrio',
];

const WORKFLOW_ROLES: UserRole[] = ['central_registration_clerk', 'clinic_clerk', 'triage_nurse', 'rooming_nurse', 'clinician', 'records_hmis_officer', 'facility_administrator'];
const PRIVATE_SECTOR_ROLES: UserRole[] = ['org_admin', 'doctor', 'clinical_officer', 'nurse', 'midwife', 'lab_tech', 'pharmacist', 'front_desk', 'cashier', 'data_entry_clerk', 'medical_superintendent', 'hrio', 'nutritionist', 'radiologist', 'hospital_manager', 'medical_biller', ...WORKFLOW_ROLES];
const ALL_ROLES: UserRole[] = ['super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse', 'midwife', 'lab_tech', 'pharmacist', 'front_desk', 'cashier', 'government', 'county_health_director', 'data_entry_clerk', 'medical_superintendent', 'hrio', 'nutritionist', 'radiologist', 'hospital_manager', 'medical_biller', ...WORKFLOW_ROLES];

export function getAvailableRoles(orgType: 'public' | 'private', isSuperAdmin = false): UserRole[] {
  if (isSuperAdmin) return ALL_ROLES;
  if (orgType === 'private') return PRIVATE_SECTOR_ROLES;
  return ALL_ROLES;
}
