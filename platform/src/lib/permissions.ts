import type { ComponentType, CSSProperties, SVGProps } from 'react';
import type { UserRole } from './db-types';
import {
  ROLE_ROUTE_TABLE,
  isPathAllowed as isPathAllowedFromTable,
  getDefaultDashboard as getDefaultDashboardFromTable,
} from './role-routes';
import {
  DuotoneLayoutDashboard as LayoutDashboard,
  DuotoneUsers as Users,
  DuotoneFileText as FileText,
  DuotoneArrowRightLeft as ArrowRightLeft,
  DuotoneFlask as FlaskConical,
  DuotonePill as Pill,
  DuotoneActivity as Activity,
  DuotoneBarChart as BarChart3,
  DuotoneBuilding as Building2,
  DuotoneHospital as HospitalIcon,
  DuotoneMessage as MessageSquare,
  DuotoneBaby as Baby,
  DuotoneSkull as Skull,
  DuotoneHeart as Heart,
  DuotoneServer as Database,
  DuotoneDownload as Download,
  DuotoneClaim as ClipboardCheck,
  DuotoneVaccine as Syringe,
  DuotoneMCH as HeartPulse,
  DuotoneGlobe as Globe,
  DuotoneBug as Bug,
  DuotoneHome as Home,
  DuotonePalette as Palette,
  DuotoneCreditCard as CreditCard,
  DuotoneSettings as Settings,
  DuotoneCalendar as Calendar,
  DuotoneVideo as Video,
  DuotoneQR as Scan,
  DuotoneServer as Server,
  DuotoneGauge as Gauge,
  DuotoneReceipt as Receipt,
  DuotoneWallet as Wallet,
  DuotoneBedDouble as BedDouble,
  DuotonePackage as Package,
  DuotoneThumbsUp as ThumbsUp,
  DuotoneAlert as AlertTriangle,
} from '@/components/icons';

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

export const ROLE_PERMISSIONS: Record<UserRole, RoleConfig> = {
  super_admin: {
    label: 'Super Admin',
    defaultDashboard: ROLE_ROUTE_TABLE.super_admin.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.super_admin.allowed],
    navItems: [
      { href: '/admin', label: 'Platform Dashboard', icon: Gauge, section: 'OVERVIEW' },
      { href: '/admin/organizations', label: 'Organizations', icon: Building2, section: 'MANAGEMENT' },
      { href: '/admin/users', label: 'All Users', icon: Users, section: 'MANAGEMENT' },
      { href: '/admin/billing', label: 'Billing', icon: CreditCard, section: 'MANAGEMENT' },
      { href: '/payments', label: 'Payments', icon: Wallet, section: 'MANAGEMENT' },
      { href: '/payments/claims', label: 'Claims', icon: Receipt, section: 'MANAGEMENT' },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, section: 'INSIGHTS' },
      { href: '/sync-conflicts', label: 'Sync Conflicts', icon: AlertTriangle, section: 'SYSTEM' },
      { href: '/admin/system', label: 'System Config', icon: Server, section: 'SYSTEM' },
    ],
    color: '#1A3A3A',
    gradientFrom: '#142E2E',
    gradientTo: '#1A3A3A',
    badgeLabel: 'Super Admin',
  },

  org_admin: {
    label: 'Organization Admin',
    defaultDashboard: ROLE_ROUTE_TABLE.org_admin.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.org_admin.allowed],
    navItems: [
      { href: '/org-admin', label: 'Org Dashboard', icon: LayoutDashboard, section: 'ORGANIZATION' },
      { href: '/org-admin/users', label: 'Manage Users', icon: Users, section: 'ORGANIZATION' },
      { href: '/org-admin/hospitals', label: 'Facilities', icon: HospitalIcon, section: 'ORGANIZATION' },
      { href: '/hr', label: 'HR & Leave', icon: Users, section: 'ORGANIZATION' },
      { href: '/equipment', label: 'Assets', icon: Package, section: 'ORGANIZATION' },
      { href: '/org-admin/branding', label: 'Branding', icon: Palette, section: 'ORGANIZATION' },
      { href: '/org-admin/analytics', label: 'Analytics', icon: BarChart3, section: 'ORGANIZATION' },
      { href: '/payments', label: 'Bills', icon: Wallet, section: 'ORGANIZATION' },
      { href: '/payments/claims', label: 'Claims', icon: Receipt, section: 'ORGANIZATION' },
      { href: '/feedback', label: 'Patient Feedback', icon: ThumbsUp, section: 'ORGANIZATION' },
      { href: '/sync-conflicts', label: 'Sync Conflicts', icon: AlertTriangle, section: 'ORGANIZATION' },
      { href: '/org-admin/settings', label: 'Settings', icon: Settings, section: 'ORGANIZATION' },
      { href: '/hospitals', label: 'Hospital Network', icon: HospitalIcon, section: 'OVERVIEW' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'OVERVIEW' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'OVERVIEW' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
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
      { href: '/payments', label: 'Bills', icon: Wallet, section: 'SERVICES' },
      { href: '/feedback', label: 'Feedback', icon: ThumbsUp, section: 'SERVICES' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'VITAL EVENTS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'VITAL EVENTS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
      { href: '/epidemic-intelligence', label: 'Epidemic Intel', icon: Bug, section: 'INTELLIGENCE' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'INTELLIGENCE' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'INTELLIGENCE' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'MORE' },
      { href: '/hospitals', label: 'Hospital Network', icon: HospitalIcon, section: 'MORE' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
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
      { href: '/payments', label: 'Billing & Payments', icon: Wallet, section: 'SERVICES' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'VITAL EVENTS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'VITAL EVENTS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'MORE' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
    badgeLabel: 'Clinical Officer',
  },

  nurse: {
    label: 'Nurse',
    defaultDashboard: ROLE_ROUTE_TABLE.nurse.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.nurse.allowed],
    navItems: [
      { href: '/dashboard/nurse', label: 'Nurse Station', icon: LayoutDashboard, section: 'CLINICAL' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINICAL' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'CLINICAL' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'CARE PROGRAMS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'CARE PROGRAMS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
      { href: '/lab', label: 'Lab Results', icon: FlaskConical, section: 'MORE' },
      { href: '/payments', label: 'Payments', icon: Wallet, section: 'BILLING' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
    badgeLabel: 'Nurse',
  },

  lab_tech: {
    label: 'Lab Technician',
    defaultDashboard: ROLE_ROUTE_TABLE.lab_tech.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.lab_tech.allowed],
    navItems: [
      { href: '/dashboard/lab', label: 'Lab Command Center', icon: LayoutDashboard, section: 'LABORATORY' },
      { href: '/lab', label: 'Lab Orders & Results', icon: FlaskConical, section: 'LABORATORY' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
    badgeLabel: 'Lab Tech',
  },

  pharmacist: {
    label: 'Pharmacist',
    defaultDashboard: ROLE_ROUTE_TABLE.pharmacist.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.pharmacist.allowed],
    navItems: [
      { href: '/dashboard/pharmacy', label: 'Pharmacy Ops', icon: LayoutDashboard, section: 'PHARMACY' },
      { href: '/pharmacy', label: 'Dispensing', icon: Pill, section: 'PHARMACY' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
    badgeLabel: 'Pharmacist',
  },

  front_desk: {
    label: 'Front Desk',
    defaultDashboard: ROLE_ROUTE_TABLE.front_desk.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.front_desk.allowed],
    navItems: [
      { href: '/dashboard/front-desk', label: 'Reception', icon: LayoutDashboard, section: 'RECEPTION' },
      { href: '/patients', label: 'Patient Registry', icon: Users, section: 'RECEPTION' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'RECEPTION' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'RECEPTION' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'RECEPTION' },
      { href: '/payments', label: 'Bills', icon: Wallet, section: 'BILLING' },
      { href: '/payments/claims', label: 'Claims', icon: Receipt, section: 'BILLING' },
      { href: '/feedback', label: 'Feedback', icon: ThumbsUp, section: 'MORE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
    badgeLabel: 'Front Desk',
  },

  boma_health_worker: {
    label: 'Boma Health Worker',
    defaultDashboard: ROLE_ROUTE_TABLE.boma_health_worker.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.boma_health_worker.allowed],
    navItems: [
      { href: '/dashboard/boma', label: 'My Community', icon: Home, section: 'COMMUNITY' },
      { href: '/patients', label: 'Households', icon: Users, section: 'COMMUNITY' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'HEALTH' },
      { href: '/anc', label: 'ANC Visits', icon: HeartPulse, section: 'HEALTH' },
      { href: '/births', label: 'Births', icon: Baby, section: 'HEALTH' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'HEALTH' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#0d9488',
    gradientFrom: '#0f766e',
    gradientTo: '#0d9488',
    badgeLabel: 'BHW',
  },

  payam_supervisor: {
    label: 'Payam Supervisor',
    defaultDashboard: ROLE_ROUTE_TABLE.payam_supervisor.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.payam_supervisor.allowed],
    navItems: [
      { href: '/dashboard/payam', label: 'Payam Overview', icon: LayoutDashboard, section: 'OVERSIGHT' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'OVERSIGHT' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'OVERSIGHT' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'OVERSIGHT' },
      { href: '/dashboard/boma', label: 'BHW Dashboard', icon: Home, section: 'SUPERVISION' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'HEALTH PROGRAMS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'HEALTH PROGRAMS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'HEALTH PROGRAMS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'HEALTH PROGRAMS' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'MONITORING' },
      { href: '/facility-assessments', label: 'Facility Checks', icon: ClipboardCheck, section: 'MONITORING' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'MONITORING' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'MORE' },
    ],
    color: '#0d9488',
    gradientFrom: '#0f766e',
    gradientTo: '#0d9488',
    badgeLabel: 'Payam Supervisor',
  },

  government: {
    label: 'Government Admin',
    defaultDashboard: ROLE_ROUTE_TABLE.government.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.government.allowed],
    navItems: [
      { href: '/government', label: 'National Dashboard', icon: LayoutDashboard, section: 'OVERVIEW' },
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
    color: '#1A3A3A',
    gradientFrom: '#142E2E',
    gradientTo: '#1A3A3A',
    badgeLabel: 'Super Admin',
  },

  data_entry_clerk: {
    label: 'Data Entry Clerk',
    defaultDashboard: ROLE_ROUTE_TABLE.data_entry_clerk.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.data_entry_clerk.allowed],
    navItems: [
      { href: '/dashboard/data-entry', label: 'Data Entry', icon: LayoutDashboard, section: 'FACILITY DATA' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'FACILITY DATA' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'FACILITY DATA' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'FACILITY DATA' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'RECORDS' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'RECORDS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'RECORDS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'RECORDS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'RECORDS' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
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
      { href: '/hr', label: 'HR & Leave', icon: Users, section: 'ADMINISTRATION' },
      { href: '/equipment', label: 'Assets', icon: Package, section: 'ADMINISTRATION' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'ADMINISTRATION' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'ADMINISTRATION' },
      { href: '/sync-conflicts', label: 'Sync Conflicts', icon: AlertTriangle, section: 'ADMINISTRATION' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'CLINICAL' },
      { href: '/wards', label: 'Wards', icon: BedDouble, section: 'CLINICAL' },
      { href: '/consultation', label: 'Consultation', icon: FileText, section: 'CLINICAL' },
      { href: '/referrals', label: 'Referrals', icon: ArrowRightLeft, section: 'CLINICAL' },
      { href: '/appointments', label: 'Appointments', icon: Calendar, section: 'CLINICAL' },
      { href: '/telehealth', label: 'Telehealth', icon: Video, section: 'CLINICAL' },
      { href: '/lab', label: 'Laboratory', icon: FlaskConical, section: 'SERVICES' },
      { href: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'SERVICES' },
      { href: '/payments', label: 'Bills', icon: Wallet, section: 'SERVICES' },
      { href: '/payments/claims', label: 'Claims', icon: Receipt, section: 'SERVICES' },
      { href: '/feedback', label: 'Patient Feedback', icon: ThumbsUp, section: 'SERVICES' },
      { href: '/epidemic-intelligence', label: 'Epidemic Intel', icon: Bug, section: 'INTELLIGENCE' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'INTELLIGENCE' },
      { href: '/surveillance', label: 'Surveillance', icon: Activity, section: 'INTELLIGENCE' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'MORE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#1A3A3A',
    gradientFrom: '#142E2E',
    gradientTo: '#1A3A3A',
    badgeLabel: 'Med. Supt.',
  },

  hrio: {
    label: 'Health Records Officer',
    defaultDashboard: ROLE_ROUTE_TABLE.hrio.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.hrio.allowed],
    navItems: [
      { href: '/dashboard/hr', label: 'HR Dashboard', icon: LayoutDashboard, section: 'PEOPLE OPS' },
      { href: '/hr', label: 'Staff & Leave', icon: Users, section: 'PEOPLE OPS' },
      { href: '/feedback', label: 'Patient Feedback', icon: ThumbsUp, section: 'PEOPLE OPS' },
      { href: '/dashboard/data-entry', label: 'Records Entry', icon: ClipboardCheck, section: 'RECORDS' },
      { href: '/patients', label: 'Patient Registry', icon: Users, section: 'RECORDS' },
      { href: '/data-quality', label: 'Data Quality', icon: Database, section: 'RECORDS' },
      { href: '/sync-conflicts', label: 'Sync Conflicts', icon: AlertTriangle, section: 'RECORDS' },
      { href: '/reports', label: 'Reports', icon: BarChart3, section: 'RECORDS' },
      { href: '/vital-statistics', label: 'Vital Statistics', icon: Heart, section: 'VITAL EVENTS' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'VITAL EVENTS' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'VITAL EVENTS' },
      { href: '/births', label: 'Births', icon: Baby, section: 'VITAL EVENTS' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'VITAL EVENTS' },
      { href: '/facility-assessments', label: 'Facility Assessments', icon: ClipboardCheck, section: 'GOVERNANCE' },
      { href: '/hospitals', label: 'Facility Network', icon: Building2, section: 'GOVERNANCE' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'MORE' },
    ],
    color: '#0d9488',
    gradientFrom: '#0f766e',
    gradientTo: '#0d9488',
    badgeLabel: 'HRIO',
  },

  community_health_volunteer: {
    label: 'Community Health Volunteer',
    defaultDashboard: ROLE_ROUTE_TABLE.community_health_volunteer.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.community_health_volunteer.allowed],
    navItems: [
      { href: '/dashboard/boma', label: 'My Community', icon: Home, section: 'COMMUNITY' },
      { href: '/patients', label: 'Households', icon: Users, section: 'COMMUNITY' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'HEALTH' },
      { href: '/anc', label: 'ANC Visits', icon: HeartPulse, section: 'HEALTH' },
      { href: '/births', label: 'Births', icon: Baby, section: 'HEALTH' },
      { href: '/deaths', label: 'Deaths', icon: Skull, section: 'HEALTH' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
    ],
    color: '#0d9488',
    gradientFrom: '#0f766e',
    gradientTo: '#0d9488',
    badgeLabel: 'CHV',
  },

  nutritionist: {
    label: 'Nutritionist',
    defaultDashboard: ROLE_ROUTE_TABLE.nutritionist.defaultDashboard,
    allowedRoutes: [...ROLE_ROUTE_TABLE.nutritionist.allowed],
    navItems: [
      { href: '/dashboard/nutrition', label: 'Nutrition Dashboard', icon: LayoutDashboard, section: 'NUTRITION' },
      { href: '/patients', label: 'Patients', icon: Users, section: 'NUTRITION' },
      { href: '/anc', label: 'Antenatal Care', icon: HeartPulse, section: 'PROGRAMS' },
      { href: '/immunizations', label: 'Immunizations', icon: Syringe, section: 'PROGRAMS' },
      { href: '/mch-analytics', label: 'MCH Analytics', icon: HeartPulse, section: 'PROGRAMS' },
      { href: '/messages', label: 'Messages', icon: MessageSquare, section: 'MORE' },
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
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
      { href: '/my-facility', label: 'My Facility', icon: Building2, section: 'MORE' },
    ],
    color: '#1B9AAA',
    gradientFrom: '#1E4D4A',
    gradientTo: '#1B9AAA',
    badgeLabel: 'Radiology',
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

const PRIVATE_SECTOR_ROLES: UserRole[] = ['org_admin', 'doctor', 'clinical_officer', 'nurse', 'lab_tech', 'pharmacist', 'front_desk', 'data_entry_clerk', 'medical_superintendent', 'hrio', 'nutritionist', 'radiologist'];
const ALL_ROLES: UserRole[] = ['super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse', 'lab_tech', 'pharmacist', 'front_desk', 'government', 'boma_health_worker', 'payam_supervisor', 'data_entry_clerk', 'medical_superintendent', 'hrio', 'community_health_volunteer', 'nutritionist', 'radiologist'];

export function getAvailableRoles(orgType: 'public' | 'private', isSuperAdmin = false): UserRole[] {
  if (isSuperAdmin) return ALL_ROLES;
  if (orgType === 'private') return PRIVATE_SECTOR_ROLES;
  return ALL_ROLES;
}
