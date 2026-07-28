/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Cross-org referral visibility (KAN-101).
 *
 * A referral's `orgId` is the SENDING org, and `filterByScope` filters on org
 * before it ever reaches the facility check — so a referral sent across an
 * organisational boundary was invisible to the receiving org. The referring
 * clinician saw a sent referral the receiver would never get.
 *
 * These cover both halves: that the referral now reaches org B, and — more
 * importantly — that nothing ELSE crosses with it.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-xorg-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createReferral, getAllReferrals } from '@/lib/services/referral-service';
import { filterByScope } from '@/lib/services/data-scope';
import { hospitalsDB } from '@/lib/db';
import type { DataScope } from '@/lib/services/data-scope';

const ORG_A = 'org-moh-ss';
const ORG_B = 'org-mercy-hospital';

const senderScope: DataScope = { role: 'doctor', orgId: ORG_A, hospitalId: 'hosp-a1' };
const receiverScope: DataScope = { role: 'doctor', orgId: ORG_B, hospitalId: 'hosp-b1' };
/** A third facility inside the receiving org that is NOT the destination. */
const bystanderScope: DataScope = { role: 'doctor', orgId: ORG_B, hospitalId: 'hosp-b2' };

beforeEach(async () => {
  const hdb = hospitalsDB();
  await hdb.put({ _id: 'hosp-a1', type: 'hospital', name: 'Juba Teaching', orgId: ORG_A } as never);
  await hdb.put({ _id: 'hosp-b1', type: 'hospital', name: 'Mercy General', orgId: ORG_B } as never);
  await hdb.put({ _id: 'hosp-b2', type: 'hospital', name: 'Mercy Annex', orgId: ORG_B } as never);
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

const referral = (overrides: Record<string, unknown> = {}) => ({
  patientId: 'pat-001', patientName: 'Achol Deng',
  fromHospital: 'Juba Teaching', fromHospitalId: 'hosp-a1',
  toHospital: 'Mercy General', toHospitalId: 'hosp-b1',
  referralDate: '2026-07-27', urgency: 'urgent' as const,
  reason: 'Cardiology opinion', department: 'Cardiology',
  status: 'sent' as const, referringDoctor: 'Dr. Wani', notes: '',
  ...overrides,
});

describe('cross-org referral', () => {
  test('stamps the destination org when it differs from the sender', async () => {
    const doc = await createReferral(referral() as never);
    expect(doc.orgId).toBe(ORG_A);
    expect(doc.toOrgId).toBe(ORG_B);
  });

  test('the RECEIVING org can now see it', async () => {
    await createReferral(referral() as never);
    const visible = await getAllReferrals(receiverScope);
    expect(visible).toHaveLength(1);
    expect(visible[0].toHospitalId).toBe('hosp-b1');
  });

  test('the sending org still sees it', async () => {
    await createReferral(referral() as never);
    expect(await getAllReferrals(senderScope)).toHaveLength(1);
  });

  test('a DIFFERENT facility in the receiving org does NOT see it', async () => {
    // The org filter opens; the facility filter must still hold. Otherwise
    // this would leak every inbound referral to every facility in the org.
    await createReferral(referral() as never);
    expect(await getAllReferrals(bystanderScope)).toHaveLength(0);
  });
});

describe('same-org referrals are unchanged', () => {
  test('no toOrgId is stamped when both ends share an org', async () => {
    // Stamping it anyway would make every referral look like a boundary
    // crossing in the audit trail.
    const doc = await createReferral(referral({
      toHospital: 'Mercy Annex', toHospitalId: 'hosp-b2',
      fromHospital: 'Mercy General', fromHospitalId: 'hosp-b1',
    }) as never);
    expect(doc.toOrgId).toBeUndefined();
  });
});

describe('the exception does not widen anything else', () => {
  test('a non-referral document with a foreign orgId stays invisible', async () => {
    // `toOrgId` is only ever written by createReferral. Nothing else can use
    // this branch to widen its own visibility.
    const foreign = [{ _id: 'x1', type: 'patient', orgId: ORG_A, hospitalId: 'hosp-a1' }];
    expect(filterByScope(foreign, receiverScope)).toHaveLength(0);
  });

  test('a doc claiming toOrgId still has to pass the facility filter', async () => {
    const sneaky = [{ _id: 'x2', type: 'patient', orgId: ORG_A, toOrgId: ORG_B, hospitalId: 'hosp-a1' }];
    // hospitalId belongs to org A's facility, so org B's clinician sees nothing.
    expect(filterByScope(sneaky, receiverScope)).toHaveLength(0);
  });

  test('org A cannot see org B data generally', async () => {
    const orgBData = [{ _id: 'x3', type: 'patient', orgId: ORG_B, hospitalId: 'hosp-b1' }];
    expect(filterByScope(orgBData, senderScope)).toHaveLength(0);
  });
});
