/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Claim adjudication — what the payer decided has to survive the save.
 *
 * The adjudication form has always collected an allowed amount, but the write
 * only persisted approved/denied/write-off, so the claims table's "Allowed"
 * column read SSP 0 for every adjudicated claim. These cover the field that was
 * being dropped, and the status the pair of amounts implies.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { submitClaim, adjudicateClaim } from '@/lib/services/payment-service';

const makeClaim = () => submitClaim({
  patientId: 'pat-001',
  patientName: 'Achol Deng',
  policyId: 'pol-001',
  payerName: 'AAR Insurance',
  payerType: 'private',
  chargeIds: [],
  totalBilled: 52_000,
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  submittedBy: 'Nyandeng Biller',
});

afterAll(async () => { await teardownTestDBs(); });

describe('adjudicateClaim', () => {
  it('persists the allowed amount the payer stated', async () => {
    const claim = await makeClaim();
    const out = await adjudicateClaim(claim._id, 36_000, 9_000, 0, 0, 'Nyandeng Biller', {
      totalAllowed: 45_000,
    });
    expect(out?.totalAllowed).toBe(45_000);
    expect(out?.totalApproved).toBe(36_000);
    expect(out?.totalDenied).toBe(9_000);
  });

  it('falls back to approved + denied when no allowed amount is given', async () => {
    const claim = await makeClaim();
    // A stale zero would read as "the payer allowed nothing", which is a
    // different claim from one where nobody typed the figure.
    const out = await adjudicateClaim(claim._id, 24_000, 0, 0, 0, 'Nyandeng Biller');
    expect(out?.totalAllowed).toBe(24_000);
  });

  it('derives the claim status from the approved/denied split', async () => {
    const paid = await adjudicateClaim((await makeClaim())._id, 52_000, 0, 0, 0, 'Biller');
    expect(paid?.status).toBe('paid');

    const partial = await adjudicateClaim((await makeClaim())._id, 30_000, 22_000, 0, 0, 'Biller');
    expect(partial?.status).toBe('partial');

    const denied = await adjudicateClaim((await makeClaim())._id, 0, 52_000, 0, 0, 'Biller');
    expect(denied?.status).toBe('denied');
  });

  it('drops denial reasons once a claim is paid in full', async () => {
    const claim = await makeClaim();
    await adjudicateClaim(claim._id, 20_000, 32_000, 0, 0, 'Biller', { denialReasons: ['Not covered'] });
    const cleared = await adjudicateClaim(claim._id, 52_000, 0, 0, 0, 'Biller');
    expect(cleared?.denialReasons).toBeUndefined();
  });
});
