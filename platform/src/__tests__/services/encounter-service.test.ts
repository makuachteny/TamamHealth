/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for the facility-checkout discharge path added to encounter-service:
 * dischargeEncounter() walks an encounter through the legal clinic→facility
 * checkout chain to a terminal status, and getOpenEncounterForPatient() finds
 * the patient's open encounter.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createEncounter,
  dischargeEncounter,
  getOpenEncounterForPatient,
} from '@/lib/services/encounter-service';
import type { EncounterStatus } from '@/lib/clinical-flow/encounter-journey';

const makeEncounter = (status: EncounterStatus, patientId = 'pat-001') =>
  createEncounter({
    patientId,
    patientName: 'Achol Deng',
    clinicianId: 'user-doc',
    clinicianName: 'Dr Mayen',
    hospitalId: 'hosp-001',
    status,
    snapshot: {},
    labOrderIds: [],
    startedAt: '2026-04-10T09:00:00Z',
  });

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('dischargeEncounter (facility checkout)', () => {
  test('walks ready_for_clinic_checkout through to a terminal discharged status', async () => {
    const enc = await makeEncounter('ready_for_clinic_checkout');
    const out = await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    expect(out?.status).toBe('discharged');
  });

  test('flags pending items as discharged_with_pending_items', async () => {
    const enc = await makeEncounter('ready_for_clinic_checkout');
    const out = await dischargeEncounter(enc._id, { actorId: 'desk-1', pendingItems: true });
    expect(out?.status).toBe('discharged_with_pending_items');
  });

  test('is a no-op on an already-terminal encounter', async () => {
    const enc = await makeEncounter('ready_for_clinic_checkout');
    await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    const again = await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    expect(again?.status).toBe('discharged'); // unchanged
  });

  test('leaves a not-yet-finished visit untouched', async () => {
    const enc = await makeEncounter('with_clinician');
    const out = await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    expect(out?.status).toBe('with_clinician'); // not in a checkout-eligible state
  });
});

describe('getOpenEncounterForPatient', () => {
  test('returns the open encounter and ignores discharged ones', async () => {
    const open = await makeEncounter('ready_for_clinic_checkout', 'pat-xyz');
    const found = await getOpenEncounterForPatient('pat-xyz');
    expect(found?._id).toBe(open._id);

    await dischargeEncounter(open._id, { actorId: 'desk-1' });
    expect(await getOpenEncounterForPatient('pat-xyz')).toBeNull();
  });
});
