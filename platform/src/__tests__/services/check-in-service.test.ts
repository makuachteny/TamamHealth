/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for check-in-service.ts (front-desk patient arrival).
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-checkin-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { checkInPatient, deriveAttendanceType } from '@/lib/services/check-in-service';
import { getTriageByPatient } from '@/lib/services/triage-service';
import { createAppointment, getAppointmentsByPatient } from '@/lib/services/appointment-service';
import { getEncounter, dischargeEncounter, advanceEncounterToClinician, transitionEncounter } from '@/lib/services/encounter-service';
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
    expect((await checkInPatient({ ...base, acuity: 'emergency' })).triage.priority).toBe('RED');
    expect((await checkInPatient({ ...base, acuity: 'priority' })).triage.priority).toBe('YELLOW');
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
});

describe('Check-in creates the visit encounter (EMR-FIELD-AUDIT §3)', () => {
  test('walk-in check-in creates an encounter, threads its id onto the triage, and defaults to a new attendance', async () => {
    const res = await checkInPatient({ ...base, chiefComplaint: 'Fever' });
    expect(res.encounter.status).toBe('awaiting_triage');
    expect(res.encounter.arrivalChannel).toBe('walk_in');
    // The walk-in's own auto-created booking (see walkInAppointmentCreated)
    // is threaded onto the encounter rather than left orphaned.
    expect(res.walkInAppointmentCreated).toBe(true);
    expect(res.appointmentId).toBeDefined();
    expect(res.encounter.appointmentId).toBe(res.appointmentId);
    expect(res.attendanceType).toBe('new');
    expect(res.encounter.attendanceType).toBe('new');
    expect(res.triage.encounterId).toBe(res.encounter._id);
  });

  test('appointment check-in stores the matched appointmentId and arrivalChannel on the encounter (no longer discarded)', async () => {
    const appt = await createAppointment({
      patientId: 'patient-001', patientName: 'Ayen Deng', providerId: 'u-dr', providerName: 'Dr. Wani',
      facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital', facilityLevel: 'national',
      appointmentDate: jubaDate(), appointmentTime: '09:00', appointmentType: 'general', priority: 'routine',
      department: 'OPD', reason: 'Review', status: 'scheduled', bookedBy: 'u-desk', bookedByName: 'Amira',
      state: 'Central Equatoria',
    } as unknown as Parameters<typeof createAppointment>[0]);

    const res = await checkInPatient({ ...base });
    expect(res.appointmentId).toBe(appt._id);
    expect(res.encounter.appointmentId).toBe(appt._id);
    expect(res.encounter.arrivalChannel).toBe('appointment');
  });

  test('an explicit attendanceType overrides auto-derivation', async () => {
    const res = await checkInPatient({ ...base, attendanceType: 'repeat' });
    expect(res.attendanceType).toBe('repeat');
    expect(res.encounter.attendanceType).toBe('repeat');
  });

  test('re-checking in while a visit is still open joins the same encounter instead of duplicating it', async () => {
    const first = await checkInPatient({ ...base });
    const second = await checkInPatient({ ...base });
    expect(second.encounter._id).toBe(first.encounter._id);
    // Still only one triage-side attempt to double check the encounter itself
    // wasn't recreated (both triage docs may legitimately exist as separate
    // queue entries, but they must point at the same visit).
    expect(second.triage.encounterId).toBe(first.encounter._id);
  });

  test('rejects a duplicate check-in once the visit is with a clinician', async () => {
    const first = await checkInPatient({ ...base, patientId: 'patient-midvisit', patientName: 'Mid Visit' });
    await advanceEncounterToClinician(first.encounter._id, { clinicianId: 'user-doc', clinicianName: 'Dr Mayen' });
    // A second check-in must not attach a fresh pending triage to the
    // in-flight consultation — it is rejected with a front-desk message.
    await expect(checkInPatient({ ...base, patientId: 'patient-midvisit', patientName: 'Mid Visit' }))
      .rejects.toThrow(/visit in progress/);
    // The rejected attempt must not leave a stray second walk-in booking on
    // today's schedule — only the first check-in's own appointment exists.
    const appts = await getAppointmentsByPatient('patient-midvisit');
    expect(appts).toHaveLength(1);
    expect(appts[0]._id).toBe(first.appointmentId);
  });

  test('deriveAttendanceType: new with no history, repeat once an encounter has closed', async () => {
    expect(await deriveAttendanceType('patient-fresh')).toBe('new');

    const res = await checkInPatient({ ...base, patientId: 'patient-002', patientName: 'Deng Garang' });
    // Walk the visit the rest of the way to a terminal status (triage →
    // clinician → clinic checkout → discharge) so it counts as history.
    await advanceEncounterToClinician(res.encounter._id, { clinicianId: 'user-doc', clinicianName: 'Dr Mayen' });
    await transitionEncounter(res.encounter._id, 'ready_for_clinic_checkout');
    await dischargeEncounter(res.encounter._id, { actorId: 'desk-1' });

    expect(await deriveAttendanceType('patient-002')).toBe('repeat');
  });

  test('the created encounter is retrievable via getEncounter', async () => {
    const res = await checkInPatient({ ...base });
    const fetched = await getEncounter(res.encounter._id);
    expect(fetched?._id).toBe(res.encounter._id);
  });
});
