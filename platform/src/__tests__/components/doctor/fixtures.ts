/**
 * Fixture builders for the doctor-module tests (worklist assembly, signing
 * inbox, lane grouping). Every builder fills in the type's required fields
 * with plausible defaults so a test only has to spell out what it's actually
 * varying.
 */
import type {
  AppointmentDoc,
  AssessmentDoc,
  MedicalRecordDoc,
  PatientDoc,
  PatientTransferDoc,
  PhoneNoteDoc,
  ReferralDoc,
  TriageDoc,
} from '@/lib/db-types';
import type { ClinicalNoteDoc } from '@/lib/clinical-notes/types';
import type { ResumableEncounter } from '@/lib/hooks/useResumableEncounters';

let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}
export function resetFixtureSeq(): void {
  seq = 0;
}

export function makePatient(overrides: Partial<PatientDoc> = {}): PatientDoc {
  const _id = overrides._id || nextId('patient');
  return {
    _id,
    type: 'patient',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    hospitalNumber: `JTH-${_id}`,
    firstName: 'Test',
    middleName: '',
    surname: 'Patient',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    phone: '+211900000000',
    state: 'Central Equatoria',
    county: 'Juba',
    tribe: 'Dinka',
    primaryLanguage: 'Dinka',
    bloodType: 'O+',
    allergies: [],
    chronicConditions: [],
    nokName: 'Next Of Kin',
    nokRelationship: 'Sibling',
    nokPhone: '+211900000001',
    registrationHospital: 'hosp-001',
    registrationDate: '2026-08-01',
    lastVisitDate: '2026-08-01',
    lastVisitHospital: 'hosp-001',
    isActive: true,
    orgId: 'org-001',
    ...overrides,
  } as PatientDoc;
}

export function makeTriage(overrides: Partial<TriageDoc> = {}): TriageDoc {
  const _id = overrides._id || nextId('triage');
  return {
    _id,
    type: 'triage',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: overrides.patientId || 'patient-1',
    patientName: 'Test Patient',
    airway: 'clear',
    breathing: 'normal',
    circulation: 'normal',
    consciousness: 'alert',
    priority: 'GREEN',
    triagedBy: 'nurse-1',
    triagedByName: 'Nurse Stella',
    triagedAt: '2026-08-04T08:00:00.000Z',
    status: 'pending',
    ...overrides,
  } as TriageDoc;
}

export function makeAppointment(overrides: Partial<AppointmentDoc> = {}): AppointmentDoc {
  const _id = overrides._id || nextId('appt');
  return {
    _id,
    type: 'appointment',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    patientName: 'Test Patient',
    providerId: 'doctor-1',
    providerName: 'Dr. Test',
    appointmentDate: '2026-08-04',
    appointmentTime: '09:00',
    duration: 20,
    appointmentType: 'consultation',
    status: 'scheduled',
    priority: 'routine',
    reason: 'Follow-up',
    department: 'OPD',
    ...overrides,
  } as AppointmentDoc;
}

export function makeMedicalRecord(overrides: Partial<MedicalRecordDoc> = {}): MedicalRecordDoc {
  const _id = overrides._id || nextId('rec');
  return {
    _id,
    type: 'medical_record',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    hospitalId: 'hosp-001',
    hospitalName: 'Juba Teaching Hospital',
    visitDate: '2026-08-04',
    consultedAt: '2026-08-04T08:00:00.000Z',
    visitType: 'outpatient',
    providerName: 'Dr. Test',
    providerRole: 'doctor',
    department: 'General Medicine',
    chiefComplaint: 'Fever',
    diagnoses: [],
    prescriptions: [],
    labResults: [],
    ...overrides,
  } as unknown as MedicalRecordDoc;
}

export function makeAssessment(overrides: Partial<AssessmentDoc> = {}): AssessmentDoc {
  const _id = overrides._id || nextId('asmt');
  return {
    _id,
    type: 'assessment',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    instrumentId: 'phq9',
    instrumentName: 'PHQ-9',
    answers: {},
    totalScore: 0,
    answeredCount: 0,
    questionCount: 9,
    documentStatus: 'held',
    ...overrides,
  } as AssessmentDoc;
}

export function makeClinicalNote(overrides: Partial<ClinicalNoteDoc> = {}): ClinicalNoteDoc {
  const _id = overrides._id || nextId('note');
  return {
    _id,
    type: 'clinical_note',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    patientName: 'Test Patient',
    noteType: 'soap',
    sections: [],
    serviceDate: '2026-08-04',
    status: 'draft',
    ...overrides,
  } as unknown as ClinicalNoteDoc;
}

export function makeReferral(overrides: Partial<ReferralDoc> = {}): ReferralDoc {
  const _id = overrides._id || nextId('ref');
  return {
    _id,
    type: 'referral',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    patientName: 'Test Patient',
    reason: 'Specialist review',
    fromHospital: 'Juba Teaching Hospital',
    toHospital: 'Juba Referral Hospital',
    status: 'sent',
    createdBy: 'doctor-1',
    referralDate: '2026-08-04',
    ...overrides,
  } as unknown as ReferralDoc;
}

export function makePhoneNote(overrides: Partial<PhoneNoteDoc> = {}): PhoneNoteDoc {
  const _id = overrides._id || nextId('phonenote');
  return {
    _id,
    type: 'phone_note',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    patientName: 'Test Patient',
    subject: 'Callback',
    message: 'Please call back',
    status: 'open',
    ...overrides,
  } as PhoneNoteDoc;
}

export function makeTransfer(overrides: Partial<PatientTransferDoc> = {}): PatientTransferDoc {
  const _id = overrides._id || nextId('xfer');
  return {
    _id,
    type: 'patient_transfer',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    patientName: 'Test Patient',
    transferType: 'internal',
    status: 'requested',
    urgency: 'routine',
    from: {},
    to: {},
    reason: 'Escalation',
    requestedAt: '2026-08-04T08:00:00.000Z',
    ...overrides,
  } as unknown as PatientTransferDoc;
}

export function makeResumableEncounter(overrides: Partial<ResumableEncounter> = {}): ResumableEncounter {
  const _id = overrides._id || nextId('enc');
  return {
    _id,
    type: 'encounter',
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-04T08:00:00.000Z',
    patientId: 'patient-1',
    patientName: 'Test Patient',
    resultsReady: 0,
    resultsTotal: 1,
    allResultsBack: false,
    ...overrides,
  } as unknown as ResumableEncounter;
}
