/**
 * Payment Service — handles collecting payments, managing insurance,
 * payment plans, refunds, invoicing, and eligibility verification.
 * All financial mutations create corresponding ledger entries.
 */
import { getDB } from '../db';
import { findByType } from './db-query';

/**
 * Referential-integrity guard: throw if an id is provided but the referenced
 * document doesn't exist, so charges/payments can't be created pointing at a
 * missing encounter/invoice (which would silently break reports + audit trails).
 */
async function assertRefExists(dbName: string, id: string | undefined, label: string): Promise<void> {
  if (!id) return;
  try {
    await getDB(dbName).get(id);
  } catch {
    throw new Error(`${label} ${id} does not exist — refusing to create an orphaned record.`);
  }
}
import type {
  PaymentDoc, PaymentMethodType, PaymentStatus, PaymentAllocation,
  InsurancePolicyDoc, PayerType,
  EligibilityCheckDoc, EligibilityStatus, EligibilitySource,
  RefundDoc,
  SavedPaymentMethodDoc, SavedPaymentMethodType,
  PaymentPlanDoc, PlanInstallment,
  InvoiceDoc, InvoiceLineItem, InvoiceStatus,
  ClaimDoc, ClaimStatus,
  AdjustmentDoc, AdjustmentType,
  ChargeDoc, ChargeStatus,
  PatientFinancialSummary,
} from '../db-types-payments';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { createLedgerEntry, getPatientBalance } from './ledger-service';
import { jubaDate } from '../time-juba';

const COLLECTION_STAGE_DAYS = {
  followUp: Number(process.env.COLLECTION_STAGE_FOLLOWUP_DAYS) || 30,
  warning: Number(process.env.COLLECTION_STAGE_WARNING_DAYS) || 60,
  preWriteOff: Number(process.env.COLLECTION_STAGE_PREWRITEOFF_DAYS) || 90,
};

// ═══ Database accessors ════════════════════════════════════════════
const paymentsDB = () => getDB('tamamhealth_payments');
const insurancePoliciesDB = () => getDB('tamamhealth_insurance_policies');
const eligibilityChecksDB = () => getDB('tamamhealth_eligibility_checks');
const refundsDB = () => getDB('tamamhealth_refunds');
const savedPaymentMethodsDB = () => getDB('tamamhealth_saved_payment_methods');
const paymentPlansDB = () => getDB('tamamhealth_payment_plans');
const invoicesDB = () => getDB('tamamhealth_invoices');
const claimsDB = () => getDB('tamamhealth_claims');
const adjustmentsDB = () => getDB('tamamhealth_adjustments');
const chargesDB = () => getDB('tamamhealth_charges');

// ═══════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════

export interface CollectPaymentInput {
  patientId: string;
  patientName: string;
  encounterId?: string;
  invoiceId?: string;
  paymentPlanId?: string;
  method: PaymentMethodType;
  amount: number;
  currency?: string;
  reference?: string;
  mobileMoneyPhone?: string;
  cardLast4?: string;
  allocations?: PaymentAllocation[];
  notes?: string;
  processedBy: string;
  processedByName: string;
  facilityId: string;
  orgId?: string;
}

export async function collectPayment(input: CollectPaymentInput): Promise<PaymentDoc> {
  const db = paymentsDB();
  const now = new Date().toISOString();
  // Don't post a payment against an encounter/invoice that doesn't exist.
  await assertRefExists('tamamhealth_encounters', input.encounterId, 'Encounter');
  await assertRefExists('tamamhealth_invoices', input.invoiceId, 'Invoice');

  const doc: PaymentDoc = {
    _id: `pmt-${uuidv4().slice(0, 10)}`,
    type: 'payment',
    patientId: input.patientId,
    patientName: input.patientName,
    encounterId: input.encounterId,
    invoiceId: input.invoiceId,
    paymentPlanId: input.paymentPlanId,
    method: input.method,
    amount: input.amount,
    currency: input.currency || 'SSP',
    reference: input.reference || `REC-${uuidv4().slice(0, 8).toUpperCase()}`,
    mobileMoneyPhone: input.mobileMoneyPhone,
    cardLast4: input.cardLast4,
    status: 'posted' as PaymentStatus,
    processedAt: now,
    processedBy: input.processedBy,
    processedByName: input.processedByName,
    allocations: input.allocations,
    notes: input.notes,
    facilityId: input.facilityId,
    orgId: input.orgId,
    createdAt: now,
    updatedAt: now,
    createdBy: input.processedBy,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  // Create ledger entry (negative = credit = balance decreases)
  await createLedgerEntry({
    patientId: input.patientId,
    encounterId: input.encounterId,
    entryType: 'payment',
    amount: -input.amount,
    description: `Payment via ${input.method}: ${input.amount} ${doc.currency}`,
    referenceId: doc._id,
    referenceType: 'payment',
    method: input.method,
    currency: doc.currency,
    facilityId: input.facilityId,
    orgId: input.orgId,
    createdBy: input.processedBy,
  });

  await logAuditSafe(
    'PAYMENT_COLLECTED', input.processedBy, input.processedByName,
    `${input.amount} ${doc.currency} via ${input.method} from ${input.patientName} (ref: ${doc.reference})`
  );

  emitSyncEvent({
    resourceType: 'payment',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });

  return doc;
}

export async function getPaymentsByPatient(patientId: string): Promise<PaymentDoc[]> {
  const rows = await findByType<PaymentDoc>(paymentsDB(), 'payment', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows
    .sort((a, b) => (b.processedAt || '').localeCompare(a.processedAt || ''));
}

export async function getAllPayments(scope?: DataScope): Promise<PaymentDoc[]> {
  const db = paymentsDB();
  const all = await findByType<PaymentDoc>(db, 'payment');
  all.sort((a, b) => (b.processedAt || '').localeCompare(a.processedAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function reversePayment(
  paymentId: string, reason: string, reversedBy: string, reversedByName: string
): Promise<PaymentDoc | null> {
  const db = paymentsDB();
  try {
    const pmt = await db.get(paymentId) as PaymentDoc;
    if (pmt.status === 'reversed') return pmt;

    pmt.status = 'reversed';
    pmt.reversedAt = new Date().toISOString();
    pmt.reversalReason = reason;
    pmt.updatedAt = pmt.reversedAt;
    const resp = await db.put(pmt);
    pmt._rev = resp.rev;

    // Reverse the ledger entry (positive = debit = balance increases)
    await createLedgerEntry({
      patientId: pmt.patientId,
      encounterId: pmt.encounterId,
      entryType: 'payment',
      amount: pmt.amount, // positive reversal
      description: `Payment reversal: ${reason}`,
      referenceId: pmt._id,
      referenceType: 'payment',
      facilityId: pmt.facilityId,
      orgId: pmt.orgId,
    });

    await logAuditSafe('PAYMENT_REVERSED', reversedBy, reversedByName,
      `Reversed ${pmt.amount} ${pmt.currency} — ${reason}`);

    emitSyncEvent({
      resourceType: 'payment',
      resourceId: pmt._id,
      operation: 'update',
      resourceVersion: pmt._rev,
      orgId: pmt.orgId,
      hospitalId: pmt.facilityId,
    });

    return pmt;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// INSURANCE POLICIES
// ═══════════════════════════════════════════════════════════════════

export interface CreateInsurancePolicyInput {
  patientId: string;
  payerType: PayerType;
  payerName: string;
  payerCode?: string;
  memberId?: string;
  groupNumber?: string;
  policyNumber?: string;
  subscriberName?: string;
  subscriberRelationship?: 'self' | 'spouse' | 'child' | 'other';
  effectiveDate: string;
  terminationDate?: string;
  isPrimary: boolean;
  copayAmount?: number;
  coinsurancePct?: number;
  deductibleAmount?: number;
  deductibleRemaining?: number;
  oopMax?: number;
  coverageNotes?: string;
  donorProgramId?: string;
  donorCoverageType?: 'full' | 'partial' | 'emergency_only';
  facilityId: string;
  orgId?: string;
  createdBy?: string;
}

export async function createInsurancePolicy(input: CreateInsurancePolicyInput): Promise<InsurancePolicyDoc> {
  const db = insurancePoliciesDB();
  const now = new Date().toISOString();

  // If marking as primary, unmark other policies for this patient
  if (input.isPrimary) {
    const existing = await getPatientInsurancePolicies(input.patientId);
    for (const p of existing) {
      if (p.isPrimary) {
        p.isPrimary = false;
        p.updatedAt = now;
        await db.put(p);
      }
    }
  }

  const doc: InsurancePolicyDoc = {
    _id: `ins-${uuidv4().slice(0, 10)}`,
    type: 'insurance_policy',
    ...input,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;
  emitSyncEvent({
    resourceType: 'insurance_policy',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });
  return doc;
}

export async function getPatientInsurancePolicies(patientId: string): Promise<InsurancePolicyDoc[]> {
  const db = insurancePoliciesDB();
  const rows = await findByType<InsurancePolicyDoc>(db, 'insurance_policy', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows
    .filter(d => d && d.isActive)
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
}

export async function getPrimaryPolicy(patientId: string): Promise<InsurancePolicyDoc | null> {
  const policies = await getPatientInsurancePolicies(patientId);
  return policies.find(p => p.isPrimary) || policies[0] || null;
}

export async function updateInsurancePolicy(id: string, updates: Partial<InsurancePolicyDoc>): Promise<InsurancePolicyDoc | null> {
  const db = insurancePoliciesDB();
  try {
    const doc = await db.get(id) as InsurancePolicyDoc;
    Object.assign(doc, updates, { updatedAt: new Date().toISOString() });
    const resp = await db.put(doc);
    doc._rev = resp.rev;
    emitSyncEvent({
      resourceType: 'insurance_policy',
      resourceId: doc._id,
      operation: 'update',
      resourceVersion: doc._rev,
      orgId: doc.orgId,
      hospitalId: doc.facilityId,
    });
    return doc;
  } catch { return null; }
}

export async function deactivateInsurancePolicy(id: string): Promise<boolean> {
  const db = insurancePoliciesDB();
  try {
    const doc = await db.get(id) as InsurancePolicyDoc;
    doc.isActive = false;
    doc.updatedAt = new Date().toISOString();
    const resp = await db.put(doc);
    doc._rev = resp.rev;
    emitSyncEvent({
      resourceType: 'insurance_policy',
      resourceId: doc._id,
      operation: 'update',
      resourceVersion: doc._rev,
      orgId: doc.orgId,
      hospitalId: doc.facilityId,
    });
    return true;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════
// ELIGIBILITY VERIFICATION
// ═══════════════════════════════════════════════════════════════════

export interface CheckEligibilityInput {
  policyId: string;
  patientId: string;
  source?: EligibilitySource;
  checkedBy: string;
  facilityId: string;
  orgId?: string;
}

export async function checkEligibility(input: CheckEligibilityInput): Promise<EligibilityCheckDoc> {
  const db = eligibilityChecksDB();
  const now = new Date().toISOString();

  // Get the policy to pull payer details
  const policy = await getPrimaryPolicy(input.patientId);

  const doc: EligibilityCheckDoc = {
    _id: `elig-${uuidv4().slice(0, 10)}`,
    type: 'eligibility_check',
    policyId: input.policyId,
    patientId: input.patientId,
    checkDate: now,
    status: 'verified' as EligibilityStatus,
    deductibleRemaining: policy?.deductibleRemaining,
    copayAmount: policy?.copayAmount,
    coinsurancePct: policy?.coinsurancePct,
    oopUsed: policy?.oopUsed,
    oopMax: policy?.oopMax,
    source: input.source || 'manual',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    checkedBy: input.checkedBy,
    facilityId: input.facilityId,
    orgId: input.orgId,
    createdAt: now,
    updatedAt: now,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;
  emitSyncEvent({
    resourceType: 'eligibility_check',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });
  return doc;
}

export async function getLatestEligibility(patientId: string): Promise<EligibilityCheckDoc | null> {
  const db = eligibilityChecksDB();
  const checks = (await findByType<EligibilityCheckDoc>(db, 'eligibility_check', { patientId }, { indexFields: ['type', 'patientId'] }))
    .sort((a, b) => (b.checkDate || '').localeCompare(a.checkDate || ''));
  return checks[0] || null;
}

export function estimatePatientResponsibility(
  billedAmount: number,
  copay: number = 0,
  coinsurancePct: number = 0,
  deductibleRemaining: number = 0,
): number {
  // Patient pays deductible first, then coinsurance on the rest
  const afterDeductible = Math.max(0, billedAmount - deductibleRemaining);
  const deductiblePortion = Math.min(billedAmount, deductibleRemaining);
  const coinsurancePortion = afterDeductible * (coinsurancePct / 100);
  return Math.round((copay + deductiblePortion + coinsurancePortion) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════
// CHARGES
// ═══════════════════════════════════════════════════════════════════

export interface CreateChargeInput {
  encounterId: string;
  patientId: string;
  cptCode?: string;
  icdCodes?: string[];
  modifier?: string;
  description: string;
  category: string;
  units: number;
  billedAmount: number;
  serviceDate: string;
  providerId?: string;
  providerName?: string;
  facilityId: string;
  orgId?: string;
  createdBy?: string;
}

export async function createCharge(input: CreateChargeInput): Promise<ChargeDoc> {
  const db = chargesDB();
  const now = new Date().toISOString();
  // Don't create a charge linked to a non-existent encounter.
  await assertRefExists('tamamhealth_encounters', input.encounterId, 'Encounter');

  const doc: ChargeDoc = {
    _id: `chg-${uuidv4().slice(0, 10)}`,
    type: 'charge',
    ...input,
    status: 'pending' as ChargeStatus,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  // Create ledger entry (positive = debit = patient owes more)
  await createLedgerEntry({
    patientId: input.patientId,
    encounterId: input.encounterId,
    entryType: 'charge',
    amount: input.billedAmount * input.units,
    description: `Charge: ${input.description} (${input.units}x $${input.billedAmount})`,
    referenceId: doc._id,
    referenceType: 'charge',
    currency: 'SSP',
    facilityId: input.facilityId,
    orgId: input.orgId,
    createdBy: input.createdBy,
  });

  emitSyncEvent({
    resourceType: 'charge',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });

  return doc;
}

export async function getChargesByEncounter(encounterId: string): Promise<ChargeDoc[]> {
  const db = chargesDB();
  return findByType<ChargeDoc>(db, 'charge', { encounterId }, { indexFields: ['type', 'encounterId'] });
}

export async function getChargesByPatient(patientId: string): Promise<ChargeDoc[]> {
  const rows = await findByType<ChargeDoc>(chargesDB(), 'charge', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows
    .sort((a, b) => (b.serviceDate || '').localeCompare(a.serviceDate || ''));
}

// ═══════════════════════════════════════════════════════════════════
// CLAIMS
// ═══════════════════════════════════════════════════════════════════

export interface SubmitClaimInput {
  encounterId: string;
  patientId: string;
  patientName: string;
  policyId: string;
  payerName: string;
  payerType: PayerType;
  chargeIds: string[];
  totalBilled: number;
  facilityId: string;
  facilityName: string;
  submittedBy: string;
  orgId?: string;
}

export async function submitClaim(input: SubmitClaimInput): Promise<ClaimDoc> {
  const db = claimsDB();
  const now = new Date().toISOString();

  const doc: ClaimDoc = {
    _id: `clm-${uuidv4().slice(0, 10)}`,
    type: 'claim',
    ...input,
    claimNumber: `CLM-${Date.now().toString(36).toUpperCase()}`,
    submittedDate: now,
    status: 'submitted' as ClaimStatus,
    createdAt: now,
    updatedAt: now,
    createdBy: input.submittedBy,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  await logAuditSafe('CLAIM_SUBMITTED', input.submittedBy, input.submittedBy,
    `Claim ${doc.claimNumber}: ${input.totalBilled} to ${input.payerName}`);

  emitSyncEvent({
    resourceType: 'claim',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });

  return doc;
}

export async function adjudicateClaim(
  claimId: string,
  approved: number,
  denied: number,
  writeOff: number,
  patientResponsibility: number,
  adjudicatedBy: string,
): Promise<ClaimDoc | null> {
  const db = claimsDB();
  try {
    const claim = await db.get(claimId) as ClaimDoc;
    const now = new Date().toISOString();

    claim.totalApproved = approved;
    claim.totalDenied = denied;
    claim.totalWriteOff = writeOff;
    claim.patientResponsibility = patientResponsibility;
    claim.adjudicatedDate = now;
    claim.status = denied > 0 && approved === 0 ? 'denied' : approved > 0 ? 'paid' : 'partial';
    claim.updatedAt = now;
    void adjudicatedBy;

    const resp = await db.put(claim);
    claim._rev = resp.rev;

    emitSyncEvent({
      resourceType: 'claim',
      resourceId: claim._id,
      operation: 'update',
      resourceVersion: claim._rev,
      orgId: claim.orgId,
      hospitalId: claim.facilityId,
    });

    // Create ledger entries for insurance payment and write-off
    if (approved > 0) {
      await createLedgerEntry({
        patientId: claim.patientId,
        encounterId: claim.encounterId,
        entryType: 'insurance_payment',
        amount: -approved,
        description: `Insurance payment from ${claim.payerName}: ${approved}`,
        referenceId: claim._id,
        referenceType: 'claim',
        facilityId: claim.facilityId,
        orgId: claim.orgId,
      });
    }
    if (writeOff > 0) {
      await createLedgerEntry({
        patientId: claim.patientId,
        encounterId: claim.encounterId,
        entryType: 'write_off',
        amount: -writeOff,
        description: `Contractual write-off: ${writeOff}`,
        referenceId: claim._id,
        referenceType: 'claim',
        facilityId: claim.facilityId,
        orgId: claim.orgId,
      });
    }

    return claim;
  } catch { return null; }
}

export async function getClaimsByPatient(patientId: string): Promise<ClaimDoc[]> {
  const rows = await findByType<ClaimDoc>(claimsDB(), 'claim', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows
    .sort((a, b) => (b.submittedDate || '').localeCompare(a.submittedDate || ''));
}

export async function getAllClaims(scope?: DataScope): Promise<ClaimDoc[]> {
  const db = claimsDB();
  const all = await findByType<ClaimDoc>(db, 'claim');
  all.sort((a, b) => (b.submittedDate || '').localeCompare(a.submittedDate || ''));
  return scope ? filterByScope(all, scope) : all;
}

// ═══════════════════════════════════════════════════════════════════
// ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════════

export async function createAdjustment(input: {
  patientId: string;
  encounterId?: string;
  chargeId?: string;
  claimId?: string;
  adjustmentType: AdjustmentType;
  amount: number;
  reason: string;
  reasonCode?: string;
  approvedBy: string;
  approvedByName: string;
  facilityId: string;
  orgId?: string;
}): Promise<AdjustmentDoc> {
  const db = adjustmentsDB();
  const now = new Date().toISOString();

  const doc: AdjustmentDoc = {
    _id: `adj-${uuidv4().slice(0, 10)}`,
    type: 'adjustment',
    ...input,
    approvedDate: now,
    createdAt: now,
    updatedAt: now,
    createdBy: input.approvedBy,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  // Create ledger entry (negative = credit = balance decreases)
  await createLedgerEntry({
    patientId: input.patientId,
    encounterId: input.encounterId,
    entryType: input.adjustmentType === 'write_off' || input.adjustmentType === 'bad_debt' ? 'write_off' : 'adjustment',
    amount: -input.amount,
    description: `${input.adjustmentType}: ${input.reason}`,
    referenceId: doc._id,
    referenceType: 'adjustment',
    facilityId: input.facilityId,
    orgId: input.orgId,
    createdBy: input.approvedBy,
  });

  await logAuditSafe('ADJUSTMENT_CREATED', input.approvedBy, input.approvedByName,
    `${input.adjustmentType} of ${input.amount}: ${input.reason}`);

  emitSyncEvent({
    resourceType: 'adjustment',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });

  return doc;
}

// ═══════════════════════════════════════════════════════════════════
// REFUNDS
// ═══════════════════════════════════════════════════════════════════

export async function issueRefund(input: {
  paymentId: string;
  patientId: string;
  patientName: string;
  amount: number;
  currency?: string;
  method: PaymentMethodType;
  reason: string;
  processedBy: string;
  processedByName: string;
  facilityId: string;
  orgId?: string;
}): Promise<RefundDoc> {
  const db = refundsDB();
  const now = new Date().toISOString();

  const doc: RefundDoc = {
    _id: `ref-${uuidv4().slice(0, 10)}`,
    type: 'refund',
    ...input,
    currency: input.currency || 'SSP',
    reference: `REF-${uuidv4().slice(0, 8).toUpperCase()}`,
    status: 'processed',
    processedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: input.processedBy,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  // Create ledger entry (positive = debit = balance increases because we gave money back)
  await createLedgerEntry({
    patientId: input.patientId,
    entryType: 'refund',
    amount: input.amount,
    description: `Refund: ${input.reason}`,
    referenceId: doc._id,
    referenceType: 'refund',
    method: input.method,
    currency: doc.currency,
    facilityId: input.facilityId,
    orgId: input.orgId,
    createdBy: input.processedBy,
  });

  await logAuditSafe('REFUND_ISSUED', input.processedBy, input.processedByName,
    `Refund ${input.amount} ${doc.currency} to ${input.patientName}: ${input.reason}`);

  emitSyncEvent({
    resourceType: 'refund',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });

  return doc;
}

export async function getRefundsByPatient(patientId: string): Promise<RefundDoc[]> {
  const rows = await findByType<RefundDoc>(refundsDB(), 'refund', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// PAYMENT PLANS
// ═══════════════════════════════════════════════════════════════════

export async function createPaymentPlan(input: {
  patientId: string;
  patientName: string;
  totalBalance: number;
  termMonths: number;
  apr?: number;
  encounterIds: string[];
  autoPayMethodId?: string;
  createdByStaff: string;
  createdByStaffName: string;
  facilityId: string;
  orgId?: string;
}): Promise<PaymentPlanDoc> {
  const db = paymentPlansDB();
  const now = new Date().toISOString();
  const apr = input.apr || 0;
  const monthlyAmount = Math.ceil((input.totalBalance / input.termMonths) * 100) / 100;

  // Generate installment schedule
  const installments: PlanInstallment[] = [];
  const startDate = new Date();
  for (let i = 0; i < input.termMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i + 1);
    dueDate.setDate(1); // Due on the 1st of each month
    const isLast = i === input.termMonths - 1;
    const amt = isLast
      ? Math.round((input.totalBalance - monthlyAmount * (input.termMonths - 1)) * 100) / 100
      : monthlyAmount;
    installments.push({
      number: i + 1,
      dueDate: dueDate.toISOString().slice(0, 10),
      amount: amt,
      status: 'pending',
    });
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + input.termMonths + 1);

  const doc: PaymentPlanDoc = {
    _id: `plan-${uuidv4().slice(0, 10)}`,
    type: 'payment_plan',
    patientId: input.patientId,
    patientName: input.patientName,
    totalBalance: input.totalBalance,
    termMonths: input.termMonths,
    monthlyAmount,
    apr,
    startDate: now.slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    status: 'active',
    nextDueDate: installments[0]?.dueDate,
    paidToDate: 0,
    remainingBalance: input.totalBalance,
    missedPayments: 0,
    autoPayEnabled: !!input.autoPayMethodId,
    autoPayMethodId: input.autoPayMethodId,
    encounterIds: input.encounterIds,
    installments,
    createdByStaff: input.createdByStaff,
    createdByStaffName: input.createdByStaffName,
    facilityId: input.facilityId,
    orgId: input.orgId,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdByStaff,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  await logAuditSafe('PAYMENT_PLAN_CREATED', input.createdByStaff, input.createdByStaffName,
    `Plan for ${input.patientName}: ${input.totalBalance} over ${input.termMonths} months`);

  emitSyncEvent({
    resourceType: 'payment_plan',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });

  return doc;
}

export async function getPaymentPlansByPatient(patientId: string): Promise<PaymentPlanDoc[]> {
  const rows = await findByType<PaymentPlanDoc>(paymentPlansDB(), 'payment_plan', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getAllPaymentPlans(scope?: DataScope): Promise<PaymentPlanDoc[]> {
  const db = paymentPlansDB();
  const all = await findByType<PaymentPlanDoc>(db, 'payment_plan');
  all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function recordPlanPayment(planId: string, installmentNumber: number, paymentId: string, amount: number): Promise<PaymentPlanDoc | null> {
  const db = paymentPlansDB();
  try {
    const plan = await db.get(planId) as PaymentPlanDoc;
    const installment = plan.installments.find(i => i.number === installmentNumber);
    if (installment) {
      installment.status = amount >= installment.amount ? 'paid' : 'partial';
      installment.paidAmount = amount;
      installment.paidDate = new Date().toISOString().slice(0, 10);
      installment.paymentId = paymentId;
    }

    plan.paidToDate = Math.round((plan.paidToDate + amount) * 100) / 100;
    plan.remainingBalance = Math.round((plan.totalBalance - plan.paidToDate) * 100) / 100;
    plan.lastPaymentDate = new Date().toISOString();

    // Find next pending installment
    const next = plan.installments.find(i => i.status === 'pending');
    plan.nextDueDate = next?.dueDate;

    if (plan.remainingBalance <= 0) {
      plan.status = 'completed';
      plan.remainingBalance = 0;
    }

    plan.updatedAt = new Date().toISOString();
    const resp = await db.put(plan);
    plan._rev = resp.rev;
    emitSyncEvent({
      resourceType: 'payment_plan',
      resourceId: plan._id,
      operation: 'update',
      resourceVersion: plan._rev,
      orgId: plan.orgId,
      hospitalId: plan.facilityId,
    });
    return plan;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════

export async function generateInvoice(input: {
  patientId: string;
  patientName: string;
  encounterId?: string;
  lineItems: InvoiceLineItem[];
  insurancePayments?: number;
  adjustments?: number;
  priorPayments?: number;
  currency?: string;
  dueInDays?: number;
  facilityId: string;
  facilityName: string;
  orgId?: string;
  createdBy?: string;
}): Promise<InvoiceDoc> {
  const db = invoicesDB();
  const now = new Date().toISOString();

  const subtotal = input.lineItems.reduce((s, li) => s + li.patientResponsibility, 0);
  const insurancePayments = input.insurancePayments || 0;
  const adjustments = input.adjustments || 0;
  const priorPayments = input.priorPayments || 0;
  const totalDue = Math.max(0, Math.round((subtotal - insurancePayments - adjustments - priorPayments) * 100) / 100);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (input.dueInDays || 30));

  const allInvoices = await db.allDocs();
  const seq = String(allInvoices.total_rows + 1).padStart(5, '0');

  const doc: InvoiceDoc = {
    _id: `inv-${uuidv4().slice(0, 10)}`,
    type: 'invoice',
    invoiceNumber: `INV-${seq}`,
    patientId: input.patientId,
    patientName: input.patientName,
    encounterId: input.encounterId,
    lineItems: input.lineItems,
    subtotal,
    insurancePayments,
    adjustments,
    priorPayments,
    totalDue,
    currency: input.currency || 'SSP',
    issuedDate: now.slice(0, 10),
    dueDate: dueDate.toISOString().slice(0, 10),
    status: 'draft' as InvoiceStatus,
    paymentLinkToken: uuidv4().slice(0, 16),
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    orgId: input.orgId,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;
  emitSyncEvent({
    resourceType: 'invoice',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });
  return doc;
}

export async function getInvoicesByPatient(patientId: string): Promise<InvoiceDoc[]> {
  const rows = await findByType<InvoiceDoc>(invoicesDB(), 'invoice', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows
    .sort((a, b) => (b.issuedDate || '').localeCompare(a.issuedDate || ''));
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<InvoiceDoc | null> {
  const db = invoicesDB();
  try {
    const doc = await db.get(id) as InvoiceDoc;
    doc.status = status;
    if (status === 'sent') doc.sentAt = new Date().toISOString();
    if (status === 'viewed') doc.viewedAt = new Date().toISOString();
    if (status === 'paid') doc.paidAt = new Date().toISOString();
    doc.updatedAt = new Date().toISOString();
    const resp = await db.put(doc);
    doc._rev = resp.rev;
    emitSyncEvent({
      resourceType: 'invoice',
      resourceId: doc._id,
      operation: 'update',
      resourceVersion: doc._rev,
      orgId: doc.orgId,
      hospitalId: doc.facilityId,
    });
    return doc;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// SAVED PAYMENT METHODS
// ═══════════════════════════════════════════════════════════════════

export async function savePaymentMethod(input: {
  patientId: string;
  methodType: SavedPaymentMethodType;
  phoneNumber?: string;
  cardToken?: string;
  cardLast4?: string;
  cardBrand?: string;
  cardExpiry?: string;
  bankName?: string;
  bankAccountLast4?: string;
  label?: string;
  isDefault?: boolean;
  facilityId: string;
  orgId?: string;
}): Promise<SavedPaymentMethodDoc> {
  const db = savedPaymentMethodsDB();
  const now = new Date().toISOString();

  // Auto-generate label
  let label = input.label;
  if (!label) {
    if (input.phoneNumber) label = `${input.methodType === 'mpesa' ? 'M-Pesa' : input.methodType === 'airtel' ? 'Airtel' : 'MTN'} \u2022\u2022\u2022${input.phoneNumber.slice(-4)}`;
    else if (input.cardLast4) label = `${input.cardBrand || 'Card'} \u2022\u2022\u2022${input.cardLast4}`;
    else if (input.bankAccountLast4) label = `${input.bankName || 'Bank'} \u2022\u2022\u2022${input.bankAccountLast4}`;
    else label = input.methodType;
  }

  const doc: SavedPaymentMethodDoc = {
    _id: `spm-${uuidv4().slice(0, 10)}`,
    type: 'saved_payment_method',
    ...input,
    label,
    isDefault: input.isDefault || false,
    createdAt: now,
    updatedAt: now,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;
  return doc;
}

export async function getPatientPaymentMethods(patientId: string): Promise<SavedPaymentMethodDoc[]> {
  const rows = await findByType<SavedPaymentMethodDoc>(savedPaymentMethodsDB(), 'saved_payment_method', { patientId }, { indexFields: ['type', 'patientId'] });
  return rows;
}

/** Remove a saved payment method (patient-managed convenience record). */
export async function deletePaymentMethod(id: string): Promise<boolean> {
  const db = savedPaymentMethodsDB();
  try {
    const doc = await db.get(id);
    await db.remove(doc);
    await logAuditSafe('DELETE_PAYMENT_METHOD', undefined, undefined, `Saved payment method ${id} removed`);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PATIENT FINANCIAL SUMMARY (Computed)
// ═══════════════════════════════════════════════════════════════════

export async function getPatientFinancialSummary(patientId: string): Promise<PatientFinancialSummary> {
  const [balance, policies, eligibility, payments, plans, methods] = await Promise.all([
    getPatientBalance(patientId),
    getPatientInsurancePolicies(patientId),
    getLatestEligibility(patientId),
    getPaymentsByPatient(patientId),
    getPaymentPlansByPatient(patientId),
    getPatientPaymentMethods(patientId),
  ]);

  const activePlans = plans.filter(p => p.status === 'active');
  const activePlanBalance = activePlans.reduce((s, p) => s + p.remainingBalance, 0);
  const today = jubaDate();
  const invoices = await getInvoicesByPatient(patientId);
  const overdueInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.dueDate < today);
  const overdueBalance = overdueInvoices.reduce((s, i) => s + i.totalDue, 0);

  let collectionStage: PatientFinancialSummary['collectionStage'] = 'current';
  if (overdueBalance > 0) {
    const oldestOverdue = overdueInvoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (oldestOverdue) {
      const daysPastDue = Math.floor((Date.now() - new Date(oldestOverdue.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysPastDue > 120) collectionStage = '120_plus';
      else if (daysPastDue > COLLECTION_STAGE_DAYS.preWriteOff) collectionStage = '90_day';
      else if (daysPastDue > COLLECTION_STAGE_DAYS.warning) collectionStage = '60_day';
      else if (daysPastDue > COLLECTION_STAGE_DAYS.followUp) collectionStage = '30_day';
    }
  }

  const lastPayment = payments[0];
  const nextPlanPayment = activePlans[0];

  return {
    patientId,
    totalBalance: Math.max(0, balance),
    totalInCollections: collectionStage === '120_plus' ? overdueBalance : 0,
    currentBalance: Math.max(0, balance - overdueBalance),
    overdueBalance,
    activePlanBalance,
    insurancePolicies: policies,
    primaryPolicy: policies.find(p => p.isPrimary) || policies[0],
    eligibilityStatus: eligibility?.status || 'none',
    lastPaymentDate: lastPayment?.processedAt,
    lastPaymentAmount: lastPayment?.amount,
    nextPlanPaymentDate: nextPlanPayment?.nextDueDate,
    nextPlanPaymentAmount: nextPlanPayment?.monthlyAmount,
    savedPaymentMethods: methods,
    preferredMethod: methods.find(m => m.isDefault) || methods[0],
    collectionStage,
  };
}
