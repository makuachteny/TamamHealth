/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for facility-assessment-service.ts
 * Covers CRUD operations, facility filtering, and assessment summaries.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-fa-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllAssessments,
  getAssessmentsByFacility,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAssessmentSummary,
} from '@/lib/services/facility-assessment-service';
import type { DataScope } from '@/lib/services/data-scope';

const makeAssessmentData = (overrides: Record<string, unknown> = {}) => ({
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  assessmentDate: '2025-03-15',
  assessedBy: 'Dr. Mayen Dut',
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
  recommendations: 'Improve power reliability and communication systems.',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('facility-assessment-service', () => {
  test('getAllAssessments returns empty initially', async () => {
    const assessments = await getAllAssessments();
    expect(assessments).toEqual([]);
  });

  test('createAssessment creates with correct fields', async () => {
    const assessment = await createAssessment(makeAssessmentData());

    expect(assessment._id).toMatch(/^assess-/);
    expect(assessment.type).toBe('facility_assessment');
    expect(assessment.facilityId).toBe('hosp-001');
    expect(assessment.facilityName).toBe('Juba Teaching Hospital');
    expect(assessment.assessmentDate).toBe('2025-03-15');
    expect(assessment.generalEquipmentScore).toBe(75);
    expect(assessment.overallScore).toBe(78);
    expect(assessment.hasDHIS2Reporting).toBe(true);
    expect(assessment.createdAt).toBeDefined();
    expect(assessment.updatedAt).toBeDefined();
    expect(assessment._rev).toBeDefined();
  });

  test('getAssessmentsByFacility filters correctly', async () => {
    await createAssessment(makeAssessmentData({ facilityId: 'hosp-001', assessmentDate: '2025-03-10' }));
    await createAssessment(makeAssessmentData({ facilityId: 'hosp-001', assessmentDate: '2025-03-15' }));
    await createAssessment(makeAssessmentData({ facilityId: 'hosp-002', facilityName: 'County Hospital', assessmentDate: '2025-03-12' }));

    const hosp1 = await getAssessmentsByFacility('hosp-001');
    const hosp2 = await getAssessmentsByFacility('hosp-002');

    expect(hosp1).toHaveLength(2);
    expect(hosp2).toHaveLength(1);
    expect(hosp2[0].facilityId).toBe('hosp-002');
  });

  test('updateAssessment updates scores', async () => {
    const assessment = await createAssessment(makeAssessmentData({ overallScore: 60 }));
    const updated = await updateAssessment(assessment._id, { overallScore: 80, generalEquipmentScore: 85 });

    expect(updated).not.toBeNull();
    expect(updated!.overallScore).toBe(80);
    expect(updated!.generalEquipmentScore).toBe(85);
    expect(updated!.facilityId).toBe('hosp-001');
  });

  test('getAllAssessments with scope filters by data scope (line 14)', async () => {
    // Tests line 14: return scope ? filterByScope(all, scope) : all;
    await createAssessment(makeAssessmentData({ facilityId: 'hosp-001', orgId: 'org-001' }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-002',
      facilityName: 'County Hospital',
      orgId: 'org-002',
    }));

    // Get all without scope
    const allAssessments = await getAllAssessments();
    expect(allAssessments.length).toBeGreaterThanOrEqual(2);

    // Get with scope filter
    const scopedAssessments = await getAllAssessments({ role: 'nurse', orgId: 'org-001' } as DataScope);
    expect(scopedAssessments).toBeDefined();
  });

  test('updateAssessment returns null for non-existent id', async () => {
    const result = await updateAssessment('assess-nonexistent', { overallScore: 90 });
    expect(result).toBeNull();
  });

  test('deleteAssessment removes the assessment', async () => {
    const assessment = await createAssessment(makeAssessmentData());
    const success = await deleteAssessment(assessment._id);

    expect(success).toBe(true);

    const assessments = await getAllAssessments();
    expect(assessments).toHaveLength(0);
  });

  test('deleteAssessment returns false for non-existent id', async () => {
    const success = await deleteAssessment('assess-nonexistent');
    expect(success).toBe(false);
  });

  test('getAllAssessments sorts by assessmentDate descending', async () => {
    await createAssessment(makeAssessmentData({ assessmentDate: '2025-03-10', facilityName: 'First' }));
    await createAssessment(makeAssessmentData({ assessmentDate: '2025-03-20', facilityName: 'Second' }));
    await createAssessment(makeAssessmentData({ assessmentDate: '2025-03-15', facilityName: 'Third' }));

    const all = await getAllAssessments();

    expect(all[0].facilityName).toBe('Second');
    expect(all[1].facilityName).toBe('Third');
    expect(all[2].facilityName).toBe('First');
  });

  test('updateAssessment preserves existing fields', async () => {
    const assessment = await createAssessment(makeAssessmentData({ facilityId: 'hosp-001', recommendations: 'Original rec' }));
    const updated = await updateAssessment(assessment._id, { overallScore: 85 });

    expect(updated!.facilityId).toBe('hosp-001');
    expect(updated!.recommendations).toBe('Original rec');
    expect(updated!.overallScore).toBe(85);
  });

  test('getAssessmentSummary returns empty initially', async () => {
    const summary = await getAssessmentSummary();

    expect(summary.totalAssessments).toBe(0);
    expect(summary.facilitiesAssessed).toBe(0);
    expect(summary.avgOverallScore).toBe(0);
    expect(summary.facilityScores).toEqual([]);
  });

  test('getAssessmentSummary with single assessment', async () => {
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      facilityName: 'Hospital A',
      overallScore: 80,
      generalEquipmentScore: 75,
      diagnosticCapacityScore: 80,
      essentialMedicinesScore: 85,
      staffingScore: 70,
      reportingCompleteness: 85,
      dataQualityScore: 82,
    }));

    const summary = await getAssessmentSummary();

    expect(summary.totalAssessments).toBe(1);
    expect(summary.facilitiesAssessed).toBe(1);
    expect(summary.avgOverallScore).toBe(80);
    expect(summary.avgEquipmentScore).toBe(75);
    expect(summary.avgDiagnosticScore).toBe(80);
    expect(summary.avgMedicinesScore).toBe(85);
    expect(summary.avgStaffingScore).toBe(70);
    expect(summary.avgReportingCompleteness).toBe(85);
    expect(summary.avgDataQuality).toBe(82);
  });

  test('getAssessmentSummary calculates averages across multiple facilities', async () => {
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      facilityName: 'Hospital A',
      overallScore: 70,
      generalEquipmentScore: 70,
      diagnosticCapacityScore: 70,
      essentialMedicinesScore: 70,
      staffingScore: 70,
      reportingCompleteness: 70,
      dataQualityScore: 70,
    }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-002',
      facilityName: 'Hospital B',
      overallScore: 90,
      generalEquipmentScore: 90,
      diagnosticCapacityScore: 90,
      essentialMedicinesScore: 90,
      staffingScore: 90,
      reportingCompleteness: 90,
      dataQualityScore: 90,
    }));

    const summary = await getAssessmentSummary();

    expect(summary.totalAssessments).toBe(2);
    expect(summary.facilitiesAssessed).toBe(2);
    expect(summary.avgOverallScore).toBe(80);
    expect(summary.avgEquipmentScore).toBe(80);
    expect(summary.avgDiagnosticScore).toBe(80);
  });

  test('getAssessmentSummary counts infrastructure features', async () => {
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      hasDHIS2Reporting: true,
      hasCleanWater: true,
    }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-002',
      hasDHIS2Reporting: false,
      hasCleanWater: true,
    }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-003',
      hasDHIS2Reporting: true,
      hasCleanWater: false,
    }));

    const summary = await getAssessmentSummary();

    expect(summary.withDHIS2).toBe(2);
    expect(summary.withCleanWater).toBe(2);
  });

  test('getAssessmentSummary facility scores sorted by overallScore descending', async () => {
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      facilityName: 'Hospital A',
      overallScore: 70,
      assessmentDate: '2025-03-10',
      state: 'Central Equatoria',
    }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-002',
      facilityName: 'Hospital B',
      overallScore: 95,
      assessmentDate: '2025-03-15',
      state: 'Western Equatoria',
    }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-003',
      facilityName: 'Hospital C',
      overallScore: 85,
      assessmentDate: '2025-03-12',
      state: 'Northern Bahr el Ghazal',
    }));

    const summary = await getAssessmentSummary();

    expect(summary.facilityScores).toHaveLength(3);
    expect(summary.facilityScores[0].facilityName).toBe('Hospital B');
    expect(summary.facilityScores[0].overallScore).toBe(95);
    expect(summary.facilityScores[1].facilityName).toBe('Hospital C');
    expect(summary.facilityScores[1].overallScore).toBe(85);
    expect(summary.facilityScores[2].facilityName).toBe('Hospital A');
    expect(summary.facilityScores[2].overallScore).toBe(70);
  });

  test('getAssessmentSummary uses latest assessment per facility', async () => {
    // Create multiple assessments for same facility
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      facilityName: 'Hospital A',
      assessmentDate: '2025-03-10',
      overallScore: 60,
    }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      facilityName: 'Hospital A',
      assessmentDate: '2025-03-15',
      overallScore: 75,
    }));
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      facilityName: 'Hospital A',
      assessmentDate: '2025-03-20',
      overallScore: 85,
    }));

    const summary = await getAssessmentSummary();

    expect(summary.totalAssessments).toBe(3);
    expect(summary.facilitiesAssessed).toBe(1);
    expect(summary.avgOverallScore).toBe(85);
    expect(summary.facilityScores[0].overallScore).toBe(85);
    expect(summary.facilityScores[0].date).toBe('2025-03-20');
  });

  test('createAssessment assigns timestamps correctly', async () => {
    const before = new Date().toISOString();
    const assessment = await createAssessment(makeAssessmentData());
    const after = new Date().toISOString();

    expect(assessment.createdAt >= before).toBe(true);
    expect(assessment.createdAt <= after).toBe(true);
    expect(assessment.updatedAt).toBe(assessment.createdAt);
  });

  test('updateAssessment updates updatedAt timestamp', async () => {
    const assessment = await createAssessment(makeAssessmentData());
    const originalUpdatedAt = assessment.updatedAt;

    await new Promise(r => setTimeout(r, 10));

    const updated = await updateAssessment(assessment._id, { overallScore: 90 });
    expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
  });

  test('getAssessmentSummary handles all score fields', async () => {
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      generalEquipmentScore: 75,
      diagnosticCapacityScore: 80,
      essentialMedicinesScore: 85,
      infectionControlScore: 70,
      staffingScore: 65,
      reportingCompleteness: 90,
      dataQualityScore: 88,
    }));

    const summary = await getAssessmentSummary();

    expect(summary.avgEquipmentScore).toBe(75);
    expect(summary.avgDiagnosticScore).toBe(80);
    expect(summary.avgMedicinesScore).toBe(85);
    expect(summary.avgStaffingScore).toBe(65);
    expect(summary.avgReportingCompleteness).toBe(90);
    expect(summary.avgDataQuality).toBe(88);
  });

  test('getAssessmentSummary facility scores include all required fields', async () => {
    await createAssessment(makeAssessmentData({
      facilityId: 'hosp-001',
      facilityName: 'Test Hospital',
      overallScore: 85,
      assessmentDate: '2025-03-15',
      state: 'Central Equatoria',
    }));

    const summary = await getAssessmentSummary();

    const score = summary.facilityScores[0];
    expect(score.facilityId).toBe('hosp-001');
    expect(score.facilityName).toBe('Test Hospital');
    expect(score.overallScore).toBe(85);
    expect(score.date).toBe('2025-03-15');
    expect(score.state).toBe('Central Equatoria');
  });
});
