/**
 * Lab orders must anchor to the patient's CURRENT visit, not spawn a parallel
 * one, and the ordered test ids must land on the encounter's `labOrderIds` —
 * that array is what `useResumableEncounters` counts to tell the clinician
 * "all results back — resume the visit". Before these fixes, every lab order
 * opened a brand-new desk encounter (duplicating the visit record) and no code
 * path ever wrote `labOrderIds`, so the resume worklist permanently showed
 * "0 of 0 results back".
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createEncounter,
  ensureLabOrderEncounter,
  appendLabOrderIds,
  getAllEncounters,
  getEncounter,
  getResumableEncounters,
} from '@/lib/services/encounter-service';

afterEach(async () => {
  await teardownTestDBs();
});

const PATIENT = { patientId: 'pat-00001', patientName: 'Nyakuma Deng' };

function orderInput(overrides: Partial<Parameters<typeof ensureLabOrderEncounter>[0]> = {}) {
  return {
    ...PATIENT,
    hospitalId: 'hosp-001',
    hospitalName: 'Juba Teaching Hospital',
    orgId: 'org-moh-ss',
    clinicianId: 'user-dr-wani',
    clinicianName: 'Dr. Wani',
    ...overrides,
  };
}

async function openConsultEncounter(overrides: Record<string, unknown> = {}) {
  return createEncounter({
    ...PATIENT,
    clinicianId: 'user-dr-wani',
    clinicianName: 'Dr. Wani',
    hospitalId: 'hosp-001',
    hospitalName: 'Juba Teaching Hospital',
    orgId: 'org-moh-ss',
    status: 'with_clinician',
    snapshot: {},
    labOrderIds: [],
    startedAt: new Date().toISOString(),
    ...overrides,
  } as never);
}

describe('ensureLabOrderEncounter', () => {
  it('reuses the open with_clinician encounter at the same facility and moves it to awaiting_labs', async () => {
    const open = await openConsultEncounter();

    const anchored = await ensureLabOrderEncounter(orderInput());

    expect(anchored._id).toBe(open._id);
    expect(anchored.status).toBe('awaiting_labs');
    // The walk went through the state machine: the hop is on the trail.
    const trail = anchored.statusHistory ?? [];
    expect(trail[trail.length - 1]).toMatchObject({ from: 'with_clinician', to: 'awaiting_labs' });
    // No duplicate visit was created.
    expect(await getAllEncounters()).toHaveLength(1);
  });

  it('returns the open encounter untouched when it is already awaiting_labs', async () => {
    const open = await openConsultEncounter({ status: 'awaiting_labs' });

    const anchored = await ensureLabOrderEncounter(orderInput());

    expect(anchored._id).toBe(open._id);
    expect(anchored.status).toBe('awaiting_labs');
    expect(await getAllEncounters()).toHaveLength(1);
  });

  it('anchors to an in-flight visit it cannot legally move without forcing a transition', async () => {
    const open = await openConsultEncounter({ status: 'in_triage' });

    const anchored = await ensureLabOrderEncounter(orderInput());

    expect(anchored._id).toBe(open._id);
    expect(anchored.status).toBe('in_triage');
    expect(await getAllEncounters()).toHaveLength(1);
  });

  it('does NOT absorb an open encounter at a different facility', async () => {
    const other = await openConsultEncounter({ hospitalId: 'hosp-002' });

    const anchored = await ensureLabOrderEncounter(orderInput());

    expect(anchored._id).not.toBe(other._id);
    expect(anchored.hospitalId).toBe('hosp-001');
    expect(await getAllEncounters()).toHaveLength(2);
  });

  it('creates a desk encounter at awaiting_labs for a walk-in with no open visit', async () => {
    const anchored = await ensureLabOrderEncounter(orderInput());

    expect(anchored.status).toBe('awaiting_labs');
    expect(anchored.patientId).toBe(PATIENT.patientId);
    expect(anchored.clinicianId).toBe('user-dr-wani');
    expect(anchored.statusHistory?.[0]).toMatchObject({ from: null, to: 'awaiting_labs' });
    expect(await getAllEncounters()).toHaveLength(1);
  });

  it('is idempotent: a second order in the same visit reuses the same encounter', async () => {
    const first = await ensureLabOrderEncounter(orderInput());
    const second = await ensureLabOrderEncounter(orderInput());

    expect(second._id).toBe(first._id);
    expect(await getAllEncounters()).toHaveLength(1);
  });
});

describe('appendLabOrderIds', () => {
  it('merges new order ids onto the encounter without duplicating existing ones', async () => {
    const enc = await openConsultEncounter({ status: 'awaiting_labs' });

    await appendLabOrderIds(enc._id, ['lab-1', 'lab-2']);
    await appendLabOrderIds(enc._id, ['lab-2', 'lab-3']);

    const stored = await getEncounter(enc._id);
    expect(stored?.labOrderIds).toEqual(['lab-1', 'lab-2', 'lab-3']);
  });

  it('returns null for an unknown encounter instead of throwing', async () => {
    expect(await appendLabOrderIds('enc-nope', ['lab-1'])).toBeNull();
  });

  it('makes the paused visit resumable with its order count visible to the clinician', async () => {
    const enc = await ensureLabOrderEncounter(orderInput());
    await appendLabOrderIds(enc._id, ['lab-1', 'lab-2']);

    const resumable = await getResumableEncounters('user-dr-wani');
    expect(resumable).toHaveLength(1);
    expect(resumable[0]._id).toBe(enc._id);
    expect(resumable[0].labOrderIds).toEqual(['lab-1', 'lab-2']);
  });
});
