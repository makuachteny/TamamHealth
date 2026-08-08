/**
 * Service-level coverage for the note's "loop-closer" actions added to
 * ClinicalNoteEditor: scheduling a follow-up, pausing a visit on Save &
 * Close, and closing the clinic portion of a visit on referral-out.
 *
 * Mirrors note-signing.test.ts's harness (mocked uuid + in-memory PouchDB via
 * the shared test-db mock) since these are the same services that test
 * exercises — encounter-service and note-service — plus follow-up-service.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createClinicalNote, saveNoteSection, recordPlanAction, getClinicalNoteById,
} from '@/lib/clinical-notes/note-service';
import {
  createEncounter, getEncounter, transitionEncounter, getResumableEncounters,
} from '@/lib/services/encounter-service';
import { createFollowUp, getFollowUpsByPatient } from '@/lib/services/follow-up-service';

afterEach(async () => {
  await teardownTestDBs();
});

async function draftNote(overrides: Record<string, unknown> = {}) {
  const note = await createClinicalNote({
    patientId: 'pat-00001',
    patientName: 'Nyakuma Deng',
    noteType: 'soap',
    serviceDate: '2026-08-08',
    authorId: 'user-dr-wani',
    authorName: 'Dr. Wani',
    assignedToId: 'user-dr-wani',
    assignedToName: 'Dr. Wani',
    hospitalId: 'hosp-001',
    orgId: 'org-moh-ss',
    ...overrides,
  } as never);
  await saveNoteSection(note._id, 'subjective', { text: 'Fever for three days.' });
  return note;
}

async function withClinicianEncounter(overrides: Record<string, unknown> = {}) {
  return createEncounter({
    patientId: 'pat-00001', patientName: 'Nyakuma Deng',
    clinicianId: 'user-dr-wani', clinicianName: 'Dr. Wani',
    hospitalId: 'hosp-001', orgId: 'org-moh-ss',
    status: 'with_clinician', snapshot: {}, labOrderIds: [],
    startedAt: new Date().toISOString(),
    ...overrides,
  } as never);
}

describe('createFollowUp — note-driven follow-up scheduling', () => {
  it('stamps encounterId + hospitalId on the follow-up, and they persist through a fresh read', async () => {
    const enc = await withClinicianEncounter();

    const created = await createFollowUp({
      patientId: 'pat-00001',
      patientName: 'Nyakuma Deng',
      encounterId: enc._id,
      hospitalId: 'hosp-001',
      assignedWorker: 'user-dr-wani',
      assignedWorkerName: 'Dr. Wani',
      status: 'active',
      condition: 'Malaria — follow-up',
      facilityLevel: 'county',
      scheduledDate: '2026-08-15',
      state: 'Central Equatoria',
      county: 'Juba',
      orgId: 'org-moh-ss',
    });

    expect(created.encounterId).toBe(enc._id);
    expect(created.hospitalId).toBe('hosp-001');

    const fetched = await getFollowUpsByPatient('pat-00001');
    expect(fetched).toHaveLength(1);
    expect(fetched[0].encounterId).toBe(enc._id);
    expect(fetched[0].hospitalId).toBe('hosp-001');
    expect(fetched[0].condition).toBe('Malaria — follow-up');
  });
});

describe('transitionEncounter — pausing and resuming a consultation', () => {
  it('allows with_clinician → consultation_paused_draft, and the paused encounter is resumable for its clinician', async () => {
    const enc = await withClinicianEncounter();

    const paused = await transitionEncounter(enc._id, 'consultation_paused_draft', {
      actorId: 'user-dr-wani', actorRole: 'doctor',
    });
    expect(paused.status).toBe('consultation_paused_draft');
    // Pausing is not a clinic-portion close — the visit is still open, just parked.
    expect(paused.closedAt).toBeFalsy();

    const resumable = await getResumableEncounters('user-dr-wani');
    expect(resumable.map(e => e._id)).toContain(enc._id);
  });

  it('allows consultation_paused_draft → with_clinician to resume the visit', async () => {
    const enc = await withClinicianEncounter();
    await transitionEncounter(enc._id, 'consultation_paused_draft', { actorId: 'user-dr-wani' });

    const resumed = await transitionEncounter(enc._id, 'with_clinician', { actorId: 'user-dr-wani' });
    expect(resumed.status).toBe('with_clinician');

    const stillResumable = await getResumableEncounters('user-dr-wani');
    expect(stillResumable.map(e => e._id)).not.toContain(enc._id);
  });
});

describe('transitionEncounter — referral out closes the clinic portion', () => {
  it('with_clinician → referred_out stamps closedAt', async () => {
    const enc = await withClinicianEncounter();

    const referred = await transitionEncounter(enc._id, 'referred_out', {
      actorId: 'user-dr-wani', actorRole: 'doctor', reason: 'Referred to Juba Teaching Hospital',
    });
    expect(referred.status).toBe('referred_out');
    expect(referred.closedAt).toBeTruthy();

    const reread = await getEncounter(enc._id);
    expect(reread?.closedAt).toBeTruthy();
  });
});

describe('recordPlanAction — follow-up plan actions', () => {
  it('appends a follow_up-kind action to the note', async () => {
    const note = await draftNote();

    const updated = await recordPlanAction(note._id, {
      kind: 'follow_up',
      label: 'Follow-up: Malaria — follow-up on 2026-08-15',
      targetId: 'followup-00000001',
      createdBy: 'user-dr-wani',
    });

    expect(updated?.planActions).toHaveLength(1);
    expect(updated?.planActions?.[0]).toMatchObject({
      kind: 'follow_up',
      targetId: 'followup-00000001',
      createdBy: 'user-dr-wani',
    });

    const reread = await getClinicalNoteById(note._id);
    expect(reread?.planActions?.[0].kind).toBe('follow_up');
  });
});
