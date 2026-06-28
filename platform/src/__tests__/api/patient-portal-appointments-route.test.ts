/* eslint-disable @typescript-eslint/no-require-imports */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-portal-appt-uuid` }));
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
import { POST } from '@/app/api/patient-portal/appointments/route';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { appointmentsDB, syncEventsDB } from '@/lib/db';
import { teardownTestDBs } from '../helpers/test-db';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
  jest.clearAllMocks();
});

describe('patient portal appointments route', () => {
  test('records patient appointment requests and emits a sync event', async () => {
    (verifyPatientToken as jest.Mock).mockResolvedValue({
      sub: 'pat-001',
      name: 'Akol Deng',
      hospitalNumber: 'JTH-0001',
      role: 'patient',
    });

    const req = {
      json: async () => ({
        providerId: 'dr-001',
        providerName: 'Dr. Kuol',
        facilityId: 'hosp-001',
        facilityName: 'Juba Teaching Hospital',
        appointmentDate: '2026-07-01',
        appointmentTime: '09:30',
        reason: 'Follow-up',
      }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.appointment.status).toBe('requested');

    const saved = await appointmentsDB().get(body.id) as { status: string; patientId: string };
    expect(saved.status).toBe('requested');
    expect(saved.patientId).toBe('pat-001');

    const syncRows = await syncEventsDB().allDocs({ include_docs: true });
    const syncDoc = syncRows.rows[0].doc as unknown as { type: string; resourceType: string; resourceId: string; syncStatus: string };
    expect(syncDoc.type).toBe('sync_event');
    expect(syncDoc.resourceType).toBe('appointment');
    expect(syncDoc.resourceId).toBe(body.id);
    expect(syncDoc.syncStatus).toBe('pending');
  });
});
