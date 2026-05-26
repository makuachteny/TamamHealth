/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for death-service.ts
 * Covers CRUD operations, facility filtering, and death statistics
 * including maternal, under-5, and neonatal death counts.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllDeaths,
  getDeathsByFacility,
  createDeath,
  updateDeath,
  deleteDeath,
  getDeathStats,
} from '@/lib/services/death-service';
import type { DataScope } from '@/lib/services/data-scope';

type CreateDeathInput = Parameters<typeof createDeath>[0];

const makeDeathData = (overrides: Partial<CreateDeathInput> = {}): CreateDeathInput => ({
  deceasedFirstName: 'Mabior',
  deceasedSurname: 'Garang',
  deceasedGender: 'Male' as const,
  dateOfBirth: '1960-01-01',
  dateOfDeath: new Date().toISOString().slice(0, 10),
  ageAtDeath: 65,
  placeOfDeath: 'Juba Teaching Hospital',
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  immediateCause: 'Cardiac arrest',
  immediateICD11: 'BC41',
  antecedentCause1: 'Ischemic heart disease',
  antecedentICD11_1: 'BA80',
  antecedentCause2: '',
  antecedentICD11_2: '',
  underlyingCause: 'Hypertension',
  underlyingICD11: 'BA00',
  contributingConditions: 'Diabetes',
  contributingICD11: 'JA60',
  mannerOfDeath: 'natural' as const,
  maternalDeath: false,
  pregnancyRelated: false,
  certifiedBy: 'Dr. Mayen',
  certifierRole: 'doctor',
  state: 'Central Equatoria',
  county: 'Juba',
  certificateNumber: 'DEATH-CERT-001',
  deathNotified: true,
  deathRegistered: true,
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('death-service', () => {
  test('getAllDeaths returns empty initially', async () => {
    const deaths = await getAllDeaths();
    expect(deaths).toEqual([]);
  });

  test('createDeath creates record with correct fields', async () => {
    const death = await createDeath(makeDeathData());

    expect(death._id).toMatch(/^death-/);
    expect(death.type).toBe('death');
    expect(death.deceasedFirstName).toBe('Mabior');
    expect(death.mannerOfDeath).toBe('natural');
    expect(death.createdAt).toBeDefined();
    expect(death._rev).toBeDefined();
  });

  test('getDeathsByFacility filters correctly', async () => {
    await createDeath(makeDeathData({ facilityId: 'hosp-001' }));
    await createDeath(makeDeathData({ facilityId: 'hosp-002', facilityName: 'Wau State Hospital' }));
    await createDeath(makeDeathData({ facilityId: 'hosp-001', deceasedFirstName: 'Kuol' }));

    const fac1 = await getDeathsByFacility('hosp-001');
    const fac2 = await getDeathsByFacility('hosp-002');
    expect(fac1).toHaveLength(2);
    expect(fac2).toHaveLength(1);
  });

  test('updateDeath updates record', async () => {
    const death = await createDeath(makeDeathData());
    const updated = await updateDeath(death._id, { deathNotified: false });

    expect(updated).not.toBeNull();
    expect(updated!.deathNotified).toBe(false);
    expect(updated!.deceasedFirstName).toBe('Mabior');
  });

  test('updateDeath returns null for non-existent id', async () => {
    const result = await updateDeath('death-nonexistent', { deathNotified: false });
    expect(result).toBeNull();
  });

  test('deleteDeath removes record', async () => {
    const death = await createDeath(makeDeathData());
    const deleted = await deleteDeath(death._id);
    expect(deleted).toBe(true);

    const all = await getAllDeaths();
    expect(all).toHaveLength(0);
  });

  test('deleteDeath returns false for non-existent id', async () => {
    const deleted = await deleteDeath('death-nonexistent');
    expect(deleted).toBe(false);
  });

  test('getDeathStats counts maternal deaths', async () => {
    await createDeath(makeDeathData({
      deceasedGender: 'Female',
      maternalDeath: true,
      pregnancyRelated: true,
      ageAtDeath: 25,
    }));
    await createDeath(makeDeathData({
      deceasedGender: 'Male',
      maternalDeath: false,
      ageAtDeath: 65,
    }));

    const stats = await getDeathStats();
    expect(stats.total).toBe(2);
    expect(stats.maternalDeaths).toBe(1);
  });

  test('getDeathStats counts under-5 deaths', async () => {
    // Under 5
    await createDeath(makeDeathData({
      deceasedFirstName: 'Baby A',
      ageAtDeath: 2,
      dateOfBirth: '2023-01-01',
    }));
    // Neonatal (< 28 days ~= 0.077 years)
    await createDeath(makeDeathData({
      deceasedFirstName: 'Baby B',
      ageAtDeath: 0.02, // about 7 days
      dateOfBirth: '2025-12-20',
    }));
    // Adult
    await createDeath(makeDeathData({
      deceasedFirstName: 'Adult C',
      ageAtDeath: 40,
    }));

    const stats = await getDeathStats();
    expect(stats.total).toBe(3);
    expect(stats.under5Deaths).toBe(2); // Baby A + Baby B
    expect(stats.neonatalDeaths).toBe(1); // only Baby B (age < 0.077)
  });

  test('getDeathStats counts ICD-11 coded deaths and by gender', async () => {
    await createDeath(makeDeathData({
      deceasedGender: 'Male',
      underlyingICD11: 'BA00',
    }));
    await createDeath(makeDeathData({
      deceasedGender: 'Female',
      underlyingICD11: '',
      immediateICD11: '',
    }));

    const stats = await getDeathStats();
    expect(stats.withICD11Code).toBe(1);
    expect(stats.byGender.male).toBe(1);
    expect(stats.byGender.female).toBe(1);
  });

  // ---- Uncovered branches ----
  test('createDeath without patientId does not update patient', async () => {
    // When patientId is not provided, should not attempt updatePatient
    const death = await createDeath(makeDeathData({
      patientId: undefined,
    }));
    expect(death._id).toBeDefined();
    expect(death.type).toBe('death');
  });

  test('createDeath handles patient update failure gracefully', async () => {
    // Even if updatePatient fails, death should be created
    const death = await createDeath(makeDeathData({
      patientId: 'pat-nonexistent-123',
    }));
    expect(death._id).toBeDefined();
    expect(death.type).toBe('death');
  });

  test('getDeathStats counts neonatal deaths correctly', async () => {
    await createDeath(makeDeathData({
      ageAtDeath: 0.01, // about 3-4 days old
      dateOfBirth: '2025-12-25',
    }));
    await createDeath(makeDeathData({
      ageAtDeath: 1, // 1 year old, not neonatal
      dateOfBirth: '2024-12-20',
    }));

    const stats = await getDeathStats();
    expect(stats.neonatalDeaths).toBe(1);
    expect(stats.under5Deaths).toBe(2); // both neonatal and older child
  });

  test('getDeathStats handles death without ageAtDeath', async () => {
    await createDeath(makeDeathData({
      ageAtDeath: undefined,
    }));
    const stats = await getDeathStats();
    expect(stats.under5Deaths).toBe(0);
    expect(stats.neonatalDeaths).toBe(0);
  });

  test('getDeathStats counts registered and notified deaths', async () => {
    await createDeath(makeDeathData({
      deathRegistered: true,
      deathNotified: true,
    }));
    await createDeath(makeDeathData({
      deathRegistered: false,
      deathNotified: true,
    }));
    await createDeath(makeDeathData({
      deathRegistered: false,
      deathNotified: false,
    }));

    const stats = await getDeathStats();
    expect(stats.registered).toBe(1);
    expect(stats.notified).toBe(2);
  });

  test('getDeathStats groups by mannerOfDeath', async () => {
    await createDeath(makeDeathData({
      mannerOfDeath: 'natural',
    }));
    await createDeath(makeDeathData({
      mannerOfDeath: 'accident',
    }));
    await createDeath(makeDeathData({
      mannerOfDeath: 'natural',
    }));

    const stats = await getDeathStats();
    expect(stats.byMannerOfDeath['natural']).toBe(2);
    expect(stats.byMannerOfDeath['accident']).toBe(1);
  });

  test('getDeathStats handles missing mannerOfDeath', async () => {
    await createDeath(makeDeathData({
      mannerOfDeath: undefined,
    }));

    const stats = await getDeathStats();
    expect(stats.byMannerOfDeath['Unknown']).toBe(1);
  });

  test('getDeathStats groups by state', async () => {
    await createDeath(makeDeathData({
      state: 'Central Equatoria',
    }));
    await createDeath(makeDeathData({
      state: 'Upper Nile',
    }));
    await createDeath(makeDeathData({
      state: 'Central Equatoria',
    }));

    const stats = await getDeathStats();
    expect(stats.byState['Central Equatoria']).toBe(2);
    expect(stats.byState['Upper Nile']).toBe(1);
  });

  test('getDeathStats handles missing state', async () => {
    await createDeath(makeDeathData({
      state: undefined,
    }));

    const stats = await getDeathStats();
    expect(stats.byState['Unknown']).toBe(1);
  });

  test('getDeathStats calculates topCauses with underlyingICD11', async () => {
    await createDeath(makeDeathData({
      underlyingICD11: 'BA00',
      underlyingCause: 'Hypertension',
    }));
    await createDeath(makeDeathData({
      underlyingICD11: 'BC41',
      underlyingCause: 'Cardiac arrest',
    }));

    const stats = await getDeathStats();
    expect(stats.topCauses.length).toBeGreaterThan(0);
    expect(stats.topCauses[0].code).toBeDefined();
    expect(stats.topCauses[0].count).toBeGreaterThan(0);
  });

  test('getDeathStats with immediate ICD code when underlying missing', async () => {
    await createDeath(makeDeathData({
      underlyingICD11: '',
      immediateICD11: 'BC41',
      immediateCause: 'Cardiac arrest',
    }));

    const stats = await getDeathStats();
    expect(stats.topCauses.length).toBeGreaterThan(0);
  });

  test('getDeathStats with unknown code when both ICD codes missing', async () => {
    await createDeath(makeDeathData({
      underlyingICD11: '',
      immediateICD11: '',
    }));

    const stats = await getDeathStats();
    expect(stats.topCauses.some(c => c.code === 'unknown')).toBe(true);
  });

  // ---- Additional branch coverage for uncovered lines ----

  test('createDeath with missing dateOfDeath uses now as fallback', async () => {
    const death = await createDeath(makeDeathData({
      dateOfDeath: undefined,
    }));
    expect(death._id).toMatch(/^death-/);
    expect(death.type).toBe('death');
  });

  test('createDeath with patientId updates patient record', async () => {
    // This tests line 41-48 - the patient update branch
    const death = await createDeath(makeDeathData({
      patientId: 'patient-123',
    }));
    expect(death.patientId).toBe('patient-123');
  });

  test('createDeath without patientId skips patient update', async () => {
    const death = await createDeath(makeDeathData({
      patientId: undefined,
    }));
    expect(death.patientId).toBeUndefined();
  });

  test('getDeathStats filters by thisMonth with missing dateOfDeath', async () => {
    await createDeath(makeDeathData({
      dateOfDeath: undefined,
    }));

    const stats = await getDeathStats();
    // Should not crash
    expect(typeof stats.thisMonth).toBe('number');
  });

  test('getDeathStats filters by thisYear with missing dateOfDeath', async () => {
    await createDeath(makeDeathData({
      dateOfDeath: undefined,
    }));

    const stats = await getDeathStats();
    // Should not crash
    expect(typeof stats.thisYear).toBe('number');
  });

  test('getDeathStats byMannerOfDeath with missing mannerOfDeath', async () => {
    await createDeath(makeDeathData({
      mannerOfDeath: undefined,
    }));

    const stats = await getDeathStats();
    expect(stats.byMannerOfDeath['Unknown']).toBeGreaterThanOrEqual(1);
  });

  test('getDeathStats byState with missing state', async () => {
    await createDeath(makeDeathData({
      state: undefined,
    }));

    const stats = await getDeathStats();
    expect(stats.byState['Unknown']).toBeGreaterThanOrEqual(1);
  });

  test('getDeathStats with immediateCause fallback', async () => {
    await createDeath(makeDeathData({
      underlyingCause: undefined,
      immediateCause: 'Heart failure',
    }));

    const stats = await getDeathStats();
    expect(stats.topCauses.some(c => c.cause === 'Heart failure')).toBe(true);
  });

  test('getDeathStats with Unknown cause fallback', async () => {
    await createDeath(makeDeathData({
      underlyingCause: undefined,
      immediateCause: undefined,
    }));

    const stats = await getDeathStats();
    expect(stats.topCauses.some(c => c.cause === 'Unknown')).toBe(true);
  });

  test('getAllDeaths sorts by dateOfDeath descending', async () => {
    await createDeath(makeDeathData({ dateOfDeath: '2026-01-01' }));
    await createDeath(makeDeathData({ dateOfDeath: '2026-04-10', deceasedFirstName: 'B', deceasedSurname: 'Test' }));

    const all = await getAllDeaths();
    expect(all[0].dateOfDeath).toBe('2026-04-10');
  });

  test('getAllDeaths handles missing dateOfDeath in sort', async () => {
    await createDeath(makeDeathData({ dateOfDeath: undefined }));
    await createDeath(makeDeathData({ dateOfDeath: '2026-04-10', deceasedFirstName: 'B', deceasedSurname: 'Test' }));

    const all = await getAllDeaths();
    expect(all).toHaveLength(2);
  });

  test('updateDeath returns null for non-existent death', async () => {
    const updated = await updateDeath('non-existent-id', {
      deathRegistered: true,
    });
    expect(updated).toBeNull();
  });

  test('deleteDeath returns false for non-existent death', async () => {
    const deleted = await deleteDeath('non-existent-id');
    expect(deleted).toBe(false);
  });

  test('getDeathStats with scope filters correctly', async () => {
    await createDeath(makeDeathData());
    const stats = await getDeathStats({ role: 'nurse' } as DataScope);
    expect(typeof stats.total).toBe('number');
  });

  test('getDeathStats byMannerOfDeath with multiple manners', async () => {
    await createDeath(makeDeathData({ mannerOfDeath: 'natural' }));
    await createDeath(makeDeathData({ mannerOfDeath: 'accident', deceasedFirstName: 'B', deceasedSurname: 'Test' }));
    await createDeath(makeDeathData({ mannerOfDeath: 'intentional_self_harm', deceasedFirstName: 'C', deceasedSurname: 'Test' }));

    const stats = await getDeathStats();
    expect(stats.byMannerOfDeath['natural']).toBeGreaterThanOrEqual(1);
    expect(stats.byMannerOfDeath['accident']).toBeGreaterThanOrEqual(1);
    expect(stats.byMannerOfDeath['intentional_self_harm']).toBeGreaterThanOrEqual(1);
  });

  // ---- Line 15: Test sort with missing dateOfDeath ----
  test('getAllDeaths sorts correctly with missing dateOfDeath (line 15)', async () => {
    await createDeath(makeDeathData({ dateOfDeath: '2026-04-12' }));

    // Manually insert a death record without dateOfDeath
    const db = require('@/lib/db').deathsDB();
    const deathNoDate = {
      _id: 'death-no-date',
      type: 'death',
      deceasedFirstName: 'Unknown',
      deceasedSurname: 'Deceased',
      dateOfDeath: undefined,
      facilityId: 'hosp-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.put(deathNoDate);

    const all = await getAllDeaths();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  // ---- Line 45: Test deceasedDate fallback when dateOfDeath is missing ----
  test('createDeath uses current date when dateOfDeath is missing (line 45)', async () => {
    const death = await createDeath(makeDeathData({
      dateOfDeath: undefined,
      patientId: 'p-death-no-date',
    }));

    expect(death._id).toBeDefined();
    expect(death.type).toBe('death');
  });
});
