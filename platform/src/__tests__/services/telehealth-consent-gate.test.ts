/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Consent gating on telehealth admission (KAN-125).
 *
 * Runs under jsdom (the default), not `node`: the service reaches PouchDB
 * through `pouchdb-browser`, which needs `self`.
 *
 * The defect this closes: `updateSessionStatus(id, 'in_session')` would start
 * a visit with no consent record at all. The provider room disabled its Admit
 * button, but that is client code and the room is not the only caller — so the
 * only real gate is the one in the service, and these tests are it.
 *
 * Withdrawal is tested alongside, because the interesting case is not "consent
 * missing" but "consent given, then taken back": the flag alone cannot tell
 * those apart, which is why the withdrawal is recorded rather than erased.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-gate-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import {
  createSession,
  updateSessionStatus,
  recordConsent,
  withdrawConsent,
  getSessionById,
  ConsentRequiredError,
} from '@/lib/services/telehealth-service';
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
    status: 'waiting_room',
    chiefComplaint: 'Follow-up',
    followUpRequired: false,
    referralRequired: false,
    patientConsentGiven: false,
    sessionRecorded: false,
    connectionDrops: 0,
    ...overrides,
  } as Parameters<typeof createSession>[0]);
}

describe('admission gate', () => {
  test('refuses to start a visit with no consent', async () => {
    const s = await makeSession();

    await expect(updateSessionStatus(s._id, 'in_session'))
      .rejects.toThrow(ConsentRequiredError);

    // And the refusal is real — the record did not move.
    expect((await getSessionById(s._id))!.status).toBe('waiting_room');
  });

  test('allows the visit to start once the patient has consented', async () => {
    const s = await makeSession();
    await recordConsent(s._id, { method: 'patient_portal', consentedBy: 'pat-001' });

    const updated = await updateSessionStatus(s._id, 'in_session');
    expect(updated!.status).toBe('in_session');
    expect(updated!.actualStartTime).toBeTruthy();
  });

  test('allows the visit to start on a provider attestation', async () => {
    // Attestation is a legitimate fallback for a patient who cannot use the
    // portal — the gate requires consent, not specifically portal consent.
    const s = await makeSession();
    await recordConsent(s._id, {
      method: 'provider_attested_verbal',
      attestedBy: 'prov-001',
      attestedByName: 'Dr. Smith',
    });

    expect((await updateSessionStatus(s._id, 'in_session'))!.status).toBe('in_session');
  });

  test('does not gate any status other than in_session', async () => {
    // Cancelling or failing an unconsented session must still work — otherwise
    // a session nobody consented to could never be closed.
    const s = await makeSession();
    expect((await updateSessionStatus(s._id, 'cancelled'))!.status).toBe('cancelled');

    const s2 = await makeSession();
    expect((await updateSessionStatus(s2._id, 'waiting_room'))!.status).toBe('waiting_room');
  });

  test('the refusal is a typed error, not a null return', async () => {
    // The caller has to be able to tell "you may not admit yet" from a write
    // failure. A null would be reported to the clinician as a generic error
    // and they would simply press the button again.
    const s = await makeSession();
    await expect(updateSessionStatus(s._id, 'in_session')).rejects.toMatchObject({
      name: 'ConsentRequiredError',
    });
  });

  test('an unknown session is not reported as a consent problem', async () => {
    // Failing closed is right, but blaming consent for a missing document
    // would send whoever debugs it in the wrong direction.
    await expect(updateSessionStatus('tele-nope', 'in_session')).resolves.toBeNull();
  });
});

describe('withdrawal', () => {
  test('withdrawal blocks admission', async () => {
    const s = await makeSession();
    await recordConsent(s._id, { method: 'patient_portal', consentedBy: 'pat-001' });
    await withdrawConsent(s._id, { withdrawnBy: 'pat-001', reason: 'Prefers in person' });

    await expect(updateSessionStatus(s._id, 'in_session'))
      .rejects.toThrow(/withdrew consent/i);
  });

  test('withdrawal is recorded, not erased', async () => {
    const s = await makeSession();
    await recordConsent(s._id, { method: 'patient_portal', consentedBy: 'pat-001' });
    await withdrawConsent(s._id, { withdrawnBy: 'pat-001', reason: 'Prefers in person' });

    const after = await getSessionById(s._id);
    expect(after!.patientConsentGiven).toBe(false);
    // Without these, a withdrawn consent is indistinguishable from one never
    // given, and the fact that the patient made a decision is lost.
    expect(after!.consentWithdrawnAt).toBeTruthy();
    expect(after!.consentWithdrawnReason).toBe('Prefers in person');
  });

  test('the refusal message distinguishes withdrawal from never consenting', async () => {
    const never = await makeSession();
    await expect(updateSessionStatus(never._id, 'in_session'))
      .rejects.toThrow(/cannot start until the patient has consented/i);

    const withdrawn = await makeSession();
    await recordConsent(withdrawn._id, { method: 'patient_portal', consentedBy: 'pat-001' });
    await withdrawConsent(withdrawn._id, { withdrawnBy: 'pat-001' });
    await expect(updateSessionStatus(withdrawn._id, 'in_session'))
      .rejects.toThrow(/withdrew consent/i);
  });

  test('re-consenting after a withdrawal clears the withdrawal and admits', async () => {
    const s = await makeSession();
    await recordConsent(s._id, { method: 'patient_portal', consentedBy: 'pat-001' });
    await withdrawConsent(s._id, { withdrawnBy: 'pat-001' });
    await recordConsent(s._id, { method: 'patient_portal', consentedBy: 'pat-001' });

    const after = await getSessionById(s._id);
    expect(after!.patientConsentGiven).toBe(true);
    // Current state must be unambiguous; the audit log keeps the history.
    expect(after!.consentWithdrawnAt).toBeUndefined();

    expect((await updateSessionStatus(s._id, 'in_session'))!.status).toBe('in_session');
  });
});
