/* eslint-disable @typescript-eslint/no-require-imports */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-portal-payment-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/patient-portal-auth', () => ({
  verifyPatientToken: jest.fn(),
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
import { POST } from '@/app/api/patient-portal/payments/route';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { paymentsDB, syncEventsDB } from '@/lib/db';
import { teardownTestDBs } from '../helpers/test-db';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
  jest.clearAllMocks();
});

describe('patient portal payments route', () => {
  test('records patient payment submissions as pending and emits a sync event', async () => {
    (verifyPatientToken as jest.Mock).mockResolvedValue({
      sub: 'pat-001',
      name: 'Akol Deng',
      hospitalNumber: 'JTH-0001',
      role: 'patient',
    });

    const req = {
      json: async () => ({
        amount: 7500,
        currency: 'SSP',
        method: 'mobile_money',
        reference: 'MM-123',
        facilityId: 'hosp-001',
        notes: 'Paid through patient portal',
      }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    const saved = await paymentsDB().get(body.id) as { status: string; patientId: string; amount: number; notes: string };
    expect(saved.status).toBe('pending');
    expect(saved.patientId).toBe('pat-001');
    expect(saved.amount).toBe(7500);
    expect(saved.notes).toContain('pending_verification');

    const syncRows = await syncEventsDB().allDocs({ include_docs: true });
    const syncDoc = syncRows.rows[0].doc as unknown as {
      type: string;
      resourceType: string;
      resourceId: string;
      syncStatus: string;
      hospitalId: string;
    };
    expect(syncDoc.type).toBe('sync_event');
    expect(syncDoc.resourceType).toBe('payment');
    expect(syncDoc.resourceId).toBe(body.id);
    expect(syncDoc.hospitalId).toBe('hosp-001');
    expect(syncDoc.syncStatus).toBe('pending');
  });
});
