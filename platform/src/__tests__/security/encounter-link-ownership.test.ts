/**
 * An encounter id arriving from a URL param is a CLAIM, not a fact.
 *
 * Two flows took `?encounterId=` at face value and drove TERMINAL transitions
 * with it — death registration (`deceased`) and ward admission (`admitted`).
 * A stale param surviving a patient swap (unlink → pick another patient, or
 * changing the admit form's patient select) therefore closed a different,
 * living patient's in-flight visit: they vanished from the worklist, the
 * resumable rail and checkout, and their record read as a death/admission
 * that never happened.
 *
 * `resolvePatientEncounter` is the single guard both paths now go through.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createEncounter,
  getEncounter,
  resolvePatientEncounter,
} from '@/lib/services/encounter-service';
import { admitPatient } from '@/lib/services/ward-service';

afterEach(async () => {
  await teardownTestDBs();
});

async function openVisit(patientId: string, hospitalId = 'hosp-001', orgId = 'org-moh-ss') {
  return createEncounter({
    patientId, patientName: `Patient ${patientId}`,
    clinicianId: 'user-dr-wani', clinicianName: 'Dr. Wani',
    hospitalId, orgId,
    status: 'with_clinician', snapshot: {}, labOrderIds: [],
    startedAt: new Date().toISOString(),
  } as never);
}

describe('resolvePatientEncounter', () => {
  it('resolves an encounter that belongs to the named patient', async () => {
    const enc = await openVisit('pat-A');
    expect((await resolvePatientEncounter(enc._id, 'pat-A'))?._id).toBe(enc._id);
  });

  it('refuses an encounter belonging to a DIFFERENT patient', async () => {
    const encA = await openVisit('pat-A');
    expect(await resolvePatientEncounter(encA._id, 'pat-B')).toBeNull();
  });

  it('refuses an encounter outside the caller org/facility scope', async () => {
    const enc = await openVisit('pat-A', 'hosp-999', 'org-other');
    const scope = { orgId: 'org-moh-ss', hospitalId: 'hosp-001', role: 'doctor' };
    expect(await resolvePatientEncounter(enc._id, 'pat-A', scope)).toBeNull();
    // …and admits it for the owning org.
    expect(await resolvePatientEncounter(enc._id, 'pat-A', {
      orgId: 'org-other', hospitalId: 'hosp-999', role: 'doctor',
    })).not.toBeNull();
  });

  it('refuses unknown / empty ids instead of throwing', async () => {
    expect(await resolvePatientEncounter('enc-nope', 'pat-A')).toBeNull();
    expect(await resolvePatientEncounter('', 'pat-A')).toBeNull();
    expect(await resolvePatientEncounter('enc-x', '')).toBeNull();
  });
});

describe('ward admission cannot close another patient visit', () => {
  const admitInput = (patientId: string, encounterId?: string) => ({
    patientId, patientName: `Patient ${patientId}`,
    admissionDate: new Date().toISOString(),
    admittingDiagnosis: 'Severe malaria',
    severity: 'severe' as const,
    admittedBy: 'user-dr-wani', admittedByName: 'Dr. Wani',
    wardId: 'ward-1', wardName: 'Medical Ward',
    facilityId: 'hosp-001', facilityName: 'Juba Teaching Hospital',
    state: 'Central Equatoria', orgId: 'org-moh-ss',
    encounterId,
  });

  it('drops a stale encounterId belonging to someone else, leaving their visit open', async () => {
    const encA = await openVisit('pat-A');           // a living patient, mid-consult
    const admission = await admitPatient(admitInput('pat-B', encA._id) as never);

    // The admission itself still succeeds…
    expect(admission.patientId).toBe('pat-B');
    // …but carries no borrowed lineage…
    expect(admission.encounterId).toBeUndefined();
    // …and patient A's visit is untouched.
    expect((await getEncounter(encA._id))?.status).toBe('with_clinician');
    expect((await getEncounter(encA._id))?.closedAt).toBeUndefined();
  });

  it('still closes the visit when the encounter really is the admitted patient', async () => {
    const encB = await openVisit('pat-B');
    const admission = await admitPatient(admitInput('pat-B', encB._id) as never);

    expect(admission.encounterId).toBe(encB._id);
    const after = await getEncounter(encB._id);
    expect(after?.status).toBe('admitted');
    expect(after?.closedAt).toBeTruthy();
  });
});
