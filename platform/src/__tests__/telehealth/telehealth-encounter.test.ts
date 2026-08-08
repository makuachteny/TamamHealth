/**
 * A telehealth visit used to produce no encounter, no linked note, no charge,
 * and no follow-up: admitting a patient never created or linked a clinical
 * encounter, and completing a visit hardcoded `followUpRequired`/
 * `referralRequired` to `false` with nothing ever revisiting them — so
 * `getTelehealthStats().followUpRate` read a field nothing wrote.
 *
 * These tests cover the service-layer fix: `ensureTelehealthEncounter`
 * (called from `admitFromWaitingRoom`) links the session to a real
 * `with_clinician` / `arrivalChannel: 'telehealth'` encounter, reusing an
 * already-open pre-clinician encounter at the same facility instead of always
 * minting a new one, and `updateSessionStatus`'s existing `extra` passthrough
 * is what the wrap-up dialog uses to persist the clinician's follow-up choice
 * at completion time.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createSession,
  admitFromWaitingRoom,
  ensureTelehealthEncounter,
  updateSessionStatus,
  getTelehealthStats,
  type TelehealthSessionWithEncounter,
} from '@/lib/services/telehealth-service';
import {
  createEncounter,
  getEncounter,
  getAllEncounters,
} from '@/lib/services/encounter-service';
import type { TelehealthSessionDoc } from '@/lib/db-types';

afterEach(async () => {
  await teardownTestDBs();
});

const PATIENT = { patientId: 'pat-nyakuma', patientName: 'Nyakuma Deng' };
const PROVIDER = { providerId: 'user-dr-wani', providerName: 'Dr. Wani' };
const FACILITY_ID = 'hosp-tele-1';

function sessionInput(
  overrides: Partial<Omit<TelehealthSessionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'roomId'>> = {},
) {
  const now = new Date();
  return {
    patientId: PATIENT.patientId,
    patientName: PATIENT.patientName,
    providerId: PROVIDER.providerId,
    providerName: PROVIDER.providerName,
    providerRole: 'doctor',
    facilityId: FACILITY_ID,
    facilityName: 'Juba Telehealth Clinic',
    sessionType: 'video' as const,
    scheduledDate: now.toISOString().slice(0, 10),
    scheduledTime: now.toTimeString().slice(0, 5),
    status: 'waiting_room' as const,
    chiefComplaint: 'Fever and cough',
    followUpRequired: false,
    referralRequired: false,
    // Consented at creation so admission doesn't hit the KAN-125 consent gate
    // — that gate is covered elsewhere; these tests are about the encounter
    // link and the follow-up/stats plumbing.
    patientConsentGiven: true,
    sessionRecorded: false,
    connectionDrops: 0,
    state: 'Central Equatoria',
    ...overrides,
  };
}

describe('admitFromWaitingRoom → ensureTelehealthEncounter', () => {
  it('creates and links a with_clinician / telehealth encounter on admit', async () => {
    const session = await createSession(sessionInput());

    const admitted = await admitFromWaitingRoom(session._id, {
      admittedBy: PROVIDER.providerId,
      admittedByName: PROVIDER.providerName,
    });

    expect(admitted?.status).toBe('in_session');
    const encounterId = (admitted as TelehealthSessionWithEncounter | null)?.encounterId;
    expect(encounterId).toBeTruthy();

    const encounter = await getEncounter(encounterId!);
    expect(encounter).not.toBeNull();
    expect(encounter?.status).toBe('with_clinician');
    expect(encounter?.arrivalChannel).toBe('telehealth');
    expect(encounter?.patientId).toBe(PATIENT.patientId);
    expect(encounter?.clinicianId).toBe(PROVIDER.providerId);
    expect(encounter?.hospitalId).toBe(FACILITY_ID);
  });

  it('is idempotent: re-admitting the same session does not spawn a second encounter', async () => {
    const session = await createSession(sessionInput());
    const first = await admitFromWaitingRoom(session._id, {
      admittedBy: PROVIDER.providerId,
      admittedByName: PROVIDER.providerName,
    });
    const firstEncounterId = (first as TelehealthSessionWithEncounter | null)?.encounterId;

    const second = await admitFromWaitingRoom(session._id, {
      admittedBy: PROVIDER.providerId,
      admittedByName: PROVIDER.providerName,
    });
    const secondEncounterId = (second as TelehealthSessionWithEncounter | null)?.encounterId;

    expect(secondEncounterId).toBe(firstEncounterId);

    const allEncounters = await getAllEncounters();
    const forPatient = allEncounters.filter(e => e.patientId === PATIENT.patientId);
    expect(forPatient).toHaveLength(1);
  });

  it('reuses an already-open pre-clinician encounter at the same facility and advances it to with_clinician', async () => {
    // Simulate a check-in that happened earlier the same day and is still
    // waiting on triage when the telehealth visit is admitted.
    const preExisting = await createEncounter({
      patientId: PATIENT.patientId,
      patientName: PATIENT.patientName,
      clinicianId: '',
      clinicianName: '',
      hospitalId: FACILITY_ID,
      hospitalName: 'Juba Telehealth Clinic',
      status: 'awaiting_triage',
      snapshot: {},
      labOrderIds: [],
      startedAt: new Date().toISOString(),
      arrivalChannel: 'walk_in',
    });

    const session = await createSession(sessionInput());
    const admitted = await admitFromWaitingRoom(session._id, {
      admittedBy: PROVIDER.providerId,
      admittedByName: PROVIDER.providerName,
    });
    const encounterId = (admitted as TelehealthSessionWithEncounter | null)?.encounterId;

    // Reused, not a fresh one.
    expect(encounterId).toBe(preExisting._id);

    const encounter = await getEncounter(preExisting._id);
    expect(encounter?.status).toBe('with_clinician');
    expect(encounter?.clinicianId).toBe(PROVIDER.providerId);
    // The channel the patient actually arrived through is preserved — reuse
    // links the visit, it does not rewrite how the patient got there.
    expect(encounter?.arrivalChannel).toBe('walk_in');

    const allEncounters = await getAllEncounters();
    expect(allEncounters.filter(e => e.patientId === PATIENT.patientId)).toHaveLength(1);
  });

  it('leaves an encounter already past with_clinician untouched, only linking it', async () => {
    const inLabs = await createEncounter({
      patientId: PATIENT.patientId,
      patientName: PATIENT.patientName,
      clinicianId: 'user-dr-other',
      clinicianName: 'Dr. Other',
      hospitalId: FACILITY_ID,
      hospitalName: 'Juba Telehealth Clinic',
      status: 'awaiting_labs',
      snapshot: {},
      labOrderIds: ['lab-1'],
      startedAt: new Date().toISOString(),
      arrivalChannel: 'walk_in',
    });

    const session = await createSession(sessionInput());
    const admitted = await admitFromWaitingRoom(session._id, {
      admittedBy: PROVIDER.providerId,
      admittedByName: PROVIDER.providerName,
    });
    const encounterId = (admitted as TelehealthSessionWithEncounter | null)?.encounterId;

    expect(encounterId).toBe(inLabs._id);
    const encounter = await getEncounter(inLabs._id);
    // Not pulled backwards to with_clinician, and the original clinician
    // assignment is left alone — ensureTelehealthEncounter only advances a
    // PRE-clinician encounter.
    expect(encounter?.status).toBe('awaiting_labs');
    expect(encounter?.clinicianId).toBe('user-dr-other');
  });

  it('ensureTelehealthEncounter is a no-op once a session already carries an encounterId', async () => {
    const session = await createSession(sessionInput());
    const linked = await ensureTelehealthEncounter(session);
    const encounterId = (linked as TelehealthSessionWithEncounter | null)?.encounterId;
    expect(encounterId).toBeTruthy();

    const again = await ensureTelehealthEncounter(linked!);
    expect((again as TelehealthSessionWithEncounter | null)?.encounterId).toBe(encounterId);

    const allEncounters = await getAllEncounters();
    expect(allEncounters.filter(e => e.patientId === PATIENT.patientId)).toHaveLength(1);
  });
});

describe('completing a telehealth visit — follow-up persistence and stats', () => {
  it('completing with followUpRequired persists it, and getTelehealthStats counts it', async () => {
    const session = await createSession(sessionInput());
    await updateSessionStatus(session._id, 'completed', {
      followUpRequired: true,
      followUpDate: '2026-08-20',
    });

    const stats = await getTelehealthStats();
    expect(stats.completedTotal).toBe(1);
    expect(stats.followUpRate).toBe(100);
  });

  it('completing without followUpRequired leaves the rate at 0', async () => {
    const session = await createSession(sessionInput());
    await updateSessionStatus(session._id, 'completed', {
      followUpRequired: false,
    });

    const stats = await getTelehealthStats();
    expect(stats.completedTotal).toBe(1);
    expect(stats.followUpRate).toBe(0);
  });

  it('mixed cohort reports the correct proportion', async () => {
    const withFollowUp = await createSession(sessionInput({ patientId: 'pat-a', patientName: 'Patient A' }));
    const withoutFollowUp = await createSession(sessionInput({ patientId: 'pat-b', patientName: 'Patient B' }));

    await updateSessionStatus(withFollowUp._id, 'completed', { followUpRequired: true });
    await updateSessionStatus(withoutFollowUp._id, 'completed', { followUpRequired: false });

    const stats = await getTelehealthStats();
    expect(stats.completedTotal).toBe(2);
    expect(stats.followUpRate).toBe(50);
  });
});
