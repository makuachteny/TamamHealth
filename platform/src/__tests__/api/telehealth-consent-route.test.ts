/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Authorisation rules for POST /api/telehealth/consent.
 *
 * This endpoint is what makes telehealth consent first-party, so its access
 * rules ARE the feature. Each test pins one rule that, if it regressed, would
 * put a consent record in the chart attributed to a patient who never gave it
 * — the exact defect this work removed.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-consent-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/patient-portal-auth', () => ({ verifyPatientToken: jest.fn() }));
// The route guards with `result instanceof NextResponse` to tell an auth
// rejection from a decoded payload. The mock must therefore return real
// INSTANCES, or that check silently never matches and an unauthenticated
// request would appear to sail past the guard in tests while being correctly
// refused in production.
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json() { return this.body; }
    static json(body: unknown, init?: { status?: number }) {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

import type { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/telehealth/consent/route';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { createSession, getSessionById } from '@/lib/services/telehealth-service';
import { jubaDate } from '@/lib/time-juba';
import { teardownTestDBs } from '../helpers/test-db';

const mockVerify = verifyPatientToken as jest.Mock;

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; jest.clearAllMocks(); });

function req(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

async function makeSession(patientId = 'pat-001') {
  return createSession({
    patientId,
    patientName: 'John Doe',
    providerId: 'prov-001',
    providerName: 'Dr. Smith',
    providerRole: 'doctor',
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    sessionType: 'video',
    scheduledDate: jubaDate(),
    scheduledTime: '14:00',
    status: 'scheduled',
    chiefComplaint: 'Follow-up',
    followUpRequired: false,
    referralRequired: false,
    connectionDrops: 0,
    patientConsentGiven: false,
    sessionRecorded: false,
  } as Parameters<typeof createSession>[0]);
}

describe('POST /api/telehealth/consent', () => {
  test("records the patient's own consent as first-party", async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const res = await POST(req({ sessionId: s._id, consented: true }));
    expect(res.status).toBe(200);

    const after = await getSessionById(s._id);
    expect(after!.patientConsentGiven).toBe(true);
    // Provenance is what separates this from a clinician's attestation.
    expect(after!.consentMethod).toBe('patient_portal');
    expect(after!.consentAttestedBy).toBeUndefined();
    expect(after!.consentTimestamp).toBeTruthy();
  });

  test('passes through the 401 from an unauthenticated caller', async () => {
    const { NextResponse } = require('next/server');
    mockVerify.mockResolvedValue(
      NextResponse.json({ error: 'Missing authorization' }, { status: 401 }),
    );
    const res = await POST(req({ sessionId: 'tele-x', consented: true }));
    expect(res.status).toBe(401);
  });

  test("refuses a patient consenting on someone else's visit", async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-999' });

    const res = await POST(req({ sessionId: s._id, consented: true }));
    expect(res.status).toBe(403);
    expect((await getSessionById(s._id))!.patientConsentGiven).toBe(false);
  });

  test('refuses a request that does not affirmatively consent', async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    for (const body of [
      { sessionId: s._id },
      { sessionId: s._id, consented: false },
      { sessionId: s._id, consented: 'yes' },
    ]) {
      expect((await POST(req(body))).status).toBe(400);
    }
    expect((await getSessionById(s._id))!.patientConsentGiven).toBe(false);
  });

  test('404s on an unknown session rather than creating one', async () => {
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    expect((await POST(req({ sessionId: 'tele-nope', consented: true }))).status).toBe(404);
  });

  test('re-consenting keeps the original timestamp', async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    await POST(req({ sessionId: s._id, consented: true }));
    const first = (await getSessionById(s._id))!.consentTimestamp;

    await new Promise(r => setTimeout(r, 20));
    const second = await POST(req({ sessionId: s._id, consented: true }));

    // A refresh must not restamp the record: the trail should show when
    // consent was actually given, not when the page was last opened.
    expect((await second.json()).alreadyRecorded).toBe(true);
    expect((await getSessionById(s._id))!.consentTimestamp).toBe(first);
  });

  // ── Provenance and policy version (KAN-125) ──────────────────────────────
  test('names the patient and the policy version they agreed to', async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    await POST(req({ sessionId: s._id, consented: true }));

    const after = (await getSessionById(s._id))!;
    // Without these, the record proves a box was ticked but not by whom or to
    // what — which is the entire evidentiary value of a consent record.
    expect(after.consentedBy).toBe('pat-001');
    expect(after.consentPolicyVersion).toBeTruthy();
  });

  test('takes the policy version from the server, never from the request', async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    // A client claiming a version it likes must not be able to write it.
    await POST(req({ sessionId: s._id, consented: true, policyVersion: undefined }));

    const { getConsentPolicy } = require('@/lib/telehealth-consent-policy');
    const policy = await getConsentPolicy('hosp-001');
    expect((await getSessionById(s._id))!.consentPolicyVersion).toBe(policy.version);
  });

  test('refuses consent to a policy version the patient was not shown', async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    // The page displayed an older version, so the patient would be recorded as
    // agreeing to text they never read. Make them read the current one.
    const res = await POST(req({ sessionId: s._id, consented: true, policyVersion: '1999-01-01' }));
    expect(res.status).toBe(409);
    expect((await getSessionById(s._id))!.patientConsentGiven).toBe(false);
  });
});

describe('DELETE /api/telehealth/consent — withdrawal', () => {
  test('withdraws consent and records that it was withdrawn', async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    await POST(req({ sessionId: s._id, consented: true }));

    const res = await DELETE(req({ sessionId: s._id, reason: 'Prefers in person' }));
    expect(res.status).toBe(200);

    const after = (await getSessionById(s._id))!;
    expect(after.patientConsentGiven).toBe(false);
    expect(after.consentWithdrawnAt).toBeTruthy();
    expect(after.consentWithdrawnReason).toBe('Prefers in person');
  });

  test("refuses to withdraw another patient's consent", async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    await POST(req({ sessionId: s._id, consented: true }));

    mockVerify.mockResolvedValue({ sub: 'pat-999' });
    expect((await DELETE(req({ sessionId: s._id }))).status).toBe(403);
    expect((await getSessionById(s._id))!.patientConsentGiven).toBe(true);
  });

  test('passes through the 401 from an unauthenticated caller', async () => {
    const { NextResponse } = require('next/server');
    mockVerify.mockResolvedValue(NextResponse.json({ error: 'Missing authorization' }, { status: 401 }));
    expect((await DELETE(req({ sessionId: 'tele-x' }))).status).toBe(401);
  });

  test('refuses withdrawal once the visit is under way', async () => {
    // Ending a visit in progress is a different act with different
    // record-keeping — the patient leaves and the session terminates.
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    await POST(req({ sessionId: s._id, consented: true }));
    const { updateSessionStatus } = require('@/lib/services/telehealth-service');
    await updateSessionStatus(s._id, 'in_session');

    expect((await DELETE(req({ sessionId: s._id }))).status).toBe(409);
  });

  test('re-consenting after a withdrawal is allowed and clears it', async () => {
    const s = await makeSession('pat-001');
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    await POST(req({ sessionId: s._id, consented: true }));
    await DELETE(req({ sessionId: s._id }));

    // Not "already recorded" — a withdrawn consent must actually be given again.
    const again = await POST(req({ sessionId: s._id, consented: true }));
    expect((await again.json()).alreadyRecorded).toBe(false);

    const after = (await getSessionById(s._id))!;
    expect(after.patientConsentGiven).toBe(true);
    expect(after.consentWithdrawnAt).toBeUndefined();
  });

  test('400s a missing sessionId and 404s an unknown session', async () => {
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    expect((await DELETE(req({}))).status).toBe(400);
    expect((await DELETE(req({ sessionId: 'tele-nope' }))).status).toBe(404);
  });
});
