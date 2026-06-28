/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for screening-service.ts — preventive-care reminders on the chart.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-screen-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createPatient } from '@/lib/services/patient-service';
import {
  addScreening,
  completeScreening,
  declineScreening,
  removeScreening,
  getScreenings,
  getDueScreenings,
  isScreeningOverdue,
} from '@/lib/services/screening-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

async function makePatient() {
  return createPatient({
    hospitalNumber: 'HN-SCR', firstName: 'Aboud', surname: 'Lado', dateOfBirth: '1980-01-01',
    gender: 'Male', phone: '0911000000', state: 'CES', tribe: 'Bari', primaryLanguage: 'Bari',
    bloodType: 'O+', allergies: [], chronicConditions: [], nokName: 'X', nokRelationship: 'Brother',
    nokPhone: '0911000001', registrationHospital: 'hosp-001', registrationDate: '2026-01-01',
  } as unknown as Parameters<typeof createPatient>[0]);
}

describe('Screening service', () => {
  test('adds a due screening', async () => {
    const p = await makePatient();
    const list = await addScreening(p._id, { type: 'Blood pressure', dueDate: '2026-06-01', intervalMonths: 12 });
    expect(list).toHaveLength(1);
    expect(list![0].status).toBe('due');
    expect(await getDueScreenings(p._id)).toHaveLength(1);
  });

  test('requires a type', async () => {
    const p = await makePatient();
    await expect(addScreening(p._id, { type: '  ' })).rejects.toThrow();
  });

  test('isScreeningOverdue flags a past due date', async () => {
    const p = await makePatient();
    await addScreening(p._id, { type: 'HIV test', dueDate: '2020-01-01' });
    const all = await getScreenings(p._id);
    expect(isScreeningOverdue(all[0], '2026-06-24')).toBe(true);
  });

  test('completing a recurring screening rolls the due date forward', async () => {
    const p = await makePatient();
    await addScreening(p._id, { type: 'Cervical (VIA)', dueDate: '2026-01-01', intervalMonths: 12 });
    const all = await getScreenings(p._id);
    const after = await completeScreening(p._id, all[0].id, '2026-06-24');
    expect(after![0].status).toBe('due');
    expect(after![0].lastDoneDate).toBe('2026-06-24');
    expect(after![0].dueDate).toBe('2027-06-24');
  });

  test('completing a one-off screening marks it completed', async () => {
    const p = await makePatient();
    await addScreening(p._id, { type: 'One-off test', dueDate: '2026-01-01' });
    const all = await getScreenings(p._id);
    const after = await completeScreening(p._id, all[0].id, '2026-06-24');
    expect(after![0].status).toBe('completed');
    expect(await getDueScreenings(p._id)).toHaveLength(0);
  });

  test('decline and remove', async () => {
    const p = await makePatient();
    await addScreening(p._id, { type: 'Mammogram', dueDate: '2026-01-01' });
    let all = await getScreenings(p._id);
    const declined = await declineScreening(p._id, all[0].id, 'Patient refused');
    expect(declined![0].status).toBe('declined');
    all = await getScreenings(p._id);
    const removed = await removeScreening(p._id, all[0].id);
    expect(removed).toHaveLength(0);
  });

  test('mutations on a missing screening return null', async () => {
    const p = await makePatient();
    expect(await completeScreening(p._id, 'nope')).toBeNull();
    expect(await removeScreening(p._id, 'nope')).toBeNull();
  });
});
