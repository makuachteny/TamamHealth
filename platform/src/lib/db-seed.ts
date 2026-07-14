import { hashPassword } from './auth';
import {
  usersDB, patientsDB, hospitalsDB, referralsDB,
  diseaseAlertsDB, labResultsDB, prescriptionsDB, medicalRecordsDB,
  messagesDB, conversationsDB, birthsDB, deathsDB, facilityAssessmentsDB,
  immunizationsDB, ancDB, followUpsDB,
  organizationsDB,
  paymentsDB, insurancePoliciesDB, chargesDB, claimsDB,
  paymentPlansDB, ledgerDB, billingDB, feeScheduleDB,
  appointmentsDB, wardDB, pharmacyInventoryDB, triageDB, availabilityDB,
  assetsDB, leaveRequestsDB, payrollEntriesDB,
  problemsDB, telehealthDB, patientNotesDB, orderSetsDB,
  phoneNotesDB, assessmentsDB, intakeFormsDB, bloodBankDB,
  isSeeded, markSeeded, resetAllDatabases, getDB,
  isSeedInProgress, markSeedStarted
} from './db';
// `@/data/mock` carries 88 KB of fake patient PHI (50+ patient records, fake
// hospitals, sample referrals/alerts). It is imported dynamically inside the
// demo branch only — a static value-import here would bundle that PHI into
// every production build, even though the production seed never uses it.
import type {
  UserDoc, PatientDoc, HospitalDoc, ReferralDoc,
  DiseaseAlertDoc, LabResultDoc, PrescriptionDoc, MedicalRecordDoc, MessageDoc,
  BirthRegistrationDoc, DeathRegistrationDoc, FacilityAssessmentDoc,
  ImmunizationDoc, ANCVisitDoc, FollowUpDoc, OrganizationDoc,
  PatientNoteDoc, OrderSetDoc, PhoneNoteDoc, AssessmentDoc, PatientIntakeFormDoc
} from './db-types';
import type { AllergyEntry, DirectiveEntry, CareAlertEntry } from '@/data/mock';
import type {
  PaymentDoc, InsurancePolicyDoc, ChargeDoc, ClaimDoc,
  PaymentPlanDoc, LedgerEntryDoc
} from './db-types-payments';
import type { BillingDoc, ChargeCategory } from './db-types-billing';
import type {
  AppointmentDoc, TriageDoc, PharmacyInventoryDoc, ProblemDoc,
  TelehealthSessionDoc
} from './db-types';
import type { WardDoc, BedDoc, AdmissionDoc } from './db-types-ward';
import type { AssetDoc } from './db-types-asset';
import type { PayrollEntryDoc, LeaveRequestDoc } from './db-types-hr';
import { BRAND_PRIMARY, BRAND_SECONDARY } from './theme-colors';

// Default org IDs
const PUBLIC_ORG_ID = 'org-moh-ss';
const PRIVATE_ORG_ID = 'org-mercy-hospital';

// ═══ Date-freshness helpers ═══════════════════════════════════════
// Demo clinical data is anchored RELATIVE to "now" so trend charts and
// "recent activity" widgets always look current regardless of when the
// app is opened. `daysAgo(n)` returns an ISO datetime n days before now;
// `dateAgo(n)` returns just the YYYY-MM-DD slice (for date-only fields).
const SEED_NOW = Date.now();
function daysAgo(n: number): string {
  return new Date(SEED_NOW - n * 86400000).toISOString();
}
// Date-ONLY fields (appointmentDate etc.) must be in the browser's LOCAL
// calendar, not UTC: the dashboards compute "today" with local getFullYear/
// getMonth/getDate (see toIsoDate in EhrMiniCalendar). With UTC dates, anyone
// west of UTC using the app in the evening got "today's" seeded bookings
// stamped with tomorrow's date — schedule boards looked empty right after a
// fresh seed. Timestamps (daysAgo above) stay UTC ISO instants.
function localIsoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateAgo(n: number): string {
  return localIsoDate(SEED_NOW - n * 86400000);
}
function dateFromNow(n: number): string {
  return localIsoDate(SEED_NOW + n * 86400000);
}

const defaultOrganizations: Omit<OrganizationDoc, '_rev'>[] = [
  {
    _id: PUBLIC_ORG_ID,
    type: 'organization',
    name: 'Republic of South Sudan',
    slug: 'moh-ss',
    primaryColor: BRAND_PRIMARY,
    secondaryColor: BRAND_SECONDARY,
    accentColor: BRAND_PRIMARY,
    subscriptionStatus: 'active',
    subscriptionPlan: 'enterprise',
    maxUsers: 1000,
    maxHospitals: 200,
    featureFlags: { epidemicIntelligence: true, mchAnalytics: true, dhis2Export: true, aiClinicalSupport: true, communityHealth: true, facilityAssessments: true },
    orgType: 'public',
    contactEmail: 'support.tamam@gmail.com',
    country: 'South Sudan',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    _id: PRIVATE_ORG_ID,
    type: 'organization',
    name: 'Mercy Hospital Group',
    slug: 'mercy-hospital',
    primaryColor: 'var(--accent-primary)',
    secondaryColor: '#4F46E5',
    accentColor: '#A78BFA',
    subscriptionStatus: 'active',
    subscriptionPlan: 'professional',
    maxUsers: 50,
    maxHospitals: 5,
    featureFlags: { epidemicIntelligence: false, mchAnalytics: true, dhis2Export: false, aiClinicalSupport: true, communityHealth: false, facilityAssessments: false },
    orgType: 'private',
    contactEmail: 'support.tamam@gmail.com',
    country: 'South Sudan',
    isActive: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
];

// Profile metadata for the seeded demo users. Plaintext passwords are
// generated server-side at first boot (see lib/seed-credentials.ts) and
// fetched at seed time via /api/demo-credentials.
type SeedUserRole =
  | 'super_admin' | 'government' | 'county_health_director' | 'doctor'
  | 'clinical_officer' | 'nurse' | 'midwife'
  | 'lab_tech' | 'pharmacist' | 'front_desk' | 'cashier'
  | 'data_entry_clerk' | 'medical_superintendent'
  | 'hrio' | 'nutritionist' | 'radiologist'
  | 'org_admin' | 'hospital_manager' | 'medical_biller'
  | 'central_registration_clerk' | 'clinic_clerk' | 'triage_nurse' | 'rooming_nurse'
  | 'clinician' | 'records_hmis_officer' | 'facility_administrator';

interface SeedUserProfile {
  username: string;
  name: string;
  role: SeedUserRole;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

const defaultUsers: SeedUserProfile[] = [
  // Platform super admin (no org)
  { username: 'superadmin', name: 'TamamHealth Platform Admin', role: 'super_admin' },
  // Public org users (government MoH)
  { username: 'admin', name: 'Ministry of Health', role: 'government', orgId: PUBLIC_ORG_ID },
  { username: 'dr.wani', name: 'Dr. James Wani Igga', role: 'doctor', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'dr.achol', name: 'Dr. Achol Mayen Deng', role: 'doctor', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'co.deng', name: 'CO Deng Mabior Kuol', role: 'clinical_officer', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'dr.wau', name: 'Dr. Mary Akuol Deng', role: 'doctor', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'nurse.wau', name: 'Nurse Grace Achai Lual', role: 'nurse', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'pharma.wau', name: 'Pharmacist John Bol Garang', role: 'pharmacist', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'desk.wau', name: 'Tabitha Nyandeng Kuol', role: 'front_desk', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'nurse.stella', name: 'Nurse Stella Keji Lemi', role: 'nurse', hospitalId: 'hosp-003', hospitalName: 'Malakal Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'lab.gatluak', name: 'Lab Tech Gatluak Puok', role: 'lab_tech', hospitalId: 'hosp-004', hospitalName: 'Bentiu State Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'pharma.rose', name: 'Pharmacist Rose Gbudue', role: 'pharmacist', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'desk.amira', name: 'Amira Juma Hassan', role: 'front_desk', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'data.ayen', name: 'Ayen Dut Malual', role: 'data_entry_clerk', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'supt.lado', name: 'Dr. Lado Tombe Kenyi', role: 'medical_superintendent', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'manager.aluel', name: 'Aluel Bol Maker', role: 'hospital_manager', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'biller.nyandeng', name: 'Nyandeng Chol Atem', role: 'medical_biller', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'hrio.dut', name: 'Dut Machar Kuol', role: 'hrio', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'nutr.nyabol', name: 'Nyabol Koang Jal', role: 'nutritionist', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'rad.tamamhealth', name: 'TamamHealth Ladu Soro', role: 'radiologist', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'midwife.nyakong', name: 'Midwife Nyakong Gatkuoth', role: 'midwife', hospitalId: 'hosp-003', hospitalName: 'Malakal Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'cashier.deng', name: 'Deng Akec Ring', role: 'cashier', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'county.lopez', name: 'Dr. Lopez Lokai Modi', role: 'county_health_director', orgId: PUBLIC_ORG_ID },
  // Clinical-flow workflow stations (EHR Clinical Flow doc §4)
  { username: 'reg.clerk', name: 'Grace Poni Lukudu', role: 'central_registration_clerk', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'clinic.clerk', name: 'Joseph Taban Lado', role: 'clinic_clerk', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'triage.mary', name: 'Mary Nyaruai Gai', role: 'triage_nurse', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'rooming.sara', name: 'Sara Aluel Bol', role: 'rooming_nurse', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'clinician.peter', name: 'Dr. Peter Garang Deng', role: 'clinician', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'hmis.john', name: 'John Majok Chol', role: 'records_hmis_officer', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'facadmin.rita', name: 'Rita Akello Ojok', role: 'facility_administrator', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  // Private org admin (Mercy Hospital Group)
  { username: 'org.admin', name: 'Mercy Org Administrator', role: 'org_admin', orgId: PRIVATE_ORG_ID },
  { username: 'dr.mercy', name: 'Dr. Grace Lado', role: 'doctor', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PRIVATE_ORG_ID },
];

/**
 * Role → staff-profile defaults. Populates department + specialty for every
 * seeded user so the staff directory, HR, messaging contacts, and provider
 * pickers are fully filled out for all roles (not just name + role).
 */
const ROLE_PROFILE: Record<SeedUserRole, { department: string; specialty?: string }> = {
  super_admin: { department: 'Administration' },
  org_admin: { department: 'Administration' },
  government: { department: 'Public Health' },
  county_health_director: { department: 'County Health Office' },
  doctor: { department: 'Internal Medicine', specialty: 'Physician' },
  clinical_officer: { department: 'Outpatient', specialty: 'Clinical Officer' },
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
  hrio: { department: 'Human Resources' },
  hospital_manager: { department: 'Administration' },
  medical_superintendent: { department: 'Administration', specialty: 'Physician' },
  facility_administrator: { department: 'Administration' },
};

/**
 * Demo-mode seed: pull plaintext passwords for the seeded users from the
 * server. The /api/demo-credentials route reads `.seed-credentials.json` (or
 * generates it on first hit) so the same passwords work for the local
 * PouchDB seed and the server-side login API.
 */
async function fetchDemoCredentials(): Promise<Record<string, string>> {
  const res = await fetch('/api/demo-credentials', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`[db-seed] /api/demo-credentials returned ${res.status}`);
  }
  const body = (await res.json()) as { profiles: { username: string; password: string | null }[] };
  const out: Record<string, string> = {};
  for (const p of body.profiles) {
    if (p.password) out[p.username] = p.password;
  }
  return out;
}

/** Same endpoint, but only the bootstrap admin password is needed in production. */
async function fetchAdminCredential(): Promise<{ username: string; password: string } | null> {
  try {
    const res = await fetch('/api/demo-credentials', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { profiles: { username: string; password: string | null }[] };
    const adminRow = body.profiles.find((p) => p.username === 'admin');
    if (!adminRow?.password) return null;
    return { username: 'admin', password: adminRow.password };
  } catch {
    return null;
  }
}

export const labOrders: Omit<LabResultDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'lab-001', type: 'lab_result', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', hospitalNumber: 'JTH-000001', testName: 'Malaria RDT', specimen: 'Blood', status: 'completed', result: 'Positive (P. falciparum)', unit: '', referenceRange: 'Negative', abnormal: true, critical: false, orderedBy: 'Dr. James Wani Igga', orderedAt: '2026-02-09T08:30:00Z', completedAt: '2026-02-09T09:15:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T08:30:00Z', updatedAt: '2026-02-09T09:15:00Z' },
  { _id: 'lab-002', type: 'lab_result', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', hospitalNumber: 'JTH-000005', testName: 'Full Blood Count', specimen: 'Blood (EDTA)', status: 'completed', result: 'Hb 7.2 g/dL, WBC 14.3\u00d710\u00b3/\u03bcL', unit: '', referenceRange: '', abnormal: true, critical: false, orderedBy: 'Dr. Achol Mayen Deng', orderedAt: '2026-02-09T07:45:00Z', completedAt: '2026-02-09T10:30:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T07:45:00Z', updatedAt: '2026-02-09T10:30:00Z' },
  { _id: 'lab-003', type: 'lab_result', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', hospitalNumber: 'JTH-000012', testName: 'CD4 Count', specimen: 'Blood (EDTA)', status: 'in_progress', result: '', unit: '', referenceRange: '500-1500 cells/\u03bcL', abnormal: false, critical: false, orderedBy: 'Dr. Achol Mayen Deng', orderedAt: '2026-02-09T09:00:00Z', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:00:00Z', updatedAt: '2026-02-09T09:00:00Z' },
  { _id: 'lab-004', type: 'lab_result', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', hospitalNumber: 'JTH-000018', testName: 'Blood Glucose (Fasting)', specimen: 'Blood', status: 'completed', result: '198 mg/dL', unit: 'mg/dL', referenceRange: '70-100', abnormal: true, critical: false, orderedBy: 'CO Deng Mabior Kuol', orderedAt: '2026-02-09T06:30:00Z', completedAt: '2026-02-09T07:00:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T06:30:00Z', updatedAt: '2026-02-09T07:00:00Z' },
  { _id: 'lab-005', type: 'lab_result', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', hospitalNumber: 'JTH-000022', testName: 'Hemoglobin', specimen: 'Blood', status: 'completed', result: '4.2 g/dL', unit: 'g/dL', referenceRange: '12.0-16.0', abnormal: true, critical: true, orderedBy: 'Dr. James Wani Igga', orderedAt: '2026-02-09T10:00:00Z', completedAt: '2026-02-09T10:45:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:00:00Z', updatedAt: '2026-02-09T10:45:00Z' },
  { _id: 'lab-006', type: 'lab_result', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', hospitalNumber: 'JTH-000030', testName: 'Liver Function Tests', specimen: 'Blood', status: 'pending', result: '', unit: '', referenceRange: '', abnormal: false, critical: false, orderedBy: 'Dr. James Wani Igga', orderedAt: '2026-02-09T11:00:00Z', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T11:00:00Z', updatedAt: '2026-02-09T11:00:00Z' },
  { _id: 'lab-007', type: 'lab_result', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', hospitalNumber: 'JTH-000035', testName: 'HIV Rapid Test', specimen: 'Blood', status: 'completed', result: 'Non-reactive', unit: '', referenceRange: 'Non-reactive', abnormal: false, critical: false, orderedBy: 'Dr. Achol Mayen Deng', orderedAt: '2026-02-09T08:00:00Z', completedAt: '2026-02-09T08:30:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T08:00:00Z', updatedAt: '2026-02-09T08:30:00Z' },
  { _id: 'lab-008', type: 'lab_result', patientId: 'pat-00040', patientName: 'Majok Chol Wol', hospitalNumber: 'JTH-000040', testName: 'Urinalysis', specimen: 'Urine', status: 'in_progress', result: '', unit: '', referenceRange: 'Normal', abnormal: false, critical: false, orderedBy: 'Dr. Peter Garang Deng', orderedAt: '2026-02-09T09:30:00Z', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:30:00Z', updatedAt: '2026-02-09T09:30:00Z' },
  { _id: 'lab-009', type: 'lab_result', patientId: 'pat-00008', patientName: 'Ayen Dut Malual', hospitalNumber: 'JTH-000008', testName: 'Sputum AFB', specimen: 'Sputum', status: 'pending', result: '', unit: '', referenceRange: 'Negative', abnormal: false, critical: false, orderedBy: 'Dr. James Wani Igga', orderedAt: '2026-02-09T11:30:00Z', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T11:30:00Z', updatedAt: '2026-02-09T11:30:00Z' },
  { _id: 'lab-010', type: 'lab_result', patientId: 'pat-00015', patientName: 'Tut Chuol Both', hospitalNumber: 'JTH-000015', testName: 'Renal Function', specimen: 'Blood', status: 'completed', result: 'Creatinine 1.8 mg/dL, BUN 45 mg/dL', unit: '', referenceRange: 'Cr 0.6-1.2, BUN 7-20', abnormal: true, critical: false, orderedBy: 'Dr. Achol Mayen Deng', orderedAt: '2026-02-08T14:00:00Z', completedAt: '2026-02-08T16:30:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-08T14:00:00Z', updatedAt: '2026-02-08T16:30:00Z' },
];

export const prescriptionQueue: Omit<PrescriptionDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'rx-001', type: 'prescription', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', medication: 'Artemether-Lumefantrine (Coartem)', dose: '80/480mg BD x 3 days', route: 'Oral', frequency: 'BD', duration: '3 days', prescribedBy: 'Dr. James Wani Igga', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:15:00Z', updatedAt: '2026-02-09T09:15:00Z' },
  { _id: 'rx-002', type: 'prescription', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', medication: 'Ferrous Sulfate + Folic Acid', dose: '200mg OD x 30 days', route: 'Oral', frequency: 'OD', duration: '30 days', prescribedBy: 'Dr. Achol Mayen Deng', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:30:00Z', updatedAt: '2026-02-09T09:30:00Z' },
  { _id: 'rx-003', type: 'prescription', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', medication: 'TDF/3TC/DTG', dose: '300/300/50mg OD x 90 days', route: 'Oral', frequency: 'OD', duration: '90 days', prescribedBy: 'Dr. Achol Mayen Deng', status: 'dispensed', dispensedAt: '2026-02-09T10:30:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:00:00Z', updatedAt: '2026-02-09T10:30:00Z' },
  { _id: 'rx-004', type: 'prescription', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', medication: 'Metformin', dose: '500mg BD x 30 days', route: 'Oral', frequency: 'BD', duration: '30 days', prescribedBy: 'CO Deng Mabior Kuol', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:15:00Z', updatedAt: '2026-02-09T10:15:00Z' },
  { _id: 'rx-005', type: 'prescription', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', medication: 'Paracetamol', dose: '1g QDS PRN x 5 days', route: 'Oral', frequency: 'QDS PRN', duration: '5 days', prescribedBy: 'Dr. James Wani Igga', status: 'dispensed', dispensedAt: '2026-02-09T11:00:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:45:00Z', updatedAt: '2026-02-09T11:00:00Z' },
  { _id: 'rx-006', type: 'prescription', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', medication: 'Amoxicillin', dose: '500mg TDS x 7 days', route: 'Oral', frequency: 'TDS', duration: '7 days', prescribedBy: 'Dr. James Wani Igga', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T11:00:00Z', updatedAt: '2026-02-09T11:00:00Z' },
];

export const seedMessages: Omit<MessageDoc, '_rev' | 'createdBy'>[] = [
  {
    _id: 'msg-001', type: 'message', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', patientPhone: '+211912345678',
    fromDoctorId: 'user-dr.wani', fromDoctorName: 'Dr. James Wani Igga', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Medication Reminder', body: 'Please remember to take your Coartem medication with food. Come back on 16 Feb for follow-up.',
    channel: 'both', status: 'delivered', sentAt: '2026-02-09T10:30:00Z', createdAt: '2026-02-09T10:30:00Z', updatedAt: '2026-02-09T10:30:00Z',
  },
  {
    _id: 'msg-002', type: 'message', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', patientPhone: '+211912555005',
    fromDoctorId: 'user-dr.achol', fromDoctorName: 'Dr. Achol Mayen Deng', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Lab Results Ready', body: 'Your lab results are ready. Please visit the hospital to discuss them with your doctor.',
    channel: 'app', status: 'sent', sentAt: '2026-02-09T11:00:00Z', createdAt: '2026-02-09T11:00:00Z', updatedAt: '2026-02-09T11:00:00Z',
  },
  {
    _id: 'msg-003', type: 'message', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', patientPhone: '+211912555012',
    fromDoctorId: 'user-dr.wani', fromDoctorName: 'Dr. James Wani Igga', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Follow-up Appointment', body: 'Please come for your follow-up appointment on 20 Feb. Bring your medication card.',
    channel: 'sms', status: 'delivered', sentAt: '2026-02-08T14:00:00Z', createdAt: '2026-02-08T14:00:00Z', updatedAt: '2026-02-08T14:00:00Z',
  },
  {
    _id: 'msg-004', type: 'message', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211912555018',
    fromDoctorId: 'user-dr.achol', fromDoctorName: 'Dr. Achol Mayen Deng', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Medicine Ready', body: 'Your medicine is ready at the pharmacy. Please collect it today before 5 PM.',
    channel: 'both', status: 'sent', sentAt: '2026-02-09T09:00:00Z', createdAt: '2026-02-09T09:00:00Z', updatedAt: '2026-02-09T09:00:00Z',
  },
  // Inbound patient enquiries (patient → staff) — power the facility dashboard
  // "Enquiries" panel. fromDoctorId='patient' + direction mark them inbound.
  {
    _id: 'msg-enq-1', type: 'message', recipientType: 'staff', direction: 'patient_to_staff',
    patientId: 'pat-00001', patientName: 'Deng Mabior Garang', patientPhone: '+211912345678',
    fromDoctorId: 'patient', fromDoctorName: 'Deng Mabior Garang', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'General enquiry — appointment time', body: 'Can I move my follow-up to the afternoon?',
    channel: 'app', status: 'delivered', sentAt: dateAgo(0) + 'T08:15:00Z', createdAt: dateAgo(0) + 'T08:15:00Z', updatedAt: dateAgo(0) + 'T08:15:00Z',
  },
  {
    _id: 'msg-enq-2', type: 'message', recipientType: 'staff', direction: 'patient_to_staff',
    patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', patientPhone: '+211912555005',
    fromDoctorId: 'patient', fromDoctorName: 'Nyamal Koang Gatdet', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Medication question', body: 'Should I take the iron tablets before or after meals?',
    channel: 'sms', status: 'delivered', sentAt: dateAgo(1) + 'T11:40:00Z', createdAt: dateAgo(1) + 'T11:40:00Z', updatedAt: dateAgo(1) + 'T11:40:00Z',
  },
  {
    _id: 'msg-enq-3', type: 'message', recipientType: 'staff', direction: 'patient_to_staff',
    patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211912555018',
    fromDoctorId: 'patient', fromDoctorName: 'Rose Tombura Gbudue', fromHospitalName: 'Wau State Hospital',
    subject: 'Test results enquiry', body: 'Are my blood test results ready yet?',
    channel: 'app', status: 'delivered', sentAt: dateAgo(2) + 'T14:05:00Z', createdAt: dateAgo(2) + 'T14:05:00Z', updatedAt: dateAgo(2) + 'T14:05:00Z',
  },
  {
    _id: 'msg-enq-4', type: 'message', recipientType: 'staff', direction: 'patient_to_staff',
    patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', patientPhone: '+211912555022',
    fromDoctorId: 'patient', fromDoctorName: 'Kuol Akot Ajith', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Referral request', body: 'I would like a referral to the eye clinic.',
    channel: 'app', status: 'delivered', sentAt: dateAgo(3) + 'T09:50:00Z', createdAt: dateAgo(3) + 'T09:50:00Z', updatedAt: dateAgo(3) + 'T09:50:00Z',
  },
];

const seedBirths: Omit<BirthRegistrationDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'birth-001', type: 'birth', childFirstName: 'Akon', childSurname: 'Deng', childGender: 'Female', dateOfBirth: '2026-02-08', placeOfBirth: 'Juba Teaching Hospital', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', motherName: 'Achol Mayen Garang', motherAge: 24, motherNationality: 'South Sudanese', fatherName: 'Deng Mabior Garang', fatherNationality: 'South Sudanese', birthWeight: 3200, birthType: 'single', deliveryType: 'normal', attendedBy: 'Midwife', registeredBy: 'Dr. James Wani Igga', state: 'Central Equatoria', county: 'Juba', certificateNumber: 'CE-B-2026-0001', childPatientId: 'pat-00051', motherPatientId: 'pat-00057', createdAt: '2026-02-08T06:30:00Z', updatedAt: '2026-02-08T06:30:00Z' },
  { _id: 'birth-002', type: 'birth', childFirstName: 'Kuol', childSurname: 'Majok', childGender: 'Male', dateOfBirth: '2026-02-07', placeOfBirth: 'Juba Teaching Hospital', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', motherName: 'Nyandeng Chol Wol', motherAge: 28, motherNationality: 'South Sudanese', fatherName: 'Majok Chol Wol', fatherNationality: 'South Sudanese', birthWeight: 2900, birthType: 'single', deliveryType: 'caesarean', attendedBy: 'Doctor', registeredBy: 'Dr. Achol Mayen Deng', state: 'Central Equatoria', county: 'Juba', certificateNumber: 'CE-B-2026-0002', childPatientId: 'pat-00052', motherPatientId: 'pat-00062', createdAt: '2026-02-07T14:00:00Z', updatedAt: '2026-02-07T14:00:00Z' },
  { _id: 'birth-003', type: 'birth', childFirstName: 'Nyamal', childSurname: 'Gatluak', childGender: 'Female', dateOfBirth: '2026-02-06', placeOfBirth: 'Bentiu State Hospital', facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', motherName: 'Nyakuoth Koang Jal', motherAge: 20, motherNationality: 'South Sudanese', fatherName: 'Gatluak Ruot Puok', fatherNationality: 'South Sudanese', birthWeight: 2600, birthType: 'single', deliveryType: 'normal', attendedBy: 'Midwife', registeredBy: 'CO Deng Mabior Kuol', state: 'Unity', county: 'Rubkona', certificateNumber: 'UN-B-2026-0001', childPatientId: 'pat-00053', motherPatientId: 'pat-00058', createdAt: '2026-02-06T08:00:00Z', updatedAt: '2026-02-06T08:00:00Z' },
  { _id: 'birth-004', type: 'birth', childFirstName: 'Lual', childSurname: 'TamamHealth', childGender: 'Male', dateOfBirth: '2026-02-05', placeOfBirth: 'Wau State Hospital', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', motherName: 'Abuk Deng Mading', motherAge: 32, motherNationality: 'South Sudanese', fatherName: 'TamamHealth Ladu Soro', fatherNationality: 'South Sudanese', birthWeight: 3500, birthType: 'twin', deliveryType: 'normal', attendedBy: 'Doctor', registeredBy: 'CO Deng Mabior Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', certificateNumber: 'WB-B-2026-0001', childPatientId: 'pat-00054', motherPatientId: 'pat-00059', createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-05T10:00:00Z' },
  { _id: 'birth-005', type: 'birth', childFirstName: 'Achol', childSurname: 'Dut', childGender: 'Female', dateOfBirth: '2026-01-28', placeOfBirth: 'Malakal Teaching Hospital', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', motherName: 'Nyandit Dut Malual', motherAge: 26, motherNationality: 'South Sudanese', fatherName: 'Dut Malual Ring', fatherNationality: 'South Sudanese', birthWeight: 3100, birthType: 'single', deliveryType: 'assisted', attendedBy: 'Midwife', registeredBy: 'Nurse Stella Keji Lemi', state: 'Upper Nile', county: 'Malakal', certificateNumber: 'UN-B-2026-0002', childPatientId: 'pat-00055', motherPatientId: 'pat-00060', createdAt: '2026-01-28T12:00:00Z', updatedAt: '2026-01-28T12:00:00Z' },
  { _id: 'birth-006', type: 'birth', childFirstName: 'Garang', childSurname: 'Makuei', childGender: 'Male', dateOfBirth: '2026-01-20', placeOfBirth: 'Bor State Hospital', facilityId: 'hosp-005', facilityName: 'Bor State Hospital', motherName: 'Awut Makuei Lual', motherAge: 22, motherNationality: 'South Sudanese', fatherName: 'Makuei Lual Garang', fatherNationality: 'South Sudanese', birthWeight: 3000, birthType: 'single', deliveryType: 'normal', attendedBy: 'TBA', registeredBy: 'Dr. James Wani Igga', state: 'Jonglei', county: 'Bor South', certificateNumber: 'JG-B-2026-0001', childPatientId: 'pat-00056', motherPatientId: 'pat-00061', createdAt: '2026-01-20T09:00:00Z', updatedAt: '2026-01-20T09:00:00Z' },
];

const seedDeaths: Omit<DeathRegistrationDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'death-001', type: 'death', deceasedFirstName: 'Akol', deceasedSurname: 'Garang', deceasedGender: 'Male', dateOfBirth: '1958-05-10', dateOfDeath: '2026-02-07', ageAtDeath: 67, placeOfDeath: 'Juba Teaching Hospital', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', immediateCause: 'Cerebrovascular accident (Stroke)', immediateICD11: 'BA01', antecedentCause1: 'Hypertensive heart disease', antecedentICD11_1: 'BA80', antecedentCause2: '', antecedentICD11_2: '', underlyingCause: 'Hypertensive heart disease', underlyingICD11: 'BA80', contributingConditions: 'Diabetes mellitus', contributingICD11: 'DB90', mannerOfDeath: 'natural', maternalDeath: false, pregnancyRelated: false, certifiedBy: 'Dr. James Wani Igga', certifierRole: 'Physician', state: 'Central Equatoria', county: 'Juba', certificateNumber: 'CE-D-2026-0001', deathNotified: true, deathRegistered: true, createdAt: '2026-02-07T18:00:00Z', updatedAt: '2026-02-07T18:00:00Z' },
  { _id: 'death-002', type: 'death', deceasedFirstName: 'Nyakuoth', deceasedSurname: 'Gatdet', deceasedGender: 'Female', dateOfBirth: '1995-08-15', dateOfDeath: '2026-02-06', ageAtDeath: 30, placeOfDeath: 'Bentiu State Hospital', facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', immediateCause: 'Postpartum haemorrhage', immediateICD11: 'JA00', antecedentCause1: 'Obstructed labour', antecedentICD11_1: 'JA06', antecedentCause2: '', antecedentICD11_2: '', underlyingCause: 'Maternal death due to haemorrhage', underlyingICD11: 'JA00', contributingConditions: 'Anaemia', contributingICD11: '5A00', mannerOfDeath: 'natural', maternalDeath: true, pregnancyRelated: true, certifiedBy: 'CO Deng Mabior Kuol', certifierRole: 'Clinical Officer', state: 'Unity', county: 'Rubkona', certificateNumber: 'UN-D-2026-0001', deathNotified: true, deathRegistered: false, createdAt: '2026-02-06T22:00:00Z', updatedAt: '2026-02-06T22:00:00Z' },
  { _id: 'death-003', type: 'death', deceasedFirstName: 'Baby', deceasedSurname: 'Tut', deceasedGender: 'Male', dateOfBirth: '2026-02-04', dateOfDeath: '2026-02-05', ageAtDeath: 0, placeOfDeath: 'Malakal Teaching Hospital', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', immediateCause: 'Neonatal sepsis', immediateICD11: 'KA00', antecedentCause1: 'Neonatal prematurity', antecedentICD11_1: 'KA02', antecedentCause2: 'Low birth weight', antecedentICD11_2: 'KA03', underlyingCause: 'Neonatal prematurity', underlyingICD11: 'KA02', contributingConditions: '', contributingICD11: '', mannerOfDeath: 'natural', maternalDeath: false, pregnancyRelated: false, certifiedBy: 'Nurse Stella Keji Lemi', certifierRole: 'Nurse', state: 'Upper Nile', county: 'Malakal', certificateNumber: 'UN-D-2026-0002', deathNotified: true, deathRegistered: true, createdAt: '2026-02-05T04:00:00Z', updatedAt: '2026-02-05T04:00:00Z' },
  { _id: 'death-004', type: 'death', deceasedFirstName: 'Alier', deceasedSurname: 'Deng', deceasedGender: 'Male', dateOfBirth: '2022-06-20', dateOfDeath: '2026-02-03', ageAtDeath: 3, placeOfDeath: 'Wau State Hospital', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', immediateCause: 'Severe malaria with cerebral involvement', immediateICD11: '1A40', antecedentCause1: 'Malnutrition', antecedentICD11_1: '5B70', antecedentCause2: '', antecedentICD11_2: '', underlyingCause: 'Malaria due to Plasmodium falciparum', underlyingICD11: '1A40', contributingConditions: 'Malnutrition', contributingICD11: '5B70', mannerOfDeath: 'natural', maternalDeath: false, pregnancyRelated: false, certifiedBy: 'CO Deng Mabior Kuol', certifierRole: 'Clinical Officer', state: 'Western Bahr el Ghazal', county: 'Wau', certificateNumber: 'WB-D-2026-0001', deathNotified: true, deathRegistered: true, createdAt: '2026-02-03T16:00:00Z', updatedAt: '2026-02-03T16:00:00Z' },
  { _id: 'death-005', type: 'death', deceasedFirstName: 'Chol', deceasedSurname: 'Mading', deceasedGender: 'Male', dateOfBirth: '1980-01-01', dateOfDeath: '2026-01-25', ageAtDeath: 46, placeOfDeath: 'Bor State Hospital', facilityId: 'hosp-005', facilityName: 'Bor State Hospital', immediateCause: 'Respiratory failure', immediateICD11: 'CA40', antecedentCause1: 'Tuberculosis of lung', antecedentICD11_1: '1B10', antecedentCause2: 'HIV disease', antecedentICD11_2: '1C60', underlyingCause: 'HIV disease resulting in TB', underlyingICD11: '1C60', contributingConditions: '', contributingICD11: '', mannerOfDeath: 'natural', maternalDeath: false, pregnancyRelated: false, certifiedBy: 'Dr. James Wani Igga', certifierRole: 'Physician', state: 'Jonglei', county: 'Bor South', certificateNumber: 'JG-D-2026-0001', deathNotified: false, deathRegistered: false, createdAt: '2026-01-25T20:00:00Z', updatedAt: '2026-01-25T20:00:00Z' },
];

const seedFacilityAssessments: Omit<FacilityAssessmentDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'assess-001', type: 'facility_assessment', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', assessmentDate: '2026-01-15', assessedBy: 'Ministry of Health Team', generalEquipmentScore: 78, diagnosticCapacityScore: 72, essentialMedicinesScore: 65, infectionControlScore: 70, hasCleanWater: true, hasSanitation: true, hasWasteManagement: true, hasEmergencyTransport: true, hasCommunication: true, powerReliabilityScore: 75, staffingScore: 68, hisStaffCount: 4, hisStaffTrained: 3, hasPatientRegisters: true, hasDHIS2Reporting: true, reportingCompleteness: 82, reportingTimeliness: 75, dataQualityScore: 70, overallScore: 72, state: 'Central Equatoria', recommendations: 'Improve essential medicines supply chain. Train additional HIS staff.', createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:00:00Z' },
  { _id: 'assess-002', type: 'facility_assessment', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', assessmentDate: '2026-01-16', assessedBy: 'Ministry of Health Team', generalEquipmentScore: 55, diagnosticCapacityScore: 48, essentialMedicinesScore: 42, infectionControlScore: 50, hasCleanWater: true, hasSanitation: true, hasWasteManagement: false, hasEmergencyTransport: true, hasCommunication: true, powerReliabilityScore: 45, staffingScore: 52, hisStaffCount: 2, hisStaffTrained: 1, hasPatientRegisters: true, hasDHIS2Reporting: true, reportingCompleteness: 68, reportingTimeliness: 60, dataQualityScore: 55, overallScore: 54, state: 'Western Bahr el Ghazal', recommendations: 'Urgent need for waste management system. Power backup needed. Train HIS staff on DHIS2.', createdAt: '2026-01-16T10:00:00Z', updatedAt: '2026-01-16T10:00:00Z' },
  { _id: 'assess-003', type: 'facility_assessment', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', assessmentDate: '2026-01-17', assessedBy: 'WHO Assessment Team', generalEquipmentScore: 62, diagnosticCapacityScore: 58, essentialMedicinesScore: 50, infectionControlScore: 55, hasCleanWater: false, hasSanitation: true, hasWasteManagement: false, hasEmergencyTransport: false, hasCommunication: true, powerReliabilityScore: 35, staffingScore: 45, hisStaffCount: 1, hisStaffTrained: 1, hasPatientRegisters: true, hasDHIS2Reporting: true, reportingCompleteness: 57, reportingTimeliness: 50, dataQualityScore: 48, overallScore: 50, state: 'Upper Nile', recommendations: 'Critical: need clean water supply. Ambulance needed. Generator maintenance required.', createdAt: '2026-01-17T10:00:00Z', updatedAt: '2026-01-17T10:00:00Z' },
  { _id: 'assess-004', type: 'facility_assessment', facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', assessmentDate: '2026-01-18', assessedBy: 'WHO Assessment Team', generalEquipmentScore: 40, diagnosticCapacityScore: 35, essentialMedicinesScore: 30, infectionControlScore: 38, hasCleanWater: false, hasSanitation: false, hasWasteManagement: false, hasEmergencyTransport: false, hasCommunication: false, powerReliabilityScore: 20, staffingScore: 35, hisStaffCount: 1, hisStaffTrained: 0, hasPatientRegisters: true, hasDHIS2Reporting: false, reportingCompleteness: 35, reportingTimeliness: 28, dataQualityScore: 30, overallScore: 33, state: 'Unity', recommendations: 'Facility requires comprehensive rehabilitation. No DHIS2 access. Multiple infrastructure gaps.', createdAt: '2026-01-18T10:00:00Z', updatedAt: '2026-01-18T10:00:00Z' },
  { _id: 'assess-005', type: 'facility_assessment', facilityId: 'hosp-005', facilityName: 'Bor State Hospital', assessmentDate: '2026-01-19', assessedBy: 'Ministry of Health Team', generalEquipmentScore: 50, diagnosticCapacityScore: 45, essentialMedicinesScore: 40, infectionControlScore: 48, hasCleanWater: true, hasSanitation: true, hasWasteManagement: false, hasEmergencyTransport: true, hasCommunication: true, powerReliabilityScore: 40, staffingScore: 48, hisStaffCount: 2, hisStaffTrained: 1, hasPatientRegisters: true, hasDHIS2Reporting: true, reportingCompleteness: 62, reportingTimeliness: 55, dataQualityScore: 52, overallScore: 49, state: 'Jonglei', recommendations: 'Improve diagnostic capacity. Waste management system needed. Additional medicines procurement.', createdAt: '2026-01-19T10:00:00Z', updatedAt: '2026-01-19T10:00:00Z' },
  { _id: 'assess-006', type: 'facility_assessment', facilityId: 'hosp-006', facilityName: 'Aweil State Hospital', assessmentDate: '2026-01-20', assessedBy: 'WHO Assessment Team', generalEquipmentScore: 38, diagnosticCapacityScore: 30, essentialMedicinesScore: 28, infectionControlScore: 35, hasCleanWater: false, hasSanitation: false, hasWasteManagement: false, hasEmergencyTransport: false, hasCommunication: false, powerReliabilityScore: 15, staffingScore: 30, hisStaffCount: 0, hisStaffTrained: 0, hasPatientRegisters: true, hasDHIS2Reporting: false, reportingCompleteness: 25, reportingTimeliness: 20, dataQualityScore: 22, overallScore: 28, state: 'Northern Bahr el Ghazal', recommendations: 'Critical infrastructure deficits. No HIS staff. No DHIS2. Needs immediate investment.', createdAt: '2026-01-20T10:00:00Z', updatedAt: '2026-01-20T10:00:00Z' },
];

export const seedImmunizations: Omit<ImmunizationDoc, '_rev' | 'createdBy'>[] = [
  // Child 1: Akon Deng (birth-001) — good coverage
  { _id: 'imm-001', type: 'immunization', patientId: 'pat-00051', patientName: 'Akon Deng', gender: 'Female', dateOfBirth: '2025-06-15', vaccine: 'BCG', doseNumber: 1, dateGiven: '2025-06-15', nextDueDate: '2025-08-15', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'BCG-2025-JTH-044', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2025-06-15T08:00:00Z', updatedAt: '2025-06-15T08:00:00Z' },
  { _id: 'imm-002', type: 'immunization', patientId: 'pat-00051', patientName: 'Akon Deng', gender: 'Female', dateOfBirth: '2025-06-15', vaccine: 'OPV', doseNumber: 0, dateGiven: '2025-06-15', nextDueDate: '2025-08-15', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'OPV-2025-JTH-112', site: 'oral', adverseReaction: false, status: 'completed', createdAt: '2025-06-15T08:05:00Z', updatedAt: '2025-06-15T08:05:00Z' },
  { _id: 'imm-003', type: 'immunization', patientId: 'pat-00051', patientName: 'Akon Deng', gender: 'Female', dateOfBirth: '2025-06-15', vaccine: 'Penta', doseNumber: 1, dateGiven: '2025-08-15', nextDueDate: '2025-09-15', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Dr. James Wani Igga', batchNumber: 'PEN-2025-JTH-078', site: 'right thigh', adverseReaction: false, status: 'completed', createdAt: '2025-08-15T09:00:00Z', updatedAt: '2025-08-15T09:00:00Z' },
  { _id: 'imm-004', type: 'immunization', patientId: 'pat-00051', patientName: 'Akon Deng', gender: 'Female', dateOfBirth: '2025-06-15', vaccine: 'PCV', doseNumber: 1, dateGiven: '2025-08-15', nextDueDate: '2025-09-15', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Dr. James Wani Igga', batchNumber: 'PCV-2025-JTH-033', site: 'left thigh', adverseReaction: false, status: 'completed', createdAt: '2025-08-15T09:05:00Z', updatedAt: '2025-08-15T09:05:00Z' },
  { _id: 'imm-005', type: 'immunization', patientId: 'pat-00051', patientName: 'Akon Deng', gender: 'Female', dateOfBirth: '2025-06-15', vaccine: 'Rota', doseNumber: 1, dateGiven: '2025-08-15', nextDueDate: '2025-09-15', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Dr. James Wani Igga', batchNumber: 'ROT-2025-JTH-019', site: 'oral', adverseReaction: false, status: 'completed', createdAt: '2025-08-15T09:10:00Z', updatedAt: '2025-08-15T09:10:00Z' },
  { _id: 'imm-006', type: 'immunization', patientId: 'pat-00051', patientName: 'Akon Deng', gender: 'Female', dateOfBirth: '2025-06-15', vaccine: 'Penta', doseNumber: 2, dateGiven: '2025-09-15', nextDueDate: '2025-10-15', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'PEN-2025-JTH-095', site: 'right thigh', adverseReaction: false, status: 'completed', createdAt: '2025-09-15T10:00:00Z', updatedAt: '2025-09-15T10:00:00Z' },
  { _id: 'imm-007', type: 'immunization', patientId: 'pat-00051', patientName: 'Akon Deng', gender: 'Female', dateOfBirth: '2025-06-15', vaccine: 'Measles', doseNumber: 1, dateGiven: '', nextDueDate: '2026-03-15', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: '', batchNumber: '', site: 'left arm', adverseReaction: false, status: 'scheduled', createdAt: '2025-06-15T08:00:00Z', updatedAt: '2025-06-15T08:00:00Z' },

  // Child 2: Kuol Majok (birth-002) — partial coverage, some overdue
  { _id: 'imm-008', type: 'immunization', patientId: 'pat-00052', patientName: 'Kuol Majok', gender: 'Male', dateOfBirth: '2025-05-10', vaccine: 'BCG', doseNumber: 1, dateGiven: '2025-05-10', nextDueDate: '2025-07-10', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Dr. Achol Mayen Deng', batchNumber: 'BCG-2025-JTH-038', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2025-05-10T09:00:00Z', updatedAt: '2025-05-10T09:00:00Z' },
  { _id: 'imm-009', type: 'immunization', patientId: 'pat-00052', patientName: 'Kuol Majok', gender: 'Male', dateOfBirth: '2025-05-10', vaccine: 'OPV', doseNumber: 0, dateGiven: '2025-05-10', nextDueDate: '2025-07-10', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Dr. Achol Mayen Deng', batchNumber: 'OPV-2025-JTH-098', site: 'oral', adverseReaction: false, status: 'completed', createdAt: '2025-05-10T09:05:00Z', updatedAt: '2025-05-10T09:05:00Z' },
  { _id: 'imm-010', type: 'immunization', patientId: 'pat-00052', patientName: 'Kuol Majok', gender: 'Male', dateOfBirth: '2025-05-10', vaccine: 'Penta', doseNumber: 1, dateGiven: '2025-07-10', nextDueDate: '2025-08-10', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'PEN-2025-JTH-064', site: 'right thigh', adverseReaction: true, adverseReactionDetails: 'Mild fever and swelling at injection site', status: 'completed', createdAt: '2025-07-10T10:00:00Z', updatedAt: '2025-07-10T10:00:00Z' },
  { _id: 'imm-011', type: 'immunization', patientId: 'pat-00052', patientName: 'Kuol Majok', gender: 'Male', dateOfBirth: '2025-05-10', vaccine: 'Penta', doseNumber: 2, dateGiven: '', nextDueDate: '2025-08-10', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: '', batchNumber: '', site: 'right thigh', adverseReaction: false, status: 'overdue', createdAt: '2025-05-10T09:00:00Z', updatedAt: '2025-05-10T09:00:00Z' },
  { _id: 'imm-012', type: 'immunization', patientId: 'pat-00052', patientName: 'Kuol Majok', gender: 'Male', dateOfBirth: '2025-05-10', vaccine: 'Measles', doseNumber: 1, dateGiven: '', nextDueDate: '2026-02-10', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', administeredBy: '', batchNumber: '', site: 'left arm', adverseReaction: false, status: 'overdue', createdAt: '2025-05-10T09:00:00Z', updatedAt: '2025-05-10T09:00:00Z' },

  // Child 3: Nyamal Gatluak (birth-003) — Bentiu, low coverage
  { _id: 'imm-013', type: 'immunization', patientId: 'pat-00053', patientName: 'Nyamal Gatluak', gender: 'Female', dateOfBirth: '2025-08-20', vaccine: 'BCG', doseNumber: 1, dateGiven: '2025-08-20', nextDueDate: '2025-10-20', facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', state: 'Unity', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'BCG-2025-BSH-011', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2025-08-20T07:30:00Z', updatedAt: '2025-08-20T07:30:00Z' },
  { _id: 'imm-014', type: 'immunization', patientId: 'pat-00053', patientName: 'Nyamal Gatluak', gender: 'Female', dateOfBirth: '2025-08-20', vaccine: 'OPV', doseNumber: 0, dateGiven: '2025-08-20', nextDueDate: '2025-10-20', facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', state: 'Unity', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'OPV-2025-BSH-022', site: 'oral', adverseReaction: false, status: 'completed', createdAt: '2025-08-20T07:35:00Z', updatedAt: '2025-08-20T07:35:00Z' },
  { _id: 'imm-015', type: 'immunization', patientId: 'pat-00053', patientName: 'Nyamal Gatluak', gender: 'Female', dateOfBirth: '2025-08-20', vaccine: 'Penta', doseNumber: 1, dateGiven: '', nextDueDate: '2025-10-20', facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', state: 'Unity', administeredBy: '', batchNumber: '', site: 'right thigh', adverseReaction: false, status: 'overdue', createdAt: '2025-08-20T07:30:00Z', updatedAt: '2025-08-20T07:30:00Z' },

  // Child 4: Lual TamamHealth (birth-004) — Wau, good coverage
  { _id: 'imm-016', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'BCG', doseNumber: 1, dateGiven: '2025-04-01', nextDueDate: '2025-06-01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'BCG-2025-WSH-007', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2025-04-01T08:00:00Z', updatedAt: '2025-04-01T08:00:00Z' },
  { _id: 'imm-017', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'OPV', doseNumber: 0, dateGiven: '2025-04-01', nextDueDate: '2025-06-01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'OPV-2025-WSH-014', site: 'oral', adverseReaction: false, status: 'completed', createdAt: '2025-04-01T08:05:00Z', updatedAt: '2025-04-01T08:05:00Z' },
  { _id: 'imm-018', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'Penta', doseNumber: 1, dateGiven: '2025-06-01', nextDueDate: '2025-07-01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'PEN-2025-WSH-022', site: 'right thigh', adverseReaction: false, status: 'completed', createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-01T09:00:00Z' },
  { _id: 'imm-019', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'Penta', doseNumber: 2, dateGiven: '2025-07-01', nextDueDate: '2025-08-01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'PEN-2025-WSH-035', site: 'right thigh', adverseReaction: false, status: 'completed', createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-01T09:00:00Z' },
  { _id: 'imm-020', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'Penta', doseNumber: 3, dateGiven: '2025-08-01', nextDueDate: '2026-01-01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'PEN-2025-WSH-048', site: 'right thigh', adverseReaction: false, status: 'completed', createdAt: '2025-08-01T09:00:00Z', updatedAt: '2025-08-01T09:00:00Z' },
  { _id: 'imm-021', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'Measles', doseNumber: 1, dateGiven: '2026-01-05', nextDueDate: '2026-07-01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'MEA-2026-WSH-003', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z' },
  { _id: 'imm-022', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'Yellow Fever', doseNumber: 1, dateGiven: '2026-01-05', nextDueDate: '', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'YF-2026-WSH-001', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2026-01-05T10:05:00Z', updatedAt: '2026-01-05T10:05:00Z' },

  // Child 5: Achol Dut (birth-005) — Malakal
  { _id: 'imm-023', type: 'immunization', patientId: 'pat-00055', patientName: 'Achol Dut', gender: 'Female', dateOfBirth: '2025-09-10', vaccine: 'BCG', doseNumber: 1, dateGiven: '2025-09-10', nextDueDate: '2025-11-10', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', state: 'Upper Nile', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'BCG-2025-MTH-019', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2025-09-10T11:00:00Z', updatedAt: '2025-09-10T11:00:00Z' },
  { _id: 'imm-024', type: 'immunization', patientId: 'pat-00055', patientName: 'Achol Dut', gender: 'Female', dateOfBirth: '2025-09-10', vaccine: 'OPV', doseNumber: 0, dateGiven: '2025-09-10', nextDueDate: '2025-11-10', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', state: 'Upper Nile', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'OPV-2025-MTH-031', site: 'oral', adverseReaction: false, status: 'completed', createdAt: '2025-09-10T11:05:00Z', updatedAt: '2025-09-10T11:05:00Z' },
  { _id: 'imm-025', type: 'immunization', patientId: 'pat-00055', patientName: 'Achol Dut', gender: 'Female', dateOfBirth: '2025-09-10', vaccine: 'Penta', doseNumber: 1, dateGiven: '2025-11-10', nextDueDate: '2025-12-10', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', state: 'Upper Nile', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'PEN-2025-MTH-041', site: 'right thigh', adverseReaction: false, status: 'completed', createdAt: '2025-11-10T09:00:00Z', updatedAt: '2025-11-10T09:00:00Z' },
  { _id: 'imm-026', type: 'immunization', patientId: 'pat-00055', patientName: 'Achol Dut', gender: 'Female', dateOfBirth: '2025-09-10', vaccine: 'PCV', doseNumber: 1, dateGiven: '2025-11-10', nextDueDate: '2025-12-10', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', state: 'Upper Nile', administeredBy: 'Nurse Stella Keji Lemi', batchNumber: 'PCV-2025-MTH-015', site: 'left thigh', adverseReaction: false, status: 'completed', createdAt: '2025-11-10T09:05:00Z', updatedAt: '2025-11-10T09:05:00Z' },

  // Child 6: Garang Makuei (birth-006) — Bor, missed doses
  { _id: 'imm-027', type: 'immunization', patientId: 'pat-00056', patientName: 'Garang Makuei', gender: 'Male', dateOfBirth: '2025-07-01', vaccine: 'BCG', doseNumber: 1, dateGiven: '2025-07-03', nextDueDate: '2025-09-01', facilityId: 'hosp-005', facilityName: 'Bor State Hospital', state: 'Jonglei', administeredBy: 'Dr. James Wani Igga', batchNumber: 'BCG-2025-BSH-005', site: 'left arm', adverseReaction: false, status: 'completed', createdAt: '2025-07-03T08:00:00Z', updatedAt: '2025-07-03T08:00:00Z' },
  { _id: 'imm-028', type: 'immunization', patientId: 'pat-00056', patientName: 'Garang Makuei', gender: 'Male', dateOfBirth: '2025-07-01', vaccine: 'OPV', doseNumber: 1, dateGiven: '', nextDueDate: '2025-09-01', facilityId: 'hosp-005', facilityName: 'Bor State Hospital', state: 'Jonglei', administeredBy: '', batchNumber: '', site: 'oral', adverseReaction: false, status: 'missed', createdAt: '2025-07-03T08:00:00Z', updatedAt: '2025-07-03T08:00:00Z' },
  { _id: 'imm-029', type: 'immunization', patientId: 'pat-00056', patientName: 'Garang Makuei', gender: 'Male', dateOfBirth: '2025-07-01', vaccine: 'Penta', doseNumber: 1, dateGiven: '', nextDueDate: '2025-09-01', facilityId: 'hosp-005', facilityName: 'Bor State Hospital', state: 'Jonglei', administeredBy: '', batchNumber: '', site: 'right thigh', adverseReaction: false, status: 'missed', createdAt: '2025-07-03T08:00:00Z', updatedAt: '2025-07-03T08:00:00Z' },

  // Child 7: Vitamin A supplementation
  { _id: 'imm-030', type: 'immunization', patientId: 'pat-00054', patientName: 'Lual TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', vaccine: 'Vitamin A', doseNumber: 1, dateGiven: '2025-10-01', nextDueDate: '2026-04-01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', administeredBy: 'CO Deng Mabior Kuol', batchNumber: 'VA-2025-WSH-010', site: 'oral', adverseReaction: false, status: 'completed', createdAt: '2025-10-01T08:00:00Z', updatedAt: '2025-10-01T08:00:00Z' },
];

const seedANCVisits: Omit<ANCVisitDoc, '_rev' | 'createdBy'>[] = [
  // Mother 1: Achol Mayen Garang — high risk, multiple visits
  { _id: 'anc-001', type: 'anc_visit', motherId: 'pat-00057', motherName: 'Achol Mayen Garang', motherAge: 24, gravida: 2, parity: 1, visitNumber: 1, visitDate: '2025-10-15', gestationalAge: 12, facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', bloodPressure: '110/70', weight: 58, fundalHeight: 12, fetalHeartRate: 150, hemoglobin: 11.2, urineProtein: 'Negative', bloodGroup: 'O', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Negative', ironFolateGiven: true, tetanusVaccine: true, iptpDose: 0, riskFactors: [], riskLevel: 'low', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Family vehicle', bloodDonor: 'Husband' }, nextVisitDate: '2025-11-15', notes: 'First ANC visit. Normal findings.', attendedBy: 'Dr. Achol Mayen Deng', attendedByRole: 'Doctor', createdAt: '2025-10-15T09:00:00Z', updatedAt: '2025-10-15T09:00:00Z' },
  { _id: 'anc-002', type: 'anc_visit', motherId: 'pat-00057', motherName: 'Achol Mayen Garang', motherAge: 24, gravida: 2, parity: 1, visitNumber: 2, visitDate: '2025-11-15', gestationalAge: 16, facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', bloodPressure: '118/72', weight: 60, fundalHeight: 16, fetalHeartRate: 148, hemoglobin: 10.8, urineProtein: 'Negative', bloodGroup: 'O', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 1, riskFactors: [], riskLevel: 'low', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Family vehicle', bloodDonor: 'Husband' }, nextVisitDate: '2025-12-20', notes: 'Normal progress. IPTp-1 given.', attendedBy: 'Dr. Achol Mayen Deng', attendedByRole: 'Doctor', createdAt: '2025-11-15T10:00:00Z', updatedAt: '2025-11-15T10:00:00Z' },
  { _id: 'anc-003', type: 'anc_visit', motherId: 'pat-00057', motherName: 'Achol Mayen Garang', motherAge: 24, gravida: 2, parity: 1, visitNumber: 3, visitDate: '2025-12-20', gestationalAge: 21, facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', bloodPressure: '120/75', weight: 62, fundalHeight: 21, fetalHeartRate: 145, hemoglobin: 10.5, urineProtein: 'Negative', bloodGroup: 'O', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 2, riskFactors: [], riskLevel: 'low', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Family vehicle', bloodDonor: 'Husband' }, nextVisitDate: '2026-01-20', notes: 'Growing well. IPTp-2 given.', attendedBy: 'Nurse Stella Keji Lemi', attendedByRole: 'Nurse', createdAt: '2025-12-20T11:00:00Z', updatedAt: '2025-12-20T11:00:00Z' },
  { _id: 'anc-004', type: 'anc_visit', motherId: 'pat-00057', motherName: 'Achol Mayen Garang', motherAge: 24, gravida: 2, parity: 1, visitNumber: 4, visitDate: '2026-01-20', gestationalAge: 26, facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', bloodPressure: '125/80', weight: 64, fundalHeight: 26, fetalHeartRate: 142, hemoglobin: 10.0, urineProtein: 'Trace', bloodGroup: 'O', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: true, iptpDose: 3, riskFactors: ['anemia'], riskLevel: 'moderate', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Family vehicle', bloodDonor: 'Husband' }, nextVisitDate: '2026-02-15', notes: 'Mild anemia noted. Increased iron supplementation. Monitor BP.', attendedBy: 'Dr. James Wani Igga', attendedByRole: 'Doctor', createdAt: '2026-01-20T09:00:00Z', updatedAt: '2026-01-20T09:00:00Z' },

  // Mother 2: Nyakuoth Koang Jal — high risk (hypertension + previous c-section)
  { _id: 'anc-005', type: 'anc_visit', motherId: 'pat-00058', motherName: 'Nyakuoth Koang Jal', motherAge: 30, gravida: 4, parity: 3, visitNumber: 1, visitDate: '2025-11-01', gestationalAge: 10, facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', state: 'Unity', bloodPressure: '140/90', weight: 72, fundalHeight: 10, fetalHeartRate: 155, hemoglobin: 9.8, urineProtein: '+', bloodGroup: 'A', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Positive', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: true, iptpDose: 0, riskFactors: ['hypertension', 'previous_csection', 'anemia'], riskLevel: 'high', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Ambulance referral', bloodDonor: 'Brother' }, nextVisitDate: '2025-11-15', notes: 'High-risk: hypertensive, previous C-section, anemia. Malaria treated. Referred for closer monitoring.', attendedBy: 'CO Deng Mabior Kuol', attendedByRole: 'Clinical Officer', createdAt: '2025-11-01T08:00:00Z', updatedAt: '2025-11-01T08:00:00Z' },
  { _id: 'anc-006', type: 'anc_visit', motherId: 'pat-00058', motherName: 'Nyakuoth Koang Jal', motherAge: 30, gravida: 4, parity: 3, visitNumber: 2, visitDate: '2025-11-15', gestationalAge: 12, facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', state: 'Unity', bloodPressure: '145/92', weight: 73, fundalHeight: 12, fetalHeartRate: 152, hemoglobin: 9.5, urineProtein: '+', bloodGroup: 'A', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 1, riskFactors: ['hypertension', 'previous_csection', 'anemia'], riskLevel: 'high', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Ambulance referral', bloodDonor: 'Brother' }, nextVisitDate: '2025-12-01', notes: 'BP still elevated. Methyldopa started. Plan delivery at JTH.', attendedBy: 'CO Deng Mabior Kuol', attendedByRole: 'Clinical Officer', createdAt: '2025-11-15T08:30:00Z', updatedAt: '2025-11-15T08:30:00Z' },

  // Mother 3: Abuk Deng Mading — Wau, moderate risk (multiple pregnancy)
  { _id: 'anc-007', type: 'anc_visit', motherId: 'pat-00059', motherName: 'Abuk Deng Mading', motherAge: 32, gravida: 5, parity: 4, visitNumber: 1, visitDate: '2025-09-20', gestationalAge: 8, facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', bloodPressure: '115/75', weight: 65, fundalHeight: 10, fetalHeartRate: 160, hemoglobin: 11.5, urineProtein: 'Negative', bloodGroup: 'B', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: true, iptpDose: 0, riskFactors: ['multiple_pregnancy'], riskLevel: 'moderate', birthPlan: { facility: 'Wau State Hospital', transport: 'Motorcycle ambulance', bloodDonor: 'Sister' }, nextVisitDate: '2025-10-20', notes: 'Twin pregnancy confirmed. Moderate risk. Monthly monitoring.', attendedBy: 'CO Deng Mabior Kuol', attendedByRole: 'Clinical Officer', createdAt: '2025-09-20T09:00:00Z', updatedAt: '2025-09-20T09:00:00Z' },
  { _id: 'anc-008', type: 'anc_visit', motherId: 'pat-00059', motherName: 'Abuk Deng Mading', motherAge: 32, gravida: 5, parity: 4, visitNumber: 2, visitDate: '2025-10-20', gestationalAge: 12, facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', bloodPressure: '118/78', weight: 67, fundalHeight: 14, fetalHeartRate: 158, hemoglobin: 11.0, urineProtein: 'Negative', bloodGroup: 'B', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 1, riskFactors: ['multiple_pregnancy'], riskLevel: 'moderate', birthPlan: { facility: 'Wau State Hospital', transport: 'Motorcycle ambulance', bloodDonor: 'Sister' }, nextVisitDate: '2025-11-20', notes: 'Twins growing normally. Continue monitoring.', attendedBy: 'CO Deng Mabior Kuol', attendedByRole: 'Clinical Officer', createdAt: '2025-10-20T10:00:00Z', updatedAt: '2025-10-20T10:00:00Z' },
  { _id: 'anc-009', type: 'anc_visit', motherId: 'pat-00059', motherName: 'Abuk Deng Mading', motherAge: 32, gravida: 5, parity: 4, visitNumber: 3, visitDate: '2025-11-20', gestationalAge: 16, facilityId: 'hosp-002', facilityName: 'Wau State Hospital', state: 'Western Bahr el Ghazal', bloodPressure: '122/80', weight: 70, fundalHeight: 20, fetalHeartRate: 155, hemoglobin: 10.8, urineProtein: 'Negative', bloodGroup: 'B', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 2, riskFactors: ['multiple_pregnancy'], riskLevel: 'moderate', birthPlan: { facility: 'Wau State Hospital', transport: 'Motorcycle ambulance', bloodDonor: 'Sister' }, nextVisitDate: '2025-12-20', notes: 'Good progress with twins. IPTp-2 given.', attendedBy: 'CO Deng Mabior Kuol', attendedByRole: 'Clinical Officer', createdAt: '2025-11-20T09:30:00Z', updatedAt: '2025-11-20T09:30:00Z' },

  // Mother 4: Nyandit Dut Malual — Malakal, low risk first ANC
  { _id: 'anc-010', type: 'anc_visit', motherId: 'pat-00060', motherName: 'Nyandit Dut Malual', motherAge: 26, gravida: 3, parity: 2, visitNumber: 1, visitDate: '2026-01-05', gestationalAge: 14, facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', state: 'Upper Nile', bloodPressure: '108/68', weight: 55, fundalHeight: 14, fetalHeartRate: 148, hemoglobin: 12.0, urineProtein: 'Negative', bloodGroup: 'O', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: true, iptpDose: 0, riskFactors: [], riskLevel: 'low', birthPlan: { facility: 'Malakal Teaching Hospital', transport: 'Walking', bloodDonor: 'Cousin' }, nextVisitDate: '2026-02-05', notes: 'Late first visit but normal findings. Counselled on regular attendance.', attendedBy: 'Nurse Stella Keji Lemi', attendedByRole: 'Nurse', createdAt: '2026-01-05T08:00:00Z', updatedAt: '2026-01-05T08:00:00Z' },

  // Mother 5: Awut Makuei Lual — Bor, high risk (HIV positive)
  { _id: 'anc-011', type: 'anc_visit', motherId: 'pat-00061', motherName: 'Awut Makuei Lual', motherAge: 22, gravida: 1, parity: 0, visitNumber: 1, visitDate: '2025-12-10', gestationalAge: 16, facilityId: 'hosp-005', facilityName: 'Bor State Hospital', state: 'Jonglei', bloodPressure: '105/65', weight: 50, fundalHeight: 16, fetalHeartRate: 152, hemoglobin: 10.2, urineProtein: 'Negative', bloodGroup: 'AB', rhFactor: '-', hivStatus: 'Positive', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: true, iptpDose: 0, riskFactors: ['hiv_positive', 'rh_negative', 'primigravida'], riskLevel: 'high', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Referral ambulance', bloodDonor: 'Mother' }, nextVisitDate: '2025-12-24', notes: 'Primigravida. HIV positive — started on ART. Rh negative — Anti-D planned. High risk.', attendedBy: 'Dr. James Wani Igga', attendedByRole: 'Doctor', createdAt: '2025-12-10T10:00:00Z', updatedAt: '2025-12-10T10:00:00Z' },
  { _id: 'anc-012', type: 'anc_visit', motherId: 'pat-00061', motherName: 'Awut Makuei Lual', motherAge: 22, gravida: 1, parity: 0, visitNumber: 2, visitDate: '2025-12-24', gestationalAge: 18, facilityId: 'hosp-005', facilityName: 'Bor State Hospital', state: 'Jonglei', bloodPressure: '108/68', weight: 51, fundalHeight: 18, fetalHeartRate: 150, hemoglobin: 10.5, urineProtein: 'Negative', bloodGroup: 'AB', rhFactor: '-', hivStatus: 'Positive (on ART)', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 1, riskFactors: ['hiv_positive', 'rh_negative', 'primigravida'], riskLevel: 'high', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Referral ambulance', bloodDonor: 'Mother' }, nextVisitDate: '2026-01-14', notes: 'ART adherence good. Viral load sent. Anti-D given.', attendedBy: 'Dr. James Wani Igga', attendedByRole: 'Doctor', createdAt: '2025-12-24T09:00:00Z', updatedAt: '2025-12-24T09:00:00Z' },

  // Mother 6: Recent visit this month
  { _id: 'anc-013', type: 'anc_visit', motherId: 'pat-00062', motherName: 'Nyandeng Chol Wol', motherAge: 28, gravida: 3, parity: 2, visitNumber: 5, visitDate: '2026-02-05', gestationalAge: 32, facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', bloodPressure: '115/72', weight: 68, fundalHeight: 32, fetalHeartRate: 140, hemoglobin: 11.0, urineProtein: 'Negative', bloodGroup: 'A', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 3, riskFactors: [], riskLevel: 'low', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Family vehicle', bloodDonor: 'Husband' }, nextVisitDate: '2026-02-19', notes: 'ANC5 — good progress. Baby in cephalic presentation.', attendedBy: 'Dr. Achol Mayen Deng', attendedByRole: 'Doctor', createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-05T10:00:00Z' },
  { _id: 'anc-014', type: 'anc_visit', motherId: 'pat-00057', motherName: 'Achol Mayen Garang', motherAge: 24, gravida: 2, parity: 1, visitNumber: 5, visitDate: '2026-02-10', gestationalAge: 29, facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', state: 'Central Equatoria', bloodPressure: '128/82', weight: 66, fundalHeight: 29, fetalHeartRate: 140, hemoglobin: 10.2, urineProtein: 'Trace', bloodGroup: 'O', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 3, riskFactors: ['anemia'], riskLevel: 'moderate', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Family vehicle', bloodDonor: 'Husband' }, nextVisitDate: '2026-02-24', notes: 'ANC5 — Monitor anemia. BP slightly elevated. Return in 2 weeks.', attendedBy: 'Dr. James Wani Igga', attendedByRole: 'Doctor', createdAt: '2026-02-10T09:00:00Z', updatedAt: '2026-02-10T09:00:00Z' },
  { _id: 'anc-015', type: 'anc_visit', motherId: 'pat-00058', motherName: 'Nyakuoth Koang Jal', motherAge: 30, gravida: 4, parity: 3, visitNumber: 3, visitDate: '2026-02-01', gestationalAge: 23, facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', state: 'Unity', bloodPressure: '148/95', weight: 75, fundalHeight: 23, fetalHeartRate: 148, hemoglobin: 9.2, urineProtein: '++', bloodGroup: 'A', rhFactor: '+', hivStatus: 'Negative', malariaTest: 'Negative', syphilisTest: 'Non-reactive', ironFolateGiven: true, tetanusVaccine: false, iptpDose: 2, riskFactors: ['hypertension', 'previous_csection', 'anemia', 'proteinuria'], riskLevel: 'high', birthPlan: { facility: 'Juba Teaching Hospital', transport: 'Ambulance referral', bloodDonor: 'Brother' }, nextVisitDate: '2026-02-15', notes: 'Pre-eclampsia developing. Urgent referral to JTH for closer monitoring.', attendedBy: 'CO Deng Mabior Kuol', attendedByRole: 'Clinical Officer', createdAt: '2026-02-01T08:00:00Z', updatedAt: '2026-02-01T08:00:00Z' },
];

// Follow-up seed data (pending follow-ups)
const seedFollowUps: Omit<FollowUpDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'followup-001', type: 'follow_up', patientId: 'BOMA-KJ-HH1003', patientName: 'Achol Deng', geocodeId: 'BOMA-KJ-HH1003', assignedWorker: 'user-bhw.akol', assignedWorkerName: 'Akol Deng Mading', status: 'active', condition: 'Malaria', facilityLevel: 'boma', scheduledDate: new Date(Date.now() - 1 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', sourceVisitId: 'boma-visit-006', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { _id: 'followup-002', type: 'follow_up', patientId: 'BOMA-KJ-HH1015', patientName: 'Kuol Mabior', geocodeId: 'BOMA-KJ-HH1015', assignedWorker: 'user-bhw.akol', assignedWorkerName: 'Akol Deng Mading', status: 'active', condition: 'Diarrhea', facilityLevel: 'boma', scheduledDate: new Date(Date.now() - 2 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', sourceVisitId: 'boma-visit-007', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { _id: 'followup-003', type: 'follow_up', patientId: 'BOMA-KJ-HH1022', patientName: 'Nyamal Gatdet', geocodeId: 'BOMA-KJ-HH1022', assignedWorker: 'user-bhw.akol', assignedWorkerName: 'Akol Deng Mading', status: 'active', condition: 'Malnutrition', facilityLevel: 'boma', scheduledDate: new Date(Date.now() - 4 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', sourceVisitId: 'boma-visit-008', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
  { _id: 'followup-004', type: 'follow_up', patientId: 'BOMA-KJ-HH1008', patientName: 'Deng Deng', geocodeId: 'BOMA-KJ-HH1008', assignedWorker: 'user-bhw.akol', assignedWorkerName: 'Akol Deng Mading', status: 'active', condition: 'Pneumonia', facilityLevel: 'boma', scheduledDate: new Date().toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', sourceVisitId: 'boma-visit-004', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
];

// Child patients linked to immunization records (fixing orphaned child-001..006 IDs)
const childPatients: (Partial<PatientDoc> & Record<string, unknown>)[] = [
  { _id: 'pat-00051', type: 'patient', firstName: 'Akon', middleName: '', surname: 'Deng', gender: 'Female', dateOfBirth: '2025-06-15', age: 0, phone: '', registrationHospital: 'hosp-001', registrationHospitalName: 'Juba Teaching Hospital', hospitalNumber: 'JTH-000051', state: 'Central Equatoria', county: 'Juba', payam: '', boma: '', geocodeId: '', createdAt: '2025-06-15T08:00:00Z', updatedAt: '2025-06-15T08:00:00Z' },
  { _id: 'pat-00052', type: 'patient', firstName: 'Kuol', middleName: '', surname: 'Majok', gender: 'Male', dateOfBirth: '2025-05-10', age: 0, phone: '', registrationHospital: 'hosp-001', registrationHospitalName: 'Juba Teaching Hospital', hospitalNumber: 'JTH-000052', state: 'Central Equatoria', county: 'Juba', payam: '', boma: '', geocodeId: '', createdAt: '2025-05-10T09:00:00Z', updatedAt: '2025-05-10T09:00:00Z' },
  { _id: 'pat-00053', type: 'patient', firstName: 'Nyamal', middleName: '', surname: 'Gatluak', gender: 'Female', dateOfBirth: '2025-08-20', age: 0, phone: '', registrationHospital: 'hosp-004', registrationHospitalName: 'Bentiu State Hospital', hospitalNumber: 'BSH-000001', state: 'Unity', county: 'Rubkona', payam: '', boma: '', geocodeId: '', createdAt: '2025-08-20T07:30:00Z', updatedAt: '2025-08-20T07:30:00Z' },
  { _id: 'pat-00054', type: 'patient', firstName: 'Lual', middleName: '', surname: 'TamamHealth', gender: 'Male', dateOfBirth: '2025-04-01', age: 1, phone: '', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000001', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', createdAt: '2025-04-01T08:00:00Z', updatedAt: '2025-04-01T08:00:00Z' },
  { _id: 'pat-00055', type: 'patient', firstName: 'Achol', middleName: '', surname: 'Dut', gender: 'Female', dateOfBirth: '2025-09-10', age: 0, phone: '', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000001', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', createdAt: '2025-09-10T11:00:00Z', updatedAt: '2025-09-10T11:00:00Z' },
  { _id: 'pat-00056', type: 'patient', firstName: 'Garang', middleName: '', surname: 'Makuei', gender: 'Male', dateOfBirth: '2025-07-01', age: 0, phone: '', registrationHospital: 'hosp-005', registrationHospitalName: 'Bor State Hospital', hospitalNumber: 'BSH-000002', state: 'Jonglei', county: 'Bor South', payam: '', boma: '', geocodeId: '', createdAt: '2025-07-03T08:00:00Z', updatedAt: '2025-07-03T08:00:00Z' },
];

// Mother patients linked to ANC records (fixing orphaned mother-001..006 IDs)
const motherPatients: (Partial<PatientDoc> & Record<string, unknown>)[] = [
  { _id: 'pat-00057', type: 'patient', firstName: 'Achol', middleName: 'Mayen', surname: 'Garang', gender: 'Female', dateOfBirth: '2002-03-15', age: 24, phone: '+211912555057', registrationHospital: 'hosp-001', registrationHospitalName: 'Juba Teaching Hospital', hospitalNumber: 'JTH-000057', state: 'Central Equatoria', county: 'Juba', payam: '', boma: '', geocodeId: '', createdAt: '2025-10-15T09:00:00Z', updatedAt: '2025-10-15T09:00:00Z' },
  { _id: 'pat-00058', type: 'patient', firstName: 'Nyakuoth', middleName: 'Koang', surname: 'Jal', gender: 'Female', dateOfBirth: '1996-01-20', age: 30, phone: '+211912555058', registrationHospital: 'hosp-004', registrationHospitalName: 'Bentiu State Hospital', hospitalNumber: 'BSH-000003', state: 'Unity', county: 'Rubkona', payam: '', boma: '', geocodeId: '', createdAt: '2025-11-01T08:00:00Z', updatedAt: '2025-11-01T08:00:00Z' },
  { _id: 'pat-00059', type: 'patient', firstName: 'Abuk', middleName: 'Deng', surname: 'Mading', gender: 'Female', dateOfBirth: '1994-06-10', age: 32, phone: '+211912555059', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000002', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', createdAt: '2025-09-20T09:00:00Z', updatedAt: '2025-09-20T09:00:00Z' },
  { _id: 'pat-00060', type: 'patient', firstName: 'Nyandit', middleName: 'Dut', surname: 'Malual', gender: 'Female', dateOfBirth: '2000-08-05', age: 26, phone: '+211912555060', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000002', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', createdAt: '2026-01-05T08:00:00Z', updatedAt: '2026-01-05T08:00:00Z' },
  { _id: 'pat-00061', type: 'patient', firstName: 'Awut', middleName: 'Makuei', surname: 'Lual', gender: 'Female', dateOfBirth: '2004-04-12', age: 22, phone: '+211912555061', registrationHospital: 'hosp-005', registrationHospitalName: 'Bor State Hospital', hospitalNumber: 'BSH-000004', state: 'Jonglei', county: 'Bor South', payam: '', boma: '', geocodeId: '', createdAt: '2025-12-10T10:00:00Z', updatedAt: '2025-12-10T10:00:00Z' },
  { _id: 'pat-00062', type: 'patient', firstName: 'Nyandeng', middleName: 'Chol', surname: 'Wol', gender: 'Female', dateOfBirth: '1998-11-25', age: 28, phone: '+211912555062', registrationHospital: 'hosp-001', registrationHospitalName: 'Juba Teaching Hospital', hospitalNumber: 'JTH-000062', state: 'Central Equatoria', county: 'Juba', payam: '', boma: '', geocodeId: '', createdAt: '2025-08-01T10:00:00Z', updatedAt: '2025-08-01T10:00:00Z' },
];

// Wau State Hospital (hosp-002) roster — gives the Clinical Officer (co.deng,
// "CO Deng Mabior Kuol") a deterministic panel of patients to work with. Several
// are assigned to the CO so the "assigned to me" worklist, recently-visited
// filter, and consultation workflow all have demo data at this facility.
const CO_ID = 'user-co.deng';
const CO_NAME = 'CO Deng Mabior Kuol';
const wauPatients: (Partial<PatientDoc> & Record<string, unknown>)[] = [
  { _id: 'pat-00063', type: 'patient', firstName: 'Santino', middleName: 'Akot', surname: 'Madut', gender: 'Male', dateOfBirth: '1979-02-12', age: 47, phone: '+211915200063', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['Hypertension'], nokName: 'Adut Madut', nokRelationship: 'Spouse', nokPhone: '+211915200163', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000010', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-08', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-08T09:20:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-03-04T08:00:00Z', updatedAt: '2026-06-08T09:20:00Z' },
  { _id: 'pat-00064', type: 'patient', firstName: 'Aluel', middleName: 'Bol', surname: 'Garang', gender: 'Female', dateOfBirth: '1991-07-30', age: 34, phone: '+211915200064', bloodType: 'A+', allergies: ['Penicillin'], chronicConditions: ['None'], nokName: 'Garang Bol', nokRelationship: 'Father', nokPhone: '+211915200164', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000011', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-09T11:05:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-05-21T08:00:00Z', updatedAt: '2026-06-09T11:05:00Z' },
  { _id: 'pat-00065', type: 'patient', firstName: 'Deng', middleName: 'Akec', surname: 'Wol', gender: 'Male', dateOfBirth: '1965-11-03', age: 60, phone: '+211915200065', bloodType: 'B+', allergies: ['None known'], chronicConditions: ['Diabetes Mellitus', 'Hypertension'], nokName: 'Nyibol Akec', nokRelationship: 'Daughter', nokPhone: '+211915200165', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000012', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-05', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-05T08:40:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2024-12-10T08:00:00Z', updatedAt: '2026-06-05T08:40:00Z' },
  { _id: 'pat-00066', type: 'patient', firstName: 'Nyibol', middleName: 'Ring', surname: 'Atem', gender: 'Female', dateOfBirth: '2003-04-18', age: 23, phone: '+211915200066', bloodType: 'O-', allergies: ['Sulfa drugs'], chronicConditions: ['Asthma'], nokName: 'Ring Atem', nokRelationship: 'Father', nokPhone: '+211915200166', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000013', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-09T14:30:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-09-02T08:00:00Z', updatedAt: '2026-06-09T14:30:00Z' },
  { _id: 'pat-00067', type: 'patient', firstName: 'Mabior', middleName: 'Kuol', surname: 'Deng', gender: 'Male', dateOfBirth: '1988-09-09', age: 37, phone: '+211915200067', bloodType: 'AB+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Achol Kuol', nokRelationship: 'Spouse', nokPhone: '+211915200167', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000014', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-07', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-07T10:15:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-06-18T08:00:00Z', updatedAt: '2026-06-07T10:15:00Z' },
  { _id: 'pat-00068', type: 'patient', firstName: 'Adut', middleName: 'Mawien', surname: 'Lual', gender: 'Female', dateOfBirth: '1996-12-22', age: 29, phone: '+211915200068', bloodType: 'A-', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Mawien Lual', nokRelationship: 'Father', nokPhone: '+211915200168', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000015', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-05-28', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-05-28T09:00:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-04-11T08:00:00Z', updatedAt: '2026-05-28T09:00:00Z' },
  { _id: 'pat-00069', type: 'patient', firstName: 'Chol', middleName: 'Ajak', surname: 'Mayen', gender: 'Male', dateOfBirth: '1972-06-14', age: 53, phone: '+211915200069', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['Epilepsy'], nokName: 'Ajak Mayen', nokRelationship: 'Brother', nokPhone: '+211915200169', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000016', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-03', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-03T13:20:00.000Z', isActive: true, createdAt: '2024-10-30T08:00:00Z', updatedAt: '2026-06-03T13:20:00Z' },
  { _id: 'pat-00070', type: 'patient', firstName: 'Nyankiir', middleName: 'Deng', surname: 'Achuil', gender: 'Female', dateOfBirth: '1959-01-08', age: 67, phone: '+211915200070', bloodType: 'B-', allergies: ['Aspirin'], chronicConditions: ['Hypertension', 'Osteoarthritis'], nokName: 'Deng Achuil', nokRelationship: 'Son', nokPhone: '+211915200170', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000017', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-06', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-06T08:10:00.000Z', isActive: true, createdAt: '2024-08-15T08:00:00Z', updatedAt: '2026-06-06T08:10:00Z' },
  { _id: 'pat-00071', type: 'patient', firstName: 'Garang', middleName: 'Maker', surname: 'Bol', gender: 'Male', dateOfBirth: '2015-03-27', age: 11, phone: '', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Maker Bol', nokRelationship: 'Father', nokPhone: '+211915200171', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000018', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-09T15:45:00.000Z', isActive: true, createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-06-09T15:45:00Z' },
  { _id: 'pat-00072', type: 'patient', firstName: 'Awien', middleName: 'Chol', surname: 'Madit', gender: 'Female', dateOfBirth: '1985-10-11', age: 40, phone: '+211915200072', bloodType: 'A+', allergies: ['None known'], chronicConditions: ['HIV'], nokName: 'Chol Madit', nokRelationship: 'Spouse', nokPhone: '+211915200172', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000019', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-05-30', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-05-30T10:50:00.000Z', isActive: true, createdAt: '2024-11-22T08:00:00Z', updatedAt: '2026-05-30T10:50:00Z' },
  { _id: 'pat-00073', type: 'patient', firstName: 'Kuol', middleName: 'Riak', surname: 'Anyieth', gender: 'Male', dateOfBirth: '2000-08-19', age: 25, phone: '+211915200073', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Riak Anyieth', nokRelationship: 'Father', nokPhone: '+211915200173', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000020', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-04-15', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-04-15T09:30:00.000Z', isActive: true, createdAt: '2025-07-09T08:00:00Z', updatedAt: '2026-04-15T09:30:00Z' },
  { _id: 'pat-00074', type: 'patient', firstName: 'Abuk', middleName: 'Ater', surname: 'Nyok', gender: 'Female', dateOfBirth: '1993-05-02', age: 33, phone: '+211915200074', bloodType: 'B+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Ater Nyok', nokRelationship: 'Spouse', nokPhone: '+211915200174', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000021', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-04', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-04T12:00:00.000Z', isActive: true, createdAt: '2025-02-28T08:00:00Z', updatedAt: '2026-06-04T12:00:00Z' },
  { _id: 'pat-00075', type: 'patient', firstName: 'Majok', middleName: 'Deng', surname: 'Akol', gender: 'Male', dateOfBirth: '1982-04-17', age: 44, phone: '+211915200075', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['Hypertension'], nokName: 'Deng Akol', nokRelationship: 'Brother', nokPhone: '+211915200175', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000022', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-09T08:25:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-03-14T08:00:00Z', updatedAt: '2026-06-09T08:25:00Z' },
  { _id: 'pat-00076', type: 'patient', firstName: 'Ayen', middleName: 'Bol', surname: 'Achuil', gender: 'Female', dateOfBirth: '1998-09-03', age: 27, phone: '+211915200076', bloodType: 'A+', allergies: ['Penicillin'], chronicConditions: ['None'], nokName: 'Bol Achuil', nokRelationship: 'Father', nokPhone: '+211915200176', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000023', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-08', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-08T10:40:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-05-02T08:00:00Z', updatedAt: '2026-06-08T10:40:00Z' },
  { _id: 'pat-00077', type: 'patient', firstName: 'Riak', middleName: 'Gai', surname: 'Tut', gender: 'Male', dateOfBirth: '1969-12-29', age: 56, phone: '+211915200077', bloodType: 'B+', allergies: ['None known'], chronicConditions: ['Diabetes Mellitus'], nokName: 'Nyabol Gai', nokRelationship: 'Spouse', nokPhone: '+211915200177', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000024', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-07', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-07T09:15:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2024-11-19T08:00:00Z', updatedAt: '2026-06-07T09:15:00Z' },
  { _id: 'pat-00078', type: 'patient', firstName: 'Nyandeng', middleName: 'Akec', surname: 'Mawut', gender: 'Female', dateOfBirth: '2007-02-11', age: 19, phone: '+211915200078', bloodType: 'O-', allergies: ['None known'], chronicConditions: ['Asthma'], nokName: 'Akec Mawut', nokRelationship: 'Father', nokPhone: '+211915200178', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000025', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-09T13:05:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-08-22T08:00:00Z', updatedAt: '2026-06-09T13:05:00Z' },
  { _id: 'pat-00079', type: 'patient', firstName: 'Lual', middleName: 'Maker', surname: 'Ring', gender: 'Male', dateOfBirth: '1990-07-08', age: 35, phone: '+211915200079', bloodType: 'AB+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Maker Ring', nokRelationship: 'Brother', nokPhone: '+211915200179', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000026', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-06', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-06T11:30:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-06-30T08:00:00Z', updatedAt: '2026-06-06T11:30:00Z' },
  { _id: 'pat-00080', type: 'patient', firstName: 'Achol', middleName: 'Garang', surname: 'Deng', gender: 'Female', dateOfBirth: '1985-03-23', age: 41, phone: '+211915200080', bloodType: 'A-', allergies: ['Sulfa drugs'], chronicConditions: ['Hypertension'], nokName: 'Garang Deng', nokRelationship: 'Spouse', nokPhone: '+211915200180', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000027', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-05', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-05T09:50:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-01-27T08:00:00Z', updatedAt: '2026-06-05T09:50:00Z' },
  { _id: 'pat-00081', type: 'patient', firstName: 'Gatwech', middleName: 'Both', surname: 'Chuol', gender: 'Male', dateOfBirth: '2001-10-14', age: 24, phone: '+211915200081', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['Epilepsy'], nokName: 'Both Chuol', nokRelationship: 'Father', nokPhone: '+211915200181', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000028', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-05-29', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-05-29T14:10:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-07-15T08:00:00Z', updatedAt: '2026-05-29T14:10:00Z' },
  { _id: 'pat-00082', type: 'patient', firstName: 'Nyakong', middleName: 'Jal', surname: 'Puok', gender: 'Female', dateOfBirth: '1994-06-19', age: 31, phone: '+211915200082', bloodType: 'B-', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Jal Puok', nokRelationship: 'Spouse', nokPhone: '+211915200182', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000029', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-08', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-08T08:55:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-04-08T08:00:00Z', updatedAt: '2026-06-08T08:55:00Z' },
  { _id: 'pat-00083', type: 'patient', firstName: 'Deng', middleName: 'Wol', surname: 'Madit', gender: 'Male', dateOfBirth: '1956-08-30', age: 69, phone: '+211915200083', bloodType: 'O+', allergies: ['Aspirin'], chronicConditions: ['Hypertension', 'Osteoarthritis'], nokName: 'Wol Madit', nokRelationship: 'Son', nokPhone: '+211915200183', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000030', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-04', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-04T10:20:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2024-09-12T08:00:00Z', updatedAt: '2026-06-04T10:20:00Z' },
  { _id: 'pat-00084', type: 'patient', firstName: 'Awut', middleName: 'Dut', surname: 'Anyieth', gender: 'Female', dateOfBirth: '2016-11-05', age: 9, phone: '', bloodType: 'A+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Dut Anyieth', nokRelationship: 'Mother', nokPhone: '+211915200184', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000031', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-09T15:00:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2026-02-03T08:00:00Z', updatedAt: '2026-06-09T15:00:00Z' },
  { _id: 'pat-00085', type: 'patient', firstName: 'Chol', middleName: 'Ater', surname: 'Bol', gender: 'Male', dateOfBirth: '1988-01-26', age: 38, phone: '+211915200085', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['HIV'], nokName: 'Ater Bol', nokRelationship: 'Spouse', nokPhone: '+211915200185', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000032', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-05-31', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-05-31T11:45:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2024-12-05T08:00:00Z', updatedAt: '2026-05-31T11:45:00Z' },
  { _id: 'pat-00086', type: 'patient', firstName: 'Adau', middleName: 'Mayen', surname: 'Kuol', gender: 'Female', dateOfBirth: '1996-05-12', age: 30, phone: '+211915200086', bloodType: 'B+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Mayen Kuol', nokRelationship: 'Spouse', nokPhone: '+211915200186', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000033', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-07', lastVisitHospital: 'hosp-002', lastConsultedAt: '2026-06-07T12:35:00.000Z', assignedDoctor: CO_ID, assignedDoctorName: CO_NAME, isActive: true, createdAt: '2025-03-21T08:00:00Z', updatedAt: '2026-06-07T12:35:00Z' },
];

// Malakal Teaching Hospital (hosp-003) roster — gives nurse.stella and
// midwife.nyakong a deterministic ward/triage/MAR panel so the nurse station is
// populated at this facility (not just hosp-001/002). IDs use the free
// pat-00200+ range (generated patients stop at pat-00136; the rosters above use
// pat-00051..pat-00086) to avoid any collision.
const MIDWIFE_ID = 'user-midwife.nyakong';
const MIDWIFE_NAME = 'Midwife Nyakong Gatkuoth';
const malakalPatients: (Partial<PatientDoc> & Record<string, unknown>)[] = [
  { _id: 'pat-00200', type: 'patient', firstName: 'Gatwech', middleName: 'Both', surname: 'Puok', gender: 'Male', dateOfBirth: '1990-03-12', age: 36, phone: '+211915300200', bloodType: 'O+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Nyaluak Both', nokRelationship: 'Spouse', nokPhone: '+211915300210', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000010', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-09T09:10:00.000Z', assignedDoctor: MIDWIFE_ID, assignedDoctorName: MIDWIFE_NAME, isActive: true, createdAt: '2025-04-12T08:00:00Z', updatedAt: '2026-06-09T09:10:00Z' },
  { _id: 'pat-00201', type: 'patient', firstName: 'Nyakuoth', middleName: 'Reath', surname: 'Gatluak', gender: 'Female', dateOfBirth: '1997-08-25', age: 28, phone: '+211915300201', bloodType: 'A+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Reath Gatluak', nokRelationship: 'Spouse', nokPhone: '+211915300211', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000011', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-09T10:20:00.000Z', assignedDoctor: MIDWIFE_ID, assignedDoctorName: MIDWIFE_NAME, isActive: true, createdAt: '2025-05-30T08:00:00Z', updatedAt: '2026-06-09T10:20:00Z' },
  { _id: 'pat-00202', type: 'patient', firstName: 'Both', middleName: 'Deng', surname: 'Chuol', gender: 'Male', dateOfBirth: '1983-11-02', age: 42, phone: '+211915300202', bloodType: 'B+', allergies: ['Penicillin'], chronicConditions: ['Hypertension'], nokName: 'Nyibol Deng', nokRelationship: 'Spouse', nokPhone: '+211915300212', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000012', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-08', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-08T11:00:00.000Z', isActive: true, createdAt: '2024-12-18T08:00:00Z', updatedAt: '2026-06-08T11:00:00Z' },
  { _id: 'pat-00203', type: 'patient', firstName: 'Nyandeng', middleName: 'Gai', surname: 'Reath', gender: 'Female', dateOfBirth: '1975-02-19', age: 51, phone: '+211915300203', bloodType: 'O-', allergies: ['None known'], chronicConditions: ['Diabetes Mellitus'], nokName: 'Gai Reath', nokRelationship: 'Son', nokPhone: '+211915300213', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000013', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-07', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-07T08:45:00.000Z', isActive: true, createdAt: '2024-10-04T08:00:00Z', updatedAt: '2026-06-07T08:45:00Z' },
  { _id: 'pat-00204', type: 'patient', firstName: 'Chuol', middleName: 'Puok', surname: 'Jal', gender: 'Male', dateOfBirth: '2002-06-07', age: 23, phone: '+211915300204', bloodType: 'A+', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Puok Jal', nokRelationship: 'Father', nokPhone: '+211915300214', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000014', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-06', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-06T13:30:00.000Z', isActive: true, createdAt: '2025-08-11T08:00:00Z', updatedAt: '2026-06-06T13:30:00Z' },
  { _id: 'pat-00205', type: 'patient', firstName: 'Nyaluak', middleName: 'Tut', surname: 'Deng', gender: 'Female', dateOfBirth: '1992-09-29', age: 33, phone: '+211915300205', bloodType: 'B+', allergies: ['Sulfa drugs'], chronicConditions: ['Asthma'], nokName: 'Tut Deng', nokRelationship: 'Spouse', nokPhone: '+211915300215', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000015', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-09', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-09T14:15:00.000Z', assignedDoctor: MIDWIFE_ID, assignedDoctorName: MIDWIFE_NAME, isActive: true, createdAt: '2025-03-19T08:00:00Z', updatedAt: '2026-06-09T14:15:00Z' },
  { _id: 'pat-00206', type: 'patient', firstName: 'Riek', middleName: 'Kang', surname: 'Wal', gender: 'Male', dateOfBirth: '1961-01-15', age: 65, phone: '+211915300206', bloodType: 'O+', allergies: ['Aspirin'], chronicConditions: ['Hypertension', 'Osteoarthritis'], nokName: 'Kang Wal', nokRelationship: 'Son', nokPhone: '+211915300216', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000016', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-05', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-05T09:25:00.000Z', isActive: true, createdAt: '2024-09-08T08:00:00Z', updatedAt: '2026-06-05T09:25:00Z' },
  { _id: 'pat-00207', type: 'patient', firstName: 'Adhieu', middleName: 'Nyok', surname: 'Lia', gender: 'Female', dateOfBirth: '2005-12-03', age: 20, phone: '+211915300207', bloodType: 'A-', allergies: ['None known'], chronicConditions: ['None'], nokName: 'Nyok Lia', nokRelationship: 'Father', nokPhone: '+211915300217', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000017', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', lastVisitDate: '2026-06-08', lastVisitHospital: 'hosp-003', lastConsultedAt: '2026-06-08T15:40:00.000Z', assignedDoctor: MIDWIFE_ID, assignedDoctorName: MIDWIFE_NAME, isActive: true, createdAt: '2025-07-26T08:00:00Z', updatedAt: '2026-06-08T15:40:00Z' },
];

// Helper: put a doc, silently skip if it already exists (409 conflict)
async function safePut(db: PouchDB.Database, doc: Record<string, unknown>): Promise<void> {
  try {
    await db.put(doc);
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e.status === 409) return; // Document already exists — skip
    throw err;
  }
}

// ═══ Payment & Billing Seed Data ══════════════════════════════════
// 5 patients with diverse payment scenarios for workflow testing

export const seedCharges: Omit<ChargeDoc, '_rev' | 'createdBy'>[] = [
  // Patient 1 (pat-00001 Deng Mabior Garang) — Cash payment, fully paid
  { _id: 'chg-001', type: 'charge', encounterId: 'enc-pay-001', patientId: 'pat-00001', description: 'Outpatient Consultation', category: 'consultation', units: 1, billedAmount: 5000, status: 'approved', serviceDate: '2026-03-10', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', createdAt: '2026-03-10T08:00:00Z', updatedAt: '2026-03-10T08:00:00Z' },
  { _id: 'chg-002', type: 'charge', encounterId: 'enc-pay-001', patientId: 'pat-00001', description: 'Malaria RDT', category: 'laboratory', units: 1, billedAmount: 2000, status: 'approved', serviceDate: '2026-03-10', providerId: 'user-lab.gatluak', providerName: 'Lab Tech Gatluak Puok', facilityId: 'hosp-001', createdAt: '2026-03-10T08:30:00Z', updatedAt: '2026-03-10T08:30:00Z' },
  { _id: 'chg-003', type: 'charge', encounterId: 'enc-pay-001', patientId: 'pat-00001', description: 'Coartem (Artemether-Lumefantrine)', category: 'pharmacy', units: 1, billedAmount: 3000, status: 'approved', serviceDate: '2026-03-10', providerId: 'user-pharma.rose', providerName: 'Pharmacist Rose Gbudue', facilityId: 'hosp-001', createdAt: '2026-03-10T09:00:00Z', updatedAt: '2026-03-10T09:00:00Z' },

  // Patient 2 (pat-00005 Nyamal Koang Gatdet) — Mobile money (M-Pesa), paid
  { _id: 'chg-004', type: 'charge', encounterId: 'enc-pay-002', patientId: 'pat-00005', description: 'Antenatal Visit', category: 'consultation', units: 1, billedAmount: 3500, status: 'approved', serviceDate: '2026-03-12', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', createdAt: '2026-03-12T10:00:00Z', updatedAt: '2026-03-12T10:00:00Z' },
  { _id: 'chg-005', type: 'charge', encounterId: 'enc-pay-002', patientId: 'pat-00005', description: 'Full Blood Count', category: 'laboratory', units: 1, billedAmount: 3000, status: 'approved', serviceDate: '2026-03-12', providerId: 'user-lab.gatluak', providerName: 'Lab Tech Gatluak Puok', facilityId: 'hosp-001', createdAt: '2026-03-12T10:30:00Z', updatedAt: '2026-03-12T10:30:00Z' },
  { _id: 'chg-006', type: 'charge', encounterId: 'enc-pay-002', patientId: 'pat-00005', description: 'Iron + Folic Acid Supplements', category: 'pharmacy', units: 1, billedAmount: 1500, status: 'approved', serviceDate: '2026-03-12', providerId: 'user-pharma.rose', providerName: 'Pharmacist Rose Gbudue', facilityId: 'hosp-001', createdAt: '2026-03-12T11:00:00Z', updatedAt: '2026-03-12T11:00:00Z' },

  // Patient 3 (pat-00012 Gatluak Ruot Nyuon) — Insurance claim (Health Pooled Fund)
  { _id: 'chg-007', type: 'charge', encounterId: 'enc-pay-003', patientId: 'pat-00012', description: 'HIV Follow-up Consultation', category: 'consultation', units: 1, billedAmount: 4000, status: 'submitted', serviceDate: '2026-03-15', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-15T09:00:00Z' },
  { _id: 'chg-008', type: 'charge', encounterId: 'enc-pay-003', patientId: 'pat-00012', description: 'CD4 Count', category: 'laboratory', units: 1, billedAmount: 5000, status: 'submitted', serviceDate: '2026-03-15', providerId: 'user-lab.gatluak', providerName: 'Lab Tech Gatluak Puok', facilityId: 'hosp-001', createdAt: '2026-03-15T09:30:00Z', updatedAt: '2026-03-15T09:30:00Z' },
  { _id: 'chg-009', type: 'charge', encounterId: 'enc-pay-003', patientId: 'pat-00012', description: 'ARV Regimen (TDF/3TC/DTG) 90-day supply', category: 'pharmacy', units: 1, billedAmount: 15000, status: 'submitted', serviceDate: '2026-03-15', providerId: 'user-pharma.rose', providerName: 'Pharmacist Rose Gbudue', facilityId: 'hosp-001', createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z' },

  // Patient 4 (pat-00018 Rose Tombura Gbudue) — Outstanding balance, payment plan
  { _id: 'chg-010', type: 'charge', encounterId: 'enc-pay-004', patientId: 'pat-00018', description: 'Emergency Room Visit', category: 'consultation', units: 1, billedAmount: 8000, status: 'approved', serviceDate: '2026-02-20', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', createdAt: '2026-02-20T14:00:00Z', updatedAt: '2026-02-20T14:00:00Z' },
  { _id: 'chg-011', type: 'charge', encounterId: 'enc-pay-004', patientId: 'pat-00018', description: 'Blood Glucose Test (Fasting)', category: 'laboratory', units: 1, billedAmount: 2500, status: 'approved', serviceDate: '2026-02-20', providerId: 'user-lab.gatluak', providerName: 'Lab Tech Gatluak Puok', facilityId: 'hosp-001', createdAt: '2026-02-20T14:30:00Z', updatedAt: '2026-02-20T14:30:00Z' },
  { _id: 'chg-012', type: 'charge', encounterId: 'enc-pay-004', patientId: 'pat-00018', description: 'Metformin 500mg (30-day)', category: 'pharmacy', units: 1, billedAmount: 2000, status: 'approved', serviceDate: '2026-02-20', providerId: 'user-pharma.rose', providerName: 'Pharmacist Rose Gbudue', facilityId: 'hosp-001', createdAt: '2026-02-20T15:00:00Z', updatedAt: '2026-02-20T15:00:00Z' },
  { _id: 'chg-013', type: 'charge', encounterId: 'enc-pay-004', patientId: 'pat-00018', description: 'IV Fluids & Administration', category: 'procedure', units: 1, billedAmount: 5500, status: 'approved', serviceDate: '2026-02-20', providerId: 'user-nurse.stella', providerName: 'Nurse Stella Keji Lemi', facilityId: 'hosp-001', createdAt: '2026-02-20T15:30:00Z', updatedAt: '2026-02-20T15:30:00Z' },

  // Patient 5 (pat-00022 Kuol Akot Ajith) — Bank transfer payment, partially paid
  { _id: 'chg-014', type: 'charge', encounterId: 'enc-pay-005', patientId: 'pat-00022', description: 'Inpatient Admission (3 days)', category: 'bed_charge', units: 3, billedAmount: 30000, status: 'approved', serviceDate: '2026-03-01', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', createdAt: '2026-03-01T06:00:00Z', updatedAt: '2026-03-01T06:00:00Z' },
  { _id: 'chg-015', type: 'charge', encounterId: 'enc-pay-005', patientId: 'pat-00022', description: 'Blood Transfusion (2 units)', category: 'procedure', units: 2, billedAmount: 20000, status: 'approved', serviceDate: '2026-03-01', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', createdAt: '2026-03-01T08:00:00Z', updatedAt: '2026-03-01T08:00:00Z' },
  { _id: 'chg-016', type: 'charge', encounterId: 'enc-pay-005', patientId: 'pat-00022', description: 'Hemoglobin Test', category: 'laboratory', units: 1, billedAmount: 2000, status: 'approved', serviceDate: '2026-03-01', providerId: 'user-lab.gatluak', providerName: 'Lab Tech Gatluak Puok', facilityId: 'hosp-001', createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z' },
];

export const seedInsurancePolicies: Omit<InsurancePolicyDoc, '_rev' | 'createdBy'>[] = [
  // Patient 3 — Donor-funded coverage (Health Pooled Fund)
  {
    _id: 'ins-001', type: 'insurance_policy', patientId: 'pat-00012',
    payerType: 'donor', payerName: 'Health Pooled Fund', payerCode: 'HPF-SS',
    memberId: 'HPF-2026-00412', policyNumber: 'HPF-JTH-2026-0412',
    subscriberName: 'Gatluak Ruot Nyuon', subscriberRelationship: 'self',
    effectiveDate: '2026-01-01', terminationDate: '2026-12-31',
    isPrimary: true, copayAmount: 0, coinsurancePct: 0,
    deductibleAmount: 0, deductibleRemaining: 0,
    coverageNotes: 'Full coverage under HPF donor program for HIV/AIDS patients',
    isActive: true, donorProgramId: 'hpf-hiv-2026', donorCoverageType: 'full',
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z',
  },
  // Patient 5 — Private insurance (partial)
  {
    _id: 'ins-002', type: 'insurance_policy', patientId: 'pat-00022',
    payerType: 'private', payerName: 'AAR Insurance', payerCode: 'AAR-SS',
    memberId: 'AAR-110235', groupNumber: 'GRP-CORP-042', policyNumber: 'AAR-2026-110235',
    subscriberName: 'Kuol Akot Ajith', subscriberRelationship: 'self',
    effectiveDate: '2026-01-01', terminationDate: '2026-12-31',
    isPrimary: true, copayAmount: 2000, coinsurancePct: 20,
    deductibleAmount: 10000, deductibleRemaining: 0,
    oopMax: 100000, oopUsed: 42000,
    coverageNotes: 'Corporate plan. 80/20 coinsurance after deductible.',
    isActive: true,
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-01-10T14:00:00Z', updatedAt: '2026-03-01T10:00:00Z',
  },
];

// Free-text care notes surfaced on the patient Overview "Notes" card. These are
// the kind of soft, human reminders that don't belong in structured fields.
const seedPatientNotes: Omit<PatientNoteDoc, '_rev'>[] = [
  {
    _id: 'pnote-001', type: 'patient_note', patientId: 'pat-00012',
    body: 'Prefers to be seen by a male clinician. Travels >3 hrs from Bor — try to consolidate labs and review into a single visit where possible.',
    authorId: 'user-doctor-1', authorName: 'Dr. Lauren Deng', authorRole: 'doctor',
    hospitalId: 'hosp-001',
    createdAt: '2026-03-18T09:15:00Z', updatedAt: '2026-03-18T09:15:00Z',
  },
];

export const seedClaims: Omit<ClaimDoc, '_rev' | 'createdBy'>[] = [
  // Patient 3 — Donor claim (paid in full)
  {
    _id: 'clm-001', type: 'claim', encounterId: 'enc-pay-003', patientId: 'pat-00012',
    patientName: 'Gatluak Ruot Nyuon', policyId: 'ins-001',
    payerName: 'Health Pooled Fund', payerType: 'donor',
    claimNumber: 'HPF-CLM-2026-0078',
    chargeIds: ['chg-007', 'chg-008', 'chg-009'],
    totalBilled: 24000, totalAllowed: 24000, totalApproved: 24000,
    totalDenied: 0, totalWriteOff: 0, patientResponsibility: 0,
    submittedDate: '2026-03-16', adjudicatedDate: '2026-03-20',
    status: 'paid', denialReasons: [],
    donorReportingPeriod: 'Q1-2026',
    submittedBy: 'user-desk.amira',
    facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', orgId: 'org-moh-ss',
    createdAt: '2026-03-16T08:00:00Z', updatedAt: '2026-03-20T14:00:00Z',
  },
  // Patient 5 — Private insurance claim (partial approval)
  {
    _id: 'clm-002', type: 'claim', encounterId: 'enc-pay-005', patientId: 'pat-00022',
    patientName: 'Kuol Akot Ajith', policyId: 'ins-002',
    payerName: 'AAR Insurance', payerType: 'private',
    claimNumber: 'AAR-CLM-2026-4521',
    chargeIds: ['chg-014', 'chg-015', 'chg-016'],
    totalBilled: 52000, totalAllowed: 45000, totalApproved: 36000,
    totalDenied: 0, totalWriteOff: 7000, patientResponsibility: 9000,
    submittedDate: '2026-03-04', adjudicatedDate: '2026-03-10',
    status: 'partial', denialReasons: [],
    remarkCodes: ['CO-45'],
    submittedBy: 'user-desk.amira',
    facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', orgId: 'org-moh-ss',
    createdAt: '2026-03-04T09:00:00Z', updatedAt: '2026-03-10T16:00:00Z',
  },
];

export const seedPayments: Omit<PaymentDoc, '_rev' | 'createdBy'>[] = [
  // Patient 1 — Cash payment (fully paid)
  {
    _id: 'pay-001', type: 'payment', patientId: 'pat-00001', patientName: 'Deng Mabior Garang',
    encounterId: 'enc-pay-001', method: 'cash', amount: 10000, currency: 'SSP',
    reference: 'RCT-20260310-001',
    status: 'posted', processedAt: '2026-03-10T09:30:00Z',
    processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan',
    notes: 'Full payment at checkout. Cash received, change given.',
    allocations: [
      { encounterId: 'enc-pay-001', amount: 5000, chargeId: 'chg-001' },
      { encounterId: 'enc-pay-001', amount: 2000, chargeId: 'chg-002' },
      { encounterId: 'enc-pay-001', amount: 3000, chargeId: 'chg-003' },
    ],
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-03-10T09:30:00Z', updatedAt: '2026-03-10T09:30:00Z',
  },
  // Patient 2 — M-Pesa mobile money
  {
    _id: 'pay-002', type: 'payment', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet',
    encounterId: 'enc-pay-002', method: 'mpesa', amount: 8000, currency: 'SSP',
    reference: 'MPESA-TXN-SL4K9R2',
    mobileMoneyPhone: '+211955123456',
    status: 'posted', processedAt: '2026-03-12T11:30:00Z',
    processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan',
    notes: 'M-Pesa payment confirmed via SMS.',
    allocations: [
      { encounterId: 'enc-pay-002', amount: 3500, chargeId: 'chg-004' },
      { encounterId: 'enc-pay-002', amount: 3000, chargeId: 'chg-005' },
      { encounterId: 'enc-pay-002', amount: 1500, chargeId: 'chg-006' },
    ],
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-03-12T11:30:00Z', updatedAt: '2026-03-12T11:30:00Z',
  },
  // Patient 3 — Insurance payment (from donor)
  {
    _id: 'pay-003', type: 'payment', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon',
    encounterId: 'enc-pay-003', method: 'insurance', amount: 24000, currency: 'SSP',
    reference: 'HPF-ERA-2026-0078',
    status: 'posted', processedAt: '2026-03-20T14:00:00Z',
    processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan',
    notes: 'Health Pooled Fund claim paid in full. Zero patient responsibility.',
    allocations: [
      { encounterId: 'enc-pay-003', amount: 4000, chargeId: 'chg-007' },
      { encounterId: 'enc-pay-003', amount: 5000, chargeId: 'chg-008' },
      { encounterId: 'enc-pay-003', amount: 15000, chargeId: 'chg-009' },
    ],
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-03-20T14:00:00Z', updatedAt: '2026-03-20T14:00:00Z',
  },
  // Patient 4 — Partial cash payment (has outstanding balance on payment plan)
  {
    _id: 'pay-004', type: 'payment', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue',
    encounterId: 'enc-pay-004', method: 'cash', amount: 6000, currency: 'SSP',
    reference: 'RCT-20260220-004',
    status: 'posted', processedAt: '2026-02-20T16:00:00Z',
    processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan',
    notes: 'Partial payment. Remaining SSP 12,000 placed on payment plan.',
    allocations: [
      { encounterId: 'enc-pay-004', amount: 6000, chargeId: 'chg-010' },
    ],
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-02-20T16:00:00Z', updatedAt: '2026-02-20T16:00:00Z',
  },
  // Patient 4 — Payment plan installment 1 (cash)
  {
    _id: 'pay-005', type: 'payment', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue',
    paymentPlanId: 'plan-001', method: 'cash', amount: 4000, currency: 'SSP',
    reference: 'RCT-20260315-005',
    status: 'posted', processedAt: '2026-03-15T10:00:00Z',
    processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan',
    notes: 'Payment plan installment #1.',
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z',
  },
  // Patient 5 — Bank transfer (partial, after insurance)
  {
    _id: 'pay-006', type: 'payment', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith',
    encounterId: 'enc-pay-005', method: 'insurance', amount: 36000, currency: 'SSP',
    reference: 'AAR-ERA-2026-4521',
    status: 'posted', processedAt: '2026-03-10T16:00:00Z',
    processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan',
    notes: 'AAR Insurance payment. Patient responsibility: SSP 9,000.',
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-03-10T16:00:00Z', updatedAt: '2026-03-10T16:00:00Z',
  },
  {
    _id: 'pay-007', type: 'payment', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith',
    encounterId: 'enc-pay-005', method: 'bank_transfer', amount: 5000, currency: 'SSP',
    reference: 'ECO-TRF-2026-03112',
    status: 'posted', processedAt: '2026-03-12T09:00:00Z',
    processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan',
    notes: 'Bank transfer for patient responsibility portion. SSP 4,000 still outstanding.',
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-03-12T09:00:00Z', updatedAt: '2026-03-12T09:00:00Z',
  },
];

export const seedPaymentPlans: Omit<PaymentPlanDoc, '_rev' | 'createdBy'>[] = [
  // Patient 4 — 3-month interest-free plan for emergency visit balance
  {
    _id: 'plan-001', type: 'payment_plan', patientId: 'pat-00018',
    patientName: 'Rose Tombura Gbudue',
    totalBalance: 12000, termMonths: 3, monthlyAmount: 4000, apr: 0,
    startDate: '2026-03-01', endDate: '2026-05-31',
    status: 'active', nextDueDate: '2026-04-15',
    paidToDate: 4000, remainingBalance: 8000, missedPayments: 0,
    lastPaymentDate: '2026-03-15',
    autoPayEnabled: false,
    encounterIds: ['enc-pay-004'],
    installments: [
      { number: 1, dueDate: '2026-03-15', amount: 4000, status: 'paid', paidAmount: 4000, paidDate: '2026-03-15', paymentId: 'pay-005' },
      { number: 2, dueDate: '2026-04-15', amount: 4000, status: 'pending' },
      { number: 3, dueDate: '2026-05-15', amount: 4000, status: 'pending' },
    ],
    createdByStaff: 'user-desk.amira', createdByStaffName: 'Amira Juma Hassan',
    facilityId: 'hosp-001', orgId: 'org-moh-ss',
    createdAt: '2026-02-20T16:30:00Z', updatedAt: '2026-03-15T10:00:00Z',
  },
];

export const seedLedgerEntries: Omit<LedgerEntryDoc, '_rev' | 'createdBy'>[] = [
  // ── Patient 1: Deng Mabior Garang — Fully paid (balance: 0) ──
  { _id: 'led-001', type: 'ledger_entry', patientId: 'pat-00001', encounterId: 'enc-pay-001', entryType: 'charge', amount: 10000, runningBalance: 10000, description: 'Consultation + Malaria RDT + Coartem', referenceId: 'chg-001', referenceType: 'charge', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-10T09:00:00Z', updatedAt: '2026-03-10T09:00:00Z' },
  { _id: 'led-002', type: 'ledger_entry', patientId: 'pat-00001', encounterId: 'enc-pay-001', entryType: 'payment', amount: -10000, runningBalance: 0, description: 'Cash payment — RCT-20260310-001', referenceId: 'pay-001', referenceType: 'payment', method: 'cash', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-10T09:30:00Z', updatedAt: '2026-03-10T09:30:00Z' },

  // ── Patient 2: Nyamal Koang Gatdet — Fully paid via M-Pesa (balance: 0) ──
  { _id: 'led-003', type: 'ledger_entry', patientId: 'pat-00005', encounterId: 'enc-pay-002', entryType: 'charge', amount: 8000, runningBalance: 8000, description: 'ANC Visit + FBC + Iron/Folic Acid', referenceId: 'chg-004', referenceType: 'charge', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-12T11:00:00Z', updatedAt: '2026-03-12T11:00:00Z' },
  { _id: 'led-004', type: 'ledger_entry', patientId: 'pat-00005', encounterId: 'enc-pay-002', entryType: 'payment', amount: -8000, runningBalance: 0, description: 'M-Pesa payment — MPESA-TXN-SL4K9R2', referenceId: 'pay-002', referenceType: 'payment', method: 'mpesa', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-12T11:30:00Z', updatedAt: '2026-03-12T11:30:00Z' },

  // ── Patient 3: Gatluak Ruot Nyuon — Donor-paid, zero patient balance ──
  { _id: 'led-005', type: 'ledger_entry', patientId: 'pat-00012', encounterId: 'enc-pay-003', entryType: 'charge', amount: 24000, runningBalance: 24000, description: 'HIV Follow-up + CD4 + ARVs', referenceId: 'chg-007', referenceType: 'charge', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z' },
  { _id: 'led-006', type: 'ledger_entry', patientId: 'pat-00012', encounterId: 'enc-pay-003', entryType: 'insurance_payment', amount: -24000, runningBalance: 0, description: 'Health Pooled Fund claim paid — HPF-ERA-2026-0078', referenceId: 'pay-003', referenceType: 'payment', method: 'insurance', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-20T14:00:00Z', updatedAt: '2026-03-20T14:00:00Z' },

  // ── Patient 4: Rose Tombura Gbudue — Outstanding balance SSP 8,000 on plan ──
  { _id: 'led-007', type: 'ledger_entry', patientId: 'pat-00018', encounterId: 'enc-pay-004', entryType: 'charge', amount: 18000, runningBalance: 18000, description: 'ER Visit + Glucose Test + Metformin + IV Fluids', referenceId: 'chg-010', referenceType: 'charge', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-02-20T15:30:00Z', updatedAt: '2026-02-20T15:30:00Z' },
  { _id: 'led-008', type: 'ledger_entry', patientId: 'pat-00018', encounterId: 'enc-pay-004', entryType: 'payment', amount: -6000, runningBalance: 12000, description: 'Cash partial payment — RCT-20260220-004', referenceId: 'pay-004', referenceType: 'payment', method: 'cash', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-02-20T16:00:00Z', updatedAt: '2026-02-20T16:00:00Z' },
  { _id: 'led-009', type: 'ledger_entry', patientId: 'pat-00018', entryType: 'payment', amount: -4000, runningBalance: 8000, description: 'Payment plan installment #1 — RCT-20260315-005', referenceId: 'pay-005', referenceType: 'payment', method: 'cash', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z' },

  // ── Patient 5: Kuol Akot Ajith — Outstanding balance SSP 4,000 ──
  { _id: 'led-010', type: 'ledger_entry', patientId: 'pat-00022', encounterId: 'enc-pay-005', entryType: 'charge', amount: 52000, runningBalance: 52000, description: 'Inpatient (3 days) + Blood Transfusion + Hb Test', referenceId: 'chg-014', referenceType: 'charge', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z' },
  { _id: 'led-011', type: 'ledger_entry', patientId: 'pat-00022', encounterId: 'enc-pay-005', entryType: 'adjustment', amount: -7000, runningBalance: 45000, description: 'Contractual write-off (AAR allowed amount)', referenceId: 'clm-002', referenceType: 'claim', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-10T15:00:00Z', updatedAt: '2026-03-10T15:00:00Z' },
  { _id: 'led-012', type: 'ledger_entry', patientId: 'pat-00022', encounterId: 'enc-pay-005', entryType: 'insurance_payment', amount: -36000, runningBalance: 9000, description: 'AAR Insurance payment — AAR-ERA-2026-4521', referenceId: 'pay-006', referenceType: 'payment', method: 'insurance', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-10T16:00:00Z', updatedAt: '2026-03-10T16:00:00Z' },
  { _id: 'led-013', type: 'ledger_entry', patientId: 'pat-00022', encounterId: 'enc-pay-005', entryType: 'payment', amount: -5000, runningBalance: 4000, description: 'Bank transfer — ECO-TRF-2026-03112', referenceId: 'pay-007', referenceType: 'payment', method: 'bank_transfer', currency: 'SSP', facilityId: 'hosp-001', createdAt: '2026-03-12T09:00:00Z', updatedAt: '2026-03-12T09:00:00Z' },
];

// ═══ Appointments seed data ═══════════════════════════════════════
// Scheduled across recent + upcoming days, mixed statuses, linked to
// seeded patients and providers (user-<username>).
export const seedAppointments: Omit<AppointmentDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'appointment-1', type: 'appointment', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', patientPhone: '+211912345678', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(1), appointmentTime: '09:00', endTime: '09:30', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Internal Medicine', reason: 'Malaria treatment follow-up', status: 'confirmed', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(1) },
  { _id: 'appointment-2', type: 'appointment', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', patientPhone: '+211912555005', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(2), appointmentTime: '10:00', endTime: '10:30', duration: 30, appointmentType: 'anc', priority: 'routine', department: 'Obstetrics & Gynecology', reason: 'Antenatal check-up', status: 'scheduled', reminderSent: false, isRecurring: true, recurrencePattern: 'monthly', bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
  { _id: 'appointment-3', type: 'appointment', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', patientPhone: '+211912555012', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(7), appointmentTime: '11:00', endTime: '11:30', duration: 30, appointmentType: 'specialist', priority: 'urgent', department: 'Internal Medicine', reason: 'HIV / CD4 review', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-data.ayen', bookedByName: 'Ayen Dut Malual', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(4), updatedAt: daysAgo(4) },
  { _id: 'appointment-4', type: 'appointment', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211912555018', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateAgo(0), appointmentTime: '08:45', endTime: '09:15', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Diabetes management', status: 'checked_in', checkedInAt: daysAgo(0), reminderSent: true, reminderChannel: 'both', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(6), updatedAt: daysAgo(0) },
  { _id: 'appointment-5', type: 'appointment', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', patientPhone: '+211912555022', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '12:00', endTime: '12:45', duration: 45, appointmentType: 'general', priority: 'urgent', department: 'Internal Medicine', reason: 'Severe anaemia review', status: 'in_progress', checkedInAt: daysAgo(0), reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(7), updatedAt: daysAgo(0) },
  { _id: 'appointment-6', type: 'appointment', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', patientPhone: '+211912555030', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(2), appointmentTime: '09:30', endTime: '10:00', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Surgery', reason: 'Post-op wound check', status: 'completed', completedAt: daysAgo(2), reminderSent: true, reminderChannel: 'app', isRecurring: false, bookedBy: 'user-data.ayen', bookedByName: 'Ayen Dut Malual', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(9), updatedAt: daysAgo(2) },
  { _id: 'appointment-7', type: 'appointment', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', patientPhone: '+211912555035', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateAgo(3), appointmentTime: '14:00', endTime: '14:30', duration: 30, appointmentType: 'lab', priority: 'routine', department: 'Laboratory', reason: 'Routine blood work', status: 'completed', completedAt: daysAgo(3), reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(10), updatedAt: daysAgo(3) },
  { _id: 'appointment-8', type: 'appointment', patientId: 'pat-00040', patientName: 'Majok Chol Wol', patientPhone: '+211912555040', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(4), appointmentTime: '15:00', endTime: '15:30', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Abdominal pain', status: 'no_show', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(11), updatedAt: daysAgo(4) },
  { _id: 'appointment-9', type: 'appointment', patientId: 'pat-00057', patientName: 'Achol Mayen Garang', patientPhone: '+211912555057', providerId: 'user-midwife.nyakong', providerName: 'Midwife Nyakong Gatkuoth', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(3), appointmentTime: '10:30', endTime: '11:00', duration: 30, appointmentType: 'anc', priority: 'routine', department: 'Maternity', reason: 'ANC visit 6', status: 'confirmed', reminderSent: true, reminderChannel: 'both', isRecurring: true, recurrencePattern: 'biweekly', bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(1) },
  { _id: 'appointment-10', type: 'appointment', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', patientPhone: '+211912555012', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(6), appointmentTime: '11:30', endTime: '12:00', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Internal Medicine', reason: 'Missed previous slot', status: 'cancelled', cancelledReason: 'Patient travelling', cancelledBy: 'user-desk.amira', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(13), updatedAt: daysAgo(7) },
  { _id: 'appointment-11', type: 'appointment', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211912555018', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(14), appointmentTime: '08:00', endTime: '08:30', duration: 30, appointmentType: 'specialist', priority: 'routine', department: 'Endocrinology', reason: 'Diabetes specialist review', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-data.ayen', bookedByName: 'Ayen Dut Malual', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'appointment-12', type: 'appointment', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', patientPhone: '+211912345678', providerId: 'user-dr.mercy', providerName: 'Dr. Grace Lado', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(5), appointmentTime: '13:00', endTime: '13:30', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Cardiology', reason: 'Hypertension review', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PRIVATE_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  // ── Today's scheduled arrivals so the reception queue shows appointments. ──
  { _id: 'appointment-13', type: 'appointment', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', patientPhone: '+211912345678', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '08:00', endTime: '08:30', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Internal Medicine', reason: 'Hypertension follow-up', status: 'checked_in', checkedInAt: daysAgo(0), reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(0) },
  { _id: 'appointment-14', type: 'appointment', patientId: 'pat-00057', patientName: 'Achol Mayen Garang', patientPhone: '+211912555057', providerId: 'user-midwife.nyakong', providerName: 'Midwife Nyakong Gatkuoth', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '09:15', endTime: '09:45', duration: 30, appointmentType: 'anc', priority: 'routine', department: 'Maternity', reason: 'ANC visit', status: 'confirmed', reminderSent: true, reminderChannel: 'both', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(0) },
  { _id: 'appointment-15', type: 'appointment', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', patientPhone: '+211912555035', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '10:45', endTime: '11:15', duration: 30, appointmentType: 'general', priority: 'urgent', department: 'Outpatient', reason: 'Persistent fever', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'appointment-16', type: 'appointment', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', patientPhone: '+211912555005', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '11:30', endTime: '12:00', duration: 30, appointmentType: 'anc', priority: 'routine', department: 'Obstetrics & Gynecology', reason: 'Antenatal check-up', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'appointment-30', type: 'appointment', patientId: 'pat-00008', patientName: 'Ayen Dut Malual', patientPhone: '+211912555008', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '13:00', endTime: '13:30', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Internal Medicine', reason: 'Medication refill and BP review', status: 'scheduled', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'appointment-31', type: 'appointment', patientId: 'pat-00015', patientName: 'Tut Chuol Both', patientPhone: '+211912555015', providerId: 'user-dr.mercy', providerName: 'Dr. Grace Lado', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '13:45', endTime: '14:15', duration: 30, appointmentType: 'specialist', priority: 'urgent', department: 'Nephrology', reason: 'Renal follow-up', status: 'confirmed', reminderSent: true, reminderChannel: 'both', isRecurring: false, bookedBy: 'user-data.ayen', bookedByName: 'Ayen Dut Malual', state: 'Central Equatoria', county: 'Juba', orgId: PRIVATE_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'appointment-32', type: 'appointment', patientId: 'pat-00040', patientName: 'Majok Chol Wol', patientPhone: '+211912555040', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '14:30', endTime: '15:00', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Abdominal pain follow-up', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'appointment-33', type: 'appointment', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211912555018', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateAgo(0), appointmentTime: '15:15', endTime: '15:45', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Endocrinology', reason: 'Diabetes review', status: 'confirmed', reminderSent: true, reminderChannel: 'app', isRecurring: false, bookedBy: 'user-data.ayen', bookedByName: 'Ayen Dut Malual', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'appointment-34', type: 'appointment', patientId: 'pat-00063', patientName: 'Santino Madut', patientPhone: '+211915200063', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateAgo(0), appointmentTime: '09:15', endTime: '09:45', duration: 30, appointmentType: 'follow_up', priority: 'urgent', department: 'Outpatient', reason: 'Chest pain reassessment', status: 'checked_in', checkedInAt: daysAgo(0), reminderSent: true, reminderChannel: 'both', isRecurring: false, bookedBy: 'user-desk.wau', bookedByName: 'Tabitha Nyandeng Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'appointment-35', type: 'appointment', patientId: 'pat-00064', patientName: 'Aluel Garang', patientPhone: '+211915200064', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateAgo(0), appointmentTime: '10:15', endTime: '10:45', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Fever follow-up', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.wau', bookedByName: 'Tabitha Nyandeng Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  // ── Extra upcoming appointments for carousel demo ──
  { _id: 'appointment-17', type: 'appointment', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', patientPhone: '+211912555022', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(1), appointmentTime: '09:00', endTime: '09:30', duration: 30, appointmentType: 'follow_up', priority: 'urgent', department: 'Outpatient', reason: 'Anaemia review', status: 'confirmed', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(1) },
  { _id: 'appointment-18', type: 'appointment', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', patientPhone: '+211912555030', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(2), appointmentTime: '10:00', endTime: '10:30', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Wound dressing follow-up', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(2) },
  { _id: 'appointment-19', type: 'appointment', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', patientPhone: '+211912555035', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(4), appointmentTime: '11:00', endTime: '11:30', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Outpatient', reason: 'Malaria follow-up', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(4), updatedAt: daysAgo(3) },
  { _id: 'appointment-20', type: 'appointment', patientId: 'pat-00040', patientName: 'Majok Chol Wol', patientPhone: '+211912555040', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(6), appointmentTime: '14:00', endTime: '14:30', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Hypertension review', status: 'confirmed', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(5), updatedAt: daysAgo(2) },
  { _id: 'appointment-25', type: 'appointment', patientId: 'pat-00063', patientName: 'Santino Madut', patientPhone: '+211915200063', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateAgo(0), appointmentTime: '08:15', endTime: '08:45', duration: 30, appointmentType: 'follow_up', priority: 'urgent', department: 'Outpatient', reason: 'Chest pain review', status: 'checked_in', checkedInAt: daysAgo(0), reminderSent: true, reminderChannel: 'both', isRecurring: false, bookedBy: 'user-desk.wau', bookedByName: 'Tabitha Nyandeng Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(0) },
  { _id: 'appointment-26', type: 'appointment', patientId: 'pat-00064', patientName: 'Aluel Garang', patientPhone: '+211915200064', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(1), appointmentTime: '09:45', endTime: '10:15', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Fever follow-up', status: 'confirmed', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.wau', bookedByName: 'Tabitha Nyandeng Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'appointment-27', type: 'appointment', patientId: 'pat-00065', patientName: 'Deng Wol', patientPhone: '+211915200065', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(2), appointmentTime: '10:45', endTime: '11:15', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Outpatient', reason: 'Diabetes review', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.wau', bookedByName: 'Tabitha Nyandeng Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(0) },
  { _id: 'appointment-28', type: 'appointment', patientId: 'pat-00066', patientName: 'Nyibol Atem', patientPhone: '+211915200066', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(3), appointmentTime: '12:15', endTime: '12:45', duration: 30, appointmentType: 'specialist', priority: 'urgent', department: 'Respiratory', reason: 'Asthma review', status: 'confirmed', reminderSent: true, reminderChannel: 'both', isRecurring: false, bookedBy: 'user-desk.wau', bookedByName: 'Tabitha Nyandeng Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(0) },
  { _id: 'appointment-29', type: 'appointment', patientId: 'pat-00067', patientName: 'Mabior Deng', patientPhone: '+211915200067', providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', appointmentDate: dateFromNow(5), appointmentTime: '13:30', endTime: '14:00', duration: 30, appointmentType: 'general', priority: 'routine', department: 'Outpatient', reason: 'Routine consultation', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.wau', bookedByName: 'Tabitha Nyandeng Kuol', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'appointment-21', type: 'appointment', patientId: 'pat-00008', patientName: 'Ayen Dut Malual', patientPhone: '+211912555008', providerId: 'user-dr.mercy', providerName: 'Dr. Grace Lado', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(2), appointmentTime: '09:00', endTime: '09:30', duration: 30, appointmentType: 'specialist', priority: 'urgent', department: 'Respiratory', reason: 'TB follow-up', status: 'confirmed', reminderSent: true, reminderChannel: 'both', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PRIVATE_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(1) },
  { _id: 'appointment-22', type: 'appointment', patientId: 'pat-00015', patientName: 'Tut Chuol Both', patientPhone: '+211912555015', providerId: 'user-dr.mercy', providerName: 'Dr. Grace Lado', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(3), appointmentTime: '11:30', endTime: '12:00', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Nephrology', reason: 'Renal function review', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PRIVATE_ORG_ID, createdAt: daysAgo(4), updatedAt: daysAgo(2) },
  { _id: 'appointment-23', type: 'appointment', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211912555018', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(3), appointmentTime: '10:00', endTime: '10:30', duration: 30, appointmentType: 'follow_up', priority: 'routine', department: 'Internal Medicine', reason: 'Blood pressure check', status: 'confirmed', reminderSent: true, reminderChannel: 'sms', isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(1) },
  { _id: 'appointment-24', type: 'appointment', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', patientPhone: '+211912555022', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', appointmentDate: dateFromNow(5), appointmentTime: '14:30', endTime: '15:00', duration: 30, appointmentType: 'specialist', priority: 'urgent', department: 'Haematology', reason: 'Post-transfusion review', status: 'scheduled', reminderSent: false, isRecurring: false, bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(1) },
];

// ═══ Ward + bed + admission seed data ═════════════════════════════
// occupiedBeds/availableBeds are set explicitly so the bed-occupancy
// dashboard (which reads them off the ward doc) renders without first
// recalculating from beds.
const seedWards: Omit<WardDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'ward-1', type: 'ward', name: 'General Male Ward', wardType: 'general_male', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', floor: 'Ground', totalBeds: 24, occupiedBeds: 18, availableBeds: 6, nurseInCharge: 'user-nurse.stella', nurseInChargeName: 'Nurse Stella Keji Lemi', isActive: true, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
  { _id: 'ward-2', type: 'ward', name: 'General Female Ward', wardType: 'general_female', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', floor: 'Ground', totalBeds: 24, occupiedBeds: 15, availableBeds: 9, nurseInCharge: 'user-nurse.stella', nurseInChargeName: 'Nurse Stella Keji Lemi', isActive: true, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
  { _id: 'ward-3', type: 'ward', name: 'Maternity Ward', wardType: 'maternity', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', floor: 'First', totalBeds: 20, occupiedBeds: 17, availableBeds: 3, nurseInCharge: 'user-midwife.nyakong', nurseInChargeName: 'Midwife Nyakong Gatkuoth', isActive: true, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
  { _id: 'ward-4', type: 'ward', name: 'Paediatric Ward', wardType: 'paediatric', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', floor: 'First', totalBeds: 16, occupiedBeds: 10, availableBeds: 6, isActive: true, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
  { _id: 'ward-5', type: 'ward', name: 'ICU', wardType: 'icu', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', floor: 'Second', totalBeds: 8, occupiedBeds: 7, availableBeds: 1, isActive: true, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
  { _id: 'ward-6', type: 'ward', name: 'General Ward', wardType: 'general_male', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', floor: 'Ground', totalBeds: 18, occupiedBeds: 11, availableBeds: 7, isActive: true, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
];

const seedBeds: Omit<BedDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'bed-1', type: 'bed', bedNumber: 'W1-B01', wardId: 'ward-1', wardName: 'General Male Ward', facilityId: 'hosp-001', status: 'occupied', currentPatientId: 'pat-00001', currentPatientName: 'Deng Mabior Garang', currentAdmissionId: 'admission-1', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(3) },
  { _id: 'bed-2', type: 'bed', bedNumber: 'W1-B02', wardId: 'ward-1', wardName: 'General Male Ward', facilityId: 'hosp-001', status: 'occupied', currentPatientId: 'pat-00022', currentPatientName: 'Kuol Akot Ajith', currentAdmissionId: 'admission-2', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(2) },
  { _id: 'bed-3', type: 'bed', bedNumber: 'W1-B03', wardId: 'ward-1', wardName: 'General Male Ward', facilityId: 'hosp-001', status: 'available', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(1) },
  { _id: 'bed-4', type: 'bed', bedNumber: 'W1-B04', wardId: 'ward-1', wardName: 'General Male Ward', facilityId: 'hosp-001', status: 'cleaning', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
  { _id: 'bed-5', type: 'bed', bedNumber: 'W3-B01', wardId: 'ward-3', wardName: 'Maternity Ward', facilityId: 'hosp-001', status: 'occupied', currentPatientId: 'pat-00062', currentPatientName: 'Nyandeng Chol Wol', currentAdmissionId: 'admission-3', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(1) },
  { _id: 'bed-6', type: 'bed', bedNumber: 'W3-B02', wardId: 'ward-3', wardName: 'Maternity Ward', facilityId: 'hosp-001', status: 'reserved', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(0) },
  { _id: 'bed-7', type: 'bed', bedNumber: 'ICU-B01', wardId: 'ward-5', wardName: 'ICU', facilityId: 'hosp-001', status: 'occupied', currentPatientId: 'pat-00030', currentPatientName: 'Achol Mayen Ring', currentAdmissionId: 'admission-4', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(2) },
  { _id: 'bed-8', type: 'bed', bedNumber: 'ICU-B02', wardId: 'ward-5', wardName: 'ICU', facilityId: 'hosp-001', status: 'maintenance', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(5) },
  { _id: 'bed-9', type: 'bed', bedNumber: 'W6-B01', wardId: 'ward-6', wardName: 'General Ward', facilityId: 'hosp-002', status: 'occupied', currentPatientId: 'pat-00063', currentPatientName: 'Santino Madut', currentAdmissionId: 'admission-6', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(2) },
];

const seedAdmissions: Omit<AdmissionDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'admission-1', type: 'admission', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', hospitalNumber: 'JTH-000001', admissionDate: daysAgo(3), admittingDiagnosis: 'Severe malaria', icd11Code: '1A40', severity: 'severe', admittedBy: 'user-dr.wani', admittedByName: 'Dr. James Wani Igga', wardId: 'ward-1', wardName: 'General Male Ward', bedId: 'bed-1', bedNumber: 'W1-B01', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', attendingPhysician: 'user-dr.wani', attendingPhysicianName: 'Dr. James Wani Igga', nurseAssigned: 'user-nurse.stella', nurseAssignedName: 'Nurse Stella Keji Lemi', isolationRequired: false, status: 'admitted', followUpRequired: false, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { _id: 'admission-2', type: 'admission', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', hospitalNumber: 'JTH-000022', admissionDate: daysAgo(2), admittingDiagnosis: 'Severe anaemia (sickle cell crisis)', icd11Code: '3A51', severity: 'critical', admittedBy: 'user-dr.achol', admittedByName: 'Dr. Achol Mayen Deng', wardId: 'ward-1', wardName: 'General Male Ward', bedId: 'bed-2', bedNumber: 'W1-B02', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', attendingPhysician: 'user-dr.achol', attendingPhysicianName: 'Dr. Achol Mayen Deng', isolationRequired: false, status: 'admitted', followUpRequired: false, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { _id: 'admission-3', type: 'admission', patientId: 'pat-00062', patientName: 'Nyandeng Chol Wol', hospitalNumber: 'JTH-000062', admissionDate: daysAgo(1), admittingDiagnosis: 'Labour at term', icd11Code: 'JB40', severity: 'moderate', admittedBy: 'user-midwife.nyakong', admittedByName: 'Midwife Nyakong Gatkuoth', wardId: 'ward-3', wardName: 'Maternity Ward', bedId: 'bed-5', bedNumber: 'W3-B01', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', attendingPhysician: 'user-dr.achol', attendingPhysicianName: 'Dr. Achol Mayen Deng', nurseAssigned: 'user-midwife.nyakong', nurseAssignedName: 'Midwife Nyakong Gatkuoth', isolationRequired: false, status: 'admitted', followUpRequired: false, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'admission-4', type: 'admission', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', hospitalNumber: 'JTH-000030', admissionDate: daysAgo(2), admittingDiagnosis: 'Severe burns >30% TBSA', icd11Code: 'NE00', severity: 'critical', admittedBy: 'user-dr.wani', admittedByName: 'Dr. James Wani Igga', wardId: 'ward-5', wardName: 'ICU', bedId: 'bed-7', bedNumber: 'ICU-B01', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', attendingPhysician: 'user-dr.wani', attendingPhysicianName: 'Dr. James Wani Igga', isolationRequired: true, isolationReason: 'Burn wound infection control', status: 'admitted', followUpRequired: false, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { _id: 'admission-5', type: 'admission', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', hospitalNumber: 'JTH-000035', admissionDate: daysAgo(9), admittingDiagnosis: 'Pneumonia', icd11Code: 'CA40', severity: 'moderate', admittedBy: 'user-co.deng', admittedByName: 'CO Deng Mabior Kuol', wardId: 'ward-6', wardName: 'General Ward', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', attendingPhysician: 'user-co.deng', attendingPhysicianName: 'CO Deng Mabior Kuol', isolationRequired: false, status: 'discharged', dischargeDate: daysAgo(4), dischargeType: 'normal', dischargeDiagnosis: 'Resolved pneumonia', dischargedBy: 'user-co.deng', dischargedByName: 'CO Deng Mabior Kuol', followUpRequired: true, followUpDate: dateFromNow(3), lengthOfStay: 5, state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(9), updatedAt: daysAgo(4) },
  // Active inpatient at Wau State Hospital — pat-00063 already has same-day
  // outpatient follow-ups with CO Deng (appointment-25/appointment-34), so
  // this also exercises the inpatient-vs-outpatient split on the day-activity
  // chart (previously 0 inpatient at hosp-002, since admission-5 above is
  // discharged and every other admission is at hosp-001).
  { _id: 'admission-6', type: 'admission', patientId: 'pat-00063', patientName: 'Santino Madut', hospitalNumber: 'WSH-000010', admissionDate: daysAgo(2), admittingDiagnosis: 'Hypertensive urgency', icd11Code: 'BA02', severity: 'moderate', admittedBy: 'user-co.deng', admittedByName: 'CO Deng Mabior Kuol', wardId: 'ward-6', wardName: 'General Ward', bedId: 'bed-9', bedNumber: 'W6-B01', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', attendingPhysician: 'user-co.deng', attendingPhysicianName: 'CO Deng Mabior Kuol', nurseAssigned: 'user-nurse.wau', nurseAssignedName: 'Nurse Grace Achai Lual', isolationRequired: false, status: 'admitted', followUpRequired: false, state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(0) },
];

// Provider availability windows for TODAY (full-day) so the facility
// dashboard's Doctors panel shows "Available" status. Two of the doctors are
// left without a window so the panel shows a realistic Available/Unavailable mix.
const seedAvailability: Record<string, unknown>[] = [
  { providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga' },
  { providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng' },
  { providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol' },
].map((p, i) => ({
  _id: `availability-demo-${i + 1}`,
  type: 'availability',
  providerId: p.providerId,
  providerName: p.providerName,
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  date: dateAgo(0),
  startTime: '00:00',
  endTime: '23:59',
  slotMinutes: 30,
  modality: 'in_person',
  status: 'open',
  orgId: PUBLIC_ORG_ID,
  createdAt: daysAgo(0),
  updatedAt: daysAgo(0),
}));

// ═══ Pharmacy inventory seed data ═════════════════════════════════
const seedPharmacyInventory: Omit<PharmacyInventoryDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'inv-1', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'Artemether-Lumefantrine (Coartem)', category: 'Antimalarial', stockLevel: 1240, unit: 'tablets', reorderLevel: 400, batchNumber: 'CTM-2026-014', expiryDate: dateFromNow(420), lastReceived: daysAgo(20), lastDispensed: daysAgo(0), dispensedToday: 24, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(60), updatedAt: daysAgo(0) },
  { _id: 'inv-2', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'Paracetamol 500mg', category: 'Analgesic', stockLevel: 3200, unit: 'tablets', reorderLevel: 1000, batchNumber: 'PCM-2026-031', expiryDate: dateFromNow(300), lastReceived: daysAgo(15), lastDispensed: daysAgo(0), dispensedToday: 56, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(60), updatedAt: daysAgo(0) },
  { _id: 'inv-3', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'Amoxicillin 500mg', category: 'Antibiotic', stockLevel: 180, unit: 'capsules', reorderLevel: 500, batchNumber: 'AMX-2025-208', expiryDate: dateFromNow(120), lastReceived: daysAgo(40), lastDispensed: daysAgo(1), dispensedToday: 12, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(90), updatedAt: daysAgo(1) },
  { _id: 'inv-4', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'Ferrous Sulfate + Folic Acid', category: 'Supplement', stockLevel: 90, unit: 'tablets', reorderLevel: 300, batchNumber: 'FEF-2025-119', expiryDate: dateFromNow(200), lastReceived: daysAgo(50), lastDispensed: daysAgo(0), dispensedToday: 8, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(90), updatedAt: daysAgo(0) },
  { _id: 'inv-5', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'TDF/3TC/DTG', category: 'Antiretroviral', stockLevel: 640, unit: 'tablets', reorderLevel: 200, batchNumber: 'ARV-2026-007', expiryDate: dateFromNow(500), lastReceived: daysAgo(10), lastDispensed: daysAgo(2), dispensedToday: 4, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(60), updatedAt: daysAgo(2) },
  { _id: 'inv-6', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'Oral Rehydration Salts (ORS)', category: 'Rehydration', stockLevel: 420, unit: 'sachets', reorderLevel: 200, batchNumber: 'ORS-2026-022', expiryDate: dateFromNow(360), lastReceived: daysAgo(18), lastDispensed: daysAgo(0), dispensedToday: 18, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(60), updatedAt: daysAgo(0) },
  { _id: 'inv-7', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'Metformin 500mg', category: 'Antidiabetic', stockLevel: 60, unit: 'tablets', reorderLevel: 250, batchNumber: 'MET-2025-198', expiryDate: dateFromNow(90), lastReceived: daysAgo(60), lastDispensed: daysAgo(1), dispensedToday: 6, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(1) },
  { _id: 'inv-8', type: 'pharmacy_inventory', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', medicationName: 'Diazepam 5mg/mL injection', category: 'Sedative', stockLevel: 45, unit: 'vials', reorderLevel: 20, batchNumber: 'DZP-2026-003', expiryDate: dateFromNow(240), lastReceived: daysAgo(25), lastDispensed: daysAgo(3), dispensedToday: 1, controlledSchedule: 'IV', requiresWitness: true, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(60), updatedAt: daysAgo(3) },
  { _id: 'inv-9', type: 'pharmacy_inventory', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', medicationName: 'Ceftriaxone 1g injection', category: 'Antibiotic', stockLevel: 12, unit: 'vials', reorderLevel: 50, batchNumber: 'CFT-2025-077', expiryDate: dateFromNow(60), lastReceived: daysAgo(45), lastDispensed: daysAgo(0), dispensedToday: 3, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(90), updatedAt: daysAgo(0) },
  { _id: 'inv-10', type: 'pharmacy_inventory', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', medicationName: 'Magnesium Sulfate injection', category: 'Obstetric', stockLevel: 0, unit: 'vials', reorderLevel: 30, batchNumber: 'MGS-2025-041', expiryDate: dateFromNow(150), lastReceived: daysAgo(70), lastDispensed: daysAgo(6), dispensedToday: 0, orgId: PUBLIC_ORG_ID, createdAt: daysAgo(120), updatedAt: daysAgo(6) },
];

// ═══ Triage seed data ═════════════════════════════════════════════
const seedTriage: Omit<TriageDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'triage-1', type: 'triage', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', hospitalNumber: 'JTH-000030', airway: 'clear', breathing: 'distressed', circulation: 'impaired', consciousness: 'pain', priority: 'YELLOW', temperature: '38.6', pulse: '124', respiratoryRate: '28', systolic: '90', diastolic: '60', oxygenSaturation: '91', chiefComplaint: 'Burns and shortness of breath', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'admitted', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-2', type: 'triage', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', hospitalNumber: 'JTH-000022', airway: 'clear', breathing: 'normal', circulation: 'impaired', consciousness: 'alert', priority: 'YELLOW', temperature: '37.2', pulse: '110', respiratoryRate: '22', systolic: '95', diastolic: '62', oxygenSaturation: '95', chiefComplaint: 'Severe bone pain, pallor', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'admitted', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-3', type: 'triage', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', hospitalNumber: 'JTH-000001', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '37.8', pulse: '88', respiratoryRate: '18', systolic: '120', diastolic: '78', oxygenSaturation: '98', chiefComplaint: 'Fever and headache', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(1), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'seen', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'triage-4', type: 'triage', patientId: 'pat-00040', patientName: 'Majok Chol Wol', hospitalNumber: 'JTH-000040', airway: 'obstructed', breathing: 'absent', circulation: 'absent', consciousness: 'unresponsive', priority: 'RED', temperature: '36.0', pulse: '40', respiratoryRate: '6', systolic: '70', diastolic: '40', oxygenSaturation: '78', chiefComplaint: 'Collapsed, unresponsive', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-5', type: 'triage', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', hospitalNumber: 'JTH-000018', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '37.0', pulse: '82', respiratoryRate: '17', systolic: '128', diastolic: '84', oxygenSaturation: '99', chiefComplaint: 'High blood sugar review', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(2), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'discharged', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { _id: 'triage-6', type: 'triage', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', hospitalNumber: 'JTH-000035', airway: 'clear', breathing: 'distressed', circulation: 'normal', consciousness: 'alert', priority: 'YELLOW', temperature: '38.0', pulse: '96', respiratoryRate: '26', systolic: '118', diastolic: '76', oxygenSaturation: '93', chiefComplaint: 'Cough and difficulty breathing', triagedBy: 'user-co.deng', triagedByName: 'CO Deng Mabior Kuol', triagedAt: daysAgo(3), facilityId: 'hosp-002', facilityName: 'Wau State Hospital', status: 'referred', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  // ── Today's reception walk-ins (still WAITING / in consult) so the front-desk
  //    queue is populated on the seed day. ──
  { _id: 'triage-7', type: 'triage', patientId: 'pat-00004', patientName: 'Mary Nyandeng Lado', hospitalNumber: 'JTH-000004', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'YELLOW', temperature: '37.4', pulse: '92', respiratoryRate: '19', systolic: '142', diastolic: '90', oxygenSaturation: '97', chiefComplaint: 'High blood sugar and dizziness', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-8', type: 'triage', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', hospitalNumber: 'JTH-000005', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '36.8', pulse: '80', respiratoryRate: '17', systolic: '116', diastolic: '74', oxygenSaturation: '99', chiefComplaint: 'Antenatal check-in', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-9', type: 'triage', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', hospitalNumber: 'JTH-000012', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'YELLOW', temperature: '37.1', pulse: '86', respiratoryRate: '18', systolic: '124', diastolic: '80', oxygenSaturation: '98', chiefComplaint: 'HIV review, fatigue', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'seen', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-10', type: 'triage', patientId: 'pat-00015', patientName: 'Tut Chuol Both', hospitalNumber: 'JTH-000015', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '36.9', pulse: '84', respiratoryRate: '18', systolic: '122', diastolic: '78', oxygenSaturation: '98', chiefComplaint: 'Walk-in renal follow-up', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-11', type: 'triage', patientId: 'pat-00008', patientName: 'Ayen Dut Malual', hospitalNumber: 'JTH-000008', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'YELLOW', temperature: '37.6', pulse: '98', respiratoryRate: '20', systolic: '138', diastolic: '88', oxygenSaturation: '97', chiefComplaint: 'Walk-in refill request', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-12', type: 'triage', patientId: 'pat-00040', patientName: 'Majok Chol Wol', hospitalNumber: 'JTH-000040', airway: 'clear', breathing: 'normal', circulation: 'impaired', consciousness: 'alert', priority: 'RED', temperature: '38.9', pulse: '122', respiratoryRate: '24', systolic: '94', diastolic: '60', oxygenSaturation: '94', chiefComplaint: 'Walk-in abdominal pain and vomiting', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-13', type: 'triage', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', hospitalNumber: 'JTH-000018', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '36.7', pulse: '78', respiratoryRate: '17', systolic: '126', diastolic: '82', oxygenSaturation: '99', chiefComplaint: 'Walk-in glucose check', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  // ── Wau State Hospital (hosp-002) triage queue — so nurse.wau and CO Deng see
  // an active triage board, not an empty one. Patients are from the Wau roster.
  { _id: 'triage-w1', type: 'triage', patientId: 'pat-00063', patientName: 'Santino Madut', hospitalNumber: 'WSH-000010', airway: 'clear', breathing: 'distressed', circulation: 'impaired', consciousness: 'alert', priority: 'RED', temperature: '39.1', pulse: '128', respiratoryRate: '30', systolic: '88', diastolic: '58', oxygenSaturation: '89', chiefComplaint: 'Severe chest pain and breathlessness', triagedBy: 'user-nurse.wau', triagedByName: 'Nurse Grace Achai Lual', triagedAt: daysAgo(0), facilityId: 'hosp-002', facilityName: 'Wau State Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-w2', type: 'triage', patientId: 'pat-00064', patientName: 'Aluel Garang', hospitalNumber: 'WSH-000011', airway: 'clear', breathing: 'normal', circulation: 'impaired', consciousness: 'alert', priority: 'YELLOW', temperature: '38.2', pulse: '104', respiratoryRate: '22', systolic: '102', diastolic: '66', oxygenSaturation: '94', chiefComplaint: 'High fever, vomiting', triagedBy: 'user-nurse.wau', triagedByName: 'Nurse Grace Achai Lual', triagedAt: daysAgo(0), facilityId: 'hosp-002', facilityName: 'Wau State Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-w3', type: 'triage', patientId: 'pat-00065', patientName: 'Deng Wol', hospitalNumber: 'WSH-000012', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '37.2', pulse: '84', respiratoryRate: '18', systolic: '124', diastolic: '80', oxygenSaturation: '98', chiefComplaint: 'Routine hypertension review', triagedBy: 'user-nurse.wau', triagedByName: 'Nurse Grace Achai Lual', triagedAt: daysAgo(0), facilityId: 'hosp-002', facilityName: 'Wau State Hospital', status: 'seen', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-w4', type: 'triage', patientId: 'pat-00066', patientName: 'Nyibol Atem', hospitalNumber: 'WSH-000013', airway: 'clear', breathing: 'distressed', circulation: 'normal', consciousness: 'alert', priority: 'YELLOW', temperature: '38.5', pulse: '98', respiratoryRate: '26', systolic: '116', diastolic: '74', oxygenSaturation: '92', chiefComplaint: 'Productive cough, 5 days', triagedBy: 'user-nurse.wau', triagedByName: 'Nurse Grace Achai Lual', triagedAt: daysAgo(1), facilityId: 'hosp-002', facilityName: 'Wau State Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'triage-w5', type: 'triage', patientId: 'pat-00067', patientName: 'Mabior Deng', hospitalNumber: 'WSH-000014', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '37.0', pulse: '82', respiratoryRate: '18', systolic: '120', diastolic: '76', oxygenSaturation: '99', chiefComplaint: 'Walk-in prescription refill', triagedBy: 'user-nurse.wau', triagedByName: 'Nurse Grace Achai Lual', triagedAt: daysAgo(0), facilityId: 'hosp-002', facilityName: 'Wau State Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  // ── Malakal Teaching Hospital (hosp-003) triage queue — so nurse.stella and
  // midwife.nyakong see a live board. Patients are from the Malakal roster.
  { _id: 'triage-m1', type: 'triage', patientId: 'pat-00200', patientName: 'Gatwech Puok', hospitalNumber: 'MTH-000010', airway: 'clear', breathing: 'distressed', circulation: 'impaired', consciousness: 'pain', priority: 'RED', temperature: '39.4', pulse: '132', respiratoryRate: '32', systolic: '84', diastolic: '54', oxygenSaturation: '87', chiefComplaint: 'Convulsions, high fever (cerebral malaria?)', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-m2', type: 'triage', patientId: 'pat-00201', patientName: 'Nyakuoth Gatluak', hospitalNumber: 'MTH-000011', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'YELLOW', temperature: '37.9', pulse: '100', respiratoryRate: '20', systolic: '110', diastolic: '70', oxygenSaturation: '95', chiefComplaint: 'Abdominal pain in pregnancy', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  { _id: 'triage-m3', type: 'triage', patientId: 'pat-00202', patientName: 'Both Chuol', hospitalNumber: 'MTH-000012', airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert', priority: 'GREEN', temperature: '37.0', pulse: '78', respiratoryRate: '16', systolic: '122', diastolic: '78', oxygenSaturation: '99', chiefComplaint: 'Wound dressing follow-up', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(1), facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', status: 'seen', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'triage-m4', type: 'triage', patientId: 'pat-00203', patientName: 'Nyandeng Reath', hospitalNumber: 'MTH-000013', airway: 'clear', breathing: 'distressed', circulation: 'impaired', consciousness: 'alert', priority: 'YELLOW', temperature: '38.7', pulse: '112', respiratoryRate: '24', systolic: '100', diastolic: '64', oxygenSaturation: '91', chiefComplaint: 'Severe anaemia, fatigue', triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(0), facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', status: 'pending', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
];

// ═══ Asset / equipment seed data ══════════════════════════════════
const seedAssets: Omit<AssetDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'asset-1', type: 'asset', name: 'Ultrasound Machine', assetTag: 'JTH-EQ-001', serialNumber: 'USG-883422', category: 'imaging', manufacturer: 'Mindray', model: 'DC-30', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', department: 'Radiology', location: 'Imaging Room 1', status: 'operational', condition: 'good', acquiredDate: dateAgo(700), costCurrency: 'USD', cost: 18000, donor: 'WHO', warrantyExpiresAt: dateFromNow(120), lastServicedAt: dateAgo(60), nextServiceDueAt: dateFromNow(120), serviceIntervalMonths: 6, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(700), updatedAt: daysAgo(60) },
  { _id: 'asset-2', type: 'asset', name: 'X-Ray Machine', assetTag: 'JTH-EQ-002', serialNumber: 'XR-552190', category: 'imaging', manufacturer: 'Siemens', model: 'Multix', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', department: 'Radiology', location: 'Imaging Room 2', status: 'needs_service', condition: 'fair', acquiredDate: dateAgo(1500), costCurrency: 'USD', cost: 42000, donor: 'Procured', lastServicedAt: dateAgo(220), nextServiceDueAt: dateAgo(30), serviceIntervalMonths: 6, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1500), updatedAt: daysAgo(30) },
  { _id: 'asset-3', type: 'asset', name: 'Ambulance', assetTag: 'JTH-VH-001', serialNumber: 'TOY-AMB-7781', category: 'vehicle', manufacturer: 'Toyota', model: 'Land Cruiser', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', location: 'Garage', status: 'under_repair', condition: 'poor', acquiredDate: dateAgo(1200), costCurrency: 'USD', cost: 55000, donor: 'UNICEF', lastServicedAt: dateAgo(10), serviceIntervalMonths: 3, notes: 'Engine repair in progress', state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1200), updatedAt: daysAgo(10) },
  { _id: 'asset-4', type: 'asset', name: 'Vaccine Refrigerator', assetTag: 'JTH-CC-001', serialNumber: 'CC-FRG-2201', category: 'cold_chain', manufacturer: 'Haier', model: 'HBC-260', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', department: 'EPI', location: 'Cold Room', status: 'operational', condition: 'new', acquiredDate: dateAgo(200), costCurrency: 'USD', cost: 3200, donor: 'GAVI', warrantyExpiresAt: dateFromNow(500), lastServicedAt: dateAgo(30), nextServiceDueAt: dateFromNow(60), serviceIntervalMonths: 3, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(200), updatedAt: daysAgo(30) },
  { _id: 'asset-5', type: 'asset', name: 'Hematology Analyzer', assetTag: 'JTH-LAB-001', serialNumber: 'HEM-99812', category: 'lab', manufacturer: 'Sysmex', model: 'XN-330', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', department: 'Laboratory', location: 'Main Lab', status: 'operational', condition: 'good', acquiredDate: dateAgo(400), costCurrency: 'USD', cost: 22000, donor: 'Global Fund', warrantyExpiresAt: dateFromNow(330), lastServicedAt: dateAgo(45), nextServiceDueAt: dateFromNow(45), serviceIntervalMonths: 3, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(400), updatedAt: daysAgo(45) },
  { _id: 'asset-6', type: 'asset', name: 'Oxygen Concentrator', assetTag: 'JTH-UT-001', serialNumber: 'OXY-44120', category: 'utility', manufacturer: 'Philips', model: 'EverFlo', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', department: 'ICU', location: 'ICU', status: 'operational', condition: 'good', acquiredDate: dateAgo(300), costCurrency: 'USD', cost: 1500, donor: 'WHO', lastServicedAt: dateAgo(20), nextServiceDueAt: dateFromNow(70), serviceIntervalMonths: 3, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(300), updatedAt: daysAgo(20) },
  { _id: 'asset-7', type: 'asset', name: 'Backup Generator', assetTag: 'WSH-UT-001', serialNumber: 'GEN-77231', category: 'utility', manufacturer: 'Cummins', model: 'C90D5', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', facilityLevel: 'state', location: 'Generator House', status: 'decommissioned', condition: 'poor', acquiredDate: dateAgo(2200), costCurrency: 'USD', cost: 28000, donor: 'Procured', notes: 'Beyond economic repair', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2200), updatedAt: daysAgo(90) },
  { _id: 'asset-8', type: 'asset', name: 'Patient Monitor', assetTag: 'JTH-EQ-010', serialNumber: 'MON-30112', category: 'medical_equipment', manufacturer: 'Mindray', model: 'uMEC12', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national', department: 'ICU', location: 'ICU Bed 1', status: 'operational', condition: 'good', acquiredDate: dateAgo(250), costCurrency: 'USD', cost: 4800, donor: 'Global Fund', warrantyExpiresAt: dateFromNow(400), lastServicedAt: dateAgo(35), nextServiceDueAt: dateFromNow(55), serviceIntervalMonths: 3, state: 'Central Equatoria', county: 'Juba', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(250), updatedAt: daysAgo(35) },
];

// ═══ Leave request seed data ══════════════════════════════════════
const seedLeaveRequests: Omit<LeaveRequestDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'leave-1', type: 'leave_request', userId: 'user-nurse.stella', userName: 'Nurse Stella Keji Lemi', role: 'nurse', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', leaveType: 'annual', startDate: dateFromNow(10), endDate: dateFromNow(20), days: 11, reason: 'Family visit', status: 'pending', requestedAt: daysAgo(2), orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { _id: 'leave-2', type: 'leave_request', userId: 'user-lab.gatluak', userName: 'Lab Tech Gatluak Puok', role: 'lab_tech', facilityId: 'hosp-004', facilityName: 'Bentiu State Hospital', leaveType: 'sick', startDate: dateAgo(3), endDate: dateAgo(1), days: 3, reason: 'Malaria', status: 'approved', requestedAt: daysAgo(4), decidedAt: daysAgo(3), decidedBy: 'user-hrio.dut', decidedByName: 'Dut Machar Kuol', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(4), updatedAt: daysAgo(3) },
  { _id: 'leave-3', type: 'leave_request', userId: 'user-midwife.nyakong', userName: 'Midwife Nyakong Gatkuoth', role: 'midwife', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', leaveType: 'maternity', startDate: dateFromNow(30), endDate: dateFromNow(120), days: 91, reason: 'Maternity leave', status: 'approved', requestedAt: daysAgo(10), decidedAt: daysAgo(8), decidedBy: 'user-hrio.dut', decidedByName: 'Dut Machar Kuol', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(10), updatedAt: daysAgo(8) },
  { _id: 'leave-4', type: 'leave_request', userId: 'user-pharma.rose', userName: 'Pharmacist Rose Gbudue', role: 'pharmacist', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', leaveType: 'compassionate', startDate: dateAgo(6), endDate: dateAgo(4), days: 3, reason: 'Bereavement', status: 'taken', requestedAt: daysAgo(8), decidedAt: daysAgo(7), decidedBy: 'user-hrio.dut', decidedByName: 'Dut Machar Kuol', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(8), updatedAt: daysAgo(4) },
  { _id: 'leave-5', type: 'leave_request', userId: 'user-co.deng', userName: 'CO Deng Mabior Kuol', role: 'clinical_officer', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', leaveType: 'study', startDate: dateFromNow(40), endDate: dateFromNow(70), days: 31, reason: 'Diploma exams', status: 'rejected', requestedAt: daysAgo(5), decidedAt: daysAgo(4), decidedBy: 'user-hrio.dut', decidedByName: 'Dut Machar Kuol', decisionNotes: 'Critical staffing shortage this quarter', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(5), updatedAt: daysAgo(4) },
  { _id: 'leave-6', type: 'leave_request', userId: 'user-cashier.deng', userName: 'Deng Akec Ring', role: 'cashier', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', leaveType: 'annual', startDate: dateFromNow(2), endDate: dateFromNow(6), days: 5, reason: 'Personal', status: 'pending', requestedAt: daysAgo(1), orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
];

// ═══ Payroll seed data ════════════════════════════════════════════
const payrollPeriodCurrent = new Date(SEED_NOW).toISOString().slice(0, 7);
const payrollPeriodPrev = new Date(SEED_NOW - 30 * 86400000).toISOString().slice(0, 7);
const seedPayrollEntries: Omit<PayrollEntryDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'payroll-1', type: 'payroll_entry', userId: 'user-dr.wani', userName: 'Dr. James Wani Igga', role: 'doctor', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', period: payrollPeriodPrev, baseSalary: 120000, allowances: 30000, deductions: 22000, netPay: 128000, currency: 'SSP', status: 'paid', paidAt: daysAgo(28), paidBy: 'user-manager.aluel', paidByName: 'Aluel Bol Maker', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(33), updatedAt: daysAgo(28) },
  { _id: 'payroll-2', type: 'payroll_entry', userId: 'user-dr.achol', userName: 'Dr. Achol Mayen Deng', role: 'doctor', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', period: payrollPeriodPrev, baseSalary: 118000, allowances: 28000, deductions: 21000, netPay: 125000, currency: 'SSP', status: 'paid', paidAt: daysAgo(28), paidBy: 'user-manager.aluel', paidByName: 'Aluel Bol Maker', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(33), updatedAt: daysAgo(28) },
  { _id: 'payroll-3', type: 'payroll_entry', userId: 'user-nurse.stella', userName: 'Nurse Stella Keji Lemi', role: 'nurse', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', period: payrollPeriodPrev, baseSalary: 55000, allowances: 12000, deductions: 8000, netPay: 59000, currency: 'SSP', status: 'paid', paidAt: daysAgo(28), paidBy: 'user-manager.aluel', paidByName: 'Aluel Bol Maker', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(33), updatedAt: daysAgo(28) },
  { _id: 'payroll-4', type: 'payroll_entry', userId: 'user-pharma.rose', userName: 'Pharmacist Rose Gbudue', role: 'pharmacist', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', period: payrollPeriodPrev, baseSalary: 70000, allowances: 15000, deductions: 10000, netPay: 75000, currency: 'SSP', status: 'paid', paidAt: daysAgo(28), paidBy: 'user-manager.aluel', paidByName: 'Aluel Bol Maker', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(33), updatedAt: daysAgo(28) },
  { _id: 'payroll-5', type: 'payroll_entry', userId: 'user-dr.wani', userName: 'Dr. James Wani Igga', role: 'doctor', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', period: payrollPeriodCurrent, baseSalary: 120000, allowances: 30000, deductions: 22000, netPay: 128000, currency: 'SSP', status: 'approved', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { _id: 'payroll-6', type: 'payroll_entry', userId: 'user-dr.achol', userName: 'Dr. Achol Mayen Deng', role: 'doctor', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', period: payrollPeriodCurrent, baseSalary: 118000, allowances: 28000, deductions: 21000, netPay: 125000, currency: 'SSP', status: 'approved', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { _id: 'payroll-7', type: 'payroll_entry', userId: 'user-nurse.stella', userName: 'Nurse Stella Keji Lemi', role: 'nurse', facilityId: 'hosp-003', facilityName: 'Malakal Teaching Hospital', period: payrollPeriodCurrent, baseSalary: 55000, allowances: 12000, deductions: 8000, netPay: 59000, currency: 'SSP', status: 'draft', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { _id: 'payroll-8', type: 'payroll_entry', userId: 'user-co.deng', userName: 'CO Deng Mabior Kuol', role: 'clinical_officer', facilityId: 'hosp-002', facilityName: 'Wau State Hospital', period: payrollPeriodCurrent, baseSalary: 65000, allowances: 14000, deductions: 9000, netPay: 70000, currency: 'SSP', status: 'draft', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
];

// ═══ Problem-list seed data ═══════════════════════════════════════
const seedProblems: Omit<ProblemDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'problem-1', type: 'problem', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', name: 'Essential hypertension', icd11Code: 'BA00', status: 'chronic', onsetDate: dateAgo(900), severity: 'moderate', notes: 'On amlodipine. BP fairly controlled.', recordedBy: 'user-dr.wani', recordedByName: 'Dr. James Wani Igga', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(900), updatedAt: daysAgo(2) },
  { _id: 'problem-2', type: 'problem', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', name: 'Malaria (P. falciparum)', icd11Code: '1A40', status: 'active', onsetDate: dateAgo(3), severity: 'severe', notes: 'Currently admitted, on Coartem.', recordedBy: 'user-dr.wani', recordedByName: 'Dr. James Wani Igga', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(0) },
  { _id: 'problem-3', type: 'problem', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', name: 'HIV disease', icd11Code: '1C62', status: 'chronic', onsetDate: dateAgo(1400), severity: 'moderate', notes: 'On TDF/3TC/DTG. Adherent.', recordedBy: 'user-dr.wani', recordedByName: 'Dr. James Wani Igga', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1400), updatedAt: daysAgo(15) },
  { _id: 'problem-4', type: 'problem', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', name: 'Type 2 diabetes mellitus', icd11Code: '5A11', status: 'chronic', onsetDate: dateAgo(600), severity: 'moderate', notes: 'On metformin. Last fasting glucose elevated.', recordedBy: 'user-co.deng', recordedByName: 'CO Deng Mabior Kuol', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(600), updatedAt: daysAgo(5) },
  { _id: 'problem-5', type: 'problem', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', name: 'Sickle cell disease', icd11Code: '3A51', status: 'chronic', onsetDate: dateAgo(3000), severity: 'severe', notes: 'Recurrent crises. Currently admitted for transfusion.', recordedBy: 'user-dr.achol', recordedByName: 'Dr. Achol Mayen Deng', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3000), updatedAt: daysAgo(2) },
  { _id: 'problem-6', type: 'problem', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', name: 'Community-acquired pneumonia', icd11Code: 'CA40', status: 'resolved', onsetDate: dateAgo(9), resolvedDate: dateAgo(4), severity: 'moderate', notes: 'Treated with antibiotics, recovered.', recordedBy: 'user-co.deng', recordedByName: 'CO Deng Mabior Kuol', hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(9), updatedAt: daysAgo(4) },
  { _id: 'problem-7', type: 'problem', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', name: 'Burns >30% TBSA', icd11Code: 'NE00', status: 'active', onsetDate: dateAgo(2), severity: 'severe', notes: 'ICU admission, isolation for infection control.', recordedBy: 'user-dr.wani', recordedByName: 'Dr. James Wani Igga', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(0) },
];

// ═══ Telehealth session seed data ═════════════════════════════════
const seedTelehealth: Omit<TelehealthSessionDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'telehealth-1', type: 'telehealth_session', appointmentId: 'appointment-3', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', patientPhone: '+211912555012', providerId: 'user-dr.mercy', providerName: 'Dr. Grace Lado', providerRole: 'doctor', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', sessionType: 'video', scheduledDate: dateFromNow(2), scheduledTime: '14:00', status: 'scheduled', roomId: 'room-th-001', joinUrl: 'https://telehealth.tamamhealth.org/join/room-th-001', chiefComplaint: 'HIV follow-up consultation', followUpRequired: false, referralRequired: false, connectionDrops: 0, patientConsentGiven: true, consentTimestamp: daysAgo(1), sessionRecorded: false, consultationFee: 5000, currency: 'SSP', paymentStatus: 'pending', state: 'Central Equatoria', county: 'Juba', orgId: PRIVATE_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { _id: 'telehealth-2', type: 'telehealth_session', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211912555018', providerId: 'user-dr.mercy', providerName: 'Dr. Grace Lado', providerRole: 'doctor', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', sessionType: 'video', scheduledDate: dateAgo(3), scheduledTime: '10:00', actualStartTime: daysAgo(3), actualEndTime: daysAgo(3), duration: 22, status: 'completed', roomId: 'room-th-002', chiefComplaint: 'Diabetes management review', clinicalNotes: 'Reviewed glucose logs, adjusted metformin dose.', diagnosis: 'Type 2 diabetes mellitus', icd10Code: 'E11', followUpRequired: true, followUpDate: dateFromNow(14), referralRequired: false, sessionQuality: 'good', connectionDrops: 1, patientConsentGiven: true, consentTimestamp: daysAgo(3), sessionRecorded: false, patientRating: 5, patientFeedback: 'Very convenient.', consultationFee: 5000, currency: 'SSP', paymentStatus: 'paid', state: 'Western Bahr el Ghazal', county: 'Wau', orgId: PRIVATE_ORG_ID, createdAt: daysAgo(4), updatedAt: daysAgo(3) },
  { _id: 'telehealth-3', type: 'telehealth_session', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', patientPhone: '+211912345678', providerId: 'user-dr.mercy', providerName: 'Dr. Grace Lado', providerRole: 'doctor', facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', sessionType: 'audio', scheduledDate: dateAgo(0), scheduledTime: '16:00', status: 'waiting_room', roomId: 'room-th-003', chiefComplaint: 'Hypertension medication review', followUpRequired: false, referralRequired: false, connectionDrops: 0, patientConsentGiven: true, consentTimestamp: daysAgo(0), sessionRecorded: false, consultationFee: 3000, currency: 'SSP', paymentStatus: 'paid', state: 'Central Equatoria', county: 'Juba', orgId: PRIVATE_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
];

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

/**
 * Production seed: creates only the initial super admin user and a default organization.
 * No demo patients, no sample records — a clean slate for real hospital data.
 */
async function seedProduction(): Promise<void> {
  await resetAllDatabases();
  const now = new Date().toISOString();

  // Create default organization
  const orgDB = organizationsDB();
  await safePut(orgDB, {
    _id: 'org-default',
    type: 'organization',
    name: process.env.NEXT_PUBLIC_ORG_NAME || 'My Organization',
    slug: 'default',
    primaryColor: BRAND_PRIMARY,
    secondaryColor: BRAND_SECONDARY,
    accentColor: BRAND_PRIMARY,
    subscriptionStatus: 'active',
    subscriptionPlan: 'enterprise',
    maxUsers: 500,
    maxHospitals: 100,
    featureFlags: {
      epidemicIntelligence: true,
      mchAnalytics: true,
      dhis2Export: true,
      aiClinicalSupport: true,
      communityHealth: true,
      facilityAssessments: true,
    },
    orgType: 'public',
    contactEmail: process.env.NEXT_PUBLIC_ORG_EMAIL || 'support.tamam@gmail.com',
    country: process.env.NEXT_PUBLIC_ORG_COUNTRY || 'South Sudan',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Create initial super admin. The plaintext lives only on the server in
  // .seed-credentials.json — fetched here so the local PouchDB hash matches
  // what the server-side login endpoint expects.
  const db = usersDB();
  const cred = await fetchAdminCredential();
  if (!cred) {
    throw new Error(
      '[db-seed] could not fetch admin credential from /api/demo-credentials. ' +
      'Set ADMIN_INITIAL_PASSWORD on the server or check that the credentials file is writable.',
    );
  }
  const hash = await hashPassword(cred.password);
  await safePut(db, {
    _id: 'user-admin',
    type: 'user',
    username: 'admin',
    passwordHash: hash,
    name: process.env.NEXT_PUBLIC_ADMIN_NAME || 'System Administrator',
    role: 'super_admin',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

// ═══ Patient-photo migration ══════════════════════════════════════
// The mock patient list got a `photoUrl` field after the initial seed was
// already written to PouchDB, so previously-seeded records have no photo
// and the UI falls back to initials ("DG"). This migration merges the
// photoUrl from the in-memory mock into each patient doc that's missing
// one. Idempotent: safe to run on every app start.
//
// Production-mode installs never hold mock-IDed patients, so the migration
// is gated on IS_DEMO — this also keeps the 88 KB mock import out of the
// production bundle.
async function migratePatientPhotos(): Promise<void> {
  if (!IS_DEMO) return;
  try {
    const { patients } = await import('@/data/mock');
    const pDB = patientsDB();
    const photoById = new Map<string, string>();
    for (const p of patients) {
      if (p.photoUrl) photoById.set(p.id, p.photoUrl);
    }
    if (photoById.size === 0) return;
    const res = await pDB.allDocs({ include_docs: true });
    const updates: Record<string, unknown>[] = [];
    for (const row of res.rows) {
      const doc = row.doc as (PatientDoc & { _rev: string }) | null;
      if (!doc) continue;
      if ((doc as { photoUrl?: string }).photoUrl) continue;
      const photo = photoById.get(doc._id);
      if (!photo) continue;
      updates.push({ ...doc, photoUrl: photo, updatedAt: new Date().toISOString() });
    }
    if (updates.length > 0) {
      await pDB.bulkDocs(updates as unknown as PouchDB.Core.PutDocument<object>[]);
    }
  } catch (err) {
    // Migration is best-effort — never block app boot on a failure here.
    console.warn('[db-seed] patient photo migration failed', err);
  }
}

async function migrateDemoAppointmentsAndWalkins(): Promise<void> {
  if (!IS_DEMO) return;
  try {
    const apptDB = appointmentsDB();
    const trDB = triageDB();
    const demoAppointments = seedAppointments.filter((a) =>
      ['appointment-30', 'appointment-31', 'appointment-32', 'appointment-33', 'appointment-34', 'appointment-35'].includes(a._id)
    );
    const demoWalkIns = seedTriage.filter((t) =>
      ['triage-10', 'triage-11', 'triage-12', 'triage-13', 'triage-w5'].includes(t._id)
    );

    for (const appt of demoAppointments) {
      await safePut(apptDB, appt as unknown as Record<string, unknown>);
    }
    for (const triage of demoWalkIns) {
      await safePut(trDB, triage as unknown as Record<string, unknown>);
    }
  } catch (err) {
    console.warn('[db-seed] demo appointment migration failed', err);
  }
}

// Service price catalog — drives the org-admin Service Pricing page and the
// "pick a service" amount selector in Collect Payment. Seeded for both orgs.
const feeScheduleBase: { category: ChargeCategory; serviceCode: string; serviceName: string; unitPrice: number }[] = [
  { category: 'consultation', serviceCode: 'CONS-GEN', serviceName: 'General consultation', unitPrice: 5000 },
  { category: 'consultation', serviceCode: 'CONS-SPEC', serviceName: 'Specialist consultation', unitPrice: 12000 },
  { category: 'laboratory', serviceCode: 'LAB-MAL', serviceName: 'Malaria RDT', unitPrice: 2000 },
  { category: 'laboratory', serviceCode: 'LAB-FBC', serviceName: 'Full Blood Count', unitPrice: 3500 },
  { category: 'laboratory', serviceCode: 'LAB-UA', serviceName: 'Urinalysis', unitPrice: 1500 },
  { category: 'radiology', serviceCode: 'RAD-XR', serviceName: 'X-ray', unitPrice: 15000 },
  { category: 'pharmacy', serviceCode: 'PH-DISP', serviceName: 'Medication dispensing', unitPrice: 1000 },
  { category: 'procedure', serviceCode: 'PROC-DRESS', serviceName: 'Wound dressing', unitPrice: 4000 },
  { category: 'bed_charge', serviceCode: 'BED-GEN', serviceName: 'General ward bed (per night)', unitPrice: 8000 },
];

// Billing invoices so the checkout/billing screens show real charged amounts
// (instead of "Charged: SSP 0") and a mix of paid / partial / unpaid accounts.
const seedBills: Omit<BillingDoc, '_rev'>[] = [
  {
    _id: 'bill-001', type: 'billing',
    patientId: 'pat-00001', patientName: 'Deng Mabior Garang', hospitalNumber: 'JTH-000001',
    facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national',
    encounterDate: dateAgo(3), encounterId: 'enc-pay-001',
    items: [
      { id: 'li-001a', category: 'consultation', description: 'General consultation', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
      { id: 'li-001b', category: 'laboratory', description: 'Malaria RDT', quantity: 1, unitPrice: 2000, totalPrice: 2000 },
    ],
    subtotal: 7000, discount: 0, taxRate: 0, taxAmount: 0, totalAmount: 7000,
    amountPaid: 7000, balanceDue: 0, currency: 'SSP', payments: [],
    status: 'paid', generatedBy: 'user-cashier.deng', generatedByName: 'Deng Akec Ring',
    invoiceNumber: 'INV-20260607-0001', state: 'Central Equatoria', county: 'Juba',
    orgId: PUBLIC_ORG_ID, createdAt: daysAgo(3), updatedAt: daysAgo(3),
  },
  {
    _id: 'bill-002', type: 'billing',
    patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', hospitalNumber: 'JTH-000005',
    facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national',
    encounterDate: dateAgo(1), encounterId: 'enc-pay-002',
    items: [
      { id: 'li-002a', category: 'consultation', description: 'Specialist consultation', quantity: 1, unitPrice: 12000, totalPrice: 12000 },
      { id: 'li-002b', category: 'radiology', description: 'X-ray', quantity: 1, unitPrice: 15000, totalPrice: 15000 },
    ],
    subtotal: 27000, discount: 0, taxRate: 0, taxAmount: 0, totalAmount: 27000,
    amountPaid: 10000, balanceDue: 17000, currency: 'SSP', payments: [],
    status: 'partial', generatedBy: 'user-cashier.deng', generatedByName: 'Deng Akec Ring',
    invoiceNumber: 'INV-20260609-0002', state: 'Central Equatoria', county: 'Juba',
    orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1),
  },
  {
    _id: 'bill-003', type: 'billing',
    patientId: 'pat-00040', patientName: 'Akon Deng', hospitalNumber: 'JTH-000040',
    facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national',
    encounterDate: dateAgo(0), encounterId: 'enc-pay-003',
    items: [
      { id: 'li-003a', category: 'consultation', description: 'General consultation', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
      { id: 'li-003b', category: 'procedure', description: 'Wound dressing', quantity: 2, unitPrice: 4000, totalPrice: 8000 },
    ],
    subtotal: 13000, discount: 0, taxRate: 0, taxAmount: 0, totalAmount: 13000,
    amountPaid: 0, balanceDue: 13000, currency: 'SSP', payments: [],
    status: 'pending', generatedBy: 'user-cashier.deng', generatedByName: 'Deng Akec Ring',
    invoiceNumber: 'INV-20260610-0003', state: 'Central Equatoria', county: 'Juba',
    orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0),
  },
];

export async function seedDatabase(): Promise<void> {
  if (await isSeeded()) {
    // Run photo migration on already-seeded databases so existing installs
    // pick up the new photoUrl field without requiring a reset.
    await migratePatientPhotos();
    await migrateDemoAppointmentsAndWalkins();
    return;
  }

  // Production mode: only create initial admin + organization
  if (!IS_DEMO) {
    await seedProduction();
    await markSeeded();
    return;
  }

  // Demo mode: full seed with sample data.
  // Mock data is 88 KB of fake PHI — pulled in dynamically here so the
  // production bundle never ships it.
  const { hospitals, patients, referrals, diseaseAlerts, generateMedicalRecords } =
    await import('@/data/mock');
  // Stale or missing seed — wipe all databases and re-seed fresh. But when a
  // seed at THIS version was interrupted (hard reload mid-seed), resume it
  // instead: every write below is a skip-if-exists put, so re-running only
  // fills the gaps. Wiping again would re-open the interruption window and is
  // how sessions ended up with randomly empty modules.
  if (!(await isSeedInProgress())) {
    await resetAllDatabases();
    await markSeedStarted();
  }

  const now = new Date().toISOString();

  // Seed organizations
  const orgDB = organizationsDB();
  for (const org of defaultOrganizations) {
    await safePut(orgDB, org as unknown as Record<string, unknown>);
  }

  // Seed users. Plaintext passwords for the demo accounts live only on the
  // server (see lib/seed-credentials.ts); fetch them once and hash locally
  // so the offline-fallback PouchDB login path verifies the same plaintext
  // the server-side login endpoint accepts.
  const credentials = await fetchDemoCredentials();
  const db = usersDB();
  let userIdx = 0;
  for (const u of defaultUsers) {
    const plaintext = credentials[u.username];
    if (!plaintext) {
      console.warn(`[db-seed] skipping ${u.username} — no credential returned by /api/demo-credentials`);
      continue;
    }
    const hash = await hashPassword(plaintext);
    userIdx += 1;
    const profile = ROLE_PROFILE[u.role];
    // Canonical South Sudan staff phone: +211 921 000 0NN (national number is
    // 9 digits beginning with 9), unique per seeded user.
    const phone = `+2119210000${String(userIdx).padStart(2, '0')}`;
    const doc: UserDoc = {
      _id: `user-${u.username}`,
      type: 'user',
      username: u.username,
      passwordHash: hash,
      name: u.name,
      role: u.role,
      hospitalId: u.hospitalId,
      hospitalName: u.hospitalName,
      orgId: u.orgId,
      department: profile?.department,
      specialty: profile?.specialty,
      phone,
      presence: 'active',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await safePut(db, doc as unknown as Record<string, unknown>);
  }

  // Seed hospitals (all public org by default)
  const hDB = hospitalsDB();
  for (const h of hospitals) {
    const doc: HospitalDoc = {
      _id: h.id,
      type: 'hospital',
      facilityType: h.type,
      ...Object.fromEntries(Object.entries(h).filter(([k]) => k !== 'id' && k !== 'type')),
      orgId: PUBLIC_ORG_ID,
      createdAt: now,
      updatedAt: now,
    } as HospitalDoc;
    await safePut(hDB, doc as unknown as Record<string, unknown>);
  }

  // Seed private org hospital
  await safePut(hDB, {
    _id: 'hosp-mercy-001', type: 'hospital', facilityType: 'state_hospital',
    name: 'Mercy General Hospital', state: 'Central Equatoria', location: 'Juba',
    town: 'Juba', beds: 120, totalBeds: 120, icuBeds: 8, maternityBeds: 20,
    staff: 45, doctors: 12, nurses: 20, clinicalOfficers: 5, labTechs: 3, pharmacists: 2,
    specialists: [], services: ['Emergency', 'Outpatient', 'Inpatient', 'Laboratory', 'Pharmacy'],
    equipment: ['X-ray', 'Ultrasound'], ambulances: 1, hasBloodBank: false,
    syncStatus: 'online', lastSync: now, patientCount: 0, todayVisits: 0,
    operatingStatus: 'operational', orgId: PRIVATE_ORG_ID,
    createdAt: now, updatedAt: now,
  } as unknown as Record<string, unknown>);

  // Sample nurse → doctor care assignments so the "assigned to you" worklist
  // (clinician dashboard) and the nurse's reassign control have demo data.
  // Keyed by patient id; all assigned by the seeded nurse to hosp-001 doctors.
  const careAssignments: Record<string, { doctorId: string; doctorName: string; note?: string; assignedBy?: string; assignedByName?: string }> = {
    'pat-00001': { doctorId: 'user-dr.wani', doctorName: 'Dr. James Wani Igga', note: 'Febrile, ?malaria — please review this morning' },
    'pat-00022': { doctorId: 'user-dr.wani', doctorName: 'Dr. James Wani Igga', note: 'Severe anaemia / sickle cell crisis — admitted, needs review' },
    'pat-00030': { doctorId: 'user-dr.wani', doctorName: 'Dr. James Wani Igga', note: 'Burns >30% TBSA in ICU — urgent' },
    'pat-00012': { doctorId: 'user-dr.achol', doctorName: 'Dr. Achol Mayen Deng', note: 'HIV / CD4 review due' },
    'pat-00040': { doctorId: 'user-dr.achol', doctorName: 'Dr. Achol Mayen Deng', note: 'Abdominal pain — awaiting work-up' },
    // Clinical Officer worklist (CO Deng, Wau State Hospital / hosp-002). These
    // are Wau-registered patients so they pass the CO's facility scope and
    // populate the "Patients assigned to you" board end-to-end.
    'pat-00002': { doctorId: 'user-co.deng', doctorName: 'CO Deng Mabior Kuol', note: 'New fever + cough — assess and start work-up', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
    'pat-00006': { doctorId: 'user-co.deng', doctorName: 'CO Deng Mabior Kuol', note: 'Hypertension review — BP high at triage', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
    'pat-00010': { doctorId: 'user-co.deng', doctorName: 'CO Deng Mabior Kuol', note: 'Diabetic foot — wound check and dressing', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
    'pat-00014': { doctorId: 'user-co.deng', doctorName: 'CO Deng Mabior Kuol', note: 'Antenatal visit — routine ANC review', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
    'pat-00018': { doctorId: 'user-co.deng', doctorName: 'CO Deng Mabior Kuol', note: 'Persistent diarrhoea — assess dehydration', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
    'pat-00026': { doctorId: 'user-co.deng', doctorName: 'CO Deng Mabior Kuol', note: 'Follow-up after malaria treatment', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
    // Doctor worklists — Juba Teaching Hospital (hosp-001) patients so the
    // assigned patients pass each doctor's facility scope and populate their
    // "Patients assigned to you" board. (The five entries above at hosp-002/004
    // were registered off-facility and so never surfaced on the Juba doctors'
    // boards; these Juba-registered patients fix that end-to-end.)
    'pat-00005': { doctorId: 'user-dr.wani', doctorName: 'Dr. James Wani Igga', note: 'Chest pain — review ECG this morning' },
    'pat-00009': { doctorId: 'user-dr.wani', doctorName: 'Dr. James Wani Igga', note: 'Poorly controlled diabetes — medication review' },
    'pat-00013': { doctorId: 'user-dr.achol', doctorName: 'Dr. Achol Mayen Deng', note: 'Postnatal review — check BP and bleeding' },
    'pat-00017': { doctorId: 'user-dr.achol', doctorName: 'Dr. Achol Mayen Deng', note: 'TB follow-up — sputum result back' },
    // Clinician worklist (Dr. Peter Garang Deng, hosp-001).
    'pat-00021': { doctorId: 'user-clinician.peter', doctorName: 'Dr. Peter Garang Deng', note: 'New OPD consult — abdominal pain' },
    'pat-00025': { doctorId: 'user-clinician.peter', doctorName: 'Dr. Peter Garang Deng', note: 'Wound review — surgical follow-up' },
    // Wau doctor worklist (Dr. Mary Akuol Deng, hosp-002).
    'pat-00034': { doctorId: 'user-dr.wau', doctorName: 'Dr. Mary Akuol Deng', note: 'Severe malaria — review response to treatment', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
    'pat-00038': { doctorId: 'user-dr.wau', doctorName: 'Dr. Mary Akuol Deng', note: 'Pneumonia — reassess before discharge', assignedBy: 'user-nurse.wau', assignedByName: 'Nurse Grace Achai Lual' },
  };

  // Demo-only clinical chart extras (structured allergies, directives, care
  // alerts) for a couple of well-known Juba patients so the new chart panels
  // show realistic content. Keyed by deterministic patient id.
  const DEMO_CLINICAL_EXTRAS: Record<string, {
    structuredAllergies?: AllergyEntry[];
    directives?: DirectiveEntry[];
    careAlerts?: CareAlertEntry[];
  }> = {
    'pat-00012': {
      structuredAllergies: [
        { id: 'alg-demo-1', substance: 'Penicillin', classification: 'drug', criticality: 'severe', reaction: 'Anaphylaxis', onsetDate: '2019-03-10', status: 'active', recordedByName: 'Dr. Achol Mayen Deng', recordedAt: now },
        { id: 'alg-demo-2', substance: 'Sulfa drugs', classification: 'drug', criticality: 'moderate', reaction: 'Urticarial rash', status: 'active', recordedByName: 'Dr. Achol Mayen Deng', recordedAt: now },
      ],
      careAlerts: [
        { id: 'ca-demo-1', category: 'clinical_risk', message: 'Severe penicillin allergy (anaphylaxis) — avoid all beta-lactams.', priority: 'high', status: 'active', recordedByName: 'Dr. Achol Mayen Deng', recordedAt: now },
      ],
      directives: [
        { id: 'dir-demo-1', type: 'informed_consent', description: 'General consent to treat — signed at registration.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Amira Juma Hassan', recordedAt: now },
      ],
    },
    'pat-00040': {
      careAlerts: [
        { id: 'ca-demo-2', category: 'safety', message: 'High fall risk — assist with ambulation.', priority: 'high', status: 'active', recordedByName: 'Nurse Stella Keji Lemi', recordedAt: now },
      ],
      directives: [
        { id: 'dir-demo-2', type: 'privacy_consent', description: 'Patient prefers phone calls only — no SMS reminders.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Amira Juma Hassan', recordedAt: now },
      ],
    },
  };

  // Demo-only shared sample chart data. Applied to every patient that doesn't
  // have its own DEMO_CLINICAL_EXTRAS, so the chart-summary Allergies &
  // Directives windows are always populated (and long enough to scroll).
  const SAMPLE_ALLERGIES: AllergyEntry[] = [
    { id: 'alg-sample-1', substance: 'Penicillin', classification: 'drug', criticality: 'severe', reaction: 'Anaphylaxis', onsetDate: '2018-06-12', status: 'active', recordedByName: 'Dr. James Wani Igga', recordedAt: now },
    { id: 'alg-sample-2', substance: 'Sulfa drugs', classification: 'drug', criticality: 'moderate', reaction: 'Urticarial rash', status: 'active', recordedByName: 'Dr. James Wani Igga', recordedAt: now },
    { id: 'alg-sample-3', substance: 'Aspirin', classification: 'drug', criticality: 'moderate', reaction: 'Wheezing / bronchospasm', status: 'active', recordedByName: 'CO Deng Mabior Kuol', recordedAt: now },
    { id: 'alg-sample-4', substance: 'Peanuts', classification: 'food', criticality: 'severe', reaction: 'Lip swelling, throat tightness', status: 'active', recordedByName: 'Nurse Stella Keji Lemi', recordedAt: now },
    { id: 'alg-sample-5', substance: 'Latex', classification: 'environmental', criticality: 'mild', reaction: 'Contact dermatitis', status: 'active', recordedByName: 'Nurse Stella Keji Lemi', recordedAt: now },
    { id: 'alg-sample-6', substance: 'Iodine contrast', classification: 'drug', criticality: 'moderate', reaction: 'Hives during imaging', status: 'active', recordedByName: 'Dr. Achol Mayen Deng', recordedAt: now },
    { id: 'alg-sample-7', substance: 'Shellfish', classification: 'food', criticality: 'mild', reaction: 'Nausea', status: 'active', recordedByName: 'CO Deng Mabior Kuol', recordedAt: now },
  ];
  const SAMPLE_DIRECTIVES: DirectiveEntry[] = [
    { id: 'dir-sample-1', type: 'informed_consent', description: 'General consent to treat — signed at registration.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Amira Juma Hassan', recordedAt: now },
    { id: 'dir-sample-2', type: 'privacy_consent', description: 'Consent to share records within the facility network.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Amira Juma Hassan', recordedAt: now },
    { id: 'dir-sample-3', type: 'advance_directive', description: 'Do-not-resuscitate (DNR) on file — reviewed with next of kin.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Dr. James Wani Igga', recordedAt: now },
    { id: 'dir-sample-4', type: 'release_of_information', description: 'Authorisation to release summary to referring clinic.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Amira Juma Hassan', recordedAt: now },
    { id: 'dir-sample-5', type: 'abn_noncovered', description: 'Advance beneficiary notice — ultrasound not covered.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Amira Juma Hassan', recordedAt: now },
    { id: 'dir-sample-6', type: 'privacy_consent', description: 'Patient prefers phone calls only — no SMS reminders.', startDate: now.slice(0, 10), status: 'active', recordedByName: 'Amira Juma Hassan', recordedAt: now },
  ];
  // Inject the shared sample set when a patient has none of its own. Demo-only.
  const withSampleChart = (doc: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...doc };
    if (!out.structuredAllergies) {
      out.structuredAllergies = SAMPLE_ALLERGIES;
      out.allergies = SAMPLE_ALLERGIES.filter((a) => a.status === 'active').map((a) => a.substance);
    }
    if (!out.directives) out.directives = SAMPLE_DIRECTIVES;
    return out;
  };

  // Seed patients (all public org by default)
  const pDB = patientsDB();
  for (let pIdx = 0; pIdx < patients.length; pIdx++) {
    const p = patients[pIdx];
    const assign = careAssignments[p.id];
    const extras = DEMO_CLINICAL_EXTRAS[p.id];
    const doc: PatientDoc = {
      _id: p.id,
      type: 'patient',
      ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'id')),
      ...(assign ? {
        assignedDoctor: assign.doctorId,
        assignedDoctorName: assign.doctorName,
        assignedAt: daysAgo(0),
        assignedBy: assign.assignedBy ?? 'user-nurse.stella',
        assignedByName: assign.assignedByName ?? 'Nurse Stella Keji Lemi',
        assignmentNote: assign.note,
      } : {}),
      ...(extras?.structuredAllergies ? {
        structuredAllergies: extras.structuredAllergies,
        // Keep the legacy mirror in sync with active substance names.
        allergies: extras.structuredAllergies.filter(a => a.status === 'active').map(a => a.substance),
      } : {}),
      ...(extras?.directives ? { directives: extras.directives } : {}),
      ...(extras?.careAlerts ? { careAlerts: extras.careAlerts } : {}),
      orgId: PUBLIC_ORG_ID,
      // Spread registration dates across the last week so the facility
      // dashboard's weekly "new patients" chart shows activity on each day.
      createdAt: daysAgo(pIdx % 7),
      updatedAt: now,
    } as PatientDoc;
    await safePut(pDB, withSampleChart(doc as unknown as Record<string, unknown>));
  }

  // Seed child patients (linked to immunization records)
  for (const child of childPatients) {
    await safePut(pDB, withSampleChart({ ...child, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>));
  }

  // Seed mother patients (linked to ANC records)
  for (const mother of motherPatients) {
    await safePut(pDB, withSampleChart({ ...mother, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>));
  }

  // Seed Wau State Hospital roster (Clinical Officer's panel). Patients assigned
  // to the CO also get an assignment timestamp + assigning nurse so the
  // dashboard worklist's "Admitted" and "Assigned Nurse" columns populate.
  for (const wp of wauPatients) {
    const assignment = wp.assignedDoctor
      ? {
          assignedAt: (wp.lastConsultedAt as string) || (wp.createdAt as string),
          assignedBy: 'user-nurse.wau',
          assignedByName: 'Nurse Grace Achai Lual',
        }
      : {};
    await safePut(pDB, withSampleChart({ ...wp, ...assignment, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>));
  }

  // Seed Malakal Teaching Hospital roster (hosp-003) so nurse.stella and
  // midwife.nyakong land on a populated ward, not an empty one.
  for (const mp of malakalPatients) {
    const assignment = mp.assignedDoctor
      ? {
          assignedAt: (mp.lastConsultedAt as string) || (mp.createdAt as string),
          assignedBy: 'user-nurse.stella',
          assignedByName: 'Nurse Stella Keji Lemi',
        }
      : {};
    await safePut(pDB, withSampleChart({ ...mp, ...assignment, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>));
  }

  // Seed phone notes (P1.4) — open callbacks routed to Juba doctors so the
  // "Patient callbacks" inbox and the chart Phone Notes panel show content.
  const phDB = phoneNotesDB();
  const demoPhoneNotes: PhoneNoteDoc[] = [
    {
      _id: 'phnote-demo-1', type: 'phone_note', patientId: 'pat-00012', patientName: 'Patient (demo)',
      callerName: 'Patient', callerPhone: '+211915000012', subject: 'Medication side-effect question',
      message: 'Reports mild nausea after starting new ARV regimen — asking if this is expected.',
      routedToId: 'user-dr.achol', routedToName: 'Dr. Achol Mayen Deng', status: 'open',
      recordedById: 'user-desk.amira', recordedByName: 'Amira Juma Hassan',
      hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(0), updatedAt: daysAgo(0),
    },
    {
      _id: 'phnote-demo-2', type: 'phone_note', patientId: 'pat-00040', patientName: 'Patient (demo)',
      callerName: 'Spouse', callerPhone: '+211915000040', subject: 'Follow-up appointment request',
      message: 'Abdominal pain improving; caller asks whether the follow-up visit is still needed this week.',
      routedToId: 'user-dr.achol', routedToName: 'Dr. Achol Mayen Deng', status: 'open',
      recordedById: 'user-desk.amira', recordedByName: 'Amira Juma Hassan',
      hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
  ];
  for (const n of demoPhoneNotes) {
    await safePut(phDB, n as unknown as Record<string, unknown>);
  }

  // Seed held outcome-measure assessments (P2.2) — entered by front desk,
  // awaiting provider review, so the signing inbox + chart panel show content.
  const asmtDB = assessmentsDB();
  const demoAssessments: AssessmentDoc[] = [
    {
      _id: 'asmt-demo-1', type: 'assessment', patientId: 'pat-00012', patientName: 'Patient (demo)',
      instrumentId: 'phq9', instrumentName: 'PHQ-9 (Depression)',
      answers: { q1: 2, q2: 2, q3: 2, q4: 2, q5: 1, q6: 1, q7: 1, q8: 0, q9: 0 },
      totalScore: 11, answeredCount: 9, questionCount: 9,
      interpretation: 'Moderate depression', severity: 'moderate',
      documentStatus: 'held', enteredById: 'user-desk.amira', enteredByName: 'Amira Juma Hassan',
      hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(0), updatedAt: daysAgo(0),
    },
    {
      _id: 'asmt-demo-2', type: 'assessment', patientId: 'pat-00040', patientName: 'Patient (demo)',
      instrumentId: 'gad7', instrumentName: 'GAD-7 (Anxiety)',
      answers: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 0, q6: 1, q7: 0 },
      totalScore: 5, answeredCount: 7, questionCount: 7,
      interpretation: 'Mild anxiety', severity: 'mild',
      documentStatus: 'held', enteredById: 'user-desk.amira', enteredByName: 'Amira Juma Hassan',
      hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
  ];
  for (const a of demoAssessments) {
    await safePut(asmtDB, a as unknown as Record<string, unknown>);
  }

  // Seed unsigned draft + awaiting-cosign records so the "Documents to sign"
  // worklist populates for demo doctors at Juba Teaching Hospital.
  const demoMrDB = medicalRecordsDB();
  const demoMedRecords: MedicalRecordDoc[] = [
    {
      _id: 'mr-demo-draft-1', type: 'medical_record',
      patientId: 'pat-00003', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
      visitDate: daysAgo(1).slice(0, 10), consultedAt: daysAgo(1),
      visitType: 'outpatient', providerName: 'Dr. James Wani Igga', providerRole: 'Doctor',
      department: 'General Medicine', chiefComplaint: 'Persistent cough and fever',
      historyOfPresentIllness: 'Patient presents with 5-day history of productive cough and fever.',
      vitalSigns: { temperature: '38.2', systolic: '118', diastolic: '76', pulse: '92', respiratoryRate: '18', oxygenSaturation: '96', weight: '68' },
      diagnoses: [{ code: 'J06.9', name: 'Acute upper respiratory infection', type: 'primary' }],
      prescriptions: [], labResults: [], treatmentPlan: 'Amoxicillin 500mg TID x 7 days.',
      documentStatus: 'draft', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1),
    } as unknown as MedicalRecordDoc,
    {
      _id: 'mr-demo-draft-2', type: 'medical_record',
      patientId: 'pat-00007', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
      visitDate: daysAgo(2).slice(0, 10), consultedAt: daysAgo(2),
      visitType: 'outpatient', providerName: 'Dr. Achol Mayen Deng', providerRole: 'Doctor',
      department: 'Obstetrics & Gynaecology', chiefComplaint: 'Antenatal visit — 28 weeks',
      historyOfPresentIllness: 'Routine ANC visit. No complaints.',
      vitalSigns: { temperature: '36.8', systolic: '112', diastolic: '70', pulse: '80', respiratoryRate: '16', oxygenSaturation: '99', weight: '72' },
      diagnoses: [{ code: 'Z34.2', name: 'Normal pregnancy — 28 weeks', type: 'primary' }],
      prescriptions: [], labResults: [], treatmentPlan: 'Iron + folic acid. Next ANC in 4 weeks.',
      documentStatus: 'draft', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2),
    } as unknown as MedicalRecordDoc,
    {
      _id: 'mr-demo-draft-3', type: 'medical_record',
      patientId: 'pat-00015', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
      visitDate: daysAgo(0).slice(0, 10), consultedAt: daysAgo(0),
      visitType: 'emergency', providerName: 'Dr. James Wani Igga', providerRole: 'Doctor',
      department: 'Emergency', chiefComplaint: 'Chest pain — 2 hours',
      historyOfPresentIllness: 'Acute onset central chest pain radiating to left arm.',
      vitalSigns: { temperature: '36.5', systolic: '145', diastolic: '92', pulse: '104', respiratoryRate: '20', oxygenSaturation: '94', weight: '80' },
      diagnoses: [{ code: 'I20.0', name: 'Unstable angina', type: 'primary' }],
      prescriptions: [], labResults: [], treatmentPlan: 'Aspirin, GTN, ECG monitoring. Cardiology review.',
      documentStatus: 'draft', orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0),
    } as unknown as MedicalRecordDoc,
    {
      _id: 'mr-demo-cosign-1', type: 'medical_record',
      patientId: 'pat-00012', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
      visitDate: daysAgo(1).slice(0, 10), consultedAt: daysAgo(1),
      visitType: 'outpatient', providerName: 'Intern Kuol Deng Majok', providerRole: 'Medical Intern',
      department: 'General Medicine', chiefComplaint: 'HIV follow-up — CD4 review',
      historyOfPresentIllness: 'Patient on ARVs, doing well. CD4 trending up.',
      vitalSigns: { temperature: '36.9', systolic: '120', diastolic: '78', pulse: '74', respiratoryRate: '14', oxygenSaturation: '98', weight: '65' },
      diagnoses: [{ code: 'B24', name: 'HIV disease', type: 'primary' }],
      prescriptions: [], labResults: [], treatmentPlan: 'Continue TDF/3TC/DTG. Repeat CD4 in 6 months.',
      documentStatus: 'awaiting_cosign',
      signedBy: 'user-intern.kuol', signedByName: 'Intern Kuol Deng Majok', signedByRole: 'Medical Intern',
      orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1),
    } as unknown as MedicalRecordDoc,
    {
      _id: 'mr-demo-cosign-2', type: 'medical_record',
      patientId: 'pat-00020', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
      visitDate: daysAgo(0).slice(0, 10), consultedAt: daysAgo(0),
      visitType: 'outpatient', providerName: 'Intern Aluel Bol Ring', providerRole: 'Medical Intern',
      department: 'Paediatrics', chiefComplaint: 'Malaria — follow-up day 3',
      historyOfPresentIllness: 'Child improving after Coartem. Fever resolved.',
      vitalSigns: { temperature: '37.0', systolic: '100', diastolic: '65', pulse: '88', respiratoryRate: '22', oxygenSaturation: '98', weight: '22' },
      diagnoses: [{ code: 'B54', name: 'Unspecified malaria', type: 'primary' }],
      prescriptions: [], labResults: [], treatmentPlan: 'Complete Coartem course. Review if fever returns.',
      documentStatus: 'awaiting_cosign',
      signedBy: 'user-intern.aluel', signedByName: 'Intern Aluel Bol Ring', signedByRole: 'Medical Intern',
      orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0),
    } as unknown as MedicalRecordDoc,
  ];
  for (const rec of demoMedRecords) {
    await safePut(demoMrDB, rec as unknown as Record<string, unknown>);
  }

  // Seed referrals (all public org)
  const rDB = referralsDB();
  for (const r of referrals) {
    const doc: ReferralDoc = {
      _id: r.id,
      type: 'referral',
      ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'id')),
      orgId: PUBLIC_ORG_ID,
      createdAt: now,
      updatedAt: now,
    } as ReferralDoc;
    await safePut(rDB, doc as unknown as Record<string, unknown>);
  }

  // Clinical Officer's own outgoing referrals (CO Deng, Wau / hosp-002). The
  // dashboard's "My Referrals" stat + "Open referrals" worklist filter on
  // `createdBy === currentUser._id`, which the mock referrals never set — so
  // without these the CO (and every clinician) shows zero. These give the CO a
  // populated referrals worklist end-to-end.
  const coReferrals = [
    {
      _id: 'ref-co-001', type: 'referral', patientId: 'pat-00063', patientName: 'Santino Madut',
      fromHospital: 'Wau State Hospital', fromHospitalId: 'hosp-002',
      toHospital: 'Juba Teaching Hospital', toHospitalId: 'hosp-001',
      referralDate: dateAgo(1), urgency: 'urgent',
      reason: 'Uncontrolled hypertension — cardiology review', department: 'Cardiology',
      status: 'sent', referringDoctor: 'CO Deng Mabior Kuol',
      notes: 'BP persistently >180/110 despite two agents; ECG changes.',
      createdBy: 'user-co.deng', createdByName: 'CO Deng Mabior Kuol',
      state: 'Western Bahr el Ghazal', county: 'Wau',
      orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(0),
    },
    {
      _id: 'ref-co-002', type: 'referral', patientId: 'pat-00064', patientName: 'Aluel Garang',
      fromHospital: 'Wau State Hospital', fromHospitalId: 'hosp-002',
      toHospital: 'Juba Teaching Hospital', toHospitalId: 'hosp-001',
      referralDate: dateAgo(0), urgency: 'routine',
      reason: 'Diabetic foot — surgical debridement assessment', department: 'Surgery',
      status: 'sent', referringDoctor: 'CO Deng Mabior Kuol',
      notes: 'Grade 2 ulcer, not healing on outpatient care.',
      createdBy: 'user-co.deng', createdByName: 'CO Deng Mabior Kuol',
      state: 'Western Bahr el Ghazal', county: 'Wau',
      orgId: PUBLIC_ORG_ID, createdAt: daysAgo(0), updatedAt: daysAgo(0),
    },
  ];
  for (const r of coReferrals) {
    await safePut(rDB, r as unknown as Record<string, unknown>);
  }

  // Seed patient intake forms (all public org) — the front-desk review queue
  // for forms patients submitted (or didn't) ahead of a visit.
  const intakeDB = intakeFormsDB();
  const intakeForms: PatientIntakeFormDoc[] = [
    {
      _id: 'intake-demo-01', type: 'patient_intake_form',
      patientId: 'pat-00057', patientName: 'Achol Mayen Garang', hospitalNumber: 'JTH-000057',
      providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga',
      status: 'pending_review',
      requestedAt: daysAgo(3), receivedAt: daysAgo(2),
      fields: [
        { label: 'Date of birth', value: '2002-03-15' },
        { label: 'Phone', value: '+211912555057' },
        { label: 'Address', value: 'Juba, Central Equatoria' },
        { label: 'Emergency contact', value: 'Mayen Garang (father) — +211912555099' },
        { label: 'Known allergies', value: 'Penicillin' },
        { label: 'Reason for visit', value: 'Follow-up on ongoing treatment' },
      ],
      hospitalId: 'hosp-001', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(3), updatedAt: daysAgo(2),
    },
    {
      _id: 'intake-demo-02', type: 'patient_intake_form',
      patientId: 'pat-00058', patientName: 'Nyakuoth Koang Jal', hospitalNumber: 'BSH-000003',
      providerId: 'user-nurse.wau', providerName: 'Nurse Grace Achai Lual',
      status: 'pending_review',
      requestedAt: daysAgo(6), receivedAt: daysAgo(5),
      fields: [
        { label: 'Date of birth', value: '1996-01-20' },
        { label: 'Phone', value: '+211912555058' },
        { label: 'Address', value: 'Rubkona, Unity' },
        { label: 'Emergency contact', value: 'Nyandeng Jal (sister) — +211912555098' },
        { label: 'Known allergies', value: 'None reported' },
        { label: 'Reason for visit', value: 'Antenatal check-up' },
      ],
      hospitalId: 'hosp-004', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(6), updatedAt: daysAgo(5),
    },
    {
      _id: 'intake-demo-03', type: 'patient_intake_form',
      patientId: 'pat-00059', patientName: 'Abuk Deng Mading', hospitalNumber: 'WSH-000002',
      providerId: 'user-co.deng', providerName: 'CO Deng Mabior Kuol',
      status: 'not_submitted',
      requestedAt: daysAgo(10),
      fields: [
        { label: 'Date of birth', value: '1994-06-10' },
        { label: 'Phone', value: '+211912555059' },
      ],
      hospitalId: 'hosp-002', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },
    {
      _id: 'intake-demo-04', type: 'patient_intake_form',
      patientId: 'pat-00060', patientName: 'Nyandit Dut Malual', hospitalNumber: 'MTH-000002',
      providerId: 'user-dr.wau', providerName: 'Dr. Mary Akuol Deng',
      status: 'merged',
      requestedAt: daysAgo(21), receivedAt: daysAgo(20), mergedAt: daysAgo(19), mergedBy: 'Grace Poni Lukudu',
      fields: [
        { label: 'Date of birth', value: '2000-08-05' },
        { label: 'Phone', value: '+211912555060' },
        { label: 'Address', value: 'Malakal, Upper Nile' },
      ],
      hospitalId: 'hosp-003', orgId: PUBLIC_ORG_ID,
      createdAt: daysAgo(21), updatedAt: daysAgo(19),
    },
  ];
  for (const doc of intakeForms) {
    await safePut(intakeDB, doc as unknown as Record<string, unknown>);
  }

  // Seed disease alerts (all public org). Spread reportDates across the last
  // ~8 weeks so the surveillance weekly-trend line buckets into multiple ISO
  // weeks instead of collapsing to a single point. Each base alert is
  // replicated across several weeks with jittered case counts so every
  // disease trends over time.
  const daDB = diseaseAlertsDB();
  // Offsets (in days) for 8 distinct weekly buckets, newest first.
  const alertWeekOffsets = [2, 9, 16, 23, 30, 37, 44, 51];
  let alertSeq = 0;
  for (const a of diseaseAlerts) {
    // Replicate each base alert across 4 recent weeks with varied counts.
    const weeks = [0, 1, 2, 3];
    for (const w of weeks) {
      alertSeq += 1;
      const offset = alertWeekOffsets[w] + (alertSeq % 3); // small jitter within the week
      // Trend the counts: older weeks lower, recent weeks reflect the alert's trend.
      const factor = a.trend === 'increasing'
        ? 0.6 + (3 - w) * 0.18
        : a.trend === 'decreasing'
          ? 0.6 + w * 0.18
          : 0.85 + ((alertSeq + w) % 3) * 0.08;
      const cases = Math.max(1, Math.round(a.cases * factor));
      const deaths = Math.round(a.deaths * factor);
      const doc: DiseaseAlertDoc = {
        _id: `${a.id}-w${w}`,
        type: 'disease_alert',
        ...Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'id')),
        cases,
        deaths,
        reportDate: dateAgo(offset),
        createdAt: daysAgo(offset),
        updatedAt: daysAgo(offset),
      } as DiseaseAlertDoc;
      await safePut(daDB, doc as unknown as Record<string, unknown>);
    }
  }

  // Seed lab results (all public org). Spread across the last ~10 days so the
  // lab dashboard's recent-activity list and turnaround trends populate.
  const lDB = labResultsDB();
  for (let i = 0; i < labOrders.length; i++) {
    const l = labOrders[i];
    const offset = i % 10;
    const order = daysAgo(offset);
    const done = l.status === 'completed' ? daysAgo(Math.max(0, offset - 0.04)) : '';
    await safePut(lDB, {
      ...l,
      orderedAt: order.replace('T', ' ').slice(0, 16),
      completedAt: done ? done.replace('T', ' ').slice(0, 16) : '',
      createdAt: order,
      updatedAt: done || order,
      orgId: PUBLIC_ORG_ID,
    } as unknown as Record<string, unknown>);
  }

  // Seed prescriptions (all public org). Spread across the last ~8 days so the
  // pharmacy queue + dispensing trend chart populate over multiple days.
  const rxDB = prescriptionsDB();
  for (let i = 0; i < prescriptionQueue.length; i++) {
    const rx = prescriptionQueue[i];
    const offset = i % 8;
    const created = daysAgo(offset);
    const dispensed = rx.status === 'dispensed' ? daysAgo(Math.max(0, offset - 0.02)) : undefined;
    await safePut(rxDB, {
      ...rx,
      createdAt: created,
      updatedAt: dispensed || created,
      ...(dispensed ? { dispensedAt: dispensed } : {}),
      orgId: PUBLIC_ORG_ID,
    } as unknown as Record<string, unknown>);
  }

  // ── Generated clinical activity for the extended roster (pat-00087+) ────────
  // Each new patient gets a lab order, prescription, appointment and triage
  // entry so they flow through the Lab, Pharmacy, Appointments and Triage lists
  // — not just the patient registry.
  {
    const extraPatients = patients.slice(50); // pat-00087..pat-00136
    const genApptDB = appointmentsDB();
    const genTrDB = triageDB();
    const GEN_TESTS = [
      { testName: 'Malaria RDT', specimen: 'Blood', result: 'Negative', ref: 'Negative', abnormal: false },
      { testName: 'Full Blood Count', specimen: 'Blood (EDTA)', result: 'Hb 11.8 g/dL, WBC 7.1×10³/μL', ref: '', abnormal: false },
      { testName: 'Blood Glucose (Fasting)', specimen: 'Blood', result: '92 mg/dL', ref: '70-100', abnormal: false },
      { testName: 'Urinalysis', specimen: 'Urine', result: 'Normal', ref: 'Normal', abnormal: false },
      { testName: 'HIV Rapid Test', specimen: 'Blood', result: 'Non-reactive', ref: 'Non-reactive', abnormal: false },
      { testName: 'Renal Function', specimen: 'Blood', result: 'Creatinine 0.9 mg/dL', ref: 'Cr 0.6-1.2', abnormal: false },
    ];
    const GEN_MEDS = [
      { medication: 'Amoxicillin', dose: '500mg TDS x 7 days', frequency: 'TDS', duration: '7 days' },
      { medication: 'Paracetamol', dose: '1g QDS PRN x 5 days', frequency: 'QDS PRN', duration: '5 days' },
      { medication: 'Artemether-Lumefantrine', dose: '80/480mg BD x 3 days', frequency: 'BD', duration: '3 days' },
      { medication: 'Metformin', dose: '500mg BD x 30 days', frequency: 'BD', duration: '30 days' },
      { medication: 'Ferrous Sulfate + Folic Acid', dose: '200mg OD x 30 days', frequency: 'OD', duration: '30 days' },
    ];
    const GEN_PROVIDERS = [
      { id: 'user-dr.wani', name: 'Dr. James Wani Igga' },
      { id: 'user-dr.achol', name: 'Dr. Achol Mayen Deng' },
      { id: 'user-co.deng', name: 'CO Deng Mabior Kuol' },
      // clinician.peter is the login picker's featured Juba doctor — without
      // him in the rotation his dashboard calendar shows no bookings at all.
      { id: 'user-clinician.peter', name: 'Dr. Peter Garang Deng' },
    ];
    const labStatuses = ['completed', 'in_progress', 'pending', 'completed', 'completed'];
    const apptStatuses = ['scheduled', 'confirmed', 'checked_in', 'completed', 'no_show'];
    const apptTypes = ['general', 'follow_up', 'specialist', 'lab', 'anc'];
    const triagePri = ['GREEN', 'YELLOW', 'GREEN', 'YELLOW', 'RED'];
    const triageStat = ['seen', 'pending', 'discharged', 'admitted', 'seen'];

    for (let i = 0; i < extraPatients.length; i++) {
      const p = extraPatients[i];
      const name = `${p.firstName} ${p.middleName ? p.middleName + ' ' : ''}${p.surname}`.replace(/\s+/g, ' ').trim();
      const prov = GEN_PROVIDERS[i % GEN_PROVIDERS.length];
      const tst = GEN_TESTS[i % GEN_TESTS.length];
      const labStatus = labStatuses[i % labStatuses.length];
      const labOrder = daysAgo(i % 9);
      const labDone = labStatus === 'completed' ? daysAgo(Math.max(0, (i % 9) - 0.04)) : '';
      await safePut(lDB, {
        _id: `lab-gen-${p.id}`, type: 'lab_result', patientId: p.id, patientName: name, hospitalNumber: p.hospitalNumber,
        testName: tst.testName, specimen: tst.specimen, status: labStatus,
        result: labStatus === 'completed' ? tst.result : '', unit: '', referenceRange: tst.ref,
        abnormal: labStatus === 'completed' ? tst.abnormal : false, critical: false,
        orderedBy: prov.name, orderedAt: labOrder.replace('T', ' ').slice(0, 16), completedAt: labDone ? labDone.replace('T', ' ').slice(0, 16) : '',
        hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
        createdAt: labOrder, updatedAt: labDone || labOrder, orgId: PUBLIC_ORG_ID,
      } as unknown as Record<string, unknown>);

      const med = GEN_MEDS[i % GEN_MEDS.length];
      const rxStatus = i % 3 === 0 ? 'dispensed' : 'pending';
      const rxCreated = daysAgo(i % 8);
      await safePut(rxDB, {
        _id: `rx-gen-${p.id}`, type: 'prescription', patientId: p.id, patientName: name,
        medication: med.medication, dose: med.dose, route: 'Oral', frequency: med.frequency, duration: med.duration,
        prescribedBy: prov.name, status: rxStatus,
        hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
        createdAt: rxCreated, updatedAt: rxCreated, ...(rxStatus === 'dispensed' ? { dispensedAt: rxCreated } : {}),
        orgId: PUBLIC_ORG_ID,
      } as unknown as Record<string, unknown>);

      const hh = String(8 + (i % 8)).padStart(2, '0');
      await safePut(genApptDB, {
        _id: `appointment-gen-${p.id}`, type: 'appointment', patientId: p.id, patientName: name, patientPhone: p.phone || '',
        providerId: prov.id, providerName: prov.name, facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national',
        appointmentDate: i % 2 === 0 ? dateFromNow((i % 14) + 1) : dateAgo(i % 10), appointmentTime: `${hh}:00`, endTime: `${hh}:30`, duration: 30,
        appointmentType: apptTypes[i % apptTypes.length], priority: 'routine', department: 'Outpatient', reason: 'Routine visit',
        status: apptStatuses[i % apptStatuses.length], reminderSent: false, isRecurring: false,
        bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan', state: p.state, county: p.county,
        orgId: PUBLIC_ORG_ID, createdAt: daysAgo((i % 14) + 1), updatedAt: daysAgo(i % 7),
      } as unknown as Record<string, unknown>);

      await safePut(genTrDB, {
        _id: `triage-gen-${p.id}`, type: 'triage', patientId: p.id, patientName: name, hospitalNumber: p.hospitalNumber,
        airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert',
        priority: triagePri[i % triagePri.length], temperature: '37.0', pulse: '84', respiratoryRate: '18', systolic: '120', diastolic: '78', oxygenSaturation: '98',
        chiefComplaint: `${tst.testName} workup`, triagedBy: 'user-nurse.stella', triagedByName: 'Nurse Stella Keji Lemi', triagedAt: daysAgo(i % 5),
        facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', status: triageStat[i % triageStat.length],
        orgId: PUBLIC_ORG_ID, createdAt: daysAgo(i % 5), updatedAt: daysAgo(i % 5),
      } as unknown as Record<string, unknown>);
    }
  }

  // ── Visualization fill: today's appointments + walk-ins for EVERY staffed
  //    facility ─────────────────────────────────────────────────────────────
  // So that whichever user you log in as (Juba / Wau / Malakal / Bentiu, public
  // or private org), their dashboard shows a populated appointment board and a
  // busy reception/walk-in queue rather than a near-empty list. Rows are built
  // from each facility's own patients + providers so they pass facility/org
  // scoping and land on the right dashboards.
  {
    const visApptDB = appointmentsDB();
    const visTrDB = triageDB();

    type VisProvider = { id: string; name: string };
    type VisFacility = {
      fid: string; fname: string; level: string; org: string;
      providers: VisProvider[]; triager: VisProvider; desk: VisProvider;
    };
    const DESK_JUBA: VisProvider = { id: 'user-desk.amira', name: 'Amira Juma Hassan' };
    const DESK_WAU: VisProvider = { id: 'user-desk.wau', name: 'Tabitha Nyandeng Kuol' };

    const VIS_FACILITIES: VisFacility[] = [
      {
        fid: 'hosp-001', fname: 'Juba Teaching Hospital', level: 'national', org: PUBLIC_ORG_ID,
        providers: [
          { id: 'user-dr.wani', name: 'Dr. James Wani Igga' },
          { id: 'user-dr.achol', name: 'Dr. Achol Mayen Deng' },
          // The login picker's featured Juba doctor — must own a share of
          // today's board or his dashboard lanes render empty.
          { id: 'user-clinician.peter', name: 'Dr. Peter Garang Deng' },
        ],
        triager: { id: 'user-triage.mary', name: 'Mary Nyaruai Gai' }, desk: DESK_JUBA,
      },
      {
        fid: 'hosp-002', fname: 'Wau State Hospital', level: 'state', org: PUBLIC_ORG_ID,
        providers: [
          { id: 'user-co.deng', name: 'CO Deng Mabior Kuol' },
          { id: 'user-dr.wau', name: 'Dr. Mary Akuol Deng' },
        ],
        triager: { id: 'user-nurse.wau', name: 'Nurse Grace Achai Lual' }, desk: DESK_WAU,
      },
      {
        fid: 'hosp-003', fname: 'Malakal Teaching Hospital', level: 'national', org: PUBLIC_ORG_ID,
        providers: [
          { id: 'user-midwife.nyakong', name: 'Midwife Nyakong Gatkuoth' },
          { id: 'user-nurse.stella', name: 'Nurse Stella Keji Lemi' },
        ],
        triager: { id: 'user-nurse.stella', name: 'Nurse Stella Keji Lemi' }, desk: DESK_JUBA,
      },
      {
        fid: 'hosp-004', fname: 'Bentiu State Hospital', level: 'state', org: PUBLIC_ORG_ID,
        providers: [
          { id: 'user-lab.gatluak', name: 'Lab Tech Gatluak Puok' },
        ],
        triager: { id: 'user-lab.gatluak', name: 'Lab Tech Gatluak Puok' }, desk: DESK_JUBA,
      },
      // Private org (Mercy) shares the Juba facility but its own patients pool is
      // empty, so borrow Juba patients tagged to the private org so Dr. Mercy /
      // org-admin dashboards also populate.
      {
        fid: 'hosp-001', fname: 'Juba Teaching Hospital', level: 'national', org: PRIVATE_ORG_ID,
        providers: [
          { id: 'user-dr.mercy', name: 'Dr. Grace Lado' },
        ],
        triager: { id: 'user-triage.mary', name: 'Mary Nyaruai Gai' }, desk: DESK_JUBA,
      },
    ];

    const VIS_SLOTS = [
      { t: '08:00', e: '08:30' }, { t: '08:45', e: '09:15' }, { t: '09:30', e: '10:00' },
      { t: '10:15', e: '10:45' }, { t: '11:00', e: '11:30' }, { t: '11:45', e: '12:15' },
      { t: '13:00', e: '13:30' }, { t: '13:45', e: '14:15' }, { t: '14:30', e: '15:00' },
      { t: '15:15', e: '15:45' }, { t: '16:00', e: '16:30' }, { t: '16:45', e: '17:15' },
      { t: '07:15', e: '07:45' },
    ];

    // Per-facility slot allocator for TODAY. A clinic front desk never
    // double-books a slot, so every generated booking below (today's
    // appointments, telehealth visits, and the scheduled-lane fill) draws
    // its time from here. The taken list is primed with the static
    // seedAppointments rows for the same facility so generated bookings
    // slot around them instead of on top of them. Returns null when the
    // clinic day is full — callers stop seeding at that point.
    const todayIso = dateAgo(0);
    const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const takenByFacility = new Map<string, Array<[number, number]>>();
    const takeTodaySlot = (facilityId: string, dur: number): { t: string; e: string } | null => {
      let taken = takenByFacility.get(facilityId);
      if (!taken) {
        taken = seedAppointments
          .filter((a) => a.facilityId === facilityId && a.appointmentDate === todayIso)
          .map((a) => [
            toMins(a.appointmentTime),
            a.endTime ? toMins(a.endTime) : toMins(a.appointmentTime) + (a.duration || 30),
          ] as [number, number]);
        takenByFacility.set(facilityId, taken);
      }
      let start = 7 * 60 + 15; // clinic day runs 07:15–19:30
      const dayEnd = 19 * 60 + 30;
      while (start + dur <= dayEnd) {
        const clash = taken.find(([s, e]) => start < e && start + dur > s);
        if (!clash) {
          taken.push([start, start + dur]);
          return { t: toHHMM(start), e: toHHMM(start + dur) };
        }
        start = clash[1];
      }
      return null;
    };
    const VIS_APPT_STATUS = ['confirmed', 'checked_in', 'scheduled', 'in_progress', 'checked_in', 'confirmed', 'scheduled', 'completed'];
    const VIS_APPT_TYPE = ['general', 'follow_up', 'specialist', 'anc', 'general', 'lab'];
    const VIS_DEPT = ['Outpatient', 'Internal Medicine', 'Obstetrics & Gynecology', 'Surgery', 'Paediatrics'];
    const VIS_REASON = [
      'Routine consultation', 'Follow-up review', 'Malaria follow-up', 'Antenatal check-up',
      'Hypertension review', 'Diabetes review', 'Wound dressing follow-up', 'Fever assessment',
    ];
    const VIS_TRI_PRI = ['GREEN', 'YELLOW', 'GREEN', 'RED', 'YELLOW', 'GREEN'];
    const VIS_TRI_STATUS = ['pending', 'seen', 'pending', 'pending', 'seen', 'pending'];
    const VIS_WALKIN = [
      'Walk-in fever and headache', 'Walk-in prescription refill', 'Walk-in high blood sugar check',
      'Walk-in cough, 3 days', 'Walk-in abdominal pain', 'Walk-in wound review',
      'Walk-in antenatal check', 'Walk-in blood pressure check',
    ];
    const patName = (p: { firstName: string; middleName?: string; surname: string }) =>
      `${p.firstName} ${p.middleName ? p.middleName + ' ' : ''}${p.surname}`.replace(/\s+/g, ' ').trim();

    for (let f = 0; f < VIS_FACILITIES.length; f++) {
      const fac = VIS_FACILITIES[f];
      const facPatients = patients.filter((p) => p.registrationHospital === fac.fid);
      if (facPatients.length === 0) continue;

      // Today's appointments (13 per public facility, fewer where the roster is thin).
      const todayCount = Math.min(fac.org === PRIVATE_ORG_ID ? 4 : 13, facPatients.length);
      for (let i = 0; i < todayCount; i++) {
        const p = facPatients[i % facPatients.length];
        const prov = fac.providers[i % fac.providers.length];
        const slot = takeTodaySlot(fac.fid, 30);
        if (!slot) break; // clinic day is fully booked
        const name = patName(p);
        await safePut(visApptDB, {
          _id: `appt-vis-${fac.fid}-${fac.org === PRIVATE_ORG_ID ? 'priv-' : ''}today-${i}`,
          type: 'appointment', patientId: p.id, patientName: name, patientPhone: p.phone || '',
          providerId: prov.id, providerName: prov.name,
          facilityId: fac.fid, facilityName: fac.fname, facilityLevel: fac.level,
          appointmentDate: dateAgo(0), appointmentTime: slot.t, endTime: slot.e, duration: 30,
          appointmentType: VIS_APPT_TYPE[i % VIS_APPT_TYPE.length],
          priority: i % 4 === 0 ? 'urgent' : 'routine',
          department: VIS_DEPT[i % VIS_DEPT.length], reason: VIS_REASON[i % VIS_REASON.length],
          status: VIS_APPT_STATUS[i % VIS_APPT_STATUS.length],
          ...(VIS_APPT_STATUS[i % VIS_APPT_STATUS.length] === 'checked_in' || VIS_APPT_STATUS[i % VIS_APPT_STATUS.length] === 'in_progress'
            ? { checkedInAt: daysAgo(0) } : {}),
          reminderSent: true, reminderChannel: 'sms', isRecurring: false,
          bookedBy: fac.desk.id, bookedByName: fac.desk.name,
          state: p.state, county: p.county, orgId: fac.org,
          createdAt: daysAgo((i % 5) + 1), updatedAt: daysAgo(0),
        } as unknown as Record<string, unknown>);
      }

      // Telehealth visits today — a couple per facility so every clinician has
      // a video visit to Join from the dashboard (appointmentType 'telehealth'
      // drives the Join button + the telehealth visit room).
      const thCount = Math.min(2, facPatients.length);
      for (let i = 0; i < thCount; i++) {
        const p = facPatients[(i + 2) % facPatients.length];
        const prov = fac.providers[i % fac.providers.length];
        const slot = takeTodaySlot(fac.fid, 30);
        if (!slot) break;
        const name = patName(p);
        await safePut(visApptDB, {
          _id: `appt-vis-${fac.fid}-${fac.org === PRIVATE_ORG_ID ? 'priv-' : ''}th-${i}`,
          type: 'appointment', patientId: p.id, patientName: name, patientPhone: p.phone || '',
          providerId: prov.id, providerName: prov.name,
          facilityId: fac.fid, facilityName: fac.fname, facilityLevel: fac.level,
          appointmentDate: dateAgo(0), appointmentTime: slot.t, endTime: slot.e, duration: 30,
          appointmentType: 'telehealth', priority: 'routine',
          department: 'Telemedicine', reason: 'Telehealth follow-up consultation',
          status: i % 2 === 0 ? 'confirmed' : 'scheduled',
          reminderSent: true, reminderChannel: 'sms', isRecurring: false,
          bookedBy: fac.desk.id, bookedByName: fac.desk.name,
          state: p.state, county: p.county, orgId: fac.org,
          createdAt: daysAgo(1), updatedAt: daysAgo(0),
        } as unknown as Record<string, unknown>);
      }

      // Extra "Scheduled" lane fill — 10 more scheduled arrivals for today per
      // public facility so the Scheduled tab is well populated.
      if (fac.org !== PRIVATE_ORG_ID) {
        const SCHED_COUNT = 10;
        for (let i = 0; i < SCHED_COUNT; i++) {
          const p = facPatients[(i + todayCount) % facPatients.length];
          const prov = fac.providers[i % fac.providers.length];
          const slot = takeTodaySlot(fac.fid, 20);
          if (!slot) break;
          const name = patName(p);
          await safePut(visApptDB, {
            _id: `appt-vis-${fac.fid}-sched-${i}`,
            type: 'appointment', patientId: p.id, patientName: name, patientPhone: p.phone || '',
            providerId: prov.id, providerName: prov.name,
            facilityId: fac.fid, facilityName: fac.fname, facilityLevel: fac.level,
            appointmentDate: dateAgo(0), appointmentTime: slot.t, endTime: slot.e, duration: 20,
            appointmentType: VIS_APPT_TYPE[i % VIS_APPT_TYPE.length],
            priority: i % 5 === 0 ? 'urgent' : 'routine',
            department: VIS_DEPT[i % VIS_DEPT.length], reason: VIS_REASON[i % VIS_REASON.length],
            status: 'scheduled',
            reminderSent: i % 2 === 0, reminderChannel: 'sms', isRecurring: false,
            bookedBy: fac.desk.id, bookedByName: fac.desk.name,
            state: p.state, county: p.county, orgId: fac.org,
            createdAt: daysAgo((i % 4) + 1), updatedAt: daysAgo(0),
          } as unknown as Record<string, unknown>);
        }
      }

      // Upcoming appointments (4 per facility) so calendars / carousels populate.
      const upcomingCount = Math.min(4, facPatients.length);
      for (let i = 0; i < upcomingCount; i++) {
        const p = facPatients[(i + 3) % facPatients.length];
        const prov = fac.providers[i % fac.providers.length];
        // Afternoon slots — the static seedAppointments rows for the same
        // future dates all sit in the morning, so these never double-book.
        const slot = VIS_SLOTS[6 + (i % 4)];
        const name = patName(p);
        await safePut(visApptDB, {
          _id: `appt-vis-${fac.fid}-${fac.org === PRIVATE_ORG_ID ? 'priv-' : ''}up-${i}`,
          type: 'appointment', patientId: p.id, patientName: name, patientPhone: p.phone || '',
          providerId: prov.id, providerName: prov.name,
          facilityId: fac.fid, facilityName: fac.fname, facilityLevel: fac.level,
          appointmentDate: dateFromNow(i + 1), appointmentTime: slot.t, endTime: slot.e, duration: 30,
          appointmentType: VIS_APPT_TYPE[(i + 2) % VIS_APPT_TYPE.length],
          priority: 'routine',
          department: VIS_DEPT[(i + 1) % VIS_DEPT.length], reason: VIS_REASON[(i + 2) % VIS_REASON.length],
          status: i % 2 === 0 ? 'confirmed' : 'scheduled',
          reminderSent: i % 2 === 0, reminderChannel: 'sms', isRecurring: false,
          bookedBy: fac.desk.id, bookedByName: fac.desk.name,
          state: p.state, county: p.county, orgId: fac.org,
          createdAt: daysAgo((i % 4) + 1), updatedAt: daysAgo(i % 3),
        } as unknown as Record<string, unknown>);
      }

      // Today's reception walk-ins (5 per public facility) so the queue is busy.
      if (fac.org === PRIVATE_ORG_ID) continue; // walk-ins tracked on the public facility record
      const walkCount = Math.min(5, facPatients.length);
      for (let i = 0; i < walkCount; i++) {
        const p = facPatients[(i + 1) % facPatients.length];
        const name = patName(p);
        const pri = VIS_TRI_PRI[i % VIS_TRI_PRI.length];
        await safePut(visTrDB, {
          _id: `triage-vis-${fac.fid}-today-${i}`,
          type: 'triage', patientId: p.id, patientName: name, hospitalNumber: p.hospitalNumber,
          airway: 'clear',
          breathing: pri === 'RED' ? 'distressed' : 'normal',
          circulation: pri === 'RED' ? 'impaired' : 'normal',
          consciousness: 'alert', priority: pri,
          temperature: pri === 'RED' ? '39.0' : '37.2', pulse: pri === 'RED' ? '120' : '84',
          respiratoryRate: pri === 'RED' ? '26' : '18',
          systolic: pri === 'RED' ? '96' : '122', diastolic: pri === 'RED' ? '62' : '78',
          oxygenSaturation: pri === 'RED' ? '92' : '98',
          chiefComplaint: VIS_WALKIN[i % VIS_WALKIN.length],
          triagedBy: fac.triager.id, triagedByName: fac.triager.name, triagedAt: daysAgo(0),
          facilityId: fac.fid, facilityName: fac.fname,
          status: VIS_TRI_STATUS[i % VIS_TRI_STATUS.length],
          orgId: fac.org, createdAt: daysAgo(0), updatedAt: daysAgo(0),
        } as unknown as Record<string, unknown>);
      }
    }
  }

  // Seed some medical records for patients (all public org)
  const mrDB = medicalRecordsDB();
  for (const p of patients.slice(0, 15)) {
    const records = generateMedicalRecords(p.id, 6);
    for (const r of records) {
      const doc: MedicalRecordDoc = {
        _id: r.id,
        type: 'medical_record',
        ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'id')),
        orgId: PUBLIC_ORG_ID,
        createdAt: now,
        updatedAt: now,
      } as MedicalRecordDoc;
      await safePut(mrDB, doc as unknown as Record<string, unknown>);
    }
  }

  // ── Clinical Officer panel: full clinical history for the Wau (hosp-002)
  // patients so their medical records, medication history, lab results, and
  // vitals trends are visualizable when signed in as CO Deng (clinical_officer).
  // Records are pinned to Wau State Hospital with the CO as provider so they
  // survive the hospital-scope filter, and each visit's prescriptions/labs are
  // also written as standalone docs so the dedicated medication and lab views
  // populate (not just the embedded record arrays).
  const coRxDB = prescriptionsDB();
  const coLabDB = labResultsDB();
  for (const wp of wauPatients) {
    const pid = wp._id as string;
    const pname = `${String(wp.firstName)} ${String(wp.surname)}`;
    const pnum = (wp.hospitalNumber as string) || '';
    const records = generateMedicalRecords(pid, 6);
    for (let ri = 0; ri < records.length; ri++) {
      const r = records[ri];
      const isLatest = ri === records.length - 1;
      const visitAt = r.consultedAt || now;
      const record = {
        ...r,
        hospitalId: 'hosp-002',
        hospitalName: 'Wau State Hospital',
        providerName: 'CO Deng Mabior Kuol',
        providerRole: 'Clinical Officer',
      };
      const mrDoc: MedicalRecordDoc = {
        _id: record.id,
        type: 'medical_record',
        ...Object.fromEntries(Object.entries(record).filter(([k]) => k !== 'id')),
        orgId: PUBLIC_ORG_ID,
        createdAt: visitAt,
        updatedAt: visitAt,
      } as MedicalRecordDoc;
      await safePut(mrDB, mrDoc as unknown as Record<string, unknown>);

      // Medication history — standalone prescription docs. The most recent
      // visit's drugs stay 'pending' (active script); older ones are dispensed.
      for (let k = 0; k < record.prescriptions.length; k++) {
        const rx = record.prescriptions[k];
        const dispensed = !isLatest;
        await safePut(coRxDB, {
          _id: `rx-${pid}-${ri}-${k}`,
          type: 'prescription',
          patientId: pid,
          patientName: pname,
          medication: rx.genericName ? `${rx.drugName} (${rx.genericName})` : rx.drugName,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          duration: rx.duration,
          prescribedBy: 'CO Deng Mabior Kuol',
          status: dispensed ? 'dispensed' : 'pending',
          urgency: 'definitive',
          ...(dispensed ? { dispensedAt: visitAt } : {}),
          hospitalId: 'hosp-002',
          hospitalName: 'Wau State Hospital',
          orgId: PUBLIC_ORG_ID,
          createdAt: visitAt,
          updatedAt: visitAt,
        } as unknown as Record<string, unknown>);
      }

      // Lab history — standalone completed lab_result docs.
      for (let k = 0; k < record.labResults.length; k++) {
        const lab = record.labResults[k];
        await safePut(coLabDB, {
          _id: `lab-${pid}-${ri}-${k}`,
          type: 'lab_result',
          patientId: pid,
          patientName: pname,
          hospitalNumber: pnum,
          testName: lab.testName,
          specimen: 'Blood',
          status: 'completed',
          result: String(lab.result),
          unit: lab.unit || '',
          referenceRange: lab.referenceRange || '',
          abnormal: !!lab.abnormal,
          critical: !!lab.critical,
          orderedBy: 'CO Deng Mabior Kuol',
          orderedAt: visitAt,
          completedAt: visitAt,
          tier: 'basic',
          hospitalId: 'hosp-002',
          hospitalName: 'Wau State Hospital',
          orgId: PUBLIC_ORG_ID,
          createdAt: visitAt,
          updatedAt: visitAt,
        } as unknown as Record<string, unknown>);
      }
    }
  }

  // ── Malakal (hosp-003) panel: same full clinical history for the Malakal
  // roster so nurse.stella's / midwife.nyakong's MAR, medication, lab, and
  // record views populate. Pinned to Malakal with the midwife as provider so
  // the records survive the hospital-scope filter.
  for (const mp of malakalPatients) {
    const pid = mp._id as string;
    const pname = `${String(mp.firstName)} ${String(mp.surname)}`;
    const pnum = (mp.hospitalNumber as string) || '';
    const records = generateMedicalRecords(pid, 6);
    for (let ri = 0; ri < records.length; ri++) {
      const r = records[ri];
      const isLatest = ri === records.length - 1;
      const visitAt = r.consultedAt || now;
      const record = {
        ...r,
        hospitalId: 'hosp-003',
        hospitalName: 'Malakal Teaching Hospital',
        providerName: MIDWIFE_NAME,
        providerRole: 'Midwife',
      };
      const mrDoc: MedicalRecordDoc = {
        _id: record.id,
        type: 'medical_record',
        ...Object.fromEntries(Object.entries(record).filter(([k]) => k !== 'id')),
        orgId: PUBLIC_ORG_ID,
        createdAt: visitAt,
        updatedAt: visitAt,
      } as MedicalRecordDoc;
      await safePut(mrDB, mrDoc as unknown as Record<string, unknown>);

      for (let k = 0; k < record.prescriptions.length; k++) {
        const rx = record.prescriptions[k];
        const dispensed = !isLatest;
        await safePut(coRxDB, {
          _id: `rx-${pid}-${ri}-${k}`,
          type: 'prescription',
          patientId: pid,
          patientName: pname,
          medication: rx.genericName ? `${rx.drugName} (${rx.genericName})` : rx.drugName,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          duration: rx.duration,
          prescribedBy: MIDWIFE_NAME,
          status: dispensed ? 'dispensed' : 'pending',
          urgency: 'definitive',
          ...(dispensed ? { dispensedAt: visitAt } : {}),
          hospitalId: 'hosp-003',
          hospitalName: 'Malakal Teaching Hospital',
          orgId: PUBLIC_ORG_ID,
          createdAt: visitAt,
          updatedAt: visitAt,
        } as unknown as Record<string, unknown>);
      }

      for (let k = 0; k < record.labResults.length; k++) {
        const lab = record.labResults[k];
        await safePut(coLabDB, {
          _id: `lab-${pid}-${ri}-${k}`,
          type: 'lab_result',
          patientId: pid,
          patientName: pname,
          hospitalNumber: pnum,
          testName: lab.testName,
          specimen: 'Blood',
          status: 'completed',
          result: String(lab.result),
          unit: lab.unit || '',
          referenceRange: lab.referenceRange || '',
          abnormal: !!lab.abnormal,
          critical: !!lab.critical,
          orderedBy: MIDWIFE_NAME,
          orderedAt: visitAt,
          completedAt: visitAt,
          tier: 'basic',
          hospitalId: 'hosp-003',
          hospitalName: 'Malakal Teaching Hospital',
          orgId: PUBLIC_ORG_ID,
          createdAt: visitAt,
          updatedAt: visitAt,
        } as unknown as Record<string, unknown>);
      }
    }
  }

  // Seed messages (all public org). Spread across the last week so the
  // messaging "recent" list stays fresh.
  const msgDB = messagesDB();
  for (let i = 0; i < seedMessages.length; i++) {
    const msg = seedMessages[i];
    const sent = daysAgo(i % 7);
    await safePut(msgDB, {
      ...msg,
      sentAt: sent,
      createdAt: sent,
      updatedAt: sent,
      orgId: PUBLIC_ORG_ID,
    } as unknown as Record<string, unknown>);
  }

  // ── Internal clinical staff chat: demo conversations among Juba Teaching
  // Hospital (hosp-001) staff so the messaging screen is populated when signed
  // in as a hosp-001 clinician (e.g. Dr. James Wani Igga). Each conversation is
  // a ConversationDoc plus a stream of staff_to_staff MessageDocs.
  const convDB = conversationsDB();
  const H1 = { id: 'hosp-001', name: 'Juba Teaching Hospital' };
  const WAU = { id: 'hosp-002', name: 'Wau State Hospital' };
  const P = {
    wani: { id: 'user-dr.wani', name: 'Dr. James Wani Igga' },
    achol: { id: 'user-dr.achol', name: 'Dr. Achol Mayen Deng' },
    rose: { id: 'user-pharma.rose', name: 'Pharmacist Rose Gbudue' },
    lado: { id: 'user-supt.lado', name: 'Dr. Lado Tombe Kenyi' },
    aluel: { id: 'user-manager.aluel', name: 'Aluel Bol Maker' },
    mary: { id: 'user-triage.mary', name: 'Mary Nyaruai Gai' },
    sara: { id: 'user-rooming.sara', name: 'Sara Aluel Bol' },
    peter: { id: 'user-clinician.peter', name: 'Dr. Peter Garang Deng' },
    nyandeng: { id: 'user-biller.nyandeng', name: 'Nyandeng Chol Atem' },
    amira: { id: 'user-desk.amira', name: 'Amira Juma Hassan' },
    // Wau State Hospital (hosp-002) staff so the Clinical Officer demo (co.deng) has a populated chat.
    deng: { id: 'user-co.deng', name: 'CO Deng Mabior Kuol' },
    maryAkuol: { id: 'user-dr.wau', name: 'Dr. Mary Akuol Deng' },
    grace: { id: 'user-nurse.wau', name: 'Nurse Grace Achai Lual' },
    johnBol: { id: 'user-pharma.wau', name: 'Pharmacist John Bol Garang' },
    tabitha: { id: 'user-desk.wau', name: 'Tabitha Nyandeng Kuol' },
  };
  const tsAgo = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();
  interface SeedConv {
    id: string; kind: 'dm' | 'group'; name?: string;
    hosp?: { id: string; name: string };
    members: { id: string; name: string }[];
    msgs: { from: { id: string; name: string }; body: string; minsAgo: number }[];
  }
  const staffConversations: SeedConv[] = [
    {
      id: 'conv-seed-huddle', kind: 'group', name: 'Morning Clinical Huddle',
      members: [P.wani, P.achol, P.peter, P.mary],
      msgs: [
        { from: P.achol, body: 'Morning team — quick huddle at 7:30 before rounds?', minsAgo: 180 },
        { from: P.peter, body: 'Works for me.', minsAgo: 175 },
        { from: P.wani, body: "I'll be there.", minsAgo: 170 },
        { from: P.mary, body: 'Bed 12 needs review before discharge — vitals stable overnight.', minsAgo: 45 },
      ],
    },
    {
      id: 'conv-seed-ward4b', kind: 'group', name: 'Ward 4B Care Team',
      members: [P.wani, P.rose, P.sara],
      msgs: [
        { from: P.sara, body: 'Mr. Garang in 4B is due for his next dose at noon.', minsAgo: 120 },
        { from: P.rose, body: 'Coartem is ready at pharmacy for pickup.', minsAgo: 90 },
        { from: P.wani, body: "Thanks, I'll round on him after clinic.", minsAgo: 60 },
      ],
    },
    {
      id: 'conv-seed-discharge', kind: 'group', name: 'Room 515 Discharge Team',
      members: [P.wani, P.aluel, P.nyandeng, P.amira],
      msgs: [
        { from: P.aluel, body: 'Two discharges planned today — we need the beds for incoming.', minsAgo: 240 },
        { from: P.nyandeng, body: 'Billing cleared for both patients.', minsAgo: 200 },
        { from: P.amira, body: 'Patient in 515 is ready for discharge — transport arranged.', minsAgo: 5 },
      ],
    },
    {
      id: 'conv-seed-dm-achol', kind: 'dm',
      members: [P.wani, P.achol],
      msgs: [
        { from: P.wani, body: 'Can you cover my 2pm clinic? Stuck in theatre.', minsAgo: 100 },
        { from: P.achol, body: 'Sure, no problem — I’ll take it.', minsAgo: 95 },
      ],
    },
    {
      id: 'conv-seed-dm-rose', kind: 'dm',
      members: [P.wani, P.rose],
      msgs: [
        { from: P.rose, body: 'We’re low on amoxicillin suspension — flagged for reorder.', minsAgo: 300 },
        { from: P.wani, body: 'Noted, thanks for the heads up.', minsAgo: 290 },
      ],
    },
    {
      id: 'conv-seed-dm-lado', kind: 'dm',
      members: [P.wani, P.lado],
      msgs: [
        { from: P.lado, body: 'Good work on the M&M presentation yesterday.', minsAgo: 1440 },
        { from: P.wani, body: 'Appreciate it.', minsAgo: 1430 },
      ],
    },
    // ── Wau State Hospital (hosp-002) — the Clinical Officer's conversations ──
    {
      id: 'conv-wau-opd', kind: 'group', name: 'OPD Care Team', hosp: WAU,
      members: [P.deng, P.maryAkuol, P.grace, P.johnBol],
      msgs: [
        { from: P.grace, body: 'Triage queue is building up in OPD — three febrile children waiting.', minsAgo: 95 },
        { from: P.deng, body: 'On my way, start the malaria RDTs please.', minsAgo: 88 },
        { from: P.johnBol, body: 'Coartem and ORS are in stock if needed.', minsAgo: 80 },
        { from: P.maryAkuol, body: 'I can take the two adults in bay 2.', minsAgo: 22 },
      ],
    },
    {
      id: 'conv-wau-discharge', kind: 'group', name: 'Discharge Planning', hosp: WAU,
      members: [P.deng, P.maryAkuol, P.tabitha],
      msgs: [
        { from: P.tabitha, body: 'Bed WSH-12 ready for checkout once notes are signed.', minsAgo: 150 },
        { from: P.deng, body: 'Discharge summary done — please arrange transport.', minsAgo: 30 },
      ],
    },
    {
      id: 'conv-wau-dm-mary', kind: 'dm', hosp: WAU,
      members: [P.deng, P.maryAkuol],
      msgs: [
        { from: P.deng, body: 'Can you review the chest X-ray for bed 7 when free?', minsAgo: 70 },
        { from: P.maryAkuol, body: 'Sure — looks like a lobar pneumonia. Start antibiotics.', minsAgo: 64 },
      ],
    },
    {
      id: 'conv-wau-dm-grace', kind: 'dm', hosp: WAU,
      members: [P.deng, P.grace],
      msgs: [
        { from: P.grace, body: 'Patient in WSH-000012 is asking about his diabetes meds.', minsAgo: 40 },
        { from: P.grace, body: 'He hasn’t collected this month’s Metformin yet.', minsAgo: 38 },
      ],
    },
    {
      id: 'conv-wau-dm-john', kind: 'dm', hosp: WAU,
      members: [P.deng, P.johnBol],
      msgs: [
        { from: P.deng, body: 'Do we still have amoxicillin suspension for paeds?', minsAgo: 200 },
        { from: P.johnBol, body: 'Yes, plenty in stock.', minsAgo: 195 },
      ],
    },
  ];
  for (const c of staffConversations) {
    const H = c.hosp || H1;
    const last = c.msgs[c.msgs.length - 1];
    await safePut(convDB, {
      _id: c.id, type: 'conversation', kind: c.kind,
      ...(c.name ? { name: c.name } : {}),
      participantIds: c.members.map(m => m.id),
      participantNames: c.members.map(m => m.name),
      createdByName: c.members[0].name,
      lastMessageAt: tsAgo(last.minsAgo),
      lastMessagePreview: last.body.slice(0, 120),
      lastMessageFromName: last.from.name,
      pinnedBy: [],
      hospitalId: H.id, hospitalName: H.name, orgId: PUBLIC_ORG_ID,
      createdAt: tsAgo(600), updatedAt: tsAgo(last.minsAgo),
    } as unknown as Record<string, unknown>);
    for (let k = 0; k < c.msgs.length; k++) {
      const m = c.msgs[k];
      const sentAt = tsAgo(m.minsAgo);
      const isLast = k === c.msgs.length - 1;
      // Older messages are read by everyone; the final message is read only by
      // its sender so the recipient sees a realistic unread badge.
      const readBy = isLast ? [m.from.id] : c.members.map(mm => mm.id);
      await safePut(msgDB, {
        _id: `${c.id}-m${k + 1}`, type: 'message',
        recipientType: 'staff', direction: 'staff_to_staff',
        conversationId: c.id,
        patientId: c.id, patientName: c.name || 'Direct message', patientPhone: '',
        fromDoctorId: m.from.id, fromDoctorName: m.from.name,
        fromHospitalName: H.name, fromHospitalId: H.id,
        recipientHospitalId: H.id, recipientHospitalName: H.name,
        subject: '', body: m.body, channel: 'app', status: 'delivered',
        sentAt, readBy, orgId: PUBLIC_ORG_ID, createdAt: sentAt, updatedAt: sentAt,
      } as unknown as Record<string, unknown>);
    }
  }

  // Seed births (all public org). Spread across the last ~5 weeks so the
  // births trend chart shows movement and "recent" registrations populate.
  const bDB = birthsDB();
  const birthOffsets = [1, 4, 9, 16, 24, 33];
  for (let i = 0; i < seedBirths.length; i++) {
    const b = seedBirths[i];
    const offset = birthOffsets[i % birthOffsets.length];
    await safePut(bDB, {
      ...b,
      dateOfBirth: dateAgo(offset),
      createdAt: daysAgo(offset),
      updatedAt: daysAgo(offset),
      orgId: PUBLIC_ORG_ID,
    } as unknown as Record<string, unknown>);
  }

  // Seed deaths (all public org). Spread across the last ~5 weeks so the
  // mortality trend chart buckets across multiple periods.
  const dDB = deathsDB();
  const deathOffsets = [2, 6, 12, 19, 27, 35];
  for (let i = 0; i < seedDeaths.length; i++) {
    const d = seedDeaths[i];
    const offset = deathOffsets[i % deathOffsets.length];
    await safePut(dDB, {
      ...d,
      dateOfDeath: dateAgo(offset),
      createdAt: daysAgo(offset),
      updatedAt: daysAgo(offset),
      orgId: PUBLIC_ORG_ID,
    } as unknown as Record<string, unknown>);
  }

  // Seed facility assessments (all public org)
  const faDB = facilityAssessmentsDB();
  for (const fa of seedFacilityAssessments) {
    await safePut(faDB, { ...fa, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed immunizations (all public org)
  const immDB = immunizationsDB();
  for (const imm of seedImmunizations) {
    await safePut(immDB, { ...imm, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed ANC visits (all public org)
  const ancDatabase = ancDB();
  for (const anc of seedANCVisits) {
    await safePut(ancDatabase, { ...anc, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed follow-ups (all public org)
  const fuDB = followUpsDB();
  for (const fu of seedFollowUps) {
    await safePut(fuDB, { ...fu, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed payment & billing data (all public org)
  const chgDB = chargesDB();
  for (const chg of seedCharges) {
    await safePut(chgDB, { ...chg, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  const insDB = insurancePoliciesDB();
  for (const ins of seedInsurancePolicies) {
    await safePut(insDB, ins as unknown as Record<string, unknown>);
  }

  const clmDB = claimsDB();
  for (const clm of seedClaims) {
    await safePut(clmDB, clm as unknown as Record<string, unknown>);
  }

  const payDB = paymentsDB();
  for (const pay of seedPayments) {
    await safePut(payDB, pay as unknown as Record<string, unknown>);
  }

  const plnDB = paymentPlansDB();
  for (const pln of seedPaymentPlans) {
    await safePut(plnDB, pln as unknown as Record<string, unknown>);
  }

  const ledDB = ledgerDB();
  for (const led of seedLedgerEntries) {
    // seedLedgerEntries literals carry no orgId; without it filterByScope
    // rejects them for every scoped user and the five showcase billing
    // patients render empty ledgers (generated ledger rows below DO set it).
    await safePut(ledDB, { ...led, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // ─── Generated billing for the remaining demo patients ───────────────────
  // The hand-crafted billing above only covers five patients. Generate
  // lightweight, deterministic billing for every OTHER demo patient — two
  // charges, a saved payment method, ledger entries, a payment for most, and
  // insurance for roughly a quarter — so opening ANY patient's Billing tab
  // shows real-looking data instead of empty cards. Demo-only (this whole seed
  // path is demo-gated). IDs are deterministic, so re-seeding never duplicates.
  const HANDCRAFTED_BILLING = new Set(['pat-00001', 'pat-00005', 'pat-00012', 'pat-00018', 'pat-00022']);
  const GEN_METHODS = ['mpesa', 'airtel', 'mtn_momo', 'm_gurush'] as const;
  const GEN_METHOD_LABELS: Record<string, string> = { mpesa: 'M-Pesa', airtel: 'Airtel Money', mtn_momo: 'MTN MoMo', m_gurush: 'm-Gurush' };
  const GEN_SERVICES: { description: string; category: ChargeCategory; amount: number }[] = [
    { description: 'Outpatient Consultation', category: 'consultation', amount: 5000 },
    { description: 'Malaria RDT', category: 'laboratory', amount: 2000 },
    { description: 'Full Blood Count', category: 'laboratory', amount: 3000 },
    { description: 'Amoxicillin 500mg (5-day course)', category: 'pharmacy', amount: 2500 },
    { description: 'Wound Dressing & Suturing', category: 'procedure', amount: 3500 },
    { description: 'Antenatal Visit', category: 'consultation', amount: 3500 },
  ];
  const smDB = getDB('tamamhealth_saved_payment_methods');
  let _gi = 0;
  for (const gp of patients) {
    if (HANDCRAFTED_BILLING.has(gp.id)) continue;
    _gi++;
    const facilityId = gp.registrationHospital || 'hosp-001';
    const gName = `${gp.firstName} ${gp.surname}`;
    const ts = daysAgo((_gi % 18) + 2);
    const svcDate = ts.slice(0, 10);
    const enc = `enc-gen-${gp.id}`;
    const s1 = GEN_SERVICES[_gi % GEN_SERVICES.length];
    const s2 = GEN_SERVICES[(_gi + 2) % GEN_SERVICES.length];
    const total = s1.amount + s2.amount;
    const paid = _gi % 3 !== 0; // ~2/3 fully paid, the rest left outstanding
    const c1 = `chg-gen-${gp.id}-1`;
    const c2 = `chg-gen-${gp.id}-2`;
    await safePut(chgDB, { _id: c1, type: 'charge', encounterId: enc, patientId: gp.id, description: s1.description, category: s1.category, units: 1, billedAmount: s1.amount, status: 'approved', serviceDate: svcDate, providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId, orgId: PUBLIC_ORG_ID, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
    await safePut(chgDB, { _id: c2, type: 'charge', encounterId: enc, patientId: gp.id, description: s2.description, category: s2.category, units: 1, billedAmount: s2.amount, status: 'approved', serviceDate: svcDate, providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId, orgId: PUBLIC_ORG_ID, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
    await safePut(ledDB, { _id: `led-gen-${gp.id}-c`, type: 'ledger_entry', patientId: gp.id, encounterId: enc, entryType: 'charge', amount: total, runningBalance: total, description: `${s1.description} + ${s2.description}`, referenceId: c1, referenceType: 'charge', currency: 'SSP', facilityId, orgId: PUBLIC_ORG_ID, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
    const method = GEN_METHODS[_gi % GEN_METHODS.length];
    if (paid) {
      const payId = `pay-gen-${gp.id}`;
      await safePut(payDB, { _id: payId, type: 'payment', patientId: gp.id, patientName: gName, encounterId: enc, method, amount: total, currency: 'SSP', reference: `RCT-GEN-${String(_gi).padStart(4, '0')}`, status: 'posted', processedAt: ts, processedBy: 'user-desk.amira', processedByName: 'Amira Juma Hassan', allocations: [{ encounterId: enc, amount: total, chargeId: c1 }], facilityId, orgId: PUBLIC_ORG_ID, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
      await safePut(ledDB, { _id: `led-gen-${gp.id}-p`, type: 'ledger_entry', patientId: gp.id, encounterId: enc, entryType: 'payment', amount: -total, runningBalance: 0, description: `Payment — ${GEN_METHOD_LABELS[method]}`, referenceId: payId, referenceType: 'payment', method, currency: 'SSP', facilityId, orgId: PUBLIC_ORG_ID, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
    }
    await safePut(smDB, { _id: `spm-gen-${gp.id}`, type: 'saved_payment_method', patientId: gp.id, methodType: method, phoneNumber: gp.phone || '+211 920 000 000', label: `${GEN_METHOD_LABELS[method]} · default`, isDefault: true, facilityId, orgId: PUBLIC_ORG_ID, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
    if (_gi % 4 === 0) {
      await safePut(insDB, { _id: `ins-gen-${gp.id}`, type: 'insurance_policy', patientId: gp.id, payerType: 'donor', payerName: 'Health Pooled Fund', payerCode: 'HPF-SS', memberId: `HPF-GEN-${String(_gi).padStart(4, '0')}`, policyNumber: `HPF-${gp.id}`, subscriberName: gName, subscriberRelationship: 'self', effectiveDate: '2026-01-01', terminationDate: '2026-12-31', isPrimary: true, copayAmount: 0, coinsurancePct: 0, deductibleAmount: 0, deductibleRemaining: 0, coverageNotes: 'HPF donor program coverage.', isActive: true, facilityId, orgId: PUBLIC_ORG_ID, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
    }
  }

  // Seed a patient care note so the Overview "Notes" card has real content.
  const noteDB = patientNotesDB();
  for (const note of seedPatientNotes) {
    await safePut(noteDB, { ...note, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed the service price catalog for both demo orgs so the org-admin Service
  // Pricing page and the Collect Payment service picker both show prices.
  const feeDB = feeScheduleDB();
  for (const orgId of [PUBLIC_ORG_ID, PRIVATE_ORG_ID]) {
    for (const f of feeScheduleBase) {
      await safePut(feeDB, {
        _id: `fee-${orgId}-${f.serviceCode}`, type: 'fee_schedule',
        facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital',
        category: f.category, serviceCode: f.serviceCode, serviceName: f.serviceName,
        unitPrice: f.unitPrice, currency: 'SSP', isActive: true, effectiveFrom: now,
        orgId, createdAt: now, updatedAt: now,
      } as unknown as Record<string, unknown>);
    }
  }

  // Seed billing invoices so checkout/billing show charged amounts, not zero.
  const blDB = billingDB();
  for (const b of seedBills) {
    await safePut(blDB, b as unknown as Record<string, unknown>);
  }

  // Seed appointments
  const apptDB = appointmentsDB();
  for (const a of seedAppointments) {
    await safePut(apptDB, a as unknown as Record<string, unknown>);
  }

  // Seed wards, beds, and admissions (ward DB holds all three doc types)
  const wDB = wardDB();
  for (const w of seedWards) {
    await safePut(wDB, w as unknown as Record<string, unknown>);
  }
  for (const bed of seedBeds) {
    await safePut(wDB, bed as unknown as Record<string, unknown>);
  }
  for (const adm of seedAdmissions) {
    await safePut(wDB, adm as unknown as Record<string, unknown>);
  }

  // Seed today's provider availability (facility dashboard "Available" status).
  const availDB = availabilityDB();
  for (const a of seedAvailability) {
    await safePut(availDB, a as Record<string, unknown>);
  }

  // Seed pharmacy inventory
  const phInvDB = pharmacyInventoryDB();
  for (const item of seedPharmacyInventory) {
    await safePut(phInvDB, item as unknown as Record<string, unknown>);
  }

  // Seed triage
  const trDB = triageDB();
  for (const t of seedTriage) {
    await safePut(trDB, t as unknown as Record<string, unknown>);
  }

  // Seed assets
  const asDB = assetsDB();
  for (const as of seedAssets) {
    await safePut(asDB, as as unknown as Record<string, unknown>);
  }

  // Seed leave requests
  const lvDB = leaveRequestsDB();
  for (const lv of seedLeaveRequests) {
    await safePut(lvDB, lv as unknown as Record<string, unknown>);
  }

  // Seed payroll entries
  const prDB = payrollEntriesDB();
  for (const pr of seedPayrollEntries) {
    await safePut(prDB, pr as unknown as Record<string, unknown>);
  }

  // Seed problem-list entries
  const prbDB = problemsDB();
  for (const prb of seedProblems) {
    await safePut(prbDB, prb as unknown as Record<string, unknown>);
  }

  // Demo-only: give EVERY patient (across every roster) a sample problem list
  // and current medications so the chart-summary Problems & Medications windows
  // are populated and scroll for any patient opened — matching the shared
  // allergies/directives. Heavy by design: this also fills the pharmacy pending
  // queue and the problem lists. Deterministic, unique ids avoid collisions, so
  // patients with their own curated problems/prescriptions simply get extras.
  const SAMPLE_PROBLEMS: { name: string; icd11Code: string; status: ProblemDoc['status']; severity: ProblemDoc['severity']; ageDays: number; notes: string }[] = [
    { name: 'Essential hypertension', icd11Code: 'BA00', status: 'chronic', severity: 'moderate', ageDays: 800, notes: 'On amlodipine; reasonably controlled.' },
    { name: 'Type 2 diabetes mellitus', icd11Code: '5A11', status: 'chronic', severity: 'moderate', ageDays: 600, notes: 'On metformin; last HbA1c borderline.' },
    { name: 'Iron-deficiency anaemia', icd11Code: '3A00', status: 'active', severity: 'mild', ageDays: 40, notes: 'On ferrous sulfate + folic acid.' },
    { name: 'Peptic ulcer disease', icd11Code: 'DA60', status: 'active', severity: 'moderate', ageDays: 20, notes: 'On omeprazole; review in 2 weeks.' },
    { name: 'Osteoarthritis of knee', icd11Code: 'FA01', status: 'chronic', severity: 'mild', ageDays: 1200, notes: 'Analgesia PRN; physiotherapy advised.' },
    { name: 'Generalized anxiety disorder', icd11Code: '6B00', status: 'active', severity: 'mild', ageDays: 90, notes: 'Counselling referral made.' },
  ];
  const SAMPLE_MEDS: { medication: string; dose: string; frequency: string; duration: string }[] = [
    { medication: 'Amlodipine', dose: '5mg OD', frequency: 'OD', duration: '30 days' },
    { medication: 'Metformin', dose: '500mg BD', frequency: 'BD', duration: '30 days' },
    { medication: 'Omeprazole', dose: '20mg OD', frequency: 'OD', duration: '14 days' },
    { medication: 'Ferrous Sulfate + Folic Acid', dose: '200mg OD', frequency: 'OD', duration: '30 days' },
    { medication: 'Paracetamol', dose: '1g QDS PRN', frequency: 'QDS PRN', duration: '5 days' },
    { medication: 'Amoxicillin', dose: '500mg TDS', frequency: 'TDS', duration: '7 days' },
  ];
  const allChartPatients: { id: string; name: string; hosp?: string; hospName?: string }[] = [
    ...patients.map((p) => ({
      id: p.id as string,
      name: `${p.firstName ?? ''} ${p.middleName ? p.middleName + ' ' : ''}${p.surname ?? ''}`.replace(/\s+/g, ' ').trim(),
      hosp: (p as unknown as Record<string, unknown>).registrationHospital as string | undefined,
      hospName: (p as unknown as Record<string, unknown>).registrationHospitalName as string | undefined,
    })),
    ...[...childPatients, ...motherPatients, ...wauPatients, ...malakalPatients].map((p) => ({
      id: p._id as string,
      name: `${(p.firstName as string) ?? ''} ${(p.surname as string) ?? ''}`.replace(/\s+/g, ' ').trim(),
      hosp: p.registrationHospital as string | undefined,
      hospName: p.registrationHospitalName as string | undefined,
    })),
  ].filter((p) => !!p.id);
  for (const cp of allChartPatients) {
    const hospitalId = cp.hosp || 'hosp-001';
    const hospitalName = cp.hospName || 'Juba Teaching Hospital';
    for (let k = 0; k < SAMPLE_PROBLEMS.length; k++) {
      const sp = SAMPLE_PROBLEMS[k];
      await safePut(prbDB, {
        _id: `problem-smp-${cp.id}-${k}`, type: 'problem', patientId: cp.id, patientName: cp.name,
        name: sp.name, icd11Code: sp.icd11Code, status: sp.status, severity: sp.severity,
        onsetDate: dateAgo(sp.ageDays), notes: sp.notes,
        recordedBy: 'user-dr.wani', recordedByName: 'Dr. James Wani Igga',
        hospitalId, hospitalName, orgId: PUBLIC_ORG_ID,
        createdAt: daysAgo(Math.min(sp.ageDays, 30)), updatedAt: daysAgo(1),
      } as unknown as Record<string, unknown>);
    }
    for (let k = 0; k < SAMPLE_MEDS.length; k++) {
      const sm = SAMPLE_MEDS[k];
      const created = daysAgo(k % 8);
      await safePut(rxDB, {
        _id: `rx-smp-${cp.id}-${k}`, type: 'prescription', patientId: cp.id, patientName: cp.name,
        medication: sm.medication, dose: sm.dose, route: 'Oral', frequency: sm.frequency, duration: sm.duration,
        prescribedBy: 'Dr. James Wani Igga', status: 'pending',
        hospitalId, hospitalName, createdAt: created, updatedAt: created, orgId: PUBLIC_ORG_ID,
      } as unknown as Record<string, unknown>);
    }
  }

  // Seed telehealth sessions
  const thDB = telehealthDB();
  for (const th of seedTelehealth) {
    await safePut(thDB, th as unknown as Record<string, unknown>);
  }

  // Seed order sets / clinical protocols (WHO/IMCI/ETAT/South Sudan STG).
  const osDB = orderSetsDB();
  const osNow = new Date().toISOString();
  for (const os of seedOrderSets) {
    await safePut(osDB, { ...os, createdAt: osNow, updatedAt: osNow, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // ── Today's bookings for Dr. Peter's assigned patients ────────────────────
  // careAssignments hands pat-00021/pat-00025 to clinician.peter; give each an
  // actual appointment with him today so the dashboard worklist status comes
  // from a real booking instead of the "scheduled" fallback label.
  {
    const apDB = appointmentsDB();
    const peterAssigned = [
      { p: patients[20], time: '15:30', end: '16:00', status: 'checked_in', reason: 'New OPD consult — abdominal pain', dept: 'Outpatient' },
      { p: patients[24], time: '16:15', end: '16:45', status: 'scheduled', reason: 'Wound review — surgical follow-up', dept: 'Surgery' },
    ];
    for (let i = 0; i < peterAssigned.length; i++) {
      const { p, time, end, status, reason, dept } = peterAssigned[i];
      if (!p) continue;
      const name = `${p.firstName} ${p.middleName ? p.middleName + ' ' : ''}${p.surname}`.replace(/\s+/g, ' ').trim();
      await safePut(apDB, {
        _id: `appointment-peter-assigned-${i + 1}`, type: 'appointment',
        patientId: p.id, patientName: name, patientPhone: p.phone || '',
        providerId: 'user-clinician.peter', providerName: 'Dr. Peter Garang Deng',
        facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national',
        appointmentDate: dateAgo(0), appointmentTime: time, endTime: end, duration: 30,
        appointmentType: 'general', priority: 'routine', department: dept, reason,
        status, ...(status === 'checked_in' ? { checkedInAt: daysAgo(0) } : {}),
        reminderSent: true, reminderChannel: 'sms', isRecurring: false,
        bookedBy: 'user-desk.amira', bookedByName: 'Amira Juma Hassan',
        state: 'Central Equatoria', county: 'Juba',
        orgId: PUBLIC_ORG_ID, createdAt: daysAgo(1), updatedAt: daysAgo(0),
      } as unknown as Record<string, unknown>);
    }
  }

  // ── Blood bank inventory ──────────────────────────────────────────────────
  // Without stock the Blood Bank screen renders an all-zero availability grid
  // for every role. Juba carries a realistic mixed inventory; Wau a thinner
  // state-hospital one. All units screen-negative; a couple are mid-workflow
  // (reserved / crossmatched) so the status filters have something to show.
  {
    const bbDB = bloodBankDB();
    const BB_FACILITIES = [
      { fid: 'hosp-001', fname: 'Juba Teaching Hospital', prefix: 'JTH', stock: { 'O+': 8, 'O-': 2, 'A+': 6, 'A-': 1, 'B+': 4, 'B-': 1, 'AB+': 2, 'AB-': 1 } },
      { fid: 'hosp-002', fname: 'Wau State Hospital', prefix: 'WSH', stock: { 'O+': 3, 'A+': 2, 'B+': 1 } },
    ] as const;
    const BB_COMPONENTS = ['whole_blood', 'whole_blood', 'packed_rbc', 'whole_blood', 'packed_rbc', 'platelets'] as const;
    for (const fac of BB_FACILITIES) {
      let unitSeq = 0;
      for (const [group, count] of Object.entries(fac.stock)) {
        for (let u = 0; u < count; u++) {
          unitSeq += 1;
          const collectedDaysAgo = (unitSeq * 3) % 21; // spread over the last 3 weeks
          // Whole blood keeps ~35 days from collection — all seeded units are in date.
          const status = unitSeq % 9 === 0 ? 'reserved' : unitSeq % 7 === 0 ? 'crossmatched' : 'available';
          await safePut(bbDB, {
            _id: `blood-${fac.fid}-${group.replace('+', 'pos').replace('-', 'neg')}-${u + 1}`,
            type: 'blood_bank',
            unitId: `${fac.prefix}-BB-${String(unitSeq).padStart(4, '0')}`,
            bloodGroup: group,
            component: BB_COMPONENTS[unitSeq % BB_COMPONENTS.length],
            volume: 450,
            collectionDate: dateAgo(collectedDaysAgo),
            expiryDate: dateFromNow(35 - collectedDaysAgo),
            status,
            ...(status === 'crossmatched' ? { crossmatchResult: 'compatible' } : {}),
            facilityId: fac.fid, facilityName: fac.fname,
            screeningResults: { hiv: false, hepatitisB: false, hepatitisC: false, syphilis: false, malaria: false },
            orgId: PUBLIC_ORG_ID,
            createdAt: daysAgo(collectedDaysAgo), updatedAt: daysAgo(collectedDaysAgo),
          } as unknown as Record<string, unknown>);
        }
      }
    }
  }

  await markSeeded();
}

/**
 * Seeded clinical protocols. Lab names are written to match the default lab
 * catalog; any unmatched name is added as a custom lab when applied. Drug doses
 * follow South Sudan / WHO standard treatment guidelines (illustrative — review
 * against the current national formulary before clinical use).
 */
const seedOrderSets: Omit<OrderSetDoc, '_rev' | 'createdAt' | 'updatedAt'>[] = [
  {
    _id: 'oset-malaria-uncomplicated-adult',
    type: 'order_set',
    name: 'Malaria — uncomplicated (adult)',
    category: 'malaria',
    source: 'South Sudan STG / WHO',
    ageGroup: 'adult',
    description: 'Confirmed uncomplicated P. falciparum in a non-pregnant adult.',
    diagnoses: [{ code: 'B54', label: 'Malaria, unspecified' }],
    labs: ['Malaria RDT', 'Malaria Microscopy', 'Full Blood Count'],
    medications: [
      { medication: 'Artemether-Lumefantrine 80/480mg', dose: '4 tablets', route: 'Oral', frequency: 'BD', duration: '3 days', instructions: 'Take with fatty food.', urgency: 'definitive' },
      { medication: 'Paracetamol 500mg', dose: '1g', route: 'Oral', frequency: 'QDS PRN', duration: '3 days', instructions: 'For fever.', urgency: 'definitive' },
    ],
    planText: 'Treat confirmed uncomplicated malaria. Advise on completing the full course. Return if unable to tolerate orals, persistent fever >48h, or danger signs.',
    isActive: true,
  },
  {
    _id: 'oset-malaria-severe',
    type: 'order_set',
    name: 'Malaria — severe / complicated',
    category: 'malaria',
    source: 'WHO severe malaria guidelines',
    ageGroup: 'all',
    description: 'Severe malaria — admit and start parenteral artesunate.',
    diagnoses: [{ code: 'B50', label: 'Plasmodium falciparum malaria' }],
    labs: ['Malaria RDT', 'Malaria Microscopy', 'Full Blood Count', 'Blood Glucose', 'Blood Group'],
    medications: [
      { medication: 'Artesunate', dose: '2.4 mg/kg', route: 'IV', frequency: 'at 0, 12, 24h then daily', duration: 'until oral tolerated', instructions: 'Switch to oral ACT once stable.', urgency: 'immediate', weightBased: true },
    ],
    planText: 'Admit. Parenteral artesunate, monitor glucose and consciousness, treat hypoglycaemia, manage convulsions. Step down to a full oral ACT course when able to tolerate orals.',
    isActive: true,
  },
  {
    _id: 'oset-pneumonia-paediatric',
    type: 'order_set',
    name: 'Pneumonia — paediatric (IMCI)',
    category: 'respiratory',
    source: 'WHO IMCI',
    ageGroup: 'paediatric',
    description: 'Fast breathing / chest-indrawing pneumonia in a child.',
    diagnoses: [{ code: 'J18', label: 'Pneumonia, unspecified' }],
    labs: ['Malaria RDT', 'Full Blood Count'],
    medications: [
      { medication: 'Amoxicillin 250mg dispersible', dose: '40 mg/kg', route: 'Oral', frequency: 'BD', duration: '5 days', instructions: 'Dose by weight band.', urgency: 'definitive', weightBased: true },
      { medication: 'Paracetamol', dose: '15 mg/kg', route: 'Oral', frequency: 'QDS PRN', duration: '3 days', instructions: 'For fever.', urgency: 'definitive', weightBased: true },
    ],
    planText: 'Treat as IMCI pneumonia. Counsel on danger signs (unable to drink, convulsions, chest indrawing worsening). Review in 3 days or sooner if worse.',
    isActive: true,
  },
  {
    _id: 'oset-diarrhoea-dehydration',
    type: 'order_set',
    name: 'Acute diarrhoea with some dehydration (Plan B)',
    category: 'diarrhoea',
    source: 'WHO IMCI Plan B',
    ageGroup: 'all',
    description: 'Acute watery diarrhoea with some dehydration.',
    diagnoses: [{ code: 'A09', label: 'Infectious gastroenteritis' }],
    labs: ['Stool Microscopy'],
    medications: [
      { medication: 'ORS (low osmolarity)', dose: '75 ml/kg over 4h', route: 'Oral', frequency: 'as directed', duration: 'until rehydrated', instructions: 'Reassess hydration after 4 hours.', urgency: 'immediate', weightBased: true },
      { medication: 'Zinc sulphate', dose: '20mg (10mg if <6mo)', route: 'Oral', frequency: 'OD', duration: '10–14 days', instructions: '', urgency: 'definitive' },
    ],
    planText: 'Rehydrate per WHO Plan B, continue feeding/breastfeeding, give zinc for 10–14 days. Escalate to Plan C if signs of severe dehydration.',
    isActive: true,
  },
  {
    _id: 'oset-anc-first-visit',
    type: 'order_set',
    name: 'ANC — first visit',
    category: 'maternal',
    source: 'WHO ANC / South Sudan',
    ageGroup: 'adult',
    description: 'Routine first antenatal visit booking bloods and prophylaxis.',
    diagnoses: [{ code: 'Z34', label: 'Supervision of normal pregnancy' }],
    labs: ['Haemoglobin', 'Blood Group', 'HIV Test', 'Syphilis (RPR)', 'Urinalysis', 'Malaria RDT'],
    medications: [
      { medication: 'Ferrous + Folic Acid', dose: '1 tablet', route: 'Oral', frequency: 'OD', duration: 'throughout pregnancy', instructions: '', urgency: 'definitive' },
      { medication: 'Sulfadoxine-Pyrimethamine (IPTp)', dose: '3 tablets', route: 'Oral', frequency: 'stat (dose 1)', duration: 'single dose', instructions: 'First of ≥3 doses, ≥1 month apart, from 2nd trimester.', urgency: 'definitive' },
      { medication: 'Tetanus-Diphtheria (Td)', dose: '0.5 ml', route: 'IM', frequency: 'stat', duration: 'single dose', instructions: 'Per Td schedule.', urgency: 'definitive' },
    ],
    planText: 'Booking visit: confirm gestation, screen, start iron/folate and IPTp, give Td, issue LLIN, counsel on danger signs and birth plan. Schedule next ANC contact.',
    isActive: true,
  },
  {
    _id: 'oset-etat-convulsing-child',
    type: 'order_set',
    name: 'ETAT — convulsing child',
    category: 'emergency',
    source: 'WHO ETAT',
    ageGroup: 'paediatric',
    description: 'Emergency management of the actively convulsing child.',
    diagnoses: [{ code: 'R56.8', label: 'Convulsions' }],
    labs: ['Blood Glucose', 'Malaria RDT'],
    medications: [
      { medication: 'Diazepam', dose: '0.5 mg/kg', route: 'Rectal', frequency: 'stat, may repeat once after 10 min', duration: 'once', instructions: 'IV 0.3 mg/kg if line available.', urgency: 'immediate', weightBased: true },
      { medication: 'Dextrose 10%', dose: '5 ml/kg', route: 'IV', frequency: 'stat if hypoglycaemic', duration: 'once', instructions: 'Give if glucose low / unable to measure.', urgency: 'immediate', weightBased: true },
    ],
    planText: 'ETAT: position airway, give oxygen, stop the convulsion (rectal/IV diazepam), check and treat hypoglycaemia, treat the underlying cause (malaria, meningitis). Admit.',
    isActive: true,
  },
];
