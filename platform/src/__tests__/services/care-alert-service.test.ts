/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for care-alert-service.ts (P1.2 chart-permanent care alerts).
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-carealert-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createPatient, getPatientById } from '@/lib/services/patient-service';
import {
  addCareAlert,
  resolveCareAlert,
  getCareAlerts,
  getActiveCareAlerts,
} from '@/lib/services/care-alert-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

async function makePatient() {
  return createPatient({
    hospitalNumber: 'HN-003',
    firstName: 'Nyandeng',
    surname: 'Garang',
    dateOfBirth: '1992-02-02',
    gender: 'Female',
    phone: '0922222222',
    state: 'Lakes',
    county: 'Rumbek Centre',
    tribe: 'Dinka',
    primaryLanguage: 'Dinka',
    bloodType: 'B+',
    allergies: [],
    chronicConditions: [],
    nokName: 'Mayen',
    nokRelationship: 'Father',
    nokPhone: '0922222223',
    registrationHospital: 'hosp-001',
    registrationDate: '2026-01-01',
  } as unknown as Parameters<typeof createPatient>[0]);
}

describe('Care alert service (P1.2)', () => {
  test('adds an active care alert with priority', async () => {
    const p = await makePatient();
    const list = await addCareAlert(p._id, { category: 'safety', message: 'High fall risk', priority: 'high' });
    expect(list).not.toBeNull();
    expect(list!).toHaveLength(1);
    expect(list![0].priority).toBe('high');
    expect(list![0].status).toBe('active');

    const reloaded = await getPatientById(p._id);
    expect(reloaded!.careAlerts).toHaveLength(1);
  });

  test('defaults priority to normal', async () => {
    const p = await makePatient();
    const list = await addCareAlert(p._id, { category: 'administrative', message: 'Needs interpreter' });
    expect(list![0].priority).toBe('normal');
  });

  test('requires a message', async () => {
    const p = await makePatient();
    await expect(addCareAlert(p._id, { category: 'other', message: '   ' })).rejects.toThrow();
  });

  test('resolve requires a reason and retains the entry as resolved', async () => {
    const p = await makePatient();
    await addCareAlert(p._id, { category: 'clinical_risk', message: 'Difficult IV access', priority: 'high' });
    const all = await getCareAlerts(p._id);
    await expect(resolveCareAlert(p._id, all[0].id, '')).rejects.toThrow();

    const resolved = await resolveCareAlert(p._id, all[0].id, 'Central line placed');
    expect(resolved![0].status).toBe('resolved');
    expect(resolved![0].resolutionReason).toBe('Central line placed');
    expect(await getActiveCareAlerts(p._id)).toHaveLength(0);
  });

  test('resolving a nonexistent alert returns null', async () => {
    const p = await makePatient();
    expect(await resolveCareAlert(p._id, 'nope', 'reason')).toBeNull();
  });

  test('getCareAlerts is empty for a patient with none', async () => {
    const p = await makePatient();
    expect(await getCareAlerts(p._id)).toEqual([]);
  });
});
