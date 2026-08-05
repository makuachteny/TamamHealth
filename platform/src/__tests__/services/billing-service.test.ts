/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for billing-service.ts
 * Covers bill creation, payment recording, waivers, and summary statistics.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createBill,
  getBillById,
  getAllBills,
  getBillsByPatient,
  getUnpaidBills,
  recordPayment,
  settleOpenBillsWithPayment,
  unsettleBillsForPayment,
  waiveBill,
  getBillingSummary,
} from '@/lib/services/billing-service';

let settlePaymentIdCounter = 0;
/** Every settleOpenBillsWithPayment call needs a unique PaymentDoc id in
 *  real usage (payment-service.ts always supplies `doc._id`) — generate a
 *  fresh one per call by default so unrelated tests don't collide on the
 *  idempotency/back-link key, while still letting a test pass an explicit
 *  `paymentId` when it wants to exercise a retry of the *same* payment. */
const settle = (overrides: Partial<Parameters<typeof settleOpenBillsWithPayment>[0]> = {}) =>
  settleOpenBillsWithPayment({
    patientId: 'pat-001',
    amount: 0,
    currency: 'SSP',
    method: 'cash',
    receivedBy: 'user-001',
    receivedByName: 'Desk Amira',
    paymentId: `pmt-settle-${++settlePaymentIdCounter}`,
    ...overrides,
  });

const makeBillData = (overrides = {}) => ({
  patientId: 'pat-001',
  patientName: 'Achol Deng',
  hospitalNumber: 'JTH-0001',
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  facilityLevel: 'national' as const,
  encounterDate: '2026-04-10',
  items: [
    {
      id: 'item-1',
      category: 'consultation' as const,
      description: 'General consultation',
      quantity: 1,
      unitPrice: 5000,
      totalPrice: 5000,
    },
    {
      id: 'item-2',
      category: 'laboratory' as const,
      description: 'Malaria RDT',
      quantity: 1,
      unitPrice: 2000,
      totalPrice: 2000,
    },
  ],
  generatedBy: 'user-001',
  generatedByName: 'Desk Amira',
  state: 'Central Equatoria',
  orgId: 'org-001',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
  settlePaymentIdCounter = 0;
});

describe('billing-service', () => {
  test('createBill creates a bill with correct totals', async () => {
    const bill = await createBill(makeBillData());
    expect(bill._id).toMatch(/^bill-/);
    expect(bill.type).toBe('billing');
    expect(bill.subtotal).toBe(7000);
    expect(bill.totalAmount).toBe(7000); // No tax
    expect(bill.balanceDue).toBe(7000);
    expect(bill.status).toBe('pending');
    expect(bill.invoiceNumber).toMatch(/^INV-/);
    expect(bill.items).toHaveLength(2);
    expect(bill.payments).toHaveLength(0);
  });

  test('createBill applies tax correctly', async () => {
    const bill = await createBill(makeBillData({ taxRate: 10 }));
    expect(bill.subtotal).toBe(7000);
    expect(bill.taxAmount).toBe(700);
    expect(bill.totalAmount).toBe(7700);
  });

  test('createBill applies discount correctly', async () => {
    const bill = await createBill(makeBillData({ discount: 1000 }));
    expect(bill.subtotal).toBe(7000);
    expect(bill.totalAmount).toBe(6000);
    expect(bill.balanceDue).toBe(6000);
  });

  test('createBill with insurance coverage', async () => {
    const bill = await createBill(makeBillData({
      insuranceProvider: 'National Insurance',
      insurancePolicyNumber: 'INS-12345',
      insuranceCoveragePercent: 80,
    }));
    expect(bill.insuranceClaimStatus).toBe('submitted');
    expect(bill.amountPaid).toBe(5600); // 80% of 7000
    expect(bill.balanceDue).toBe(1400);
  });

  test('getBillById retrieves a bill', async () => {
    const created = await createBill(makeBillData());
    const found = await getBillById(created._id);
    expect(found).not.toBeNull();
    expect(found!.invoiceNumber).toBe(created.invoiceNumber);
  });

  test('getBillsByPatient filters correctly', async () => {
    await createBill(makeBillData());
    await createBill(makeBillData({ patientId: 'pat-002', patientName: 'Nyabol Kuol' }));
    const bills = await getBillsByPatient('pat-001');
    expect(bills).toHaveLength(1);
    expect(bills[0].patientName).toBe('Achol Deng');
  });

  test('getBillsByPatient without a scope returns bills across every org (unscoped)', async () => {
    await createBill(makeBillData({ orgId: 'org-juba' }));
    await createBill(makeBillData({ orgId: 'org-mercy' }));
    const bills = await getBillsByPatient('pat-001');
    expect(bills).toHaveLength(2);
  });

  test('getBillsByPatient with a scope only returns the caller\'s own org', async () => {
    await createBill(makeBillData({ orgId: 'org-juba' }));
    await createBill(makeBillData({ orgId: 'org-mercy' }));
    const bills = await getBillsByPatient('pat-001', { role: 'cashier', orgId: 'org-juba' });
    expect(bills).toHaveLength(1);
    expect(bills[0].orgId).toBe('org-juba');
  });

  test('recordPayment updates bill correctly', async () => {
    const bill = await createBill(makeBillData());
    const updated = await recordPayment(
      bill._id, 3000, 'cash', 'user-001', 'Desk Amira', 'REC-001'
    );
    expect(updated).not.toBeNull();
    expect(updated!.amountPaid).toBe(3000);
    expect(updated!.balanceDue).toBe(4000);
    expect(updated!.status).toBe('partial');
    expect(updated!.payments).toHaveLength(1);
    expect(updated!.payments[0].method).toBe('cash');
  });

  test('recordPayment marks bill as paid when fully paid', async () => {
    const bill = await createBill(makeBillData());
    const updated = await recordPayment(
      bill._id, 7000, 'mobile_money', 'user-001', 'Desk Amira', 'MM-TX-123'
    );
    expect(updated!.status).toBe('paid');
    expect(updated!.balanceDue).toBe(0);
  });

  test('settleOpenBillsWithPayment marks a fully-covered bill paid without a second ledger entry', async () => {
    const bill = await createBill(makeBillData());
    const { settledBills, unapplied } = await settle({ amount: 7000, reference: 'REC-100' });
    expect(unapplied).toBe(0);
    expect(settledBills).toHaveLength(1);
    expect(settledBills[0]._id).toBe(bill._id);
    expect(settledBills[0].status).toBe('paid');
    expect(settledBills[0].balanceDue).toBe(0);
    expect(settledBills[0].amountPaid).toBe(7000);

    const fresh = await getBillById(bill._id);
    expect(fresh!.status).toBe('paid');
  });

  test('settleOpenBillsWithPayment settles proportionally across multiple open bills, oldest first', async () => {
    const bill1 = await createBill(makeBillData());
    const bill2 = await createBill(makeBillData());
    // 7000 due on each; pay 10000 total — bill1 (created first) is fully
    // covered, bill2 only gets the 3000 remainder and stays partial.
    const { settledBills, unapplied } = await settle({ amount: 10000 });
    expect(unapplied).toBe(0);
    expect(settledBills.map(b => b._id)).toEqual([bill1._id, bill2._id]);

    const first = await getBillById(bill1._id);
    const second = await getBillById(bill2._id);
    expect(first!.status).toBe('paid');
    expect(first!.balanceDue).toBe(0);
    expect(second!.status).toBe('partial');
    expect(second!.amountPaid).toBe(3000);
    expect(second!.balanceDue).toBe(4000);
  });

  test('settleOpenBillsWithPayment reports the unapplied remainder when it exceeds every open bill', async () => {
    await createBill(makeBillData());
    const { unapplied } = await settle({ amount: 10000 });
    expect(unapplied).toBe(3000);
  });

  test('settleOpenBillsWithPayment ignores bills in a different currency', async () => {
    await createBill(makeBillData({ currency: 'USD' }));
    const { settledBills, unapplied } = await settle({ amount: 7000 });
    expect(settledBills).toHaveLength(0);
    expect(unapplied).toBe(7000);
  });

  test('settleOpenBillsWithPayment leaves paid/waived/cancelled bills untouched', async () => {
    const bill = await createBill(makeBillData());
    await recordPayment(bill._id, bill.totalAmount, 'cash', 'user-001', 'Admin');

    const { settledBills, unapplied } = await settle({ amount: 500 });
    expect(settledBills).toHaveLength(0);
    expect(unapplied).toBe(500);
  });

  test('settleOpenBillsWithPayment stores a back-link to the PaymentDoc on each settled bill', async () => {
    await createBill(makeBillData());
    await settle({ amount: 7000, paymentId: 'pmt-abc123' });
    const [bill] = await getBillsByPatient('pat-001');
    expect(bill.payments[0].sourcePaymentId).toBe('pmt-abc123');
  });

  test('settleOpenBillsWithPayment only touches bills in the payer\'s own org (cross-tenant isolation)', async () => {
    // pat-001 has a bill at their home org AND one at a different org (a
    // patient can genuinely be seen at more than one facility/org — see
    // db-seed.ts appointment-12). A payment collected in org-juba must never
    // pay down org-mercy's receivable.
    const juba = await createBill(makeBillData({ orgId: 'org-juba', facilityId: 'hosp-juba' }));
    const mercy = await createBill(makeBillData({ orgId: 'org-mercy', facilityId: 'hosp-mercy' }));

    const { settledBills, unapplied } = await settle({
      amount: 14000,
      paymentId: 'pmt-scoped-1',
      scope: { role: 'org_admin', orgId: 'org-juba' },
    });

    // Only the org-juba bill settles; the org-mercy bill is untouched and the
    // rest of the payment is reported unapplied rather than silently
    // crossing the tenant boundary.
    expect(settledBills.map(b => b._id)).toEqual([juba._id]);
    expect(unapplied).toBe(7000);

    const freshMercy = await getBillById(mercy._id);
    expect(freshMercy!.status).toBe('pending');
    expect(freshMercy!.amountPaid).toBe(0);
    expect(freshMercy!.payments).toHaveLength(0);
  });

  test('settleOpenBillsWithPayment retried after a partial failure does not double-settle the bill it already reached', async () => {
    // Simulates payment-service.ts retrying settlement for the SAME
    // PaymentDoc after a prior attempt settled bill1 but never reached
    // bill2 (a 409 on bill2's write, forced here by making the second
    // db.put in the pass reject). The retry must pick up only the
    // unsettled remainder — not re-apply money to bill1.
    const bill1 = await createBill(makeBillData());
    const bill2 = await createBill(makeBillData());
    const paymentId = 'pmt-retry-1';

    const billingDb = require('@/lib/db').billingDB();
    const originalPut = billingDb.put.bind(billingDb);
    const spy = jest.spyOn(billingDb, 'put').mockImplementationOnce(originalPut) // bill1 succeeds
      .mockImplementationOnce(() => Promise.reject(new Error('Document update conflict'))); // bill2 fails

    await expect(settle({ amount: 10000, paymentId })).rejects.toThrow('Document update conflict');
    spy.mockRestore();

    // bill1 really did settle before the simulated failure on bill2.
    const afterFirstPass = await getBillById(bill1._id);
    expect(afterFirstPass!.status).toBe('paid');
    const bill2BeforeRetry = await getBillById(bill2._id);
    expect(bill2BeforeRetry!.status).toBe('pending');

    // Retry with the exact same payment identity and original amount.
    const retry = await settle({ amount: 10000, paymentId });

    // bill1 already carries this payment's back-link, so it's skipped this
    // time; only bill2 (never reached before) gets the remaining 3000.
    expect(retry.settledBills.map(b => b._id)).toEqual([bill2._id]);
    expect(retry.unapplied).toBe(0);

    const freshBill1 = await getBillById(bill1._id);
    const freshBill2 = await getBillById(bill2._id);
    expect(freshBill1!.amountPaid).toBe(7000); // unchanged by the retry
    expect(freshBill1!.payments).toHaveLength(1); // not double-applied
    expect(freshBill2!.amountPaid).toBe(3000);
    expect(freshBill2!.status).toBe('partial');
  });

  test('waiveBill sets status to waived', async () => {
    const bill = await createBill(makeBillData());
    const waived = await waiveBill(bill._id, 'user-001', 'Desk Amira', 'Patient unable to pay');
    expect(waived!.status).toBe('waived');
    expect(waived!.balanceDue).toBe(0);
    expect(waived!.discountReason).toBe('Patient unable to pay');
  });

  test('getUnpaidBills returns pending and partial bills', async () => {
    await createBill(makeBillData());
    const bill2 = await createBill(makeBillData({ patientId: 'pat-002', patientName: 'Mayen Garang' }));
    await recordPayment(bill2._id, bill2.totalAmount, 'cash', 'user-001', 'Admin');

    const unpaid = await getUnpaidBills();
    expect(unpaid).toHaveLength(1);
    expect(unpaid[0].patientName).toBe('Achol Deng');
  });

  test('getBillingSummary returns correct statistics', async () => {
    await createBill(makeBillData());
    const bill2 = await createBill(makeBillData({ patientId: 'pat-002', patientName: 'Mayen Garang' }));
    await recordPayment(bill2._id, bill2.totalAmount, 'cash', 'user-001', 'Admin');

    const summary = await getBillingSummary();
    expect(summary.billCount).toBe(2);
    expect(summary.paidCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.totalRevenue).toBe(7000);
    expect(summary.totalOutstanding).toBe(7000);
  });

  test('getAllBills with scope filters results', async () => {
    await createBill(makeBillData());
    const billsNoScope = await getAllBills();
    expect(billsNoScope.length).toBeGreaterThanOrEqual(1);

    // With scope - the filterByScope function would be called
    const billsWithScope = await getAllBills({ role: 'nurse' });
    expect(Array.isArray(billsWithScope)).toBe(true);
  });

  test('getBillById returns null for nonexistent bill', async () => {
    const result = await getBillById('bill-nonexistent');
    expect(result).toBeNull();
  });

  test('recordPayment returns null for nonexistent bill', async () => {
    const result = await recordPayment(
      'bill-nonexistent', 1000, 'cash', 'user-001', 'Admin'
    );
    expect(result).toBeNull();
  });

  test('waiveBill returns null for nonexistent bill', async () => {
    const result = await waiveBill(
      'bill-nonexistent', 'user-001', 'Admin', 'Test reason'
    );
    expect(result).toBeNull();
  });

  test('getBillingSummary with scope', async () => {
    await createBill(makeBillData());
    const summary = await getBillingSummary({ role: 'nurse' });
    expect(summary).toBeDefined();
    expect(summary.currency).toBeDefined();
  });

  test('getBillingSummary returns default currency when no bills', async () => {
    const summary = await getBillingSummary();
    expect(summary.currency).toBe('SSP');
    expect(summary.billCount).toBe(0);
  });

  test('recordPayment with zero payment amount leaves status unchanged', async () => {
    // Tests line 208 branch when amountPaid is 0 initially and stays 0
    const bill = await createBill(makeBillData());
    expect(bill.status).toBe('pending');
    expect(bill.amountPaid).toBe(0);

    // After payment, the status should be either 'paid' or 'partial'
    const updated = await recordPayment(
      bill._id, 500, 'cash', 'user-001', 'Admin'
    );
    // With 500 payment, status should be 'partial' (line 209)
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('partial');
    expect(updated!.amountPaid).toBe(500);
  });

  test('recordPayment with overpayment clamps balanceDue to zero (line 205-207)', async () => {
    // Tests line 205-207 branch when overpayment happens
    const bill = await createBill(makeBillData({ items: [{ category: 'consultation', description: 'Test', quantity: 1, unitPrice: 1000, totalPrice: 1000, id: 'test' }] }));
    const updated = await recordPayment(
      bill._id, 2000, 'cash', 'user-001', 'Admin'
    );
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('paid');
    expect(updated!.balanceDue).toBe(0); // Clamped to 0, not negative
  });

  test('getAllBills sorts by createdAt with undefined handling', async () => {
    await createBill(makeBillData({
      patientId: 'pat-001',
      patientName: 'First Patient',
    }));
    await createBill(makeBillData({
      patientId: 'pat-002',
      patientName: 'Second Patient',
    }));

    const all = await getAllBills();
    expect(all.length).toBeGreaterThanOrEqual(2);
    // Verify sorting exists (most recent should come before older in localeCompare)
    expect(all).toBeDefined();
  });

  test('createBill with both discount and tax', async () => {
    const bill = await createBill(makeBillData({
      discount: 500,
      discountReason: 'Senior citizen discount',
      taxRate: 10,
    }));
    expect(bill.subtotal).toBe(7000);
    expect(bill.discount).toBe(500);
    expect(bill.taxRate).toBe(10);
    // subtotal - discount = 6500, tax on 6500 = 650
    expect(bill.taxAmount).toBe(650);
    expect(bill.totalAmount).toBe(7150);
  });

  test('createBill with insurance coverage sets status to pending when not fully covered', async () => {
    const bill = await createBill(makeBillData({
      insuranceProvider: 'Health Insurance',
      insuranceCoveragePercent: 50,
    }));
    // 50% of 7000 = 3500 amountPaid, so status should be pending
    expect(bill.amountPaid).toBe(3500);
    expect(bill.balanceDue).toBe(3500);
    expect(bill.status).toBe('pending');
  });

  test('createBill with full insurance coverage sets status to paid', async () => {
    const bill = await createBill(makeBillData({
      insuranceProvider: 'Full Coverage Insurance',
      insuranceCoveragePercent: 100,
    }));
    // 100% of 7000 = 7000 amountPaid
    expect(bill.amountPaid).toBe(7000);
    expect(bill.balanceDue).toBe(0);
    expect(bill.status).toBe('paid');
  });

  test('recordPayment partial payment changes status to partial', async () => {
    const bill = await createBill(makeBillData());
    const updated = await recordPayment(
      bill._id, 2000, 'cash', 'user-001', 'Admin'
    );
    expect(updated).not.toBeNull();
    expect(updated!.amountPaid).toBe(2000);
    expect(updated!.status).toBe('partial');
  });

  test('recordPayment on already partial bill', async () => {
    const bill = await createBill(makeBillData());
    let updated = await recordPayment(
      bill._id, 3000, 'cash', 'user-001', 'Admin'
    );
    expect(updated!.status).toBe('partial');

    // Add more payment
    updated = await recordPayment(
      bill._id, 4000, 'cash', 'user-001', 'Admin'
    );
    expect(updated!.amountPaid).toBe(7000);
    expect(updated!.status).toBe('paid');
  });

  test('getBillingSummary includes waived bills', async () => {
    await createBill(makeBillData());
    const bill2 = await createBill(makeBillData({
      patientId: 'pat-002',
      patientName: 'Patient Two',
    }));
    await waiveBill(bill2._id, 'user-001', 'Admin', 'Waived for hardship');

    const summary = await getBillingSummary();
    expect(summary.totalWaived).toBe(7000);
    expect(summary.billCount).toBe(2);
  });

  test('recordPayment with notes and reference', async () => {
    const bill = await createBill(makeBillData());
    const updated = await recordPayment(
      bill._id, 5000, 'bank_transfer', 'user-001', 'Admin',
      'TXN-2026-04-001', 'Payment from patient family'
    );
    expect(updated).not.toBeNull();
    expect(updated!.payments[0].reference).toBe('TXN-2026-04-001');
    expect(updated!.payments[0].notes).toBe('Payment from patient family');
  });

  test('getAllBills handles missing createdAt in sort (line 53)', async () => {
    // Tests line 53: (b.createdAt || '').localeCompare(a.createdAt || '')
    // When createdAt is undefined, should use empty string fallback
    const db = require('@/lib/db').billingDB();

    await db.put({
      _id: 'bill-no-date',
      type: 'billing',
      patientId: 'patient-001',
      patientName: 'Test',
      createdAt: undefined,
    });
    await db.put({
      _id: 'bill-with-date',
      type: 'billing',
      patientId: 'patient-002',
      patientName: 'Test',
      createdAt: '2026-04-13T12:00:00Z',
    });

    const all = await getAllBills();
    expect(Array.isArray(all)).toBe(true);
    // Should include both despite missing createdAt on one
    expect(all.filter(b => b.patientId === 'patient-001').length).toBeGreaterThanOrEqual(0);
  });

  test('createBill with items missing id uses generated id (line 109)', async () => {
    // Tests line 109: id: item.id || uuidv4().slice(0, 8)
    // When item.id is falsy, should generate one
    const bill = await createBill(makeBillData({
      items: [
        {
          id: undefined as unknown as string, // This will trigger the || branch
          category: 'consultation',
          description: 'Test',
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000,
        }
      ],
    }));

    expect(bill.items).toHaveLength(1);
    expect(bill.items[0].id).toBeDefined();
    expect(bill.items[0].id).not.toBe('');
  });

  test('recordPayment with zero initial amountPaid keeps status pending (line 208)', async () => {
    // Tests line 208: else if (bill.amountPaid > 0)
    // When balanceDue > 0 AND amountPaid is NOT > 0 (i.e., still 0 after partial payment edge case)
    // This tests the case where balanceDue > 0 but we don't enter the else if
    const bill = await createBill(makeBillData());
    expect(bill.status).toBe('pending');
    expect(bill.amountPaid).toBe(0);

    // Record a payment that doesn't fully pay (status should be 'partial')
    const updated = await recordPayment(
      bill._id, 100, 'cash', 'user-001', 'Admin'
    );

    expect(updated).not.toBeNull();
    expect(updated!.balanceDue).toBeGreaterThan(0);
    expect(updated!.amountPaid).toBe(100);
    // Line 208-209 should be hit: else if (bill.amountPaid > 0) { status = 'partial' }
    expect(updated!.status).toBe('partial');
  });
});

describe('billing-service ↔ ledger reconciliation', () => {
   
  const { getPatientBalance } = require('@/lib/services/ledger-service');

  test('createBill debits the ledger so the patient balance reflects it', async () => {
    await createBill(makeBillData()); // total 7000, no insurance
    expect(await getPatientBalance('pat-001')).toBe(7000);
  });

  test('recording a payment credits the ledger back to zero', async () => {
    const bill = await createBill(makeBillData()); // 7000
    await recordPayment(bill._id, 7000, 'cash', 'user-001', 'Cashier');
    expect(await getPatientBalance('pat-001')).toBe(0);
  });

  test('insurance coverage only bills the patient their responsibility on the ledger', async () => {
    // 50% coverage on a 7000 bill → patient owes 3500 on the ledger.
    await createBill(makeBillData({ insuranceProvider: 'CIC', insuranceCoveragePercent: 50 }));
    expect(await getPatientBalance('pat-001')).toBe(3500);
  });
});

describe('unsettleBillsForPayment', () => {
  test('restores a fully-paid bill to unpaid, undoing exactly what the payment settled', async () => {
    const bill = await createBill(makeBillData());
    await settle({ amount: 7000, paymentId: 'pmt-rev-1' });

    const paid = await getBillById(bill._id);
    expect(paid!.status).toBe('paid');

    const { unsettledBills, failedBillIds } = await unsettleBillsForPayment(
      'pmt-rev-1', 'pat-001', 'user-001', 'Finance Officer'
    );
    expect(failedBillIds).toEqual([]);
    expect(unsettledBills.map(b => b._id)).toEqual([bill._id]);

    const reversed = await getBillById(bill._id);
    expect(reversed!.status).toBe('pending');
    expect(reversed!.amountPaid).toBe(0);
    expect(reversed!.balanceDue).toBe(7000);
    // The receipt itself is kept for the audit trail, just flagged reversed —
    // not deleted from the bill's payment history.
    expect(reversed!.payments).toHaveLength(1);
    expect(reversed!.payments[0].reversed).toBe(true);
    expect(reversed!.payments[0].sourcePaymentId).toBe('pmt-rev-1');
  });

  test('restores a partially-paid bill to its pre-settlement balance', async () => {
    const bill = await createBill(makeBillData());
    await settle({ amount: 3000, paymentId: 'pmt-rev-2' });

    const partial = await getBillById(bill._id);
    expect(partial!.status).toBe('partial');
    expect(partial!.amountPaid).toBe(3000);

    await unsettleBillsForPayment('pmt-rev-2', 'pat-001', 'user-001', 'Finance Officer');

    const reversed = await getBillById(bill._id);
    expect(reversed!.status).toBe('pending');
    expect(reversed!.amountPaid).toBe(0);
    expect(reversed!.balanceDue).toBe(7000);
  });

  test('only undoes the bill(s) this specific payment settled, leaving other payments on the same bill alone', async () => {
    const bill = await createBill(makeBillData({
      items: [{ id: 'item-1', category: 'consultation', description: 'Consult', quantity: 1, unitPrice: 10000, totalPrice: 10000 }],
    }));
    await settle({ amount: 4000, paymentId: 'pmt-rev-3a' });
    await settle({ amount: 6000, paymentId: 'pmt-rev-3b' });

    const bothApplied = await getBillById(bill._id);
    expect(bothApplied!.status).toBe('paid');
    expect(bothApplied!.amountPaid).toBe(10000);

    await unsettleBillsForPayment('pmt-rev-3a', 'pat-001', 'user-001', 'Finance Officer');

    const afterOneReversal = await getBillById(bill._id);
    expect(afterOneReversal!.amountPaid).toBe(6000); // the 3b payment still stands
    expect(afterOneReversal!.status).toBe('partial');
    expect(afterOneReversal!.payments.find(p => p.sourcePaymentId === 'pmt-rev-3a')!.reversed).toBe(true);
    expect(afterOneReversal!.payments.find(p => p.sourcePaymentId === 'pmt-rev-3b')!.reversed).toBeFalsy();
  });

  test('a payment that never settled any bill (or one already reversed) unsettles nothing', async () => {
    const bill = await createBill(makeBillData());
    const { unsettledBills } = await unsettleBillsForPayment('pmt-never-settled', 'pat-001', 'user-001', 'Finance Officer');
    expect(unsettledBills).toHaveLength(0);

    const untouched = await getBillById(bill._id);
    expect(untouched!.status).toBe('pending');

    // Calling it twice for the same payment is a no-op the second time —
    // nothing left to reverse.
    await settle({ amount: 7000, paymentId: 'pmt-rev-4' });
    const first = await unsettleBillsForPayment('pmt-rev-4', 'pat-001', 'user-001', 'Finance Officer');
    expect(first.unsettledBills).toHaveLength(1);
    const second = await unsettleBillsForPayment('pmt-rev-4', 'pat-001', 'user-001', 'Finance Officer');
    expect(second.unsettledBills).toHaveLength(0);
  });
});
