 
/**
 * Patient journey — every movement, through the real services.
 *
 * `patient-journey.test.ts` walks one happy path; this walks the branches. The
 * defect these are written against is the one that keeps recurring: a station
 * updates its OWN tracker and leaves `EncounterDoc` behind, so the visit looks
 * finished on one screen and un-started on every other. The encounter is what
 * the queues, the checkout gate and discharge all read, so each test below
 * asserts where the ENCOUNTER ended up, not what a station's local status says.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createEncounter,
  createArrivalEncounter,
  createDirectConsultationEncounter,
  advanceEncounterToClinician,
  advanceEncounterAfterTriage,
  dischargeEncounter,
  recordLeftWithoutBeingSeen,
  escalateEncounterToEmergency,
  transitionEncounter,
  getEncounter,
  findOpenEncounterForPatient,
  getOpenEncounterForPatient,
} from '@/lib/services/encounter-service';
import { isTerminal, type EncounterStatus } from '@/lib/clinical-flow/encounter-journey';

const HOSP = 'hosp-001';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

const arrive = (patientId: string, channel: 'walk_in' | 'appointment' = 'walk_in') =>
  createArrivalEncounter({
    patientId,
    patientName: 'Achol Deng',
    hospitalId: HOSP,
    arrivalChannel: channel,
    actorId: 'user-desk',
  });

/** The statuses an encounter passed through, in order. */
const trail = (enc: { statusHistory?: { to: EncounterStatus }[] }) =>
  (enc.statusHistory ?? []).map(h => h.to);

/** The trail plus the status it is sitting at now. */
const trailWithCurrent = (enc: { statusHistory?: { to: EncounterStatus }[]; status: EncounterStatus }) =>
  [...trail(enc), enc.status];

// ═══════════════════════════════════════════════════════════════════════════

describe('arrival', () => {
  test('a walk-in lands in the triage queue', async () => {
    const enc = await arrive('pat-walkin');
    expect(enc.status).toBe('awaiting_triage');
    expect(trail(enc)).toEqual(['arrived_at_facility', 'awaiting_next_station', 'awaiting_triage']);
  });

  test('a booked patient is registered before arriving', async () => {
    const enc = await arrive('pat-booked', 'appointment');
    expect(enc.status).toBe('awaiting_triage');
    expect(trail(enc)[0]).toBe('registered');
    expect(trail(enc)).toContain('arrived_at_facility');
  });

  test('the arrival is the patient\'s open visit', async () => {
    const enc = await arrive('pat-open');
    const found = await findOpenEncounterForPatient('pat-open', HOSP);
    expect(found?._id).toBe(enc._id);
  });

  test('another facility\'s visit is never adopted', async () => {
    await arrive('pat-elsewhere');
    expect(await findOpenEncounterForPatient('pat-elsewhere', 'hosp-999')).toBeNull();
  });
});

describe('triage', () => {
  test('hands the patient to the clinic and stops at the clinic door', async () => {
    const enc = await arrive('pat-triage');
    const after = await advanceEncounterAfterTriage(enc._id, {
      triageId: 'triage-1', destinationClinic: 'Outpatient', actorId: 'user-nurse',
    });
    // Stops at routed_to_clinic: rooming is a person's job, not a walk-through.
    expect(after.status).toBe('routed_to_clinic');
    expect(trail(after)).toEqual(expect.arrayContaining([
      'in_triage', 'triaged_awaiting_destination', 'routed_to_clinic',
    ]));
  });

  test('records every hop rather than jumping', async () => {
    const enc = await arrive('pat-hops');
    const after = await advanceEncounterAfterTriage(enc._id, { actorId: 'user-nurse' });
    const idxTriage = trail(after).indexOf('in_triage');
    const idxRouted = trail(after).indexOf('routed_to_clinic');
    expect(idxTriage).toBeGreaterThan(-1);
    expect(idxRouted).toBeGreaterThan(idxTriage);
  });

  test('a patient already past triage is left alone', async () => {
    const enc = await arrive('pat-past');
    await advanceEncounterAfterTriage(enc._id, { actorId: 'user-nurse' });
    const again = await advanceEncounterAfterTriage(enc._id, { actorId: 'user-nurse' });
    expect(again.status).toBe('routed_to_clinic');
  });
});

describe('consultation', () => {
  test('calling a patient walks the arrival all the way to the clinician', async () => {
    const enc = await arrive('pat-called');
    const after = await advanceEncounterToClinician(enc._id, {
      clinicianId: 'user-doc', clinicianName: 'Dr Mayen', actorId: 'user-doc',
    });
    expect(after.status).toBe('with_clinician');
    expect(after.clinicianId).toBe('user-doc');
  });

  test('calling a roomed patient picks up where rooming left off', async () => {
    const enc = await arrive('pat-roomed');
    await advanceEncounterAfterTriage(enc._id, { actorId: 'user-nurse' });
    const after = await advanceEncounterToClinician(enc._id, { actorId: 'user-doc' });
    expect(after.status).toBe('with_clinician');
    // Rooming states are still recorded even when walked through.
    expect(trail(after)).toEqual(expect.arrayContaining(['in_rooming', 'ready_for_clinician']));
  });

  test('is idempotent — a resumed consult does not re-walk the chain', async () => {
    const enc = await arrive('pat-resume');
    const first = await advanceEncounterToClinician(enc._id, { actorId: 'user-doc' });
    const second = await advanceEncounterToClinician(enc._id, { actorId: 'user-doc' });
    expect(second.status).toBe('with_clinician');
    expect(trail(second).length).toBe(trail(first).length);
  });

  test('a direct consultation with no front desk still produces a real visit', async () => {
    const enc = await createDirectConsultationEncounter({
      patientId: 'pat-direct',
      patientName: 'Achol Deng',
      hospitalId: HOSP,
      clinicianId: 'user-doc',
      clinicianName: 'Dr Mayen',
      snapshot: {},
      startedAt: '2026-04-10T09:00:00Z',
    });
    expect(enc.status).toBe('with_clinician');
    expect(isTerminal(enc.status)).toBe(false);
  });

  test('an escalated patient is not dragged back to a routine consultation', async () => {
    const enc = await arrive('pat-escalated');
    await transitionEncounter(enc._id, 'in_triage', { actorId: 'user-nurse' });
    await escalateEncounterToEmergency(enc._id, { actorId: 'user-nurse', reason: 'Airway compromise' });
    const after = await advanceEncounterToClinician(enc._id, { actorId: 'user-doc' });
    expect(after.status).toBe('escalated_to_emergency');
  });
});

describe('in-visit loops', () => {
  const atClinician = async (patientId: string) => {
    const enc = await arrive(patientId);
    return advanceEncounterToClinician(enc._id, { actorId: 'user-doc' });
  };

  test.each(['awaiting_labs', 'awaiting_imaging', 'awaiting_pharmacy', 'awaiting_procedure'] as const)(
    'a visit can go out to %s and come back to the clinician',
    async (loop) => {
      const enc = await atClinician(`pat-${loop}`);
      await transitionEncounter(enc._id, loop, { actorId: 'user-doc' });
      const back = await transitionEncounter(enc._id, 'with_clinician', { actorId: 'user-doc' });
      expect(back.status).toBe('with_clinician');
    },
  );

  test('a loop can go straight to clinic checkout without another consultation', async () => {
    const enc = await atClinician('pat-loop-out');
    await transitionEncounter(enc._id, 'awaiting_labs', { actorId: 'user-doc' });
    const out = await transitionEncounter(enc._id, 'ready_for_clinic_checkout', { actorId: 'user-doc' });
    expect(out.status).toBe('ready_for_clinic_checkout');
  });

  test('a paused consultation resumes rather than starting a second visit', async () => {
    const enc = await atClinician('pat-paused');
    await transitionEncounter(enc._id, 'consultation_paused_draft', { actorId: 'user-doc' });
    const resumed = await transitionEncounter(enc._id, 'with_clinician', { actorId: 'user-doc' });
    expect(resumed.status).toBe('with_clinician');
    expect(await getOpenEncounterForPatient('pat-paused')).not.toBeNull();
  });
});

describe('leaving before being seen', () => {
  test.each(['awaiting_triage', 'routed_to_clinic'] as const)(
    'a patient waiting at %s can be recorded as left without being seen',
    async (stopAt) => {
      const enc = await arrive(`pat-lwbs-${stopAt}`);
      if (stopAt === 'routed_to_clinic') {
        await advanceEncounterAfterTriage(enc._id, { actorId: 'user-nurse' });
      }
      const after = await recordLeftWithoutBeingSeen(enc._id, { actorId: 'user-desk' });
      expect(after.status).toBe('lwbs');
      expect(isTerminal(after.status)).toBe(true);
    },
  );

  test('a closed LWBS visit does not block the patient coming back', async () => {
    const enc = await arrive('pat-returns');
    await recordLeftWithoutBeingSeen(enc._id, { actorId: 'user-desk' });
    expect(await findOpenEncounterForPatient('pat-returns', HOSP)).toBeNull();
    const second = await arrive('pat-returns');
    expect(second._id).not.toBe(enc._id);
    expect(second.status).toBe('awaiting_triage');
  });
});

describe('escalation', () => {
  test.each(['in_triage', 'routed_to_clinic'] as const)(
    'a patient deteriorating at %s can be escalated',
    async (stopAt) => {
      const enc = await arrive(`pat-esc-${stopAt}`);
      if (stopAt === 'in_triage') {
        await transitionEncounter(enc._id, 'in_triage', { actorId: 'user-nurse' });
      } else {
        await advanceEncounterAfterTriage(enc._id, { actorId: 'user-nurse' });
      }
      const after = await escalateEncounterToEmergency(enc._id, {
        actorId: 'user-nurse', reason: 'Sudden deterioration',
      });
      expect(after.status).toBe('escalated_to_emergency');
    },
  );

  test('a patient nobody has assessed yet cannot be escalated from the queue', async () => {
    // Deliberate: escalation asserts an emergency, and asserting one for a
    // patient still only queueing would be asserting it on no assessment.
    // Triage is one hop away and records that someone laid eyes on them.
    const enc = await arrive('pat-esc-queue');
    await expect(escalateEncounterToEmergency(enc._id, { actorId: 'user-nurse' }))
      .rejects.toThrow(/Illegal encounter transition/);
  });

  test('the reason for an escalation is kept on the record', async () => {
    const enc = await arrive('pat-esc-reason');
    await transitionEncounter(enc._id, 'in_triage', { actorId: 'user-nurse' });
    const after = await escalateEncounterToEmergency(enc._id, {
      actorId: 'user-nurse', reason: 'Airway compromise',
    });
    const last = after.statusHistory![after.statusHistory!.length - 1];
    expect(last.to).toBe('escalated_to_emergency');
    expect(last.reason).toContain('Airway');
  });
});

describe('discharge', () => {
  test('a documented visit walks from checkout-ready to discharged', async () => {
    const enc = await createEncounter({
      patientId: 'pat-discharge',
      patientName: 'Achol Deng',
      clinicianId: 'user-doc',
      clinicianName: 'Dr Mayen',
      hospitalId: HOSP,
      status: 'ready_for_clinic_checkout',
      snapshot: {},
      labOrderIds: [],
      startedAt: '2026-04-10T09:00:00Z',
    });
    const after = await dischargeEncounter(enc._id, {});
    expect(after?.status).toBe('discharged');
    expect(isTerminal(after!.status)).toBe(true);
  });

  test('unfinished business is recorded rather than hidden', async () => {
    const enc = await createEncounter({
      patientId: 'pat-pending',
      patientName: 'Achol Deng',
      clinicianId: 'user-doc',
      clinicianName: 'Dr Mayen',
      hospitalId: HOSP,
      status: 'ready_for_clinic_checkout',
      snapshot: {},
      labOrderIds: [],
      startedAt: '2026-04-10T09:00:00Z',
    });
    // `pendingItems` is a flag, not a list — the items themselves live on the
    // checkout gate; this only decides which terminal status the visit gets.
    const after = await dischargeEncounter(enc._id, { actorId: 'user-desk', pendingItems: true });
    expect(after?.status).toBe('discharged_with_pending_items');
  });

  test('a visit still with the clinician is not discharged out from under them', async () => {
    const enc = await arrive('pat-midvisit');
    await advanceEncounterToClinician(enc._id, { actorId: 'user-doc' });
    await dischargeEncounter(enc._id, {});
    const after = await getEncounter(enc._id);
    expect(after?.status).toBe('with_clinician');
  });

  test('discharging twice is a no-op, not a second discharge', async () => {
    const enc = await createEncounter({
      patientId: 'pat-twice',
      patientName: 'Achol Deng',
      clinicianId: 'user-doc',
      clinicianName: 'Dr Mayen',
      hospitalId: HOSP,
      status: 'ready_for_clinic_checkout',
      snapshot: {},
      labOrderIds: [],
      startedAt: '2026-04-10T09:00:00Z',
    });
    const first = await dischargeEncounter(enc._id, {});
    const second = await dischargeEncounter(enc._id, {});
    expect(second?.status).toBe(first?.status);
    expect(trail(second!).length).toBe(trail(first!).length);
  });

  test('a discharged visit frees the patient for their next arrival', async () => {
    const enc = await createEncounter({
      patientId: 'pat-next',
      patientName: 'Achol Deng',
      clinicianId: 'user-doc',
      clinicianName: 'Dr Mayen',
      hospitalId: HOSP,
      status: 'ready_for_clinic_checkout',
      snapshot: {},
      labOrderIds: [],
      startedAt: '2026-04-10T09:00:00Z',
    });
    await dischargeEncounter(enc._id, {});
    expect(await findOpenEncounterForPatient('pat-next', HOSP)).toBeNull();
  });
});

describe('the whole spine, end to end', () => {
  test('arrive → triage → clinician → checkout → discharged, with an honest trail', async () => {
    const enc = await arrive('pat-spine');
    await advanceEncounterAfterTriage(enc._id, {
      triageId: 'triage-spine', destinationClinic: 'Outpatient', actorId: 'user-nurse',
    });
    await advanceEncounterToClinician(enc._id, {
      clinicianId: 'user-doc', clinicianName: 'Dr Mayen', actorId: 'user-doc',
    });
    // What signing the clinical note now does.
    await transitionEncounter(enc._id, 'ready_for_clinic_checkout', { actorId: 'user-doc' });
    const done = await dischargeEncounter(enc._id, { actorId: 'user-desk' });

    expect(done?.status).toBe('discharged');
    const path = trail(done!);
    for (const expected of [
      'arrived_at_facility', 'awaiting_triage', 'in_triage', 'routed_to_clinic',
      'ready_for_clinician', 'with_clinician', 'ready_for_clinic_checkout', 'discharged',
    ] as EncounterStatus[]) {
      expect(path).toContain(expected);
    }
    // Every hop is attributed — an unattributed move is an untraceable one.
    for (const hop of done!.statusHistory!) {
      expect(hop.at).toBeTruthy();
      expect(hop.byUserId).toBeTruthy();
    }
  });

  test('no illegal move can be forced through the service', async () => {
    const enc = await arrive('pat-illegal');
    await expect(transitionEncounter(enc._id, 'discharged', { actorId: 'user-desk' }))
      .rejects.toThrow();
    const after = await getEncounter(enc._id);
    expect(after?.status).toBe('awaiting_triage');
  });
});
