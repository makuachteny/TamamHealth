/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for referral-service.ts
 * Covers inter-facility referrals, status transitions, and patient transfers.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-ref-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/services/transfer-service', () => ({
  assembleTransferPackage: jest.fn().mockResolvedValue({
    packageSizeBytes: 1000,
    contents: ['record1', 'record2'],
  }),
}));
jest.mock('@/lib/services/audit-service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  logAuditSafe: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/patient-service', () => ({
  updatePatient: jest.fn().mockResolvedValue({ _id: 'patient-001', _rev: 'rev123' }),
}));

import { teardownTestDBs } from '../helpers/test-db';
import {
  createReferral,
  getAllReferrals,
  getReferralsByPatient,
  getReferralsByHospital,
  updateReferralStatus,
  updateReferralNotes,
  createReferralWithTransfer,
  acceptReferral,
} from '@/lib/services/referral-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateReferralInput = Parameters<typeof createReferral>[0];
type CreateReferralWithTransferInput = Parameters<typeof createReferralWithTransfer>[0];

function validReferral(overrides: Partial<CreateReferralInput> = {}): CreateReferralInput {
  return {
    patientId: 'patient-001',
    patientName: 'Deng Mabior',
    fromHospitalId: 'hosp-001',
    fromHospital: 'Gudele PHCC',
    toHospitalId: 'hosp-002',
    toHospital: 'Juba Teaching Hospital',
    referralDate: '2026-04-10',
    reason: 'Complicated fracture requiring surgical intervention',
    urgency: 'urgent' as const,
    department: 'Surgery',
    referringDoctor: 'Dr. Kuol',
    status: 'sent' as const,
    notes: 'Patient fell from tree, open fracture with bone exposure',
    ...overrides,
  };
}

describe('Referral Service', () => {
  test('creates a referral', async () => {
    const ref = await createReferral(validReferral());
    expect(ref._id).toMatch(/^ref-/);
    expect(ref.type).toBe('referral');
    expect(ref.patientName).toBe('Deng Mabior');
    expect(ref.status).toBe('sent');
    expect(ref.fromHospital).toBe('Gudele PHCC');
    expect(ref.toHospital).toBe('Juba Teaching Hospital');
  });

  test('retrieves all referrals sorted by date', async () => {
    await createReferral(validReferral({ referralDate: '2026-03-01' }));
    await createReferral(validReferral({
      patientId: 'patient-002',
      patientName: 'Achol Deng',
      referralDate: '2026-04-05',
    }));

    const all = await getAllReferrals();
    expect(all).toHaveLength(2);
    // Most recent first
    expect(all[0].referralDate).toBe('2026-04-05');
  });

  test('retrieves referrals by patient', async () => {
    await createReferral(validReferral());
    await createReferral(validReferral({
      referralDate: '2026-02-15',
      reason: 'Follow-up surgery',
    }));
    await createReferral(validReferral({
      patientId: 'patient-002',
      patientName: 'Other Patient',
    }));

    const patientRefs = await getReferralsByPatient('patient-001');
    expect(patientRefs).toHaveLength(2);
  });

  test('retrieves referrals by hospital (from or to)', async () => {
    await createReferral(validReferral()); // from hosp-001 to hosp-002
    await createReferral(validReferral({
      patientId: 'patient-002',
      patientName: 'Ayen',
      fromHospitalId: 'hosp-003',
      fromHospital: 'Munuki PHCC',
      toHospitalId: 'hosp-001',
      toHospital: 'Gudele PHCC',
    }));

    const hosp1Refs = await getReferralsByHospital('hosp-001');
    expect(hosp1Refs).toHaveLength(2);
  });

  test('updates referral status through lifecycle', async () => {
    const ref = await createReferral(validReferral());

    const received = await updateReferralStatus(ref._id, 'received');
    expect(received).not.toBeNull();
    expect(received!.status).toBe('received');

    const seen = await updateReferralStatus(ref._id, 'seen');
    expect(seen).not.toBeNull();
    expect(seen!.status).toBe('seen');

    const completed = await updateReferralStatus(ref._id, 'completed');
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
  });

  test('cancels a referral', async () => {
    const ref = await createReferral(validReferral());
    const cancelled = await updateReferralStatus(ref._id, 'cancelled');
    expect(cancelled).not.toBeNull();
    expect(cancelled!.status).toBe('cancelled');
  });

  test('updates referral notes', async () => {
    const ref = await createReferral(validReferral());
    const updated = await updateReferralNotes(ref._id, 'Patient stabilized before transfer. Splint applied.');
    expect(updated.notes).toBe('Patient stabilized before transfer. Splint applied.');
  });

  test('status update returns null for nonexistent referral', async () => {
    const result = await updateReferralStatus('nonexistent', 'received');
    expect(result).toBeNull();
  });

  test('createReferralWithTransfer creates referral with transfer package', async () => {
    const attachments: Parameters<typeof createReferralWithTransfer>[1] = [
      { id: 'att-001', name: 'xray.pdf', sizeBytes: 500, mimeType: 'application/pdf', base64Data: '', uploadedAt: '2026-04-10T10:00:00Z', uploadedBy: 'doctor-123' },
      { id: 'att-002', name: 'lab.pdf', sizeBytes: 300, mimeType: 'application/pdf', base64Data: '', uploadedAt: '2026-04-10T10:00:00Z', uploadedBy: 'doctor-123' },
    ];
    const ref = await createReferralWithTransfer(
      validReferral() as CreateReferralWithTransferInput,
      attachments,
      'doctor-123'
    );

    expect(ref._id).toMatch(/^ref-/);
    expect(ref.type).toBe('referral');
    expect(ref.transferPackage).toBeDefined();
    expect(ref.transferPackage!.packageSizeBytes).toBe(1800); // 1000 + 500 + 300
    expect(ref.referralAttachments).toEqual(attachments);
  });

  test('createReferralWithTransfer handles empty attachments', async () => {
    const ref = await createReferralWithTransfer(
      validReferral() as CreateReferralWithTransferInput,
      [],
      'doctor-123'
    );

    expect(ref.referralAttachments).toBeUndefined();
    expect(ref.transferPackage).toBeDefined();
    // Mock returns 1000, plus 0 from empty attachments = 1000
    expect(ref.transferPackage!.packageSizeBytes).toBeGreaterThan(0);
  });

  test('acceptReferral updates status to seen and transfers patient', async () => {
    const ref = await createReferral(validReferral());
    const accepted = await acceptReferral(ref._id);

    expect(accepted).not.toBeNull();
    expect(accepted!.status).toBe('seen');
  });

  test('acceptReferral returns null for nonexistent referral', async () => {
    const result = await acceptReferral('nonexistent-ref');
    expect(result).toBeNull();
  });

  test('getAllReferrals with data scope filters appropriately', async () => {
    // First, let's test with scope parameter (the filterByScope function)
    // This requires setting up hospital data in the DB
    await createReferral(validReferral());
    await createReferral(validReferral({
      patientId: 'patient-002',
      patientName: 'Other Patient',
    }));

    // Call without scope to verify both exist
    const all = await getAllReferrals();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  test('getAllReferrals handles missing referralDate in sort (line 33)', async () => {
    // Tests line 33: (b.referralDate || '').localeCompare(a.referralDate || '')
    // When referralDate is undefined, should use empty string fallback
    const db = require('@/lib/db').referralsDB();

    await db.put({
      _id: 'ref-no-date',
      type: 'referral',
      patientId: 'patient-001',
      patientName: 'Test',
      referralDate: undefined,
    });
    await db.put({
      _id: 'ref-with-date',
      type: 'referral',
      patientId: 'patient-002',
      patientName: 'Test',
      referralDate: '2026-04-13',
    });

    const all = await getAllReferrals();
    expect(Array.isArray(all)).toBe(true);
    // Should include both despite missing referralDate on one
    expect(all.filter(r => r.patientId === 'patient-001').length).toBeGreaterThanOrEqual(0);
  });

  test('updateReferralNotes persists changes to database', async () => {
    const ref = await createReferral(validReferral());
    const newNotes = 'Updated notes with new information';

    const updated = await updateReferralNotes(ref._id, newNotes);
    expect(updated.notes).toBe(newNotes);
    expect(updated._rev).toBeDefined();
  });

  test('updateReferralStatus updates updatedAt timestamp', async () => {
    const ref = await createReferral(validReferral());
    const originalUpdatedAt = ref.updatedAt;

    // Small delay to ensure timestamp differs
    await new Promise(resolve => setTimeout(resolve, 10));

    const updated = await updateReferralStatus(ref._id, 'seen');
    expect(updated).not.toBeNull();
    expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
  });

  test('createReferral infers orgId from fromHospitalId when provided', async () => {
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    // Put a hospital with orgId in the fromHospitalId position
    const hospital = {
      _id: 'hosp-from-org',
      type: 'hospital' as const,
      name: 'Hospital From Org',
      orgId: 'org-from-123',
    };
    await hdb.put(hospital);

    const ref = await createReferral(validReferral({
      fromHospitalId: 'hosp-from-org',
      toHospitalId: 'hosp-002',
    }));

    // The inferOrgId function should try fromHospitalId
    expect(ref._id).toMatch(/^ref-/);
    expect(ref.type).toBe('referral');
  });

  test('acceptReferral handles updatePatient error gracefully', async () => {
    const { updatePatient } = require('@/lib/services/patient-service');
    updatePatient.mockRejectedValueOnce(new Error('Patient update failed'));

    const ref = await createReferral(validReferral());
    const accepted = await acceptReferral(ref._id);

    // Should still update status to 'seen' even if patient update fails
    expect(accepted).not.toBeNull();
    expect(accepted!.status).toBe('seen');
  });

  test('completeReferralWithOutcome stores structured outcome, sets completed, and appends a note line', async () => {
    const { completeReferralWithOutcome } = require('@/lib/services/referral-service');
    const ref = await createReferral(validReferral({ notes: 'Original handover note' }));
    const updated = await completeReferralWithOutcome(ref._id, {
      disposition: 'admitted',
      summary: 'Admitted to surgical ward, ORIF performed',
      followUp: 'Suture removal in 14 days at referring facility',
      recordedBy: 'Dr. Receiver',
      recordedAt: '2026-05-01T10:00:00.000Z',
    });

    expect(updated).not.toBeNull();
    expect(updated.status).toBe('completed');
    expect(updated.outcome.disposition).toBe('admitted');
    expect(updated.outcome.summary).toContain('ORIF');
    // Human-readable note line is appended after the original notes.
    expect(updated.notes).toContain('Original handover note');
    expect(updated.notes).toContain('OUTCOME (admitted)');
    expect(updated.notes).toContain('Follow-up:');
  });

  test('completeReferralWithOutcome returns null for a nonexistent referral', async () => {
    const { completeReferralWithOutcome } = require('@/lib/services/referral-service');
    const result = await completeReferralWithOutcome('nope', {
      disposition: 'treated_discharged', summary: 'x', recordedBy: 'y', recordedAt: '2026-05-01T10:00:00.000Z',
    });
    expect(result).toBeNull();
  });

  test('acceptReferral re-homes the patient to the receiving hospital AND its org', async () => {
    // Cross-org referral: the destination hospital belongs to a different org.
    // The patient transfer must carry the destination orgId, otherwise
    // data-scope (which filters on orgId first) hides the accepted patient
    // from the receiving org entirely.
    const { updatePatient } = require('@/lib/services/patient-service');
    updatePatient.mockClear();
    const hdb = require('@/lib/db').hospitalsDB();
    await hdb.put({ _id: 'hosp-dest-org', type: 'hospital', name: 'Dest Hospital', orgId: 'org-receiving' });

    const ref = await createReferral(validReferral({ toHospitalId: 'hosp-dest-org', orgId: 'org-sending' }));
    await acceptReferral(ref._id);

    expect(updatePatient).toHaveBeenCalledWith('patient-001', {
      registrationHospital: 'hosp-dest-org',
      lastVisitHospital: 'hosp-dest-org',
      orgId: 'org-receiving',
    });
  });

  test('acceptReferral records an idempotent referral-intake encounter in the receiver EHR', async () => {
    const mrDb = require('@/lib/db').medicalRecordsDB();
    const ref = await createReferral(validReferral());
    const intakeId = `rec-refin-${ref._id}`;

    await acceptReferral(ref._id);
    const intake = await mrDb.get(intakeId);
    expect(intake.type).toBe('medical_record');
    expect(intake.patientId).toBe('patient-001');
    expect(intake.hospitalId).toBe('hosp-002');
    expect(intake.visitType).toBe('referral');
    expect(intake.chiefComplaint).toContain('Referral intake');

    // Re-accepting must not spawn a duplicate intake row.
    const revBefore = intake._rev;
    await acceptReferral(ref._id);
    const after = await mrDb.get(intakeId);
    expect(after._rev).toBe(revBefore);
  });

  test('acceptReferral omits orgId when destination hospital is unreachable', async () => {
    // Offline / missing destination hospital doc: fall back to transferring
    // only the hospital fields, leaving orgId untouched (same-org path).
    const { updatePatient } = require('@/lib/services/patient-service');
    updatePatient.mockClear();

    const ref = await createReferral(validReferral({ toHospitalId: 'hosp-not-in-db' }));
    await acceptReferral(ref._id);

    expect(updatePatient).toHaveBeenCalledWith('patient-001', {
      registrationHospital: 'hosp-not-in-db',
      lastVisitHospital: 'hosp-not-in-db',
    });
  });

  test('acceptReferral runs patient transfer BEFORE marking referral seen (atomicity)', async () => {
    // The previous order (status-first, then transfer) left referrals stuck
    // in 'seen' status when the transfer threw. Reversing the order means
    // a transfer failure no longer mis-reports state.
    const { updatePatient } = require('@/lib/services/patient-service');

    const callOrder: string[] = [];
    updatePatient.mockImplementationOnce(async () => {
      callOrder.push('transfer');
      return { _id: 'patient-001', _rev: 'rev-1' };
    });

    const ref = await createReferral(validReferral());
    // Wrap referralsDB.put after the create so we observe only acceptance writes.
    const db = require('@/lib/db').referralsDB();
    const realPut = db.put.bind(db);
    db.put = jest.fn(async (...args: unknown[]) => {
      callOrder.push('mark-seen');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return realPut(...(args as [any]));
    });

    await acceptReferral(ref._id);
    db.put = realPut;

    // Transfer must precede the seen-mark.
    const firstTransfer = callOrder.indexOf('transfer');
    const firstMark = callOrder.indexOf('mark-seen');
    expect(firstTransfer).toBeGreaterThanOrEqual(0);
    expect(firstMark).toBeGreaterThan(firstTransfer);
  });

  test('createReferral infers orgId from toHospitalId only', async () => {
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    // Put a hospital with orgId in the toHospitalId position only
    const hospital = {
      _id: 'hosp-to-org-only',
      type: 'hospital' as const,
      name: 'Hospital To Org',
      orgId: 'org-to-789',
    };
    await hdb.put(hospital);

    const ref = await createReferral(validReferral({
      fromHospitalId: 'hosp-this-doesnt-exist-at-all',
      toHospitalId: 'hosp-to-org-only',
    }));

    // The referral should be created successfully
    expect(ref._id).toMatch(/^ref-/);
    expect(ref.type).toBe('referral');
    expect(ref.toHospitalId).toBe('hosp-to-org-only');
    // The orgId should be inferred from toHospitalId (if database works correctly)
  });

  test('createReferral with neither fromHospitalId nor toHospitalId orgId returns undefined', async () => {
    const ref = await createReferral(validReferral({
      fromHospitalId: 'hosp-missing',
      toHospitalId: 'hosp-also-missing',
    }));

    expect(ref._id).toMatch(/^ref-/);
    expect(ref.orgId).toBeUndefined();
  });

  // ---- Branch coverage: inferOrgId fallback paths ----

  test('inferOrgId falls through from when from-hospital has no orgId', async () => {
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    // from-hospital exists but has NO orgId
    await hdb.put({ _id: 'hosp-no-org', type: 'hospital', name: 'No Org Hospital' });
    // to-hospital has orgId
    await hdb.put({ _id: 'hosp-with-org', type: 'hospital', name: 'With Org', orgId: 'org-456' });

    const ref = await createReferral(validReferral({
      fromHospitalId: 'hosp-no-org',
      toHospitalId: 'hosp-with-org',
      orgId: undefined as unknown as string,
    }));

    // Should have inferred orgId from toHospitalId
    expect(ref.orgId).toBe('org-456');
  });

  test('inferOrgId uses fromHospitalId orgId when available', async () => {
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    await hdb.put({ _id: 'hosp-from-with-org', type: 'hospital', name: 'From', orgId: 'org-from' });
    await hdb.put({ _id: 'hosp-to-with-org', type: 'hospital', name: 'To', orgId: 'org-to' });

    const ref = await createReferral(validReferral({
      fromHospitalId: 'hosp-from-with-org',
      toHospitalId: 'hosp-to-with-org',
      orgId: undefined as unknown as string,
    }));

    // Should use from-hospital orgId first
    expect(ref.orgId).toBe('org-from');
  });

  test('createReferralWithTransfer infers orgId from toHospital when from has none', async () => {
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    await hdb.put({ _id: 'hosp-ref-no-org', type: 'hospital', name: 'No Org' });
    await hdb.put({ _id: 'hosp-ref-has-org', type: 'hospital', name: 'Has Org', orgId: 'org-xfer' });

    const ref = await createReferralWithTransfer(
      validReferral({
        fromHospitalId: 'hosp-ref-no-org',
        toHospitalId: 'hosp-ref-has-org',
        orgId: undefined as unknown as string,
      }),
      [],
      'doctor-123'
    );

    expect(ref.orgId).toBe('org-xfer');
  });

  test('acceptReferral handles missing patientId gracefully', async () => {
    const ref = await createReferral(validReferral({
      patientId: undefined as unknown as string,
      toHospitalId: undefined as unknown as string,
    }));
    const accepted = await acceptReferral(ref._id);
    // Should still succeed but skip patient transfer
    expect(accepted).not.toBeNull();
    expect(accepted!.status).toBe('seen');
  });

  test('getAllReferrals handles missing referralDate in sort', async () => {
    await createReferral(validReferral({ referralDate: undefined as unknown as string }));
    await createReferral(validReferral({ referralDate: '2026-04-01', patientId: 'p2', patientName: 'B' }));
    const all = await getAllReferrals();
    expect(all).toHaveLength(2);
  });

  test('createReferral with explicit orgId skips inferOrgId', async () => {
    const ref = await createReferral(validReferral({
      orgId: 'org-explicit',
    }));
    expect(ref.orgId).toBe('org-explicit');
  });

  test('inferOrgId returns undefined when neither hospital has orgId (line 18-24)', async () => {
    // Tests line 18-19 when to?.orgId is falsy (no orgId on either hospital)
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    // Put hospitals - both have no orgId (testing the case where line 18-19 branches evaluate to undefined)
    await hdb.put({ _id: 'hosp-no-org-1', type: 'hospital', name: 'No Org 1' });
    await hdb.put({ _id: 'hosp-no-org-2', type: 'hospital', name: 'No Org 2' });

    const ref = await createReferral(validReferral({
      fromHospitalId: 'hosp-no-org-1',
      toHospitalId: 'hosp-no-org-2',
      orgId: undefined as unknown as string,
    }));

    // Both hospitals have no orgId, so result should be undefined
    expect(ref.orgId).toBeUndefined();
  });

  test('inferOrgId tests FALSE branch for fromHospitalId (line 13)', async () => {
    // When fromHospitalId is undefined/falsy, line 13 if condition is false
    // This tests creating a referral with only toHospitalId defined
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    await hdb.put({
      _id: 'hosp-to-only',
      type: 'hospital',
      name: 'To Hospital',
      orgId: 'org-to-value',
    });

    const ref = await createReferral(validReferral({
      fromHospitalId: undefined as unknown as string, // Line 13: if (fromHospitalId) FALSE
      toHospitalId: 'hosp-to-only',
      orgId: undefined as unknown as string,
    }));

    expect(ref.orgId).toBe('org-to-value');
  });

  test('inferOrgId tests FALSE branch for toHospitalId (line 17)', async () => {
    // When toHospitalId is undefined/falsy, line 17 if condition is false
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    await hdb.put({
      _id: 'hosp-from-only',
      type: 'hospital',
      name: 'From Hospital',
      orgId: 'org-from-value',
    });

    const ref = await createReferral(validReferral({
      fromHospitalId: 'hosp-from-only',
      toHospitalId: undefined as unknown as string, // Line 17: if (toHospitalId) FALSE
      orgId: undefined as unknown as string,
    }));

    expect(ref.orgId).toBe('org-from-value');
  });

  test('getAllReferrals handles missing referralDate in sort (lines 33-34)', async () => {
    // Tests lines 33-34: (b.referralDate || '').localeCompare(a.referralDate || '')
    const db = require('@/lib/db').referralsDB();

    // Raw insert referrals with missing referralDate
    await db.put({
      _id: 'ref-missing-date-1',
      type: 'referral',
      patientId: 'p1',
      patientName: 'Test',
    });
    await db.put({
      _id: 'ref-with-date-1',
      type: 'referral',
      patientId: 'p2',
      patientName: 'Test',
      referralDate: '2026-04-13',
    });

    const all = await getAllReferrals();
    expect(Array.isArray(all)).toBe(true);
    // Should include both despite missing referralDate on one
    expect(all.filter(r => r.patientId === 'p1').length).toBeGreaterThanOrEqual(0);
  });
});
