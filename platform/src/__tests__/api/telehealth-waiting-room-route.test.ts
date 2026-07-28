/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * POST /api/telehealth/waiting-room — the patient announces they have arrived.
 *
 * This route is the only way into `waiting_room`, which is what gives that
 * state its meaning. If a caller who is not the patient can reach it, the
 * clinician's queue goes back to showing people who are not there.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-wr-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/patient-portal-auth', () => ({ verifyPatientToken: jest.fn() }));
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
import { POST } from '@/app/api/telehealth/waiting-room/route';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { createSession, getSessionById } from '@/lib/services/telehealth-service';
import { jubaDate } from '@/lib/time-juba';
import { teardownTestDBs } from '../helpers/test-db';

const mockVerify = verifyPatientToken as jest.Mock;

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; jest.clearAllMocks(); });

function req(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

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

describe('POST /api/telehealth/waiting-room', () => {
  test('puts the session into waiting_room with an arrival time', async () => {
    const s = await makeSession();
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const res = await POST(req({ sessionId: s._id }));
    expect(res.status).toBe(200);
    expect((await res.json()).waitingSince).toBeTruthy();

    const after = (await getSessionById(s._id))!;
    expect(after.status).toBe('waiting_room');
    expect(after.waitingSince).toBeTruthy();
  });

  test("refuses another patient's visit", async () => {
    const s = await makeSession();
    mockVerify.mockResolvedValue({ sub: 'pat-999' });

    expect((await POST(req({ sessionId: s._id }))).status).toBe(403);
    // And crucially, no phantom arrival was recorded.
    expect((await getSessionById(s._id))!.waitingSince).toBeUndefined();
  });

  test('passes through the 401 from an unauthenticated caller', async () => {
    const { NextResponse } = require('next/server');
    mockVerify.mockResolvedValue(NextResponse.json({ error: 'Missing authorization' }, { status: 401 }));
    expect((await POST(req({ sessionId: 'tele-x' }))).status).toBe(401);
  });

  test.each(['completed', 'cancelled', 'no_show', 'failed'])(
    'refuses a %s visit rather than reopening it',
    async (status) => {
      // Otherwise an old link would put a dealt-with visit back in the queue.
      const s = await makeSession({ status });
      mockVerify.mockResolvedValue({ sub: 'pat-001' });

      const res = await POST(req({ sessionId: s._id }));
      expect(res.status).toBe(409);
      expect((await getSessionById(s._id))!.status).toBe(status);
    },
  );

  test('is idempotent — a reload keeps the original arrival time', async () => {
    const s = await makeSession();
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const first = await (await POST(req({ sessionId: s._id }))).json();
    await new Promise(r => setTimeout(r, 20));
    const second = await (await POST(req({ sessionId: s._id }))).json();

    expect(second.waitingSince).toBe(first.waitingSince);
  });

  test('400s a missing sessionId and 404s an unknown session', async () => {
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ sessionId: 'tele-nope' }))).status).toBe(404);
  });
});
