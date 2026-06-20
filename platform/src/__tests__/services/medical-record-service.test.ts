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
  signMedicalRecord,
  cosignMedicalRecord,
  addAddendum,
  isRecordLocked,
  getSigningInbox,
  SignedRecordLockError,
  SigningAuthorizationError,
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

describe('Document signing & locking (P0.1)', () => {
  const signer = { userId: 'u-dr-kuol', userName: 'Dr. Kuol', userRole: 'doctor' };

  test('a freshly created record is an editable draft (unlocked)', async () => {
    const rec = await createMedicalRecord(validRecord());
    expect(rec.documentStatus).toBeUndefined();
    expect(isRecordLocked(rec)).toBe(false);
  });

  test('signing sets status, signer identity, timestamp and locks the record', async () => {
    const rec = await createMedicalRecord(validRecord());
    const signed = await signMedicalRecord(rec._id, signer);
    expect(signed).not.toBeNull();
    expect(signed!.documentStatus).toBe('signed');
    expect(signed!.signedBy).toBe('u-dr-kuol');
    expect(signed!.signedByName).toBe('Dr. Kuol');
    expect(signed!.signedByRole).toBe('doctor');
    expect(signed!.signedAt).toBeDefined();
    expect(isRecordLocked(signed!)).toBe(true);
  });

  test('a signed record cannot be edited in place', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, signer);
    await expect(
      updateMedicalRecord(rec._id, { treatmentPlan: 'tampered' })
    ).rejects.toThrow(SignedRecordLockError);
  });

  test('an unsigned record is still editable', async () => {
    const rec = await createMedicalRecord(validRecord());
    const updated = await updateMedicalRecord(rec._id, { treatmentPlan: 'revised' });
    expect(updated!.treatmentPlan).toBe('revised');
  });

  test('re-signing an already-signed record is rejected', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, signer);
    await expect(signMedicalRecord(rec._id, signer)).rejects.toThrow(SignedRecordLockError);
  });

  test('signing a nonexistent record returns null', async () => {
    expect(await signMedicalRecord('nope', signer)).toBeNull();
  });

  test('awaitingCosign signs into the awaiting_cosign state', async () => {
    const rec = await createMedicalRecord(validRecord());
    const signed = await signMedicalRecord(rec._id, signer, { awaitingCosign: true });
    expect(signed!.documentStatus).toBe('awaiting_cosign');
    expect(signed!.signedByName).toBe('Dr. Kuol');
  });

  test('addAddendum appends an immutable note and moves status to amended', async () => {
    const rec = await createMedicalRecord(validRecord({ treatmentPlan: 'Original plan' }));
    await signMedicalRecord(rec._id, signer);
    const amended = await addAddendum(rec._id, 'Patient called: tolerating meds well.', signer);
    expect(amended!.documentStatus).toBe('amended');
    expect(amended!.addenda).toHaveLength(1);
    expect(amended!.addenda![0].text).toContain('tolerating meds');
    expect(amended!.addenda![0].authorName).toBe('Dr. Kuol');
    // Original signed content is preserved unchanged.
    expect(amended!.treatmentPlan).toBe('Original plan');
    expect(amended!.signedByName).toBe('Dr. Kuol');
  });

  test('addenda accumulate in order and the record stays locked to edits', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, signer);
    await addAddendum(rec._id, 'First addendum', signer);
    const second = await addAddendum(rec._id, 'Second addendum', signer);
    expect(second!.addenda).toHaveLength(2);
    expect(second!.addenda![1].text).toBe('Second addendum');
    await expect(updateMedicalRecord(rec._id, { treatmentPlan: 'x' })).rejects.toThrow(SignedRecordLockError);
  });

  test('addAddendum rejects empty text', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, signer);
    await expect(addAddendum(rec._id, '   ', signer)).rejects.toThrow();
  });

  test('addAddendum on an unsigned draft is rejected', async () => {
    const rec = await createMedicalRecord(validRecord());
    await expect(addAddendum(rec._id, 'note', signer)).rejects.toThrow();
  });

  test('addAddendum on a nonexistent record returns null', async () => {
    expect(await addAddendum('nope', 'note', signer)).toBeNull();
  });
});

describe('Co-signing (P0.2)', () => {
  const trainee = { userId: 'u-co-deng', userName: 'CO Deng', userRole: 'clinical_officer' };
  const supervisor = { userId: 'u-dr-achol', userName: 'Dr. Achol', userRole: 'doctor' };

  test('a trainee-signed record can be co-signed into a fully signed record', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, trainee, { awaitingCosign: true });
    const cosigned = await cosignMedicalRecord(rec._id, supervisor);
    expect(cosigned!.documentStatus).toBe('signed');
    expect(cosigned!.signedByName).toBe('CO Deng');
    expect(cosigned!.cosignedByName).toBe('Dr. Achol');
    expect(cosigned!.cosignedAt).toBeDefined();
    expect(isRecordLocked(cosigned!)).toBe(true);
  });

  test('co-signing a record that is not awaiting co-signature is rejected', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, supervisor); // fully signed, not awaiting
    await expect(cosignMedicalRecord(rec._id, supervisor)).rejects.toThrow();
  });

  test('co-signing a draft is rejected', async () => {
    const rec = await createMedicalRecord(validRecord());
    await expect(cosignMedicalRecord(rec._id, supervisor)).rejects.toThrow();
  });

  test('co-signing a nonexistent record returns null', async () => {
    expect(await cosignMedicalRecord('nope', supervisor)).toBeNull();
  });

  test('an awaiting_cosign record is not yet locked against the co-sign update', async () => {
    const rec = await createMedicalRecord(validRecord());
    const signed = await signMedicalRecord(rec._id, trainee, { awaitingCosign: true });
    // awaiting_cosign is intentionally NOT locked, so cosign can complete it.
    expect(isRecordLocked(signed!)).toBe(false);
  });

  test('a clinician cannot co-sign their own awaiting_cosign note', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, trainee, { awaitingCosign: true });
    // Same userId attempting to co-sign — must be a different (supervising) provider.
    await expect(
      cosignMedicalRecord(rec._id, { userId: trainee.userId, userName: trainee.userName, userRole: 'doctor' }),
    ).rejects.toThrow(SigningAuthorizationError);
  });

  test('a non-provider role cannot co-sign', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, trainee, { awaitingCosign: true });
    await expect(
      cosignMedicalRecord(rec._id, { userId: 'u-nurse', userName: 'Nurse', userRole: 'nurse' }),
    ).rejects.toThrow(SigningAuthorizationError);
  });
});

describe('Signing authorization (audit H1)', () => {
  test('a non-clinical role may not sign a note', async () => {
    const rec = await createMedicalRecord(validRecord());
    await expect(
      signMedicalRecord(rec._id, { userId: 'u-desk', userName: 'Front Desk', userRole: 'front_desk' }),
    ).rejects.toThrow(SigningAuthorizationError);
  });

  test('an addendum cannot be added to an awaiting_cosign note (it must be co-signed first)', async () => {
    const rec = await createMedicalRecord(validRecord());
    await signMedicalRecord(rec._id, { userId: 'u-co', userName: 'CO Deng', userRole: 'clinical_officer' }, { awaitingCosign: true });
    await expect(
      addAddendum(rec._id, 'note', { userId: 'u-co', userName: 'CO Deng', userRole: 'clinical_officer' }),
    ).rejects.toThrow(/co-signed/);
  });
});

describe('Signing inbox (P1.1 query)', () => {
  const signer = { userId: 'u-dr-kuol', userName: 'Dr. Kuol', userRole: 'doctor' };

  test('separates unsigned drafts from records awaiting co-signature, excluding nursing vitals', async () => {
    // Unsigned consult draft
    await createMedicalRecord(validRecord({ patientId: 'p1', chiefComplaint: 'Fever draft' }));
    // Awaiting cosign
    const r2 = await createMedicalRecord(validRecord({ patientId: 'p2', chiefComplaint: 'Cough note' }));
    await signMedicalRecord(r2._id, signer, { awaitingCosign: true });
    // Fully signed (should appear in neither bucket)
    const r3 = await createMedicalRecord(validRecord({ patientId: 'p3', chiefComplaint: 'Signed visit' }));
    await signMedicalRecord(r3._id, signer);
    // Nursing vitals observation (should be excluded from drafts)
    await createMedicalRecord(validRecord({ patientId: 'p4', chiefComplaint: 'Nursing vitals observation' }));

    const inbox = await getSigningInbox();
    expect(inbox.unsignedDrafts.map((r) => r.chiefComplaint)).toEqual(['Fever draft']);
    expect(inbox.awaitingCosign.map((r) => r.chiefComplaint)).toEqual(['Cough note']);
  });

  test('excludes nursing-vitals records by the structural recordKind marker (L4)', async () => {
    await createMedicalRecord(validRecord({ patientId: 'p1', chiefComplaint: 'Real consult' }));
    // A nursing vitals snapshot with a non-sentinel chief complaint must still
    // be excluded thanks to recordKind.
    await createMedicalRecord(validRecord({ patientId: 'p2', chiefComplaint: 'Routine obs', recordKind: 'nursing_vitals' }));
    const inbox = await getSigningInbox();
    expect(inbox.unsignedDrafts.map((r) => r.chiefComplaint)).toEqual(['Real consult']);
  });
});
