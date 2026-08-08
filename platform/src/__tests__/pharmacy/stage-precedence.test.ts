/**
 * Pharmacy — effective-stage derivation (src/lib/pharmacy-workflow.ts).
 *
 * The precedence rule is a safety guard: a `status: 'discontinued'` must win
 * over any stale `orderStatus` so a discontinued medication can never still
 * read as dispensable. Getting this order wrong would let a pharmacist dispense
 * a drug a clinician had stopped.
 */
import { pharmacyStage, pharmacyStageGroup, isActivePharmacyStage, isFinanciallyCleared } from '@/lib/pharmacy-workflow';

describe('pharmacyStage: discontinue takes precedence over orderStatus', () => {
  test('a discontinue on top of cleared_for_dispensing is NOT dispensable', () => {
    const stage = pharmacyStage({ status: 'discontinued', orderStatus: 'cleared_for_dispensing' });
    expect(stage).toBe('held_awaiting_clarification');
    expect(stage).not.toBe('cleared_for_dispensing');
  });

  test('a discontinue with no orderStatus is held, not queued', () => {
    expect(pharmacyStage({ status: 'discontinued' })).toBe('held_awaiting_clarification');
  });
});

describe('pharmacyStage: normal derivation', () => {
  test('orderStatus drives the stage when not discontinued', () => {
    expect(pharmacyStage({ status: 'pending', orderStatus: 'cleared_for_dispensing' })).toBe('cleared_for_dispensing');
    expect(pharmacyStage({ status: 'pending', orderStatus: 'dispensed' })).toBe('dispensed');
  });

  test('legacy dispensed status maps forward when orderStatus is absent', () => {
    expect(pharmacyStage({ status: 'dispensed' })).toBe('dispensed');
  });

  test('a bare active prescription lands in the pharmacy queue', () => {
    expect(pharmacyStage({ status: 'pending' })).toBe('received_in_pharmacy_queue');
  });
});

describe('pharmacy queue grouping and active flag', () => {
  test('completed and recalled stages are not "active"', () => {
    expect(isActivePharmacyStage('complete')).toBe(false);
    expect(isActivePharmacyStage('dispensing_error_recalled')).toBe(false);
  });
  test('mid-workflow stages are active', () => {
    expect(isActivePharmacyStage('under_review')).toBe(true);
    expect(isActivePharmacyStage('cleared_for_dispensing')).toBe(true);
  });
  test('grouping resolves to one of the three lanes', () => {
    for (const s of ['received_in_pharmacy_queue', 'cleared_for_dispensing', 'dispensed', 'complete'] as const) {
      expect(['scheduled', 'in_office', 'finished']).toContain(pharmacyStageGroup(s));
    }
  });
});

describe('financial clearance', () => {
  test('a zero or negative balance is cleared; a positive balance is not', () => {
    expect(isFinanciallyCleared(0)).toBe(true);
    expect(isFinanciallyCleared(-5)).toBe(true);
    expect(isFinanciallyCleared(100)).toBe(false);
  });
});
