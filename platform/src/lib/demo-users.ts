import type { UserRole } from './db-types';

export const PUBLIC_ORG_ID = 'org-moh-ss';
export const PRIVATE_ORG_ID = 'org-mercy-hospital';

export type DemoUserGroup =
  | 'Front desk & billing'
  | 'Clinical care'
  | 'Diagnostics & pharmacy'
  | 'Records & administration'
  | 'Facility leadership'
  | 'Sub-national oversight'
  | 'National & platform'
  | 'Private facility';

export interface DemoUserProfile {
  username: string;
  name: string;
  role: UserRole;
  title: string;
  group: DemoUserGroup;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
  loginDescription: string;
  showInLogin?: boolean;
}

export interface DemoLoginAccount {
  role: string;
  roleKey: UserRole;
  user: string;
  desc: string;
  hospital: string;
  group: DemoUserGroup;
}

export const DEMO_USER_PROFILES: DemoUserProfile[] = [
  { username: 'desk.amira', name: 'Amira Juma Hassan', role: 'front_desk', title: 'Medical Receptionist', group: 'Front desk & billing', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'cashier.deng', name: 'Deng Akec Ring', role: 'cashier', title: 'Cashier', group: 'Front desk & billing', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'biller.nyandeng', name: 'Nyandeng Chol Atem', role: 'medical_biller', title: 'Medical Biller', group: 'Front desk & billing', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'desk.wau', name: 'Tabitha Nyandeng Kuol', role: 'front_desk', title: 'Receptionist', group: 'Front desk & billing', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Wau State Hospital' },

  { username: 'triage.mary', name: 'Mary Nyaruai Gai', role: 'triage_nurse', title: 'Triage Nurse', group: 'Clinical care', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'rooming.sara', name: 'Sara Aluel Bol', role: 'rooming_nurse', title: 'Rooming Nurse', group: 'Clinical care', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'dr.wani', name: 'Dr. James Wani Igga', role: 'doctor', title: 'Doctor', group: 'Clinical care', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'dr.achol', name: 'Dr. Achol Mayen Deng', role: 'doctor', title: 'Doctor', group: 'Clinical care', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'co.deng', name: 'Dr. Deng Mabior Kuol', role: 'clinical_officer', title: 'Doctor', group: 'Clinical care', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Wau State Hospital' },
  { username: 'dr.wau', name: 'Dr. Mary Akuol Deng', role: 'doctor', title: 'Doctor', group: 'Clinical care', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Wau State Hospital' },
  { username: 'nurse.wau', name: 'Nurse Grace Achai Lual', role: 'nurse', title: 'Nurse', group: 'Clinical care', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Wau State Hospital' },
  { username: 'nurse.stella', name: 'Nurse Stella Keji Lemi', role: 'nurse', title: 'Nurse', group: 'Clinical care', hospitalId: 'hosp-003', hospitalName: 'Malakal Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Malakal Teaching Hospital' },
  { username: 'midwife.nyakong', name: 'Midwife Nyakong Gatkuoth', role: 'midwife', title: 'Midwife', group: 'Clinical care', hospitalId: 'hosp-003', hospitalName: 'Malakal Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Malakal Teaching Hospital' },

  { username: 'lab.gatluak', name: 'Lab Tech Gatluak Puok', role: 'lab_tech', title: 'Lab Tech', group: 'Diagnostics & pharmacy', hospitalId: 'hosp-004', hospitalName: 'Bentiu State Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Bentiu State Hospital' },
  { username: 'rad.tamamhealth', name: 'TamamHealth Ladu Soro', role: 'radiologist', title: 'Radiologist', group: 'Diagnostics & pharmacy', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'pharma.rose', name: 'Pharmacist Rose Gbudue', role: 'pharmacist', title: 'Pharmacist', group: 'Diagnostics & pharmacy', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'pharma.wau', name: 'Pharmacist John Bol Garang', role: 'pharmacist', title: 'Pharmacist', group: 'Diagnostics & pharmacy', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Wau State Hospital' },
  { username: 'nutr.nyabol', name: 'Nyabol Koang Jal', role: 'nutritionist', title: 'Nutritionist', group: 'Diagnostics & pharmacy', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },

  { username: 'data.ayen', name: 'Ayen Dut Malual', role: 'data_entry_clerk', title: 'Data Entry Clerk', group: 'Records & administration', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'hrio.dut', name: 'Dut Machar Kuol', role: 'hrio', title: 'HRIO / HMIS Officer', group: 'Records & administration', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },

  { username: 'supt.lado', name: 'Dr. Lado Tombe Kenyi', role: 'medical_superintendent', title: 'Medical Superintendent', group: 'Facility leadership', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },
  { username: 'manager.aluel', name: 'Aluel Bol Maker', role: 'hospital_manager', title: 'Hospital Manager', group: 'Facility leadership', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, loginDescription: 'Juba Teaching Hospital' },

  { username: 'county.lopez', name: 'Dr. Lopez Lokai Modi', role: 'county_health_director', title: 'County Health Director', group: 'Sub-national oversight', orgId: PUBLIC_ORG_ID, loginDescription: 'County Health Office' },
  { username: 'admin', name: 'Ministry of Health', role: 'government', title: 'Government', group: 'National & platform', orgId: PUBLIC_ORG_ID, loginDescription: 'National MoH oversight' },
  { username: 'superadmin', name: 'TamamHealth Platform Admin', role: 'super_admin', title: 'Super Admin', group: 'National & platform', loginDescription: 'Platform-wide access' },

  { username: 'org.admin', name: 'Mercy Org Administrator', role: 'org_admin', title: 'Org Admin', group: 'Private facility', orgId: PRIVATE_ORG_ID, loginDescription: 'Mercy Hospital Group' },
  { username: 'dr.mercy', name: 'Dr. Grace Lado', role: 'doctor', title: 'Doctor', group: 'Private facility', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PRIVATE_ORG_ID, loginDescription: 'Mercy Hospital Group' },
];

export const DEMO_LOGIN_ACCOUNTS: DemoLoginAccount[] = DEMO_USER_PROFILES
  .filter((profile) => profile.showInLogin !== false)
  .map((profile) => ({
    role: profile.title,
    roleKey: profile.role,
    user: profile.username,
    desc: profile.loginDescription,
    hospital: profile.hospitalId ?? '',
    group: profile.group,
  }));

export const DEMO_ACCOUNT_NAMES: Record<string, string> = Object.fromEntries(
  DEMO_USER_PROFILES.map((profile) => [profile.username, profile.name]),
);

export const DEMO_ROLE_PROFILE: Record<UserRole, { department: string; specialty?: string }> = {
  super_admin: { department: 'Administration' },
  org_admin: { department: 'Administration' },
  government: { department: 'Public Health' },
  county_health_director: { department: 'County Health Office' },
  doctor: { department: 'Internal Medicine', specialty: 'Physician' },
  clinical_officer: { department: 'Outpatient', specialty: 'Doctor' },
  clinician: { department: 'General Medicine', specialty: 'Medical Officer' },
  nurse: { department: 'Nursing', specialty: 'Registered Nurse' },
  triage_nurse: { department: 'Emergency', specialty: 'Triage Nurse' },
  rooming_nurse: { department: 'Outpatient', specialty: 'Nurse' },
  midwife: { department: 'Maternity', specialty: 'Midwife' },
  pharmacist: { department: 'Pharmacy', specialty: 'Pharmacist' },
  lab_tech: { department: 'Laboratory', specialty: 'Laboratory Technician' },
  radiologist: { department: 'Radiology', specialty: 'Radiologist' },
  nutritionist: { department: 'Nutrition', specialty: 'Nutritionist' },
  front_desk: { department: 'Reception' },
  cashier: { department: 'Billing', specialty: 'Cashier' },
  medical_biller: { department: 'Billing', specialty: 'Medical Biller' },
  data_entry_clerk: { department: 'Records' },
  central_registration_clerk: { department: 'Registration' },
  clinic_clerk: { department: 'Outpatient' },
  records_hmis_officer: { department: 'Records & HMIS' },
  hrio: { department: 'Records & HMIS' },
  hospital_manager: { department: 'Administration' },
  medical_superintendent: { department: 'Administration', specialty: 'Physician' },
  facility_administrator: { department: 'Administration' },
};
