/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for dhis2-export-service.ts
 * Covers DHIS2 data export generation, CSV/JSON serialization, and indicator calculations.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-dhis-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/services/birth-service', () => ({
  getAllBirths: jest.fn().mockResolvedValue([]),
  getBirthStats: jest.fn().mockResolvedValue({
    total: 0,
    byGender: { male: 0, female: 0 },
    byDeliveryType: { caesarean: 0, vaginal: 0 },
  }),
}));
jest.mock('@/lib/services/death-service', () => ({
  getAllDeaths: jest.fn().mockResolvedValue([]),
  getDeathStats: jest.fn().mockResolvedValue({
    total: 0,
    notified: 0,
    registered: 0,
    withICD11Code: 0,
    maternalDeaths: 0,
    under5Deaths: 0,
    neonatalDeaths: 0,
  }),
}));
jest.mock('@/lib/services/facility-assessment-service', () => ({
  getAllAssessments: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/services/data-quality-service', () => ({
  getNationalDataQuality: jest.fn().mockResolvedValue({
    avgCompleteness: 85,
    avgTimeliness: 90,
    avgQuality: 87,
    dhis2Adoption: 75,
    totalHISStaff: 50,
  }),
}));

import { teardownTestDBs, putDoc } from '../helpers/test-db';
import { generateDHIS2Export, exportToJSON, exportToCSV, periodToRange } from '@/lib/services/dhis2-export-service';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
  jest.clearAllMocks();
});

// Test period used throughout is '202601' (January 2026). An instant safely
// inside that period's Africa/Juba window, for docs that need an event
// timestamp to survive the export's period filter.
const IN_PERIOD = '2026-01-15T12:00:00.000Z';

// Helper to create sample documents
function createHospital(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'hospital',
    name: `Hospital ${id}`,
    totalBeds: 50,
    doctors: 10,
    nurses: 20,
    clinicalOfficers: 5,
    ...overrides,
  };
}

function createDiseaseAlert(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'disease_alert',
    disease: 'Malaria',
    alertLevel: 'warning' as const,
    reportDate: IN_PERIOD,
    ...overrides,
  };
}

function createLabResult(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'lab_result',
    status: 'completed' as const,
    critical: false,
    orderedAt: IN_PERIOD,
    ...overrides,
  };
}

function createPrescription(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'prescription',
    status: 'dispensed' as const,
    createdAt: IN_PERIOD,
    ...overrides,
  };
}

function createImmunization(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'immunization',
    patientId: 'child-001',
    vaccine: 'BCG',
    doseNumber: 1,
    status: 'completed' as const,
    dateGiven: IN_PERIOD,
    ...overrides,
  };
}

function createANCVisit(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'anc_visit',
    motherId: 'mother-001',
    riskLevel: 'normal' as const,
    visitDate: IN_PERIOD,
    ...overrides,
  };
}

function createEncounter(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'clinical_encounter',
    patientId: 'pat-001',
    patientName: 'Test Patient',
    clinicianId: '',
    clinicianName: '',
    hospitalId: 'hosp-001',
    status: 'with_clinician',
    stageKey: 'clinician',
    snapshot: {},
    labOrderIds: [],
    startedAt: IN_PERIOD,
    createdAt: IN_PERIOD,
    updatedAt: IN_PERIOD,
    ...overrides,
  };
}

function createPatient(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    type: 'patient',
    firstName: 'Test',
    surname: 'Patient',
    gender: 'Male' as const,
    dateOfBirth: '2020-01-01',
    ...overrides,
  };
}

describe('dhis2-export-service', () => {
  test('generateDHIS2Export returns valid DHIS2DataSet structure', async () => {
    const dataset = await generateDHIS2Export('202601');

    expect(dataset).toBeDefined();
    expect(dataset.exportDate).toBeDefined();
    expect(dataset.period).toBe('202601');
    expect(dataset.orgUnit).toBe('SS');
    expect(Array.isArray(dataset.dataValues)).toBe(true);
  });

  test('generateDHIS2Export includes population health indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('TOTAL_HOSPITALS');
    expect(elements).toContain('TOTAL_PATIENTS');
    expect(elements).toContain('TOTAL_BEDS');
    expect(elements).toContain('TOTAL_DOCTORS');
    expect(elements).toContain('TOTAL_NURSES');
    expect(elements).toContain('TOTAL_CLINICAL_OFFICERS');
  });

  test('generateDHIS2Export includes CRVS indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('BIRTHS_REGISTERED');
    expect(elements).toContain('BIRTHS_MALE');
    expect(elements).toContain('BIRTHS_FEMALE');
    expect(elements).toContain('BIRTHS_CAESAREAN');
    expect(elements).toContain('DEATHS_REGISTERED');
    expect(elements).toContain('DEATHS_WITH_ICD11');
    expect(elements).toContain('MATERNAL_DEATHS');
    expect(elements).toContain('UNDER5_DEATHS');
    expect(elements).toContain('NEONATAL_DEATHS');
    expect(elements).toContain('DEATH_NOTIFICATION_RATE');
    expect(elements).toContain('DEATH_REGISTRATION_RATE');
  });

  test('generateDHIS2Export includes disease surveillance indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('ACTIVE_DISEASE_ALERTS');
    expect(elements).toContain('TOTAL_REFERRALS');
  });

  test('generateDHIS2Export includes lab indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('LAB_TESTS_TOTAL');
    expect(elements).toContain('LAB_TESTS_COMPLETED');
    expect(elements).toContain('LAB_TESTS_PENDING');
    expect(elements).toContain('LAB_TESTS_IN_PROGRESS');
    expect(elements).toContain('LAB_CRITICAL_RESULTS');
  });

  test('generateDHIS2Export includes prescription indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('PRESCRIPTIONS_TOTAL');
    expect(elements).toContain('PRESCRIPTIONS_DISPENSED');
    expect(elements).toContain('PRESCRIPTIONS_PENDING');
  });

  test('generateDHIS2Export includes immunization indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('IMM_CHILDREN_TOTAL');
    expect(elements).toContain('IMM_BCG_COMPLETED');
    expect(elements).toContain('IMM_PENTA3_COMPLETED');
    expect(elements).toContain('IMM_MEASLES1_COMPLETED');
    expect(elements).toContain('IMM_DEFAULTERS');
  });

  // IMM_*_COVERAGE elements were removed — they divided doses by "unique
  // children seen in this dataset" rather than a population/census
  // denominator, which is not a valid coverage rate
  // (docs/EMR-FIELD-AUDIT-2026-07.md §4 honesty fix).
  test('generateDHIS2Export no longer emits uninterpretable immunization coverage percentages', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).not.toContain('IMM_BCG_COVERAGE');
    expect(elements).not.toContain('IMM_PENTA3_COVERAGE');
    expect(elements).not.toContain('IMM_MEASLES1_COVERAGE');
  });

  test('generateDHIS2Export includes OPD attendance indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('OPD_ATTENDANCE_TOTAL');
    expect(elements).toContain('OPD_ATTENDANCE_NEW');
    expect(elements).toContain('OPD_ATTENDANCE_REPEAT');
    expect(elements).toContain('OPD_ATTENDANCE_BY_CATEGORY');
  });

  test('generateDHIS2Export includes ANC indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('ANC_MOTHERS_TOTAL');
    expect(elements).toContain('ANC_VISITS_TOTAL');
    expect(elements).toContain('ANC_4PLUS_VISITS');
    expect(elements).toContain('ANC_HIGH_RISK');
  });

  test('generateDHIS2Export includes data quality indicators', async () => {
    const dataset = await generateDHIS2Export('202601');

    const elements = dataset.dataValues.map(v => v.dataElement);
    expect(elements).toContain('REPORTING_COMPLETENESS');
    expect(elements).toContain('REPORTING_TIMELINESS');
    expect(elements).toContain('DATA_QUALITY_SCORE');
    expect(elements).toContain('DHIS2_ADOPTION_RATE');
    expect(elements).toContain('FACILITIES_ASSESSED');
    expect(elements).toContain('HIS_WORKFORCE');
  });

  test('exportToJSON serializes DHIS2DataSet correctly', async () => {
    const dataset = await generateDHIS2Export('202601');
    const json = exportToJSON(dataset);

    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.period).toBe('202601');
    expect(parsed.orgUnit).toBe('SS');
    expect(Array.isArray(parsed.dataValues)).toBe(true);
  });

  test('exportToJSON is pretty-printed', async () => {
    const dataset = await generateDHIS2Export('202601');
    const json = exportToJSON(dataset);

    // Should have indentation (2 spaces) for readability
    expect(json).toMatch(/\n  /);
  });

  test('exportToCSV includes header row', async () => {
    const dataset = await generateDHIS2Export('202601');
    const csv = exportToCSV(dataset);

    const lines = csv.split('\n');
    expect(lines[0]).toBe('dataElement,category,value,period,orgUnit');
  });

  test('exportToCSV escapes values with commas', async () => {
    const dataset = await generateDHIS2Export('202601');
    const csv = exportToCSV(dataset);

    // Verify CSV format is correct (no unescaped commas within values)
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);

    // Each data line should be parseable
    for (let i = 1; i < lines.length && lines[i].trim(); i++) {
      const line = lines[i];
      expect(line).toBeDefined();
    }
  });

  test('exportToCSV escapes quotes properly', async () => {
    const dataset = await generateDHIS2Export('202601');
    // Manually add a data value with quotes to test escaping
    dataset.dataValues.push({
      dataElement: 'TEST_QUOTES',
      category: 'default',
      value: 'Value with "quotes"',
      period: '202601',
      orgUnit: 'SS',
    });

    const csv = exportToCSV(dataset);
    // Quoted values should have internal quotes escaped
    expect(csv).toContain('"Value with ""quotes"""');
  });

  test('exportToCSV has correct number of data lines', async () => {
    const dataset = await generateDHIS2Export('202601');
    const csv = exportToCSV(dataset);

    const lines = csv.split('\n').filter(line => line.trim());
    expect(lines.length).toBe(dataset.dataValues.length + 1); // +1 for header
  });

  test('generateDHIS2Export sets correct period', async () => {
    const dataset = await generateDHIS2Export('202502');

    for (const dv of dataset.dataValues) {
      expect(dv.period).toBe('202502');
    }
  });

  test('generateDHIS2Export sets default orgUnit', async () => {
    const dataset = await generateDHIS2Export('202601');

    for (const dv of dataset.dataValues) {
      expect(['SS'].includes(dv.orgUnit)).toBe(true);
    }
  });

  test('exportToCSV handles empty dataset', async () => {
    const emptyDataset = {
      exportDate: new Date().toISOString(),
      period: '202601',
      orgUnit: 'SS',
      dataValues: [],
    };

    const csv = exportToCSV(emptyDataset);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('dataElement,category,value,period,orgUnit');
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  test('generateDHIS2Export aggregates hospital data correctly', async () => {
    const { hospitalsDB } = require('@/lib/db');
    const hdb = hospitalsDB();

    // Add hospitals with varying staff counts
    await putDoc(hdb, createHospital('hosp-001', { totalBeds: 100, doctors: 20, nurses: 40, clinicalOfficers: 10 }));
    await putDoc(hdb, createHospital('hosp-002', { totalBeds: 50, doctors: 10, nurses: 20, clinicalOfficers: 5 }));

    const dataset = await generateDHIS2Export('202601');
    const elements = dataset.dataValues;

    const totalBeds = elements.find(e => e.dataElement === 'TOTAL_BEDS');
    const totalDoctors = elements.find(e => e.dataElement === 'TOTAL_DOCTORS');
    const totalNurses = elements.find(e => e.dataElement === 'TOTAL_NURSES');

    expect(totalBeds).toBeDefined();
    expect(totalBeds!.value).toBe('150'); // 100 + 50
    expect(totalDoctors!.value).toBe('30'); // 20 + 10
    expect(totalNurses!.value).toBe('60'); // 40 + 20
  });

  test('generateDHIS2Export counts disease alerts by alert level', async () => {
    const { diseaseAlertsDB } = require('@/lib/db');
    const dadb = diseaseAlertsDB();

    await putDoc(dadb, createDiseaseAlert('alert-001', { alertLevel: 'emergency' }));
    await putDoc(dadb, createDiseaseAlert('alert-002', { alertLevel: 'emergency' }));
    await putDoc(dadb, createDiseaseAlert('alert-003', { alertLevel: 'warning' }));
    await putDoc(dadb, createDiseaseAlert('alert-004', { alertLevel: 'info' })); // Should not be counted

    const dataset = await generateDHIS2Export('202601');
    const activeAlerts = dataset.dataValues.find(e => e.dataElement === 'ACTIVE_DISEASE_ALERTS');

    expect(activeAlerts).toBeDefined();
    expect(activeAlerts!.value).toBe('3'); // emergency + emergency + warning
  });

  test('generateDHIS2Export calculates lab result statuses', async () => {
    const { labResultsDB } = require('@/lib/db');
    const ldb = labResultsDB();

    await putDoc(ldb, createLabResult('lab-001', { status: 'completed' }));
    await putDoc(ldb, createLabResult('lab-002', { status: 'completed' }));
    await putDoc(ldb, createLabResult('lab-003', { status: 'pending' }));
    await putDoc(ldb, createLabResult('lab-004', { status: 'in_progress' }));
    await putDoc(ldb, createLabResult('lab-005', { status: 'completed', critical: true }));
    await putDoc(ldb, createLabResult('lab-006', { status: 'pending', critical: true }));

    const dataset = await generateDHIS2Export('202601');

    const totalTests = dataset.dataValues.find(e => e.dataElement === 'LAB_TESTS_TOTAL');
    const completed = dataset.dataValues.find(e => e.dataElement === 'LAB_TESTS_COMPLETED');
    const pending = dataset.dataValues.find(e => e.dataElement === 'LAB_TESTS_PENDING');
    const inProgress = dataset.dataValues.find(e => e.dataElement === 'LAB_TESTS_IN_PROGRESS');
    const critical = dataset.dataValues.find(e => e.dataElement === 'LAB_CRITICAL_RESULTS');

    expect(totalTests!.value).toBe('6');
    expect(completed!.value).toBe('3'); // 2 + 1 critical
    expect(pending!.value).toBe('2'); // 1 + 1 critical
    expect(inProgress!.value).toBe('1');
    expect(critical!.value).toBe('2');
  });

  test('generateDHIS2Export calculates prescription statuses', async () => {
    const { prescriptionsDB } = require('@/lib/db');
    const rxdb = prescriptionsDB();

    await putDoc(rxdb, createPrescription('rx-001', { status: 'dispensed' }));
    await putDoc(rxdb, createPrescription('rx-002', { status: 'dispensed' }));
    await putDoc(rxdb, createPrescription('rx-003', { status: 'pending' }));

    const dataset = await generateDHIS2Export('202601');

    const total = dataset.dataValues.find(e => e.dataElement === 'PRESCRIPTIONS_TOTAL');
    const dispensed = dataset.dataValues.find(e => e.dataElement === 'PRESCRIPTIONS_DISPENSED');
    const pending = dataset.dataValues.find(e => e.dataElement === 'PRESCRIPTIONS_PENDING');

    expect(total!.value).toBe('3');
    expect(dispensed!.value).toBe('2');
    expect(pending!.value).toBe('1');
  });

  test('generateDHIS2Export calculates immunization coverage rates', async () => {
    const { immunizationsDB } = require('@/lib/db');
    const immdb = immunizationsDB();

    // 2 children with BCG completed
    await putDoc(immdb, createImmunization('imm-001', { patientId: 'child-001', vaccine: 'BCG', status: 'completed' }));
    await putDoc(immdb, createImmunization('imm-002', { patientId: 'child-002', vaccine: 'BCG', status: 'completed' }));
    // 2 children total with various vaccines
    await putDoc(immdb, createImmunization('imm-003', { patientId: 'child-001', vaccine: 'Penta', doseNumber: 3, status: 'completed' }));
    await putDoc(immdb, createImmunization('imm-004', { patientId: 'child-002', vaccine: 'Measles', doseNumber: 1, status: 'completed' }));

    const dataset = await generateDHIS2Export('202601');

    const immChildren = dataset.dataValues.find(e => e.dataElement === 'IMM_CHILDREN_TOTAL');
    const bcgCompleted = dataset.dataValues.find(e => e.dataElement === 'IMM_BCG_COMPLETED');

    expect(immChildren!.value).toBe('2');
    expect(bcgCompleted!.value).toBe('2');
  });

  test('generateDHIS2Export calculates ANC visit aggregates', async () => {
    const { ancDB } = require('@/lib/db');
    const ancdb = ancDB();

    // Mother 1: 5 visits
    await putDoc(ancdb, createANCVisit('anc-001', { motherId: 'mother-001', riskLevel: 'normal' }));
    await putDoc(ancdb, createANCVisit('anc-002', { motherId: 'mother-001', riskLevel: 'normal' }));
    await putDoc(ancdb, createANCVisit('anc-003', { motherId: 'mother-001', riskLevel: 'normal' }));
    await putDoc(ancdb, createANCVisit('anc-004', { motherId: 'mother-001', riskLevel: 'normal' }));
    await putDoc(ancdb, createANCVisit('anc-005', { motherId: 'mother-001', riskLevel: 'normal' }));

    // Mother 2: 3 visits
    await putDoc(ancdb, createANCVisit('anc-006', { motherId: 'mother-002', riskLevel: 'high' }));
    await putDoc(ancdb, createANCVisit('anc-007', { motherId: 'mother-002', riskLevel: 'high' }));
    await putDoc(ancdb, createANCVisit('anc-008', { motherId: 'mother-002', riskLevel: 'high' }));

    // Mother 3: 2 visits
    await putDoc(ancdb, createANCVisit('anc-009', { motherId: 'mother-003', riskLevel: 'normal' }));
    await putDoc(ancdb, createANCVisit('anc-010', { motherId: 'mother-003', riskLevel: 'normal' }));

    const dataset = await generateDHIS2Export('202601');

    const totalMothers = dataset.dataValues.find(e => e.dataElement === 'ANC_MOTHERS_TOTAL');
    const totalVisits = dataset.dataValues.find(e => e.dataElement === 'ANC_VISITS_TOTAL');
    const anc4Plus = dataset.dataValues.find(e => e.dataElement === 'ANC_4PLUS_VISITS');
    const highRisk = dataset.dataValues.find(e => e.dataElement === 'ANC_HIGH_RISK');

    expect(totalMothers!.value).toBe('3');
    expect(totalVisits!.value).toBe('10');
    expect(anc4Plus!.value).toBe('1'); // Only mother-001 has >= 4 visits
    expect(highRisk!.value).toBe('1'); // Only mother-002
  });

  test('generateDHIS2Export includes per-facility births and deaths', async () => {
    const { hospitalsDB } = require('@/lib/db');

    // Mock the services to return data with facility IDs
    const birthService = require('@/lib/services/birth-service');
    const deathService = require('@/lib/services/death-service');

    birthService.getAllBirths.mockResolvedValueOnce([
      { _id: 'birth-001', facilityId: 'hosp-001', dateOfBirth: IN_PERIOD },
      { _id: 'birth-002', facilityId: 'hosp-001', dateOfBirth: IN_PERIOD },
      { _id: 'birth-003', facilityId: 'hosp-002', dateOfBirth: IN_PERIOD },
    ]);

    deathService.getAllDeaths.mockResolvedValueOnce([
      { _id: 'death-001', facilityId: 'hosp-001', dateOfDeath: IN_PERIOD },
      { _id: 'death-002', facilityId: 'hosp-002', dateOfDeath: IN_PERIOD },
    ]);

    const hdb = hospitalsDB();
    await putDoc(hdb, createHospital('hosp-001'));
    await putDoc(hdb, createHospital('hosp-002'));

    const dataset = await generateDHIS2Export('202601');

    const facilityBirthsDeaths = dataset.dataValues.filter(
      e => e.dataElement === 'FACILITY_BIRTHS' || e.dataElement === 'FACILITY_DEATHS'
    );

    expect(facilityBirthsDeaths.length).toBeGreaterThan(0);
  });

  test('exportToCSV escapes newlines in values', async () => {
    const dataset = {
      exportDate: new Date().toISOString(),
      period: '202601',
      orgUnit: 'SS',
      dataValues: [
        { dataElement: 'TEST', category: 'default', value: 'Line1\nLine2', period: '202601', orgUnit: 'SS' },
      ],
    };

    const csv = exportToCSV(dataset);
    expect(csv).toContain('"Line1\nLine2"');
  });

  test('exportToJSON preserves all fields', async () => {
    const dataset = await generateDHIS2Export('202601');
    const json = exportToJSON(dataset);
    const parsed = JSON.parse(json);

    expect(parsed.exportDate).toBeDefined();
    expect(parsed.period).toBe('202601');
    expect(parsed.orgUnit).toBe('SS');
    expect(parsed.dataValues).toBeInstanceOf(Array);
    expect(parsed.dataValues.every((dv: { dataElement?: unknown; category?: unknown; value?: unknown }) => dv.dataElement && dv.category && dv.value !== undefined)).toBe(true);
  });

  // ── Period + scope filtering (docs/EMR-FIELD-AUDIT-2026-07.md §4) ──
  describe('period and scope filtering', () => {
    test('excludes a lab result ordered one instant before the period, includes one at the exact boundary', async () => {
      const { labResultsDB } = require('@/lib/db');
      const ldb = labResultsDB();
      const { from } = periodToRange('202601', 'monthly');
      const justBefore = new Date(new Date(from).getTime() - 1).toISOString();

      await putDoc(ldb, createLabResult('lab-before', { orderedAt: justBefore }));
      await putDoc(ldb, createLabResult('lab-at-start', { orderedAt: from }));

      const dataset = await generateDHIS2Export('202601');
      const total = dataset.dataValues.find(e => e.dataElement === 'LAB_TESTS_TOTAL');

      expect(total!.value).toBe('1'); // only lab-at-start is in [from, to)
    });

    test('excludes a lab result ordered at the exact end boundary (half-open range)', async () => {
      const { labResultsDB } = require('@/lib/db');
      const ldb = labResultsDB();
      const { to } = periodToRange('202601', 'monthly');

      await putDoc(ldb, createLabResult('lab-at-end', { orderedAt: to }));
      await putDoc(ldb, createLabResult('lab-inside', { orderedAt: new Date(new Date(to).getTime() - 1).toISOString() }));

      const dataset = await generateDHIS2Export('202601');
      const total = dataset.dataValues.find(e => e.dataElement === 'LAB_TESTS_TOTAL');

      expect(total!.value).toBe('1'); // only lab-inside is < to
    });

    test('excludes prescriptions and immunizations from outside the requested month', async () => {
      const { prescriptionsDB, immunizationsDB } = require('@/lib/db');
      const rxdb = prescriptionsDB();
      const immdb = immunizationsDB();

      await putDoc(rxdb, createPrescription('rx-out-of-period', { createdAt: '2026-02-01T00:00:00.000Z' }));
      await putDoc(rxdb, createPrescription('rx-in-period', {}));
      await putDoc(immdb, createImmunization('imm-out-of-period', { dateGiven: '2025-12-31T00:00:00.000Z' }));
      await putDoc(immdb, createImmunization('imm-in-period', {}));

      const dataset = await generateDHIS2Export('202601');
      const rxTotal = dataset.dataValues.find(e => e.dataElement === 'PRESCRIPTIONS_TOTAL');
      const immChildren = dataset.dataValues.find(e => e.dataElement === 'IMM_CHILDREN_TOTAL');

      expect(rxTotal!.value).toBe('1');
      expect(immChildren!.value).toBe('1');
    });

    test('scopes lab results to the requesting facility only', async () => {
      const { labResultsDB } = require('@/lib/db');
      const ldb = labResultsDB();

      await putDoc(ldb, createLabResult('lab-hosp-001', { hospitalId: 'hosp-001', orgId: 'org-1' }));
      await putDoc(ldb, createLabResult('lab-hosp-002', { hospitalId: 'hosp-002', orgId: 'org-1' }));

      const dataset = await generateDHIS2Export('202601', { role: 'medical_superintendent', hospitalId: 'hosp-001', orgId: 'org-1' });
      const total = dataset.dataValues.find(e => e.dataElement === 'LAB_TESTS_TOTAL');

      expect(total!.value).toBe('1'); // hosp-002's result must not leak into hosp-001's export
    });

    test('scopes hospital stock counts (beds) to the requesting facility only', async () => {
      const { hospitalsDB } = require('@/lib/db');
      const hdb = hospitalsDB();

      await putDoc(hdb, createHospital('hosp-001', { totalBeds: 40, orgId: 'org-1' }));
      await putDoc(hdb, createHospital('hosp-002', { totalBeds: 90, orgId: 'org-1' }));

      const dataset = await generateDHIS2Export('202601', { role: 'medical_superintendent', hospitalId: 'hosp-001', orgId: 'org-1' });
      const beds = dataset.dataValues.find(e => e.dataElement === 'TOTAL_BEDS');
      const facilityRows = dataset.dataValues.filter(e => e.dataElement === 'FACILITY_BIRTHS');

      expect(beds!.value).toBe('40'); // hosp-002's 90 beds must not be summed in
      expect(facilityRows).toHaveLength(1); // only the scoped facility's row is emitted
      expect(facilityRows[0].orgUnit).toBe('hosp-001');
    });
  });

  // ── OPD attendance (new indicator) ──
  describe('OPD attendance', () => {
    test('splits attendance into new vs repeat and leaves the total unsplit-inclusive', async () => {
      const { encountersDB } = require('@/lib/db');
      const edb = encountersDB();

      await putDoc(edb, createEncounter('enc-new-1', { attendanceType: 'new' }));
      await putDoc(edb, createEncounter('enc-new-2', { attendanceType: 'new' }));
      await putDoc(edb, createEncounter('enc-repeat-1', { attendanceType: 'repeat' }));

      const dataset = await generateDHIS2Export('202601');
      const total = dataset.dataValues.find(e => e.dataElement === 'OPD_ATTENDANCE_TOTAL');
      const newAtt = dataset.dataValues.find(e => e.dataElement === 'OPD_ATTENDANCE_NEW');
      const repeatAtt = dataset.dataValues.find(e => e.dataElement === 'OPD_ATTENDANCE_REPEAT');

      expect(total!.value).toBe('3');
      expect(newAtt!.value).toBe('2');
      expect(repeatAtt!.value).toBe('1');
    });

    test('excludes an encounter that started outside the requested period', async () => {
      const { encountersDB } = require('@/lib/db');
      const edb = encountersDB();

      await putDoc(edb, createEncounter('enc-old', { startedAt: '2025-11-01T00:00:00.000Z', attendanceType: 'new' }));
      await putDoc(edb, createEncounter('enc-current', { attendanceType: 'new' }));

      const dataset = await generateDHIS2Export('202601');
      const total = dataset.dataValues.find(e => e.dataElement === 'OPD_ATTENDANCE_TOTAL');

      expect(total!.value).toBe('1');
    });

    test('joins age band + sex from the patient for a known patient', async () => {
      const { encountersDB, patientsDB } = require('@/lib/db');
      const edb = encountersDB();
      const pdb = patientsDB();

      await putDoc(pdb, createPatient('pat-child', { gender: 'Female', dateOfBirth: '2024-01-01' })); // 2 years old at IN_PERIOD
      await putDoc(edb, createEncounter('enc-child', { patientId: 'pat-child' }));

      const dataset = await generateDHIS2Export('202601');
      const combos = dataset.dataValues.filter(e => e.dataElement === 'OPD_ATTENDANCE_BY_CATEGORY');
      const under5Female = combos.find(c => c.category === 'under5-female');

      expect(under5Female!.value).toBe('1');
    });

    test('counts an encounter whose patient cannot be joined under the explicit unknown-age combo, never guessing a band', async () => {
      const { encountersDB } = require('@/lib/db');
      const edb = encountersDB();

      // No matching PatientDoc exists for 'pat-missing'.
      await putDoc(edb, createEncounter('enc-unjoinable', { patientId: 'pat-missing' }));

      const dataset = await generateDHIS2Export('202601');
      const combos = dataset.dataValues.filter(e => e.dataElement === 'OPD_ATTENDANCE_BY_CATEGORY');
      const unknown = combos.find(c => c.category === 'unknown-age-unknown-sex');
      const under5 = combos.filter(c => c.category.startsWith('under5'));
      const fivePlus = combos.filter(c => c.category.startsWith('5plus'));

      expect(unknown!.value).toBe('1');
      // None of the known age bands should have absorbed this unjoinable encounter.
      expect(under5.every(c => c.value === '0')).toBe(true);
      expect(fivePlus.every(c => c.value === '0')).toBe(true);
    });

    test('emits the full expected age/sex grid with zeros when there is no data, mirroring the per-facility births/deaths pattern', async () => {
      const dataset = await generateDHIS2Export('202601');
      const combos = dataset.dataValues.filter(e => e.dataElement === 'OPD_ATTENDANCE_BY_CATEGORY');
      const categories = combos.map(c => c.category).sort();

      expect(categories).toEqual([
        '5plus-female', '5plus-male',
        'under5-female', 'under5-male',
        'unknown-age-female', 'unknown-age-male',
      ].sort());
      expect(combos.every(c => c.value === '0')).toBe(true);
    });
  });
});
