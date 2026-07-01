/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for payment-gateway webhook reconciliation in payment-service.ts.
 *
 * The M-Pesa / Airtel / Flutterwave webhook routes match a callback to a
 * pending payment by its provider `reference` and move it to the correct
 * `PaymentStatus`. This covers that core persistence path:
 *   - lookup by reference
 *   - success → 'posted', failure → 'failed'
 *   - unknown reference returns null (caller still acks the gateway)
 *   - idempotent re-processing of an already-terminal status
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-pw-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  collectPayment,
  getPaymentByReference,
  updatePaymentStatus,
} from '@/lib/services/payment-service';

type CollectPaymentInput = Parameters<typeof collectPayment>[0];

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

function pendingMpesaPayment(reference: string, overrides: Partial<CollectPaymentInput> = {}): CollectPaymentInput {
  return {
    patientId: 'patient-001',
    patientName: 'Deng Mabior',
    method: 'mpesa',
    amount: 5000,
    currency: 'SSP',
    reference,
    mobileMoneyPhone: '+211900000000',
    processedBy: 'cashier-1',
    processedByName: 'Mary Ayen',
    facilityId: 'hosp-1',
    ...overrides,
  };
}

describe('Payment webhook reconciliation', () => {
  test('looks up a payment by its provider reference', async () => {
    await collectPayment(pendingMpesaPayment('CHK-REQ-123'));
    const found = await getPaymentByReference('CHK-REQ-123');
    expect(found).not.toBeNull();
    expect(found?.reference).toBe('CHK-REQ-123');
  });

  test('marks a payment posted on a successful callback', async () => {
    await collectPayment(pendingMpesaPayment('CHK-REQ-success'));
    const updated = await updatePaymentStatus('CHK-REQ-success', 'posted', { providerReference: 'MPESA-RECEIPT-1' });
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('posted');

    const reloaded = await getPaymentByReference('CHK-REQ-success');
    expect(reloaded?.status).toBe('posted');
  });

  test('marks a payment failed on a failed callback and appends the reason', async () => {
    await collectPayment(pendingMpesaPayment('CHK-REQ-fail'));
    const updated = await updatePaymentStatus('CHK-REQ-fail', 'failed', { reason: 'Cancelled by user' });
    expect(updated?.status).toBe('failed');
    expect(updated?.notes).toContain('Cancelled by user');
  });

  test('returns null for an unknown reference (unmatched callback)', async () => {
    const updated = await updatePaymentStatus('does-not-exist', 'posted');
    expect(updated).toBeNull();
  });

  test('is idempotent — re-applying the same status is a no-op', async () => {
    await collectPayment(pendingMpesaPayment('CHK-REQ-idem'));
    const first = await updatePaymentStatus('CHK-REQ-idem', 'posted');
    const firstRev = first?._rev;
    const second = await updatePaymentStatus('CHK-REQ-idem', 'posted');
    // Same revision back — no second write occurred.
    expect(second?._rev).toBe(firstRev);
    expect(second?.status).toBe('posted');
  });
});
