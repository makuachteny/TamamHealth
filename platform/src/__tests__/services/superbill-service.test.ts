/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for superbill-service.ts (P2.3 clinician-facing fee ticket).
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-sb-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createFee } from '@/lib/services/fee-schedule-service';
import { createPatient, getPatientById } from '@/lib/services/patient-service';
import { buildSuperbillPreview, postSuperbill } from '@/lib/services/superbill-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

async function seedFees() {
  await createFee({ facilityId: 'hosp-001', facilityName: 'Juba TH', category: 'consultation', serviceCode: 'CONS', serviceName: 'OPD consultation', unitPrice: 100 });
  await createFee({ facilityId: 'hosp-001', facilityName: 'Juba TH', category: 'laboratory', serviceCode: 'MAL', serviceName: 'Malaria RDT', unitPrice: 50 });
}

async function makePatient() {
  return createPatient({
    hospitalNumber: 'HN-SB1', firstName: 'Bol', surname: 'Akol', dateOfBirth: '1985-01-01',
    gender: 'Male', phone: '0900000000', state: 'Jonglei', county: 'Bor South', tribe: 'Nuer', primaryLanguage: 'Nuer',
    bloodType: 'A+', allergies: [], chronicConditions: [], nokName: 'Nya', nokRelationship: 'Wife',
    nokPhone: '0900000001', registrationHospital: 'hosp-001', registrationDate: '2026-01-01',
  } as unknown as Parameters<typeof createPatient>[0]);
}

function ctxFor(patientId: string) {
  return {
    patientId, patientName: 'Bol Akol', facilityId: 'hosp-001', facilityName: 'Juba TH',
    facilityLevel: 'hospital', state: 'Jonglei', encounterId: 'enc-1',
    generatedBy: 'u-dr', generatedByName: 'Dr. Wani', scope: undefined,
  };
}

describe('Superbill preview (P2.3)', () => {
  test('prices selected services from the fee schedule and totals them', async () => {
    await seedFees();
    const preview = await buildSuperbillPreview([
      { category: 'consultation', serviceCode: 'CONS' },
      { category: 'laboratory', serviceCode: 'MAL', quantity: 2 },
    ]);
    expect(preview.lines).toHaveLength(2);
    expect(preview.lines[0].totalPrice).toBe(100);
    expect(preview.lines[1].totalPrice).toBe(100); // 50 x 2
    expect(preview.total).toBe(200);
  });

  test('separates covered vs non-covered (ABN) totals', async () => {
    await seedFees();
    const preview = await buildSuperbillPreview([
      { category: 'consultation', serviceCode: 'CONS' },
      { category: 'laboratory', serviceCode: 'MAL', nonCovered: true },
    ]);
    expect(preview.coveredTotal).toBe(100);
    expect(preview.nonCoveredTotal).toBe(50);
    expect(preview.total).toBe(150);
  });

  test('flags lines with no catalog price as unpriced', async () => {
    // No fees seeded → nothing priceable.
    const preview = await buildSuperbillPreview([{ category: 'procedure', serviceCode: 'XYZ' }]);
    expect(preview.lines[0].unpriced).toBe(true);
    expect(preview.unpricedCount).toBe(1);
    expect(preview.total).toBe(0);
  });

  test('honours an explicit unitPrice override', async () => {
    const preview = await buildSuperbillPreview([{ category: 'other', description: 'Dressing', unitPrice: 30, quantity: 3 }]);
    expect(preview.lines[0].totalPrice).toBe(90);
    expect(preview.lines[0].unpriced).toBe(false);
  });
});

describe('Superbill post (P2.3)', () => {
  test('posts a bill and records an ABN directive for non-covered lines', async () => {
    await seedFees();
    const patient = await makePatient();
    const result = await postSuperbill(ctxFor(patient._id), [
      { category: 'consultation', serviceCode: 'CONS' },
      { category: 'laboratory', serviceCode: 'MAL', nonCovered: true },
    ]);
    expect(result.billId).toBeTruthy();
    expect(result.abnRecorded).toBe(1);

    // ABN acknowledgement is recorded as a directive on the patient chart.
    const reloaded = await getPatientById(patient._id);
    const abn = (reloaded!.directives || []).filter((d) => d.type === 'abn_noncovered');
    expect(abn).toHaveLength(1);
    expect(abn[0].description).toContain('ABN');
  });

  test('no ABN directives when nothing is marked non-covered', async () => {
    await seedFees();
    const patient = await makePatient();
    const result = await postSuperbill(ctxFor(patient._id), [{ category: 'consultation', serviceCode: 'CONS' }]);
    expect(result.abnRecorded).toBe(0);
    const reloaded = await getPatientById(patient._id);
    expect((reloaded!.directives || []).length).toBe(0);
  });
});
