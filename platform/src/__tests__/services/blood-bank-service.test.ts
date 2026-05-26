/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for blood-bank-service.ts
 * Covers unit CRUD, reservation, crossmatch, transfusion, discard,
 * inventory summary, expiry tracking, and blood group compatibility.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-blood-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllUnits,
  getAvailableUnits,
  addUnit,
  updateUnit,
  reserveUnit,
  crossmatchUnit,
  recordTransfusion,
  discardUnit,
  getBloodInventorySummary,
  getExpiringUnits,
  getCompatibleGroups,
} from '@/lib/services/blood-bank-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type AddUnitInput = Parameters<typeof addUnit>[0];
function validUnit(overrides: Partial<AddUnitInput> = {}): AddUnitInput {
  return {
    unitId: 'UNIT-001',
    bloodGroup: 'O+' as const,
    component: 'whole_blood' as const,
    volume: 450,
    collectionDate: '2026-04-01',
    expiryDate: '2026-05-15',
    donorId: 'donor-001',
    donorName: 'John Deng',
    status: 'available' as const,
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    screeningResults: {
      hiv: false,
      hepatitisB: false,
      hepatitisC: false,
      syphilis: false,
      malaria: false,
    },
    ...overrides,
  };
}

describe('Blood Bank Service', () => {
  test('adds a blood unit', async () => {
    const unit = await addUnit(validUnit());
    expect(unit._id).toMatch(/^blood-/);
    expect(unit.type).toBe('blood_bank');
    expect(unit.bloodGroup).toBe('O+');
    expect(unit.volume).toBe(450);
    expect(unit.createdAt).toBeDefined();
  });

  test('retrieves all units sorted by expiry date', async () => {
    await addUnit(validUnit({ expiryDate: '2026-06-01', unitId: 'U1' }));
    await addUnit(validUnit({ expiryDate: '2026-05-01', unitId: 'U2' }));
    await addUnit(validUnit({ expiryDate: '2026-05-15', unitId: 'U3' }));

    const all = await getAllUnits();
    expect(all).toHaveLength(3);
    expect(all[0].expiryDate).toBe('2026-05-01');
    expect(all[2].expiryDate).toBe('2026-06-01');
  });

  test('getAllUnits with scope', async () => {
    await addUnit(validUnit());
    const all = await getAllUnits({ role: 'nurse' });
    expect(Array.isArray(all)).toBe(true);
  });

  test('getAvailableUnits returns only available non-expired units', async () => {
    await addUnit(validUnit({ status: 'available', expiryDate: '2026-06-01' }));
    await addUnit(validUnit({ status: 'reserved', expiryDate: '2026-06-01', unitId: 'U2' }));
    // Expired unit
    await addUnit(validUnit({ status: 'available', expiryDate: '2020-01-01', unitId: 'U3' }));

    const available = await getAvailableUnits();
    expect(available).toHaveLength(1);
    expect(available[0].status).toBe('available');
  });

  test('getAvailableUnits filters by blood group', async () => {
    await addUnit(validUnit({ bloodGroup: 'O+' }));
    await addUnit(validUnit({ bloodGroup: 'A+', unitId: 'U2' }));

    const oPositive = await getAvailableUnits('O+');
    expect(oPositive).toHaveLength(1);
    expect(oPositive[0].bloodGroup).toBe('O+');
  });

  test('getAvailableUnits filters by facility', async () => {
    await addUnit(validUnit({ facilityId: 'hosp-001' }));
    await addUnit(validUnit({ facilityId: 'hosp-002', facilityName: 'Other', unitId: 'U2' }));

    const result = await getAvailableUnits(undefined, 'hosp-001');
    expect(result).toHaveLength(1);
  });

  test('updates a unit', async () => {
    const unit = await addUnit(validUnit());
    const updated = await updateUnit(unit._id, { volume: 400 });
    expect(updated).not.toBeNull();
    expect(updated!.volume).toBe(400);
    expect(updated!.bloodGroup).toBe('O+');
  });

  test('update returns null for nonexistent unit', async () => {
    const result = await updateUnit('nonexistent', { volume: 400 });
    expect(result).toBeNull();
  });

  test('reserves a unit for a patient', async () => {
    const unit = await addUnit(validUnit());
    const reserved = await reserveUnit(unit._id, 'patient-001');
    expect(reserved).not.toBeNull();
    expect(reserved!.status).toBe('reserved');
    expect(reserved!.reservedForPatient).toBe('patient-001');
  });

  test('reserve returns null for already-reserved unit', async () => {
    const unit = await addUnit(validUnit({ status: 'reserved' }));
    const result = await reserveUnit(unit._id, 'patient-002');
    // Should return null because status is not 'available'
    expect(result).toBeNull();
  });

  test('reserve returns null for nonexistent unit', async () => {
    const result = await reserveUnit('nonexistent', 'patient-001');
    expect(result).toBeNull();
  });

  test('crossmatch sets compatible status', async () => {
    const unit = await addUnit(validUnit());
    const result = await crossmatchUnit(unit._id, 'compatible');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('crossmatched');
    expect(result!.crossmatchResult).toBe('compatible');
  });

  test('crossmatch incompatible reverts to available', async () => {
    const unit = await addUnit(validUnit());
    const result = await crossmatchUnit(unit._id, 'incompatible');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('available');
    expect(result!.crossmatchResult).toBe('incompatible');
  });

  test('crossmatch returns null for nonexistent unit', async () => {
    const result = await crossmatchUnit('nonexistent', 'compatible');
    expect(result).toBeNull();
  });

  test('records a transfusion', async () => {
    const unit = await addUnit(validUnit());
    const result = await recordTransfusion(unit._id, 'patient-001', 'nurse-001');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('transfused');
    expect(result!.transfusedTo).toBe('patient-001');
    expect(result!.transfusedBy).toBe('nurse-001');
    expect(result!.transfusedAt).toBeDefined();
  });

  test('transfusion returns null for nonexistent unit', async () => {
    const result = await recordTransfusion('nonexistent', 'patient-001', 'nurse-001');
    expect(result).toBeNull();
  });

  test('discards a unit with reason', async () => {
    const unit = await addUnit(validUnit());
    const result = await discardUnit(unit._id, 'Expired - not used in time');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('discarded');
    expect(result!.notes).toContain('Expired');
  });

  test('discard returns null for nonexistent unit', async () => {
    const result = await discardUnit('nonexistent', 'reason');
    expect(result).toBeNull();
  });

  test('getBloodInventorySummary returns complete breakdown', async () => {
    await addUnit(validUnit({ bloodGroup: 'O+', status: 'available', expiryDate: '2026-06-01' }));
    await addUnit(validUnit({ bloodGroup: 'O+', status: 'reserved', expiryDate: '2026-06-01', unitId: 'U2' }));
    await addUnit(validUnit({ bloodGroup: 'A+', status: 'available', expiryDate: '2026-06-01', unitId: 'U3' }));
    await addUnit(validUnit({ bloodGroup: 'O-', status: 'transfused', expiryDate: '2026-06-01', unitId: 'U4' }));
    // Expired unit
    await addUnit(validUnit({ bloodGroup: 'B+', status: 'available', expiryDate: '2020-01-01', unitId: 'U5' }));

    const summary = await getBloodInventorySummary();
    expect(summary.totalUnits).toBe(5);
    expect(summary.availableUnits).toBe(2); // O+ and A+ (non-expired available)
    expect(summary.reservedUnits).toBe(1);
    expect(summary.transfusedUnits).toBe(1);
    expect(summary.expiredUnits).toBe(1);
    expect(summary.byBloodGroup['O+']).toBeDefined();
    expect(summary.byBloodGroup['O+'].total).toBe(2);
    expect(summary.byBloodGroup['O+'].available).toBe(1);
  });

  test('getBloodInventorySummary filters by facility', async () => {
    await addUnit(validUnit({ facilityId: 'hosp-001' }));
    await addUnit(validUnit({ facilityId: 'hosp-002', facilityName: 'Other', unitId: 'U2' }));

    const summary = await getBloodInventorySummary('hosp-001');
    expect(summary.totalUnits).toBe(1);
  });

  test('getExpiringUnits returns units expiring within threshold', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    await addUnit(validUnit({ expiryDate: tomorrow.toISOString().slice(0, 10), unitId: 'U1' }));
    await addUnit(validUnit({ expiryDate: nextWeek.toISOString().slice(0, 10), unitId: 'U2' }));
    await addUnit(validUnit({ expiryDate: nextMonth.toISOString().slice(0, 10), unitId: 'U3' }));

    const expiring = await getExpiringUnits(7);
    expect(expiring).toHaveLength(2); // tomorrow and next week
  });

  test('getExpiringUnits excludes non-available and already-expired', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await addUnit(validUnit({ expiryDate: tomorrow.toISOString().slice(0, 10), status: 'reserved', unitId: 'U1' }));
    await addUnit(validUnit({ expiryDate: '2020-01-01', status: 'available', unitId: 'U2' }));
    await addUnit(validUnit({ expiryDate: tomorrow.toISOString().slice(0, 10), status: 'available', unitId: 'U3' }));

    const expiring = await getExpiringUnits(7);
    expect(expiring).toHaveLength(1);
  });

  test('getCompatibleGroups returns correct compatibility', async () => {
    expect(await getCompatibleGroups('O+')).toEqual(['O+', 'O-']);
    expect(await getCompatibleGroups('O-')).toEqual(['O-']);
    expect(await getCompatibleGroups('AB+')).toHaveLength(8); // Universal recipient
    expect(await getCompatibleGroups('A+')).toEqual(['A+', 'A-', 'O+', 'O-']);
    expect(await getCompatibleGroups('B-')).toEqual(['B-', 'O-']);
  });

  test('getCompatibleGroups returns empty for unknown group', async () => {
    expect(await getCompatibleGroups('X+')).toEqual([]);
  });

  test('full workflow: add → reserve → crossmatch → transfuse', async () => {
    const unit = await addUnit(validUnit());
    expect(unit.status).toBe('available');

    const reserved = await reserveUnit(unit._id, 'patient-001');
    expect(reserved!.status).toBe('reserved');

    // Note: crossmatch works on the reserved unit (gets it by id, updates status)
    // The service doesn't check current status for crossmatch, just updates
    const crossmatched = await crossmatchUnit(unit._id, 'compatible');
    expect(crossmatched!.status).toBe('crossmatched');

    const transfused = await recordTransfusion(unit._id, 'patient-001', 'nurse-001');
    expect(transfused!.status).toBe('transfused');
    expect(transfused!.transfusedTo).toBe('patient-001');

    // Verify final state
    const all = await getAllUnits();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('transfused');
  });

  test('getExpiringUnits filters by facility', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await addUnit(validUnit({ expiryDate: tomorrow.toISOString().slice(0, 10), facilityId: 'hosp-001', unitId: 'U1' }));
    await addUnit(validUnit({ expiryDate: tomorrow.toISOString().slice(0, 10), facilityId: 'hosp-002', facilityName: 'Other', unitId: 'U2' }));

    const expiring = await getExpiringUnits(7, 'hosp-001');
    expect(expiring).toHaveLength(1);
    expect(expiring[0].facilityId).toBe('hosp-001');
  });

  test('crossmatch with pending status keeps available', async () => {
    const unit = await addUnit(validUnit());
    const result = await crossmatchUnit(unit._id, 'pending');
    expect(result).not.toBeNull();
    expect(result!.crossmatchResult).toBe('pending');
  });

  test('getBloodInventorySummary with crossmatched units', async () => {
    await addUnit(validUnit({ status: 'crossmatched', expiryDate: '2026-06-01' }));
    await addUnit(validUnit({ status: 'available', expiryDate: '2026-06-01', unitId: 'U2' }));

    const summary = await getBloodInventorySummary();
    expect(summary.crossmatchedUnits).toBe(1);
    expect(summary.totalUnits).toBe(2);
  });

  // ---- Line 204 (213): Test getExpiringUnits with facilityId filter true branch ----
  test('getExpiringUnits filters by facility when facilityId provided (line 213)', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Add units to multiple facilities
    await addUnit(validUnit({
      expiryDate: tomorrowStr,
      facilityId: 'hosp-001',
      unitId: 'U-expire-001',
      status: 'available',
    }));

    await addUnit(validUnit({
      expiryDate: tomorrowStr,
      facilityId: 'hosp-002',
      unitId: 'U-expire-002',
      status: 'available',
    }));

    // Get expiring units for hosp-001 only
    const expiring = await getExpiringUnits(7, 'hosp-001');
    expect(expiring.length).toBeGreaterThan(0);
    expect(expiring.every(u => u.facilityId === 'hosp-001')).toBe(true);
  });
});
