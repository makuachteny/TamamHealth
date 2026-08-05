/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for payment-service.ts's `collectPayment` / `updatePaymentStatus`
 * settling the patient's open BillingDoc(s) alongside the ledger credit.
 *
 * Before this, `collectPayment` posted a ledger credit but never touched the
 * BillingDoc it was paying down — the bill stayed 'pending'/'partial' forever
 * while the ledger balance read paid, and the two permanently disagreed. This
 * covers that the bill status now moves with the payment, and that doing so
 * doesn't double-credit the ledger for the same real-world payment.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-ps-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { getDB } from '@/lib/db';
import { teardownTestDBs } from '../helpers/test-db';
import { collectPayment, updatePaymentStatus, reversePayment } from '@/lib/services/payment-service';
import { createBill, getBillById, getBillsByPatient } from '@/lib/services/billing-service';
import { getPatientBalance } from '@/lib/services/ledger-service';
import type { PaymentDoc } from '@/lib/db-types-payments';

type CollectPaymentInput = Parameters<typeof collectPayment>[0];

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const makeBillData = (overrides = {}) => ({
  patientId: 'pat-500',
  patientName: 'Nyandeng Kur',
  facilityId: 'hosp-1',
  facilityName: 'Juba Teaching Hospital',
  facilityLevel: 'national' as const,
  encounterDate: '2026-08-01',
  items: [
    { id: 'item-1', category: 'consultation' as const, description: 'Consultation', quantity: 1, unitPrice: 4000, totalPrice: 4000 },
  ],
  generatedBy: 'user-001',
  generatedByName: 'Desk Amira',
  state: 'Central Equatoria',
  orgId: 'org-001',
  ...overrides,
});

function paymentInput(overrides: Partial<CollectPaymentInput> = {}): CollectPaymentInput {
  return {
    patientId: 'pat-500',
    patientName: 'Nyandeng Kur',
    method: 'cash',
    amount: 4000,
    currency: 'SSP',
    processedBy: 'cashier-1',
    processedByName: 'Mary Ayen',
    facilityId: 'hosp-1',
    orgId: 'org-001',
    ...overrides,
  };
}

describe('collectPayment settles open bills', () => {
  test('a payment covering the full bill marks it paid', async () => {
    const bill = await createBill(makeBillData());
    await collectPayment(paymentInput({ amount: 4000 }));

    const settled = await getBillById(bill._id);
    expect(settled!.status).toBe('paid');
    expect(settled!.balanceDue).toBe(0);
    expect(settled!.amountPaid).toBe(4000);
  });

  test('does not double-credit the ledger for the same payment', async () => {
    await createBill(makeBillData());
    await collectPayment(paymentInput({ amount: 4000 }));

    // The bill's own createBill ledger-mirrors a +4000 charge; the payment
    // should bring the balance to exactly 0 — not -4000, which is what a
    // second ledger credit (one from collectPayment, one from settling the
    // bill) would produce.
    const balance = await getPatientBalance('pat-500');
    expect(balance).toBe(0);
  });

  test('a partial payment marks the bill partial, not paid', async () => {
    const bill = await createBill(makeBillData());
    await collectPayment(paymentInput({ amount: 1500 }));

    const settled = await getBillById(bill._id);
    expect(settled!.status).toBe('partial');
    expect(settled!.amountPaid).toBe(1500);
    expect(settled!.balanceDue).toBe(2500);
  });

  test('a payment with no open bills only posts the ledger entry', async () => {
    await collectPayment(paymentInput({ patientId: 'pat-no-bills', patientName: 'No Bills', amount: 1000 }));
    const balance = await getPatientBalance('pat-no-bills');
    expect(balance).toBe(-1000);
  });

  test('updatePaymentStatus settles the bill when a pending payment posts (webhook confirmation)', async () => {
    const bill = await createBill(makeBillData());

    // Pending payments are written directly by the checkout/pay-by-link route
    // (not collectPayment, which always posts immediately) — mirror that here.
    const now = new Date().toISOString();
    const pending: PaymentDoc = {
      _id: 'pmt-pending-1',
      type: 'payment',
      patientId: 'pat-500',
      patientName: 'Nyandeng Kur',
      method: 'card',
      amount: 4000,
      currency: 'SSP',
      reference: 'FLW-TX-1',
      status: 'pending',
      processedAt: now,
      processedBy: 'cashier-1',
      processedByName: 'Mary Ayen',
      facilityId: 'hosp-1',
      orgId: 'org-001',
      createdAt: now,
      updatedAt: now,
      createdBy: 'cashier-1',
    };
    await getDB('tamamhealth_payments').put(pending);

    await updatePaymentStatus('FLW-TX-1', 'posted');

    const settled = await getBillById(bill._id);
    expect(settled!.status).toBe('paid');
    expect(settled!.balanceDue).toBe(0);

    const balance = await getPatientBalance('pat-500');
    expect(balance).toBe(0);
  });

  test('does not settle a bill belonging to a different org than the payer', async () => {
    // pat-500 has a bill in their home org (org-001, matching paymentInput's
    // orgId) and, separately, one in a different org — a patient can
    // genuinely have bills across orgs (seen at more than one facility). The
    // payment must only ever pay down the org it was collected in.
    await createBill(makeBillData({ orgId: 'org-001' }));
    await createBill(makeBillData({ orgId: 'org-999' }));

    await collectPayment(paymentInput({ amount: 8000 }));

    const bills = await getBillsByPatient('pat-500');
    const own = bills.find(b => b.orgId === 'org-001')!;
    const other = bills.find(b => b.orgId === 'org-999')!;
    expect(own.status).toBe('paid');
    expect(other.status).toBe('pending');
    expect(other.amountPaid).toBe(0);
    expect(other.payments).toHaveLength(0);
  });

  test('surfaces a bill-settlement failure on the payment doc without unwinding the already-succeeded ledger credit', async () => {
    await createBill(makeBillData()); // bill1: 4000
    await createBill(makeBillData()); // bill2: 4000

    const billingDb = getDB('tamamhealth_billing');
    const originalPut = billingDb.put.bind(billingDb);
    let settlementPutCount = 0;
     
    const spy = jest.spyOn(billingDb, 'put').mockImplementation((doc: any) => {
      settlementPutCount++;
      // First put settles bill1 for real; the second (bill2) simulates the
      // 409 a concurrent cashier/tab would produce.
      if (settlementPutCount === 2) return Promise.reject(new Error('Document update conflict'));
      return originalPut(doc);
    });

    const pmt = await collectPayment(paymentInput({ amount: 8000 }));
    spy.mockRestore();

    expect(pmt.billSettlementError).toBeTruthy();
    expect(pmt.billSettlementError).toContain('conflict');

    // The ledger credit for the full 8000 must stand regardless — it's
    // already the record of money actually received.
    const balance = await getPatientBalance('pat-500');
    expect(balance).toBe(0);

    // bill1 (the first put) really did settle before bill2 failed.
    const bills = await getBillsByPatient('pat-500');
    expect(bills.filter(b => b.status === 'paid')).toHaveLength(1);
    expect(bills.filter(b => b.status === 'pending')).toHaveLength(1);
  });
});

describe('reversePayment unsettles the bill(s) it had paid down', () => {
  test('reversing a payment that fully paid a bill restores it to unpaid, and the ledger', async () => {
    const bill = await createBill(makeBillData());
    const pmt = await collectPayment(paymentInput({ amount: 4000 }));

    const settled = await getBillById(bill._id);
    expect(settled!.status).toBe('paid');

    const reversed = await reversePayment(pmt._id, 'Bounced transfer', 'finance-1', 'Finance Officer');
    expect(reversed!.status).toBe('reversed');

    const bounced = await getBillById(bill._id);
    expect(bounced!.status).toBe('pending');
    expect(bounced!.amountPaid).toBe(0);
    expect(bounced!.balanceDue).toBe(4000);

    // The ledger no longer disagrees with the bill: the patient owes the
    // full amount again on both.
    const balance = await getPatientBalance('pat-500');
    expect(balance).toBe(4000);
  });

  test('reversing a payment that only partially covered a bill restores its prior partial balance', async () => {
    const bill = await createBill(makeBillData());
    const pmt = await collectPayment(paymentInput({ amount: 1500 }));

    const partial = await getBillById(bill._id);
    expect(partial!.status).toBe('partial');

    await reversePayment(pmt._id, 'Chargeback', 'finance-1', 'Finance Officer');

    const bounced = await getBillById(bill._id);
    expect(bounced!.status).toBe('pending');
    expect(bounced!.amountPaid).toBe(0);
    expect(bounced!.balanceDue).toBe(4000);
  });
});
