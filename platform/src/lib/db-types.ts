import type { Hospital, Patient, Referral, DiseaseAlert, VitalSigns, Diagnosis, Prescription, LabResult, MedicalRecord, Attachment, TransferPackage } from '@/data/mock';

export interface BaseDoc {
  _id: string;
  _rev?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  /**
   * ISO 3166-1 alpha-2 country code of the facility that owns this record.
   * Populated at create time by the facility node so the country node
   * aggregator can partition records by jurisdiction for DHIS2 reporting
   * and cross-border referral routing.
   */
  countryId?: string;
}

export type UserRole = 'super_admin' | 'org_admin' | 'doctor' | 'clinical_officer' | 'nurse' | 'midwife' | 'lab_tech' | 'pharmacist' | 'front_desk' | 'cashier' | 'government' | 'county_health_director' | 'boma_health_worker' | 'payam_supervisor' | 'data_entry_clerk' | 'medical_superintendent' | 'hrio' | 'community_health_volunteer' | 'nutritionist' | 'radiologist' | 'hospital_manager' | 'medical_biller'
  // Clinical-flow workflow roles (EHR Clinical Flow doc §4) — capability-gated stations.
  | 'central_registration_clerk' | 'clinic_clerk' | 'triage_nurse' | 'rooming_nurse' | 'clinician' | 'records_hmis_officer' | 'facility_administrator';

export interface UserDoc extends BaseDoc {
  type: 'user';
  username: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
  isActive: boolean;
  /**
   * Set when an admin creates the account or resets the password. Forces the
   * user to choose a new password at next login before they can use the app,
   * so the admin's temporary password never becomes a permanent credential.
   * Cleared once the user sets their own password.
   */
  mustChangePassword?: boolean;
  /** ISO timestamp of the last password change (admin reset or self-service). */
  passwordUpdatedAt?: string;
  /** Hashed 4-6 digit PIN for screen-lock quick unlock */
  pinHash?: string;
  /** Staff directory: department (e.g. "Cardiology", "Pediatrics", "OPD"). */
  department?: string;
  /** Staff directory: clinical specialty (e.g. "Cardiologist"). */
  specialty?: string;
  /** Staff directory: contact phone for messaging. */
  phone?: string;
  /**
   * First-run "Get Started" onboarding progress. Absent for users created
   * before the feature shipped — treated as "not yet started", so the
   * onboarding surfaces once and then records completion/dismissal here.
   * Stored on the (synced) user doc so progress follows the user across
   * devices.
   */
  onboarding?: OnboardingState;
}

export interface OnboardingState {
  /** Stable IDs of the checklist steps the user has finished. */
  completedStepIds: string[];
  /** Set when the user finishes every step. Hides the panel for good. */
  completedAt?: string;
  /** Set when the user explicitly skips setup. Hides the panel for good. */
  dismissedAt?: string;
  /** Whether the user minimised the panel to the launcher pill. */
  collapsed?: boolean;
}

export interface PatientDoc extends BaseDoc, Omit<Patient, 'id'> {
  type: 'patient';
  orgId?: string;
}

export interface HospitalDoc extends BaseDoc, Omit<Hospital, 'id' | 'type'> {
  type: 'hospital';
  facilityType: Hospital['type'];
  facilityLevel?: FacilityLevel;  // boma | payam | county | state | national
  orgId?: string;
}

export interface MedicalRecordDoc extends BaseDoc, Omit<MedicalRecord, 'id'> {
  type: 'medical_record';
  orgId?: string;
}

export interface ReferralDoc extends BaseDoc, Omit<Referral, 'id'> {
  type: 'referral';
  orgId?: string;
}

export interface LabResultDoc extends BaseDoc {
  type: 'lab_result';
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  testName: string;
  specimen: string;
  status: 'pending' | 'in_progress' | 'completed';
  result: string;
  unit: string;
  referenceRange: string;
  abnormal: boolean;
  critical: boolean;
  orderedBy: string;
  orderedAt: string;
  completedAt: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
  /** Optional clinical notes from the ordering clinician (symptoms, suspected Dx) */
  clinicalNotes?: string;
}

export interface DiseaseAlertDoc extends BaseDoc, Omit<DiseaseAlert, 'id'> {
  type: 'disease_alert';
  orgId?: string;
  reportedBy?: string;
}

export interface PrescriptionDoc extends BaseDoc {
  type: 'prescription';
  patientId: string;
  patientName: string;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  prescribedBy: string;
  status: 'pending' | 'dispensed';
  dispensedAt?: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
  /**
   * Active inpatient admission this prescription is administered against.
   * Set when the prescription belongs to an admitted patient so the MAR
   * (Medication Administration Record) can scope to a single admission.
   */
  admissionId?: string;
  /**
   * Bedside Medication Administration Record. Each entry is one nurse
   * actually giving (or refusing/missing) one scheduled dose. The
   * prescription itself is the order; this array is the legal record of
   * administration.
   */
  administrations?: MedicationAdministration[];
}

/**
 * One row of the MAR — one nurse administering (or recording the absence
 * of) one scheduled dose. Append-only; corrections are recorded as new
 * entries with status='corrected' rather than mutating prior rows.
 */
export interface MedicationAdministration {
  /** Stable id within the prescription's administrations[] array */
  id: string;
  /** Scheduled dose time the row corresponds to (ISO datetime) */
  scheduledFor: string;
  /** When the dose was actually given / refused / missed (ISO datetime) */
  recordedAt: string;
  status: 'given' | 'missed' | 'refused' | 'held' | 'corrected';
  /** Actual dose given (e.g. "500mg") — defaults to prescription.dose */
  doseGiven?: string;
  /** Route used (po, iv, im, sc, etc.) — defaults to prescription.route */
  route?: string;
  /** Nurse / clinician who administered */
  administeredBy: string;
  administeredByName: string;
  /** Required for controlled substances (Schedule II–V) */
  witnessId?: string;
  witnessName?: string;
  /** Free-text reason when status is missed/refused/held */
  reason?: string;
  notes?: string;
}

/**
 * Longitudinal Problem List — Epic-style "Active / Resolved / Chronic"
 * clinical problems anchored to the patient (not the encounter). One
 * problem can span many visits. Used for handoff, care continuity, and
 * driving role-aware UI (e.g. show TB protocol when patient has active
 * TB problem).
 */
export type ProblemStatus = 'active' | 'resolved' | 'chronic' | 'inactive';

export interface ProblemDoc extends BaseDoc {
  type: 'problem';
  patientId: string;
  patientName?: string;
  /** Display name (e.g. "Type 2 Diabetes Mellitus") */
  name: string;
  /** ICD-11 code (preferred). ICD-10 kept for legacy / interop fallback. */
  icd11Code?: string;
  icd10Code?: string;
  status: ProblemStatus;
  /** Date the problem first started / was diagnosed (YYYY-MM-DD) */
  onsetDate?: string;
  /** Date the problem was resolved (YYYY-MM-DD), if status='resolved' */
  resolvedDate?: string;
  /** Severity at time of last update */
  severity?: 'mild' | 'moderate' | 'severe';
  /** Free-text clinical context */
  notes?: string;
  /** Encounter that first documented this problem */
  sourceEncounterId?: string;
  recordedBy?: string;
  recordedByName?: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

export interface AuditLogDoc extends BaseDoc {
  type: 'audit_log';
  action: string;
  userId?: string;
  username?: string;
  details: string;
  ip?: string;
  success: boolean;
  orgId?: string;
}

/**
 * Sync-event outbox row — one written for every clinical mutation. Gives us
 * an auditable, queryable stream independent of PouchDB's internal _changes
 * feed. Matches the spec schema (event_id, resource_type, resource_version,
 * operation, occurred_at, sync_status).
 */
export interface SyncEventDoc extends BaseDoc {
  type: 'sync_event';
  /** Resource being changed (e.g. 'patient', 'medical_record', 'lab_result') */
  resourceType: string;
  /** PouchDB _id of the changed resource */
  resourceId: string;
  /** create | update | delete | archive */
  operation: 'create' | 'update' | 'delete' | 'archive';
  /** _rev of the resource AFTER the mutation — pairs with resourceId for traceability */
  resourceVersion?: string;
  /** When the mutation occurred (== createdAt for this row) */
  occurredAt: string;
  /** Authenticated user id */
  userId?: string;
  /** Authenticated username (for convenience) */
  username?: string;
  /** Facility / hospital id the mutation happened at */
  hospitalId?: string;
  /** Organization (tenant) id */
  orgId?: string;
  /** Country ISO-3166 alpha-2 (populated once countryId rollout lands) */
  countryId?: string;
  /** sync lifecycle: pending → syncing → synced | failed */
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  /** Error message if syncStatus === 'failed' */
  syncError?: string;
  /** Optional compact payload for downstream consumers */
  payloadJson?: string;
}

/**
 * Conflict-queue row — populated when high-risk clinical data (allergies,
 * active medications, referrals, discharge status) has a PouchDB revision
 * conflict. An admin resolves each entry manually rather than letting
 * most-recent-rev-wins auto-merge them.
 */
export interface ConflictQueueDoc extends BaseDoc {
  type: 'conflict_queue';
  resourceType: string;
  resourceId: string;
  /** 'low' | 'medium' | 'high' — risk tier per spec */
  risk: 'low' | 'medium' | 'high';
  /** The winning revision PouchDB chose by default */
  winningRev: string;
  /** Competing revisions that were NOT chosen */
  losingRevs: string[];
  /** 'pending' | 'resolved' | 'dismissed' */
  status: 'pending' | 'resolved' | 'dismissed';
  /** User who resolved */
  resolvedBy?: string;
  resolvedAt?: string;
  /** Chosen winning rev after human resolution (may match or override winningRev) */
  resolvedRev?: string;
  /** Free-text note from the resolver */
  resolutionNote?: string;
  orgId?: string;
  countryId?: string;
}

export interface MessageDoc extends BaseDoc {
  type: 'message';
  /**
   * Recipient discriminator. Defaults to 'patient' for legacy messages
   * written before staff-to-staff messaging existed.
   */
  recipientType?: 'patient' | 'staff';
  /**
   * Direction of the message. Defaults to 'staff_to_patient' for legacy
   * documents written before this field existed. The patient-portal Chat
   * tab writes messages with direction === 'patient_to_staff'; staff-to-staff
   * messages use 'staff_to_staff'.
   */
  direction?: 'staff_to_patient' | 'patient_to_staff' | 'staff_to_staff';
  /**
   * Recipient identity. For backward compatibility the canonical fields stay
   * named patientId/Name/Phone; for staff recipients these hold the staff
   * member's id/name/phone and `recipientType` is 'staff'.
   */
  patientId: string;
  patientName: string;
  patientPhone: string;
  /** Optional staff metadata, populated when recipientType === 'staff'. */
  recipientRole?: string;
  recipientDepartment?: string;
  recipientHospitalId?: string;
  recipientHospitalName?: string;
  fromDoctorId: string;
  fromDoctorName: string;
  fromHospitalName: string;
  /**
   * Optional sender hospital id. Populated for patient_to_staff messages
   * (so facility scope filters can match) and for staff-authored messages
   * that have a known sender hospital.
   */
  fromHospitalId?: string;
  subject: string;
  body: string;
  channel: 'app' | 'sms' | 'both';
  status: 'sent' | 'delivered' | 'failed';
  sentAt: string;
  orgId?: string;
  /**
   * SMS gateway delivery status, stamped after the provider call resolves.
   * Absent when the message was app-only or when the gateway hasn't yet
   * responded. Surfaced in the message UI as a delivery indicator.
   */
  smsResult?: {
    ok: boolean;
    providerId: string;
    providerMessageId?: string;
    error?: string;
  };
}

// ===== Birth & Death Registration (CRVS) =====
export interface BirthRegistrationDoc extends BaseDoc {
  type: 'birth';
  childFirstName: string;
  childSurname: string;
  childGender: 'Male' | 'Female';
  dateOfBirth: string;
  placeOfBirth: string;
  facilityId: string;
  facilityName: string;
  motherName: string;
  motherAge: number;
  motherNationality: string;
  fatherName: string;
  fatherNationality: string;
  birthWeight: number; // grams
  birthType: 'single' | 'twin' | 'multiple';
  deliveryType: 'normal' | 'caesarean' | 'assisted';
  attendedBy: string; // doctor/midwife/TBA/none
  registeredBy: string;
  state: string;
  county: string;
  certificateNumber: string;
  childPatientId?: string;
  motherPatientId?: string;
  /** ANC mother record id linked to this birth (if the mother had prenatal
   *  visits in the ANC module). Birth registration writes this back to all
   *  matching ANC visits via linkedBirthId. */
  linkedAncMotherId?: string;
  isDeleted?: boolean;
  orgId?: string;
}

export interface DeathRegistrationDoc extends BaseDoc {
  type: 'death';
  deceasedFirstName: string;
  deceasedSurname: string;
  deceasedGender: 'Male' | 'Female';
  dateOfBirth: string;
  dateOfDeath: string;
  ageAtDeath: number;
  placeOfDeath: string;
  facilityId: string;
  facilityName: string;
  // ICD-11 Cause of Death (WHO Medical Certificate format)
  immediateCause: string;         // Line a: immediate cause
  immediateICD11: string;         // ICD-11 code
  antecedentCause1: string;       // Line b: due to
  antecedentICD11_1: string;
  antecedentCause2: string;       // Line c: due to
  antecedentICD11_2: string;
  underlyingCause: string;        // Line d: underlying cause
  underlyingICD11: string;
  contributingConditions: string;
  contributingICD11: string;
  mannerOfDeath: 'natural' | 'accident' | 'intentional_self_harm' | 'assault' | 'pending_investigation' | 'unknown';
  maternalDeath: boolean;
  pregnancyRelated: boolean;
  certifiedBy: string;
  certifierRole: string;
  state: string;
  county: string;
  certificateNumber: string;
  deathNotified: boolean;
  deathRegistered: boolean;
  patientId?: string;
  isDeleted?: boolean;
  orgId?: string;
}

// ===== Health Facility Assessment =====
export interface FacilityAssessmentDoc extends BaseDoc {
  type: 'facility_assessment';
  facilityId: string;
  facilityName: string;
  assessmentDate: string;
  assessedBy: string;
  // Service readiness
  generalEquipmentScore: number;     // 0-100
  diagnosticCapacityScore: number;
  essentialMedicinesScore: number;
  infectionControlScore: number;
  // Infrastructure
  hasCleanWater: boolean;
  hasSanitation: boolean;
  hasWasteManagement: boolean;
  hasEmergencyTransport: boolean;
  hasCommunication: boolean;
  powerReliabilityScore: number;     // 0-100
  // Staffing adequacy
  staffingScore: number;             // 0-100
  hisStaffCount: number;
  hisStaffTrained: number;
  // Data management
  hasPatientRegisters: boolean;
  hasDHIS2Reporting: boolean;
  reportingCompleteness: number;     // 0-100
  reportingTimeliness: number;       // 0-100
  dataQualityScore: number;          // 0-100
  // Summary
  overallScore: number;              // 0-100
  state: string;
  recommendations: string;
  orgId?: string;
}

// ===== ICD-11 Common Codes Reference =====
export interface ICD11Code {
  code: string;
  title: string;
  chapter: string;
}

// ===== Immunization Tracker =====
export interface ImmunizationDoc extends BaseDoc {
  type: 'immunization';
  patientId: string;
  patientName: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  vaccine: string; // BCG, OPV0-3, Penta1-3, PCV1-3, Rota1-2, Measles1-2, Yellow Fever, Vitamin A
  doseNumber: number;
  dateGiven: string;
  nextDueDate: string;
  facilityId: string;
  facilityName: string;
  state: string;
  administeredBy: string;
  batchNumber: string;
  site: 'left arm' | 'right arm' | 'left thigh' | 'right thigh' | 'oral';
  adverseReaction: boolean;
  adverseReactionDetails?: string;
  status: 'completed' | 'scheduled' | 'overdue' | 'missed';
  orgId?: string;
}

// ===== ANC (Antenatal Care) Module =====
export interface ANCVisitDoc extends BaseDoc {
  type: 'anc_visit';
  motherId: string;
  patientId?: string;
  motherName: string;
  motherAge: number;
  gravida: number;
  parity: number;
  visitNumber: number; // 1-8 (WHO recommends 8 contacts)
  visitDate: string;
  gestationalAge: number; // weeks
  facilityId: string;
  facilityName: string;
  state: string;
  bloodPressure: string;
  weight: number;
  fundalHeight: number;
  fetalHeartRate: number;
  hemoglobin: number;
  urineProtein: string;
  bloodGroup: string;
  rhFactor: string;
  hivStatus: string;
  malariaTest: string;
  syphilisTest: string;
  ironFolateGiven: boolean;
  tetanusVaccine: boolean;
  iptpDose: number;
  riskFactors: string[];
  riskLevel: 'low' | 'moderate' | 'high';
  birthPlan: { facility: string; transport: string; bloodDonor: string };
  nextVisitDate: string;
  notes: string;
  attendedBy: string;
  attendedByRole: string;
  orgId?: string;
  /** Set when the mother gives birth and the birth registration links back
   *  to this ANC visit. Lets the ANC module display "Delivered" status and
   *  lets the birth module surface the prenatal history. */
  linkedBirthId?: string;
  isDeleted?: boolean;
}

// ===== Boma Health Worker Visit (Community-Level Data Collection) =====
export interface BomaVisitDoc extends BaseDoc {
  type: 'boma_visit';
  workerId: string;              // BHW-{bomaCode}-{number}
  workerName: string;
  assignedBoma: string;          // Boma code
  // Patient identification
  geocodeId: string;             // BOMA-XY-HH1001
  patientId?: string;            // Optional link to facility patient record
  patientName: string;
  patientPhoto?: string;         // Base64 for photo-based ID in illiterate populations
  patientAge?: number;
  patientGender?: 'Male' | 'Female';
  // Simplified visit data (expert-recommended: "so simple a primary school child can do it")
  visitDate: string;
  chiefComplaint: string;
  suspectedCondition: string;    // Suspected diagnosis at community level
  icd11Code?: string;            // Optional ICD-11 for suspected condition
  // Binary action (expert: "treated OR referred")
  action: 'treated' | 'referred';
  referredTo?: string;           // Facility ID/name if referred
  treatmentGiven?: string;       // Brief description if treated
  // Outcome tracking (expert: "Did the patient get well or die?")
  outcome: 'recovered' | 'died' | 'follow_up' | 'unknown';
  followUpRequired: boolean;
  nextFollowUp?: string;
  // GPS for mapping
  gpsLatitude?: number;
  gpsLongitude?: number;
  // Remote Review (Expert: "The person can also go back remotely and look at those things that have been recorded")
  reviewStatus?: 'pending' | 'reviewed' | 'flagged';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  // Administrative
  state: string;
  county: string;
  payam: string;
  boma: string;
  orgId?: string;
}

// ===== Triage (ETAT — Emergency Triage Assessment & Treatment) =====
// Captures the WHO ETAT ABCC assessment plus vitals taken at triage.
// One record per triage encounter; a patient may have many over time.
export type TriagePriority = 'RED' | 'YELLOW' | 'GREEN';

export interface TriageDoc extends BaseDoc {
  type: 'triage';
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  // ETAT ABCC
  airway: 'clear' | 'obstructed';
  breathing: 'normal' | 'distressed' | 'absent';
  circulation: 'normal' | 'impaired' | 'absent';
  consciousness: 'alert' | 'verbal' | 'pain' | 'unresponsive';
  priority: TriagePriority;
  // Vitals captured at triage (optional — string for partial entry)
  temperature?: string;
  pulse?: string;
  respiratoryRate?: string;
  systolic?: string;
  diastolic?: string;
  oxygenSaturation?: string;
  weight?: string;
  // Context
  chiefComplaint?: string;
  notes?: string;
  // Audit
  triagedBy: string;       // user id
  triagedByName: string;   // display name at time of triage
  triagedAt: string;       // ISO datetime (distinct from createdAt to allow backfill)
  facilityId?: string;
  facilityName?: string;
  orgId?: string;
  // Follow-through
  status: 'pending' | 'seen' | 'admitted' | 'discharged' | 'referred';
  handoffTo?: string;      // clinician id who took over
  handoffToName?: string;
  handoffAt?: string;
}

// ===== Pharmacy Inventory =====
// One row per SKU per facility. The stock level decrements when a
// prescription is dispensed and increments when a receipt is recorded.
export interface PharmacyInventoryDoc extends BaseDoc {
  type: 'pharmacy_inventory';
  hospitalId: string;
  hospitalName: string;
  medicationName: string;
  category: string;
  stockLevel: number;
  unit: string;                      // tablets, vials, bottles, sachets, tubes
  reorderLevel: number;              // when to reorder
  batchNumber: string;
  expiryDate: string;                // YYYY-MM-DD
  lastReceived?: string;             // ISO datetime of last stock-in
  lastDispensed?: string;            // ISO datetime of last decrement
  dispensedToday: number;
  /**
   * Drug control schedule. Schedule II/III/IV require two-staff
   * witness sign-off on every movement (intake, dispense, waste).
   * Sourced from the South Sudan Drug & Food Control Authority list.
   */
  controlledSchedule?: 'I' | 'II' | 'III' | 'IV' | 'V';
  /** When true, dispense flow forces a witness staff selection. */
  requiresWitness?: boolean;
  orgId?: string;
}

/**
 * Audit log entry for every controlled-substance movement.
 * Two staff signatures (operator + witness) are mandatory by SSDFCA rules.
 */
export interface ControlledSubstanceLogDoc extends BaseDoc {
  type: 'controlled_substance_log';
  inventoryId: string;
  medicationName: string;
  schedule: 'I' | 'II' | 'III' | 'IV' | 'V';
  movement: 'intake' | 'dispense' | 'waste' | 'reconciliation' | 'transfer';
  quantity: number;
  unit: string;
  beforeBalance: number;
  afterBalance: number;
  patientId?: string;        // for dispense
  patientName?: string;
  prescriptionId?: string;
  // Two-signature audit
  operatorId: string;
  operatorName: string;
  witnessId: string;
  witnessName: string;
  reason?: string;
  facilityId: string;
  facilityName: string;
  orgId?: string;
}

// ===== Follow-Up Tracking =====
export interface FollowUpDoc extends BaseDoc {
  type: 'follow_up';
  patientId: string;
  patientName: string;
  geocodeId?: string;
  assignedWorker: string;        // Health worker responsible
  assignedWorkerName: string;
  status: 'active' | 'completed' | 'missed' | 'lost_to_followup';
  outcome?: 'recovered' | 'died' | 'referred' | 'under_treatment';
  condition: string;
  facilityLevel: FacilityLevel;
  scheduledDate: string;
  completedDate?: string;
  notes?: string;
  state: string;
  county: string;
  sourceVisitId?: string;
  orgId?: string;
}

// ===== Five-Level Facility Hierarchy (South Sudan Health System) =====
export type FacilityLevel = 'boma' | 'payam' | 'county' | 'state' | 'national';

export interface FacilityLevelConfig {
  level: FacilityLevel;
  name: string;
  description: string;
  diagnosisCapability: 'suspected' | 'clinical' | 'definitive' | 'specialist';
  exampleFacility: string;
}

export const FACILITY_LEVELS: FacilityLevelConfig[] = [
  {
    level: 'boma',
    name: 'Boma (Village)',
    description: '40 households per Boma health worker. Most basic care, referrals up.',
    diagnosisCapability: 'suspected',
    exampleFacility: 'Community Health Post',
  },
  {
    level: 'payam',
    name: 'Payam (Sub-county)',
    description: 'Primary Health Care Units (PHCUs). Basic diagnoses and treatments.',
    diagnosisCapability: 'clinical',
    exampleFacility: 'Primary Health Care Unit',
  },
  {
    level: 'county',
    name: 'County',
    description: 'County hospitals with more advanced care, lab, and pharmacy.',
    diagnosisCapability: 'definitive',
    exampleFacility: 'County Hospital',
  },
  {
    level: 'state',
    name: 'State',
    description: 'State general hospitals with specialist services.',
    diagnosisCapability: 'specialist',
    exampleFacility: 'Wau State Hospital',
  },
  {
    level: 'national',
    name: 'National',
    description: 'Teaching hospitals with highest level of care and training.',
    diagnosisCapability: 'specialist',
    exampleFacility: 'Juba Teaching Hospital',
  },
];

// AI Clinical Decision Support types
export interface AIDiagnosisSuggestion {
  icd10Code: string;
  icd11Code?: string;           // ICD-11 code (WHO standard)
  name: string;
  confidence: number;           // 0-100
  reasoning: string;
  severity: 'mild' | 'moderate' | 'severe';
  suggestedTreatment?: string;
  diagnosisLevel?: FacilityLevel;  // Level at which this diagnosis was made
  diagnosisType?: 'suspected' | 'clinical' | 'definitive' | 'confirmed';
  confirmedBy?: string;            // "RDT", "microscopy", "clinical only", etc.
}

export interface AIEvaluation {
  suggestedDiagnoses: AIDiagnosisSuggestion[];
  vitalSignAlerts: string[];
  recommendedTests: string[];
  severityAssessment: string;
  clinicalNotes: string;
  evaluatedAt: string;
}

// ===== Organization (Multi-Tenant) =====
export interface OrganizationDoc extends BaseDoc {
  type: 'organization';
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  subscriptionStatus: 'trial' | 'active' | 'suspended' | 'cancelled';
  subscriptionPlan: 'basic' | 'professional' | 'enterprise';
  maxUsers: number;
  maxHospitals: number;
  featureFlags: {
    epidemicIntelligence: boolean;
    mchAnalytics: boolean;
    dhis2Export: boolean;
    aiClinicalSupport: boolean;
    communityHealth: boolean;
    facilityAssessments: boolean;
  };
  orgType: 'public' | 'private';
  contactEmail: string;
  country: string;
  isActive: boolean;
  /** Screen lock timeout in minutes (default 1). Set by org admin. */
  lockTimeoutMinutes?: number;
  /** App language for this organization's facilities. Set by org admin / hospital head. */
  locale?: string;
}

export interface PlatformConfigDoc extends BaseDoc {
  type: 'platform_config';
  platformName: string;
  maintenanceMode: boolean;
  globalFeatureFlags: {
    signupsEnabled: boolean;
    trialDays: number;
    maxOrganizations: number;
  };
  defaultPrimaryColor: string;
  defaultSecondaryColor: string;
}

// ===== Staff Scheduling =====
export interface StaffScheduleDoc extends BaseDoc {
  type: 'staff_schedule';
  userId: string;
  userName: string;
  role: string;
  facilityId: string;
  facilityName: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'on_call';
  shiftDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  department?: string;
  isOnCall: boolean;
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'absent' | 'swapped';
  swappedWith?: string; // userId of swap partner
  orgId?: string;
}

// ===== Provider Availability (bookable windows for appointments/telehealth) =====
export type AvailabilityModality = 'in_person' | 'telehealth' | 'both';
export type AvailabilityStatus = 'open' | 'partially_booked' | 'full' | 'cancelled';

export interface AvailabilityDoc extends BaseDoc {
  type: 'availability';
  providerId: string;
  providerName: string;
  facilityId: string;
  facilityName: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:MM (24h)
  endTime: string;         // HH:MM (24h)
  slotMinutes: number;     // length of each bookable slot
  modality: AvailabilityModality;
  department?: string;
  notes?: string;
  status: AvailabilityStatus;
  orgId?: string;
  payam?: string;
}

// ===== Announcements (broadcast notices to staff) =====
export type AnnouncementAudience = 'organization' | 'facility' | 'role';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface AnnouncementDoc extends BaseDoc {
  type: 'announcement';
  title: string;
  body: string;
  audience: AnnouncementAudience;
  /** When audience === 'role', the roles this announcement targets. */
  targetRoles?: UserRole[];
  priority: AnnouncementPriority;
  authorId: string;
  authorName: string;
  facilityId?: string;
  facilityName?: string;
  /** Optional auto-expiry (ISO). After this the announcement is hidden. */
  expiresAt?: string;
  /** User IDs that have dismissed this announcement. */
  dismissedBy?: string[];
  orgId?: string;
  payam?: string;
}

// ===== Blood Bank Management =====
export interface BloodBankDoc extends BaseDoc {
  type: 'blood_bank';
  unitId: string;
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  component: 'whole_blood' | 'packed_rbc' | 'platelets' | 'ffp' | 'cryoprecipitate';
  volume: number; // ml
  collectionDate: string;
  expiryDate: string;
  donorId?: string;
  donorName?: string;
  status: 'available' | 'reserved' | 'crossmatched' | 'transfused' | 'expired' | 'discarded';
  facilityId: string;
  facilityName: string;
  reservedForPatient?: string;
  crossmatchResult?: 'compatible' | 'incompatible' | 'pending';
  transfusedTo?: string;
  transfusedAt?: string;
  transfusedBy?: string;
  screeningResults?: {
    hiv: boolean;
    hepatitisB: boolean;
    hepatitisC: boolean;
    syphilis: boolean;
    malaria: boolean;
  };
  notes?: string;
  orgId?: string;
}

// ===== Appointment Booking (Payam Level & Above) =====
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentType = 'general' | 'follow_up' | 'specialist' | 'anc' | 'immunization' | 'lab' | 'telehealth' | 'surgical' | 'dental' | 'mental_health' | 'walk_in';
export type AppointmentPriority = 'routine' | 'urgent' | 'emergency';

export interface AppointmentDoc extends BaseDoc {
  type: 'appointment';
  patientId: string;
  patientName: string;
  patientPhone?: string;
  providerId: string;         // Doctor/clinical officer assigned
  providerName: string;
  facilityId: string;
  facilityName: string;
  facilityLevel: FacilityLevel;
  // Scheduling
  appointmentDate: string;    // YYYY-MM-DD
  appointmentTime: string;    // HH:MM (24h)
  endTime?: string;           // HH:MM estimated end
  duration: number;           // minutes
  appointmentType: AppointmentType;
  priority: AppointmentPriority;
  department: string;
  // Clinical context
  reason: string;             // Chief complaint or reason for visit
  notes?: string;
  referralId?: string;        // If appointment was created from a referral
  previousAppointmentId?: string; // For follow-up chain
  // Status tracking
  status: AppointmentStatus;
  cancelledReason?: string;
  cancelledBy?: string;
  checkedInAt?: string;
  completedAt?: string;
  // Reminders
  reminderSent: boolean;
  reminderChannel?: 'sms' | 'app' | 'both';
  // Recurrence (for regular follow-ups)
  isRecurring: boolean;
  recurrencePattern?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  recurrenceEndDate?: string;
  // Administrative
  bookedBy: string;
  bookedByName: string;
  state: string;
  county?: string;
  orgId?: string;
}

// ===== Telehealth Services (Private Sector) =====
export type TelehealthStatus = 'scheduled' | 'waiting_room' | 'in_session' | 'completed' | 'cancelled' | 'failed' | 'no_show';
export type TelehealthType = 'video' | 'audio' | 'chat';
export type SessionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'failed';

export interface TelehealthSessionDoc extends BaseDoc {
  type: 'telehealth_session';
  // Linked appointment
  appointmentId?: string;
  // Participants
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  providerId: string;
  providerName: string;
  providerRole: string;
  facilityId: string;
  facilityName: string;
  // Session details
  sessionType: TelehealthType;
  scheduledDate: string;
  scheduledTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  duration?: number;          // actual minutes
  status: TelehealthStatus;
  // Connection
  roomId: string;             // Unique room identifier for joining
  joinUrl?: string;           // URL for patient to join
  providerJoinUrl?: string;
  // Clinical
  chiefComplaint: string;
  clinicalNotes?: string;
  diagnosis?: string;
  icd10Code?: string;
  prescriptionsIssued?: string[];
  labOrdersIssued?: string[];
  followUpRequired: boolean;
  followUpDate?: string;
  referralRequired: boolean;
  referralFacility?: string;
  // Quality & compliance (ISO 13131 alignment)
  sessionQuality?: SessionQuality;
  connectionDrops: number;
  patientConsentGiven: boolean;
  consentTimestamp?: string;
  // Recording & documentation
  sessionRecorded: boolean;
  recordingUrl?: string;
  attachments?: { name: string; type: string; url: string }[];
  // Patient satisfaction
  patientRating?: number;     // 1-5
  patientFeedback?: string;
  // Billing (private sector)
  consultationFee?: number;
  currency?: string;
  paymentStatus?: 'pending' | 'paid' | 'waived' | 'insurance';
  insuranceProvider?: string;
  // Administrative
  cancelledReason?: string;
  cancelledBy?: string;
  state: string;
  county?: string;
  orgId?: string;
}

// ===== Emergency Preparedness =====
export type EmergencyType = 'disease_outbreak' | 'flood' | 'conflict' | 'famine' | 'cholera_outbreak' | 'measles_outbreak' | 'ebola' | 'mass_casualty' | 'infrastructure_failure';
export type EmergencyPhase = 'preparedness' | 'alert' | 'response' | 'recovery' | 'closed';
export type EmergencySeverity = 'level_1' | 'level_2' | 'level_3'; // WHO scale: 1=watch, 2=mobilize, 3=full activation

export interface EmergencyPlanDoc extends BaseDoc {
  type: 'emergency_plan';
  planName: string;
  emergencyType: EmergencyType;
  phase: EmergencyPhase;
  severity: EmergencySeverity;
  description: string;
  facilityId: string;
  facilityName: string;
  // Activation
  activatedAt?: string;
  activatedBy?: string;
  deactivatedAt?: string;
  // Resource readiness
  resources: {
    surgeBeds: number;
    availableSurgeBeds: number;
    emergencyKits: number;
    oralRehydrationSachets: number;
    choleraCots: number;
    ppe: number; // sets
    emergencyMedications: string[];
  };
  // Communication chain
  incidentCommander: string;
  incidentCommanderPhone: string;
  contactChain: { name: string; role: string; phone: string; order: number }[];
  // Capacity
  estimatedCapacity: number; // patients per day
  currentLoad: number;
  // Geographic scope
  state: string;
  county?: string;
  affectedAreas?: string[];
  // Tracking
  totalCasesManaged: number;
  totalDeaths: number;
  totalReferralsOut: number;
  orgId?: string;
}

// Re-export mock types for convenience
export type { Hospital, Patient, Referral, DiseaseAlert, VitalSigns, Diagnosis, Prescription, LabResult, MedicalRecord, Attachment, TransferPackage };
