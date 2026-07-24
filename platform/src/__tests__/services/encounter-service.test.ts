/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for the facility-checkout discharge path added to encounter-service:
 * dischargeEncounter() walks an encounter through the legal clinic→facility
 * checkout chain to a terminal status, and getOpenEncounterForPatient() finds
 * the patient's open encounter.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createEncounter,
  dischargeEncounter,
  getOpenEncounterForPatient,
  findOpenEncounterForPatient,
  hasClosedEncounterForPatient,
  createArrivalEncounter,
  advanceEncounterToClinician,
  createDirectConsultationEncounter,
} from '@/lib/services/encounter-service';
import type { EncounterStatus } from '@/lib/clinical-flow/encounter-journey';

const makeEncounter = (status: EncounterStatus, patientId = 'pat-001') =>
  createEncounter({
    patientId,
    patientName: 'Achol Deng',
    clinicianId: 'user-doc',
    clinicianName: 'Dr Mayen',
    hospitalId: 'hosp-001',
    status,
    snapshot: {},
    labOrderIds: [],
    startedAt: '2026-04-10T09:00:00Z',
  });

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('dischargeEncounter (facility checkout)', () => {
  test('walks ready_for_clinic_checkout through to a terminal discharged status', async () => {
    const enc = await makeEncounter('ready_for_clinic_checkout');
    const out = await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    expect(out?.status).toBe('discharged');
  });

  test('flags pending items as discharged_with_pending_items', async () => {
    const enc = await makeEncounter('ready_for_clinic_checkout');
    const out = await dischargeEncounter(enc._id, { actorId: 'desk-1', pendingItems: true });
    expect(out?.status).toBe('discharged_with_pending_items');
  });

  test('is a no-op on an already-terminal encounter', async () => {
    const enc = await makeEncounter('ready_for_clinic_checkout');
    await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    const again = await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    expect(again?.status).toBe('discharged'); // unchanged
  });

  test('leaves a not-yet-finished visit untouched', async () => {
    const enc = await makeEncounter('with_clinician');
    const out = await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    expect(out?.status).toBe('with_clinician'); // not in a checkout-eligible state
  });
});

describe('getOpenEncounterForPatient', () => {
  test('returns the open encounter and ignores discharged ones', async () => {
    const open = await makeEncounter('ready_for_clinic_checkout', 'pat-xyz');
    const found = await getOpenEncounterForPatient('pat-xyz');
    expect(found?._id).toBe(open._id);

    await dischargeEncounter(open._id, { actorId: 'desk-1' });
    expect(await getOpenEncounterForPatient('pat-xyz')).toBeNull();
  });
});

describe('createArrivalEncounter (arrival-door encounters)', () => {
  test('walk-in arrival walks arrived_at_facility → awaiting_next_station → awaiting_triage', async () => {
    const enc = await createArrivalEncounter({
      patientId: 'pat-walkin', patientName: 'Walk In', hospitalId: 'hosp-001',
      arrivalChannel: 'walk_in', attendanceType: 'new', actorId: 'desk-1',
    });
    expect(enc.status).toBe('awaiting_triage');
    expect(enc.arrivalChannel).toBe('walk_in');
    expect(enc.attendanceType).toBe('new');
    expect(enc.clinicianId).toBe(''); // no clinician assigned yet at arrival
  });

  test('appointment arrival walks registered → arrived_at_facility → awaiting_next_station → awaiting_triage', async () => {
    const enc = await createArrivalEncounter({
      patientId: 'pat-appt', patientName: 'Appt Patient', hospitalId: 'hosp-001',
      arrivalChannel: 'appointment', appointmentId: 'appt-1', attendanceType: 'repeat', actorId: 'desk-1',
    });
    expect(enc.status).toBe('awaiting_triage');
    expect(enc.arrivalChannel).toBe('appointment');
    expect(enc.appointmentId).toBe('appt-1');
    expect(enc.attendanceType).toBe('repeat');
  });
});

describe('findOpenEncounterForPatient (time-bounded, facility-scoped reuse)', () => {
  test('finds a fresh open arrival encounter at the same facility', async () => {
    const created = await createArrivalEncounter({
      patientId: 'pat-fresh', patientName: 'Fresh', hospitalId: 'hosp-001', arrivalChannel: 'walk_in',
    });
    const found = await findOpenEncounterForPatient('pat-fresh', 'hosp-001');
    expect(found?._id).toBe(created._id);
  });

  test('excludes terminal encounters', async () => {
    await makeEncounter('discharged', 'pat-term');
    expect(await findOpenEncounterForPatient('pat-term', 'hosp-001')).toBeNull();
  });

  test('never joins another facility\'s open encounter (cross-facility PHI guard)', async () => {
    // Open visit at Facility A, replicated org-wide; the patient then presents
    // at Facility B — B must get a fresh encounter, not absorb A's.
    await createArrivalEncounter({
      patientId: 'pat-roamer', patientName: 'Roamer', hospitalId: 'hosp-A', arrivalChannel: 'walk_in',
    });
    expect(await findOpenEncounterForPatient('pat-roamer', 'hosp-B')).toBeNull();
    expect((await findOpenEncounterForPatient('pat-roamer', 'hosp-A'))?.hospitalId).toBe('hosp-A');
  });
});

describe('hasClosedEncounterForPatient', () => {
  test('false with no encounters, true once one reaches a terminal status', async () => {
    expect(await hasClosedEncounterForPatient('pat-hist')).toBe(false);
    const enc = await makeEncounter('ready_for_clinic_checkout', 'pat-hist');
    expect(await hasClosedEncounterForPatient('pat-hist')).toBe(false);
    await dischargeEncounter(enc._id, { actorId: 'desk-1' });
    expect(await hasClosedEncounterForPatient('pat-hist')).toBe(true);
  });
});

describe('advanceEncounterToClinician (reuse an arrival encounter for consultation)', () => {
  test('walks an awaiting_triage arrival encounter to with_clinician', async () => {
    const arrival = await createArrivalEncounter({
      patientId: 'pat-consult', patientName: 'Consult Me', hospitalId: 'hosp-001', arrivalChannel: 'walk_in',
    });
    expect(arrival.status).toBe('awaiting_triage');
    const advanced = await advanceEncounterToClinician(arrival._id, {
      clinicianId: 'user-doc', clinicianName: 'Dr Mayen', snapshot: { chiefComplaint: 'Fever' },
    });
    expect(advanced.status).toBe('with_clinician');
    expect(advanced.clinicianId).toBe('user-doc');
    expect(advanced.snapshot).toEqual({ chiefComplaint: 'Fever' });
  });

  test('is a no-op when already with_clinician', async () => {
    const enc = await makeEncounter('with_clinician', 'pat-already');
    const advanced = await advanceEncounterToClinician(enc._id);
    expect(advanced.status).toBe('with_clinician');
    expect(advanced._rev).toBe(enc._rev);
  });
});

describe('createDirectConsultationEncounter (no prior check-in)', () => {
  test('creates at a legal initial status and walks to with_clinician', async () => {
    const enc = await createDirectConsultationEncounter({
      patientId: 'pat-direct', patientName: 'Direct Consult', clinicianId: 'user-doc', clinicianName: 'Dr Mayen',
      hospitalId: 'hosp-001', snapshot: { chiefComplaint: 'Cough' }, startedAt: '2026-04-10T09:00:00Z',
    });
    expect(enc.status).toBe('with_clinician');
    expect(enc.arrivalChannel).toBe('walk_in');
    expect(enc.snapshot).toEqual({ chiefComplaint: 'Cough' });
  });
});
