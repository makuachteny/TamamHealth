/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Resource-level authorization on /api/telehealth (KAN-138).
 *
 * The defect: every action checked `hasRole(...)` plus org/facility scope and
 * nothing else. Scope answers "may this user see this facility's data"; it
 * never answered "is this user a participant in this visit". So any nurse in
 * the facility could write clinical notes into any clinician's consultation.
 *
 * Note this route has NO caller inside the app — the UI is local-first over
 * PouchDB. It is a pure external surface, which is precisely why its own
 * checks have to hold: nothing upstream is filtering for it.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-authz-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/api-auth', () => {
  const actual = jest.requireActual('@/lib/api-auth');
  return { ...actual, getAuthPayload: jest.fn() };
});
jest.mock('@/lib/audit/with-audit', () => ({
  withAuditLog: (h: unknown) => h,
}));
// Same mock the other telehealth route tests use. The route and api-auth both
// build responses with NextResponse, and `resolveSession` returns them as
// sentinels checked with `instanceof` — so the class has to be one shared
// implementation, which a module mock guarantees.
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
import { POST } from '@/app/api/telehealth/route';
import { getAuthPayload } from '@/lib/api-auth';
import { createSession, getSessionById, recordConsent } from '@/lib/services/telehealth-service';
import { jubaDate } from '@/lib/time-juba';
import { teardownTestDBs } from '../helpers/test-db';

const mockAuth = getAuthPayload as jest.Mock;

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; jest.clearAllMocks(); });

function req(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

/** The assigned clinician. */
const PROVIDER = {
  sub: 'prov-001', username: 'dr.smith', role: 'doctor',
  orgId: 'org-001', hospitalId: 'hosp-001',
};
/** A different clinician at the same facility — in scope, not a participant. */
const OTHER_PROVIDER = {
  sub: 'prov-999', username: 'dr.other', role: 'doctor',
  orgId: 'org-001', hospitalId: 'hosp-001',
};
/** A nurse at the same facility. Passes WRITE_ROLES and passes scope. */
const NURSE = {
  sub: 'nurse-001', username: 'nurse.ann', role: 'nurse',
  orgId: 'org-001', hospitalId: 'hosp-001',
};
const ADMIN = {
  sub: 'admin-001', username: 'org.admin', role: 'org_admin',
  orgId: 'org-001', hospitalId: 'hosp-001',
};

async function makeSession() {
  return createSession({
    patientId: 'pat-001',
    patientName: 'John Doe',
    providerId: 'prov-001',
    providerName: 'Dr. Smith',
    providerRole: 'doctor',
    facilityId: 'hosp-001',
    facilityName: 'Test Hospital',
    orgId: 'org-001',
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
  } as Parameters<typeof createSession>[0]);
}

describe('clinical acts require the assigned provider', () => {
  test('the assigned provider may write clinical notes', async () => {
    const s = await makeSession();
    mockAuth.mockResolvedValue(PROVIDER);

    const res = await POST(req({
      action: 'add_clinical_notes', sessionId: s._id, notes: 'Reviewed symptoms.',
    }));
    expect(res.status).toBe(200);
  });

  test('another clinician at the same facility may NOT write notes', async () => {
    // In scope, correct role — and still not this consultation's clinician.
    const s = await makeSession();
    mockAuth.mockResolvedValue(OTHER_PROVIDER);

    const res = await POST(req({
      action: 'add_clinical_notes', sessionId: s._id, notes: 'Injected note.',
    }));
    expect(res.status).toBe(403);
    expect((await getSessionById(s._id))!.clinicalNotes).toBeUndefined();
  });

  test('a nurse at the same facility may NOT write notes', async () => {
    const s = await makeSession();
    mockAuth.mockResolvedValue(NURSE);

    expect((await POST(req({
      action: 'add_clinical_notes', sessionId: s._id, notes: 'Injected note.',
    }))).status).toBe(403);
  });

  test('an org admin may NOT write notes either', async () => {
    // Administrative power is not clinical authorship.
    const s = await makeSession();
    mockAuth.mockResolvedValue(ADMIN);

    expect((await POST(req({
      action: 'add_clinical_notes', sessionId: s._id, notes: 'Injected note.',
    }))).status).toBe(403);
  });

  test('a non-participant may NOT rate the session', async () => {
    const s = await makeSession();
    mockAuth.mockResolvedValue(OTHER_PROVIDER);

    expect((await POST(req({
      action: 'rate_session', sessionId: s._id, rating: 5,
    }))).status).toBe(403);
  });
});

describe('administrative acts', () => {
  test('an org admin may cancel a visit they are not assigned to', async () => {
    const s = await makeSession();
    mockAuth.mockResolvedValue(ADMIN);

    const res = await POST(req({
      action: 'update_status', sessionId: s._id, status: 'cancelled',
    }));
    expect(res.status).toBe(200);
    expect((await getSessionById(s._id))!.status).toBe('cancelled');
  });

  test('an unassigned clinician may NOT change status', async () => {
    const s = await makeSession();
    mockAuth.mockResolvedValue(OTHER_PROVIDER);

    expect((await POST(req({
      action: 'update_status', sessionId: s._id, status: 'cancelled',
    }))).status).toBe(403);
    expect((await getSessionById(s._id))!.status).toBe('waiting_room');
  });

  test('a status update cannot smuggle consent through `extra`', async () => {
    // The gate this routes around would otherwise be every consent rule at once.
    const s = await makeSession();
    mockAuth.mockResolvedValue(PROVIDER);

    const res = await POST(req({
      action: 'update_status',
      sessionId: s._id,
      status: 'in_session',
      extra: { patientConsentGiven: true, consentMethod: 'patient_portal' },
    }));

    // Stripped, so the consent gate still fires and refuses admission.
    expect(res.status).toBe(409);
    const after = (await getSessionById(s._id))!;
    expect(after.patientConsentGiven).toBe(false);
    expect(after.status).toBe('waiting_room');
  });

  test('with real consent the same call succeeds', async () => {
    const s = await makeSession();
    await recordConsent(s._id, { method: 'patient_portal', consentedBy: 'pat-001' });
    mockAuth.mockResolvedValue(PROVIDER);

    const res = await POST(req({
      action: 'update_status', sessionId: s._id, status: 'in_session',
    }));
    expect(res.status).toBe(200);
  });
});

describe('session creation', () => {
  const CREATE = {
    patientId: 'pat-001',
    providerId: 'prov-001',
    scheduledDate: jubaDate(),
    scheduledTime: '10:00',
  };

  test('refuses a body that claims the patient already consented', async () => {
    // This is the API-side twin of the fabricated-consent record KAN-125
    // removed from the UI. A 400, not a silent drop: a caller sending this
    // believes they are recording consent.
    mockAuth.mockResolvedValue(PROVIDER);

    const res = await POST(req({ ...CREATE, patientConsentGiven: true }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/patientConsentGiven cannot be set/i);
  });

  test('refuses an unknown provider id rather than booking against nobody', async () => {
    mockAuth.mockResolvedValue(PROVIDER);
    const res = await POST(req({ ...CREATE, providerId: 'prov-does-not-exist' }));
    expect(res.status).toBe(404);
  });
});

describe('unknown sessions and unauthenticated callers', () => {
  test('401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(req({ action: 'update_status', sessionId: 'x', status: 'cancelled' }))).status).toBe(401);
  });

  test('403 for a role outside WRITE_ROLES', async () => {
    mockAuth.mockResolvedValue({ ...NURSE, role: 'cashier' });
    expect((await POST(req({ action: 'update_status', sessionId: 'x', status: 'cancelled' }))).status).toBe(403);
  });

  test('404 for a session that does not exist', async () => {
    mockAuth.mockResolvedValue(PROVIDER);
    expect((await POST(req({
      action: 'update_status', sessionId: 'tele-nope', status: 'cancelled',
    }))).status).toBe(404);
  });
});
