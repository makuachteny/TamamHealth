import type { UserRole } from './db-types';

// Role-display helpers used by the contacts picker and message UI.
// Centralised here so titles/labels stay consistent across the app.

export const ROLE_TITLE: Record<UserRole, string> = {
  super_admin: 'Admin',
  org_admin: 'Org Admin',
  doctor: 'Dr.',
  clinical_officer: 'CO.',
  medical_superintendent: 'Dr.',
  nurse: 'Nurse',
  midwife: 'Midwife',
  pharmacist: 'Pharm.',
  lab_tech: 'Lab',
  radiologist: 'Dr.',
  nutritionist: 'RD',
  front_desk: '',
  cashier: '',
  government: '',
  county_health_director: '',
  boma_health_worker: 'BHW',
  payam_supervisor: 'Sup.',
  data_entry_clerk: '',
  hrio: 'HRIO',
  community_health_volunteer: 'CHV',
  hospital_manager: 'Mgr.',
  medical_biller: 'Biller',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  doctor: 'Doctor',
  clinical_officer: 'Clinical Officer',
  medical_superintendent: 'Medical Superintendent',
  nurse: 'Nurse',
  midwife: 'Midwife',
  pharmacist: 'Pharmacist',
  lab_tech: 'Lab Tech',
  radiologist: 'Radiologist',
  nutritionist: 'Nutritionist',
  front_desk: 'Front Desk',
  cashier: 'Cashier',
  government: 'Government',
  county_health_director: 'County Health Director',
  boma_health_worker: 'Boma Health Worker',
  payam_supervisor: 'Payam Supervisor',
  data_entry_clerk: 'Data Entry Clerk',
  hrio: 'Health Records (HRIO)',
  community_health_volunteer: 'Community Volunteer',
  hospital_manager: 'Hospital Manager',
  medical_biller: 'Medical Biller',
};

/** Roles that count as "physician" for filtering. */
export const PHYSICIAN_ROLES: UserRole[] = [
  'doctor',
  'clinical_officer',
  'medical_superintendent',
  'radiologist',
];

/** Roles that count as messageable clinical staff (doctors + everyone who treats patients). */
export const CLINICAL_ROLES: UserRole[] = [
  ...PHYSICIAN_ROLES,
  'nurse',
  'midwife',
  'pharmacist',
  'lab_tech',
  'nutritionist',
];

/** Format a user's display name with their role title prefix. */
export function formatStaffName(role: UserRole, name: string): string {
  const title = ROLE_TITLE[role];
  if (!title) return name;
  return name.startsWith(title) ? name : `${title} ${name}`;
}

export function isPhysician(role: UserRole): boolean {
  return PHYSICIAN_ROLES.includes(role);
}

export function isClinical(role: UserRole): boolean {
  return CLINICAL_ROLES.includes(role);
}
