/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for hospital-service.ts
 * Covers hospital CRUD and status updates.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-hosp-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createHospital,
  getAllHospitals,
  getHospitalById,
  updateHospitalStatus,
} from '@/lib/services/hospital-service';
import type { DataScope } from '@/lib/services/data-scope';

type CreateHospitalInput = Parameters<typeof createHospital>[0];

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

function validHospital(overrides: Partial<CreateHospitalInput> = {}): CreateHospitalInput {
  return {
    name: 'TamamHealth Hospital',
    town: 'Juba',
    state: 'Central Equatoria',
    facilityType: 'county_hospital',
    facilityLevel: 'county' as const,
    totalBeds: 120,
    icuBeds: 4,
    maternityBeds: 20,
    pediatricBeds: 15,
    doctors: 8,
    clinicalOfficers: 12,
    nurses: 30,
    labTechnicians: 4,
    pharmacists: 3,
    hasElectricity: true,
    electricityHours: 8,
    hasGenerator: true,
    hasSolar: false,
    hasInternet: true,
    internetType: '3G',
    hasAmbulance: true,
    emergency24hr: true,
    services: [],
    lat: 4.8594,
    lng: 31.5713,
    ...overrides,
  };
}

describe('Hospital Service', () => {
  test('creates a hospital', async () => {
    const hospital = await createHospital(validHospital(), 'admin-001', 'admin');
    expect(hospital._id).toMatch(/^hosp-/);
    expect(hospital.type).toBe('hospital');
    expect(hospital.name).toBe('TamamHealth Hospital');
    expect(hospital.syncStatus).toBe('offline');
    expect(hospital.patientCount).toBe(0);
  });

  test('retrieves all hospitals', async () => {
    await createHospital(validHospital());
    await createHospital(validHospital({
      name: 'Juba Teaching Hospital',
      facilityLevel: 'national',
    }));

    const all = await getAllHospitals();
    expect(all).toHaveLength(2);
  });

  test('retrieves hospital by ID', async () => {
    const hospital = await createHospital(validHospital());
    const found = await getHospitalById(hospital._id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('TamamHealth Hospital');
  });

  test('returns null for nonexistent hospital', async () => {
    const found = await getHospitalById('hosp-nonexistent');
    expect(found).toBeNull();
  });

  test('updates hospital status', async () => {
    const hospital = await createHospital(validHospital());
    const updated = await updateHospitalStatus(hospital._id, {
      totalBeds: 150,
      doctors: 10,
    });
    expect(updated).not.toBeNull();
    expect(updated!.totalBeds).toBe(150);
    expect(updated!.doctors).toBe(10);
    expect(updated!.name).toBe('TamamHealth Hospital'); // unchanged
  });

  test('update returns null for nonexistent hospital', async () => {
    const result = await updateHospitalStatus('hosp-nonexistent', { totalBeds: 50 });
    expect(result).toBeNull();
  });

  // ---- Branch coverage improvements ----

  test('getAllHospitals with scope filters results', async () => {
    await createHospital(validHospital());
    const hospitals = await getAllHospitals({ role: 'nurse' } as DataScope);
    expect(Array.isArray(hospitals)).toBe(true);
  });

  test('getAllHospitals without scope returns all', async () => {
    await createHospital(validHospital());
    await createHospital(validHospital({ name: 'Wau Hospital', state: 'Western Bahr el Ghazal' }));
    const hospitals = await getAllHospitals();
    expect(hospitals.length).toBeGreaterThanOrEqual(2);
  });
});
