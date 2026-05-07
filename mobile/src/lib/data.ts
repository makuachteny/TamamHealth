/**
 * Offline demo data for the TamamHealth Patient mobile app.
 * Matches the same seed data used in the platform's PouchDB.
 * In production, this would be replaced with API calls or local SQLite.
 */

import type {
  MedicalRecord, LabResult, Prescription, Appointment,
  Immunization, Message, Payment, Charge,
} from './types';

// ---- Medical Records (for patient pat-00001 Deng Mabior Garang) ----

export const medicalRecords: MedicalRecord[] = [
  {
    _id: 'mr-001',
    patientId: 'pat-00001',
    visitType: 'OPD Consultation',
    chiefComplaint: 'Fever, headache, and body aches for 3 days',
    diagnoses: [
      { name: 'Malaria (P. falciparum)', icd11Code: '1F40', severity: 'moderate' },
    ],
    vitalSigns: {
      temperature: 38.7,
      pulse: 98,
      bloodPressure: '130/85',
      respiratoryRate: 22,
      weight: 72,
      oxygenSaturation: 96,
    },
    consultedByName: 'Dr. James Wani Igga',
    facilityName: 'Juba Teaching Hospital',
    createdAt: '2026-02-09T08:30:00Z',
  },
  {
    _id: 'mr-002',
    patientId: 'pat-00001',
    visitType: 'Follow-up',
    chiefComplaint: 'Follow-up for malaria treatment — feeling better',
    diagnoses: [
      { name: 'Malaria — resolving', icd11Code: '1F40' },
      { name: 'Hypertension', icd11Code: 'BA00', severity: 'mild' },
    ],
    vitalSigns: {
      temperature: 37.1,
      pulse: 82,
      bloodPressure: '140/90',
      weight: 72,
      oxygenSaturation: 98,
    },
    consultedByName: 'Dr. James Wani Igga',
    facilityName: 'Juba Teaching Hospital',
    createdAt: '2026-02-16T10:00:00Z',
  },
  {
    _id: 'mr-003',
    patientId: 'pat-00001',
    visitType: 'Annual Check-up',
    chiefComplaint: 'Routine annual health check',
    diagnoses: [
      { name: 'Essential hypertension', icd11Code: 'BA00', severity: 'mild' },
    ],
    vitalSigns: {
      temperature: 36.8,
      pulse: 76,
      bloodPressure: '135/88',
      weight: 73,
      oxygenSaturation: 99,
    },
    consultedByName: 'Dr. Achol Mayen Deng',
    facilityName: 'Juba Teaching Hospital',
    createdAt: '2026-01-15T09:00:00Z',
  },
];

// ---- Lab Results ----

export const labResults: LabResult[] = [
  {
    _id: 'lab-001',
    patientId: 'pat-00001',
    testName: 'Malaria RDT',
    specimen: 'Blood',
    status: 'completed',
    result: 'Positive (P. falciparum)',
    unit: '',
    referenceRange: 'Negative',
    abnormal: true,
    critical: false,
    orderedAt: '2026-02-09T08:30:00Z',
    completedAt: '2026-02-09T09:15:00Z',
  },
  {
    _id: 'lab-010',
    patientId: 'pat-00001',
    testName: 'Complete Blood Count',
    specimen: 'Blood (EDTA)',
    status: 'completed',
    result: 'Hb 13.2 g/dL, WBC 7.8×10³/µL',
    unit: '',
    referenceRange: 'Hb 12-16, WBC 4-11',
    abnormal: false,
    critical: false,
    orderedAt: '2026-01-15T09:30:00Z',
    completedAt: '2026-01-15T11:00:00Z',
  },
  {
    _id: 'lab-011',
    patientId: 'pat-00001',
    testName: 'Fasting Blood Glucose',
    specimen: 'Blood',
    status: 'completed',
    result: '105 mg/dL',
    unit: 'mg/dL',
    referenceRange: '70-100',
    abnormal: true,
    critical: false,
    orderedAt: '2026-01-15T06:30:00Z',
    completedAt: '2026-01-15T07:00:00Z',
  },
  {
    _id: 'lab-012',
    patientId: 'pat-00001',
    testName: 'Kidney Function Panel',
    specimen: 'Blood',
    status: 'pending',
    result: '',
    unit: '',
    referenceRange: '',
    abnormal: false,
    critical: false,
    orderedAt: '2026-02-16T10:30:00Z',
    completedAt: '',
  },
];

// ---- Prescriptions ----

export const prescriptions: Prescription[] = [
  {
    _id: 'rx-001',
    patientId: 'pat-00001',
    medication: 'Artemether-Lumefantrine (Coartem)',
    dose: '80/480mg',
    route: 'Oral',
    frequency: 'Twice daily',
    duration: '3 days',
    prescribedBy: 'Dr. James Wani Igga',
    status: 'dispensed',
    dispensedAt: '2026-02-09T09:30:00Z',
    createdAt: '2026-02-09T09:15:00Z',
  },
  {
    _id: 'rx-010',
    patientId: 'pat-00001',
    medication: 'Amlodipine',
    dose: '5mg',
    route: 'Oral',
    frequency: 'Once daily',
    duration: '30 days',
    prescribedBy: 'Dr. Achol Mayen Deng',
    status: 'pending',
    createdAt: '2026-02-16T10:15:00Z',
  },
  {
    _id: 'rx-011',
    patientId: 'pat-00001',
    medication: 'Paracetamol',
    dose: '1g',
    route: 'Oral',
    frequency: 'Every 6 hours as needed',
    duration: '5 days',
    prescribedBy: 'Dr. James Wani Igga',
    status: 'dispensed',
    dispensedAt: '2026-02-09T09:30:00Z',
    createdAt: '2026-02-09T09:15:00Z',
  },
];

// ---- Appointments ----

export const appointments: Appointment[] = [
  {
    _id: 'apt-001',
    patientId: 'pat-00001',
    appointmentDate: '2026-04-22',
    appointmentTime: '09:00',
    appointmentType: 'Follow-up',
    reason: 'Blood pressure follow-up',
    status: 'scheduled',
    providerName: 'Dr. James Wani Igga',
    facilityName: 'Juba Teaching Hospital',
    department: 'Internal Medicine',
    duration: 30,
  },
  {
    _id: 'apt-002',
    patientId: 'pat-00001',
    appointmentDate: '2026-05-10',
    appointmentTime: '08:00',
    appointmentType: 'Lab Work',
    reason: 'Fasting blood glucose recheck',
    status: 'scheduled',
    providerName: 'Lab Dept.',
    facilityName: 'Juba Teaching Hospital',
    department: 'Laboratory',
    duration: 15,
  },
  {
    _id: 'apt-003',
    patientId: 'pat-00001',
    appointmentDate: '2026-02-09',
    appointmentTime: '08:30',
    appointmentType: 'OPD Consultation',
    reason: 'Fever and headache',
    status: 'completed',
    providerName: 'Dr. James Wani Igga',
    facilityName: 'Juba Teaching Hospital',
    department: 'OPD',
    duration: 45,
  },
];

// ---- Immunizations ----

export const immunizations: Immunization[] = [
  {
    _id: 'imm-020',
    patientId: 'pat-00001',
    vaccine: 'COVID-19 (AstraZeneca)',
    doseNumber: 1,
    dateGiven: '2025-06-15',
    nextDueDate: '2025-09-15',
    status: 'completed',
    site: 'Left arm',
  },
  {
    _id: 'imm-021',
    patientId: 'pat-00001',
    vaccine: 'COVID-19 (AstraZeneca)',
    doseNumber: 2,
    dateGiven: '2025-09-20',
    status: 'completed',
    site: 'Left arm',
  },
  {
    _id: 'imm-022',
    patientId: 'pat-00001',
    vaccine: 'Yellow Fever',
    doseNumber: 1,
    dateGiven: '2020-03-10',
    status: 'completed',
    site: 'Right arm',
  },
  {
    _id: 'imm-023',
    patientId: 'pat-00001',
    vaccine: 'Tetanus Toxoid',
    doseNumber: 3,
    dateGiven: '2024-11-01',
    nextDueDate: '2026-11-01',
    status: 'completed',
    site: 'Left arm',
  },
];

// ---- Messages ----

export const messages: Message[] = [
  {
    _id: 'msg-001',
    patientId: 'pat-00001',
    fromDoctorName: 'Dr. James Wani Igga',
    fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Malaria treatment follow-up',
    body: 'Hello Deng, your malaria test came back positive for P. falciparum. Please take the Coartem as prescribed — 4 tablets twice daily for 3 days with food. If fever persists after 3 days, come back immediately. Drink plenty of fluids and rest. We scheduled a follow-up for next week.',
    sentAt: '2026-02-09T10:00:00Z',
    status: 'delivered',
  },
  {
    _id: 'msg-002',
    patientId: 'pat-00001',
    fromDoctorName: 'Dr. Achol Mayen Deng',
    fromHospitalName: 'Juba Teaching Hospital',
    subject: 'Blood pressure management',
    body: 'Deng, your blood pressure readings have been slightly elevated at your recent visits (130/85, 140/90). I have started you on Amlodipine 5mg daily. Please take it in the morning. Reduce salt intake, exercise regularly, and avoid excessive alcohol. We will recheck in 6 weeks.',
    sentAt: '2026-02-16T11:00:00Z',
    status: 'delivered',
  },
];

// ---- Billing ----

export const payments: Payment[] = [
  { _id: 'pay-001', amount: 5000, method: 'Cash', status: 'posted', processedAt: '2026-02-09T09:45:00Z', reference: 'RCP-2026-001' },
  { _id: 'pay-002', amount: 3500, method: 'M-Pesa', status: 'posted', processedAt: '2026-01-15T12:00:00Z', reference: 'MPESA-7891' },
];

export const charges: Charge[] = [
  { _id: 'chg-001', description: 'OPD Consultation', billedAmount: 3000, status: 'approved', serviceDate: '2026-02-09' },
  { _id: 'chg-002', description: 'Malaria RDT', billedAmount: 1500, status: 'approved', serviceDate: '2026-02-09' },
  { _id: 'chg-003', description: 'Coartem (3-day course)', billedAmount: 2500, status: 'approved', serviceDate: '2026-02-09' },
  { _id: 'chg-004', description: 'Annual Check-up', billedAmount: 5000, status: 'approved', serviceDate: '2026-01-15' },
  { _id: 'chg-005', description: 'CBC + Glucose Panel', billedAmount: 4000, status: 'approved', serviceDate: '2026-01-15' },
  { _id: 'chg-006', description: 'Follow-up Visit', billedAmount: 1500, status: 'pending', serviceDate: '2026-02-16' },
];
