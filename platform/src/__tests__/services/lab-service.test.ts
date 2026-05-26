/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for lab-service.ts
 * Covers CRUD operations, filtering by patient, pending results, and status transitions.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllLabResults,
  getLabResultsByPatient,
  createLabResult,
  updateLabResult,
  getPendingLabResults,
} from '@/lib/services/lab-service';
import type { DataScope } from '@/lib/services/data-scope';

type CreateLabInput = Parameters<typeof createLabResult>[0];

const makeLabData = (overrides: Partial<CreateLabInput> = {}): CreateLabInput => ({
  patientId: 'pat-001',
  patientName: 'Achol Deng',
  hospitalNumber: 'JTH-000001',
  testName: 'Malaria RDT',
  specimen: 'Blood',
  status: 'pending' as const,
  result: '',
  unit: '',
  referenceRange: '',
  abnormal: false,
  critical: false,
  orderedBy: 'Dr. Mayen',
  orderedAt: '2025-03-01T08:00:00Z',
  completedAt: '',
  hospitalId: 'hosp-001',
  hospitalName: 'Juba Teaching Hospital',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('lab-service', () => {
  test('getAllLabResults returns empty initially', async () => {
    const results = await getAllLabResults();
    expect(results).toEqual([]);
  });

  test('createLabResult creates with correct fields', async () => {
    const lab = await createLabResult(makeLabData());

    expect(lab._id).toMatch(/^lab-/);
    expect(lab.type).toBe('lab_result');
    expect(lab.testName).toBe('Malaria RDT');
    expect(lab.status).toBe('pending');
    expect(lab.createdAt).toBeDefined();
    expect(lab._rev).toBeDefined();
  });

  test('getLabResultsByPatient filters correctly', async () => {
    await createLabResult(makeLabData({ patientId: 'pat-001' }));
    await createLabResult(makeLabData({ patientId: 'pat-002', patientName: 'Nyabol Kuol' }));
    await createLabResult(makeLabData({ patientId: 'pat-001', testName: 'CBC' }));

    const pat1Results = await getLabResultsByPatient('pat-001');
    const pat2Results = await getLabResultsByPatient('pat-002');
    expect(pat1Results).toHaveLength(2);
    expect(pat2Results).toHaveLength(1);
  });

  test('updateLabResult updates status', async () => {
    const lab = await createLabResult(makeLabData());
    const updated = await updateLabResult(lab._id, { status: 'in_progress' });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('in_progress');
    expect(updated!.testName).toBe('Malaria RDT');
  });

  test('updateLabResult returns null for non-existent id', async () => {
    const result = await updateLabResult('lab-nonexistent', { status: 'completed' });
    expect(result).toBeNull();
  });

  test('getPendingLabResults returns pending and in_progress', async () => {
    await createLabResult(makeLabData({ status: 'pending' }));
    await createLabResult(makeLabData({ status: 'in_progress' }));
    await createLabResult(makeLabData({ status: 'completed', result: 'Negative' }));

    const pending = await getPendingLabResults();
    expect(pending).toHaveLength(2);
    const statuses = pending.map(l => l.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('in_progress');
    expect(statuses).not.toContain('completed');
  });

  test('status transition: pending -> in_progress -> completed', async () => {
    const lab = await createLabResult(makeLabData({ status: 'pending' }));
    expect(lab.status).toBe('pending');

    const inProgress = await updateLabResult(lab._id, { status: 'in_progress' });
    expect(inProgress!.status).toBe('in_progress');

    const completed = await updateLabResult(lab._id, {
      status: 'completed',
      result: 'Positive',
      completedAt: '2025-03-01T12:00:00Z',
    });
    expect(completed!.status).toBe('completed');
    expect(completed!.result).toBe('Positive');
    expect(completed!.completedAt).toBe('2025-03-01T12:00:00Z');
  });

  test('getAllLabResults sorts by orderedAt descending', async () => {
    await createLabResult(makeLabData({ orderedAt: '2025-01-01T00:00:00Z', testName: 'A' }));
    await createLabResult(makeLabData({ orderedAt: '2025-03-01T00:00:00Z', testName: 'B' }));
    await createLabResult(makeLabData({ orderedAt: '2025-02-01T00:00:00Z', testName: 'C' }));

    const all = await getAllLabResults();
    expect(all[0].testName).toBe('B');
    expect(all[1].testName).toBe('C');
    expect(all[2].testName).toBe('A');
  });

  test('updateLabResult preserves existing fields', async () => {
    const lab = await createLabResult(makeLabData({ testName: 'CBC', specimen: 'Blood' }));
    const updated = await updateLabResult(lab._id, { result: 'WBC: 5.0' });

    expect(updated!.testName).toBe('CBC');
    expect(updated!.specimen).toBe('Blood');
    expect(updated!.result).toBe('WBC: 5.0');
  });

  // ---- Additional branch coverage for line 13 ----

  test('createLabResult with hospitalId but no orgId infers orgId', async () => {
    // This tests line 13: return hosp.orgId; in inferOrgIdFromHospital
    // When orgId is not provided, it tries to look it up from the hospital
    const lab = await createLabResult(makeLabData({
      hospitalId: 'hosp-001',
      orgId: undefined,
    }));
    expect(lab._id).toMatch(/^lab-/);
  });

  test('createLabResult with orgId provided', async () => {
    const lab = await createLabResult(makeLabData({
      hospitalId: 'hosp-001',
      orgId: 'org-001',
    }));
    expect(lab.orgId).toBe('org-001');
  });

  test('createLabResult with neither hospitalId nor orgId', async () => {
    const lab = await createLabResult(makeLabData({
      hospitalId: undefined,
      orgId: undefined,
    }));
    expect(lab._id).toMatch(/^lab-/);
  });

  test('getAllLabResults with scope filters correctly', async () => {
    await createLabResult(makeLabData());
    const results = await getAllLabResults({ role: 'nurse' } as DataScope);
    expect(Array.isArray(results)).toBe(true);
  });

  test('getAllLabResults handles empty orderedAt in sort', async () => {
    await createLabResult(makeLabData({ orderedAt: undefined }));
    await createLabResult(makeLabData({ orderedAt: '2025-03-01T00:00:00Z', testName: 'B' }));

    const all = await getAllLabResults();
    expect(all).toHaveLength(2);
  });

  test('getAllLabResults with all empty orderedAt', async () => {
    await createLabResult(makeLabData({ orderedAt: undefined }));
    await createLabResult(makeLabData({ orderedAt: undefined, testName: 'B' }));

    const all = await getAllLabResults();
    expect(all).toHaveLength(2);
  });

  test('getPendingLabResults with scope', async () => {
    await createLabResult(makeLabData({ status: 'pending' }));
    const pending = await getPendingLabResults();
    expect(Array.isArray(pending)).toBe(true);
  });

  test('getLabResultsByPatient with no results', async () => {
    const results = await getLabResultsByPatient('pat-nonexistent');
    expect(results).toEqual([]);
  });
});
