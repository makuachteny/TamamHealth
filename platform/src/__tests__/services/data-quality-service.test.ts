/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for data-quality-service.ts
 * Covers national data quality metrics calculation with hospital and assessment data.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-dq-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs, putDoc } from '../helpers/test-db';
import { getNationalDataQuality } from '@/lib/services/data-quality-service';
import { hospitalsDB } from '@/lib/db';
import { createAssessment } from '@/lib/services/facility-assessment-service';
import type { HospitalDoc } from '@/lib/db-types';

const makeHospital = (overrides: Partial<HospitalDoc> = {}): HospitalDoc => ({
  _id: `hosp-${String(Math.random()).slice(2, 7)}`,
  type: 'hospital',
  name: 'Test Hospital',
  state: 'Central Equatoria',
  county: 'Juba',
  facilityType: 'county_hospital' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
} as HospitalDoc);

const makeAssessmentData = (facilityId: string, overrides: Record<string, unknown> = {}) => ({
  facilityId,
  facilityName: 'Test Hospital',
  assessmentDate: '2025-03-15',
  assessedBy: 'Dr. Mayen',
  generalEquipmentScore: 75,
  diagnosticCapacityScore: 80,
  essentialMedicinesScore: 85,
  infectionControlScore: 70,
  hasCleanWater: true,
  hasSanitation: true,
  hasWasteManagement: true,
  hasEmergencyTransport: false,
  hasCommunication: true,
  powerReliabilityScore: 60,
  staffingScore: 70,
  hisStaffCount: 3,
  hisStaffTrained: 2,
  hasPatientRegisters: true,
  hasDHIS2Reporting: true,
  reportingCompleteness: 85,
  reportingTimeliness: 80,
  dataQualityScore: 82,
  overallScore: 78,
  state: 'Central Equatoria',
  recommendations: 'Improve power reliability',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('data-quality-service', () => {
  test('getNationalDataQuality returns empty metrics when no hospitals', async () => {
    const result = await getNationalDataQuality();

    expect(result.avgCompleteness).toBe(0);
    expect(result.avgTimeliness).toBe(0);
    expect(result.avgQuality).toBe(0);
    expect(result.facilitiesReporting).toBe(0);
    expect(result.totalFacilities).toBe(0);
    expect(result.entries).toEqual([]);
  });

  test('getNationalDataQuality includes all hospitals even without assessments', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001', name: 'Hospital A' });
    const hosp2 = makeHospital({ _id: 'hosp-002', name: 'Hospital B' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);

    const result = await getNationalDataQuality();

    expect(result.totalFacilities).toBe(2);
    expect(result.facilitiesReporting).toBe(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.some(e => e.facilityId === 'hosp-001')).toBe(true);
    expect(result.entries.some(e => e.facilityId === 'hosp-002')).toBe(true);
  });

  test('getNationalDataQuality with single assessed facility', async () => {
    const hDB = hospitalsDB();
    const hosp = makeHospital({ _id: 'hosp-001', name: 'Juba Hospital' });
    await putDoc(hDB, hosp);

    await createAssessment(makeAssessmentData('hosp-001'));

    const result = await getNationalDataQuality();

    expect(result.totalFacilities).toBe(1);
    expect(result.facilitiesReporting).toBe(1);
    expect(result.avgCompleteness).toBe(85);
    expect(result.avgTimeliness).toBe(80);
    expect(result.avgQuality).toBe(82);
  });

  test('getNationalDataQuality calculates averages correctly with multiple facilities', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001', name: 'Hospital A' });
    const hosp2 = makeHospital({ _id: 'hosp-002', name: 'Hospital B' });
    const hosp3 = makeHospital({ _id: 'hosp-003', name: 'Hospital C' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);
    await putDoc(hDB, hosp3);

    await createAssessment(makeAssessmentData('hosp-001', { reportingCompleteness: 80, reportingTimeliness: 80, dataQualityScore: 80 }));
    await createAssessment(makeAssessmentData('hosp-002', { reportingCompleteness: 90, reportingTimeliness: 90, dataQualityScore: 90 }));
    await createAssessment(makeAssessmentData('hosp-003', { reportingCompleteness: 100, reportingTimeliness: 100, dataQualityScore: 100 }));

    const result = await getNationalDataQuality();

    expect(result.facilitiesReporting).toBe(3);
    expect(result.avgCompleteness).toBe(90);
    expect(result.avgTimeliness).toBe(90);
    expect(result.avgQuality).toBe(90);
  });

  test('getNationalDataQuality counts DHIS2 adoption', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001' });
    const hosp2 = makeHospital({ _id: 'hosp-002' });
    const hosp3 = makeHospital({ _id: 'hosp-003' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);
    await putDoc(hDB, hosp3);

    await createAssessment(makeAssessmentData('hosp-001', { hasDHIS2Reporting: true }));
    await createAssessment(makeAssessmentData('hosp-002', { hasDHIS2Reporting: false }));
    await createAssessment(makeAssessmentData('hosp-003', { hasDHIS2Reporting: true }));

    const result = await getNationalDataQuality();

    // (2 with DHIS2 / 3 total) * 100 = 66%
    expect(result.dhis2Adoption).toBe(67);
  });

  test('getNationalDataQuality calculates completeness rate correctly', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001' });
    const hosp2 = makeHospital({ _id: 'hosp-002' });
    const hosp3 = makeHospital({ _id: 'hosp-003' });
    const hosp4 = makeHospital({ _id: 'hosp-004' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);
    await putDoc(hDB, hosp3);
    await putDoc(hDB, hosp4);

    // 3 with >= 80% completeness, 1 with < 80%
    await createAssessment(makeAssessmentData('hosp-001', { reportingCompleteness: 85 }));
    await createAssessment(makeAssessmentData('hosp-002', { reportingCompleteness: 95 }));
    await createAssessment(makeAssessmentData('hosp-003', { reportingCompleteness: 88 }));
    await createAssessment(makeAssessmentData('hosp-004', { reportingCompleteness: 50 }));

    const result = await getNationalDataQuality();

    // 3 out of 4 with >= 80% = 75%
    expect(result.completenessRate).toBe(75);
  });

  test('getNationalDataQuality counts HIS staff totals', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001' });
    const hosp2 = makeHospital({ _id: 'hosp-002' });
    const hosp3 = makeHospital({ _id: 'hosp-003' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);
    await putDoc(hDB, hosp3);

    await createAssessment(makeAssessmentData('hosp-001', { hisStaffCount: 5 }));
    await createAssessment(makeAssessmentData('hosp-002', { hisStaffCount: 3 }));
    await createAssessment(makeAssessmentData('hosp-003', { hisStaffCount: 2 }));

    const result = await getNationalDataQuality();

    expect(result.totalHISStaff).toBe(10);
  });

  test('getNationalDataQuality counts facilities with trained staff', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001' });
    const hosp2 = makeHospital({ _id: 'hosp-002' });
    const hosp3 = makeHospital({ _id: 'hosp-003' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);
    await putDoc(hDB, hosp3);

    await createAssessment(makeAssessmentData('hosp-001', { hisStaffCount: 5 }));
    await createAssessment(makeAssessmentData('hosp-002', { hisStaffCount: 0 }));
    await createAssessment(makeAssessmentData('hosp-003', { hisStaffCount: 3 }));

    const result = await getNationalDataQuality();

    expect(result.facilitiesWithTrainedStaff).toBe(2);
  });

  test('getNationalDataQuality entry data completeness', async () => {
    const hDB = hospitalsDB();
    const hosp = makeHospital({ _id: 'hosp-001', name: 'Test Hospital', state: 'Northern Bahr el Ghazal' });
    await putDoc(hDB, hosp);

    await createAssessment(makeAssessmentData('hosp-001', {
      facilityName: 'Test Hospital',
      reportingCompleteness: 85,
      reportingTimeliness: 80,
      dataQualityScore: 82,
      hasDHIS2Reporting: true,
      hisStaffCount: 3,
      assessmentDate: '2025-03-15',
    }));

    const result = await getNationalDataQuality();

    expect(result.entries).toHaveLength(1);
    const entry = result.entries[0];
    expect(entry.facilityId).toBe('hosp-001');
    expect(entry.facilityName).toBe('Test Hospital');
    expect(entry.state).toBe('Northern Bahr el Ghazal');
    expect(entry.reportingCompleteness).toBe(85);
    expect(entry.reportingTimeliness).toBe(80);
    expect(entry.dataQualityScore).toBe(82);
    expect(entry.hasDHIS2).toBe(true);
    expect(entry.hisStaffCount).toBe(3);
    expect(entry.lastAssessmentDate).toBe('2025-03-15');
  });

  test('getNationalDataQuality entries sorted by completeness descending', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001', name: 'Hospital A' });
    const hosp2 = makeHospital({ _id: 'hosp-002', name: 'Hospital B' });
    const hosp3 = makeHospital({ _id: 'hosp-003', name: 'Hospital C' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);
    await putDoc(hDB, hosp3);

    await createAssessment(makeAssessmentData('hosp-001', { reportingCompleteness: 70 }));
    await createAssessment(makeAssessmentData('hosp-002', { reportingCompleteness: 95 }));
    await createAssessment(makeAssessmentData('hosp-003', { reportingCompleteness: 80 }));

    const result = await getNationalDataQuality();

    expect(result.entries[0].facilityName).toBe('Hospital B');
    expect(result.entries[1].facilityName).toBe('Hospital C');
    expect(result.entries[2].facilityName).toBe('Hospital A');
  });

  test('getNationalDataQuality handles multiple assessments per facility (uses latest)', async () => {
    const hDB = hospitalsDB();
    const hosp = makeHospital({ _id: 'hosp-001' });
    await putDoc(hDB, hosp);

    // Create multiple assessments for same facility
    await createAssessment(makeAssessmentData('hosp-001', {
      assessmentDate: '2025-03-10',
      reportingCompleteness: 50,
    }));
    await createAssessment(makeAssessmentData('hosp-001', {
      assessmentDate: '2025-03-15',
      reportingCompleteness: 75,
    }));
    await createAssessment(makeAssessmentData('hosp-001', {
      assessmentDate: '2025-03-20',
      reportingCompleteness: 90,
    }));

    const result = await getNationalDataQuality();

    expect(result.facilitiesReporting).toBe(1);
    expect(result.avgCompleteness).toBe(90);
    expect(result.entries[0].reportingCompleteness).toBe(90);
    expect(result.entries[0].lastAssessmentDate).toBe('2025-03-20');
  });

  test('getNationalDataQuality unassessed facilities have default values', async () => {
    const hDB = hospitalsDB();
    const hosp1 = makeHospital({ _id: 'hosp-001', name: 'Assessed Hospital' });
    const hosp2 = makeHospital({ _id: 'hosp-002', name: 'Unassessed Hospital' });

    await putDoc(hDB, hosp1);
    await putDoc(hDB, hosp2);

    await createAssessment(makeAssessmentData('hosp-001', { reportingCompleteness: 85 }));

    const result = await getNationalDataQuality();

    const unassessedEntry = result.entries.find(e => e.facilityId === 'hosp-002');
    expect(unassessedEntry).toBeDefined();
    expect(unassessedEntry!.reportingCompleteness).toBe(0);
    expect(unassessedEntry!.reportingTimeliness).toBe(0);
    expect(unassessedEntry!.dataQualityScore).toBe(0);
    expect(unassessedEntry!.hasDHIS2).toBe(false);
    expect(unassessedEntry!.hisStaffCount).toBe(0);
    expect(unassessedEntry!.lastAssessmentDate).toBe('');
  });
});
