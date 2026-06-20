/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for directive-service.ts (P2.1 directives & consent).
 * Directives live on the patient document; these exercise add/remove/update
 * and the active-only filter.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-directive-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createPatient, getPatientById } from '@/lib/services/patient-service';
import {
  addDirective,
  removeDirective,
  updateDirective,
  getDirectives,
  getActiveDirectives,
} from '@/lib/services/directive-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

async function makePatient() {
  return createPatient({
    hospitalNumber: 'HN-002',
    firstName: 'Bol',
    surname: 'Akol',
    dateOfBirth: '1985-05-05',
    gender: 'Male',
    phone: '0911111111',
    state: 'Jonglei',
    tribe: 'Nuer',
    primaryLanguage: 'Nuer',
    bloodType: 'A+',
    allergies: [],
    chronicConditions: [],
    nokName: 'Nya',
    nokRelationship: 'Wife',
    nokPhone: '0911111112',
    registrationHospital: 'hosp-001',
    registrationDate: '2026-01-01',
  } as unknown as Parameters<typeof createPatient>[0]);
}

describe('Directive service (P2.1)', () => {
  test('adds an active directive with a default start date', async () => {
    const p = await makePatient();
    const list = await addDirective(p._id, { type: 'informed_consent', description: 'Consent to treat signed' });
    expect(list).not.toBeNull();
    expect(list!).toHaveLength(1);
    expect(list![0].type).toBe('informed_consent');
    expect(list![0].status).toBe('active');
    expect(list![0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const reloaded = await getPatientById(p._id);
    expect(reloaded!.directives).toHaveLength(1);
  });

  test('requires a description', async () => {
    const p = await makePatient();
    await expect(addDirective(p._id, { type: 'other', description: '  ' })).rejects.toThrow();
  });

  test('revoke requires a reason and retains the entry as revoked', async () => {
    const p = await makePatient();
    await addDirective(p._id, { type: 'abn_noncovered', description: 'ABN for MRI' });
    const all = await getDirectives(p._id);
    await expect(removeDirective(p._id, all[0].id, '')).rejects.toThrow();

    const revoked = await removeDirective(p._id, all[0].id, 'Patient withdrew consent');
    expect(revoked!).toHaveLength(1);
    expect(revoked![0].status).toBe('revoked');
    expect(revoked![0].removalReason).toBe('Patient withdrew consent');
    expect(await getActiveDirectives(p._id)).toHaveLength(0);
  });

  test('updateDirective edits fields in place', async () => {
    const p = await makePatient();
    await addDirective(p._id, { type: 'privacy_consent', description: 'SMS reminders OK' });
    const all = await getDirectives(p._id);
    const updated = await updateDirective(p._id, all[0].id, { description: 'No SMS — call only' });
    expect(updated![0].description).toBe('No SMS — call only');
  });

  test('removing a nonexistent directive returns null', async () => {
    const p = await makePatient();
    expect(await removeDirective(p._id, 'nope', 'reason')).toBeNull();
  });

  test('getDirectives returns empty for a patient with none', async () => {
    const p = await makePatient();
    expect(await getDirectives(p._id)).toEqual([]);
  });
});
