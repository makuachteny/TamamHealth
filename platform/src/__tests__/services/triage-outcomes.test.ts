/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * LWBS and emergency escalation (KAN-100).
 *
 * Both are legal transitions out of every pre-clinician triage state, but
 * nothing in the UI could reach either. A patient who walked out of the waiting
 * room stayed "waiting" forever — inflating every queue count, and (because
 * findOpenEncounterForPatient reuses a non-terminal encounter within 24h) able
 * to absorb a genuine re-attendance later the same day onto the abandoned visit.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tri-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createArrivalEncounter,
  recordLeftWithoutBeingSeen,
  escalateEncounterToEmergency,
  findOpenEncounterForPatient,
  getOpenEncounterForPatient,
  transitionEncounter,
} from '@/lib/services/encounter-service';
import { TERMINAL_STATUSES } from '@/lib/clinical-flow/encounter-journey';

const PATIENT = 'pat-100';
const FACILITY = 'hosp-001';

async function arrive() {
  return createArrivalEncounter({
    patientId: PATIENT, patientName: 'Achol Deng', hospitalNumber: 'JTH-1',
    hospitalId: FACILITY, hospitalName: 'Juba Teaching', orgId: 'org-moh-ss',
  } as never);
}

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('left without being seen', () => {
  test('records LWBS and closes the visit', async () => {
    const enc = await arrive();
    const out = await recordLeftWithoutBeingSeen(enc._id, { actorId: 'nurse-1' });
    expect(out.status).toBe('lwbs');
  });

  test('lwbs is terminal, so the visit leaves the open queue', async () => {
    // The bug this prevents: an abandoned visit staying "open" forever.
    const enc = await arrive();
    expect(await getOpenEncounterForPatient(PATIENT)).not.toBeNull();

    await recordLeftWithoutBeingSeen(enc._id);
    expect(await getOpenEncounterForPatient(PATIENT)).toBeNull();
    expect(TERMINAL_STATUSES).toContain('lwbs');
  });

  test('an abandoned visit cannot absorb a later re-attendance', async () => {
    // findOpenEncounterForPatient reuses a non-terminal encounter within 24h.
    // Without LWBS the second visit's triage would land on the first visit.
    const first = await arrive();
    await recordLeftWithoutBeingSeen(first._id);

    expect(await findOpenEncounterForPatient(PATIENT, FACILITY)).toBeNull();

    const second = await arrive();
    expect(second._id).not.toBe(first._id);
  });

  test('closedAt is stamped', async () => {
    const enc = await arrive();
    const out = await recordLeftWithoutBeingSeen(enc._id);
    expect(out.closedAt).toBeTruthy();
  });
});

describe('emergency escalation', () => {
  /** Escalation is legal from in_triage onward, not from awaiting_triage. */
  async function inTriage() {
    const enc = await arrive();
    await transitionEncounter(enc._id, 'in_triage');
    return enc;
  }

  test('escalates a patient being triaged', async () => {
    const enc = await inTriage();
    const out = await escalateEncounterToEmergency(enc._id, { actorId: 'nurse-1', reason: 'airway compromise' });
    expect(out.status).toBe('escalated_to_emergency');
  });

  test('a patient still only WAITING cannot be escalated directly', async () => {
    // awaiting_triage → [in_triage, lwbs] only. A patient deteriorating in the
    // waiting room must be taken into triage first, which is also the clinically
    // correct sequence — someone has to lay eyes on them.
    const enc = await arrive();
    await expect(escalateEncounterToEmergency(enc._id)).rejects.toThrow(/Illegal encounter transition/);
  });

  test('is NOT terminal — care continues under emergency', async () => {
    const enc = await inTriage();
    const escalated = await escalateEncounterToEmergency(enc._id);
    expect(TERMINAL_STATUSES).not.toContain('escalated_to_emergency');
    expect(escalated.closedAt).toBeFalsy();
    // And it can still progress to an outcome.
    const admitted = await transitionEncounter(enc._id, 'admitted');
    expect(admitted.status).toBe('admitted');
  });
});

describe('closedAt is derived from terminal status', () => {
  test.each(['discharged', 'admitted', 'deceased'] as const)(
    '%s stamps closedAt',
    async (status) => {
      // The old hand-listed array named only admitted/deceased/referred_out/
      // ready_for_clinic_checkout — so a normally DISCHARGED encounter never
      // got a closedAt, and payments grouped it by arrival date instead.
      const enc = await arrive();
      await transitionEncounter(enc._id, 'in_triage');
      await transitionEncounter(enc._id, 'escalated_to_emergency');
      const out = await transitionEncounter(enc._id, status);
      expect(out.closedAt).toBeTruthy();
    },
  );
});
