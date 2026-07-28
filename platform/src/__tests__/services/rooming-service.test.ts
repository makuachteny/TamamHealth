/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for the rooming station (KAN-99 / KAN-108).
 *
 * The station's value is that each action is a real encounter transition, so
 * these tests assert the journey moved — not just that a field changed. A
 * rooming station that updates fields without transitioning would look correct
 * in the UI and leave the clinician's worklist empty.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-room-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createEncounter, transitionEncounter, getEncounter } from '@/lib/services/encounter-service';
import {
  getRoomingWorklist,
  markArrivedAtClinic,
  assignRoom,
  recordRoomingVitals,
  setDestinationClinic,
  markReadyForClinician,
} from '@/lib/services/rooming-service';
import type { EncounterDoc } from '@/lib/db-types';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

/** An encounter sitting where triage leaves it: routed to a clinic. */
async function routedEncounter(overrides: Partial<EncounterDoc> = {}): Promise<EncounterDoc> {
  const enc = await createEncounter({
    patientId: 'pat-001',
    patientName: 'Nyandeng Deng',
    clinicianId: '',
    clinicianName: '',
    hospitalId: 'hosp-001',
    orgId: 'org-001',
    status: 'arrived_at_facility',
    snapshot: {},
    labOrderIds: [],
    startedAt: new Date().toISOString(),
    ...overrides,
  } as never);

  // Walk the legal chain rather than forcing the status, so the fixture itself
  // proves the machine allows this path.
  await transitionEncounter(enc._id, 'awaiting_next_station');
  await transitionEncounter(enc._id, 'awaiting_triage');
  await transitionEncounter(enc._id, 'in_triage');
  await transitionEncounter(enc._id, 'triaged_awaiting_destination');
  return transitionEncounter(enc._id, 'routed_to_clinic');
}

describe('rooming worklist', () => {
  it('includes patients routed to a clinic but not yet acknowledged', async () => {
    await routedEncounter();
    const list = await getRoomingWorklist();

    // If the list started at `arrived_at_clinic_awaiting_rooming`, nobody would
    // ever see patients waiting to be acknowledged and it would look empty.
    expect(list).toHaveLength(1);
    expect(list[0].step).toBe('awaiting_arrival');
  });

  it('reports the step each patient is on', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    expect((await getRoomingWorklist())[0].step).toBe('awaiting_rooming');

    await assignRoom(enc._id, '4');
    expect((await getRoomingWorklist())[0].step).toBe('being_roomed');
  });

  it('drops a patient off the list once they are ready for the clinician', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await assignRoom(enc._id, '4');
    await markReadyForClinician(enc._id, { actorName: 'Nurse Aluel' });

    expect(await getRoomingWorklist()).toHaveLength(0);
  });

  it('puts the longest wait first', async () => {
    const older = await routedEncounter({
      patientName: 'Waited Longest',
      startedAt: new Date(Date.now() - 90 * 60000).toISOString(),
    });
    await routedEncounter({ patientName: 'Just Arrived' });

    const list = await getRoomingWorklist();
    // The point of the queue is to surface who has been left waiting; an
    // insertion-ordered list hides exactly that.
    expect(list[0].encounter._id).toBe(older._id);
    expect(list[0].waitingMinutes).toBeGreaterThanOrEqual(90);
  });
});

describe('rooming actions produce encounter transitions', () => {
  it('assigns a room and moves the encounter into rooming', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    const roomed = await assignRoom(enc._id, ' 4B ', { actorName: 'Nurse Aluel' });

    expect(roomed.status).toBe('in_rooming');
    // Stored on the encounter, not only in the audit log — the clinician's
    // worklist has to be able to say where the patient is.
    expect(roomed.roomNumber).toBe('4B');
  });

  it('refuses an empty room name', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await expect(assignRoom(enc._id, '   ')).rejects.toThrow();
  });

  it('refuses to mark a patient ready before a room is assigned', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);

    // "Ready" with no location is a handoff that hands nothing off.
    await expect(markReadyForClinician(enc._id)).rejects.toThrow(/Assign a room/);
    expect((await getEncounter(enc._id))?.status).toBe('arrived_at_clinic_awaiting_rooming');
  });

  it('records who roomed the patient and when', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await assignRoom(enc._id, '2');
    const ready = await markReadyForClinician(enc._id, { actorName: 'Nurse Aluel' });

    expect(ready.status).toBe('ready_for_clinician');
    expect(ready.roomedByName).toBe('Nurse Aluel');
    expect(ready.roomedAt).toBeTruthy();
  });

  it('will not skip the machine — rooming cannot be reached from triage directly', async () => {
    const enc = await createEncounter({
      patientId: 'pat-002', patientName: 'Skip Test',
      clinicianId: '', clinicianName: '', hospitalId: 'hosp-001', orgId: 'org-001',
      status: 'awaiting_triage', snapshot: {}, labOrderIds: [],
      startedAt: new Date().toISOString(),
    } as never);

    // The guarantee that makes this station trustworthy: an illegal hop throws
    // rather than corrupting the journey.
    await expect(assignRoom(enc._id, '4')).rejects.toThrow(/Illegal encounter transition/);
  });
});

describe('destination clinic transfer', () => {
  it('routes through the transfer state instead of rewriting a field', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await assignRoom(enc._id, '4');

    const moved = await setDestinationClinic(enc._id, 'Paediatrics', { actorName: 'Nurse Aluel' });

    expect(moved.destinationClinic).toBe('Paediatrics');
    // Back in the receiving clinic's rooming queue — they still have to be
    // roomed there, and the old room no longer applies.
    expect(moved.status).toBe('arrived_at_clinic_awaiting_rooming');
    expect(moved.roomNumber).toBeUndefined();
  });

  it('refuses an empty destination', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await expect(setDestinationClinic(enc._id, '  ')).rejects.toThrow();
  });
});

describe('rooming vitals', () => {
  it('writes through the shared nursing-vitals path so the shape cannot drift', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await assignRoom(enc._id, '4');

    const record = await recordRoomingVitals({
      patientId: 'pat-001',
      patientName: 'Nyandeng Deng',
      hospitalId: 'hosp-001',
      orgId: 'org-001',
      encounterId: enc._id,
      recordedByName: 'Nurse Aluel',
      vitals: {
        temperature: '37.2', systolic: '120', diastolic: '80', pulse: '78',
        spo2: '98', respiratoryRate: '18', weight: '64', height: '170',
      },
    });

    // Same numeric VitalSigns shape as triage and clinical records, so the
    // chart's vitals trend picks these up without learning a new store.
    expect(record.vitalSigns.temperature).toBe(37.2);
    expect(record.vitalSigns.systolic).toBe(120);
    expect(record.recordKind).toBe('nursing_vitals');
    expect(record.encounterId).toBe(enc._id);
  });

  it('accepts a partial set — absent measurements are not zeroed', async () => {
    // Regression: `recordNursingVitals` hardcoded `height: 0`, and the shared
    // validator skips undefined but range-checks 0 — so EVERY nursing-vitals
    // write threw ValidationError. A rooming nurse taking temperature and BP
    // without a height stick could not save anything.
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await assignRoom(enc._id, '4');

    const record = await recordRoomingVitals({
      patientId: 'pat-001',
      patientName: 'Nyandeng Deng',
      hospitalId: 'hosp-001',
      encounterId: enc._id,
      vitals: { temperature: '37.2', systolic: '120', diastolic: '80', pulse: '78' },
    });

    expect(record.vitalSigns.temperature).toBe(37.2);
    expect(record.vitalSigns.height).toBeUndefined();
  });

  it('derives BMI when both weight and height are recorded', async () => {
    const enc = await routedEncounter();
    await markArrivedAtClinic(enc._id);
    await assignRoom(enc._id, '4');

    const record = await recordRoomingVitals({
      patientId: 'pat-001',
      patientName: 'Nyandeng Deng',
      hospitalId: 'hosp-001',
      encounterId: enc._id,
      vitals: { temperature: '37', weight: '64', height: '170' },
    });

    expect(record.vitalSigns.bmi).toBeCloseTo(22.1, 1);
  });

  it('refuses vitals not linked to an encounter', async () => {
    await expect(recordRoomingVitals({
      patientId: 'pat-001',
      patientName: 'Nyandeng Deng',
      hospitalId: 'hosp-001',
      vitals: { temperature: '37' },
    })).rejects.toThrow(/linked to an encounter/);
  });
});
