/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for check-in-service.ts (front-desk patient arrival).
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-checkin-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { checkInPatient } from '@/lib/services/check-in-service';
import { getTriageByPatient } from '@/lib/services/triage-service';
import { createAppointment, getAppointmentsByPatient } from '@/lib/services/appointment-service';
import { jubaDate } from '@/lib/time-juba';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const base = {
  patientId: 'patient-001',
  patientName: 'Ayen Deng',
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  checkedInById: 'u-desk',
  checkedInByName: 'Amira (Front Desk)',
};

describe('Patient check-in (P-checkin)', () => {
  test('creates a pending triage queue entry', async () => {
    const res = await checkInPatient({ ...base, chiefComplaint: 'Fever', acuity: 'routine' });
    expect(res.triage._id).toMatch(/^triage-/);
    expect(res.triage.status).toBe('pending');
    expect(res.triage.priority).toBe('GREEN');
    expect(res.triage.chiefComplaint).toBe('Fever');
    expect(res.triage.modeOfArrival).toBe('walk-in');

    const list = await getTriageByPatient('patient-001');
    expect(list).toHaveLength(1);
  });

  test('maps acuity to triage priority', async () => {
    expect((await checkInPatient({ ...base, patientId: 'patient-red', acuity: 'emergency' })).triage.priority).toBe('RED');
    expect((await checkInPatient({ ...base, patientId: 'patient-yellow', acuity: 'priority' })).triage.priority).toBe('YELLOW');
  });

  test('captures vitals and arrival context', async () => {
    const res = await checkInPatient({
      ...base, modeOfArrival: 'ambulance', symptomDuration: '2 days', knownAllergies: 'Penicillin',
      vitals: { temperature: '38.5', pulse: '110', systolic: '90', diastolic: '60' },
    });
    expect(res.triage.temperature).toBe('38.5');
    expect(res.triage.pulse).toBe('110');
    expect(res.triage.modeOfArrival).toBe('ambulance');
    expect(res.triage.symptomDuration).toBe('2 days');
    expect(res.triage.knownAllergies).toBe('Penicillin');
  });

  test('requires a patient', async () => {
    await expect(checkInPatient({ ...base, patientId: '', patientName: '' })).rejects.toThrow();
  });

  test('also checks in a same-day scheduled appointment', async () => {
    await createAppointment({
      patientId: 'patient-001', patientName: 'Ayen Deng', providerId: 'u-dr', providerName: 'Dr. Wani',
      facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national',
      appointmentDate: jubaDate(), appointmentTime: '09:00', appointmentType: 'general', priority: 'routine',
      department: 'OPD', reason: 'Review', status: 'scheduled', bookedBy: 'u-desk', bookedByName: 'Amira',
      state: 'Central Equatoria',
    } as unknown as Parameters<typeof createAppointment>[0]);

    const res = await checkInPatient({ ...base });
    expect(res.appointmentCheckedIn).toBe(true);
    const appts = await getAppointmentsByPatient('patient-001');
    expect(appts[0].status).toBe('checked_in');
  });

  test('succeeds with no appointment to link', async () => {
    const res = await checkInPatient({ ...base });
    expect(res.appointmentCheckedIn).toBe(false);
    expect(res.triage.status).toBe('pending');
  });

  test('does not create duplicate same-day active queue entries', async () => {
    const first = await checkInPatient({ ...base, chiefComplaint: 'Fever' });
    const second = await checkInPatient({ ...base, chiefComplaint: 'Headache', acuity: 'emergency' });
    const list = await getTriageByPatient('patient-001');

    expect(second.triage._id).toBe(first.triage._id);
    expect(list).toHaveLength(1);
    expect(list[0].chiefComplaint).toBe('Fever');
  });
});
