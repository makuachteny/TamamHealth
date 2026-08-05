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
import { collectPayment, updatePaymentStatus } from '@/lib/services/payment-service';
import { createBill, getBillById } from '@/lib/services/billing-service';
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
});
