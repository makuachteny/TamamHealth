/**
 * Billing Service — handles invoice creation, payment recording, and
 * fee schedule management for private-sector facilities.
 *
 * Public facilities (government) are fee-free, but the billing module
 * can still track costs for donor reporting and budget planning.
 */
import { getDB } from '../db';
import type {
  BillingDoc, BillLineItem, PaymentRecord, PaymentMethod,
} from '../db-types-billing';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { nextSequence } from './doc-counter';
import { emitSyncEvent } from './sync-event-service';
import { findByType } from './db-query';

const billingDB = () => getDB('tamamhealth_billing');

// ===== Invoice Number Generation =====

/**
 * Generate a unique invoice number.
 * Format: INV-{YYYYMMDD}-{XXXX}
 */
async function generateInvoiceNumber(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const db = billingDB();
  // Per-day counter rather than `allDocs().total_rows`. The old count fell when
  // a bill was deleted, so the next bill reissued a number already in use — two
  // distinct bills reconciling to one reference. It was also a full scan of the
  // billing database on every invoice. See doc-counter.ts.
  const seq = await nextSequence(db, `invoice_${dateStr}`, () => highestInvoiceSeq(dateStr));
  return `INV-${dateStr}-${String(seq).padStart(4, '0')}`;
}

/**
 * Highest sequence already issued for a date, so a fresh counter starts above
 * any number an existing dataset already used.
 */
async function highestInvoiceSeq(dateStr: string): Promise<number> {
  const prefix = `INV-${dateStr}-`;
  let highest = 0;
  for (const bill of await getAllBills()) {
    const num = (bill as { invoiceNumber?: string }).invoiceNumber;
    if (typeof num !== 'string' || !num.startsWith(prefix)) continue;
    const parsed = Number.parseInt(num.slice(prefix.length), 10);
    if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
  }
  return highest;
}

// ===== Bill Calculations =====

function calculateTotals(items: BillLineItem[], discount: number, taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const afterDiscount = subtotal - discount;
  const taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
  const totalAmount = Math.round((afterDiscount + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, totalAmount };
}

// ===== CRUD Operations =====

export async function getAllBills(scope?: DataScope): Promise<BillingDoc[]> {
  const db = billingDB();
  const all = await findByType<BillingDoc>(db, 'billing');
  /* istanbul ignore next -- defensive null-safety in sort */
  all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function getBillById(id: string): Promise<BillingDoc | null> {
  try {
    const db = billingDB();
    return await db.get(id) as BillingDoc;
  } catch {
    return null;
  }
}

export async function getBillsByPatient(patientId: string): Promise<BillingDoc[]> {
  return findByType<BillingDoc>(billingDB(), 'billing', { patientId }, { indexFields: ['type', 'patientId'] });
}

export async function getUnpaidBills(scope?: DataScope): Promise<BillingDoc[]> {
  const all = await getAllBills(scope);
  return all.filter(b => b.status === 'pending' || b.status === 'partial');
}

export interface CreateBillInput {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  facilityId: string;
  facilityName: string;
  facilityLevel: string;
  encounterDate: string;
  encounterId?: string;
  appointmentId?: string;
  items: BillLineItem[];
  discount?: number;
  discountReason?: string;
  taxRate?: number;
  currency?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceCoveragePercent?: number;
  generatedBy: string;
  generatedByName: string;
  state: string;
  county?: string;
  orgId?: string;
  notes?: string;
}

export async function createBill(data: CreateBillInput): Promise<BillingDoc> {
  const db = billingDB();
  const now = new Date().toISOString();

  // Ensure each line item has an ID and correct total
  /* istanbul ignore next -- defensive: data.items always provided by UI callers */
  const items: BillLineItem[] = (data.items || []).map(item => ({
    ...item,
    /* istanbul ignore next -- defensive: items may arrive without id from legacy clients */
    id: item.id || uuidv4().slice(0, 8),
    totalPrice: item.quantity * item.unitPrice,
  }));

  const discount = data.discount || 0;
  const taxRate = data.taxRate || 0;
  const { subtotal, taxAmount, totalAmount } = calculateTotals(items, discount, taxRate);

  // Calculate insurance portion
  let amountPaid = 0;
  if (data.insuranceCoveragePercent && data.insuranceCoveragePercent > 0) {
    amountPaid = Math.round(totalAmount * (data.insuranceCoveragePercent / 100) * 100) / 100;
  }

  const invoiceNumber = await generateInvoiceNumber();

  const doc: BillingDoc = {
    _id: `bill-${uuidv4().slice(0, 8)}`,
    type: 'billing',
    patientId: data.patientId,
    patientName: data.patientName,
    hospitalNumber: data.hospitalNumber,
    facilityId: data.facilityId,
    facilityName: data.facilityName,
    facilityLevel: data.facilityLevel as BillingDoc['facilityLevel'],
    encounterDate: data.encounterDate,
    encounterId: data.encounterId,
    appointmentId: data.appointmentId,
    items,
    subtotal,
    discount,
    discountReason: data.discountReason,
    taxRate,
    taxAmount,
    totalAmount,
    amountPaid,
    balanceDue: Math.round((totalAmount - amountPaid) * 100) / 100,
    currency: data.currency || 'SSP',
    payments: [],
    insuranceProvider: data.insuranceProvider,
    insurancePolicyNumber: data.insurancePolicyNumber,
    insuranceCoveragePercent: data.insuranceCoveragePercent,
    insuranceClaimStatus: data.insuranceProvider ? 'submitted' : 'none',
    status: amountPaid >= totalAmount ? 'paid' : 'pending',
    generatedBy: data.generatedBy,
    generatedByName: data.generatedByName,
    invoiceNumber,
    state: data.state,
    county: data.county,
    orgId: data.orgId,
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  // Mirror the bill into the append-only ledger so patient balances, the
  // front-desk checkout gate, and Collect-Payment — all of which read the
  // ledger, not the billing store — reflect this charge. We post the gross as
  // a `charge` debit and, when insurance covers part of it, an
  // `insurance_payment` credit, so the patient's running balance nets to their
  // own responsibility (balanceDue). Best-effort: a ledger write must never
  // abort bill creation.
  try {
    const { createLedgerEntry } = await import('./ledger-service');
    await createLedgerEntry({
      patientId: doc.patientId,
      encounterId: doc.encounterId,
      entryType: 'charge',
      amount: doc.totalAmount,
      description: `Invoice ${invoiceNumber}`,
      referenceId: doc._id,
      referenceType: 'billing',
      currency: doc.currency,
      facilityId: doc.facilityId,
      orgId: doc.orgId,
      createdBy: doc.generatedBy,
    });
    if (doc.amountPaid > 0) {
      await createLedgerEntry({
        patientId: doc.patientId,
        encounterId: doc.encounterId,
        entryType: 'insurance_payment',
        amount: -doc.amountPaid,
        description: `Insurance coverage — ${invoiceNumber}`,
        referenceId: doc._id,
        referenceType: 'billing',
        currency: doc.currency,
        facilityId: doc.facilityId,
        orgId: doc.orgId,
        createdBy: doc.generatedBy,
      });
    }
  } catch (err) {
    console.warn('[billing] ledger mirror failed for', doc._id, err);
  }

  await logAuditSafe(
    'BILL_CREATED', data.generatedBy, data.generatedByName,
    `Invoice ${invoiceNumber}: ${data.patientName} total=${totalAmount} ${doc.currency}`
  );

  emitSyncEvent({
    resourceType: 'billing',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });

  return doc;
}

/**
 * Apply a payment to a bill in memory (payments[], amountPaid, balanceDue,
 * status) — the math shared by `recordPayment` (single bill, posts its own
 * ledger entry) and `settleOpenBillsWithPayment` (a patient-level payment
 * spread across several bills, ledger entry posted once by the caller).
 * Does not persist or touch the ledger; callers do both.
 */
function applyPaymentToBill(
  bill: BillingDoc,
  amount: number,
  method: PaymentMethod,
  receivedBy: string,
  receivedByName: string,
  now: string,
  reference?: string,
  notes?: string,
): PaymentRecord {
  const payment: PaymentRecord = {
    id: uuidv4().slice(0, 8),
    amount,
    method,
    reference,
    receivedBy,
    receivedByName,
    receivedAt: now,
    notes,
  };

  bill.payments.push(payment);
  bill.amountPaid = Math.round((bill.amountPaid + amount) * 100) / 100;
  bill.balanceDue = Math.round((bill.totalAmount - bill.amountPaid) * 100) / 100;

  // Update status
  /* istanbul ignore next -- payment status: all paths tested but istanbul counts extra branches */
  if (bill.balanceDue <= 0) {
    bill.status = 'paid';
    bill.balanceDue = 0;
  } else if (bill.amountPaid > 0) {
    bill.status = 'partial';
  }

  bill.updatedAt = now;
  return payment;
}

export async function recordPayment(
  billId: string,
  amount: number,
  method: PaymentMethod,
  receivedBy: string,
  receivedByName: string,
  reference?: string,
  notes?: string,
): Promise<BillingDoc | null> {
  const db = billingDB();
  try {
    const bill = await db.get(billId) as BillingDoc;
    const now = new Date().toISOString();

    const payment = applyPaymentToBill(bill, amount, method, receivedBy, receivedByName, now, reference, notes);

    const resp = await db.put(bill);
    bill._rev = resp.rev;

    // Credit the ledger so the patient balance drops to match the bill.
    // Best-effort — the bill payment is already persisted above.
    try {
      const { createLedgerEntry } = await import('./ledger-service');
      await createLedgerEntry({
        patientId: bill.patientId,
        encounterId: bill.encounterId,
        entryType: 'payment',
        amount: -amount,
        description: `Payment — ${bill.invoiceNumber}`,
        referenceId: bill._id,
        referenceType: 'billing',
        currency: bill.currency,
        facilityId: bill.facilityId,
        orgId: bill.orgId,
        createdBy: receivedBy,
      });
    } catch (err) {
      console.warn('[billing] ledger payment mirror failed for', bill._id, err);
    }

    await logAuditSafe(
      'PAYMENT_RECORDED', receivedBy, receivedByName,
      `Payment ${payment.id}: ${amount} ${bill.currency} via ${method} for ${bill.invoiceNumber}`
    );

    emitSyncEvent({
      resourceType: 'billing',
      resourceId: bill._id,
      operation: 'update',
      resourceVersion: bill._rev,
      orgId: bill.orgId,
      hospitalId: bill.facilityId,
    });

    return bill;
  } catch {
    return null;
  }
}

/**
 * Settle a patient-level payment (e.g. from PaymentPanel's `collectPayment`,
 * which collects against the patient's aggregate ledger balance rather than
 * one specific bill) against that patient's open bills, oldest first.
 *
 * Without this, a payment collected through the ledger never touches the
 * BillingDoc(s) it was actually paying down: the ledger balance reads paid
 * while the bill stays 'pending'/'partial' forever, and the two permanently
 * disagree. Partial payments settle proportionally (a bill only moves to
 * 'paid' once its own balance is fully covered; otherwise it becomes/stays
 * 'partial') exactly like `recordPayment`, just spread across bills instead
 * of applied to one.
 *
 * Deliberately does NOT post a ledger entry — the caller already posted one
 * for the full payment amount, and a second one here would double-credit the
 * patient's balance for the same real-world payment. Only bills whose
 * currency matches the payment are touched, so a payment in one currency
 * can't be applied to a bill denominated in another.
 *
 * Best-effort by callers, same as the ledger mirrors elsewhere in this file:
 * bills are already-persisted records of what was billed, so a failure here
 * must not unwind a payment that already succeeded.
 */
export async function settleOpenBillsWithPayment(
  patientId: string,
  amount: number,
  currency: string,
  method: PaymentMethod,
  receivedBy: string,
  receivedByName: string,
  reference?: string,
  notes?: string,
): Promise<{ settledBills: BillingDoc[]; unapplied: number }> {
  if (!(amount > 0)) return { settledBills: [], unapplied: amount };

  const db = billingDB();
  const openBills = (await getBillsByPatient(patientId))
    .filter(b => (b.status === 'pending' || b.status === 'partial') && b.currency === currency)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  let remaining = Math.round(amount * 100) / 100;
  const settledBills: BillingDoc[] = [];
  const now = new Date().toISOString();

  for (const bill of openBills) {
    if (remaining <= 0) break;
    const portion = Math.round(Math.min(remaining, bill.balanceDue) * 100) / 100;
    if (portion <= 0) continue;

    applyPaymentToBill(bill, portion, method, receivedBy, receivedByName, now, reference, notes);
    const resp = await db.put(bill);
    bill._rev = resp.rev;
    settledBills.push(bill);
    remaining = Math.round((remaining - portion) * 100) / 100;

    await logAuditSafe(
      'PAYMENT_RECORDED', receivedBy, receivedByName,
      `Payment ${portion} ${bill.currency} applied to ${bill.invoiceNumber} from a patient-balance payment`
    );

    emitSyncEvent({
      resourceType: 'billing',
      resourceId: bill._id,
      operation: 'update',
      resourceVersion: bill._rev,
      orgId: bill.orgId,
      hospitalId: bill.facilityId,
    });
  }

  return { settledBills, unapplied: Math.max(0, remaining) };
}

/**
 * Finalize a bill so payments can be recorded against it. Until then the bill
 * stays editable (items, discount) and deletable.
 */
export async function finalizeBill(
  billId: string,
  finalizedBy: string,
  finalizedByName: string,
): Promise<BillingDoc | null> {
  const db = billingDB();
  try {
    const bill = await db.get(billId) as BillingDoc;
    if (bill.finalizedAt || bill.status === 'cancelled' || bill.status === 'waived') return null;
    const now = new Date().toISOString();
    bill.finalizedAt = now;
    bill.finalizedBy = finalizedBy;
    bill.finalizedByName = finalizedByName;
    bill.updatedAt = now;
    const resp = await db.put(bill);
    bill._rev = resp.rev;

    await logAuditSafe(
      'BILL_FINALIZED', finalizedBy, finalizedByName,
      `Finalized ${bill.invoiceNumber}: ${bill.totalAmount} ${bill.currency} for ${bill.patientName}`
    );

    emitSyncEvent({
      resourceType: 'billing',
      resourceId: bill._id,
      operation: 'update',
      resourceVersion: bill._rev,
      orgId: bill.orgId,
      hospitalId: bill.facilityId,
    });

    return bill;
  } catch {
    return null;
  }
}

/**
 * Replace a bill's line items and recompute totals. Only allowed before
 * finalization and before any payment has been recorded. The ledger charge is
 * corrected with an adjustment entry for the delta.
 */
export async function updateBillItems(
  billId: string,
  items: BillLineItem[],
  updatedBy: string,
  updatedByName: string,
): Promise<BillingDoc | null> {
  const db = billingDB();
  try {
    const bill = await db.get(billId) as BillingDoc;
    if (bill.finalizedAt || bill.payments.length > 0 || bill.status !== 'pending') return null;
    if (!items.length) return null;

    const oldTotal = bill.totalAmount;
    const normalized: BillLineItem[] = items.map(item => ({
      ...item,
      id: item.id || uuidv4().slice(0, 8),
      totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));
    const { subtotal, taxAmount, totalAmount } = calculateTotals(normalized, bill.discount, bill.taxRate);

    bill.items = normalized;
    bill.subtotal = subtotal;
    bill.taxAmount = taxAmount;
    bill.totalAmount = totalAmount;
    // Insurance-covered portion tracks the new total when coverage applies.
    if (bill.insuranceCoveragePercent && bill.insuranceCoveragePercent > 0) {
      bill.amountPaid = Math.round(totalAmount * (bill.insuranceCoveragePercent / 100) * 100) / 100;
    }
    bill.balanceDue = Math.round((totalAmount - bill.amountPaid) * 100) / 100;
    bill.updatedAt = new Date().toISOString();
    const resp = await db.put(bill);
    bill._rev = resp.rev;

    await postLedgerAdjustment(bill, totalAmount - oldTotal, `Bill items updated — ${bill.invoiceNumber}`, updatedBy);

    await logAuditSafe(
      'BILL_UPDATED', updatedBy, updatedByName,
      `Updated items on ${bill.invoiceNumber}: total ${oldTotal} → ${totalAmount} ${bill.currency}`
    );

    emitSyncEvent({
      resourceType: 'billing',
      resourceId: bill._id,
      operation: 'update',
      resourceVersion: bill._rev,
      orgId: bill.orgId,
      hospitalId: bill.facilityId,
    });

    return bill;
  } catch {
    return null;
  }
}

/**
 * Apply (or change) a discount on an open bill and recompute totals.
 */
export async function applyDiscount(
  billId: string,
  discount: number,
  reason: string,
  appliedBy: string,
  appliedByName: string,
): Promise<BillingDoc | null> {
  const db = billingDB();
  try {
    const bill = await db.get(billId) as BillingDoc;
    if (bill.status !== 'pending' && bill.status !== 'partial') return null;
    if (!Number.isFinite(discount) || discount < 0 || discount > bill.subtotal) return null;

    const oldTotal = bill.totalAmount;
    const { subtotal, taxAmount, totalAmount } = calculateTotals(bill.items, discount, bill.taxRate);

    bill.discount = discount;
    bill.discountReason = reason;
    bill.subtotal = subtotal;
    bill.taxAmount = taxAmount;
    bill.totalAmount = totalAmount;
    bill.balanceDue = Math.round((totalAmount - bill.amountPaid) * 100) / 100;
    if (bill.balanceDue <= 0 && bill.amountPaid > 0) {
      bill.status = 'paid';
      bill.balanceDue = 0;
    }
    bill.updatedAt = new Date().toISOString();
    const resp = await db.put(bill);
    bill._rev = resp.rev;

    await postLedgerAdjustment(bill, totalAmount - oldTotal, `Discount — ${bill.invoiceNumber}: ${reason}`, appliedBy);

    await logAuditSafe(
      'BILL_DISCOUNTED', appliedBy, appliedByName,
      `Discount ${discount} ${bill.currency} on ${bill.invoiceNumber} — ${reason}`
    );

    emitSyncEvent({
      resourceType: 'billing',
      resourceId: bill._id,
      operation: 'update',
      resourceVersion: bill._rev,
      orgId: bill.orgId,
      hospitalId: bill.facilityId,
    });

    return bill;
  } catch {
    return null;
  }
}

/**
 * Cancel (delete) a bill. Only allowed while no payment has been recorded;
 * the original ledger charge is reversed so the patient balance nets to zero.
 * The document is kept (status: cancelled) for the audit trail and to protect
 * invoice-number integrity.
 */
export async function cancelBill(
  billId: string,
  cancelledBy: string,
  cancelledByName: string,
  reason?: string,
): Promise<BillingDoc | null> {
  const db = billingDB();
  try {
    const bill = await db.get(billId) as BillingDoc;
    if (bill.payments.length > 0 || bill.status === 'paid' || bill.status === 'cancelled') return null;

    bill.status = 'cancelled';
    bill.balanceDue = 0;
    if (reason) bill.notes = bill.notes ? `${bill.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
    bill.updatedAt = new Date().toISOString();
    const resp = await db.put(bill);
    bill._rev = resp.rev;

    await postLedgerAdjustment(bill, -(bill.totalAmount - bill.amountPaid), `Bill cancelled — ${bill.invoiceNumber}`, cancelledBy);

    await logAuditSafe(
      'BILL_CANCELLED', cancelledBy, cancelledByName,
      `Cancelled ${bill.invoiceNumber}: ${bill.totalAmount} ${bill.currency}${reason ? ` — ${reason}` : ''}`
    );

    emitSyncEvent({
      resourceType: 'billing',
      resourceId: bill._id,
      operation: 'update',
      resourceVersion: bill._rev,
      orgId: bill.orgId,
      hospitalId: bill.facilityId,
    });

    return bill;
  } catch {
    return null;
  }
}

/**
 * Post a ledger adjustment mirroring a change to a bill's total, so patient
 * balances (which read the ledger, not the billing store) stay in sync.
 * Best-effort, same as the mirrors in createBill/recordPayment.
 */
async function postLedgerAdjustment(bill: BillingDoc, amount: number, description: string, createdBy: string) {
  if (!amount) return;
  try {
    const { createLedgerEntry } = await import('./ledger-service');
    await createLedgerEntry({
      patientId: bill.patientId,
      encounterId: bill.encounterId,
      entryType: 'adjustment',
      amount: Math.round(amount * 100) / 100,
      description,
      referenceId: bill._id,
      referenceType: 'billing',
      currency: bill.currency,
      facilityId: bill.facilityId,
      orgId: bill.orgId,
      createdBy,
    });
  } catch (err) {
    console.warn('[billing] ledger adjustment mirror failed for', bill._id, err);
  }
}

export async function waiveBill(
  billId: string,
  waivedBy: string,
  waivedByName: string,
  reason: string,
): Promise<BillingDoc | null> {
  const db = billingDB();
  try {
    const bill = await db.get(billId) as BillingDoc;
    bill.status = 'waived';
    bill.discountReason = reason;
    bill.balanceDue = 0;
    bill.updatedAt = new Date().toISOString();
    const resp = await db.put(bill);
    bill._rev = resp.rev;

    await logAuditSafe(
      'BILL_WAIVED', waivedBy, waivedByName,
      `Waived ${bill.invoiceNumber}: ${bill.totalAmount} ${bill.currency} — ${reason}`
    );

    emitSyncEvent({
      resourceType: 'billing',
      resourceId: bill._id,
      operation: 'update',
      resourceVersion: bill._rev,
      orgId: bill.orgId,
      hospitalId: bill.facilityId,
    });

    return bill;
  } catch {
    return null;
  }
}

/**
 * Get billing summary statistics for a facility or organization.
 */
export async function getBillingSummary(scope?: DataScope): Promise<{
  totalRevenue: number;
  totalOutstanding: number;
  totalWaived: number;
  billCount: number;
  paidCount: number;
  pendingCount: number;
  currency: string;
}> {
  const bills = await getAllBills(scope);
  const currency = bills[0]?.currency || 'SSP';

  return {
    totalRevenue: bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.totalAmount, 0),
    totalOutstanding: bills.filter(b => b.status === 'pending' || b.status === 'partial').reduce((s, b) => s + b.balanceDue, 0),
    totalWaived: bills.filter(b => b.status === 'waived').reduce((s, b) => s + b.totalAmount, 0),
    billCount: bills.length,
    paidCount: bills.filter(b => b.status === 'paid').length,
    pendingCount: bills.filter(b => b.status === 'pending' || b.status === 'partial').length,
    currency,
  };
}
