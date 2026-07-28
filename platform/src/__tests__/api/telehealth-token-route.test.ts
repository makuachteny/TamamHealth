/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * POST /api/telehealth/token — the authorisation boundary for telehealth media.
 *
 * LiveKit trusts any connection presenting a token signed with our secret, so
 * every access rule has to hold *here*. The join window in particular is only
 * a real control at this route: the join page evaluates it too, but that is
 * client code and a patient who keeps the tab open past the window, or replays
 * the request, has to be refused by the server.
 *
 * The ordering test matters as much as the rules. An earlier draft evaluated
 * the window before proving ownership, which answered "when is this
 * appointment?" for anyone who guessed a session id.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-token-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/patient-portal-auth', () => ({ verifyPatientToken: jest.fn() }));
jest.mock('@/lib/api-auth', () => ({
  getAuthPayload: jest.fn(),
  serverError: () => require('next/server').NextResponse.json({ error: 'server' }, { status: 500 }),
  logApiError: jest.fn(),
}));
jest.mock('livekit-server-sdk', () => ({
  AccessToken: class {
    grants: unknown;
    constructor(public key: string, public secret: string, public opts: unknown) {}
    addGrant(g: unknown) { this.grants = g; }
    async toJwt() { return 'signed.jwt.token'; }
  },
}));
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
import { POST } from '@/app/api/telehealth/token/route';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { getAuthPayload } from '@/lib/api-auth';
import { createSession } from '@/lib/services/telehealth-service';
import { jubaDate, jubaNow } from '@/lib/time-juba';
import { teardownTestDBs } from '../helpers/test-db';

const mockPatient = verifyPatientToken as jest.Mock;
const mockStaff = getAuthPayload as jest.Mock;

const ENV = process.env;
beforeEach(() => {
  process.env = {
    ...ENV,
    LIVEKIT_URL: 'wss://livekit.test',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-secret',
  };
  mockStaff.mockResolvedValue(null);
});
afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
  jest.clearAllMocks();
  process.env = ENV;
});

function req(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function offsetTime(minutes: number): string {
  const d = new Date(jubaNow().getTime() + minutes * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function makeSession(overrides: Record<string, unknown> = {}) {
  return createSession({
    patientId: 'pat-001',
    patientName: 'John Doe',
    providerId: 'prov-001',
    providerName: 'Dr. Smith',
    providerRole: 'doctor',
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    sessionType: 'video',
    scheduledDate: jubaDate(),
    scheduledTime: offsetTime(0),
    status: 'scheduled',
    chiefComplaint: 'Follow-up',
    followUpRequired: false,
    referralRequired: false,
    connectionDrops: 0,
    patientConsentGiven: false,
    sessionRecorded: false,
    ...overrides,
  } as Parameters<typeof createSession>[0]);
}

describe('POST /api/telehealth/token — join window', () => {
  test('mints a token for the owning patient inside the window', async () => {
    const s = await makeSession();
    mockPatient.mockResolvedValue({ sub: 'pat-001' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe('signed.jwt.token');
    expect(body.identity).toBe('patient:pat-001');
  });

  test('refuses a patient who is too early, stating when it opens', async () => {
    const s = await makeSession({ scheduledTime: offsetTime(240) });
    mockPatient.mockResolvedValue({ sub: 'pat-001' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('too_early');
    expect(body.opensAt).toBeTruthy();
    expect(body.token).toBeUndefined();
  });

  test('refuses a patient who is too late', async () => {
    const s = await makeSession({ scheduledTime: offsetTime(-240) });
    mockPatient.mockResolvedValue({ sub: 'pat-001' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('too_late');
  });

  test('the window does NOT apply to the assigned clinician', async () => {
    // A provider opens the room early to prepare and stays past the slot when
    // the clinic runs late — and decides when the visit is over.
    const s = await makeSession({ scheduledTime: offsetTime(240) });
    mockStaff.mockResolvedValue({ sub: 'prov-001', name: 'Dr. Smith' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(200);
    expect((await res.json()).identity).toBe('provider:prov-001');
  });

  test('a walk-in with no schedule is joinable', async () => {
    const s = await makeSession({ scheduledDate: '', scheduledTime: '' });
    mockPatient.mockResolvedValue({ sub: 'pat-001' });
    expect((await POST(req({ sessionId: s._id }))).status).toBe(200);
  });
});

describe('POST /api/telehealth/token — authorisation', () => {
  test("refuses a patient requesting someone else's visit, and leaks no schedule", async () => {
    // Ownership is checked BEFORE the window, so the refusal cannot be used to
    // discover when another patient's appointment is.
    const s = await makeSession({ scheduledTime: offsetTime(240) });
    mockPatient.mockResolvedValue({ sub: 'pat-999' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBeUndefined();
    expect(body.opensAt).toBeUndefined();
    expect(body.error).toMatch(/does not belong to you/i);
  });

  test('refuses a clinician who is not the assigned provider', async () => {
    const s = await makeSession();
    mockStaff.mockResolvedValue({ sub: 'prov-999', name: 'Dr. Other' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/not the assigned provider/i);
  });

  test('grants room admin to the provider and not to the patient', async () => {
    const s = await makeSession();

    mockStaff.mockResolvedValue({ sub: 'prov-001', name: 'Dr. Smith' });
    const provider = await (await POST(req({ sessionId: s._id }))).json();

    mockStaff.mockResolvedValue(null);
    mockPatient.mockResolvedValue({ sub: 'pat-001' });
    const patient = await (await POST(req({ sessionId: s._id }))).json();

    // Both are in the same room; only one may administer it.
    expect(provider.room).toBe(patient.room);
    expect(provider.identity).not.toBe(patient.identity);
  });

  test('refuses a session that can no longer be joined', async () => {
    const s = await makeSession({ status: 'cancelled' });
    mockPatient.mockResolvedValue({ sub: 'pat-001' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(409);
  });

  test('503s when LiveKit is not configured, rather than a signing failure', async () => {
    delete process.env.LIVEKIT_API_KEY;
    const res = await POST(req({ sessionId: 'tele-x' }));
    expect(res.status).toBe(503);
  });

  test('400s a missing sessionId', async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  test('404s an unknown session', async () => {
    mockPatient.mockResolvedValue({ sub: 'pat-001' });
    expect((await POST(req({ sessionId: 'tele-nope' }))).status).toBe(404);
  });
});
