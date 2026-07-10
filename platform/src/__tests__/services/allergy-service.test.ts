/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for allergy-service.ts (P0.3 structured allergies).
 * Allergies live on the patient document; these exercise add/remove/migrate
 * and the active-substance mirror that keeps legacy read sites working.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-allergy-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createPatient, getPatientById } from '@/lib/services/patient-service';
import {
  addAllergy,
  removeAllergy,
  updateAllergy,
  getAllergies,
  getActiveAllergies,
  migrateLegacyAllergies,
} from '@/lib/services/allergy-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

async function makePatient(overrides: Record<string, unknown> = {}) {
  return createPatient({
    hospitalNumber: 'HN-001',
    firstName: 'Ayen',
    surname: 'Deng',
    dateOfBirth: '1990-01-01',
    gender: 'Female',
    phone: '0900000000',
    state: 'Central Equatoria',
    county: 'Juba',
    tribe: 'Dinka',
    primaryLanguage: 'Dinka',
    bloodType: 'O+',
    allergies: [],
    chronicConditions: [],
    nokName: 'Kuol',
    nokRelationship: 'Brother',
    nokPhone: '0900000001',
    registrationHospital: 'hosp-001',
    registrationDate: '2026-01-01',
    ...overrides,
  } as unknown as Parameters<typeof createPatient>[0]);
}

describe('Allergy service (P0.3)', () => {
  test('adds a structured allergy and mirrors the active substance name', async () => {
    const p = await makePatient();
    const list = await addAllergy(p._id, { substance: 'Penicillin', classification: 'drug', criticality: 'severe', reaction: 'anaphylaxis' });
    expect(list).not.toBeNull();
    expect(list!).toHaveLength(1);
    expect(list![0].substance).toBe('Penicillin');
    expect(list![0].criticality).toBe('severe');
    expect(list![0].status).toBe('active');

    const reloaded = await getPatientById(p._id);
    expect(reloaded!.structuredAllergies).toHaveLength(1);
    // Legacy mirror reflects active substance names.
    expect(reloaded!.allergies).toEqual(['Penicillin']);
  });

  test('requires a substance', async () => {
    const p = await makePatient();
    await expect(addAllergy(p._id, { substance: '   ' })).rejects.toThrow();
  });

  test('re-adding a removed allergy reactivates rather than duplicating', async () => {
    const p = await makePatient();
    await addAllergy(p._id, { substance: 'Sulfa', criticality: 'moderate' });
    const all = await getAllergies(p._id);
    await removeAllergy(p._id, all[0].id, 'Recorded in error');
    const afterRemove = await getActiveAllergies(p._id);
    expect(afterRemove).toHaveLength(0);

    const reAdded = await addAllergy(p._id, { substance: 'sulfa', criticality: 'severe' });
    expect(reAdded).toHaveLength(1);
    expect(reAdded![0].status).toBe('active');
    expect(reAdded![0].criticality).toBe('severe');
    expect(reAdded![0].removalReason).toBeUndefined();
  });

  test('remove requires a reason and deactivates instead of deleting', async () => {
    const p = await makePatient();
    await addAllergy(p._id, { substance: 'Aspirin' });
    const all = await getAllergies(p._id);
    await expect(removeAllergy(p._id, all[0].id, '')).rejects.toThrow();

    const removed = await removeAllergy(p._id, all[0].id, 'Patient tolerated on rechallenge', 'resolved');
    expect(removed).not.toBeNull();
    // Entry is retained (audit trail) but no longer active.
    expect(removed!).toHaveLength(1);
    expect(removed![0].status).toBe('resolved');
    expect(removed![0].removalReason).toBe('Patient tolerated on rechallenge');
    const reloaded = await getPatientById(p._id);
    expect(reloaded!.allergies).toEqual([]); // mirror drops inactive
  });

  test('removing a nonexistent allergy id returns null', async () => {
    const p = await makePatient();
    expect(await removeAllergy(p._id, 'no-such-id', 'reason')).toBeNull();
  });

  test('updateAllergy edits fields in place', async () => {
    const p = await makePatient();
    await addAllergy(p._id, { substance: 'Latex', criticality: 'mild' });
    const all = await getAllergies(p._id);
    const updated = await updateAllergy(p._id, all[0].id, { criticality: 'severe', reaction: 'urticaria' });
    expect(updated![0].criticality).toBe('severe');
    expect(updated![0].reaction).toBe('urticaria');
  });

  test('migrateLegacyAllergies seeds structured entries from the string list, skipping sentinels', () => {
    const fakePatient = { allergies: ['Penicillin', 'None known'], structuredAllergies: undefined } as unknown as Parameters<typeof migrateLegacyAllergies>[0];
    const migrated = migrateLegacyAllergies(fakePatient);
    expect(migrated).not.toBeNull();
    expect(migrated!).toHaveLength(1);
    expect(migrated![0].substance).toBe('Penicillin');
    expect(migrated![0].criticality).toBe('unknown');
  });

  test('migrateLegacyAllergies is a no-op once structured allergies exist', () => {
    const fakePatient = { allergies: ['X'], structuredAllergies: [] } as unknown as Parameters<typeof migrateLegacyAllergies>[0];
    expect(migrateLegacyAllergies(fakePatient)).toBeNull();
  });

  test('getAllergies derives a read-only view for unmigrated patients', async () => {
    const p = await makePatient({ allergies: ['Iodine', 'None known'] });
    const list = await getAllergies(p._id);
    expect(list.map((a) => a.substance)).toEqual(['Iodine']);
  });
});
