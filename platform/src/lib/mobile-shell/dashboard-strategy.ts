import type { UserRole } from '@/lib/db-types';
import type { BadgeTone } from '@/components/Badge';

export type MobileDashboardArchetype = 'clinical' | 'lab' | 'pharmacy' | 'front_desk';

/**
 * Explicit allow-list of which roles get the mobile app shell, and which
 * dashboard content strategy they use. Any UserRole not listed here falls
 * back to the existing desktop-responsive experience — deliberately, not as
 * an oversight.
 *
 * Fallback roles (14, verified against the full 26-role UserRole union so
 * none are silently unhandled): super_admin, org_admin, cashier, government,
 * county_health_director, data_entry_clerk, medical_superintendent, hrio,
 * nutritionist, radiologist, hospital_manager, medical_biller,
 * records_hmis_officer, facility_administrator. These are admin/financial/
 * oversight roles (or, for nutritionist/radiologist, roles with no lane data
 * model yet — candidate v2 archetypes) with no patient/appointment surface
 * the shell's Dashboard/Patients/Calendar tabs map onto.
 */
export const MOBILE_SHELL_ROLE_ARCHETYPE: Partial<Record<UserRole, MobileDashboardArchetype>> = {
  doctor: 'clinical',
  clinical_officer: 'clinical',
  nurse: 'clinical',
  clinician: 'clinical',
  midwife: 'clinical',
  triage_nurse: 'clinical',
  rooming_nurse: 'clinical',
  lab_tech: 'lab',
  pharmacist: 'pharmacy',
  front_desk: 'front_desk',
  central_registration_clerk: 'front_desk',
  clinic_clerk: 'front_desk',
};

export function getMobileShellArchetype(role: UserRole): MobileDashboardArchetype | undefined {
  return MOBILE_SHELL_ROLE_ARCHETYPE[role];
}

export interface MobileLane<T> {
  key: string;
  label: string;
  tone: BadgeTone;
  items: T[];
}

export interface MobileOutstandingItem {
  key: string;
  label: string;
  count: number;
  href?: string;
}

export interface MobileDashboardData {
  lanes: MobileLane<unknown>[];
  outstanding: MobileOutstandingItem[];
  loading: boolean;
}
