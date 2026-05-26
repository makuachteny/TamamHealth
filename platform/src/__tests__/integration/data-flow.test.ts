/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Integration tests for cross-module data flows in the TamamHealth EMR.
 * Verifies that lab results link to patients, birth/death stats work together,
 * immunization coverage calculations are correct, and DHIS2 export aggregates data.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createPatient,
  getAllPatients,
  searchPatients,
} from '@/lib/services/patient-service';
import {
  createLabResult,
  getLabResultsByPatient,
  getPendingLabResults,
  updateLabResult,
} from '@/lib/services/lab-service';
import {
  createBirth,
  getBirthStats,
} from '@/lib/services/birth-service';
import {
  createDeath,
  getDeathStats,
} from '@/lib/services/death-service';
import {
  createImmunization,
  getImmunizationStats,
  getVaccineCoverage,
  getByPatient,
} from '@/lib/services/immunization-service';
import { generateDHIS2Export } from '@/lib/services/dhis2-export-service';

const makePatientData = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Achol',
  middleName: '',
  surname: 'Deng',
  gender: 'Female' as const,
  dateOfBirth: '1995-06-15',
  phone: '+211912345678',
  state: 'Central Equatoria',
  county: 'Juba',
  tribe: 'Dinka',
  primaryLanguage: 'Arabic',
  bloodType: 'O+',
  allergies: [] as string[],
  chronicConditions: [] as string[],
  nokName: 'Deng Mabior',
  nokRelationship: 'Father',
  nokPhone: '+211912345679',
  hospitalNumber: '',
  registrationHospital: 'hosp-001',
  registrationDate: '2025-01-10',
  lastVisitDate: '2025-01-10',
  lastVisitHospital: 'hosp-001',
  isActive: true,
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('Integration: data-flow', () => {
  test('Lab results link to patient records', async () => {
    const patient = await createPatient(makePatientData());

    const lab1 = await createLabResult({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      hospitalNumber: patient.hospitalNumber,
      testName: 'Malaria RDT',
      specimen: 'Blood',
      status: 'pending',
      result: '',
      unit: '',
      referenceRange: '',
      abnormal: false,
      critical: false,
      orderedBy: 'Dr. Mayen',
      orderedAt: '2025-03-01T08:00:00Z',
      completedAt: '',
    });

    const lab2 = await createLabResult({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      hospitalNumber: patient.hospitalNumber,
      testName: 'CBC',
      specimen: 'Blood',
      status: 'pending',
      result: '',
      unit: '',
      referenceRange: '',
      abnormal: false,
      critical: false,
      orderedBy: 'Dr. Mayen',
      orderedAt: '2025-03-01T09:00:00Z',
      completedAt: '',
    });

    // Both labs belong to the patient
    const patientLabs = await getLabResultsByPatient(patient._id);
    expect(patientLabs).toHaveLength(2);
    expect(patientLabs.every(l => l.patientId === patient._id)).toBe(true);

    // Complete one, the other stays pending
    await updateLabResult(lab1._id, { status: 'completed', result: 'Positive' });
    const pending = await getPendingLabResults();
    expect(pending).toHaveLength(1);
    expect(pending[0]._id).toBe(lab2._id);
  });

  test('Birth registration creates proper records with stats', async () => {
    const today = new Date().toISOString().slice(0, 10);

    await createBirth({
      childFirstName: 'Baby',
      childSurname: 'One',
      childGender: 'Male',
      dateOfBirth: today,
      placeOfBirth: 'Juba Teaching Hospital',
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      motherName: 'Mother One',
      motherAge: 25,
      motherNationality: 'South Sudanese',
      fatherName: 'Father One',
      fatherNationality: 'South Sudanese',
      birthWeight: 3000,
      birthType: 'single',
      deliveryType: 'normal',
      attendedBy: 'midwife',
      registeredBy: 'Nurse A',
      state: 'Central Equatoria',
      county: 'Juba',
      certificateNumber: 'CERT-INT-001',
    });

    await createBirth({
      childFirstName: 'Baby',
      childSurname: 'Two',
      childGender: 'Female',
      dateOfBirth: today,
      placeOfBirth: 'Wau State Hospital',
      facilityId: 'hosp-002',
      facilityName: 'Wau State Hospital',
      motherName: 'Mother Two',
      motherAge: 30,
      motherNationality: 'South Sudanese',
      fatherName: 'Father Two',
      fatherNationality: 'South Sudanese',
      birthWeight: 2800,
      birthType: 'single',
      deliveryType: 'caesarean',
      attendedBy: 'doctor',
      registeredBy: 'Nurse B',
      state: 'Western Bahr el Ghazal',
      county: 'Wau',
      certificateNumber: 'CERT-INT-002',
    });

    const stats = await getBirthStats();
    expect(stats.total).toBe(2);
    expect(stats.byGender.male).toBe(1);
    expect(stats.byGender.female).toBe(1);
    expect(stats.byDeliveryType.normal).toBe(1);
    expect(stats.byDeliveryType.caesarean).toBe(1);
  });

  test('Death stats correctly count neonatal deaths', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const baseDeathData = {
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      placeOfDeath: 'Juba Teaching Hospital',
      immediateCause: 'Sepsis',
      immediateICD11: 'KA60',
      antecedentCause1: '',
      antecedentICD11_1: '',
      antecedentCause2: '',
      antecedentICD11_2: '',
      underlyingCause: '',
      underlyingICD11: '',
      contributingConditions: '',
      contributingICD11: '',
      mannerOfDeath: 'natural' as const,
      maternalDeath: false,
      pregnancyRelated: false,
      certifiedBy: 'Dr. Mayen',
      certifierRole: 'doctor',
      state: 'Central Equatoria',
      county: 'Juba',
      certificateNumber: 'DEATH-INT-001',
      deathNotified: true,
      deathRegistered: true,
    };

    // Neonatal death (< 28 days = 0.077 years)
    await createDeath({
      ...baseDeathData,
      deceasedFirstName: 'Neonate',
      deceasedSurname: 'A',
      deceasedGender: 'Male',
      dateOfBirth: '2025-12-01',
      dateOfDeath: today,
      ageAtDeath: 0.01, // ~4 days
      certificateNumber: 'DEATH-INT-001',
    });

    // Under-5 but not neonatal
    await createDeath({
      ...baseDeathData,
      deceasedFirstName: 'Toddler',
      deceasedSurname: 'B',
      deceasedGender: 'Female',
      dateOfBirth: '2023-01-01',
      dateOfDeath: today,
      ageAtDeath: 3,
      certificateNumber: 'DEATH-INT-002',
    });

    // Adult
    await createDeath({
      ...baseDeathData,
      deceasedFirstName: 'Adult',
      deceasedSurname: 'C',
      deceasedGender: 'Male',
      dateOfBirth: '1980-01-01',
      dateOfDeath: today,
      ageAtDeath: 45,
      certificateNumber: 'DEATH-INT-003',
    });

    const stats = await getDeathStats();
    expect(stats.total).toBe(3);
    expect(stats.neonatalDeaths).toBe(1);
    expect(stats.under5Deaths).toBe(2); // neonate + toddler
  });

  test('Immunization stats calculate coverage correctly', async () => {
    const makeImm = (patientId: string, vaccine: string, doseNumber: number, status: string) => ({
      patientId,
      patientName: `Child ${patientId}`,
      gender: 'Female' as const,
      dateOfBirth: '2024-01-01',
      vaccine,
      doseNumber,
      dateGiven: '2024-06-15',
      nextDueDate: '2024-08-15',
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      state: 'Central Equatoria',
      administeredBy: 'Nurse A',
      batchNumber: 'BATCH-001',
      site: 'left arm' as const,
      adverseReaction: false,
      status: status as 'completed' | 'scheduled' | 'overdue' | 'missed',
    });

    // Child 1: fully immunized (BCG + Penta3 + Measles1)
    await createImmunization(makeImm('child-1', 'BCG', 1, 'completed'));
    await createImmunization(makeImm('child-1', 'Penta', 3, 'completed'));
    await createImmunization(makeImm('child-1', 'Measles', 1, 'completed'));

    // Child 2: partially immunized
    await createImmunization(makeImm('child-2', 'BCG', 1, 'completed'));
    await createImmunization(makeImm('child-2', 'Penta', 1, 'completed'));
    await createImmunization(makeImm('child-2', 'Penta', 2, 'scheduled'));

    const stats = await getImmunizationStats();
    expect(stats.totalChildren).toBe(2);
    expect(stats.fullyImmunized).toBe(1);
    expect(stats.coverageRate).toBe(50);

    const coverage = await getVaccineCoverage();
    const bcg = coverage.find(c => c.vaccine === 'BCG');
    expect(bcg!.percentage).toBe(100); // both children have BCG

    const penta = coverage.find(c => c.vaccine === 'Penta');
    expect(penta!.count).toBe(2); // both children have at least one Penta completed
  });

  test('Cross-module: patient search finds patients from different registration sources', async () => {
    // Patient registered at facility A
    await createPatient(makePatientData({
      firstName: 'Nyabol',
      surname: 'Kuol',
      dateOfBirth: '1996-02-20',
      phone: '+211912345001',
      registrationHospital: 'hosp-001',
    }));

    // Patient registered at facility B
    await createPatient(makePatientData({
      firstName: 'Mayen',
      surname: 'Garang',
      dateOfBirth: '1990-08-10',
      registrationHospital: 'hosp-002',
      phone: '+211988776655',
    }));

    // Patient registered at a rural PHCU
    await createPatient(makePatientData({
      firstName: 'Deng',
      surname: 'Bol',
      dateOfBirth: '2001-11-05',
      phone: '+211912345003',
      registrationHospital: 'hosp-005',
      boma: 'Luri',
    }));

    const allPatients = await getAllPatients();
    expect(allPatients).toHaveLength(3);

    // Search by name finds across hospitals
    const nyabol = await searchPatients('Nyabol');
    expect(nyabol).toHaveLength(1);
    expect(nyabol[0].registrationHospital).toBe('hosp-001');

    const mayen = await searchPatients('Garang');
    expect(mayen).toHaveLength(1);
    expect(mayen[0].registrationHospital).toBe('hosp-002');

    // Search by boma finds community-registered patient
    const bomaSearch = await searchPatients('Luri');
    expect(bomaSearch).toHaveLength(1);
    expect(bomaSearch[0].firstName).toBe('Deng');
  });

  test('Immunization records link to patient', async () => {
    const patient = await createPatient(makePatientData({
      firstName: 'Baby',
      surname: 'Immunized',
      dateOfBirth: '2024-06-01',
    }));

    await createImmunization({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      gender: 'Female',
      dateOfBirth: '2024-06-01',
      vaccine: 'BCG',
      doseNumber: 1,
      dateGiven: '2024-06-15',
      nextDueDate: '2024-08-15',
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      state: 'Central Equatoria',
      administeredBy: 'Nurse A',
      batchNumber: 'BCG-001',
      site: 'left arm',
      adverseReaction: false,
      status: 'completed',
    });

    const childImms = await getByPatient(patient._id);
    expect(childImms).toHaveLength(1);
    expect(childImms[0].patientId).toBe(patient._id);
    expect(childImms[0].vaccine).toBe('BCG');
  });

  test('DHIS2 export includes all indicator types', async () => {
    // Seed some data across modules
    await createPatient(makePatientData());

    const today = new Date().toISOString().slice(0, 10);
    await createBirth({
      childFirstName: 'Export',
      childSurname: 'Baby',
      childGender: 'Male',
      dateOfBirth: today,
      placeOfBirth: 'Test Hospital',
      facilityId: 'hosp-001',
      facilityName: 'Test Hospital',
      motherName: 'Mother',
      motherAge: 25,
      motherNationality: 'South Sudanese',
      fatherName: 'Father',
      fatherNationality: 'South Sudanese',
      birthWeight: 3000,
      birthType: 'single',
      deliveryType: 'normal',
      attendedBy: 'midwife',
      registeredBy: 'Nurse',
      state: 'Central Equatoria',
      county: 'Juba',
      certificateNumber: 'CERT-EXP-001',
    });

    await createDeath({
      deceasedFirstName: 'Export',
      deceasedSurname: 'Deceased',
      deceasedGender: 'Male',
      dateOfBirth: '1960-01-01',
      dateOfDeath: today,
      ageAtDeath: 65,
      placeOfDeath: 'Test Hospital',
      facilityId: 'hosp-001',
      facilityName: 'Test Hospital',
      immediateCause: 'Heart failure',
      immediateICD11: 'BD10',
      antecedentCause1: '',
      antecedentICD11_1: '',
      antecedentCause2: '',
      antecedentICD11_2: '',
      underlyingCause: '',
      underlyingICD11: '',
      contributingConditions: '',
      contributingICD11: '',
      mannerOfDeath: 'natural',
      maternalDeath: false,
      pregnancyRelated: false,
      certifiedBy: 'Dr. Test',
      certifierRole: 'doctor',
      state: 'Central Equatoria',
      county: 'Juba',
      certificateNumber: 'DEATH-EXP-001',
      deathNotified: true,
      deathRegistered: true,
    });

    await createLabResult({
      patientId: 'pat-export',
      patientName: 'Export Patient',
      hospitalNumber: 'EXP-001',
      testName: 'CBC',
      specimen: 'Blood',
      status: 'completed',
      result: 'Normal',
      unit: '',
      referenceRange: '',
      abnormal: false,
      critical: false,
      orderedBy: 'Dr. Test',
      orderedAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T12:00:00Z',
    });

    await createImmunization({
      patientId: 'child-export',
      patientName: 'Export Child',
      gender: 'Male',
      dateOfBirth: '2024-01-01',
      vaccine: 'BCG',
      doseNumber: 1,
      dateGiven: '2024-01-15',
      nextDueDate: '2024-03-15',
      facilityId: 'hosp-001',
      facilityName: 'Test Hospital',
      state: 'Central Equatoria',
      administeredBy: 'Nurse',
      batchNumber: 'BCG-EXP',
      site: 'left arm',
      adverseReaction: false,
      status: 'completed',
    });

    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const dataset = await generateDHIS2Export(period);

    // Verify all indicator categories are present
    const elements = dataset.dataValues.map(d => d.dataElement);

    // Patient / population
    expect(elements).toContain('TOTAL_PATIENTS');

    // CRVS
    expect(elements).toContain('BIRTHS_REGISTERED');
    expect(elements).toContain('DEATHS_REGISTERED');
    expect(elements).toContain('MATERNAL_DEATHS');
    expect(elements).toContain('NEONATAL_DEATHS');

    // Lab
    expect(elements).toContain('LAB_TESTS_TOTAL');
    expect(elements).toContain('LAB_TESTS_COMPLETED');

    // Immunization
    expect(elements).toContain('IMM_CHILDREN_TOTAL');
    expect(elements).toContain('IMM_BCG_COMPLETED');

    // Data quality
    expect(elements).toContain('REPORTING_COMPLETENESS');

    // Check actual values
    const totalPatients = dataset.dataValues.find(d => d.dataElement === 'TOTAL_PATIENTS');
    expect(totalPatients!.value).toBe('1');

    const birthsRegistered = dataset.dataValues.find(d => d.dataElement === 'BIRTHS_REGISTERED');
    expect(birthsRegistered!.value).toBe('1');

    const deathsRegistered = dataset.dataValues.find(d => d.dataElement === 'DEATHS_REGISTERED');
    expect(deathsRegistered!.value).toBe('1');

    const labTotal = dataset.dataValues.find(d => d.dataElement === 'LAB_TESTS_TOTAL');
    expect(labTotal!.value).toBe('1');

    const immBCG = dataset.dataValues.find(d => d.dataElement === 'IMM_BCG_COMPLETED');
    expect(immBCG!.value).toBe('1');
  });

  test('Multiple lab orders for one patient track independently', async () => {
    const patient = await createPatient(makePatientData());

    const malariaLab = await createLabResult({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      hospitalNumber: patient.hospitalNumber,
      testName: 'Malaria RDT',
      specimen: 'Blood',
      status: 'pending',
      result: '',
      unit: '',
      referenceRange: '',
      abnormal: false,
      critical: false,
      orderedBy: 'Dr. Mayen',
      orderedAt: '2025-03-01T08:00:00Z',
      completedAt: '',
    });

    const cbcLab = await createLabResult({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      hospitalNumber: patient.hospitalNumber,
      testName: 'CBC',
      specimen: 'Blood',
      status: 'pending',
      result: '',
      unit: '',
      referenceRange: '',
      abnormal: false,
      critical: false,
      orderedBy: 'Dr. Mayen',
      orderedAt: '2025-03-01T09:00:00Z',
      completedAt: '',
    });

    // Complete malaria, keep CBC pending
    await updateLabResult(malariaLab._id, {
      status: 'completed',
      result: 'Positive - P. falciparum',
      abnormal: true,
    });

    // Move CBC to in_progress
    await updateLabResult(cbcLab._id, { status: 'in_progress' });

    const patientLabs = await getLabResultsByPatient(patient._id);
    expect(patientLabs).toHaveLength(2);

    const malaria = patientLabs.find(l => l.testName === 'Malaria RDT');
    const cbc = patientLabs.find(l => l.testName === 'CBC');
    expect(malaria!.status).toBe('completed');
    expect(malaria!.abnormal).toBe(true);
    expect(cbc!.status).toBe('in_progress');

    const pending = await getPendingLabResults();
    expect(pending).toHaveLength(1); // only CBC in_progress
    expect(pending[0].testName).toBe('CBC');
  });
});
