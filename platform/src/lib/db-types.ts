import type { Hospital, Patient, Referral, DiseaseAlert, VitalSigns, Diagnosis, Prescription, LabResult, MedicalRecord, Attachment, TransferPackage } from '@/data/mock';
import type { EncounterStatus, EncounterStageKey } from './clinical-flow/encounter-journey';
import type { LabOrderStatus, PrescriptionStatus } from './clinical-flow/order-lifecycles';

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

export type UserRole = 'super_admin' | 'org_admin' | 'doctor' | 'clinical_officer' | 'nurse' | 'midwife' | 'lab_tech' | 'pharmacist' | 'front_desk' | 'cashier' | 'government' | 'county_health_director' | 'data_entry_clerk' | 'medical_superintendent' | 'hrio' | 'nutritionist' | 'radiologist' | 'hospital_manager' | 'medical_biller'
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
  /** Lightweight messaging presence/status (defaults to 'active' when unset). */
  presence?: StaffPresence;
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

/**
 * NAMING CONVENTION — "hospital" vs "facility":
 * The product UI uses the word **Facility** throughout. The data layer keeps
 * the historical `hospital*` identifiers (`HospitalDoc`, `hospitalsDB`,
 * `hospital-service`, `hospitalId`, `registrationHospital`) for backward
 * compatibility — renaming the persisted keys would require a data migration
 * across every synced DB and CouchDB remote, so they are intentionally left
 * as-is. Treat `hospitalId` / `facilityId` as synonyms (a facility = a
 * hospital record); prefer "facility" in user-facing copy, "hospital" in the
 * storage/types layer.
 */
export interface HospitalDoc extends BaseDoc, Omit<Hospital, 'id' | 'type'> {
  type: 'hospital';
  facilityType: Hospital['type'];
  facilityLevel?: FacilityLevel;  // boma | payam | county | state | national
  orgId?: string;
}

/**
 * Per-patient context carried in a shift handoff, captured in SBAR form so the
 * oncoming nurse has structured situational awareness rather than free text.
 */
export interface HandoffPatientEntry {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  priority?: 'RED' | 'YELLOW' | 'GREEN';
  /** SBAR */
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
  /** Outstanding tasks the oncoming shift must action. */
  tasks?: string[];
}

/**
 * A nurse shift handoff record. Persisted so the oncoming shift can retrieve
 * and acknowledge the previous shift's handoff (closing the loop), and so the
 * record survives reload/re-seed and syncs across devices.
 */
export interface ShiftHandoffDoc extends BaseDoc {
  type: 'shift_handoff';
  facilityId?: string;
  facilityName?: string;
  orgId?: string;
  /** Local date key (YYYY-MM-DD) + shift, used to detect duplicate sign-offs. */
  shiftDate: string;
  shift: 'day' | 'evening' | 'night';
  // Outgoing (signing) nurse
  outgoingNurseId: string;
  outgoingNurseName: string;
  // Oncoming nurse (free text at compose time; id filled on acknowledge)
  incomingNurseName?: string;
  incomingNurseId?: string;
  /** Shift-wide summary notes. */
  notes?: string;
  /** Structured per-patient SBAR + tasks. */
  patients: HandoffPatientEntry[];
  /** Snapshot of shift workload metrics at sign-off (real, not fabricated). */
  metrics?: {
    totalPatients?: number;
    critical?: number;
    overdueMar?: number;
    dueMar?: number;
  };
  signedAt: string;
  /** Lifecycle: signed by outgoing nurse, then acknowledged by oncoming nurse. */
  status: 'signed' | 'acknowledged';
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
}

/** Fluid balance (intake/output) captured during ward nursing rounds, in mL. */
export interface FluidBalance {
  oralIntakeMl?: number;
  ivIntakeMl?: number;
  urineOutputMl?: number;
  otherOutputMl?: number;
}

/**
 * Append-only amendment to a signed clinical document (P0.1).
 *
 * Once a record is signed it is locked against in-place edits; corrections and
 * additions are captured as addenda so the original signed content stays
 * immutable and the full clinical/legal history is preserved.
 */
export interface RecordAddendum {
  text: string;
  authorId?: string;
  authorName: string;
  authorRole?: string;
  createdAt: string;
}

export interface MedicalRecordDoc extends BaseDoc, Omit<MedicalRecord, 'id'> {
  type: 'medical_record';
  orgId?: string;
  /** Referential links to the documents created during this visit, so the
   *  record can be traced to the actual orders rather than only a snapshot. */
  encounterId?: string;
  triageId?: string;
  labOrderIds?: string[];
  prescriptionIds?: string[];
  /** Intake/output recorded with a nursing vitals observation (ward). */
  fluidBalance?: FluidBalance;

  /**
   * What kind of record this is. Absent is treated as 'consultation' for
   * backward compatibility. 'nursing_vitals' marks a standalone nurse vitals
   * snapshot so queues (e.g. the signing inbox) can exclude it structurally
   * rather than by matching the chief-complaint string.
   */
  recordKind?: 'consultation' | 'nursing_vitals';

  // --- Document signing & locking (P0.1) ------------------------------------
  /**
   * Document lifecycle. Absent is treated as 'draft' for backward
   * compatibility — legacy records remain editable until first signed.
   *  - 'draft'    : editable, not yet attested.
   *  - 'signed'   : attested and locked; clinical fields are immutable.
   *  - 'amended'  : signed and locked, with one or more addenda appended.
   *  - 'awaiting_cosign' : signed by a trainee, pending supervisor co-signature.
   */
  documentStatus?: 'draft' | 'signed' | 'amended' | 'awaiting_cosign';
  /** User id of the clinician who signed (attested) the document. */
  signedBy?: string;
  /** Display name captured at signing time (denormalised for the chart). */
  signedByName?: string;
  /** Role of the signer at signing time (e.g. doctor, clinical_officer). */
  signedByRole?: string;
  /** ISO timestamp the document was signed. */
  signedAt?: string;
  /** Co-signature (supervising provider) — see P0.2. */
  cosignedBy?: string;
  cosignedByName?: string;
  cosignedAt?: string;
  /** Append-only amendments made after signing. */
  addenda?: RecordAddendum[];
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
  /** 'basic' = routine panel (CBC, urinalysis); 'special' = doctor-selected
   *  targeted investigation (cultures, ANA, vitamin D, etc.). */
  tier?: 'basic' | 'special';
  /** Granular diagnostics lifecycle stage (Stage 6 of the patient journey):
   *  ordered → specimen_collected → received_at_lab → in_process → resulted →
   *  reviewed_by_clinician → … . The coarse `status` field above is derived
   *  from this. Optional for backward-compatibility with older orders. */
  orderStatus?: LabOrderStatus;
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
  /** Coarse status kept for backward compatibility + queue filters. Derived
   *  from the granular `orderStatus` below. */
  status: 'pending' | 'dispensed' | 'discontinued';
  /** Discontinuation — set when a clinician or patient reports stopping the medication. */
  stoppedAt?: string;
  stoppedReason?: string;
  stoppedBy?: string;
  stoppedByName?: string;
  /** Source of the stop: 'clinician' | 'patient_reported' */
  stoppedSource?: 'clinician' | 'patient_reported';
  /** Granular pharmacy dispensing lifecycle (Stage 8): prescribed →
   *  received_in_pharmacy_queue → under_review → cleared_for_dispensing →
   *  dispensed → counseled → complete, plus stockout/held/recalled branches.
   *  Optional for backward-compatibility with older prescriptions. */
  orderStatus?: PrescriptionStatus;
  /** Links back to the consultation/encounter and record that ordered this
   *  prescription, so the pharmacy can trace it to its clinical context. */
  encounterId?: string;
  medicalRecordId?: string;
  /** Quantity (in dispensing units) the full course requires. Defaults to 1
   *  when not computed; the pharmacy decrements stock by this amount. */
  quantityToDispense?: number;
  /** 'immediate' = emergency/stat med given before results (IV fluids, antipyretic,
   *  anticonvulsant); 'definitive' = started after diagnosis. */
  urgency?: 'immediate' | 'definitive';
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
  /**
   * Problem this medication is pinned to (problem-oriented charting). When set,
   * the chart summary groups the medicine under the linked problem — e.g. a
   * chronic inhaler pinned to "Asthma". Denormalised label kept for display.
   */
  linkedProblemId?: string;
  linkedProblemLabel?: string;
}

/** One medication line inside an order set / clinical protocol. */
export interface OrderSetMedication {
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions?: string;
  /** 'immediate' = give stat (emergency); 'definitive' = after diagnosis. */
  urgency?: 'immediate' | 'definitive';
  /** When true the dose is weight-based; `dose` holds the per-kg rule
   *  (e.g. "10 mg/kg") for the dosing calculator to expand. */
  weightBased?: boolean;
}

/**
 * Order set / clinical protocol — a reusable bundle of orders (labs +
 * medications + a treatment-plan note) for a presenting condition, e.g.
 * "Malaria — uncomplicated" or "ETAT — convulsing child". Encodes national /
 * WHO standard treatment guidelines so a clinician (or task-shifted clinical
 * officer) can place the guideline-concordant order set in one action.
 * Reference data: org-scoped, rarely edited.
 */
export interface OrderSetDoc extends BaseDoc {
  type: 'order_set';
  /** Display name, e.g. "Malaria — uncomplicated (adult)". */
  name: string;
  /** Grouping for the picker, e.g. 'malaria' | 'respiratory' | 'diarrhoea' |
   *  'maternal' | 'emergency' | 'general'. Free string for extensibility. */
  category: string;
  /** Guideline provenance shown to the clinician, e.g. "WHO IMCI", "ETAT",
   *  "South Sudan STG 2019". */
  source?: string;
  /** Who the protocol is for. */
  ageGroup?: 'adult' | 'paediatric' | 'neonatal' | 'all';
  description?: string;
  /** Suggested diagnoses to attach when the set is applied. */
  diagnoses?: { code?: string; label: string }[];
  /** Lab test names to order (should match the facility lab catalog; any
   *  unmatched name falls through as a custom lab). */
  labs?: string[];
  /** Medications to prescribe. */
  medications?: OrderSetMedication[];
  /** Treatment-plan / care-instructions text appended on apply. */
  planText?: string;
  /** Active sets show in the picker; inactive are retired without deletion. */
  isActive?: boolean;
  orgId?: string;
  hospitalId?: string;
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
  /**
   * Void marker — set when a mis-recorded administration is reversed. The row
   * is never deleted (append-only legal record); a voided entry no longer
   * satisfies its scheduled dose, so the slot returns to due/overdue.
   */
  voided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
  voidedReason?: string;
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
   * Internal staff chat: groups a message into a conversation thread.
   * Absent on legacy patient messages.
   */
  conversationId?: string;
  /** User ids who have read this message (staff chat read receipts). */
  readBy?: string[];
  /** Lightweight emoji reactions on a staff chat message. */
  reactions?: { emoji: string; userId: string }[];
  /** Id of the message this one is replying to (staff chat). */
  replyToId?: string;
  /** Soft-delete tombstone for staff chat ("This message was deleted"). */
  deleted?: boolean;
  /** Set when the author edits a message within the edit window. */
  editedAt?: string;
  /** File/image attachments (PDF, JPG, PNG — base64 encoded for offline-first sync). */
  attachments?: Array<{
    name: string;
    mimeType: string;
    base64Data: string;
    sizeBytes: number;
    phiWarningAcknowledged?: boolean;
  }>;
  /** PHI acknowledgement — true when sender confirmed content may contain patient data. */
  phiAcknowledged?: boolean;
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

/**
 * Internal clinical note attached to a patient — staff-only.
 *
 * These live in their OWN database (tamamhealth_patient_notes), entirely
 * separate from MessageDoc, so they can never leak into any patient-facing
 * query (getMessagesByPatient and the patient portal only ever read the
 * messages DB). Patients never see these notes.
 */
export interface PatientNoteDoc extends BaseDoc {
  type: 'patient_note';
  patientId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  orgId?: string;
  hospitalId?: string;
}

/**
 * Outcome-measure / intake assessment (P2.2) — a scored questionnaire (e.g.
 * PHQ-9) entered at check-in (front desk) and reviewed + signed by the provider.
 * Mirrors the Centricity "outcome measures" document: held as a draft, then
 * signed. The instrument definitions + scoring live in
 * lib/clinical/assessment-instruments.ts.
 */
export interface AssessmentDoc extends BaseDoc {
  type: 'assessment';
  patientId: string;
  patientName?: string;
  instrumentId: string;
  instrumentName: string;
  /** questionId → selected option value. */
  answers: Record<string, number>;
  totalScore: number;
  answeredCount: number;
  questionCount: number;
  /** Interpretation band label + severity at the (partial) total. */
  interpretation?: string;
  severity?: string;
  /** held = entered, awaiting provider review; signed = attested + locked. */
  documentStatus: 'held' | 'signed';
  enteredById?: string;
  enteredByName?: string;
  signedBy?: string;
  signedByName?: string;
  signedAt?: string;
  encounterId?: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

/**
 * Phone note (P1.4) — documents a patient call when the provider is unavailable,
 * routes it to a provider for response, and becomes a permanent part of the
 * chart. Mirrors the Centricity phone note.
 */
export interface PhoneNoteDoc extends BaseDoc {
  type: 'phone_note';
  patientId: string;
  patientName?: string;
  /** Who called (patient, relative, pharmacy, etc.). */
  callerName?: string;
  callerPhone?: string;
  subject: string;
  /** The question / reason for the call. */
  message: string;
  /** Provider the note is routed to for a response. */
  routedToId?: string;
  routedToName?: string;
  status: 'open' | 'responded' | 'closed';
  /** Provider's response (added when actioned). */
  response?: string;
  respondedById?: string;
  respondedByName?: string;
  respondedAt?: string;
  recordedById?: string;
  recordedByName?: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

/** Which clinical picker a favorite belongs to. */
export type FavoriteKind = 'diagnosis' | 'medication' | 'procedure';

/**
 * A per-clinician "favorite" — a one-tap shortcut to a diagnosis, medicine or
 * procedure the provider reaches for often. Stored one doc per (user, kind,
 * code) so toggling is idempotent and the picker can show stars instantly.
 * Personal/operational data: synced org-scoped so a clinician's favorites
 * follow them to any workstation, but never flows to national analytics.
 */
export interface ClinicalFavoriteDoc extends BaseDoc {
  type: 'clinical_favorite';
  /** Owning clinician. */
  userId: string;
  kind: FavoriteKind;
  /** Canonical code (ICD-10 / drug code / procedure code) — the identity key. */
  code: string;
  /** Human label shown in the picker. */
  label: string;
  /** Optional default dosing/instructions carried for medication favorites. */
  meta?: {
    dosage?: string;
    frequency?: string;
    durationDays?: number;
    price?: number;
    category?: string;
  };
  /** Usage counter — lets the UI sort favorites by how often they're used. */
  useCount?: number;
  hospitalId?: string;
  orgId?: string;
}

/**
 * A clinician-saved consultation template — a named bundle of diagnoses,
 * medicines, labs and plan text captured from a real visit and re-applied in
 * one click (HealthBridge "save this as a template … bronchitis adult"). Unlike
 * order sets (admin-curated reference protocols), these are personal and owned
 * by the clinician who saved them. Shapes mirror OrderSetDoc so the same merge
 * applies both. Synced org-scoped, excluded from national analytics.
 */
export interface ConsultationTemplateDoc extends BaseDoc {
  type: 'consultation_template';
  userId: string;
  name: string;
  diagnoses?: { code?: string; label: string }[];
  labs?: string[];
  medications?: OrderSetMedication[];
  planText?: string;
  useCount?: number;
  hospitalId?: string;
  orgId?: string;
}

/** Category a scanned/uploaded chart document is filed under. */
export type PatientDocumentCategory =
  | 'radiology' | 'lab_report' | 'referral_letter' | 'discharge_summary'
  | 'consent' | 'advance_directive' | 'legal_document' | 'treatment_agreement'
  | 'insurance' | 'id_document' | 'prescription' | 'scanned_record'
  | 'external_medical_record' | 'other';

/**
 * A scanned or uploaded document filed on the patient chart — radiology films,
 * a referral letter, an ID, a previous paper record, etc. The HealthBridge
 * "drop a PDF/photo, categorise it, filter on the timeline" capability. Stored
 * in its own database (not on the patient doc) so large base64 payloads don't
 * bloat patient reads. Facility-operational PHI; excluded from national
 * analytics.
 */
export interface PatientDocumentDoc extends BaseDoc {
  type: 'patient_document';
  patientId: string;
  title: string;
  category: PatientDocumentCategory;
  /** File payload + metadata (name, mimeType, base64Data, sizeBytes). */
  fileName: string;
  mimeType: string;
  base64Data: string;
  sizeBytes: number;
  note?: string;
  uploadedById?: string;
  uploadedByName?: string;
  hospitalId?: string;
  orgId?: string;
}

export type ReminderChannel = 'sms' | 'whatsapp' | 'call' | 'in_person';
export type ReminderStatus = 'queued' | 'sent' | 'cancelled';

/**
 * A patient reminder queued to go out on a future date — e.g. "Come fasted in 3
 * weeks for your path tests." The HealthBridge "SMS the patient, queued and sent
 * a few days before" idea. NOTE: this app has no SMS gateway wired in, so this
 * is an honest reminder QUEUE that staff work from (and mark sent), not a claim
 * of automated delivery; a real gateway can later consume `status === 'queued'`
 * rows whose sendDate has arrived. Facility-operational; excluded from national
 * analytics.
 */
export interface PatientReminderDoc extends BaseDoc {
  type: 'patient_reminder';
  patientId: string;
  patientName?: string;
  message: string;
  /** Date the reminder should go out (yyyy-mm-dd). */
  sendDate: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  createdById?: string;
  createdByName?: string;
  sentAt?: string;
  hospitalId?: string;
  orgId?: string;
}

export type ClinicianTaskStatus = 'open' | 'completed';

/**
 * A clinician's personal to-do — the HealthBridge "tasks" / sticky-note
 * replacement: "phone John", "contact Dr Smith", with an optional reminder date
 * and patient link. Completed tasks are retained (not deleted) so the done list
 * stays visible. Owned by one user; synced org-scoped, excluded from national
 * analytics.
 */
export interface ClinicianTaskDoc extends BaseDoc {
  type: 'clinician_task';
  userId: string;
  title: string;
  description?: string;
  /** ISO date (yyyy-mm-dd) the task should resurface / is due. */
  dueDate?: string;
  status: ClinicianTaskStatus;
  priority?: 'normal' | 'high';
  /** Optional patient this task is about. */
  patientId?: string;
  patientName?: string;
  completedAt?: string;
  hospitalId?: string;
  orgId?: string;
}

/**
 * An in-progress / paused clinical encounter (the consultation workflow state).
 * Lets a clinician order labs, pause the visit (status `awaiting_labs`), and
 * resume it once results return — driven by the clinical-flow state machine
 * (lib/clinical-flow/encounter-journey.ts). The `snapshot` carries the
 * consultation form draft so it can be resumed on any device. When the visit is
 * finalised, a normal `medical_record` is written and the encounter is closed.
 */
export interface EncounterDoc extends BaseDoc {
  type: 'clinical_encounter';
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  clinicianId: string;
  clinicianName: string;
  hospitalId: string;
  hospitalName?: string;
  /** Canonical encounter status (see ENCOUNTER_TRANSITIONS). */
  status: EncounterStatus;
  /** The journey stage the status belongs to. */
  stageKey: EncounterStageKey;
  /** Consultation form draft (chiefComplaint, vitals, diagnoses, labOrders, …). */
  snapshot: Record<string, unknown>;
  /** Lab order doc ids created when the encounter was sent to the lab. */
  labOrderIds: string[];
  /** Triage record that fed this encounter, when the patient was triaged. */
  triageId?: string;
  startedAt: string;
  /** Set when the encounter is finalised into a medical_record. */
  medicalRecordId?: string;
  closedAt?: string;
  orgId?: string;
}

/**
 * Internal staff messaging conversation (direct message or group chat).
 * Patient communication keeps using flat MessageDocs scoped by patientId;
 * staff chat groups MessageDocs by `conversationId` pointing at one of these.
 */
export interface ConversationDoc extends BaseDoc {
  type: 'conversation';
  kind: 'dm' | 'group';
  /** Group name (groups only). DMs derive their title from the other participant. */
  name?: string;
  participantIds: string[];
  participantNames?: string[];
  createdByName?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageFromName?: string;
  /** User ids who have pinned this conversation to the top of their list. */
  pinnedBy?: string[];
  /** User ids who have muted notifications for this conversation. */
  mutedBy?: string[];
  /** User ids who have archived this conversation out of their active list. */
  archivedBy?: string[];
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

/** Lightweight staff presence statuses surfaced next to avatars. */
export type StaffPresence = 'active' | 'busy' | 'away' | 'on_call' | 'in_clinic' | 'offline';

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
  painScore?: string;       // 0–10 numeric rating scale
  bloodGlucose?: string;    // mmol/L
  gcs?: string;             // Glasgow Coma Scale 3–15
  muac?: string;            // mid-upper arm circumference, cm
  // Context
  chiefComplaint?: string;
  notes?: string;
  modeOfArrival?: 'walk-in' | 'ambulance' | 'referral' | 'police' | 'other' | '';
  symptomDuration?: string;   // free text, e.g. "2 days"
  referralSource?: string;    // referring facility / person
  knownAllergies?: string;    // free text; "" / "None known" when none
  // Audit
  triagedBy: string;       // user id
  triagedByName: string;   // display name at time of triage
  triagedAt: string;       // ISO datetime (distinct from createdAt to allow backfill)
  facilityId?: string;
  facilityName?: string;
  orgId?: string;
  // Follow-through
  status: 'pending' | 'seen' | 'admitted' | 'discharged' | 'referred';
  /**
   * OPD rooming: the exam room / bay the patient has been placed in to meet
   * the provider (e.g. "Room 3", "Bay B"). Set by front-desk/rooming staff.
   * Optional — only walk-in (triage-sourced) queue entries carry this.
   */
  assignedRoom?: string;
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
  /**
   * Free-text, multi-line bank-transfer instructions shown to patients in the
   * payment portals (bank name / account number / branch / reference
   * instructions). When unset, the portals fall back to a "contact billing"
   * placeholder rather than displaying a fabricated account. Set by the org
   * admin on the branding page.
   */
  bankDetails?: string;
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
export type AppointmentStatus = 'requested' | 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
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
