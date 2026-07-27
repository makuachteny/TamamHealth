/** Shared types for the TamamHealth Patient mobile app. */

/**
 * The signed-in patient.
 *
 * Only `id`, `firstName`, `surname`, `hospitalNumber` and `registrationHospital`
 * arrive from `POST /api/patient-portal/login` — the login response deliberately
 * carries no PHI, because the authentication request is the one most likely to
 * be logged, proxied or retried.
 *
 * Everything below that is optional and is populated by a follow-up call to
 * `GET /api/patient-portal/profile` once a token exists. Screens must therefore
 * tolerate these being absent on the very first render after sign-in.
 */
export type Patient = {
  id: string;
  firstName: string;
  surname: string;
  hospitalNumber: string;
  registrationHospital: string;
  /** From /profile. */
  middleName?: string;
  /** From /profile. */
  phone?: string;
  /** From /profile. */
  dateOfBirth?: string;
  /** From /profile. */
  gender?: 'Male' | 'Female';
  /** From /profile. */
  registrationHospitalName?: string;
  /** From /profile. */
  registrationDate?: string;
  /** From /profile — optional contact address. */
  address?: string;
  /** From /profile — optional email. */
  email?: string;
};

export type VitalSigns = {
  temperature?: number;
  pulse?: number;
  bloodPressure?: string;
  respiratoryRate?: number;
  weight?: number;
  oxygenSaturation?: number;
};

export type MedicalRecord = {
  _id: string;
  patientId: string;
  visitType: string;
  chiefComplaint: string;
  diagnoses: { name: string; icd11Code?: string; severity?: string }[];
  vitalSigns?: VitalSigns;
  consultedByName?: string;
  facilityName?: string;
  createdAt: string;
};

export type LabResult = {
  _id: string;
  patientId: string;
  testName: string;
  specimen: string;
  status: 'pending' | 'in_progress' | 'completed';
  result: string;
  unit: string;
  referenceRange: string;
  abnormal: boolean;
  critical: boolean;
  orderedAt: string;
  completedAt: string;
};

export type Prescription = {
  _id: string;
  patientId: string;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  prescribedBy: string;
  status: 'pending' | 'dispensed';
  dispensedAt?: string;
  createdAt: string;
};

export type Appointment = {
  _id: string;
  patientId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  reason: string;
  status: string;
  providerName?: string;
  facilityName?: string;
  department?: string;
  duration?: number;
};

export type Immunization = {
  _id: string;
  patientId: string;
  vaccine: string;
  doseNumber: number;
  dateGiven: string;
  nextDueDate?: string;
  status: string;
  site?: string;
};

export type Message = {
  _id: string;
  patientId: string;
  fromDoctorName: string;
  fromHospitalName: string;
  subject: string;
  body: string;
  sentAt: string;
  status: string;
};

export type Payment = {
  _id: string;
  amount: number;
  method: string;
  status: string;
  processedAt: string;
  reference?: string;
};

export type Charge = {
  _id: string;
  description: string;
  billedAmount: number;
  status: string;
  serviceDate: string;
};

export type BillingSummary = {
  payments: Payment[];
  charges: Charge[];
  plans: unknown[];
  claims: unknown[];
  policies: unknown[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    insurancePaid: number;
    outstanding: number;
  };
  balance: number;
  ledger: unknown[];
};

export type LoginResponse = {
  token: string;
  patient: Patient;
};
