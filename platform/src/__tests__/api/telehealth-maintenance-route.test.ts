/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * POST /api/telehealth/maintenance — the scheduled caller for the telehealth
 * reconciliation sweep (KAN-127/128/143/144).
 *
 * The sweep logic itself is covered by telehealth-reconciliation.test.ts;
 * these tests cover the boundary this route owns: machine-secret auth in
 * constant time, admin-only manual runs, asOf validation, and a PHI-free
 * response shape.
 */

jest.mock('@/lib/api-auth', () => ({
  getAuthPayload: jest.fn(),
  hasRole: (auth: { role?: string }, roles: string[]) => !!auth?.role && roles.includes(auth.role),
  unauthorized: () => require('next/server').NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
  forbidden: (msg?: string) => require('next/server').NextResponse.json({ error: msg || 'forbidden' }, { status: 403 }),
  serverError: () => require('next/server').NextResponse.json({ error: 'server' }, { status: 500 }),
  logApiError: jest.fn(),
}));
jest.mock('@/lib/audit/with-audit', () => ({
  withAuditLog: (handler: unknown) => handler,
}));
jest.mock('@/lib/services/appointment-service', () => ({
  getAllAppointments: jest.fn(async () => []),
}));
jest.mock('@/lib/services/telehealth-reconciliation', () => ({
  reconcileTelehealth: jest.fn(async () => ({
    scannedSessions: 3,
    scannedAppointments: 2,
    findings: [
      { kind: 'abandoned_session', sessionId: 'tele-1', detail: 'x', repaired: true },
      { kind: 'status_divergence', sessionId: 'tele-2', appointmentId: 'appt-2', detail: 'y', repaired: false },
    ],
    repaired: 1,
  })),
}));
jest.mock('@/lib/services/audit-service', () => ({
  logAuditSafe: jest.fn(async () => undefined),
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
import { POST } from '@/app/api/telehealth/maintenance/route';
import { getAuthPayload } from '@/lib/api-auth';
import { reconcileTelehealth } from '@/lib/services/telehealth-reconciliation';

const mockAuth = getAuthPayload as jest.Mock;
const mockReconcile = reconcileTelehealth as jest.Mock;

const SECRET = 'test-maintenance-secret';
const ENV = process.env;

function req(headers: Record<string, string> = {}, url = 'http://localhost/api/telehealth/maintenance') {
  return {
    method: 'POST',
    url,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

beforeEach(() => {
  process.env = { ...ENV, TELEHEALTH_MAINTENANCE_SECRET: SECRET };
  mockAuth.mockResolvedValue(null);
});
afterEach(() => {
  jest.clearAllMocks();
  process.env = ENV;
});

describe('POST /api/telehealth/maintenance — authorization', () => {
  test('refuses with no secret and no session', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  test('refuses a wrong secret', async () => {
    const res = await POST(req({ 'x-telehealth-maintenance-secret': 'wrong' }));
    expect(res.status).toBe(401);
  });

  test('an unset server secret means no machine access, not open access', async () => {
    delete process.env.TELEHEALTH_MAINTENANCE_SECRET;
    const res = await POST(req({ 'x-telehealth-maintenance-secret': SECRET }));
    expect(res.status).toBe(401);
  });

  test('refuses a signed-in non-admin', async () => {
    mockAuth.mockResolvedValue({ sub: 'u1', role: 'nurse' });
    const res = await POST(req());
    expect(res.status).toBe(403);
  });

  test('allows a signed-in administrator', async () => {
    mockAuth.mockResolvedValue({ sub: 'u1', role: 'org_admin' });
    const res = await POST(req());
    expect(res.status).toBe(200);
  });
});

describe('POST /api/telehealth/maintenance — sweep', () => {
  test('runs the sweep with the correct secret and reports counts, not PHI', async () => {
    const res = await POST(req({ 'x-telehealth-maintenance-secret': SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.scannedSessions).toBe(3);
    expect(body.findingCount).toBe(2);
    expect(body.repaired).toBe(1);
    expect(body.byKind).toEqual({ abandoned_session: 1, status_divergence: 1 });
    // Findings carry ids and kinds only — the free-text detail stays server-side.
    expect(body.findings[0]).toEqual({ kind: 'abandoned_session', sessionId: 'tele-1', appointmentId: undefined, repaired: true });
    expect(JSON.stringify(body)).not.toContain('detail');
  });

  test('honours a valid asOf replay timestamp', async () => {
    const asOf = '2026-07-01T10:00:00.000Z';
    const res = await POST(req(
      { 'x-telehealth-maintenance-secret': SECRET },
      `http://localhost/api/telehealth/maintenance?asOf=${encodeURIComponent(asOf)}`,
    ));
    expect(res.status).toBe(200);
    expect((await res.json()).sweptAt).toBe(asOf);
    expect(mockReconcile).toHaveBeenCalledWith(expect.anything(), { now: new Date(asOf).getTime(), repair: true });
  });

  test('rejects an unparseable asOf rather than treating it as now', async () => {
    const res = await POST(req(
      { 'x-telehealth-maintenance-secret': SECRET },
      'http://localhost/api/telehealth/maintenance?asOf=not-a-date',
    ));
    expect(res.status).toBe(400);
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
