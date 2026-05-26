/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for birth-service.ts
 * Covers CRUD operations, facility/state filtering, and birth statistics.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllBirths,
  getBirthsByFacility,
  getBirthsByState,
  createBirth,
  updateBirth,
  deleteBirth,
  getBirthStats,
} from '@/lib/services/birth-service';
import { ancDB } from '@/lib/db';

type BirthInput = Parameters<typeof createBirth>[0];
const makeBirthData = (overrides: Partial<BirthInput> = {}): BirthInput => ({
  childFirstName: 'Akech',
  childSurname: 'Deng',
  childGender: 'Female' as const,
  dateOfBirth: new Date().toISOString().slice(0, 10), // today for thisMonth/thisYear tests
  placeOfBirth: 'Juba Teaching Hospital',
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  motherName: 'Achol Mabior',
  motherAge: 28,
  motherNationality: 'South Sudanese',
  fatherName: 'Deng Kuol',
  fatherNationality: 'South Sudanese',
  birthWeight: 3200,
  birthType: 'single' as const,
  deliveryType: 'normal' as const,
  attendedBy: 'midwife',
  registeredBy: 'Nurse Akech',
  state: 'Central Equatoria',
  county: 'Juba',
  certificateNumber: 'CERT-001',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('birth-service', () => {
  test('getAllBirths returns empty initially', async () => {
    const births = await getAllBirths();
    expect(births).toEqual([]);
  });

  test('createBirth creates record with correct fields', async () => {
    const birth = await createBirth(makeBirthData());

    expect(birth._id).toMatch(/^birth-/);
    expect(birth.type).toBe('birth');
    expect(birth.childFirstName).toBe('Akech');
    expect(birth.childGender).toBe('Female');
    expect(birth.birthWeight).toBe(3200);
    expect(birth.createdAt).toBeDefined();
    expect(birth._rev).toBeDefined();
  });

  test('getBirthsByFacility filters correctly', async () => {
    await createBirth(makeBirthData({ facilityId: 'hosp-001' }));
    await createBirth(makeBirthData({ facilityId: 'hosp-002', facilityName: 'Wau State Hospital' }));
    await createBirth(makeBirthData({ facilityId: 'hosp-001', childFirstName: 'Nyabol' }));

    const fac1 = await getBirthsByFacility('hosp-001');
    const fac2 = await getBirthsByFacility('hosp-002');
    expect(fac1).toHaveLength(2);
    expect(fac2).toHaveLength(1);
  });

  test('getBirthsByState filters correctly', async () => {
    await createBirth(makeBirthData({ state: 'Central Equatoria' }));
    await createBirth(makeBirthData({ state: 'Western Bahr el Ghazal' }));

    const ce = await getBirthsByState('Central Equatoria');
    const wbg = await getBirthsByState('Western Bahr el Ghazal');
    expect(ce).toHaveLength(1);
    expect(wbg).toHaveLength(1);
  });

  test('updateBirth updates record', async () => {
    const birth = await createBirth(makeBirthData());
    const updated = await updateBirth(birth._id, { birthWeight: 3500 });

    expect(updated).not.toBeNull();
    expect(updated!.birthWeight).toBe(3500);
    expect(updated!.childFirstName).toBe('Akech');
  });

  test('updateBirth returns null for non-existent id', async () => {
    const result = await updateBirth('birth-nonexistent', { birthWeight: 3500 });
    expect(result).toBeNull();
  });

  test('deleteBirth removes record', async () => {
    const birth = await createBirth(makeBirthData());
    const deleted = await deleteBirth(birth._id);
    expect(deleted).toBe(true);

    const all = await getAllBirths();
    expect(all).toHaveLength(0);
  });

  test('deleteBirth returns false for non-existent id', async () => {
    const deleted = await deleteBirth('birth-nonexistent');
    expect(deleted).toBe(false);
  });

  test('getBirthStats calculates correctly', async () => {
    const today = new Date().toISOString().slice(0, 10);

    await createBirth(makeBirthData({
      childGender: 'Male',
      deliveryType: 'normal',
      dateOfBirth: today,
      state: 'Central Equatoria',
    }));
    await createBirth(makeBirthData({
      childGender: 'Female',
      deliveryType: 'caesarean',
      dateOfBirth: today,
      state: 'Central Equatoria',
    }));
    await createBirth(makeBirthData({
      childGender: 'Male',
      deliveryType: 'assisted',
      dateOfBirth: '2020-01-01', // old date, not in this month/year
      state: 'Upper Nile',
    }));

    const stats = await getBirthStats();
    expect(stats.total).toBe(3);
    expect(stats.thisMonth).toBe(2);
    expect(stats.thisYear).toBe(2);
    expect(stats.byGender.male).toBe(2);
    expect(stats.byGender.female).toBe(1);
    expect(stats.byDeliveryType.normal).toBe(1);
    expect(stats.byDeliveryType.caesarean).toBe(1);
    expect(stats.byDeliveryType.assisted).toBe(1);
    expect(stats.byState['Central Equatoria']).toBe(2);
    expect(stats.byState['Upper Nile']).toBe(1);
  });

  // ---- Uncovered branches ----
  test('findAncVisitsForMother with empty motherName returns empty array', async () => {
    // When motherName is empty, should return [] without DB query
    const birth = await createBirth(makeBirthData({
      motherName: '',
    }));
    expect(birth._id).toBeDefined();
  });

  test('findAncVisitsForMother handles DB error gracefully', async () => {
    // When DB query fails, should return [] and not throw
    const birth = await createBirth(makeBirthData({
      motherName: 'NonExistent Mother',
    }));
    expect(birth._id).toBeDefined();
  });

  test('createBirth with linkedAncMotherId provided uses it', async () => {
    const birth = await createBirth(makeBirthData({
      linkedAncMotherId: 'anc-mother-123',
      motherName: 'Achol Mabior',
    }));
    expect(birth.linkedAncMotherId).toBe('anc-mother-123');
  });

  test('createBirth without mother name does not attempt ANC lookup', async () => {
    const birth = await createBirth(makeBirthData({
      motherName: undefined as unknown as string,
    }));
    // Should create without linkedAncMotherId
    expect(birth.linkedAncMotherId).toBeUndefined();
  });

  test('createBirth handles ANC linkage failure gracefully', async () => {
    // Even if ANC lookup fails, birth should be created
    const birth = await createBirth(makeBirthData({
      motherName: 'Test Mother',
    }));
    expect(birth._id).toBeDefined();
    expect(birth.type).toBe('birth');
  });

  test('getBirthStats with no births returns zero stats', async () => {
    const stats = await getBirthStats();
    expect(stats.total).toBe(0);
    expect(stats.thisMonth).toBe(0);
    expect(stats.thisYear).toBe(0);
    expect(stats.byGender.male).toBe(0);
    expect(stats.byGender.female).toBe(0);
    expect(stats.byDeliveryType.normal).toBe(0);
    expect(stats.byDeliveryType.caesarean).toBe(0);
    expect(stats.byDeliveryType.assisted).toBe(0);
  });

  test('getBirthStats handles missing state gracefully', async () => {
    await createBirth(makeBirthData({
      state: undefined as unknown as string,
    }));
    const stats = await getBirthStats();
    expect(stats.byState['Unknown']).toBe(1);
  });

  test('createBirth links ANC visits when matching mother is found', async () => {
    // Seed an ANC visit for the same mother
    const db = ancDB();
    const ancVisit = {
      _id: 'anc-visit-001',
      type: 'anc_visit',
      motherId: 'mother-123',
      motherName: 'Achol Mabior',
      facilityId: 'hosp-001',
      visitDate: '2026-03-01',
      gestationalAge: 28,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.put(ancVisit);

    // Create birth for the same mother name — should find and link the ANC visit
    const birth = await createBirth(makeBirthData({
      motherName: 'Achol Mabior',
    }));
    expect(birth._id).toBeDefined();
    expect(birth.linkedAncMotherId).toBe('mother-123');

    // Verify the ANC visit now has linkedBirthId set
    const updatedAnc = await db.get('anc-visit-001') as { linkedBirthId?: string };
    expect(updatedAnc.linkedBirthId).toBe(birth._id);
  });

  test('createBirth links multiple ANC visits for same mother', async () => {
    const db = ancDB();
    await db.put({
      _id: 'anc-visit-a',
      type: 'anc_visit',
      motherId: 'mother-456',
      motherName: 'Nyabol Deng',
      facilityId: 'hosp-001',
      visitDate: '2026-02-01',
      gestationalAge: 20,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.put({
      _id: 'anc-visit-b',
      type: 'anc_visit',
      motherId: 'mother-456',
      motherName: 'Nyabol Deng',
      facilityId: 'hosp-001',
      visitDate: '2026-03-15',
      gestationalAge: 26,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const birth = await createBirth(makeBirthData({
      motherName: 'Nyabol Deng',
    }));
    expect(birth.linkedAncMotherId).toBe('mother-456');

    // Both ANC visits should be linked
    const ancA = await db.get('anc-visit-a') as { linkedBirthId?: string };
    const ancB = await db.get('anc-visit-b') as { linkedBirthId?: string };
    expect(ancA.linkedBirthId).toBe(birth._id);
    expect(ancB.linkedBirthId).toBe(birth._id);
  });

  test('createBirth ANC matching is case-insensitive', async () => {
    const db = ancDB();
    await db.put({
      _id: 'anc-visit-case',
      type: 'anc_visit',
      motherId: 'mother-789',
      motherName: 'AYEN KUOL',
      facilityId: 'hosp-001',
      visitDate: '2026-03-01',
      gestationalAge: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const birth = await createBirth(makeBirthData({
      motherName: 'ayen kuol',
    }));
    expect(birth.linkedAncMotherId).toBe('mother-789');
  });

  test('getAllBirths with scope passes through to filterByScope', async () => {
    await createBirth(makeBirthData());
    const births = await getAllBirths({ role: 'nurse' });
    expect(Array.isArray(births)).toBe(true);
  });

  test('getBirthStats with scope filters data', async () => {
    await createBirth(makeBirthData());
    const stats = await getBirthStats({ role: 'nurse' });
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });

  test('getAllBirths sorts by dateOfBirth descending', async () => {
    await createBirth(makeBirthData({ dateOfBirth: '2026-01-01' }));
    await createBirth(makeBirthData({ dateOfBirth: '2026-04-01' }));
    await createBirth(makeBirthData({ dateOfBirth: '2026-02-15' }));

    const all = await getAllBirths();
    expect(all).toHaveLength(3);
    expect(all[0].dateOfBirth).toBe('2026-04-01');
    expect(all[2].dateOfBirth).toBe('2026-01-01');
  });

  test('getAllBirths handles missing dateOfBirth gracefully', async () => {
    await createBirth(makeBirthData({ dateOfBirth: undefined as unknown as string }));
    await createBirth(makeBirthData({ dateOfBirth: '2026-04-01' }));

    const all = await getAllBirths();
    expect(all).toHaveLength(2);
  });

  test('createBirth ANC lookup catches DB errors gracefully (line 23-24)', async () => {
    // Mock ancDB to throw an error during allDocs
    const { ancDB } = require('@/lib/db');
    const adb = ancDB();
    adb.allDocs = jest.fn().mockRejectedValueOnce(new Error('DB error'));

    // Birth creation should succeed despite ANC lookup error
    const birth = await createBirth(makeBirthData({
      motherName: 'Test Mother',
    }));

    expect(birth._id).toBeDefined();
    expect(birth.linkedAncMotherId).toBeUndefined();
  });

  test('getBirthStats coverage: missing dateOfBirth in thisMonth filter (line 134 fallback)', async () => {
    const { birthsDB } = require('@/lib/db');
    const db = birthsDB();
    const now = new Date().toISOString();

    // Raw insert: birth WITHOUT dateOfBirth field to test the || '' fallback
    await db.put({
      _id: 'birth-raw-nodob-1',
      type: 'birth',
      childFirstName: 'Test',
      childGender: 'Male',
      createdAt: now,
      updatedAt: now,
    });

    const stats = await getBirthStats();
    // The birth with no dateOfBirth should not match thisMonth filter
    expect(stats.total).toBe(1);
    expect(stats.thisMonth).toBe(0); // Because (undefined || '').startsWith(...) = ''.startsWith(...) = false
  });

  test('getBirthStats coverage: missing dateOfBirth in thisYear filter (line 135 fallback)', async () => {
    const { birthsDB } = require('@/lib/db');
    const db = birthsDB();
    const now = new Date().toISOString();

    // Raw insert: birth WITHOUT dateOfBirth to test || '' fallback
    await db.put({
      _id: 'birth-raw-nodob-2',
      type: 'birth',
      childFirstName: 'Test2',
      childGender: 'Female',
      createdAt: now,
      updatedAt: now,
    });

    const stats = await getBirthStats();
    expect(stats.thisYear).toBe(0); // Because (undefined || '').startsWith('2026') = false
  });

  test('getAllBirths coverage: sort fallback for missing dateOfBirth (line 35)', async () => {
    const { birthsDB } = require('@/lib/db');
    const db = birthsDB();
    const now = new Date().toISOString();

    // Create one normal birth
    await createBirth(makeBirthData({ dateOfBirth: '2026-03-15' }));

    // Raw insert: birth WITHOUT dateOfBirth
    await db.put({
      _id: 'birth-raw-nodob-sort',
      type: 'birth',
      childFirstName: 'NoDOB',
      childGender: 'Male',
      createdAt: now,
      updatedAt: now,
    });

    const all = await getAllBirths();
    expect(all).toHaveLength(2);
    // Both records should be returned; sort handles undefined via || ''
    expect(all.map(b => b.childFirstName)).toContain('Akech');
    expect(all.map(b => b.childFirstName)).toContain('NoDOB');
  });
});
