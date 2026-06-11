/**
 * CouchDB → PostgreSQL Sync Webhook
 *
 * This endpoint receives CouchDB _changes feed notifications and upserts
 * the corresponding documents into PostgreSQL for national analytics.
 *
 * Deployment: Configure CouchDB to POST changes to this endpoint, or use
 * a worker process that polls _changes and calls this route.
 *
 * POST /api/sync
 * Body: { db: string, changes: Array<{ id, seq, doc, deleted }> }
 *
 * ============================================================================
 * Coverage matrix vs DATABASE_SYNC_CONFIGS
 * ============================================================================
 * Every CouchDB database that participates in sync (DATABASE_SYNC_CONFIGS) has
 * an analytics writeback path here EXCEPT the following intentional exclusions:
 *
 *   - tamamhealth_users               Identity / auth surface. Personally
 *                                     identifiable; access via /api/users.
 *                                     Not an analytics target.
 *   - tamamhealth_platform_config     Server-pushed configuration, not data.
 *                                     Read-only on the client.
 *   - tamamhealth_organizations       Has a writeback (kept for slug/state
 *                                     joins on the dashboards).
 *   - tamamhealth_sync_events         Sync infrastructure. Ephemeral local
 *                                     event buffer; consumed by the
 *                                     conflict-queue UI then expired.
 *   - tamamhealth_conflict_queue      Sync infrastructure. Per-client
 *                                     conflict surface; not analytics-bound.
 *   - tamamhealth_saved_payment_methods  PCI-sensitive tokens. Must never
 *                                        leave the clinic perimeter.
 *   - tamamhealth_availability        Provider booking windows. Facility-
 *                                     operational scheduling, not a national
 *                                     analytics target.
 *   - tamamhealth_announcements       Staff broadcast notices. Facility-
 *                                     operational, not a national analytics
 *                                     target.
 *   - tamamhealth_biometric_templates Fingerprint minutiae templates. Highly
 *                                     sensitive biometric identifiers used
 *                                     only for in-org patient identification;
 *                                     must never flow to national analytics.
 *
 * All remaining databases land in DB_TABLE_MAP below; a missing entry causes a
 * 400 from this route, so the sync-worker surfaces a hard failure rather than
 * silently dropping data.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query, upsertDocument, deleteDocument } from '@/lib/db/postgres';

/**
 * Constant-time comparison of two strings. Prevents timing side-channels
 * that would otherwise leak the signature byte-by-byte.
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = new Uint8Array(Buffer.from(a, 'utf8'));
  const bufB = new Uint8Array(Buffer.from(b, 'utf8'));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify the CouchDB webhook signature. We require a dedicated
 * COUCHDB_WEBHOOK_SECRET (separate from the admin password) and compute
 * HMAC-SHA256 over the raw request body. Fails closed: any missing env
 * variable or signature mismatch returns false.
 */
function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.COUCHDB_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    console.error('[Sync] COUCHDB_WEBHOOK_SECRET not set or too short (<32 chars)');
    return false;
  }
  if (!header) return false;

  // Accept header forms: "sha256=<hex>" or just "<hex>"
  const provided = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return timingSafeEqualStrings(provided, expected);
}

// Map CouchDB database names to PostgreSQL table names
const DB_TABLE_MAP: Record<string, string> = {
  tamamhealth_patients: 'patients',
  tamamhealth_hospitals: 'hospitals',
  tamamhealth_medical_records: 'medical_records',
  tamamhealth_lab_results: 'lab_results',
  tamamhealth_referrals: 'referrals',
  tamamhealth_disease_alerts: 'disease_alerts',
  tamamhealth_prescriptions: 'prescriptions',
  tamamhealth_births: 'births',
  tamamhealth_deaths: 'deaths',
  tamamhealth_immunizations: 'immunizations',
  tamamhealth_anc: 'anc_visits',
  tamamhealth_boma_visits: 'boma_visits',
  tamamhealth_facility_assessments: 'facility_assessments',
  tamamhealth_audit_log: 'audit_log',
  tamamhealth_organizations: 'organizations',
  // Phase 2 — analytics writeback for clinical workflow tables.
  // Each one already has a CouchDB peer in DATABASE_SYNC_CONFIGS; the
  // table definition lives in `0003_clinical_workflow_tables.sql`.
  tamamhealth_problems: 'problems',
  tamamhealth_triage: 'triage_events',
  tamamhealth_appointments: 'appointments',
  tamamhealth_follow_ups: 'follow_ups',
  // Phase 3 — analytics writeback for messaging, financial revenue cycle,
  // regulatory append-only logs, operations, HR, facility infrastructure.
  // Table definitions live in `0004_analytics_writeback_phase3.sql`.
  tamamhealth_messages: 'messages',
  tamamhealth_controlled_substance_log: 'controlled_substance_log',
  tamamhealth_pharmacy_inventory: 'pharmacy_inventory',
  tamamhealth_telehealth: 'telehealth_sessions',
  tamamhealth_wards: 'wards',
  tamamhealth_blood_bank: 'blood_bank',
  tamamhealth_emergency_plans: 'emergency_plans',
  tamamhealth_assets: 'assets',
  tamamhealth_staff_schedules: 'staff_schedules',
  tamamhealth_leave_requests: 'leave_requests',
  tamamhealth_payroll_entries: 'payroll_entries',
  tamamhealth_patient_feedback: 'patient_feedback',
  tamamhealth_billing: 'billing',
  tamamhealth_fee_schedule: 'fee_schedule',
  tamamhealth_insurance_policies: 'insurance_policies',
  tamamhealth_eligibility_checks: 'eligibility_checks',
  tamamhealth_charges: 'charges',
  tamamhealth_claims: 'claims',
  tamamhealth_adjustments: 'adjustments',
  tamamhealth_payments: 'payments',
  tamamhealth_refunds: 'refunds',
  tamamhealth_payment_plans: 'payment_plans',
  tamamhealth_invoices: 'invoices',
  tamamhealth_ledger: 'ledger_entries',
};

// Map CouchDB doc fields to PostgreSQL column names per table
type FieldMapper = (doc: Record<string, unknown>) => Record<string, unknown>;

const FIELD_MAPPERS: Record<string, FieldMapper> = {
  patients: (doc) => ({
    id: doc._id,
    hospital_number: doc.hospitalNumber,
    name: doc.name,
    gender: doc.gender,
    date_of_birth: doc.dateOfBirth,
    age: doc.age,
    state: doc.state,
    county: doc.county,
    hospital_id: doc.hospitalId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  hospitals: (doc) => ({
    id: doc._id,
    name: doc.name,
    facility_type: doc.facilityType,
    facility_level: doc.facilityLevel,
    state: doc.state,
    county: doc.county,
    latitude: doc.latitude,
    longitude: doc.longitude,
    total_beds: doc.totalBeds,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  medical_records: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    hospital_id: doc.hospitalId,
    record_type: doc.recordType,
    diagnosis: doc.diagnosis,
    icd11_code: doc.icd11Code,
    severity: doc.severity,
    visit_date: doc.visitDate,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  lab_results: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    test_name: doc.testName,
    specimen: doc.specimen,
    status: doc.status,
    result: doc.result,
    abnormal: doc.abnormal,
    critical: doc.critical,
    hospital_id: doc.hospitalId,
    org_id: doc.orgId,
    ordered_at: doc.orderedAt,
    completed_at: doc.completedAt,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  referrals: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    from_hospital_id: doc.fromHospitalId || doc.from,
    to_hospital_id: doc.toHospitalId || doc.to,
    status: doc.status,
    urgency: doc.urgency,
    reason: doc.reason,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  disease_alerts: (doc) => ({
    id: doc._id,
    disease: doc.disease,
    icd11_code: doc.icd11Code,
    severity: doc.severity,
    state: doc.state,
    county: doc.county,
    cases: doc.cases,
    deaths: doc.deaths,
    status: doc.status,
    reported_by: doc.reportedBy,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  prescriptions: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    medication: doc.medication,
    dose: doc.dose,
    status: doc.status,
    hospital_id: doc.hospitalId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  births: (doc) => ({
    id: doc._id,
    child_first_name: doc.childFirstName,
    child_surname: doc.childSurname,
    child_gender: doc.childGender,
    date_of_birth: doc.dateOfBirth,
    place_of_birth: doc.placeOfBirth,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    mother_name: doc.motherName,
    mother_age: doc.motherAge,
    birth_weight: doc.birthWeight,
    birth_type: doc.birthType,
    delivery_type: doc.deliveryType,
    attended_by: doc.attendedBy,
    state: doc.state,
    county: doc.county,
    certificate_number: doc.certificateNumber,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  deaths: (doc) => ({
    id: doc._id,
    deceased_first_name: doc.deceasedFirstName,
    deceased_surname: doc.deceasedSurname,
    deceased_gender: doc.deceasedGender,
    date_of_birth: doc.dateOfBirth,
    date_of_death: doc.dateOfDeath,
    age_at_death: doc.ageAtDeath,
    place_of_death: doc.placeOfDeath,
    facility_id: doc.facilityId,
    immediate_cause: doc.immediateCause,
    immediate_icd11: doc.immediateICD11,
    underlying_cause: doc.underlyingCause,
    underlying_icd11: doc.underlyingICD11,
    manner_of_death: doc.mannerOfDeath,
    maternal_death: doc.maternalDeath,
    state: doc.state,
    county: doc.county,
    certificate_number: doc.certificateNumber,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  immunizations: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    vaccine: doc.vaccine,
    dose_number: doc.doseNumber,
    date_given: doc.dateGiven,
    next_due_date: doc.nextDueDate,
    facility_id: doc.facilityId,
    state: doc.state,
    status: doc.status,
    adverse_reaction: doc.adverseReaction,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  anc_visits: (doc) => ({
    id: doc._id,
    mother_id: doc.motherId,
    mother_name: doc.motherName,
    visit_number: doc.visitNumber,
    visit_date: doc.visitDate,
    gestational_age: doc.gestationalAge,
    risk_level: doc.riskLevel,
    facility_id: doc.facilityId,
    state: doc.state,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  boma_visits: (doc) => ({
    id: doc._id,
    worker_id: doc.workerId,
    worker_name: doc.workerName,
    patient_name: doc.patientName,
    geocode_id: doc.geocodeId,
    chief_complaint: doc.chiefComplaint,
    suspected_condition: doc.suspectedCondition,
    icd11_code: doc.icd11Code,
    action: doc.action,
    outcome: doc.outcome,
    state: doc.state,
    county: doc.county,
    payam: doc.payam,
    boma: doc.boma,
    visit_date: doc.visitDate,
    gps_latitude: doc.gpsLatitude,
    gps_longitude: doc.gpsLongitude,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  facility_assessments: (doc) => ({
    id: doc._id,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    assessment_date: doc.assessmentDate,
    overall_score: doc.overallScore,
    general_equipment_score: doc.generalEquipmentScore,
    diagnostic_capacity_score: doc.diagnosticCapacityScore,
    essential_medicines_score: doc.essentialMedicinesScore,
    staffing_score: doc.staffingScore,
    data_quality_score: doc.dataQualityScore,
    state: doc.state,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  audit_log: (doc) => ({
    id: doc._id,
    action: doc.action,
    user_id: doc.userId,
    username: doc.username,
    details: doc.details,
    success: doc.success,
    org_id: doc.orgId,
    created_at: doc.createdAt,
  }),

  organizations: (doc) => ({
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    org_type: doc.orgType,
    subscription_status: doc.subscriptionStatus,
    subscription_plan: doc.subscriptionPlan,
    is_active: doc.isActive,
    contact_email: doc.contactEmail,
    country: doc.country,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  // ----- Phase 2 analytics writeback -----

  problems: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    name: doc.name,
    icd11_code: doc.icd11Code,
    icd10_code: doc.icd10Code,
    status: doc.status,
    onset_date: doc.onsetDate,
    resolved_date: doc.resolvedDate,
    severity: doc.severity,
    hospital_id: doc.hospitalId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  triage_events: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    priority: doc.priority,
    airway: doc.airway,
    breathing: doc.breathing,
    circulation: doc.circulation,
    consciousness: doc.consciousness,
    chief_complaint: doc.chiefComplaint,
    facility_id: doc.facilityId,
    triaged_at: doc.triagedAt,
    status: doc.status,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  appointments: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    provider_id: doc.providerId,
    provider_name: doc.providerName,
    facility_id: doc.facilityId,
    appointment_date: doc.appointmentDate,
    appointment_time: doc.appointmentTime,
    duration: doc.duration,
    appointment_type: doc.appointmentType,
    priority: doc.priority,
    department: doc.department,
    status: doc.status,
    state: doc.state,
    county: doc.county,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  follow_ups: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    assigned_worker: doc.assignedWorker,
    assigned_worker_name: doc.assignedWorkerName,
    status: doc.status,
    outcome: doc.outcome,
    condition: doc.condition,
    facility_level: doc.facilityLevel,
    scheduled_date: doc.scheduledDate,
    completed_date: doc.completedDate,
    state: doc.state,
    county: doc.county,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  // ----- Phase 3 analytics writeback -----

  messages: (doc) => ({
    id: doc._id,
    recipient_type: doc.recipientType,
    direction: doc.direction,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    patient_phone: doc.patientPhone,
    from_doctor_id: doc.fromDoctorId,
    from_doctor_name: doc.fromDoctorName,
    from_hospital_id: doc.fromHospitalId,
    from_hospital_name: doc.fromHospitalName,
    subject: doc.subject,
    body: doc.body,
    channel: doc.channel,
    status: doc.status,
    sent_at: doc.sentAt,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  controlled_substance_log: (doc) => ({
    id: doc._id,
    inventory_id: doc.inventoryId,
    medication_name: doc.medicationName,
    schedule: doc.schedule,
    movement: doc.movement,
    quantity: doc.quantity,
    unit: doc.unit,
    before_balance: doc.beforeBalance,
    after_balance: doc.afterBalance,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    prescription_id: doc.prescriptionId,
    operator_id: doc.operatorId,
    operator_name: doc.operatorName,
    witness_id: doc.witnessId,
    witness_name: doc.witnessName,
    reason: doc.reason,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    org_id: doc.orgId,
    created_at: doc.createdAt,
  }),

  pharmacy_inventory: (doc) => ({
    id: doc._id,
    hospital_id: doc.hospitalId,
    hospital_name: doc.hospitalName,
    medication_name: doc.medicationName,
    category: doc.category,
    stock_level: doc.stockLevel,
    unit: doc.unit,
    reorder_level: doc.reorderLevel,
    batch_number: doc.batchNumber,
    expiry_date: doc.expiryDate,
    last_received: doc.lastReceived,
    last_dispensed: doc.lastDispensed,
    dispensed_today: doc.dispensedToday,
    controlled_schedule: doc.controlledSchedule,
    requires_witness: doc.requiresWitness,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  telehealth_sessions: (doc) => ({
    id: doc._id,
    appointment_id: doc.appointmentId,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    provider_id: doc.providerId,
    provider_name: doc.providerName,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    session_type: doc.sessionType,
    scheduled_date: doc.scheduledDate,
    scheduled_time: doc.scheduledTime,
    actual_start_time: doc.actualStartTime,
    actual_end_time: doc.actualEndTime,
    duration: doc.duration,
    status: doc.status,
    chief_complaint: doc.chiefComplaint,
    diagnosis: doc.diagnosis,
    icd10_code: doc.icd10Code,
    follow_up_required: doc.followUpRequired,
    referral_required: doc.referralRequired,
    session_quality: doc.sessionQuality,
    connection_drops: doc.connectionDrops,
    patient_consent_given: doc.patientConsentGiven,
    session_recorded: doc.sessionRecorded,
    patient_rating: doc.patientRating,
    consultation_fee: doc.consultationFee,
    currency: doc.currency,
    payment_status: doc.paymentStatus,
    state: doc.state,
    county: doc.county,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  wards: (doc) => ({
    id: doc._id,
    name: doc.name,
    ward_type: doc.wardType,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    facility_level: doc.facilityLevel,
    floor: doc.floor,
    total_beds: doc.totalBeds,
    occupied_beds: doc.occupiedBeds,
    available_beds: doc.availableBeds,
    nurse_in_charge: doc.nurseInCharge,
    is_active: doc.isActive,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  blood_bank: (doc) => ({
    id: doc._id,
    unit_id: doc.unitId,
    blood_group: doc.bloodGroup,
    component: doc.component,
    volume: doc.volume,
    collection_date: doc.collectionDate,
    expiry_date: doc.expiryDate,
    donor_id: doc.donorId,
    donor_name: doc.donorName,
    status: doc.status,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  emergency_plans: (doc) => ({
    id: doc._id,
    plan_name: doc.planName,
    emergency_type: doc.emergencyType,
    phase: doc.phase,
    severity: doc.severity,
    description: doc.description,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    activated_at: doc.activatedAt,
    deactivated_at: doc.deactivatedAt,
    estimated_capacity: doc.estimatedCapacity,
    current_load: doc.currentLoad,
    total_cases_managed: doc.totalCasesManaged,
    total_deaths: doc.totalDeaths,
    total_referrals_out: doc.totalReferralsOut,
    state: doc.state,
    county: doc.county,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  assets: (doc) => ({
    id: doc._id,
    name: doc.name,
    serial_number: doc.serialNumber,
    asset_tag: doc.assetTag,
    category: doc.category,
    manufacturer: doc.manufacturer,
    model: doc.model,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    facility_level: doc.facilityLevel,
    department: doc.department,
    location: doc.location,
    status: doc.status,
    condition: doc.condition,
    acquired_date: doc.acquiredDate,
    cost_currency: doc.costCurrency,
    cost: doc.cost,
    donor: doc.donor,
    warranty_expires_at: doc.warrantyExpiresAt,
    last_serviced_at: doc.lastServicedAt,
    next_service_due_at: doc.nextServiceDueAt,
    service_interval_months: doc.serviceIntervalMonths,
    state: doc.state,
    county: doc.county,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  staff_schedules: (doc) => ({
    id: doc._id,
    user_id: doc.userId,
    user_name: doc.userName,
    role: doc.role,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    shift_type: doc.shiftType,
    shift_date: doc.shiftDate,
    start_time: doc.startTime,
    end_time: doc.endTime,
    department: doc.department,
    is_on_call: doc.isOnCall,
    status: doc.status,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  leave_requests: (doc) => ({
    id: doc._id,
    user_id: doc.userId,
    user_name: doc.userName,
    role: doc.role,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    leave_type: doc.leaveType,
    start_date: doc.startDate,
    end_date: doc.endDate,
    days: doc.days,
    reason: doc.reason,
    status: doc.status,
    requested_at: doc.requestedAt,
    decided_at: doc.decidedAt,
    decided_by: doc.decidedBy,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  payroll_entries: (doc) => ({
    id: doc._id,
    user_id: doc.userId,
    user_name: doc.userName,
    role: doc.role,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    period: doc.period,
    base_salary: doc.baseSalary,
    allowances: doc.allowances,
    deductions: doc.deductions,
    net_pay: doc.netPay,
    currency: doc.currency,
    status: doc.status,
    paid_at: doc.paidAt,
    paid_by: doc.paidBy,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  patient_feedback: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    department: doc.department,
    visit_date: doc.visitDate,
    rating: doc.rating,
    nps_score: doc.npsScore,
    sentiment: doc.sentiment,
    category: doc.category,
    comment: doc.comment,
    channel: doc.channel,
    follow_up_required: doc.followUpRequired,
    follow_up_status: doc.followUpStatus,
    resolved_at: doc.resolvedAt,
    state: doc.state,
    county: doc.county,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  billing: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    facility_level: doc.facilityLevel,
    encounter_date: doc.encounterDate,
    encounter_id: doc.encounterId,
    appointment_id: doc.appointmentId,
    subtotal: doc.subtotal,
    discount: doc.discount,
    tax_rate: doc.taxRate,
    tax_amount: doc.taxAmount,
    total_amount: doc.totalAmount,
    amount_paid: doc.amountPaid,
    balance_due: doc.balanceDue,
    currency: doc.currency,
    status: doc.status,
    invoice_number: doc.invoiceNumber,
    insurance_provider: doc.insuranceProvider,
    insurance_claim_status: doc.insuranceClaimStatus,
    insurance_approved_amount: doc.insuranceApprovedAmount,
    state: doc.state,
    county: doc.county,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  fee_schedule: (doc) => ({
    id: doc._id,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    category: doc.category,
    service_code: doc.serviceCode,
    service_name: doc.serviceName,
    unit_price: doc.unitPrice,
    currency: doc.currency,
    is_active: doc.isActive,
    effective_from: doc.effectiveFrom,
    effective_to: doc.effectiveTo,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  insurance_policies: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    payer_type: doc.payerType,
    payer_name: doc.payerName,
    payer_code: doc.payerCode,
    member_id: doc.memberId,
    group_number: doc.groupNumber,
    policy_number: doc.policyNumber,
    subscriber_name: doc.subscriberName,
    subscriber_relationship: doc.subscriberRelationship,
    effective_date: doc.effectiveDate,
    termination_date: doc.terminationDate,
    is_primary: doc.isPrimary,
    copay_amount: doc.copayAmount,
    coinsurance_pct: doc.coinsurancePct,
    deductible_amount: doc.deductibleAmount,
    deductible_remaining: doc.deductibleRemaining,
    oop_max: doc.oopMax,
    oop_used: doc.oopUsed,
    is_active: doc.isActive,
    donor_program_id: doc.donorProgramId,
    donor_coverage_type: doc.donorCoverageType,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  eligibility_checks: (doc) => ({
    id: doc._id,
    policy_id: doc.policyId,
    patient_id: doc.patientId,
    check_date: doc.checkDate,
    status: doc.status,
    deductible_remaining: doc.deductibleRemaining,
    copay_amount: doc.copayAmount,
    coinsurance_pct: doc.coinsurancePct,
    oop_used: doc.oopUsed,
    oop_max: doc.oopMax,
    estimated_patient_responsibility: doc.estimatedPatientResponsibility,
    source: doc.source,
    expires_at: doc.expiresAt,
    checked_by: doc.checkedBy,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  charges: (doc) => ({
    id: doc._id,
    encounter_id: doc.encounterId,
    patient_id: doc.patientId,
    cpt_code: doc.cptCode,
    modifier: doc.modifier,
    description: doc.description,
    category: doc.category,
    units: doc.units,
    billed_amount: doc.billedAmount,
    allowed_amount: doc.allowedAmount,
    status: doc.status,
    claim_id: doc.claimId,
    denial_reason_code: doc.denialReasonCode,
    service_date: doc.serviceDate,
    provider_id: doc.providerId,
    provider_name: doc.providerName,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  claims: (doc) => ({
    id: doc._id,
    encounter_id: doc.encounterId,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    policy_id: doc.policyId,
    payer_name: doc.payerName,
    payer_type: doc.payerType,
    claim_number: doc.claimNumber,
    total_billed: doc.totalBilled,
    total_allowed: doc.totalAllowed,
    total_approved: doc.totalApproved,
    total_denied: doc.totalDenied,
    total_write_off: doc.totalWriteOff,
    patient_responsibility: doc.patientResponsibility,
    submitted_date: doc.submittedDate,
    adjudicated_date: doc.adjudicatedDate,
    status: doc.status,
    era_reference: doc.eraReference,
    donor_reporting_period: doc.donorReportingPeriod,
    submitted_by: doc.submittedBy,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  adjustments: (doc) => ({
    id: doc._id,
    encounter_id: doc.encounterId,
    patient_id: doc.patientId,
    charge_id: doc.chargeId,
    claim_id: doc.claimId,
    adjustment_type: doc.adjustmentType,
    amount: doc.amount,
    reason: doc.reason,
    reason_code: doc.reasonCode,
    approved_by: doc.approvedBy,
    approved_date: doc.approvedDate,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  payments: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    encounter_id: doc.encounterId,
    invoice_id: doc.invoiceId,
    payment_plan_id: doc.paymentPlanId,
    method: doc.method,
    amount: doc.amount,
    currency: doc.currency,
    reference: doc.reference,
    mobile_money_phone: doc.mobileMoneyPhone,
    card_last4: doc.cardLast4,
    status: doc.status,
    processed_at: doc.processedAt,
    processed_by: doc.processedBy,
    reversed_at: doc.reversedAt,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  refunds: (doc) => ({
    id: doc._id,
    payment_id: doc.paymentId,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    amount: doc.amount,
    currency: doc.currency,
    method: doc.method,
    reference: doc.reference,
    reason: doc.reason,
    status: doc.status,
    processed_at: doc.processedAt,
    processed_by: doc.processedBy,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  payment_plans: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    total_balance: doc.totalBalance,
    term_months: doc.termMonths,
    monthly_amount: doc.monthlyAmount,
    apr: doc.apr,
    start_date: doc.startDate,
    end_date: doc.endDate,
    status: doc.status,
    next_due_date: doc.nextDueDate,
    paid_to_date: doc.paidToDate,
    remaining_balance: doc.remainingBalance,
    missed_payments: doc.missedPayments,
    last_payment_date: doc.lastPaymentDate,
    auto_pay_enabled: doc.autoPayEnabled,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  invoices: (doc) => ({
    id: doc._id,
    invoice_number: doc.invoiceNumber,
    patient_id: doc.patientId,
    patient_name: doc.patientName,
    encounter_id: doc.encounterId,
    subtotal: doc.subtotal,
    insurance_payments: doc.insurancePayments,
    adjustments: doc.adjustments,
    prior_payments: doc.priorPayments,
    total_due: doc.totalDue,
    currency: doc.currency,
    issued_date: doc.issuedDate,
    due_date: doc.dueDate,
    status: doc.status,
    sent_via: doc.sentVia,
    sent_at: doc.sentAt,
    viewed_at: doc.viewedAt,
    paid_at: doc.paidAt,
    facility_id: doc.facilityId,
    facility_name: doc.facilityName,
    org_id: doc.orgId,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }),

  ledger_entries: (doc) => ({
    id: doc._id,
    patient_id: doc.patientId,
    encounter_id: doc.encounterId,
    entry_type: doc.entryType,
    amount: doc.amount,
    running_balance: doc.runningBalance,
    description: doc.description,
    reference_id: doc.referenceId,
    reference_type: doc.referenceType,
    method: doc.method,
    currency: doc.currency,
    facility_id: doc.facilityId,
    org_id: doc.orgId,
    created_at: doc.createdAt,
  }),
};

interface ChangeEntry {
  id: string;
  seq: string;
  doc?: Record<string, unknown>;
  deleted?: boolean;
}

interface SyncPayload {
  db: string;
  changes: ChangeEntry[];
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Sync not configured: DATABASE_URL not set' }, { status: 503 });
    }

    // Require a dedicated HMAC-signed webhook secret. Previously this used
    // COUCHDB_ADMIN_PASSWORD as a bearer token, which reused a high-value
    // credential and gave anyone who captured the header full privileges.
    // HMAC over the raw body also prevents replay / tampering.
    const rawBody = await request.text();
    const signature = request.headers.get('x-tamamhealth-signature') || request.headers.get('authorization');
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: SyncPayload;
    try {
      body = JSON.parse(rawBody) as SyncPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { db, changes } = body;

    if (!db || !changes || !Array.isArray(changes)) {
      return NextResponse.json({ error: 'Invalid payload: requires db and changes array' }, { status: 400 });
    }

    const table = DB_TABLE_MAP[db];
    if (!table) {
      return NextResponse.json({ error: `Unknown database: ${db}` }, { status: 400 });
    }

    const mapper = FIELD_MAPPERS[table];
    if (!mapper) {
      return NextResponse.json({ error: `No field mapper for table: ${table}` }, { status: 400 });
    }

    let processed = 0;
    let errors = 0;
    let lastSeq = '';

    for (const change of changes) {
      try {
        if (change.deleted) {
          await deleteDocument(table, change.id);
        } else if (change.doc) {
          // Skip design documents
          if (change.id.startsWith('_design/')) continue;

          const mapped = mapper(change.doc);
          // Filter out undefined values
          const cleaned: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(mapped)) {
            if (v !== undefined) cleaned[k] = v;
          }
          await upsertDocument(table, change.id, cleaned);
        }
        processed++;
        lastSeq = change.seq;
      } catch (err) {
        console.error(`[Sync] Error processing ${change.id}:`, err);
        errors++;
      }
    }

    // Update sync metadata with last processed sequence
    if (lastSeq) {
      await query(
        `INSERT INTO sync_metadata (db_name, last_seq, last_synced_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (db_name) DO UPDATE SET last_seq = $2, last_synced_at = NOW()`,
        [db, lastSeq]
      );
    }

    return NextResponse.json({
      ok: true,
      processed,
      errors,
      lastSeq,
    });
  } catch (err) {
    // Same 503 mapping as GET — a Postgres outage during webhook delivery is
    // a transient infrastructure condition, not a sync-worker bug. Returning
    // 503 lets the worker back off + retry instead of declaring the payload
    // poisoned (which would happen on a 500-class response).
    const e = err as { code?: string; message?: string } | undefined;
    const code = e?.code;
    const msg = e?.message || '';
    const unreachable =
      code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' ||
      code === '28000' /* invalid_authorization_specification */ ||
      code === '28P01' /* invalid_password */ ||
      code === '3D000' /* invalid_catalog_name (database missing) */ ||
      code === '42P01' /* undefined_table — migrations not applied */ ||
      /role .* does not exist/i.test(msg);
    if (unreachable) {
      console.warn('[Sync] Postgres unavailable for webhook:', code || msg);
      return NextResponse.json(
        { error: 'Sync analytics database is unavailable', code: code || 'UNAVAILABLE' },
        { status: 503 }
      );
    }
    console.error('[Sync] Webhook error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** GET /api/sync — return sync metadata (last sequence per DB) */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Sync not configured: DATABASE_URL not set' }, { status: 503 });
    }

    const result = await query<{ db_name: string; last_seq: string; last_synced_at: string }>(
      'SELECT db_name, last_seq, last_synced_at FROM sync_metadata ORDER BY db_name'
    );
    return NextResponse.json({ databases: result.rows });
  } catch (err) {
    // Postgres unreachable / role missing / migrations not applied — surface a
    // 503 (service unavailable) rather than a generic 500. Any of these means
    // the analytics writeback is operationally offline; callers (status pages,
    // health checks, the conflicts UI) need that signal to be specific so they
    // can render a meaningful banner instead of a red "Internal Server Error".
    const e = err as { code?: string; message?: string } | undefined;
    const code = e?.code;
    const msg = e?.message || '';
    const unreachable =
      code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' ||
      code === '28000' /* invalid_authorization_specification */ ||
      code === '28P01' /* invalid_password */ ||
      code === '3D000' /* invalid_catalog_name (database missing) */ ||
      code === '42P01' /* undefined_table — migrations not applied */ ||
      /role .* does not exist/i.test(msg);
    if (unreachable) {
      console.warn('[Sync] Postgres unavailable for status check:', code || msg);
      return NextResponse.json(
        { error: 'Sync analytics database is unavailable', code: code || 'UNAVAILABLE' },
        { status: 503 }
      );
    }
    console.error('[Sync] Status error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
