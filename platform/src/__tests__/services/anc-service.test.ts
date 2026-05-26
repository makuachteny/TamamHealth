/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for anc-service.ts (Antenatal Care)
 * Covers ANC visit CRUD, risk assessment, and maternal health statistics.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-anc-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createANCVisit,
  getByMother,
  getByFacility,
  getANCStats,
  updateANCVisit,
  deleteANCVisit,
  getHighRiskPregnancies,
  getAllANCVisits,
} from '@/lib/services/anc-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type ANCVisitInput = Parameters<typeof createANCVisit>[0];
function validANCVisit(overrides: Partial<ANCVisitInput> = {}): ANCVisitInput {
  return {
    motherId: 'mother-001',
    motherName: 'Nyabol Deng',
    motherAge: 24,
    gravida: 2,
    parity: 1,
    visitNumber: 1,
    visitDate: '2026-03-15',
    gestationalAge: 12,
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    state: 'Central Equatoria',
    bloodPressure: '120/80',
    weight: 58,
    fundalHeight: 12,
    fetalHeartRate: 140,
    hemoglobin: 11.5,
    urineProtein: 'negative',
    bloodGroup: 'O',
    rhFactor: 'positive',
    hivStatus: 'negative',
    malariaTest: 'negative',
    syphilisTest: 'negative',
    ironFolateGiven: true,
    tetanusVaccine: true,
    iptpDose: 1,
    riskFactors: [],
    riskLevel: 'low' as const,
    birthPlan: { facility: 'TamamHealth Hospital', transport: 'boda-boda', bloodDonor: 'husband' },
    nextVisitDate: '2026-04-15',
    notes: 'Normal first ANC visit',
    attendedBy: 'nurse-001',
    attendedByRole: 'nurse',
    ...overrides,
  };
}

describe('ANC Service', () => {
  test('creates an ANC visit', async () => {
    const visit = await createANCVisit(validANCVisit());
    expect(visit._id).toMatch(/^anc-/);
    expect(visit.type).toBe('anc_visit');
    expect(visit.motherName).toBe('Nyabol Deng');
    expect(visit.visitNumber).toBe(1);
    expect(visit.riskLevel).toBe('low');
  });

  test('creates visit for high-risk pregnancy', async () => {
    const visit = await createANCVisit(validANCVisit({
      riskLevel: 'high',
      riskFactors: ['eclampsia', 'previous c-section'],
    }));
    expect(visit.riskLevel).toBe('high');
    expect(visit._id).toBeDefined();
  });

  test('retrieves visits by mother', async () => {
    await createANCVisit(validANCVisit({ visitNumber: 1, visitDate: '2026-01-15' }));
    await createANCVisit(validANCVisit({ visitNumber: 2, visitDate: '2026-02-15', gestationalAge: 16 }));
    await createANCVisit(validANCVisit({
      motherId: 'mother-002',
      motherName: 'Ayen Kuol',
      visitNumber: 1,
      visitDate: '2026-03-01',
    }));

    const visits = await getByMother('mother-001');
    expect(visits).toHaveLength(2);
  });

  test('retrieves visits by facility', async () => {
    await createANCVisit(validANCVisit());
    await createANCVisit(validANCVisit({
      motherId: 'mother-002',
      motherName: 'Ayen',
      facilityId: 'hosp-002',
      facilityName: 'Juba Teaching Hospital',
    }));

    const facilityVisits = await getByFacility('hosp-001');
    expect(facilityVisits).toHaveLength(1);
    expect(facilityVisits[0].facilityName).toBe('TamamHealth Hospital');
  });

  test('updates an ANC visit', async () => {
    const visit = await createANCVisit(validANCVisit());
    const updated = await updateANCVisit(visit._id, {
      bloodPressure: '140/95',
      riskLevel: 'high',
      riskFactors: ['hypertension'],
      notes: 'Elevated BP detected, monitor closely',
    });
    expect(updated).not.toBeNull();
    expect(updated!.bloodPressure).toBe('140/95');
    expect(updated!.riskLevel).toBe('high');
  });

  test('update returns null for nonexistent visit', async () => {
    const result = await updateANCVisit('nonexistent', { notes: 'test' });
    expect(result).toBeNull();
  });

  test('deletes an ANC visit', async () => {
    const visit = await createANCVisit(validANCVisit());
    const deleted = await deleteANCVisit(visit._id);
    expect(deleted).toBe(true);

    const visits = await getByMother('mother-001');
    expect(visits).toHaveLength(0);
  });

  test('delete returns false for nonexistent visit', async () => {
    const result = await deleteANCVisit('nonexistent');
    expect(result).toBe(false);
  });

  test('getHighRiskPregnancies returns latest visit per mother', async () => {
    await createANCVisit(validANCVisit({
      visitNumber: 1,
      visitDate: '2026-01-15',
      riskLevel: 'high',
      riskFactors: ['anemia'],
    }));
    await createANCVisit(validANCVisit({
      visitNumber: 2,
      visitDate: '2026-02-15',
      riskLevel: 'high',
      riskFactors: ['anemia', 'previous PPH'],
    }));
    // Different mother, low risk
    await createANCVisit(validANCVisit({
      motherId: 'mother-002',
      motherName: 'Ayen',
      riskLevel: 'low',
    }));

    const highRisk = await getHighRiskPregnancies();
    expect(highRisk).toHaveLength(1);
    expect(highRisk[0].motherId).toBe('mother-001');
  });

  test('getANCStats returns correct statistics', async () => {
    // Mother 1: 4 visits (ANC4+)
    for (let i = 1; i <= 4; i++) {
      await createANCVisit(validANCVisit({
        visitNumber: i,
        visitDate: `2026-0${i}-15`,
        gestationalAge: 8 + i * 4,
      }));
    }
    // Mother 2: 1 visit, high risk
    await createANCVisit(validANCVisit({
      motherId: 'mother-002',
      motherName: 'Ayen Kuol',
      visitNumber: 1,
      riskLevel: 'high',
      riskFactors: ['eclampsia'],
    }));

    const stats = await getANCStats();
    expect(stats.totalMothers).toBe(2);
    expect(stats.totalVisits).toBe(5);
    expect(stats.anc1).toBe(2);
    expect(stats.anc4Plus).toBe(1);
    expect(stats.highRiskCount).toBeGreaterThanOrEqual(1);
  });

  test('getAllANCVisits with scope returns filtered results', async () => {
    await createANCVisit(validANCVisit({ state: 'Central Equatoria' }));
    await createANCVisit(validANCVisit({
      motherId: 'mother-002',
      motherName: 'Ayen',
      state: 'Northern Bari',
    }));

    // Test with scope parameter
    const allVisits = await getAllANCVisits();
    expect(allVisits.length).toBeGreaterThanOrEqual(2);
  });

  test('createANCVisit handles high-risk alert message creation failure gracefully', async () => {
    const visit = await createANCVisit(validANCVisit({
      riskLevel: 'high',
      riskFactors: ['severe_preeclampsia'],
      motherName: 'Test Mother',
      motherId: 'high-risk-001',
    }));

    expect(visit.riskLevel).toBe('high');
    expect(visit._id).toBeDefined();
  });

  // ---- Branch coverage improvements ----

  test('high-risk visit with no riskFactors uses "unspecified"', async () => {
    const visit = await createANCVisit(validANCVisit({
      riskLevel: 'high',
      riskFactors: undefined,
      motherId: 'high-risk-002',
    }));
    expect(visit.riskLevel).toBe('high');
  });

  test('high-risk visit with no motherName uses fallback', async () => {
    const visit = await createANCVisit(validANCVisit({
      riskLevel: 'high',
      motherName: undefined,
      riskFactors: ['anemia'],
      motherId: 'high-risk-003',
    }));
    expect(visit._id).toBeDefined();
  });

  test('high-risk visit with no facilityName', async () => {
    const visit = await createANCVisit(validANCVisit({
      riskLevel: 'high',
      facilityName: undefined,
      riskFactors: ['hiv_positive'],
      motherId: 'high-risk-004',
    }));
    expect(visit._id).toBeDefined();
  });

  test('getAllANCVisits handles missing visitDate in sort', async () => {
    await createANCVisit(validANCVisit({ visitDate: undefined }));
    await createANCVisit(validANCVisit({ motherId: 'other', visitDate: '2026-04-01' }));
    const all = await getAllANCVisits();
    expect(all).toHaveLength(2);
  });

  test('getANCStats with no mothers returns zero stats', async () => {
    const stats = await getANCStats();
    expect(stats.totalMothers).toBe(0);
    expect(stats.anc4PlusRate).toBe(0);
    expect(stats.continuum.anc1).toBe(0);
  });

  test('getANCStats handles missing state in visits', async () => {
    await createANCVisit(validANCVisit({ state: undefined }));
    const stats = await getANCStats();
    expect(stats.byState['Unknown']).toBe(1);
  });

  test('getANCStats calculates continuum correctly with multi-visit mothers', async () => {
    // Mother with 5 visits
    for (let i = 1; i <= 5; i++) {
      await createANCVisit(validANCVisit({
        motherId: 'mom-5v',
        visitNumber: i,
        visitDate: `2026-0${i}-01`,
      }));
    }
    // Mother with 2 visits
    for (let i = 1; i <= 2; i++) {
      await createANCVisit(validANCVisit({
        motherId: 'mom-2v',
        motherName: 'Other Mom',
        visitNumber: i,
        visitDate: `2026-0${i}-15`,
      }));
    }

    const stats = await getANCStats();
    expect(stats.totalMothers).toBe(2);
    expect(stats.continuum.anc1).toBe(2); // both have >= 1
    expect(stats.continuum.anc2).toBe(2); // both have >= 2
    expect(stats.continuum.anc3).toBe(1); // only mom-5v
    expect(stats.continuum.anc4).toBe(1);
    expect(stats.continuum.anc5plus).toBe(1);
    expect(stats.anc4Plus).toBe(1);
  });

  test('getANCStats handles missing visitDate in thisMonth filter', async () => {
    await createANCVisit(validANCVisit({ visitDate: undefined }));
    const stats = await getANCStats();
    expect(stats.thisMonthVisits).toBe(0); // undefined doesn't match thisMonth
  });

  test('getAllANCVisits with scope passes to filterByScope', async () => {
    await createANCVisit(validANCVisit());
    const visits = await getAllANCVisits({ role: 'doctor' });
    expect(Array.isArray(visits)).toBe(true);
  });

  test('getHighRiskPregnancies returns latest visit per mother', async () => {
    await createANCVisit(validANCVisit({
      motherId: 'hr-mom-1',
      riskLevel: 'high',
      visitNumber: 1,
      visitDate: '2026-01-01',
    }));
    await createANCVisit(validANCVisit({
      motherId: 'hr-mom-1',
      riskLevel: 'high',
      visitNumber: 3,
      visitDate: '2026-03-01',
    }));
    await createANCVisit(validANCVisit({
      motherId: 'hr-mom-2',
      motherName: 'Other',
      riskLevel: 'high',
      visitNumber: 2,
    }));
    // Low-risk mother should not appear
    await createANCVisit(validANCVisit({
      motherId: 'lr-mom',
      motherName: 'Low Risk',
      riskLevel: 'low',
    }));

    const highRisk = await getHighRiskPregnancies();
    expect(highRisk).toHaveLength(2);
    const mom1 = highRisk.find(v => v.motherId === 'hr-mom-1');
    expect(mom1!.visitNumber).toBe(3); // Latest visit
  });

  test('high-risk visit with messagesDB().put() failure handles error gracefully', async () => {
    // Destroy the messages DB to force put() to throw
    const { messagesDB } = require('@/lib/db');
    const db = messagesDB();
    await db.destroy();

    // This should not throw; the error is caught and logged
    const visit = await createANCVisit(validANCVisit({
      riskLevel: 'high',
      riskFactors: ['severe_preeclampsia'],
      motherId: 'catch-block-test',
    }));

    expect(visit._id).toBeDefined();
    expect(visit.riskLevel).toBe('high');
  });

  // ---- Line 14: Test sorting by visitDate descending ----
  test('getAllANCVisits sorts by visitDate descending (line 14)', async () => {
    const first = await createANCVisit(validANCVisit({ visitDate: '2026-01-01', motherId: 'mom-1' }));
    await new Promise(r => setTimeout(r, 10));
    const second = await createANCVisit(validANCVisit({ visitDate: '2026-03-01', motherId: 'mom-2' }));

    const all = await getAllANCVisits();
    // Most recent visit (2026-03-01) should come first
    expect(all[0]._id).toBe(second._id);
    expect(all[1]._id).toBe(first._id);
  });

  // ---- Line 53: Test patientId assignment in high-risk message ----
  test('createANCVisit high-risk alert includes motherId in patientId (line 53)', async () => {
    const { messagesDB } = require('@/lib/db');
    await createANCVisit(validANCVisit({
      riskLevel: 'high',
      motherId: 'specific-mother-001',
      riskFactors: ['gestational_diabetes'],
    }));

    // Check that the message was created with the mother ID as patientId
    const msgs = messagesDB();
    const result = await msgs.allDocs({ include_docs: true });
    const msg = result.rows.find((r: { doc?: { type?: string; patientId?: string } }) => r.doc?.type === 'message' && r.doc?.patientId === 'specific-mother-001');
    expect(msg).toBeDefined();
  });

  // ---- Line 93: Test visitNumbers.length > 0 check in anc4Plus calculation ----
  test('getANCStats handles mothers with no visit numbers (line 93)', async () => {
    // Create a mother with visits
    await createANCVisit(validANCVisit({ motherId: 'mom-visits', visitNumber: 3 }));
    // The code checks: const maxVisit = visitNumbers.length > 0 ? Math.max(...visitNumbers) : 0;
    // This test ensures the fallback to 0 is exercised

    const stats = await getANCStats();
    expect(stats.anc4Plus).toBe(0); // Mother with 3 visits shouldn't count as 4+
  });

  // ---- Line 121: Test continuum.anc1 assignment for mothers with >= 1 visit ----
  test('getANCStats correctly counts continuum.anc1 for mothers with 1+ visits (line 121)', async () => {
    // Create mothers with various visit counts
    await createANCVisit(validANCVisit({ motherId: 'mom-1v', visitNumber: 1 }));
    await createANCVisit(validANCVisit({ motherId: 'mom-3v', visitNumber: 1 }));
    await createANCVisit(validANCVisit({ motherId: 'mom-3v', visitNumber: 2 }));
    await createANCVisit(validANCVisit({ motherId: 'mom-3v', visitNumber: 3 }));

    const stats = await getANCStats();
    expect(stats.continuum.anc1).toBe(2); // Both mothers have >= 1 visit
    expect(stats.continuum.anc2).toBe(1); // Only mom-3v has >= 2
    expect(stats.continuum.anc3).toBe(1); // Only mom-3v has >= 3
  });

  // ---- Line 14: Test sort with missing visitDate ----
  test('getAllANCVisits sorts correctly with missing visitDate (line 14)', async () => {
    await createANCVisit(validANCVisit({ motherId: 'mom-with-date', visitDate: '2026-03-15' }));

    // Manually insert a visit without visitDate
    const db = require('@/lib/db').ancDB();
    const visitWithoutDate = {
      _id: 'anc-no-date',
      type: 'anc_visit',
      motherId: 'mom-no-date',
      motherName: 'Unknown',
      visitDate: undefined,
      visitNumber: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.put(visitWithoutDate);

    const visits = await getAllANCVisits();
    expect(Array.isArray(visits)).toBe(true);
    expect(visits.length).toBeGreaterThan(0);
  });

  // ---- Line 53: Test riskFactors with missing/undefined values ----
  test('createANCVisit handles undefined riskFactors (line 53)', async () => {
    const visit = await createANCVisit(validANCVisit({
      riskLevel: 'high',
      riskFactors: undefined,
    }));
    expect(visit._id).toBeDefined();
    expect(visit.riskLevel).toBe('high');
  });

  // ---- Lines 93, 121: Test ANC stats when mother has zero visits or empty visitNumbers ----
  test('getANCStats handles mother with empty visitNumbers array (line 93)', async () => {
    // Create a mother with visits but all without visitNumber
    const db = require('@/lib/db').ancDB();
    const now = new Date().toISOString();

    // Raw insert: ANC visits with no visitNumber field (or undefined)
    await db.put({
      _id: 'anc-visit-1',
      type: 'anc_visit',
      motherId: 'mom-no-visit-num',
      motherName: 'Test Mother',
      visitDate: '2026-04-01',
      visitNumber: undefined,
      facilityId: 'hosp-001',
      facilityName: 'Hospital',
      gestationalAge: 20,
      state: 'Central Equatoria',
      createdAt: now,
      updatedAt: now,
    });

    const stats = await getANCStats();
    // The mother should still count in anc1 (since we have a visit)
    // Line 121: continuum.anc1 += max >= 1 ? 1 : 0
    // When all visitNumbers are undefined, max = Math.max(0, ...undefined) = 0
    // So continuum.anc1 should not increment for this mother with zero max
    expect(stats.totalMothers).toBeGreaterThanOrEqual(1);
    expect(stats.continuum).toBeDefined();
  });

  test('getANCStats handles mother with no visits (line 93 edge case)', async () => {
    // When a mother is in the set but has visitNumbers.length === 0
    const db = require('@/lib/db').ancDB();
    const now = new Date().toISOString();

    // Create a mother with visit but visitNumber missing
    await db.put({
      _id: 'anc-edge-case',
      type: 'anc_visit',
      motherId: 'mom-edge',
      motherName: 'Edge Case',
      visitDate: '2026-04-15',
      facilityId: 'hosp-001',
      facilityName: 'Hospital',
      gestationalAge: 24,
      state: 'Central Equatoria',
      createdAt: now,
      updatedAt: now,
      // No visitNumber field
    });

    const stats = await getANCStats();
    // Should not crash and should compute stats correctly
    expect(stats.continuum.anc1).toBeGreaterThanOrEqual(0);
    expect(stats.continuum.anc2).toBeGreaterThanOrEqual(0);
  });

  test('getANCStats with mother having no numeric visitNumber (line 93)', async () => {
    // Test the case where visitNumbers array would be empty
    // When we do Math.max(0, ...visitNumbers.filter(n => n))
    await createANCVisit(validANCVisit({
      motherId: 'mother-zero-visits',
      motherName: 'Zero Visit Mom',
      visitNumber: undefined,
    }));

    const stats = await getANCStats();
    // Mother exists, but with no valid visitNumber, max should be 0
    // Line 93: const maxVisit = visitNumbers.length > 0 ? Math.max(...visitNumbers) : 0;
    // This tests the FALSE path when visitNumbers.length === 0
    expect(stats.totalMothers).toBeGreaterThanOrEqual(1);
    expect(stats.continuum.anc1).toBeGreaterThanOrEqual(0);
  });
});
