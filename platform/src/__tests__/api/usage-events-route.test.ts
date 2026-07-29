/* eslint-disable @typescript-eslint/no-require-imports */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-usage-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/api-auth', () => ({
  getAuthPayload: jest.fn(),
  unauthorized: () => ({ status: 401, json: async () => ({ error: 'Unauthorized' }) }),
  forbidden: () => ({ status: 403, json: async () => ({ error: 'Forbidden' }) }),
  hasRole: (auth: { role: string }, roles: string[]) => roles.includes(auth.role),
  logApiError: jest.fn(),
  serverError: () => ({ status: 500, json: async () => ({ error: 'Server error' }) }),
}));
jest.mock('next/server', () => ({
  NextResponse: class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return {
        status: init?.status ?? 200,
        json: async () => body,
      };
    }
  },
}));

import type { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/usage/events/route';
import { GET as GET_SUMMARY } from '@/app/api/usage/summary/route';
import { getAuthPayload } from '@/lib/api-auth';
import { usageEventsDB } from '@/lib/db';
import { teardownTestDBs } from '../helpers/test-db';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
  jest.clearAllMocks();
});

function mockAuth(overrides: Record<string, unknown> = {}) {
  (getAuthPayload as jest.Mock).mockResolvedValue({
    sub: 'user-doctor',
    username: 'doctor1',
    role: 'doctor',
    name: 'Dr Test',
    orgId: 'org-a',
    hospitalId: 'hosp-1',
    ...overrides,
  });
}

describe('usage events API', () => {
  test('POST returns 401 when unauthenticated', async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue(null);
    const req = { json: async () => ({ events: [] }) } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('POST stamps JWT identity and ignores client userId/orgId', async () => {
    mockAuth({ sub: 'real-user', username: 'real', role: 'nurse', orgId: 'org-real' });
    const req = {
      json: async () => ({
        events: [
          {
            eventName: 'click',
            path: '/patients/secret-id-999999',
            sessionId: 'sess-1',
            ts: '2026-07-29T10:00:00.000Z',
            userId: 'spoofed',
            orgId: 'spoofed-org',
            element: 'patient.create',
          },
        ],
      }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(1);

    const rows = await usageEventsDB().allDocs({ include_docs: true });
    const doc = rows.rows[0].doc as unknown as {
      userId: string;
      orgId: string;
      path: string;
      type: string;
    };
    expect(doc.type).toBe('usage_event');
    expect(doc.userId).toBe('real-user');
    expect(doc.orgId).toBe('org-real');
    expect(doc.path).toBe('/patients/[id]');
  });

  test('GET forbids org_admin from reading another org', async () => {
    mockAuth({ role: 'org_admin', orgId: 'org-a', sub: 'admin-a' });
    const req = {
      url: 'http://localhost/api/usage/events?orgId=org-b',
    } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  test('GET summary scopes org_admin to own org', async () => {
    mockAuth({ role: 'org_admin', orgId: 'org-a', sub: 'admin-a', username: 'oa' });

    // Seed an event in org-a via POST as a doctor in org-a
    mockAuth({ role: 'doctor', orgId: 'org-a', sub: 'doc-a', username: 'doc' });
    await POST({
      json: async () => ({
        events: [{
          eventName: 'page_view',
          path: '/dashboard',
          sessionId: 's1',
          ts: new Date().toISOString(),
        }],
      }),
    } as unknown as NextRequest);

    mockAuth({ role: 'org_admin', orgId: 'org-a', sub: 'admin-a', username: 'oa' });
    const res = await GET_SUMMARY({
      url: 'http://localhost/api/usage/summary?days=7',
    } as unknown as NextRequest);
    expect(res.status).toBe(200);
    const summary = await res.json();
    expect(summary.eventCount).toBeGreaterThanOrEqual(1);
  });
});
