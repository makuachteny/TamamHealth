/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Server-backed waiting room (KAN-128).
 *
 * Runs under jsdom (the default) — the service reaches PouchDB through
 * `pouchdb-browser`, which needs `self`.
 *
 * The property under test is that `waiting_room` MEANS something: a session in
 * that state has a real patient in it, with a real arrival time. The provider
 * room used to reach that state on a timer and told the same story whether or
 * not anyone had arrived.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-wait-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import {
  createSession,
  enterWaitingRoom,
  admitFromWaitingRoom,
  rejectFromWaitingRoom,
  recordConsent,
  updateSessionStatus,
  getSessionById,
  ConsentRequiredError,
} from '@/lib/services/telehealth-service';
import { expireStaleSessions, ABANDONED_WAIT_MS } from '@/lib/services/telehealth-reconciliation';
import { jubaDate } from '@/lib/time-juba';
import { teardownTestDBs } from '../helpers/test-db';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

async function makeSession(overrides: Record<string, unknown> = {}) {
  return createSession({
    patientId: 'pat-001',
    patientName: 'John Doe',
    providerId: 'prov-001',
    providerName: 'Dr. Smith',
    providerRole: 'doctor',
    facilityId: 'hosp-001',
    facilityName: 'Test Hospital',
    sessionType: 'video',
    scheduledDate: jubaDate(),
    scheduledTime: '09:00',
    status: 'scheduled',
    chiefComplaint: 'Follow-up',
    followUpRequired: false,
    referralRequired: false,
    patientConsentGiven: false,
    sessionRecorded: false,
    connectionDrops: 0,
    ...overrides,
  } as Parameters<typeof createSession>[0]);
}

/** A session with the patient waiting and consent recorded. */
async function waitingAndConsented() {
  const s = await makeSession();
  await recordConsent(s._id, { method: 'patient_portal', consentedBy: 'pat-001' });
  await enterWaitingRoom(s._id, { patientId: 'pat-001' });
  return s;
}

describe('entering the waiting room', () => {
  test('stamps a real arrival time', async () => {
    const s = await makeSession();
    const before = Date.now();

    const updated = await enterWaitingRoom(s._id, { patientId: 'pat-001' });

    expect(updated!.status).toBe('waiting_room');
    expect(Date.parse(updated!.waitingSince!)).toBeGreaterThanOrEqual(before - 1000);
  });

  test('a reload keeps the ORIGINAL arrival time', async () => {
    // Restamping would reset the queue position of whoever has waited longest
    // — the one patient for whom an accurate wait matters most.
    const s = await makeSession();
    const first = (await enterWaitingRoom(s._id, { patientId: 'pat-001' }))!.waitingSince;

    await new Promise(r => setTimeout(r, 20));
    const again = await enterWaitingRoom(s._id, { patientId: 'pat-001' });

    expect(again!.waitingSince).toBe(first);
  });

  test('does not pull an in-progress visit back into the queue', async () => {
    const s = await waitingAndConsented();
    await admitFromWaitingRoom(s._id, { admittedBy: 'prov-001' });

    const after = await enterWaitingRoom(s._id, { patientId: 'pat-001' });
    expect(after!.status).toBe('in_session');
  });

  test('does not require consent to wait', async () => {
    // Consent is enforced at admission. Requiring it to even be seen waiting
    // would turn consent into a toll gate on the door.
    const s = await makeSession();
    expect((await enterWaitingRoom(s._id, { patientId: 'pat-001' }))!.status).toBe('waiting_room');
  });

  test('returns null for an unknown session', async () => {
    expect(await enterWaitingRoom('tele-nope', { patientId: 'pat-001' })).toBeNull();
  });
});

describe('admission', () => {
  test('records who admitted the patient and when', async () => {
    const s = await waitingAndConsented();

    const updated = await admitFromWaitingRoom(s._id, {
      admittedBy: 'prov-001',
      admittedByName: 'Dr. Smith',
    });

    expect(updated!.status).toBe('in_session');
    expect(updated!.admittedBy).toBe('prov-001');
    expect(updated!.admittedByName).toBe('Dr. Smith');
    expect(updated!.admittedAt).toBeTruthy();
  });

  test('is refused without consent', async () => {
    // The KAN-125 gate applies here, which is the moment it exists for.
    const s = await makeSession();
    await enterWaitingRoom(s._id, { patientId: 'pat-001' });

    await expect(admitFromWaitingRoom(s._id, { admittedBy: 'prov-001' }))
      .rejects.toThrow(ConsentRequiredError);

    expect((await getSessionById(s._id))!.status).toBe('waiting_room');
  });
});

describe('rejection', () => {
  test('records the reason, the actor, and does NOT mark a no-show', async () => {
    const s = await waitingAndConsented();

    const updated = await rejectFromWaitingRoom(s._id, {
      rejectedBy: 'prov-001',
      rejectedByName: 'Dr. Smith',
      reason: 'Clinician called to an emergency',
    });

    expect(updated!.rejectionReason).toBe('Clinician called to an emergency');
    expect(updated!.rejectedBy).toBe('prov-001');
    expect(updated!.rejectedAt).toBeTruthy();
    // The patient turned up. A no-show would be a false mark on their record.
    expect(updated!.status).toBe('cancelled');
    expect(updated!.status).not.toBe('no_show');
  });

  test('refuses an empty reason', async () => {
    // A rejection the patient cannot understand leaves them at a closed door.
    const s = await waitingAndConsented();
    await expect(
      rejectFromWaitingRoom(s._id, { rejectedBy: 'prov-001', reason: '   ' }),
    ).rejects.toThrow(/reason is required/i);
  });
});

describe('abandoned waits (timeout)', () => {
  test('a patient who waited and was never admitted is NOT a no-show', async () => {
    const s = await waitingAndConsented();
    const waitedAt = Date.parse((await getSessionById(s._id))!.waitingSince!);

    const findings = await expireStaleSessions(waitedAt + ABANDONED_WAIT_MS + 60_000);

    const after = (await getSessionById(s._id))!;
    expect(after.status).toBe('failed');
    expect(after.terminationReason).toBe('abandoned');
    // This is the distinction the whole branch exists for.
    expect(after.status).not.toBe('no_show');
    expect(findings.some(f => f.sessionId === s._id)).toBe(true);
  });

  test('a patient still inside the grace period is left waiting', async () => {
    const s = await waitingAndConsented();
    const waitedAt = Date.parse((await getSessionById(s._id))!.waitingSince!);

    await expireStaleSessions(waitedAt + ABANDONED_WAIT_MS - 60_000);

    expect((await getSessionById(s._id))!.status).toBe('waiting_room');
  });

  test('a patient who never arrived is still a no-show', async () => {
    // The new branch must not swallow the genuine no-show case.
    const { NO_SHOW_GRACE_MS } = require('@/lib/services/telehealth-reconciliation');
    const s = await makeSession({ scheduledDate: '2020-01-01', scheduledTime: '09:00' });

    await expireStaleSessions(Date.parse('2020-01-01T09:00') + NO_SHOW_GRACE_MS + 60_000);

    const after = (await getSessionById(s._id))!;
    expect(after.status).toBe('no_show');
  });

  test('an admitted visit is not touched by the waiting-room branch', async () => {
    const s = await waitingAndConsented();
    await admitFromWaitingRoom(s._id, { admittedBy: 'prov-001' });

    // Long past the wait threshold, but the visit started — it is governed by
    // the abandoned-session rule, not the abandoned-wait one.
    await expireStaleSessions(Date.now() + ABANDONED_WAIT_MS + 60_000);

    expect((await getSessionById(s._id))!.status).toBe('in_session');
  });
});

describe('waiting_room is only reachable through the patient', () => {
  test('the status itself still exists for other writers, but arrival does not', async () => {
    // updateSessionStatus can still set the status (sync/reconciliation need
    // it), but only enterWaitingRoom stamps an arrival — so "a patient is
    // waiting" is never inferred from the status alone.
    const s = await makeSession();
    const updated = await updateSessionStatus(s._id, 'waiting_room');

    expect(updated!.status).toBe('waiting_room');
    expect(updated!.waitingSince).toBeUndefined();
  });
});
