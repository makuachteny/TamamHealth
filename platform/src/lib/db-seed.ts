import { hashPassword } from './auth';
import {
  usersDB, patientsDB, hospitalsDB, referralsDB,
  diseaseAlertsDB, labResultsDB, prescriptionsDB, medicalRecordsDB,
  messagesDB, birthsDB, deathsDB, facilityAssessmentsDB,
  immunizationsDB, ancDB, bomaVisitsDB, followUpsDB,
  organizationsDB,
  paymentsDB, insurancePoliciesDB, chargesDB, claimsDB,
  paymentPlansDB, ledgerDB,
  isSeeded, markSeeded, resetAllDatabases
} from './db';
// `@/data/mock` carries 88 KB of fake patient PHI (50+ patient records, fake
// hospitals, sample referrals/alerts). It is imported dynamically inside the
// demo branch only — a static value-import here would bundle that PHI into
// every production build, even though the production seed never uses it.
import type {
  UserDoc, PatientDoc, HospitalDoc, ReferralDoc,
  DiseaseAlertDoc, LabResultDoc, PrescriptionDoc, MedicalRecordDoc, MessageDoc,
  BirthRegistrationDoc, DeathRegistrationDoc, FacilityAssessmentDoc,
  ImmunizationDoc, ANCVisitDoc, BomaVisitDoc, FollowUpDoc, OrganizationDoc
} from './db-types';
import type {
  PaymentDoc, InsurancePolicyDoc, ChargeDoc, ClaimDoc,
  PaymentPlanDoc, LedgerEntryDoc
} from './db-types-payments';

// Default org IDs
const PUBLIC_ORG_ID = 'org-moh-ss';
const PRIVATE_ORG_ID = 'org-mercy-hospital';

const defaultOrganizations: Omit<OrganizationDoc, '_rev'>[] = [
  {
    _id: PUBLIC_ORG_ID,
    type: 'organization',
    name: 'Republic of South Sudan',
    slug: 'moh-ss',
    primaryColor: '#1B9AAA',
    secondaryColor: '#1E4D4A',
    accentColor: '#1B9AAA',
    subscriptionStatus: 'active',
    subscriptionPlan: 'enterprise',
    maxUsers: 1000,
    maxHospitals: 200,
    featureFlags: { epidemicIntelligence: true, mchAnalytics: true, dhis2Export: true, aiClinicalSupport: true, communityHealth: true, facilityAssessments: true },
    orgType: 'public',
    contactEmail: 'admin@moh.gov.ss',
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
    primaryColor: '#7C3AED',
    secondaryColor: '#4F46E5',
    accentColor: '#A78BFA',
    subscriptionStatus: 'active',
    subscriptionPlan: 'professional',
    maxUsers: 50,
    maxHospitals: 5,
    featureFlags: { epidemicIntelligence: false, mchAnalytics: true, dhis2Export: false, aiClinicalSupport: true, communityHealth: false, facilityAssessments: false },
    orgType: 'private',
    contactEmail: 'admin@mercyhospital.org',
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
  | 'super_admin' | 'government' | 'doctor' | 'clinical_officer' | 'nurse'
  | 'lab_tech' | 'pharmacist' | 'front_desk' | 'boma_health_worker'
  | 'payam_supervisor' | 'data_entry_clerk' | 'medical_superintendent'
  | 'hrio' | 'community_health_volunteer' | 'nutritionist' | 'radiologist'
  | 'org_admin';

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
  { username: 'nurse.stella', name: 'Nurse Stella Keji Lemi', role: 'nurse', hospitalId: 'hosp-003', hospitalName: 'Malakal Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'lab.gatluak', name: 'Lab Tech Gatluak Puok', role: 'lab_tech', hospitalId: 'hosp-004', hospitalName: 'Bentiu State Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'pharma.rose', name: 'Pharmacist Rose Gbudue', role: 'pharmacist', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'desk.amira', name: 'Amira Juma Hassan', role: 'front_desk', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'bhw.akol', name: 'Akol Deng Mading', role: 'boma_health_worker', hospitalId: 'phcu-001', hospitalName: 'Kajo-keji Boma PHCU', orgId: PUBLIC_ORG_ID },
  { username: 'sup.mary', name: 'Mary Lado Kenyi', role: 'payam_supervisor', hospitalId: 'phcc-001', hospitalName: 'Kajo-keji PHCC', orgId: PUBLIC_ORG_ID },
  { username: 'data.ayen', name: 'Ayen Dut Malual', role: 'data_entry_clerk', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'supt.lado', name: 'Dr. Lado Tombe Kenyi', role: 'medical_superintendent', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'hrio.dut', name: 'Dut Machar Kuol', role: 'hrio', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'chv.ajak', name: 'Ajak Deng Mawien', role: 'community_health_volunteer', hospitalId: 'phcu-001', hospitalName: 'Kajo-keji Boma PHCU', orgId: PUBLIC_ORG_ID },
  { username: 'nutr.nyabol', name: 'Nyabol Koang Jal', role: 'nutritionist', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  { username: 'rad.tamamhealth', name: 'TamamHealth Ladu Soro', role: 'radiologist', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PUBLIC_ORG_ID },
  // Private org admin (Mercy Hospital Group)
  { username: 'org.admin', name: 'Mercy Org Administrator', role: 'org_admin', orgId: PRIVATE_ORG_ID },
  { username: 'dr.mercy', name: 'Dr. Grace Lado', role: 'doctor', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', orgId: PRIVATE_ORG_ID },
];

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

const labOrders: Omit<LabResultDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'lab-001', type: 'lab_result', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', hospitalNumber: 'JTH-000001', testName: 'Malaria RDT', specimen: 'Blood', status: 'completed', result: 'Positive (P. falciparum)', unit: '', referenceRange: 'Negative', abnormal: true, critical: false, orderedBy: 'Dr. James Wani Igga', orderedAt: '2026-02-09 08:30', completedAt: '2026-02-09 09:15', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T08:30:00Z', updatedAt: '2026-02-09T09:15:00Z' },
  { _id: 'lab-002', type: 'lab_result', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', hospitalNumber: 'JTH-000005', testName: 'Full Blood Count', specimen: 'Blood (EDTA)', status: 'completed', result: 'Hb 7.2 g/dL, WBC 14.3\u00d710\u00b3/\u03bcL', unit: '', referenceRange: '', abnormal: true, critical: false, orderedBy: 'Dr. Achol Mayen Deng', orderedAt: '2026-02-09 07:45', completedAt: '2026-02-09 10:30', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T07:45:00Z', updatedAt: '2026-02-09T10:30:00Z' },
  { _id: 'lab-003', type: 'lab_result', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', hospitalNumber: 'JTH-000012', testName: 'CD4 Count', specimen: 'Blood (EDTA)', status: 'in_progress', result: '', unit: '', referenceRange: '500-1500 cells/\u03bcL', abnormal: false, critical: false, orderedBy: 'Dr. TamamHealth Ladu Soro', orderedAt: '2026-02-09 09:00', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:00:00Z', updatedAt: '2026-02-09T09:00:00Z' },
  { _id: 'lab-004', type: 'lab_result', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', hospitalNumber: 'JTH-000018', testName: 'Blood Glucose (Fasting)', specimen: 'Blood', status: 'completed', result: '198 mg/dL', unit: 'mg/dL', referenceRange: '70-100', abnormal: true, critical: false, orderedBy: 'CO Deng Mabior Kuol', orderedAt: '2026-02-09 06:30', completedAt: '2026-02-09 07:00', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T06:30:00Z', updatedAt: '2026-02-09T07:00:00Z' },
  { _id: 'lab-005', type: 'lab_result', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', hospitalNumber: 'JTH-000022', testName: 'Hemoglobin', specimen: 'Blood', status: 'completed', result: '4.2 g/dL', unit: 'g/dL', referenceRange: '12.0-16.0', abnormal: true, critical: true, orderedBy: 'Dr. Nyamal Koang Jal', orderedAt: '2026-02-09 10:00', completedAt: '2026-02-09 10:45', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:00:00Z', updatedAt: '2026-02-09T10:45:00Z' },
  { _id: 'lab-006', type: 'lab_result', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', hospitalNumber: 'JTH-000030', testName: 'Liver Function Tests', specimen: 'Blood', status: 'pending', result: '', unit: '', referenceRange: '', abnormal: false, critical: false, orderedBy: 'Dr. James Wani Igga', orderedAt: '2026-02-09 11:00', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T11:00:00Z', updatedAt: '2026-02-09T11:00:00Z' },
  { _id: 'lab-007', type: 'lab_result', patientId: 'pat-00035', patientName: 'Ladu Tombe Keji', hospitalNumber: 'JTH-000035', testName: 'HIV Rapid Test', specimen: 'Blood', status: 'completed', result: 'Non-reactive', unit: '', referenceRange: 'Non-reactive', abnormal: false, critical: false, orderedBy: 'CO Stella Keji Lemi', orderedAt: '2026-02-09 08:00', completedAt: '2026-02-09 08:30', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T08:00:00Z', updatedAt: '2026-02-09T08:30:00Z' },
  { _id: 'lab-008', type: 'lab_result', patientId: 'pat-00040', patientName: 'Majok Chol Wol', hospitalNumber: 'JTH-000040', testName: 'Urinalysis', specimen: 'Urine', status: 'in_progress', result: '', unit: '', referenceRange: 'Normal', abnormal: false, critical: false, orderedBy: 'Dr. Rose Gbudue', orderedAt: '2026-02-09 09:30', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:30:00Z', updatedAt: '2026-02-09T09:30:00Z' },
  { _id: 'lab-009', type: 'lab_result', patientId: 'pat-00008', patientName: 'Ayen Dut Malual', hospitalNumber: 'JTH-000008', testName: 'Sputum AFB', specimen: 'Sputum', status: 'pending', result: '', unit: '', referenceRange: 'Negative', abnormal: false, critical: false, orderedBy: 'Dr. Gatluak Puok Riek', orderedAt: '2026-02-09 11:30', completedAt: '', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T11:30:00Z', updatedAt: '2026-02-09T11:30:00Z' },
  { _id: 'lab-010', type: 'lab_result', patientId: 'pat-00015', patientName: 'Tut Chuol Both', hospitalNumber: 'JTH-000015', testName: 'Renal Function', specimen: 'Blood', status: 'completed', result: 'Creatinine 1.8 mg/dL, BUN 45 mg/dL', unit: '', referenceRange: 'Cr 0.6-1.2, BUN 7-20', abnormal: true, critical: false, orderedBy: 'Dr. Achol Mayen Deng', orderedAt: '2026-02-08 14:00', completedAt: '2026-02-08 16:30', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-08T14:00:00Z', updatedAt: '2026-02-08T16:30:00Z' },
];

const prescriptionQueue: Omit<PrescriptionDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'rx-001', type: 'prescription', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', medication: 'Artemether-Lumefantrine (Coartem)', dose: '80/480mg BD x 3 days', route: 'Oral', frequency: 'BD', duration: '3 days', prescribedBy: 'Dr. James Wani Igga', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:15:00Z', updatedAt: '2026-02-09T09:15:00Z' },
  { _id: 'rx-002', type: 'prescription', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', medication: 'Ferrous Sulfate + Folic Acid', dose: '200mg OD x 30 days', route: 'Oral', frequency: 'OD', duration: '30 days', prescribedBy: 'Dr. Achol Mayen Deng', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T09:30:00Z', updatedAt: '2026-02-09T09:30:00Z' },
  { _id: 'rx-003', type: 'prescription', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', medication: 'TDF/3TC/DTG', dose: '300/300/50mg OD x 90 days', route: 'Oral', frequency: 'OD', duration: '90 days', prescribedBy: 'Dr. TamamHealth Ladu Soro', status: 'dispensed', dispensedAt: '2026-02-09T10:30:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:00:00Z', updatedAt: '2026-02-09T10:30:00Z' },
  { _id: 'rx-004', type: 'prescription', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', medication: 'Metformin', dose: '500mg BD x 30 days', route: 'Oral', frequency: 'BD', duration: '30 days', prescribedBy: 'CO Deng Mabior Kuol', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:15:00Z', updatedAt: '2026-02-09T10:15:00Z' },
  { _id: 'rx-005', type: 'prescription', patientId: 'pat-00022', patientName: 'Kuol Akot Ajith', medication: 'Paracetamol', dose: '1g QDS PRN x 5 days', route: 'Oral', frequency: 'QDS PRN', duration: '5 days', prescribedBy: 'Dr. Nyamal Koang Jal', status: 'dispensed', dispensedAt: '2026-02-09T11:00:00Z', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T10:45:00Z', updatedAt: '2026-02-09T11:00:00Z' },
  { _id: 'rx-006', type: 'prescription', patientId: 'pat-00030', patientName: 'Achol Mayen Ring', medication: 'Amoxicillin', dose: '500mg TDS x 7 days', route: 'Oral', frequency: 'TDS', duration: '7 days', prescribedBy: 'Dr. James Wani Igga', status: 'pending', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital', createdAt: '2026-02-09T11:00:00Z', updatedAt: '2026-02-09T11:00:00Z' },
];

const seedMessages: Omit<MessageDoc, '_rev' | 'createdBy'>[] = [
  {
    _id: 'msg-001', type: 'message', patientId: 'pat-00001', patientName: 'Deng Mabior Garang', patientPhone: '+211-912-345-678',
    fromDoctorId: 'user-dr.wani', fromDoctorName: 'Dr. James Wani Igga', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Medication Reminder', body: 'Please remember to take your Coartem medication with food. Come back on 16 Feb for follow-up.',
    channel: 'both', status: 'delivered', sentAt: '2026-02-09T10:30:00Z', createdAt: '2026-02-09T10:30:00Z', updatedAt: '2026-02-09T10:30:00Z',
  },
  {
    _id: 'msg-002', type: 'message', patientId: 'pat-00005', patientName: 'Nyamal Koang Gatdet', patientPhone: '+211-912-555-005',
    fromDoctorId: 'user-dr.achol', fromDoctorName: 'Dr. Achol Mayen Deng', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Lab Results Ready', body: 'Your lab results are ready. Please visit the hospital to discuss them with your doctor.',
    channel: 'app', status: 'sent', sentAt: '2026-02-09T11:00:00Z', createdAt: '2026-02-09T11:00:00Z', updatedAt: '2026-02-09T11:00:00Z',
  },
  {
    _id: 'msg-003', type: 'message', patientId: 'pat-00012', patientName: 'Gatluak Ruot Nyuon', patientPhone: '+211-912-555-012',
    fromDoctorId: 'user-dr.wani', fromDoctorName: 'Dr. James Wani Igga', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Follow-up Appointment', body: 'Please come for your follow-up appointment on 20 Feb. Bring your medication card.',
    channel: 'sms', status: 'delivered', sentAt: '2026-02-08T14:00:00Z', createdAt: '2026-02-08T14:00:00Z', updatedAt: '2026-02-08T14:00:00Z',
  },
  {
    _id: 'msg-004', type: 'message', patientId: 'pat-00018', patientName: 'Rose Tombura Gbudue', patientPhone: '+211-912-555-018',
    fromDoctorId: 'user-dr.achol', fromDoctorName: 'Dr. Achol Mayen Deng', fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Medicine Ready', body: 'Your medicine is ready at the pharmacy. Please collect it today before 5 PM.',
    channel: 'both', status: 'sent', sentAt: '2026-02-09T09:00:00Z', createdAt: '2026-02-09T09:00:00Z', updatedAt: '2026-02-09T09:00:00Z',
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

const seedImmunizations: Omit<ImmunizationDoc, '_rev' | 'createdBy'>[] = [
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

// Boma Health Worker visit seed data
const seedBomaVisits: Omit<BomaVisitDoc, '_rev' | 'createdBy'>[] = [
  { _id: 'boma-visit-001', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1001', patientName: 'Ayen Dut Malual', patientAge: 34, patientGender: 'Female', visitDate: new Date().toISOString(), chiefComplaint: 'Malaria', suspectedCondition: 'Malaria', icd11Code: '1A42', action: 'treated', treatmentGiven: 'Coartem + Paracetamol', outcome: 'unknown', followUpRequired: true, nextFollowUp: new Date(Date.now() + 3 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: 'boma-visit-002', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1012', patientName: 'Ladu Tombe Keji', patientAge: 28, patientGender: 'Male', visitDate: new Date().toISOString(), chiefComplaint: 'Injury', suspectedCondition: 'Injury', action: 'referred', referredTo: 'Nearest PHCU', outcome: 'unknown', followUpRequired: true, nextFollowUp: new Date(Date.now() + 2 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: 'boma-visit-003', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1007', patientName: 'Rose Gbudue', patientAge: 25, patientGender: 'Female', visitDate: new Date().toISOString(), chiefComplaint: 'Pregnancy Issue', suspectedCondition: 'Pregnancy complication', action: 'referred', referredTo: 'Juba Teaching Hospital', outcome: 'unknown', followUpRequired: true, nextFollowUp: new Date(Date.now() + 1 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: 'boma-visit-004', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1019', patientName: 'Majok Chol Wol', patientAge: 5, patientGender: 'Male', visitDate: new Date().toISOString(), chiefComplaint: 'Diarrhea', suspectedCondition: 'Diarrhea', icd11Code: 'DA90', action: 'treated', treatmentGiven: 'ORS + Zinc', outcome: 'unknown', followUpRequired: true, nextFollowUp: new Date(Date.now() + 2 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: 'boma-visit-005', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1031', patientName: 'Gatluak Puok', patientAge: 42, patientGender: 'Male', visitDate: new Date().toISOString(), chiefComplaint: 'Malaria', suspectedCondition: 'Malaria', icd11Code: '1A42', action: 'treated', treatmentGiven: 'Coartem', outcome: 'unknown', followUpRequired: true, nextFollowUp: new Date(Date.now() + 3 * 86400000).toISOString(), state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Older visits (previous days)
  { _id: 'boma-visit-006', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1003', patientName: 'Achol Deng', patientAge: 18, patientGender: 'Female', visitDate: new Date(Date.now() - 3 * 86400000).toISOString(), chiefComplaint: 'Malaria', suspectedCondition: 'Malaria', action: 'treated', treatmentGiven: 'Coartem', outcome: 'unknown', followUpRequired: true, state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { _id: 'boma-visit-007', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1015', patientName: 'Kuol Mabior', patientAge: 3, patientGender: 'Male', visitDate: new Date(Date.now() - 5 * 86400000).toISOString(), chiefComplaint: 'Diarrhea', suspectedCondition: 'Diarrhea', action: 'treated', treatmentGiven: 'ORS', outcome: 'unknown', followUpRequired: true, state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { _id: 'boma-visit-008', type: 'boma_visit', workerId: 'user-bhw.akol', workerName: 'Akol Deng Mading', assignedBoma: 'KJ', geocodeId: 'BOMA-KJ-HH1022', patientName: 'Nyamal Gatdet', patientAge: 2, patientGender: 'Female', visitDate: new Date(Date.now() - 7 * 86400000).toISOString(), chiefComplaint: 'Malnutrition', suspectedCondition: 'Malnutrition', icd11Code: '5B71', action: 'referred', referredTo: 'Nearest PHCU', outcome: 'unknown', followUpRequired: true, state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
];

// Follow-up seed data (pending follow-ups for BHW)
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
  { _id: 'pat-00057', type: 'patient', firstName: 'Achol', middleName: 'Mayen', surname: 'Garang', gender: 'Female', dateOfBirth: '2002-03-15', age: 24, phone: '+211-912-555-057', registrationHospital: 'hosp-001', registrationHospitalName: 'Juba Teaching Hospital', hospitalNumber: 'JTH-000057', state: 'Central Equatoria', county: 'Juba', payam: '', boma: '', geocodeId: '', createdAt: '2025-10-15T09:00:00Z', updatedAt: '2025-10-15T09:00:00Z' },
  { _id: 'pat-00058', type: 'patient', firstName: 'Nyakuoth', middleName: 'Koang', surname: 'Jal', gender: 'Female', dateOfBirth: '1996-01-20', age: 30, phone: '+211-912-555-058', registrationHospital: 'hosp-004', registrationHospitalName: 'Bentiu State Hospital', hospitalNumber: 'BSH-000003', state: 'Unity', county: 'Rubkona', payam: '', boma: '', geocodeId: '', createdAt: '2025-11-01T08:00:00Z', updatedAt: '2025-11-01T08:00:00Z' },
  { _id: 'pat-00059', type: 'patient', firstName: 'Abuk', middleName: 'Deng', surname: 'Mading', gender: 'Female', dateOfBirth: '1994-06-10', age: 32, phone: '+211-912-555-059', registrationHospital: 'hosp-002', registrationHospitalName: 'Wau State Hospital', hospitalNumber: 'WSH-000002', state: 'Western Bahr el Ghazal', county: 'Wau', payam: '', boma: '', geocodeId: '', createdAt: '2025-09-20T09:00:00Z', updatedAt: '2025-09-20T09:00:00Z' },
  { _id: 'pat-00060', type: 'patient', firstName: 'Nyandit', middleName: 'Dut', surname: 'Malual', gender: 'Female', dateOfBirth: '2000-08-05', age: 26, phone: '+211-912-555-060', registrationHospital: 'hosp-003', registrationHospitalName: 'Malakal Teaching Hospital', hospitalNumber: 'MTH-000002', state: 'Upper Nile', county: 'Malakal', payam: '', boma: '', geocodeId: '', createdAt: '2026-01-05T08:00:00Z', updatedAt: '2026-01-05T08:00:00Z' },
  { _id: 'pat-00061', type: 'patient', firstName: 'Awut', middleName: 'Makuei', surname: 'Lual', gender: 'Female', dateOfBirth: '2004-04-12', age: 22, phone: '+211-912-555-061', registrationHospital: 'hosp-005', registrationHospitalName: 'Bor State Hospital', hospitalNumber: 'BSH-000004', state: 'Jonglei', county: 'Bor South', payam: '', boma: '', geocodeId: '', createdAt: '2025-12-10T10:00:00Z', updatedAt: '2025-12-10T10:00:00Z' },
  { _id: 'pat-00062', type: 'patient', firstName: 'Nyandeng', middleName: 'Chol', surname: 'Wol', gender: 'Female', dateOfBirth: '1998-11-25', age: 28, phone: '+211-912-555-062', registrationHospital: 'hosp-001', registrationHospitalName: 'Juba Teaching Hospital', hospitalNumber: 'JTH-000062', state: 'Central Equatoria', county: 'Juba', payam: '', boma: '', geocodeId: '', createdAt: '2025-08-01T10:00:00Z', updatedAt: '2025-08-01T10:00:00Z' },
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

const seedCharges: Omit<ChargeDoc, '_rev' | 'createdBy'>[] = [
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
  { _id: 'chg-014', type: 'charge', encounterId: 'enc-pay-005', patientId: 'pat-00022', description: 'Inpatient Admission (3 days)', category: 'inpatient', units: 3, billedAmount: 30000, status: 'approved', serviceDate: '2026-03-01', providerId: 'user-dr.wani', providerName: 'Dr. James Wani Igga', facilityId: 'hosp-001', createdAt: '2026-03-01T06:00:00Z', updatedAt: '2026-03-01T06:00:00Z' },
  { _id: 'chg-015', type: 'charge', encounterId: 'enc-pay-005', patientId: 'pat-00022', description: 'Blood Transfusion (2 units)', category: 'procedure', units: 2, billedAmount: 20000, status: 'approved', serviceDate: '2026-03-01', providerId: 'user-dr.achol', providerName: 'Dr. Achol Mayen Deng', facilityId: 'hosp-001', createdAt: '2026-03-01T08:00:00Z', updatedAt: '2026-03-01T08:00:00Z' },
  { _id: 'chg-016', type: 'charge', encounterId: 'enc-pay-005', patientId: 'pat-00022', description: 'Hemoglobin Test', category: 'laboratory', units: 1, billedAmount: 2000, status: 'approved', serviceDate: '2026-03-01', providerId: 'user-lab.gatluak', providerName: 'Lab Tech Gatluak Puok', facilityId: 'hosp-001', createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z' },
];

const seedInsurancePolicies: Omit<InsurancePolicyDoc, '_rev' | 'createdBy'>[] = [
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

const seedClaims: Omit<ClaimDoc, '_rev' | 'createdBy'>[] = [
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

const seedPayments: Omit<PaymentDoc, '_rev' | 'createdBy'>[] = [
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
    mobileMoneyPhone: '+211-955-123-456',
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

const seedPaymentPlans: Omit<PaymentPlanDoc, '_rev' | 'createdBy'>[] = [
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

const seedLedgerEntries: Omit<LedgerEntryDoc, '_rev' | 'createdBy'>[] = [
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
    primaryColor: '#1B9AAA',
    secondaryColor: '#1E4D4A',
    accentColor: '#1B9AAA',
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
    contactEmail: process.env.NEXT_PUBLIC_ORG_EMAIL || 'admin@organization.org',
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

export async function seedDatabase(): Promise<void> {
  if (await isSeeded()) {
    // Run photo migration on already-seeded databases so existing installs
    // pick up the new photoUrl field without requiring a reset.
    await migratePatientPhotos();
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
  // Stale or missing seed — wipe all databases and re-seed fresh
  await resetAllDatabases();

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
  for (const u of defaultUsers) {
    const plaintext = credentials[u.username];
    if (!plaintext) {
      console.warn(`[db-seed] skipping ${u.username} — no credential returned by /api/demo-credentials`);
      continue;
    }
    const hash = await hashPassword(plaintext);
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

  // Seed patients (all public org by default)
  const pDB = patientsDB();
  for (const p of patients) {
    const doc: PatientDoc = {
      _id: p.id,
      type: 'patient',
      ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'id')),
      orgId: PUBLIC_ORG_ID,
      createdAt: now,
      updatedAt: now,
    } as PatientDoc;
    await safePut(pDB, doc as unknown as Record<string, unknown>);
  }

  // Seed child patients (linked to immunization records)
  for (const child of childPatients) {
    await safePut(pDB, { ...child, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed mother patients (linked to ANC records)
  for (const mother of motherPatients) {
    await safePut(pDB, { ...mother, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
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

  // Seed disease alerts (all public org)
  const daDB = diseaseAlertsDB();
  for (const a of diseaseAlerts) {
    const doc: DiseaseAlertDoc = {
      _id: a.id,
      type: 'disease_alert',
      ...Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'id')),
      createdAt: now,
      updatedAt: now,
    } as DiseaseAlertDoc;
    await safePut(daDB, doc as unknown as Record<string, unknown>);
  }

  // Seed lab results (all public org)
  const lDB = labResultsDB();
  for (const l of labOrders) {
    await safePut(lDB, { ...l, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed prescriptions (all public org)
  const rxDB = prescriptionsDB();
  for (const rx of prescriptionQueue) {
    await safePut(rxDB, { ...rx, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
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

  // Seed messages (all public org)
  const msgDB = messagesDB();
  for (const msg of seedMessages) {
    await safePut(msgDB, { ...msg, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed births (all public org)
  const bDB = birthsDB();
  for (const b of seedBirths) {
    await safePut(bDB, { ...b, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
  }

  // Seed deaths (all public org)
  const dDB = deathsDB();
  for (const d of seedDeaths) {
    await safePut(dDB, { ...d, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
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

  // Seed boma visits (all public org)
  const bvDB = bomaVisitsDB();
  for (const bv of seedBomaVisits) {
    await safePut(bvDB, { ...bv, orgId: PUBLIC_ORG_ID } as unknown as Record<string, unknown>);
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
    await safePut(ledDB, led as unknown as Record<string, unknown>);
  }

  await markSeeded();
}
