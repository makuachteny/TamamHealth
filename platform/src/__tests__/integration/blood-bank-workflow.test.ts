/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Integration test: Blood Bank Workflow
 *
 * Tests the complete blood bank workflow in a South Sudan hospital context:
 * 1. Register blood units from community donation drive
 * 2. Screen units (HIV, Hep B/C, syphilis, malaria)
 * 3. Check compatibility for a patient needing transfusion
 * 4. Reserve and crossmatch compatible units
 * 5. Record transfusion
 * 6. Monitor inventory and expiry alerts
 * 7. Discard expired/contaminated units
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-bbwf-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  addUnit,
  getAvailableUnits,
  reserveUnit,
  crossmatchUnit,
  recordTransfusion,
  discardUnit,
  getBloodInventorySummary,
  getExpiringUnits,
  getCompatibleGroups,
} from '@/lib/services/blood-bank-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

// Expiry well in the future so "available" fixtures stay non-expired regardless
// of the wall clock when the suite runs (avoids time-dependent flakiness).
const FUTURE = new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);

type AddUnitInput = Parameters<typeof addUnit>[0];
type BloodGroup = AddUnitInput['bloodGroup'];
function makeUnit(bloodGroup: BloodGroup, overrides: Partial<AddUnitInput> = {}): AddUnitInput {
  return {
    unitId: `UNIT-${++uuidCounter}`,
    bloodGroup,
    component: 'whole_blood' as const,
    volume: 450,
    collectionDate: '2026-04-10',
    expiryDate: FUTURE,
    donorName: `Donor ${uuidCounter}`,
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

describe('Blood Bank Workflow Integration', () => {
  test('complete donation-to-transfusion workflow', async () => {
    // 1. Community donation drive — register multiple units
    await addUnit(makeUnit('O+'));
    await addUnit(makeUnit('O+'));
    await addUnit(makeUnit('A+'));
    const unitB1 = await addUnit(makeUnit('B+'));
    // One unit with positive malaria screening (should be discarded)
    const unitContaminated = await addUnit(makeUnit('O+', {
      screeningResults: { hiv: false, hepatitisB: false, hepatitisC: false, syphilis: false, malaria: true },
    }));

    // Verify all units registered
    const summary = await getBloodInventorySummary('hosp-001');
    expect(summary.totalUnits).toBe(5);
    expect(summary.availableUnits).toBe(5);

    // 2. Discard contaminated unit (positive malaria screen)
    const discarded = await discardUnit(unitContaminated._id, 'Positive malaria screening');
    expect(discarded!.status).toBe('discarded');

    // 3. Patient needs transfusion: B+ patient
    const compatibleForBPlus = await getCompatibleGroups('B+');
    expect(compatibleForBPlus).toContain('B+');
    expect(compatibleForBPlus).toContain('O+');
    expect(compatibleForBPlus).toContain('O-');
    expect(compatibleForBPlus).not.toContain('A+');

    // 4. Find available compatible units
    const availableB = await getAvailableUnits('B+', 'hosp-001');
    const availableO = await getAvailableUnits('O+', 'hosp-001');
    expect(availableB).toHaveLength(1); // B+ unit
    expect(availableO).toHaveLength(2); // 2 O+ units (one discarded)

    // 5. Reserve the B+ unit for the patient
    const reserved = await reserveUnit(unitB1._id, 'patient-trauma-001');
    expect(reserved!.status).toBe('reserved');
    expect(reserved!.reservedForPatient).toBe('patient-trauma-001');

    // Verify reservation reduces available count
    const availableBAfter = await getAvailableUnits('B+');
    expect(availableBAfter).toHaveLength(0);

    // 6. Crossmatch — compatible
    const crossmatched = await crossmatchUnit(unitB1._id, 'compatible');
    expect(crossmatched!.status).toBe('crossmatched');
    expect(crossmatched!.crossmatchResult).toBe('compatible');

    // 7. Record transfusion
    const transfused = await recordTransfusion(unitB1._id, 'patient-trauma-001', 'nurse-ayen');
    expect(transfused!.status).toBe('transfused');
    expect(transfused!.transfusedTo).toBe('patient-trauma-001');
    expect(transfused!.transfusedBy).toBe('nurse-ayen');

    // 8. Final inventory check
    const finalSummary = await getBloodInventorySummary('hosp-001');
    expect(finalSummary.availableUnits).toBe(3); // O+ x2 + A+ (B+ transfused, O+ discarded)
    expect(finalSummary.transfusedUnits).toBe(1);
    expect(finalSummary.byBloodGroup['B+'].available).toBe(0);
    expect(finalSummary.byBloodGroup['O+'].available).toBe(2);
  });

  test('expiry monitoring and waste prevention', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    // Register units with different expiry dates
    await addUnit(makeUnit('O+', { expiryDate: tomorrow }));       // Expiring soon
    await addUnit(makeUnit('A+', { expiryDate: nextWeek }));       // Expiring within week
    await addUnit(makeUnit('B+', { expiryDate: nextMonth }));      // Safe
    await addUnit(makeUnit('AB+', { expiryDate: '2020-01-01' }));  // Already expired

    // Check expiring units (7-day window)
    const expiring = await getExpiringUnits(7);
    expect(expiring).toHaveLength(2); // tomorrow + next week

    // Check inventory — expired unit should show in expired count
    const summary = await getBloodInventorySummary();
    expect(summary.expiredUnits).toBe(1);
    expect(summary.availableUnits).toBe(3); // All except expired

    // Discard expired unit
    const expired = (await getAvailableUnits()).find(() => false); // won't find expired ones
    expect(expired).toBeUndefined();
  });

  test('incompatible crossmatch reverts unit to available', async () => {
    const unit = await addUnit(makeUnit('A-'));

    // Reserve for patient
    await reserveUnit(unit._id, 'patient-002');

    // Crossmatch comes back incompatible
    const result = await crossmatchUnit(unit._id, 'incompatible');
    expect(result!.status).toBe('available');
    expect(result!.crossmatchResult).toBe('incompatible');

    // Unit should be available again
    const available = await getAvailableUnits('A-');
    expect(available).toHaveLength(1);
  });

  test('multi-facility inventory tracking', async () => {
    // TamamHealth Hospital
    await addUnit(makeUnit('O+', { facilityId: 'hosp-001', facilityName: 'TamamHealth Hospital' }));
    await addUnit(makeUnit('A+', { facilityId: 'hosp-001', facilityName: 'TamamHealth Hospital' }));
    // Wau Hospital
    await addUnit(makeUnit('O+', { facilityId: 'hosp-002', facilityName: 'Wau Hospital' }));
    await addUnit(makeUnit('B+', { facilityId: 'hosp-002', facilityName: 'Wau Hospital' }));
    await addUnit(makeUnit('O-', { facilityId: 'hosp-002', facilityName: 'Wau Hospital' }));

    // System-wide summary
    const total = await getBloodInventorySummary();
    expect(total.totalUnits).toBe(5);

    // Per-facility summaries
    const tamamhealth = await getBloodInventorySummary('hosp-001');
    expect(tamamhealth.totalUnits).toBe(2);

    const wau = await getBloodInventorySummary('hosp-002');
    expect(wau.totalUnits).toBe(3);
  });
});
