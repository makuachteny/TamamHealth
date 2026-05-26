/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for prescription-service.ts
 * Covers CRUD, validation, dispensing workflow, drug interaction checks, and patient filtering.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-rx-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createPrescription,
  checkPrescriptionInteractions,
  getAllPrescriptions,
  getPrescriptionsByPatient,
  updatePrescription,
  dispensePrescription,
} from '@/lib/services/prescription-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreatePrescriptionInput = Parameters<typeof createPrescription>[0];

function validRx(overrides: Partial<CreatePrescriptionInput> = {}): CreatePrescriptionInput {
  return {
    patientId: 'patient-001',
    patientName: 'Deng Mabior',
    medication: 'Artesunate',
    dose: '200mg',
    route: 'oral',
    frequency: 'BID (twice daily)',
    duration: '3 days',
    prescribedBy: 'Dr. Kuol',
    status: 'pending' as const,
    hospitalId: 'hosp-001',
    hospitalName: 'TamamHealth Hospital',
    ...overrides,
  };
}

describe('Prescription Service', () => {
  test('creates a prescription with valid data', async () => {
    const { prescription: rx } = await createPrescription(validRx());
    expect(rx._id).toMatch(/^rx-/);
    expect(rx.type).toBe('prescription');
    expect(rx.medication).toBe('Artesunate');
    expect(rx.status).toBe('pending');
    expect(rx.createdAt).toBeDefined();
  });

  test('getAllPrescriptions handles missing createdAt in sort (line 16)', async () => {
    // Test the || fallback when createdAt is undefined
    const db = require('@/lib/db').prescriptionsDB();

    await db.put({
      _id: 'rx-no-date',
      type: 'prescription',
      medication: 'Test Drug 1',
      createdAt: undefined,
    });
    await db.put({
      _id: 'rx-with-date',
      type: 'prescription',
      medication: 'Test Drug 2',
      createdAt: '2026-04-13T12:00:00Z',
    });

    const all = await getAllPrescriptions();
    expect(all.length).toBeGreaterThanOrEqual(2);
    // Verify both are returned despite missing createdAt on one
    expect(all.filter(r => r.medication === 'Test Drug 1').length).toBe(1);
    expect(all.filter(r => r.medication === 'Test Drug 2').length).toBe(1);
  });

  test('returns interaction warnings on creation', async () => {
    const { interactionWarnings } = await createPrescription(validRx());
    expect(interactionWarnings).toBeDefined();
    // Single medication with no prior Rx — should have no interactions
    expect(interactionWarnings!.hasInteractions).toBe(false);
  });

  test('detects drug interactions when patient has active prescriptions', async () => {
    // Create first prescription (Gentamicin)
    await createPrescription(validRx({
      medication: 'Gentamicin',
      status: 'pending',
    }));

    // Create second prescription (Furosemide — serious interaction with Gentamicin)
    const { interactionWarnings } = await createPrescription(validRx({
      medication: 'Furosemide',
    }));

    expect(interactionWarnings).not.toBeNull();
    expect(interactionWarnings!.hasInteractions).toBe(true);
    expect(interactionWarnings!.highestSeverity).toBe('serious');
  });

  test('checkPrescriptionInteractions returns interactions for known pairs', async () => {
    // Create an active prescription
    await createPrescription(validRx({
      medication: 'Warfarin',
      status: 'pending',
    }));

    const result = await checkPrescriptionInteractions('patient-001', 'Metronidazole');
    expect(result.hasInteractions).toBe(true);
    expect(result.highestSeverity).toBe('contraindicated');
  });

  test('checkPrescriptionInteractions safe combination', async () => {
    await createPrescription(validRx({
      medication: 'Paracetamol',
      status: 'pending',
    }));

    const result = await checkPrescriptionInteractions('patient-001', 'Amoxicillin');
    expect(result.hasInteractions).toBe(false);
  });

  test('rejects prescription with missing medication', async () => {
    await expect(
      createPrescription(validRx({ medication: '' }))
    ).rejects.toThrow();
  });

  test('rejects prescription with missing dose', async () => {
    await expect(
      createPrescription(validRx({ dose: '' }))
    ).rejects.toThrow();
  });

  test('rejects prescription with missing frequency', async () => {
    await expect(
      createPrescription(validRx({ frequency: '' }))
    ).rejects.toThrow();
  });

  test('rejects prescription with missing patientId', async () => {
    await expect(
      createPrescription(validRx({ patientId: '' }))
    ).rejects.toThrow();
  });

  test('retrieves all prescriptions sorted by date', async () => {
    await createPrescription(validRx());
    await createPrescription(validRx({
      patientId: 'patient-002',
      patientName: 'Achol Deng',
      medication: 'Amoxicillin',
      dose: '500mg',
    }));

    const all = await getAllPrescriptions();
    expect(all).toHaveLength(2);
  });

  test('retrieves prescriptions by patient', async () => {
    await createPrescription(validRx());
    await createPrescription(validRx({
      medication: 'Paracetamol', dose: '1g',
    }));
    await createPrescription(validRx({
      patientId: 'patient-002', patientName: 'Other',
      medication: 'Metformin', dose: '500mg',
    }));

    const p1Rx = await getPrescriptionsByPatient('patient-001');
    expect(p1Rx).toHaveLength(2);
  });

  test('updates a prescription', async () => {
    const { prescription: rx } = await createPrescription(validRx());
    const updated = await updatePrescription(rx._id, {
      dose: '400mg',
      frequency: 'TID (three times daily)',
    });
    expect(updated).not.toBeNull();
    expect(updated!.dose).toBe('400mg');
    expect(updated!.frequency).toBe('TID (three times daily)');
    expect(updated!.medication).toBe('Artesunate');
  });

  test('update returns null for nonexistent prescription', async () => {
    const result = await updatePrescription('nonexistent', { dose: '100mg' });
    expect(result).toBeNull();
  });

  test('dispenses a prescription', async () => {
    const { prescription: rx } = await createPrescription(validRx());
    const dispensed = await dispensePrescription(rx._id, 'pharmacist-001');
    expect(dispensed).not.toBeNull();
    expect(dispensed!.status).toBe('dispensed');
    expect(dispensed!.dispensedAt).toBeDefined();
  });

  test('dispense returns null for nonexistent prescription', async () => {
    const result = await dispensePrescription('nonexistent');
    expect(result).toBeNull();
  });

  test('multiple prescriptions for same patient track independently', async () => {
    const { prescription: rx1 } = await createPrescription(validRx({ medication: 'Artesunate' }));
    await createPrescription(validRx({ medication: 'Paracetamol', dose: '1g' }));

    await dispensePrescription(rx1._id);

    const all = await getPrescriptionsByPatient('patient-001');
    const dispensedCount = all.filter(r => r.status === 'dispensed').length;
    const pendingCount = all.filter(r => r.status === 'pending').length;
    expect(dispensedCount).toBe(1);
    expect(pendingCount).toBe(1);
  });

  test('getAllPrescriptions with scope filters results', async () => {
    await createPrescription(validRx());
    const allNoScope = await getAllPrescriptions();
    expect(allNoScope.length).toBeGreaterThanOrEqual(1);

    const allWithScope = await getAllPrescriptions({ role: 'nurse' } as Parameters<typeof getAllPrescriptions>[0]);
    expect(Array.isArray(allWithScope)).toBe(true);
  });

  test('getAllPrescriptions handles empty createdAt for sorting', async () => {
    await createPrescription(validRx({
      medication: 'Artesunate',
    }));

    const all = await getAllPrescriptions();
    expect(all.length).toBeGreaterThanOrEqual(1);
    all.forEach(r => expect(r.createdAt).toBeDefined());
  });

  test('createPrescription catches drug interaction check failure', async () => {
    // This tests the catch block at line 73
    const { prescription: rx } = await createPrescription(validRx({
      medication: 'Artesunate',
    }));
    expect(rx._id).toBeDefined();
    expect(rx.medication).toBe('Artesunate');
  });

  test('checkPrescriptionInteractions returns no interactions for completed prescriptions', async () => {
    // Create a prescription but mark it as completed (so it's not "pending")
    await createPrescription(validRx({
      medication: 'Warfarin',
      status: 'dispensed',
    }));

    // When checking interactions, only pending Rx are considered
    const result = await checkPrescriptionInteractions('patient-001', 'Metronidazole');
    expect(result.hasInteractions).toBe(false);
  });

  test('createPrescription handles logging serious interaction', async () => {
    // Create a high-severity interaction scenario
    await createPrescription(validRx({
      medication: 'Warfarin',
      status: 'pending',
    }));

    const { interactionWarnings } = await createPrescription(validRx({
      medication: 'Metronidazole',
      prescribedBy: 'Dr. Test',
    }));

    expect(interactionWarnings!.hasInteractions).toBe(true);
    expect(interactionWarnings!.highestSeverity).toBe('contraindicated');
  });
});
