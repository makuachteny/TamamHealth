/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * GET /api/telehealth/visit/[sessionId] — the patient's pre-visit summary.
 *
 * Two properties are load-bearing here and neither is obvious from reading the
 * happy path:
 *
 *  1. **Projection.** A TelehealthSessionDoc carries clinical notes, diagnosis,
 *     ICD codes, prescriptions and lab orders. This route must return an
 *     allow-list, not the document — result-release gating is a separate
 *     decision (KAN-105) and a pre-visit screen is not where it gets made.
 *
 *  2. **Ownership before anything else.** The response states when someone's
 *     appointment is. Leaking that to a caller who merely guessed a session id
 *     would turn an opaque id into an appointment lookup.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-visit-uuid` }));
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
import { GET } from '@/app/api/telehealth/visit/[sessionId]/route';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { createSession, updateSession } from '@/lib/services/telehealth-service';
import { jubaDate, jubaNow } from '@/lib/time-juba';
import { teardownTestDBs } from '../helpers/test-db';

const mockVerify = verifyPatientToken as jest.Mock;

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; jest.clearAllMocks(); });

const req = {} as unknown as NextRequest;
const ctx = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

/** "HH:MM" a given number of minutes from the current Juba wall-clock. */
function offsetTime(minutes: number): string {
  const d = new Date(jubaNow().getTime() + minutes * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function offsetSchedule(minutes: number): { scheduledDate: string; scheduledTime: string } {
  // d's LOCAL fields carry Juba wall-clock (it derives from jubaNow), so the
  // date must come from those same fields. jubaDate() expects a true instant
  // and would shift the calendar day a second time.
  const d = new Date(jubaNow().getTime() + minutes * 60_000);
  const scheduledDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { scheduledDate, scheduledTime: offsetTime(minutes) };
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

describe('GET /api/telehealth/visit/[sessionId]', () => {
  test('returns the pre-visit summary for the session owner', async () => {
    const s = await makeSession();
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const res = await GET(req, ctx(s._id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providerName).toBe('Dr. Smith');
    expect(body.facilityName).toBe('TamamHealth Hospital');
    expect(body.chiefComplaint).toBe('Follow-up');
    expect(body.joinWindow.open).toBe(true);
  });

  test('never returns clinical content from the session document', async () => {
    const s = await makeSession();
    await updateSession(s._id, {
      clinicalNotes: 'Patient reports worsening chest pain',
      diagnosis: 'Angina',
      icd10Code: 'I20.9',
      prescriptionsIssued: ['rx-001'],
      labOrdersIssued: ['lab-001'],
    });
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const body = await (await GET(req, ctx(s._id))).json();
    for (const leaked of ['clinicalNotes', 'diagnosis', 'icd10Code', 'prescriptionsIssued', 'labOrdersIssued']) {
      expect(body).not.toHaveProperty(leaked);
    }
    expect(JSON.stringify(body)).not.toContain('chest pain');
  });

  test("refuses another patient's visit without disclosing its schedule", async () => {
    const s = await makeSession();
    mockVerify.mockResolvedValue({ sub: 'pat-999' });

    const res = await GET(req, ctx(s._id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).not.toHaveProperty('scheduledTime');
    expect(body).not.toHaveProperty('providerName');
  });

  test('passes through the 401 from an unauthenticated caller', async () => {
    const { NextResponse } = require('next/server');
    mockVerify.mockResolvedValue(NextResponse.json({ error: 'Missing authorization' }, { status: 401 }));
    expect((await GET(req, ctx('tele-x'))).status).toBe(401);
  });

  test('404s an unknown session', async () => {
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    expect((await GET(req, ctx('tele-does-not-exist'))).status).toBe(404);
  });

  test('reports a too-early visit as closed, with the time it opens', async () => {
    const s = await makeSession(offsetSchedule(240));
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const body = await (await GET(req, ctx(s._id))).json();
    expect(body.joinWindow.open).toBe(false);
    expect(body.joinWindow.reason).toBe('too_early');
    expect(body.joinWindow.opensAt).toBeTruthy();
    expect(body.joinWindow.message).toMatch(/can join from/i);
  });

  test('reports a long-past visit as closed', async () => {
    const s = await makeSession(offsetSchedule(-240));
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const body = await (await GET(req, ctx(s._id))).json();
    expect(body.joinWindow.open).toBe(false);
    expect(body.joinWindow.reason).toBe('too_late');
  });

  test('surfaces existing consent so a rejoining patient is not asked twice', async () => {
    const s = await makeSession();
    await updateSession(s._id, {
      patientConsentGiven: true,
      consentMethod: 'patient_portal',
    } as Parameters<typeof updateSession>[1]);
    mockVerify.mockResolvedValue({ sub: 'pat-001' });

    const body = await (await GET(req, ctx(s._id))).json();
    expect(body.consentGiven).toBe(true);
    expect(body.consentMethod).toBe('patient_portal');
  });

  test('400s a missing session id', async () => {
    mockVerify.mockResolvedValue({ sub: 'pat-001' });
    expect((await GET(req, ctx(''))).status).toBe(400);
  });
});
