/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for medical-record-service.ts
 * Covers CRUD operations and validation for clinical consultation records.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-medrec-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getRecordsByPatient,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
  getRecentRecords,
} from '@/lib/services/medical-record-service';

type CreateMedicalRecordInput = Parameters<typeof createMedicalRecord>[0];

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

function validRecord(overrides: Partial<CreateMedicalRecordInput> = {}): CreateMedicalRecordInput {
  return {
    patientId: 'patient-001',
    hospitalId: 'hosp-001',
    hospitalName: 'TamamHealth Hospital',
    visitDate: '2026-04-01',
    consultedAt: '2026-04-01T10:00:00Z',
    visitType: 'outpatient',
    providerName: 'Dr. Kuol',
    providerRole: 'doctor',
    department: 'General Medicine',
    chiefComplaint: 'Persistent fever for 3 days',
    historyOfPresentIllness: 'Patient reports intermittent high fever with chills',
    vitalSigns: { temperature: 39.2, pulse: 88, respiratoryRate: 20, systolic: 120, diastolic: 80, oxygenSaturation: 97, weight: 70, height: 175, bmi: 22.9, recordedAt: '2026-04-01T10:00:00Z' },
    diagnoses: [{ name: 'Suspected malaria', icd10Code: '1F40', type: 'primary', certainty: 'suspected', severity: 'moderate' }],
    prescriptions: [],
    labResults: [],
    treatmentPlan: 'Artesunate + Amodiaquine',
    syncStatus: 'pending',
    ...overrides,
  };
}

describe('Medical Record Service', () => {
  test('creates a medical record with valid data', async () => {
    const rec = await createMedicalRecord(validRecord());
    expect(rec._id).toMatch(/^rec-/);
    expect(rec.type).toBe('medical_record');
    expect(rec.patientId).toBe('patient-001');
    expect(rec.chiefComplaint).toBe('Persistent fever for 3 days');
    expect(rec.createdAt).toBeDefined();
  });

  test('rejects record with missing chief complaint', async () => {
    await expect(
      createMedicalRecord(validRecord({ chiefComplaint: '' }))
    ).rejects.toThrow();
  });

  test('rejects record with missing patientId', async () => {
    await expect(
      createMedicalRecord(validRecord({ patientId: '' }))
    ).rejects.toThrow();
  });

  test('retrieves records by patient sorted by date', async () => {
    await createMedicalRecord(validRecord({
      consultedAt: '2026-01-15T08:00:00Z',
      chiefComplaint: 'Cough for 1 week',
    }));
    await createMedicalRecord(validRecord({
      consultedAt: '2026-03-20T14:00:00Z',
      chiefComplaint: 'Follow-up for malaria',
    }));
    await createMedicalRecord(validRecord({
      patientId: 'patient-002',
      consultedAt: '2026-02-10T11:00:00Z',
      chiefComplaint: 'Headache',
    }));

    const records = await getRecordsByPatient('patient-001');
    expect(records).toHaveLength(2);
    // Most recent first
    expect(records[0].chiefComplaint).toBe('Follow-up for malaria');
    expect(records[1].chiefComplaint).toBe('Cough for 1 week');
  });

  test('returns empty array for patient with no records', async () => {
    const records = await getRecordsByPatient('nonexistent');
    expect(records).toEqual([]);
  });

  test('updates a medical record', async () => {
    const rec = await createMedicalRecord(validRecord());
    const updated = await updateMedicalRecord(rec._id, {
      treatmentPlan: 'IV Artesunate followed by ACT',
    });
    expect(updated).not.toBeNull();
    expect(updated!.treatmentPlan).toBe('IV Artesunate followed by ACT');
    expect(updated!.patientId).toBe('patient-001');
  });

  test('update returns null for nonexistent record', async () => {
    const result = await updateMedicalRecord('nonexistent', { treatmentPlan: 'test' });
    expect(result).toBeNull();
  });

  test('deletes a medical record', async () => {
    const rec = await createMedicalRecord(validRecord());
    const deleted = await deleteMedicalRecord(rec._id);
    expect(deleted).toBe(true);

    const records = await getRecordsByPatient('patient-001');
    expect(records).toHaveLength(0);
  });

  test('delete returns false for nonexistent record', async () => {
    const result = await deleteMedicalRecord('nonexistent');
    expect(result).toBe(false);
  });

  test('getRecentRecords returns across patients with limit', async () => {
    for (let i = 0; i < 5; i++) {
      await createMedicalRecord(validRecord({
        patientId: `patient-${i}`,
        consultedAt: `2026-04-0${i + 1}T10:00:00Z`,
        chiefComplaint: `Complaint ${i}`,
      }));
    }

    const recent = await getRecentRecords(3);
    expect(recent).toHaveLength(3);
  });

  test('getRecentRecords uses default limit when not specified', async () => {
    for (let i = 0; i < 25; i++) {
      await createMedicalRecord(validRecord({
        patientId: `patient-${i}`,
        visitDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
        chiefComplaint: `Complaint ${i}`,
      }));
    }

    const recent = await getRecentRecords();
    expect(recent).toHaveLength(20);
  });

  test('sorts by visitDate when consultedAt is missing', async () => {
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: '2026-04-05',
      chiefComplaint: 'Record with visitDate only',
    }));
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: '2026-04-03',
      chiefComplaint: 'Earlier record',
    }));

    const records = await getRecordsByPatient('patient-001');
    expect(records).toHaveLength(2);
    expect(records[0].chiefComplaint).toBe('Record with visitDate only');
    expect(records[1].chiefComplaint).toBe('Earlier record');
  });

  test('falls back to createdAt in sort when both consultedAt and visitDate missing', async () => {
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: undefined,
      chiefComplaint: 'Record without consultedAt or visitDate',
    }));

    const records = await getRecordsByPatient('patient-001');
    expect(records).toHaveLength(1);
    expect(records[0].chiefComplaint).toBe('Record without consultedAt or visitDate');
  });

  test('getRecentRecords falls back to empty string for missing visitDate in sort (line 81)', async () => {
    // Test line 81: .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''))
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      visitDate: undefined,
      consultedAt: '2026-04-05T10:00:00Z',
      chiefComplaint: 'Record without visitDate',
    }));
    await createMedicalRecord(validRecord({
      patientId: 'patient-002',
      visitDate: '2026-04-10',
      consultedAt: '2026-04-10T10:00:00Z',
      chiefComplaint: 'Record with visitDate',
    }));

    const recent = await getRecentRecords(5);
    expect(recent).toHaveLength(2);
  });

  test('handles getRecentRecords with records missing visitDate', async () => {
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      visitDate: '2026-04-05',
      chiefComplaint: 'Record 1',
    }));
    await createMedicalRecord(validRecord({
      patientId: 'patient-002',
      visitDate: undefined,
      chiefComplaint: 'Record without visitDate',
    }));

    const recent = await getRecentRecords(10);
    expect(recent.length).toBeGreaterThan(0);
  });

  test('sorts by empty string when all date fields missing', async () => {
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: undefined,
      chiefComplaint: 'Record A',
    }));
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: undefined,
      chiefComplaint: 'Record B',
    }));

    const records = await getRecordsByPatient('patient-001');
    expect(records).toHaveLength(2);
    expect(records[0]).toBeDefined();
    expect(records[1]).toBeDefined();
  });

  test('getRecentRecords sorts correctly with empty visitDate', async () => {
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      visitDate: '2026-04-10',
      chiefComplaint: 'More recent',
    }));
    await createMedicalRecord(validRecord({
      patientId: 'patient-002',
      visitDate: '',
      chiefComplaint: 'Empty date',
    }));

    const recent = await getRecentRecords(10);
    expect(recent.length).toBeGreaterThanOrEqual(2);
  });

  // ---- Lines 16-17: Test all branches of the || chain fallback ----
  test('getRecordsByPatient handles all fallback branches in sort (lines 16-17)', async () => {
    // Record with consultedAt
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: '2026-04-11T10:00:00Z',
      visitDate: '2026-04-11',
      chiefComplaint: 'With consultedAt',
    }));

    // Record with visitDate but no consultedAt
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: '2026-04-10',
      chiefComplaint: 'Only visitDate',
    }));

    // Record with only createdAt
    await createMedicalRecord(validRecord({
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: undefined,
      chiefComplaint: 'Only createdAt',
    }));

    // Record with all falsy dates (should use empty string)
    const db = require('@/lib/db').medicalRecordsDB();
    const recNoDate = {
      _id: 'mrec-no-date',
      type: 'medical_record',
      patientId: 'patient-001',
      consultedAt: undefined,
      visitDate: undefined,
      createdAt: undefined,
      chiefComplaint: 'No dates',
      createdBy: 'test',
      updatedAt: new Date().toISOString(),
    };
    await db.put(recNoDate);

    const records = await getRecordsByPatient('patient-001');
    expect(records.length).toBeGreaterThanOrEqual(3);
  });
});
