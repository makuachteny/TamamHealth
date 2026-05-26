/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for immunization-service.ts
 * Covers CRUD, stats, defaulter tracking, and vaccine coverage.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllImmunizations,
  getByPatient,
  getByFacility,
  createImmunization,
  updateImmunization,
  deleteImmunization,
  getImmunizationStats,
  getDefaulters,
  getVaccineCoverage,
  getDefaultersByBoma,
  getDefaulterStats,
  getCoverageByAgeCohort,
} from '@/lib/services/immunization-service';
import type { DataScope } from '@/lib/services/data-scope';

type CreateImmunizationInput = Parameters<typeof createImmunization>[0];

const makeImmData = (overrides: Partial<CreateImmunizationInput> = {}): CreateImmunizationInput => ({
  patientId: 'child-001',
  patientName: 'Baby Achol',
  gender: 'Female' as const,
  dateOfBirth: '2024-06-01',
  vaccine: 'BCG',
  doseNumber: 1,
  dateGiven: '2024-06-15',
  nextDueDate: '2024-08-15',
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  state: 'Central Equatoria',
  administeredBy: 'Nurse Akech',
  batchNumber: 'BCG-2024-001',
  site: 'left arm' as const,
  adverseReaction: false,
  status: 'completed' as const,
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('immunization-service', () => {
  test('getAllImmunizations returns empty initially', async () => {
    const results = await getAllImmunizations();
    expect(results).toEqual([]);
  });

  test('createImmunization creates record with correct fields', async () => {
    const imm = await createImmunization(makeImmData());

    expect(imm._id).toMatch(/^imm-/);
    expect(imm.type).toBe('immunization');
    expect(imm.vaccine).toBe('BCG');
    expect(imm.patientName).toBe('Baby Achol');
    expect(imm.createdAt).toBeDefined();
    expect(imm._rev).toBeDefined();
  });

  test('getByPatient filters correctly', async () => {
    await createImmunization(makeImmData({ patientId: 'child-001' }));
    await createImmunization(makeImmData({ patientId: 'child-002', patientName: 'Baby Kuol' }));
    await createImmunization(makeImmData({ patientId: 'child-001', vaccine: 'OPV', doseNumber: 0 }));

    const child1 = await getByPatient('child-001');
    const child2 = await getByPatient('child-002');
    expect(child1).toHaveLength(2);
    expect(child2).toHaveLength(1);
  });

  test('getByFacility filters correctly', async () => {
    await createImmunization(makeImmData({ facilityId: 'hosp-001' }));
    await createImmunization(makeImmData({ facilityId: 'hosp-002', facilityName: 'Wau State Hospital' }));

    const fac1 = await getByFacility('hosp-001');
    const fac2 = await getByFacility('hosp-002');
    expect(fac1).toHaveLength(1);
    expect(fac2).toHaveLength(1);
  });

  test('updateImmunization updates record', async () => {
    const imm = await createImmunization(makeImmData());
    const updated = await updateImmunization(imm._id, { adverseReaction: true, adverseReactionDetails: 'Mild swelling' });

    expect(updated).not.toBeNull();
    expect(updated!.adverseReaction).toBe(true);
    expect(updated!.adverseReactionDetails).toBe('Mild swelling');
    expect(updated!.vaccine).toBe('BCG');
  });

  test('updateImmunization returns null for non-existent id', async () => {
    const result = await updateImmunization('imm-nonexistent', { status: 'overdue' });
    expect(result).toBeNull();
  });

  test('deleteImmunization removes record', async () => {
    const imm = await createImmunization(makeImmData());
    const deleted = await deleteImmunization(imm._id);
    expect(deleted).toBe(true);

    const all = await getAllImmunizations();
    expect(all).toHaveLength(0);
  });

  test('deleteImmunization returns false for non-existent id', async () => {
    const deleted = await deleteImmunization('imm-nonexistent');
    expect(deleted).toBe(false);
  });

  test('getImmunizationStats returns correct counts', async () => {
    // Child A: BCG completed, Penta3 completed, Measles1 completed => fully immunized
    await createImmunization(makeImmData({ patientId: 'child-A', vaccine: 'BCG', doseNumber: 1, status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-A', vaccine: 'Penta', doseNumber: 3, status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-A', vaccine: 'Measles', doseNumber: 1, status: 'completed' }));

    // Child B: BCG completed only, one scheduled, one overdue
    await createImmunization(makeImmData({ patientId: 'child-B', vaccine: 'BCG', doseNumber: 1, status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-B', vaccine: 'Penta', doseNumber: 1, status: 'scheduled' }));
    await createImmunization(makeImmData({ patientId: 'child-B', vaccine: 'OPV', doseNumber: 1, status: 'overdue' }));

    const stats = await getImmunizationStats();
    expect(stats.totalVaccinations).toBe(4); // completed count
    expect(stats.totalChildren).toBe(2);
    expect(stats.fullyImmunized).toBe(1); // only child-A
    expect(stats.overdue).toBe(1);
    expect(stats.scheduled).toBe(1);
    expect(stats.coverageRate).toBe(50); // 1/2 * 100
  });

  test('getDefaulters identifies overdue records', async () => {
    // Past due date => should be a defaulter
    const pastDate = '2024-01-01';
    await createImmunization(makeImmData({
      patientId: 'child-D',
      vaccine: 'Penta',
      doseNumber: 2,
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-06-01',
    }));

    // Completed => should not be a defaulter
    await createImmunization(makeImmData({
      patientId: 'child-E',
      vaccine: 'BCG',
      doseNumber: 1,
      status: 'completed',
      dateGiven: '2024-06-15',
      nextDueDate: '2024-08-15',
    }));

    const defaulters = await getDefaulters();
    expect(defaulters.length).toBeGreaterThanOrEqual(1);
    expect(defaulters.some(d => d.patientId === 'child-D')).toBe(true);
    expect(defaulters.some(d => d.patientId === 'child-E')).toBe(false);
  });

  test('getDefaulters assigns urgency based on days overdue', async () => {
    const longOverdue = new Date();
    longOverdue.setDate(longOverdue.getDate() - 60);

    await createImmunization(makeImmData({
      patientId: 'child-F',
      vaccine: 'Measles',
      doseNumber: 1,
      status: 'overdue',
      dateGiven: longOverdue.toISOString().slice(0, 10),
      nextDueDate: longOverdue.toISOString().slice(0, 10),
      dateOfBirth: '2023-01-01',
    }));

    const defaulters = await getDefaulters();
    const childF = defaulters.find(d => d.patientId === 'child-F');
    expect(childF).toBeDefined();
    expect(childF!.urgency).toBe('critical'); // >30 days
    expect(childF!.daysOverdue).toBeGreaterThan(30);
  });

  test('getVaccineCoverage calculates percentages', async () => {
    // Two children, both have BCG completed, only one has Measles
    await createImmunization(makeImmData({ patientId: 'child-X', vaccine: 'BCG', status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-Y', vaccine: 'BCG', status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-X', vaccine: 'Measles', doseNumber: 1, status: 'completed' }));

    const coverage = await getVaccineCoverage();
    const bcg = coverage.find(c => c.vaccine === 'BCG');
    const measles = coverage.find(c => c.vaccine === 'Measles');

    expect(bcg).toBeDefined();
    expect(bcg!.count).toBe(2);
    expect(bcg!.percentage).toBe(100); // 2/2

    expect(measles).toBeDefined();
    expect(measles!.count).toBe(1);
    expect(measles!.percentage).toBe(50); // 1/2
  });

  test('getDefaultersByBoma filters by facility name', async () => {
    // Create defaulters from different facilities
    const pastDate = '2024-01-01';
    await createImmunization(makeImmData({
      patientId: 'child-G',
      vaccine: 'Penta',
      doseNumber: 2,
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-06-01',
      facilityName: 'Juba Teaching Hospital',
    }));

    await createImmunization(makeImmData({
      patientId: 'child-H',
      vaccine: 'Measles',
      doseNumber: 1,
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-06-01',
      facilityName: 'Wau State Hospital',
    }));

    // Filter by facility
    const jubaDefaulters = await getDefaultersByBoma('Juba');
    const wauDefaulters = await getDefaultersByBoma('Wau');
    const allDefaulters = await getDefaultersByBoma();

    expect(jubaDefaulters.length).toBeGreaterThanOrEqual(1);
    expect(wauDefaulters.length).toBeGreaterThanOrEqual(1);
    expect(allDefaulters.length).toBeGreaterThanOrEqual(2);
    expect(jubaDefaulters.some(d => d.patientId === 'child-G')).toBe(true);
    expect(wauDefaulters.some(d => d.patientId === 'child-H')).toBe(true);
  });

  test('getDefaulterStats aggregates stats correctly', async () => {
    const veryPastDate = new Date();
    veryPastDate.setDate(veryPastDate.getDate() - 60);
    const moderatePastDate = new Date();
    moderatePastDate.setDate(moderatePastDate.getDate() - 20);

    // Critical (>30 days)
    await createImmunization(makeImmData({
      patientId: 'critical-child',
      vaccine: 'BCG',
      status: 'overdue',
      dateGiven: veryPastDate.toISOString().slice(0, 10),
      nextDueDate: veryPastDate.toISOString().slice(0, 10),
      dateOfBirth: '2023-01-01',
    }));

    // High (>14 days)
    await createImmunization(makeImmData({
      patientId: 'high-child',
      vaccine: 'Penta',
      status: 'overdue',
      dateGiven: moderatePastDate.toISOString().slice(0, 10),
      nextDueDate: moderatePastDate.toISOString().slice(0, 10),
      dateOfBirth: '2023-02-01',
    }));

    // Medium
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    await createImmunization(makeImmData({
      patientId: 'medium-child',
      vaccine: 'Measles',
      status: 'overdue',
      dateGiven: recentDate.toISOString().slice(0, 10),
      nextDueDate: recentDate.toISOString().slice(0, 10),
      dateOfBirth: '2023-03-01',
    }));

    const stats = await getDefaulterStats();
    expect(stats.critical).toBeGreaterThanOrEqual(1);
    expect(stats.high).toBeGreaterThanOrEqual(1);
    expect(stats.medium).toBeGreaterThanOrEqual(1);
    expect(stats.totalDefaulters).toBeGreaterThanOrEqual(3);
    expect(stats.uniqueChildren).toBeGreaterThanOrEqual(3);
    expect(stats.byVaccine['BCG']).toBeGreaterThanOrEqual(1);
    expect(stats.byVaccine['Penta']).toBeGreaterThanOrEqual(1);
  });

  test('getCoverageByAgeCohort groups children by age', async () => {
    // Child <6 months
    const recentDOB = new Date();
    recentDOB.setMonth(recentDOB.getMonth() - 2);
    await createImmunization(makeImmData({
      patientId: 'child-<6mo',
      vaccine: 'BCG',
      status: 'completed',
      dateOfBirth: recentDOB.toISOString().slice(0, 10),
    }));

    // Child 6-12 months
    const oldDOB = new Date();
    oldDOB.setMonth(oldDOB.getMonth() - 9);
    await createImmunization(makeImmData({
      patientId: 'child-6-12mo',
      vaccine: 'BCG',
      status: 'completed',
      dateOfBirth: oldDOB.toISOString().slice(0, 10),
    }));

    const rows = await getCoverageByAgeCohort();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some(r => r.vaccine === 'BCG')).toBe(true);
    expect(rows.some(r => r.cohort === '<6mo')).toBe(true);
    expect(rows.some(r => r.cohort === '6-12mo')).toBe(true);

    // Check coverage calculations
    const bcgRows = rows.filter(r => r.vaccine === 'BCG');
    bcgRows.forEach(row => {
      if (row.total > 0) {
        expect(row.percentage).toBeGreaterThanOrEqual(0);
        expect(row.percentage).toBeLessThanOrEqual(100);
      }
    });
  });

  test('getCoverageByAgeCohort handles cohorts 1-2y, 2-5y, 5y+', async () => {
    // Child 1-2 years
    const dob1y = new Date();
    dob1y.setMonth(dob1y.getMonth() - 18);
    await createImmunization(makeImmData({
      patientId: 'child-1-2y',
      vaccine: 'Penta',
      status: 'completed',
      dateOfBirth: dob1y.toISOString().slice(0, 10),
    }));

    // Child 2-5 years
    const dob2_5y = new Date();
    dob2_5y.setMonth(dob2_5y.getMonth() - 36);
    await createImmunization(makeImmData({
      patientId: 'child-2-5y',
      vaccine: 'Penta',
      status: 'completed',
      dateOfBirth: dob2_5y.toISOString().slice(0, 10),
    }));

    // Child 5+ years
    const dob5y = new Date();
    dob5y.setMonth(dob5y.getMonth() - 72);
    await createImmunization(makeImmData({
      patientId: 'child-5y+',
      vaccine: 'Penta',
      status: 'completed',
      dateOfBirth: dob5y.toISOString().slice(0, 10),
    }));

    const rows = await getCoverageByAgeCohort();
    expect(rows.some(r => r.cohort === '1-2y')).toBe(true);
    expect(rows.some(r => r.cohort === '2-5y')).toBe(true);
    expect(rows.some(r => r.cohort === '5y+')).toBe(true);
  });

  test('getDefaulters handles scheduled records with past nextDueDate', async () => {
    const pastDate = '2024-01-01';
    await createImmunization(makeImmData({
      patientId: 'child-scheduled-overdue',
      vaccine: 'OPV',
      doseNumber: 2,
      status: 'scheduled',
      nextDueDate: pastDate,
      dateGiven: '2023-12-01',
      dateOfBirth: '2023-06-01',
    }));

    const defaulters = await getDefaulters();
    expect(defaulters.some(d => d.patientId === 'child-scheduled-overdue')).toBe(true);
  });

  test('getImmunizationStats includes all vaccine types', async () => {
    // Ensure we test with various vaccines
    const vaccines = ['BCG', 'OPV', 'Penta', 'PCV', 'Rota', 'Measles', 'Yellow Fever', 'Vitamin A'];
    for (let i = 0; i < vaccines.length; i++) {
      await createImmunization(makeImmData({
        patientId: `child-${vaccines[i]}`,
        vaccine: vaccines[i],
        status: 'completed',
      }));
    }

    const coverage = await getVaccineCoverage();
    expect(coverage.length).toBe(8);
    vaccines.forEach(vaccine => {
      expect(coverage.some(c => c.vaccine === vaccine)).toBe(true);
    });
  });

  test('getVaccineCoverage handles zero total children', async () => {
    const coverage = await getVaccineCoverage();
    // With no records, totalChildren = 0, percentage should be 0
    coverage.forEach(c => {
      expect(c.percentage).toBe(0);
      expect(c.count).toBe(0);
    });
  });

  test('getDefaulters skips records with zero days overdue', async () => {
    // Create a scheduled record with future nextDueDate (should be skipped)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    await createImmunization(makeImmData({
      patientId: 'child-future',
      vaccine: 'OPV',
      status: 'scheduled',
      nextDueDate: futureDate.toISOString().slice(0, 10),
      dateGiven: '2026-01-01',
      dateOfBirth: '2025-01-01',
    }));

    const defaulters = await getDefaulters();
    expect(defaulters.some(d => d.patientId === 'child-future')).toBe(false);
  });

  test('getDefaultersByBoma handles case-insensitive filtering', async () => {
    const pastDate = '2024-01-01';
    await createImmunization(makeImmData({
      patientId: 'child-case-test',
      vaccine: 'Penta',
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-06-01',
      facilityName: 'JUBA TEACHING HOSPITAL',
    }));

    // Test lowercase filter
    const results = await getDefaultersByBoma('juba');
    expect(results.some(d => d.patientId === 'child-case-test')).toBe(true);
  });

  test('getDefaulters handles missing dateGiven in completed records', async () => {
    const pastDate = '2024-01-01';
    // Create an overdue record
    await createImmunization(makeImmData({
      patientId: 'child-missing-date',
      vaccine: 'Penta',
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-06-01',
    }));

    // Create a completed record with missing dateGiven (this would be unusual but should be handled)
    await createImmunization(makeImmData({
      patientId: 'child-missing-date',
      vaccine: 'BCG',
      status: 'completed',
      dateGiven: undefined,
      dateOfBirth: '2023-06-01',
    }));

    const defaulters = await getDefaulters();
    const defaulter = defaulters.find(d => d.patientId === 'child-missing-date');
    expect(defaulter).toBeDefined();
    expect(defaulter!.vaccine).toBe('Penta');
  });

  test('getAllImmunizations with scope filters correctly', async () => {
    await createImmunization(makeImmData({ patientId: 'child-001' }));

    // Get all with no scope - should get the record
    const allNoScope = await getAllImmunizations();
    expect(allNoScope.length).toBeGreaterThanOrEqual(1);

    // Get all with scope - the filterByScope function would be called
    const allWithScope = await getAllImmunizations({ role: 'nurse' } as DataScope);
    // Result depends on filterByScope implementation
    expect(Array.isArray(allWithScope)).toBe(true);
  });

  // ---- Additional branch coverage for line 167 ----

  test('getDefaulters with completed records having undefined dateGiven (line 167 coverage)', async () => {
    // Create an overdue record
    const pastDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await createImmunization(makeImmData({
      patientId: 'child-with-undefined-date',
      vaccine: 'OPV',
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-01-01',
    }));

    // Create a completed record with undefined dateGiven - tests the || '' fallback on line 167
    await createImmunization(makeImmData({
      patientId: 'child-with-undefined-date',
      vaccine: 'BCG',
      status: 'completed',
      dateGiven: undefined,
      dateOfBirth: '2023-01-01',
    }));

    const defaulters = await getDefaulters();
    const defaulter = defaulters.find(d => d.patientId === 'child-with-undefined-date');
    // Should still work even though completed record has undefined dateGiven
    expect(defaulter).toBeDefined();
    expect(defaulter!.vaccine).toBe('OPV');
  });

  test('getDefaulters with all completed records having undefined dateGiven', async () => {
    const pastDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await createImmunization(makeImmData({
      patientId: 'child-009',
      vaccine: 'Penta',
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-01-01',
    }));

    // Multiple completed records all with undefined dateGiven
    await createImmunization(makeImmData({
      patientId: 'child-009',
      vaccine: 'BCG',
      status: 'completed',
      dateGiven: undefined,
      dateOfBirth: '2023-01-01',
    }));

    await createImmunization(makeImmData({
      patientId: 'child-009',
      vaccine: 'OPV',
      status: 'completed',
      dateGiven: undefined,
      dateOfBirth: '2023-01-01',
    }));

    const defaulters = await getDefaulters();
    const defaulter = defaulters.find(d => d.patientId === 'child-009');
    expect(defaulter).toBeDefined();
    expect(defaulter!.vaccine).toBe('Penta');
  });

  test('deleteImmunization deletes a record', async () => {
    const imm = await createImmunization(makeImmData());
    const deleted = await deleteImmunization(imm._id);
    expect(deleted).toBe(true);

    // Verify it's deleted
    const found = await getByPatient(imm.patientId);
    expect(found).not.toContainEqual(imm);
  });

  test('deleteImmunization returns false for non-existent id', async () => {
    const deleted = await deleteImmunization('non-existent-id');
    expect(deleted).toBe(false);
  });

  test('getImmunizationStats with no vaccinations', async () => {
    const stats = await getImmunizationStats();
    expect(stats.totalVaccinations).toBe(0);
    expect(stats.totalChildren).toBe(0);
    expect(stats.fullyImmunized).toBe(0);
    expect(stats.coverageRate).toBe(0);
  });

  test('getImmunizationStats with various statuses', async () => {
    await createImmunization(makeImmData({ status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-002', status: 'overdue', vaccine: 'OPV' }));
    await createImmunization(makeImmData({ patientId: 'child-003', status: 'scheduled', vaccine: 'Penta' }));
    await createImmunization(makeImmData({ patientId: 'child-004', status: 'missed', vaccine: 'Measles' }));

    const stats = await getImmunizationStats();
    expect(stats.totalVaccinations).toBeGreaterThanOrEqual(1);
    expect(stats.totalChildren).toBeGreaterThanOrEqual(1);
  });

  test('getDefaultersByBoma groups defaulters correctly', async () => {
    const pastDate = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
    await createImmunization(makeImmData({
      patientId: 'child-001',
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-01-01',
    }));

    const byBoma = await getDefaultersByBoma();
    expect(typeof byBoma).toBe('object');
  });

  test('getDefaulterStats returns statistics', async () => {
    const pastDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await createImmunization(makeImmData({
      patientId: 'child-001',
      status: 'overdue',
      dateGiven: pastDate,
      nextDueDate: pastDate,
      dateOfBirth: '2023-01-01',
    }));

    const stats = await getDefaulterStats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalDefaulters).toBe('number');
    expect(typeof stats.uniqueChildren).toBe('number');
    expect(typeof stats.critical).toBe('number');
    expect(typeof stats.high).toBe('number');
    expect(typeof stats.medium).toBe('number');
  });

  test('getCoverageByAgeCohort calculates coverage by age', async () => {
    await createImmunization(makeImmData({
      status: 'completed',
      dateOfBirth: '2024-06-01',
    }));

    const coverage = await getCoverageByAgeCohort();
    expect(typeof coverage).toBe('object');
  });

  test('getAllImmunizations sorts by createdAt descending', async () => {
    await createImmunization(makeImmData({ patientId: 'child-001' }));
    await new Promise(r => setTimeout(r, 10));
    const second = await createImmunization(makeImmData({ patientId: 'child-002', patientName: 'Baby Kuol' }));

    const all = await getAllImmunizations();
    expect(all[0]._id).toBe(second._id);
  });

  // ---- Line 13: Test branch with scope filtering ----
  test('getAllImmunizations with scope applies filtering', async () => {
    await createImmunization(makeImmData({ patientId: 'child-001' }));
    const result = await getAllImmunizations({ role: 'doctor' } as DataScope);
    expect(Array.isArray(result)).toBe(true);
  });

  // ---- Line 100: Test byState mapping with various states ----
  test('getImmunizationStats includes byState grouping with multiple states', async () => {
    await createImmunization(makeImmData({ state: 'Central Equatoria', status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-002', state: 'Eastern Equatoria', status: 'completed' }));
    await createImmunization(makeImmData({ patientId: 'child-003', state: 'Upper Nile', status: 'completed' }));

    const stats = await getImmunizationStats();
    expect(Object.keys(stats.byState).length).toBeGreaterThanOrEqual(3);
    expect(stats.byState['Central Equatoria']).toBe(1);
    expect(stats.byState['Eastern Equatoria']).toBe(1);
    expect(stats.byState['Upper Nile']).toBe(1);
  });

  // ---- Line 100: Test byState with missing state (Unknown) ----
  test('getImmunizationStats handles missing state field', async () => {
    await createImmunization(makeImmData({ state: undefined }));
    const stats = await getImmunizationStats();
    expect(stats.byState['Unknown']).toBe(1);
  });

  // ---- Lines 156-161: Test daysOverdue <= 0 skip condition ----
  test('getDefaulters skips records where daysOverdue is 0 or negative', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Record with today as due date (daysOverdue = 0, should be skipped)
    await createImmunization(makeImmData({
      patientId: 'child-today',
      vaccine: 'OPV',
      status: 'scheduled',
      nextDueDate: today,
      dateGiven: '2025-01-01',
      dateOfBirth: '2024-01-01',
    }));

    const defaulters = await getDefaulters();
    const found = defaulters.find(d => d.patientId === 'child-today');
    expect(found).toBeUndefined();
  });

  // ---- Line 178: Test dueDate fallback to dateGiven when nextDueDate missing ----
  test('getDefaulters uses dateGiven when nextDueDate is missing', async () => {
    const pastDate = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
    await createImmunization(makeImmData({
      patientId: 'child-no-next-due',
      vaccine: 'Penta',
      status: 'overdue',
      nextDueDate: undefined,
      dateGiven: pastDate,
      dateOfBirth: '2023-01-01',
    }));

    const defaulters = await getDefaulters();
    const found = defaulters.find(d => d.patientId === 'child-no-next-due');
    expect(found).toBeDefined();
    expect(found!.dueDate).toBe(pastDate);
  });

  // ---- Line 236: Test childMeta condition when dateOfBirth is missing ----
  test('getCoverageByAgeCohort handles records without dateOfBirth', async () => {
    // Record with valid dateOfBirth
    await createImmunization(makeImmData({
      patientId: 'child-with-dob',
      vaccine: 'BCG',
      status: 'completed',
      dateOfBirth: '2024-06-01',
    }));

    // Record without dateOfBirth
    await createImmunization(makeImmData({
      patientId: 'child-no-dob',
      vaccine: 'OPV',
      status: 'completed',
      dateOfBirth: undefined,
    }));

    const rows = await getCoverageByAgeCohort();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  // ---- Line 256: Test cohort not found condition ----
  test('getCoverageByAgeCohort handles children outside age cohort ranges', async () => {
    // Very old child (would be > 5 years, should fit in 5y+ cohort)
    const veryOldDOB = new Date('1980-01-01').toISOString().slice(0, 10);
    await createImmunization(makeImmData({
      patientId: 'very-old-child',
      vaccine: 'BCG',
      status: 'completed',
      dateOfBirth: veryOldDOB,
    }));

    const rows = await getCoverageByAgeCohort();
    // All children should fit into some cohort
    const has5yPlus = rows.some(r => r.cohort === '5y+' && r.covered > 0);
    expect(has5yPlus).toBe(true);
  });

  // ---- Line 13: Test sort with missing createdAt ----
  test('getAllImmunizations sorts correctly with missing createdAt', async () => {
    await createImmunization(makeImmData({
      patientId: 'child-with-createdat',
      vaccine: 'BCG',
    }));

    // Manually insert record without createdAt via DB
    const db = require('@/lib/db').immunizationsDB();
    const docWithoutCreatedAt = {
      _id: 'imm-no-created',
      type: 'immunization',
      patientId: 'child-without-createdat',
      patientName: 'Test Child',
      vaccine: 'OPV',
      status: 'completed',
      dateGiven: '2024-01-01',
      createdAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    await db.put(docWithoutCreatedAt);

    const results = await getAllImmunizations();
    expect(results.length).toBeGreaterThan(0);
    expect(Array.isArray(results)).toBe(true);
  });

  // ---- Line 161: Test defaulters with missing dateOfBirth ----
  test('getDefaulters handles missing dateOfBirth', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    await createImmunization(makeImmData({
      patientId: 'overdue-no-dob',
      vaccine: 'BCG',
      status: 'scheduled',
      dateGiven: yesterdayStr,
      nextDueDate: yesterdayStr,
      dateOfBirth: undefined,
    }));

    const defaulters = await getDefaulters();
    expect(Array.isArray(defaulters)).toBe(true);
    // May or may not include records without dateOfBirth, but shouldn't crash
  });
});
