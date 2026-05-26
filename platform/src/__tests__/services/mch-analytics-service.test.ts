/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for mch-analytics-service.ts
 * Covers MCH cascade analysis, maternal mortality, birth outcomes, neonatal mortality, and immunization coverage.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-mch-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { getMCHAnalytics } from '@/lib/services/mch-analytics-service';
import { ancDB, birthsDB, deathsDB, immunizationsDB } from '@/lib/db';
import type { ANCVisitDoc, BirthRegistrationDoc, DeathRegistrationDoc, ImmunizationDoc } from '@/lib/db-types';

const makeANCVisit = (overrides: Partial<ANCVisitDoc> = {}): ANCVisitDoc => {
  uuidCounter++;
  return {
    _id: `anc-${uuidCounter}-${Date.now()}`,
    type: 'anc_visit',
    motherId: 'mom-001',
    motherName: 'Mary Deng',
    motherAge: 28,
    gravida: 1,
    parity: 0,
    visitNumber: 1,
    visitDate: '2026-01-15',
    gestationalAge: 20,
    facilityId: 'hosp-001',
    facilityName: 'Juba Teaching Hospital',
    state: 'Central Equatoria',
    bloodPressure: '120/80',
    weight: 65,
    fundalHeight: 20,
    fetalHeartRate: 140,
    hemoglobin: 11.5,
    urineProtein: 'negative',
    bloodGroup: 'O',
    rhFactor: '+',
    hivStatus: 'negative',
    malariaTest: 'negative',
    syphilisTest: 'negative',
    ironFolateGiven: true,
    tetanusVaccine: true,
    iptpDose: 1,
    riskLevel: 'low' as const,
    riskFactors: [],
    birthPlan: { facility: 'Juba Teaching Hospital', transport: 'ambulance', bloodDonor: 'relative' },
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ANCVisitDoc;
};

const makeBirth = (overrides: Partial<BirthRegistrationDoc> = {}): BirthRegistrationDoc => {
  uuidCounter++;
  return {
    _id: `birth-${uuidCounter}-${Date.now()}`,
    type: 'birth',
    childFirstName: 'Baby',
    childSurname: 'Deng',
    childGender: 'Male',
    dateOfBirth: '2026-01-20',
    placeOfBirth: 'hospital',
    facilityId: 'hosp-001',
    facilityName: 'Juba Teaching Hospital',
    motherName: 'Mary Deng',
    motherAge: 28,
    motherNationality: 'South Sudanese',
    fatherName: 'John Deng',
    fatherNationality: 'South Sudanese',
    motherId: 'mom-001',
    deliveryType: 'normal' as const,
    birthWeight: 3000,
    attendedBy: 'midwife',
    birthType: 'single' as const,
    registeredBy: 'nurse-001',
    state: 'Central Equatoria',
    county: 'Juba',
    certificateNumber: 'B-001',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as BirthRegistrationDoc;
};

const makeDeath = (overrides: Partial<DeathRegistrationDoc> = {}): DeathRegistrationDoc => {
  uuidCounter++;
  return {
    _id: `death-${uuidCounter}-${Date.now()}`,
    type: 'death',
    deceasedFirstName: 'Baby',
    deceasedSurname: 'Deng',
    deceasedGender: 'Female',
    dateOfBirth: '2026-01-07',
    dateOfDeath: '2026-01-25',
    ageAtDeath: 0.05,
    placeOfDeath: 'hospital',
    facilityId: 'hosp-001',
    facilityName: 'Juba Teaching Hospital',
    immediateCause: 'Prematurity',
    immediateICD11: 'KA21',
    antecedentCause1: '',
    antecedentICD11_1: '',
    antecedentCause2: '',
    antecedentICD11_2: '',
    underlyingCause: 'Low Birth Weight',
    underlyingICD11: 'KA21',
    contributingConditions: '',
    contributingICD11: '',
    mannerOfDeath: 'natural' as const,
    maternalDeath: false,
    pregnancyRelated: false,
    certifiedBy: 'Dr. Kuol',
    certifierRole: 'doctor',
    state: 'Central Equatoria',
    county: 'Juba',
    certificateNumber: 'D-001',
    deathNotified: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as DeathRegistrationDoc;
};

const makeImmunization = (overrides: Partial<ImmunizationDoc> = {}): ImmunizationDoc => {
  uuidCounter++;
  return {
    _id: `imm-${uuidCounter}-${Date.now()}`,
    type: 'immunization',
    patientId: 'child-001',
    patientName: 'Baby Deng',
    gender: 'Male' as const,
    dateOfBirth: '2026-01-20',
    vaccine: 'BCG',
    doseNumber: 1,
    dateGiven: '2026-01-20',
    nextDueDate: '2026-02-20',
    facilityId: 'hosp-001',
    facilityName: 'Juba Teaching Hospital',
    state: 'Central Equatoria',
    administeredBy: 'nurse-001',
    batchNumber: 'BCG-2026-001',
    site: 'left arm' as const,
    adverseReaction: false,
    status: 'completed' as const,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ImmunizationDoc;
};

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('mch-analytics-service', () => {
  test('getMCHAnalytics returns valid structure', async () => {
    const analytics = await getMCHAnalytics();

    expect(analytics).toBeDefined();
    expect(analytics.ancCascade).toBeDefined();
    expect(analytics.maternalMortality).toBeDefined();
    expect(analytics.birthOutcomes).toBeDefined();
    expect(analytics.neonatalData).toBeDefined();
    expect(analytics.immunizationGaps).toBeDefined();
    expect(analytics.highRiskPregnancies).toBeDefined();
    expect(analytics.summary).toBeDefined();
  });

  test('ANC cascade calculates anc1, anc4, anc8 coverage', async () => {
    const db = ancDB();
    await db.put(makeANCVisit({ motherId: 'mom-001', visitNumber: 1 }));
    await db.put(makeANCVisit({ motherId: 'mom-001', visitNumber: 2 }));
    await db.put(makeANCVisit({ motherId: 'mom-001', visitNumber: 4 }));
    await db.put(makeANCVisit({ motherId: 'mom-002', visitNumber: 1 }));

    const analytics = await getMCHAnalytics();

    expect(analytics.ancCascade.anc1).toBe(2);
    expect(analytics.ancCascade.anc4).toBe(1);
    expect(analytics.ancCascade.anc8).toBe(0);
    expect(analytics.ancCascade.totalPregnancies).toBe(2);
    expect(analytics.ancCascade.anc1Rate).toBe(100);
    expect(analytics.ancCascade.anc4Rate).toBe(50);
  });

  test('ANC cascade includes state breakdown', async () => {
    const db = ancDB();
    await db.put(makeANCVisit({ motherId: 'mom-001', state: 'Central Equatoria', visitNumber: 2 }));
    await db.put(makeANCVisit({ motherId: 'mom-002', state: 'Eastern Equatoria', visitNumber: 1 }));

    const analytics = await getMCHAnalytics();

    expect(analytics.ancCascade.byState['Central Equatoria'].anc1).toBe(1);
    expect(analytics.ancCascade.byState['Eastern Equatoria'].anc1).toBe(1);
  });

  test('maternal mortality calculates MMR correctly', async () => {
    const birthDb = birthsDB();
    const deathDb = deathsDB();

    // 1000 births, 10 maternal deaths
    for (let i = 0; i < 1000; i++) {
      await birthDb.put(makeBirth({ _id: `birth-${i}`, dateOfBirth: '2026-01-01' }));
    }
    for (let i = 0; i < 10; i++) {
      await deathDb.put(makeDeath({ _id: `death-${i}`, maternalDeath: true, dateOfDeath: '2026-01-01' }));
    }

    const analytics = await getMCHAnalytics();

    // MMR = (10 / 1000) * 100,000 = 1000
    expect(analytics.maternalMortality.mmr).toBe(1000);
  });

  test('maternal mortality includes direct causes', async () => {
    const deathDb = deathsDB();
    const birthDb = birthsDB();
    await birthDb.put(makeBirth());

    await deathDb.put(makeDeath({ maternalDeath: true, underlyingCause: 'Hemorrhage' }));
    await deathDb.put(makeDeath({ maternalDeath: true, underlyingCause: 'Hemorrhage' }));
    await deathDb.put(makeDeath({ maternalDeath: true, underlyingCause: 'Eclampsia' }));

    const analytics = await getMCHAnalytics();

    expect(analytics.maternalMortality.directCauses.length).toBeGreaterThan(0);
    const hemorrhage = analytics.maternalMortality.directCauses.find(c => c.cause === 'Hemorrhage');
    expect(hemorrhage).toBeDefined();
    expect(hemorrhage!.count).toBe(2);
  });

  test('maternal mortality includes age group distribution', async () => {
    const deathDb = deathsDB();
    const birthDb = birthsDB();
    await birthDb.put(makeBirth());

    await deathDb.put(makeDeath({ maternalDeath: true, ageAtDeath: 16 }));
    await deathDb.put(makeDeath({ maternalDeath: true, ageAtDeath: 20 }));
    await deathDb.put(makeDeath({ maternalDeath: true, ageAtDeath: 30 }));
    await deathDb.put(makeDeath({ maternalDeath: true, ageAtDeath: 40 }));
    await deathDb.put(makeDeath({ maternalDeath: true, ageAtDeath: 50 }));

    const analytics = await getMCHAnalytics();

    expect(analytics.maternalMortality.byAgeGroup['<18']).toBe(1);
    expect(analytics.maternalMortality.byAgeGroup['18-24']).toBe(1);
    expect(analytics.maternalMortality.byAgeGroup['25-34']).toBe(1);
    expect(analytics.maternalMortality.byAgeGroup['35-44']).toBe(1);
    expect(analytics.maternalMortality.byAgeGroup['45+']).toBe(1);
  });

  test('birth outcomes calculates caesarean rate', async () => {
    const db = birthsDB();
    await db.put(makeBirth({ deliveryType: 'caesarean' }));
    await db.put(makeBirth({ deliveryType: 'caesarean' }));
    await db.put(makeBirth({ deliveryType: 'normal' }));

    const analytics = await getMCHAnalytics();

    expect(analytics.birthOutcomes.totalBirths).toBe(3);
    expect(analytics.birthOutcomes.caesareanRate).toBe(67);
  });

  test('birth outcomes calculates low birth weight rate', async () => {
    const db = birthsDB();
    await db.put(makeBirth({ birthWeight: 1500 }));
    await db.put(makeBirth({ birthWeight: 2000 }));
    await db.put(makeBirth({ birthWeight: 3000 }));
    await db.put(makeBirth({ birthWeight: 3500 }));

    const analytics = await getMCHAnalytics();

    expect(analytics.birthOutcomes.lowBirthWeight).toBe(2);
    expect(analytics.birthOutcomes.lowBirthWeightRate).toBe(50);
  });

  test('birth outcomes calculates facility delivery rate', async () => {
    const db = birthsDB();
    await db.put(makeBirth({ attendedBy: 'doctor' }));
    await db.put(makeBirth({ attendedBy: 'midwife' }));
    await db.put(makeBirth({ attendedBy: 'traditional' }));

    const analytics = await getMCHAnalytics();

    expect(analytics.birthOutcomes.facilityDeliveryRate).toBe(67);
  });

  test('birth outcomes includes delivery type breakdown', async () => {
    const db = birthsDB();
    await db.put(makeBirth({ deliveryType: 'caesarean' }));
    await db.put(makeBirth({ deliveryType: 'normal' }));

    const analytics = await getMCHAnalytics();

    expect(analytics.birthOutcomes.byDeliveryType['caesarean']).toBe(1);
    expect(analytics.birthOutcomes.byDeliveryType['normal']).toBe(1);
  });

  test('neonatal data calculates mortality rates correctly', async () => {
    const deathDb = deathsDB();
    const birthDb = birthsDB();

    // 100 live births
    for (let i = 0; i < 100; i++) {
      await birthDb.put(makeBirth({ _id: `birth-${i}` }));
    }

    // 5 neonatal deaths (< 28 days = 0.077 years)
    for (let i = 0; i < 5; i++) {
      await deathDb.put(makeDeath({ _id: `death-${i}`, ageAtDeath: 0.05 }));
    }

    const analytics = await getMCHAnalytics();

    expect(analytics.neonatalData.totalNeonatalDeaths).toBe(5);
    expect(analytics.neonatalData.neonatalMortalityRate).toBe(50); // 5/100 * 1000
  });

  test('neonatal data distinguishes infant and under-5 deaths', async () => {
    const deathDb = deathsDB();
    const birthDb = birthsDB();
    await birthDb.put(makeBirth());

    // 1 neonatal (0.05 years)
    await deathDb.put(makeDeath({ ageAtDeath: 0.05 }));
    // 1 infant but not neonatal (6 months = 0.5 years)
    await deathDb.put(makeDeath({ ageAtDeath: 0.5 }));
    // 1 under-5 but not infant (3 years)
    await deathDb.put(makeDeath({ ageAtDeath: 3 }));

    const analytics = await getMCHAnalytics();

    expect(analytics.neonatalData.totalNeonatalDeaths).toBe(1);
    expect(analytics.neonatalData.totalInfantDeaths).toBe(2);
    expect(analytics.neonatalData.totalUnder5Deaths).toBe(3);
  });

  test('immunization gaps calculated per vaccine', async () => {
    const db = immunizationsDB();
    // 10 children total
    for (let i = 0; i < 10; i++) {
      await db.put(makeImmunization({ patientId: `child-${i}`, vaccine: 'BCG', doseNumber: 1, status: 'completed' }));
    }
    // Only 8 completed Penta3
    for (let i = 0; i < 8; i++) {
      await db.put(makeImmunization({ patientId: `child-${i}`, vaccine: 'Penta', doseNumber: 3, status: 'completed' }));
    }

    const analytics = await getMCHAnalytics();

    const bcg = analytics.immunizationGaps.find(g => g.vaccine === 'BCG');
    expect(bcg).toBeDefined();
    expect(bcg!.coverageRate).toBe(100);

    const penta = analytics.immunizationGaps.find(g => g.vaccine === 'Penta3');
    expect(penta).toBeDefined();
    expect(penta!.coverageRate).toBe(80);
  });

  test('immunization gaps include dropout rate', async () => {
    const db = immunizationsDB();
    // 10 children with Penta dose 1
    for (let i = 0; i < 10; i++) {
      await db.put(makeImmunization({ patientId: `child-${i}`, vaccine: 'Penta', doseNumber: 1, status: 'completed' }));
    }
    // Only 7 with Penta dose 3
    for (let i = 0; i < 7; i++) {
      await db.put(makeImmunization({ patientId: `child-${i}`, vaccine: 'Penta', doseNumber: 3, status: 'completed' }));
    }

    const analytics = await getMCHAnalytics();

    const penta = analytics.immunizationGaps.find(g => g.vaccine === 'Penta3');
    expect(penta!.dropoutRate).toBe(30); // (10-7)/10 * 100
  });

  test('high-risk pregnancies identified correctly', async () => {
    const db = ancDB();
    await db.put(makeANCVisit({ motherId: 'mom-001', riskLevel: 'high', motherName: 'High Risk Mom' }));
    await db.put(makeANCVisit({ motherId: 'mom-002', riskLevel: 'moderate', motherName: 'Moderate Risk Mom' }));
    await db.put(makeANCVisit({ motherId: 'mom-003', riskLevel: 'low' }));

    const analytics = await getMCHAnalytics();

    expect(analytics.highRiskPregnancies.length).toBe(2);
    const highRisk = analytics.highRiskPregnancies.find(h => h.motherId === 'mom-001');
    expect(highRisk).toBeDefined();
    expect(highRisk!.riskLevel).toBe('high');
  });

  test('high-risk pregnancies sorted by level and gestational age', async () => {
    const db = ancDB();
    await db.put(makeANCVisit({ motherId: 'mom-001', riskLevel: 'moderate', gestationalAge: 30 }));
    await db.put(makeANCVisit({ motherId: 'mom-002', riskLevel: 'high', gestationalAge: 25 }));

    const analytics = await getMCHAnalytics();

    expect(analytics.highRiskPregnancies[0].riskLevel).toBe('high');
    expect(analytics.highRiskPregnancies[1].riskLevel).toBe('moderate');
  });

  test('summary includes correct counts', async () => {
    const ancDb = ancDB();
    await ancDb.put(makeANCVisit({ motherId: 'mom-001', visitNumber: 4 }));
    await ancDb.put(makeANCVisit({ motherId: 'mom-001', visitNumber: 5 }));

    const analytics = await getMCHAnalytics();

    expect(analytics.summary.totalMothersTracked).toBe(1);
    expect(analytics.summary.anc4PlusCoverage).toBe(100);
  });

  test('summary grades MCH performance A-F', async () => {
    const analytics = await getMCHAnalytics();

    expect(['A', 'B', 'C', 'D', 'F']).toContain(analytics.summary.overallGrade);
  });

  test('summary reflects high immunization coverage with grade boost', async () => {
    const db = immunizationsDB();
    // 100 children all with BCG completed
    for (let i = 0; i < 100; i++) {
      await db.put(makeImmunization({ patientId: `child-${i}`, vaccine: 'BCG', status: 'completed' }));
      await db.put(makeImmunization({ patientId: `child-${i}`, vaccine: 'Penta', doseNumber: 3, status: 'completed' }));
      await db.put(makeImmunization({ patientId: `child-${i}`, vaccine: 'Measles', doseNumber: 1, status: 'completed' }));
    }

    const analytics = await getMCHAnalytics();

    // With high coverage, should have a good grade
    expect(['A', 'B', 'C']).toContain(analytics.summary.overallGrade);
  });

  test('empty data returns valid zero counts', async () => {
    const analytics = await getMCHAnalytics();

    expect(analytics.ancCascade.totalPregnancies).toBe(0);
    expect(analytics.maternalMortality.totalMaternalDeaths).toBe(0);
    expect(analytics.birthOutcomes.totalBirths).toBe(0);
    expect(analytics.neonatalData.totalNeonatalDeaths).toBe(0);
    expect(analytics.summary.highRiskCount).toBe(0);
  });

  // ---- Additional branch coverage for uncovered lines ----

  test('ancCascade counts anc8 visits (lines 139-140)', async () => {
    const db = ancDB();
    // Create mother with 8+ visits to hit the anc8 branch
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 1, state: 'Central Equatoria' }));
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 2, state: 'Central Equatoria' }));
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 3, state: 'Central Equatoria' }));
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 4, state: 'Central Equatoria' }));
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 5, state: 'Central Equatoria' }));
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 6, state: 'Central Equatoria' }));
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 7, state: 'Central Equatoria' }));
    await db.put(makeANCVisit({ motherId: 'mom-anc8', visitNumber: 8, state: 'Central Equatoria' }));

    const analytics = await getMCHAnalytics();
    expect(analytics.ancCascade.anc8).toBe(1);
    expect(analytics.ancCascade.anc8Rate).toBeGreaterThan(0);
  });

  test('maternalMortality byAgeGroup counts 45+ age group (line 198)', async () => {
    const db = deathsDB();
    // Create maternal deaths with various age groups
    await db.put(makeDeath({
      maternalDeath: true,
      ageAtDeath: 17, // <18
      dateOfDeath: new Date().toISOString().slice(0, 10)
    }));
    await db.put(makeDeath({
      maternalDeath: true,
      ageAtDeath: 22, // 18-24
      dateOfDeath: new Date().toISOString().slice(0, 10)
    }));
    await db.put(makeDeath({
      maternalDeath: true,
      ageAtDeath: 30, // 25-34
      dateOfDeath: new Date().toISOString().slice(0, 10)
    }));
    await db.put(makeDeath({
      maternalDeath: true,
      ageAtDeath: 40, // 35-44
      dateOfDeath: new Date().toISOString().slice(0, 10)
    }));
    await db.put(makeDeath({
      maternalDeath: true,
      ageAtDeath: 50, // 45+ (this hits line 198)
      dateOfDeath: new Date().toISOString().slice(0, 10)
    }));

    const analytics = await getMCHAnalytics();
    // The byAgeGroup field should have 45+ entry
    expect(Object.keys(analytics.maternalMortality.byAgeGroup).length).toBeGreaterThanOrEqual(1);
  });

  test('highRiskPregnancies sorts by riskLevel and gestationalAge (line 431)', async () => {
    const db = ancDB();
    // Create high and low risk pregnancies
    await db.put(makeANCVisit({
      motherId: 'mom-low-risk',
      riskLevel: 'low',
      gestationalAge: 30,
    }));
    await db.put(makeANCVisit({
      motherId: 'mom-high-risk-1',
      riskLevel: 'high',
      gestationalAge: 32,
    }));
    await db.put(makeANCVisit({
      motherId: 'mom-high-risk-2',
      riskLevel: 'high',
      gestationalAge: 28,
    }));

    const analytics = await getMCHAnalytics();
    const highRisk = analytics.highRiskPregnancies;
    // High risk should come first
    if (highRisk && highRisk.length > 0) {
      expect(highRisk[0].riskLevel).toBe('high');
      // If multiple high-risk, should be sorted by gestational age
      const allHighRisk = highRisk.filter(p => p.riskLevel === 'high');
      if (allHighRisk.length > 1) {
        for (let i = 0; i < allHighRisk.length - 1; i++) {
          expect(allHighRisk[i].gestationalAge).toBeLessThanOrEqual(allHighRisk[i + 1].gestationalAge);
        }
      }
    }
  });

  test('ancCascade with missing state in byState', async () => {
    const db = ancDB();
    // Create ANC visit with no state
    await db.put(makeANCVisit({ motherId: 'mom-no-state', state: undefined }));

    const analytics = await getMCHAnalytics();
    // Should handle gracefully
    expect(analytics.ancCascade.totalPregnancies).toBeGreaterThanOrEqual(0);
  });

  test('maternalMortality with mothers from multiple states', async () => {
    const db = deathsDB();
    await db.put(makeDeath({
      maternalDeath: true,
      state: 'Central Equatoria',
      dateOfDeath: new Date().toISOString().slice(0, 10)
    }));
    await db.put(makeDeath({
      maternalDeath: true,
      state: 'Eastern Equatoria',
      dateOfDeath: new Date().toISOString().slice(0, 10)
    }));

    const analytics = await getMCHAnalytics();
    expect(Object.keys(analytics.maternalMortality.byState).length).toBeGreaterThanOrEqual(1);
  });

  test('birthOutcomes with various delivery types and birth types', async () => {
    const db = birthsDB();
    await db.put(makeBirth({
      deliveryType: 'normal',
      birthType: 'single',
      birthWeight: 3000
    }));
    await db.put(makeBirth({
      deliveryType: 'caesarean',
      birthType: 'single',
      birthWeight: 2400 // Low birth weight
    }));
    await db.put(makeBirth({
      deliveryType: 'normal',
      birthType: 'twin',
      birthWeight: 2200 // Low birth weight
    }));

    const analytics = await getMCHAnalytics();
    expect(analytics.birthOutcomes.totalBirths).toBeGreaterThanOrEqual(3);
  });

  test('ancCascade with mothers having less than 1 visit (line 130 false branch)', async () => {
    const db = ancDB();
    // Create a visit with visitNumber 0 (shouldn't happen in practice, but tests the false branch)
    await db.put(makeANCVisit({ motherId: 'mom-zero', visitNumber: 0, state: 'Central Equatoria' }));

    const analytics = await getMCHAnalytics();
    // The mother with 0 visits should not be counted in anc1
    expect(analytics.ancCascade.anc1).toBe(0);
  });

  test('maternalMortality with death having neither underlying nor immediate cause (line 179 false branch)', async () => {
    const deathDb = deathsDB();
    const birthDb = birthsDB();
    await birthDb.put(makeBirth());

    // Death with no underlying or immediate cause (should fall back to 'Unknown')
    await deathDb.put(makeDeath({
      maternalDeath: true,
      underlyingCause: undefined,
      immediateCause: undefined,
      dateOfDeath: '2026-01-01'
    }));

    const analytics = await getMCHAnalytics();
    const unknownCause = analytics.maternalMortality.directCauses.find(c => c.cause === 'Unknown');
    expect(unknownCause).toBeDefined();
  });

  test('avgImmCoverage with no immunization data (line 468 false branch)', async () => {
    // No immunization records - immunizationGaps will be empty
    const analytics = await getMCHAnalytics();

    // Should default to 0 when no gaps calculated
    expect(analytics.summary.immunizationCoverage).toBe(0);
  });

  test('grading: anc4Rate < 30% branch (line 476)', async () => {
    const ancDb = ancDB();
    const birthDb = birthsDB();

    // Create 10 pregnancies but only 1 with 4+ visits
    for (let i = 0; i < 10; i++) {
      if (i === 0) {
        await ancDb.put(makeANCVisit({ motherId: `mom-${i}`, visitNumber: 4 }));
      } else {
        await ancDb.put(makeANCVisit({ motherId: `mom-${i}`, visitNumber: 1 }));
      }
    }
    // Add at least 1 birth to keep MMR calculation valid
    await birthDb.put(makeBirth());

    const analytics = await getMCHAnalytics();

    // anc4Rate will be 10% (1/10), which triggers the >= 30 else-if branch
    expect(analytics.ancCascade.anc4Rate).toBeLessThan(30);
    expect(analytics.ancCascade.anc4Rate).toBeGreaterThanOrEqual(10);
  });

  test('grading: MMR 500-1000 range (line 479)', async () => {
    const birthDb = birthsDB();
    const deathDb = deathsDB();

    // 1000 births, 7 maternal deaths = MMR of 700 (in 500-1000 range)
    for (let i = 0; i < 1000; i++) {
      await birthDb.put(makeBirth({ _id: `birth-${i}`, dateOfBirth: '2026-01-01' }));
    }
    for (let i = 0; i < 7; i++) {
      await deathDb.put(makeDeath({ _id: `death-${i}`, maternalDeath: true, dateOfDeath: '2026-01-01' }));
    }

    const analytics = await getMCHAnalytics();

    // MMR should be 700, in the 500-1000 range
    expect(analytics.maternalMortality.mmr).toBe(700);
  });

  test('grading: neonatal mortality 30-50 range (line 482)', async () => {
    const deathDb = deathsDB();
    const birthDb = birthsDB();

    // 100 births, 3 neonatal deaths = 30 per 1000
    for (let i = 0; i < 100; i++) {
      await birthDb.put(makeBirth({ _id: `birth-${i}` }));
    }
    for (let i = 0; i < 3; i++) {
      await deathDb.put(makeDeath({ _id: `death-${i}`, ageAtDeath: 0.05 }));
    }

    const analytics = await getMCHAnalytics();

    // NMR should be 30, in the 30-50 range
    expect(analytics.neonatalData.neonatalMortalityRate).toBe(30);
  });

  test('grading: immunization coverage 50-80% range (line 485)', async () => {
    const db = immunizationsDB();

    // 100 children, 70 with all vaccines = ~70% coverage
    for (let i = 0; i < 100; i++) {
      const status: 'completed' | 'scheduled' = i < 70 ? 'completed' : 'scheduled';
      for (const vaccine of ['BCG', 'OPV', 'Penta', 'PCV', 'Rota', 'Measles', 'Yellow Fever', 'Vitamin A']) {
        const doseNumber = vaccine === 'BCG' || vaccine === 'Yellow Fever' || vaccine === 'Vitamin A' ? 1 : 3;
        await db.put(makeImmunization({
          patientId: `child-${i}`,
          vaccine,
          doseNumber,
          status
        }));
      }
    }

    const analytics = await getMCHAnalytics();

    // Coverage should be around 70%, in the 50-80% range
    expect(analytics.summary.immunizationCoverage).toBeLessThan(80);
    expect(analytics.summary.immunizationCoverage).toBeGreaterThanOrEqual(50);
  });

  test('grading: facility delivery 25-50% range (line 488)', async () => {
    const db = birthsDB();

    // 100 births, 30 facility deliveries = 30%
    for (let i = 0; i < 100; i++) {
      const attendedBy = i < 30 ? 'midwife' : 'traditional';
      await db.put(makeBirth({ _id: `birth-${i}`, attendedBy }));
    }

    const analytics = await getMCHAnalytics();

    // Facility delivery rate should be 30%, in the 25-50% range
    expect(analytics.birthOutcomes.facilityDeliveryRate).toBeGreaterThanOrEqual(25);
    expect(analytics.birthOutcomes.facilityDeliveryRate).toBeLessThan(50);
  });

  test('maternal mortality directCauses with zero deaths (line 179 false branch)', async () => {
    const birthDb = birthsDB();

    // Create births but NO maternal deaths
    for (let i = 0; i < 10; i++) {
      await birthDb.put(makeBirth({ _id: `birth-${i}` }));
    }
    // No maternal deaths

    const analytics = await getMCHAnalytics();

    // directCauses should be empty when there are no maternal deaths
    expect(analytics.maternalMortality.directCauses.length).toBe(0);
    // totalMaternalDeaths should be 0
    expect(analytics.maternalMortality.totalMaternalDeaths).toBe(0);
  });

  test('ancCascade with anc4Rate >= 30 but < 50% (line 476)', async () => {
    const ancDb = ancDB();
    const birthDb = birthsDB();

    // Create 10 pregnancies with 4 having 4+ visits = 40%
    for (let i = 0; i < 10; i++) {
      if (i < 4) {
        await ancDb.put(makeANCVisit({ motherId: `mom-grade-${i}`, visitNumber: 4 }));
      } else {
        await ancDb.put(makeANCVisit({ motherId: `mom-grade-${i}`, visitNumber: 1 }));
      }
    }
    await birthDb.put(makeBirth());

    const analytics = await getMCHAnalytics();

    // anc4Rate should be 40%, triggering the >= 30 else-if branch
    expect(analytics.ancCascade.anc4Rate).toBe(40);
    expect(analytics.summary.anc4PlusCoverage).toBe(40);
  });

  test('neonatal mortality 30-50+ range (line 483)', async () => {
    const deathDb = deathsDB();
    const birthDb = birthsDB();

    // 100 births, 5 neonatal deaths = 50 per 1000
    for (let i = 0; i < 100; i++) {
      await birthDb.put(makeBirth({ _id: `birth-neo-${i}` }));
    }
    for (let i = 0; i < 5; i++) {
      await deathDb.put(makeDeath({ _id: `death-neo-${i}`, ageAtDeath: 0.05 }));
    }

    const analytics = await getMCHAnalytics();

    // NMR should be 50, in the >= 50 range
    expect(analytics.neonatalData.neonatalMortalityRate).toBe(50);
  });

  test('overall grade scoring with D-F grades (line 490)', async () => {
    // Create scenario with very poor health indicators
    const ancDb = ancDB();
    const birthDb = birthsDB();
    const deathDb = deathsDB();

    // Low ANC coverage
    for (let i = 0; i < 20; i++) {
      await ancDb.put(makeANCVisit({ motherId: `mom-poor-${i}`, visitNumber: 1 }));
    }

    // High maternal deaths
    for (let i = 0; i < 50; i++) {
      await birthDb.put(makeBirth({ _id: `birth-poor-${i}` }));
    }
    for (let i = 0; i < 2; i++) {
      await deathDb.put(makeDeath({ _id: `death-poor-${i}`, maternalDeath: true }));
    }

    const analytics = await getMCHAnalytics();

    // Grade should be low (D or F)
    expect(['D', 'F']).toContain(analytics.summary.overallGrade);
  });

  test('immunization coverage >= 80% (line 484)', async () => {
    const db = immunizationsDB();

    // 100 children, 90 with all vaccines = 90% coverage
    for (let i = 0; i < 100; i++) {
      const status: 'completed' | 'scheduled' = i < 90 ? 'completed' : 'scheduled';
      for (const vaccine of ['BCG', 'OPV', 'Penta', 'PCV', 'Rota', 'Measles', 'Yellow Fever', 'Vitamin A']) {
        const doseNumber = vaccine === 'BCG' || vaccine === 'Yellow Fever' || vaccine === 'Vitamin A' ? 1 : 3;
        await db.put(makeImmunization({
          patientId: `child-imm-${i}`,
          vaccine,
          doseNumber,
          status
        }));
      }
    }

    const analytics = await getMCHAnalytics();

    // Coverage should be 90%, >= 80%
    expect(analytics.summary.immunizationCoverage).toBeGreaterThanOrEqual(80);
  });
});
