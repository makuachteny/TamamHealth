/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Internal patient-transfer workflow.
 *
 * The assertions here are mostly about what must NOT happen — ownership must
 * not move before acceptance, a rejection must not touch the chart, an expired
 * grant must not still read as access. Those are the failure modes that put the
 * wrong clinician's name against a patient.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-xfer-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { patientsDB, clinicianTasksDB } from '@/lib/db';
import {
  createTransferRequest,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
  completeTransfer,
  forceTransfer,
  applyDueTransfers,
  getTransfersByPatient,
  getIncomingTransfers,
  getOverdueTransfers,
  activeCareTeam,
  ownerAt,
  defaultChecklist,
  isTransferOverdue,
  TransferValidationError,
} from '@/lib/services/patient-transfer-service';
import type { PatientDoc, ClinicianTaskDoc } from '@/lib/db-types';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const sender = { id: 'doc-1', name: 'Dr Achol', role: 'doctor' as const };
const receiver = { id: 'doc-2', name: 'Dr Bol', role: 'doctor' as const };

async function seedPatient(overrides: Partial<PatientDoc> = {}): Promise<PatientDoc> {
  const now = new Date().toISOString();
  const doc = {
    _id: 'pat-1',
    type: 'patient',
    hospitalNumber: 'HN-001',
    firstName: 'Akol',
    middleName: '',
    surname: 'Deng',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    phone: '0900000000',
    state: 'Central Equatoria',
    county: 'Juba',
    tribe: 'Dinka',
    primaryLanguage: 'Dinka',
    bloodType: 'O+',
    allergies: ['Penicillin'],
    chronicConditions: [],
    nokName: 'Mary',
    nokRelationship: 'Sister',
    nokPhone: '0911111111',
    registrationHospital: 'hosp-1',
    registrationDate: '2020-01-01',
    lastVisitDate: '2026-01-01',
    lastVisitHospital: 'hosp-1',
    assignedDoctor: 'doc-1',
    assignedDoctorName: 'Dr Achol',
    assignedDepartment: 'General Medicine',
    isActive: true,
    orgId: 'org-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as PatientDoc;
  await patientsDB().put(doc);
  return (await patientsDB().get('pat-1')) as PatientDoc;
}

const doneChecklist = () => defaultChecklist().map(i => ({ ...i, done: true }));

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    patientId: 'pat-1',
    patientName: 'Akol Deng',
    from: { providerId: 'doc-1', providerName: 'Dr Achol', department: 'General Medicine', facilityId: 'hosp-1' },
    to: { providerId: 'doc-2', providerName: 'Dr Bol', department: 'Cardiology' },
    reason: 'Needs cardiology follow-up',
    checklist: doneChecklist(),
    orgId: 'org-1',
    hospitalId: 'hosp-1',
    actor: sender,
    ...overrides,
  };
}

describe('request → accept → complete', () => {
  test('a requested transfer does not move ownership until it is accepted', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());

    expect(t.status).toBe('requested');
    // The whole point of the request/accept workflow: the chart is untouched.
    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-1');
    expect(patient.assignedDoctorName).toBe('Dr Achol');
  });

  test('accepting an immediate transfer completes it and moves ownership', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());
    const accepted = await acceptTransfer(t._id, receiver);

    expect(accepted?.status).toBe('completed');
    expect(accepted?.completedAt).toBeTruthy();

    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-2');
    expect(patient.assignedDoctorName).toBe('Dr Bol');
    expect(patient.assignedDepartment).toBe('Cardiology');
  });

  test('every state change appends an event and nothing is rewritten', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());
    const done = await acceptTransfer(t._id, receiver);

    const kinds = done!.events.map(e => e.kind);
    expect(kinds).toEqual(expect.arrayContaining([
      'TRANSFER_REQUESTED', 'TRANSFER_ACCEPTED', 'TRANSFER_COMPLETED',
    ]));
    // The original request event survives verbatim through both transitions.
    const requested = done!.events.find(e => e.kind === 'TRANSFER_REQUESTED');
    expect(requested?.actorId).toBe('doc-1');
    expect(requested?.reason).toBe('Needs cardiology follow-up');
    // The completion event records both ends, which is what makes the history
    // answerable after the fact.
    const completed = done!.events.find(e => e.kind === 'TRANSFER_COMPLETED');
    expect(completed?.fromAssignment?.providerId).toBe('doc-1');
    expect(completed?.toAssignment?.providerId).toBe('doc-2');
  });

  test('a rejected transfer leaves the chart completely untouched', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());
    const rejected = await rejectTransfer(t._id, receiver, 'No cardiology capacity this week');

    expect(rejected?.status).toBe('rejected');
    expect(rejected?.decisionNotes).toBe('No cardiology capacity this week');
    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-1');
  });

  test('rejecting without a reason is refused', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());
    await expect(rejectTransfer(t._id, receiver, '   ')).rejects.toThrow(TransferValidationError);
  });

  test('a cancelled transfer cannot then be accepted', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());
    await cancelTransfer(t._id, sender, 'Patient discharged instead');
    await expect(acceptTransfer(t._id, receiver)).rejects.toThrow(TransferValidationError);

    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-1');
  });

  test('the accepting clinician is named on a department-addressed transfer', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({
      to: { department: 'Cardiology' },
    }));
    const done = await acceptTransfer(t._id, receiver);

    expect(done?.to.providerId).toBe('doc-2');
    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-2');
  });
});

describe('concurrency', () => {
  test('two clinicians accepting at once cannot both take the patient', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({ to: { department: 'Cardiology' } }));

    // Both read the pending transfer, then both try to accept. Exactly one may
    // win: a double-accept would leave two clinicians each believing the
    // patient is theirs, with the chart naming only the later writer.
    const results = await Promise.allSettled([
      acceptTransfer(t._id, { id: 'doc-2', name: 'Dr Bol', role: 'doctor' }),
      acceptTransfer(t._id, { id: 'doc-3', name: 'Dr Chol', role: 'doctor' }),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const final = (await getTransfersByPatient('pat-1'))[0];
    expect(final.status).toBe('completed');
    // Whoever won, the chart and the transfer record agree on one owner.
    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe(final.to.providerId);
    expect(['doc-2', 'doc-3']).toContain(patient.assignedDoctor);
  });

  test('a second completion of the same transfer is refused', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());
    await acceptTransfer(t._id, receiver);
    // Already completed by the accept; completing again must not re-apply.
    await expect(completeTransfer(t._id, receiver)).rejects.toThrow(TransferValidationError);
  });
});

describe('validation gates', () => {
  test('an incomplete required checklist blocks sending but allows a draft', async () => {
    await seedPatient();
    await expect(createTransferRequest(baseInput({ checklist: defaultChecklist() })))
      .rejects.toThrow(/checklist/i);

    const draft = await createTransferRequest(baseInput({
      checklist: defaultChecklist(), asDraft: true,
    }));
    expect(draft.status).toBe('draft');
    expect(draft.requestedAt).toBeUndefined();
  });

  test('a transfer with no reason or no destination is refused', async () => {
    await seedPatient();
    await expect(createTransferRequest(baseInput({ reason: '  ' })))
      .rejects.toThrow(TransferValidationError);
    await expect(createTransferRequest(baseInput({ to: {} })))
      .rejects.toThrow(TransferValidationError);
  });

  test('a transfer to the current assignment is refused as a no-op', async () => {
    await seedPatient();
    await expect(createTransferRequest(baseInput({
      to: { providerId: 'doc-1', department: 'General Medicine', facilityId: 'hosp-1' },
    }))).rejects.toThrow(/same as the current assignment/i);
  });

  test('a caller cannot defeat the checklist gate by dropping required items', async () => {
    await seedPatient();
    // A hand-rolled checklist that simply omits the required rows, or demotes
    // them to optional, must not sail through the gate.
    await expect(createTransferRequest(baseInput({
      checklist: [{ key: 'care_plan_reviewed', label: 'Care plan reviewed', required: false, done: true }],
    }))).rejects.toThrow(/checklist/i);

    await expect(createTransferRequest(baseInput({
      checklist: [
        { key: 'medications_reviewed', label: 'Medications reviewed', required: false, done: false },
        { key: 'open_tasks_reviewed', label: 'Open tasks reviewed', required: false, done: false },
        { key: 'reason_documented', label: 'Reason documented', required: false, done: false },
      ],
    }))).rejects.toThrow(/checklist/i);
  });

  test('the stored checklist keeps canonical labels and required flags', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({
      checklist: doneChecklist().map(i => ({ ...i, label: 'Attacker label', required: false })),
    }));
    const required = t.checklist!.filter(i => i.required).map(i => i.key).sort();
    expect(required).toEqual(['medications_reviewed', 'open_tasks_reviewed', 'reason_documented']);
    expect(t.checklist!.every(i => i.label !== 'Attacker label')).toBe(true);
  });

  test('unknown transfer types and urgencies are rejected, not defaulted', async () => {
    await seedPatient();
    await expect(createTransferRequest(baseInput({
      transferType: 'sneaky' as never,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }))).rejects.toThrow(/Unknown transfer type/i);
    await expect(createTransferRequest(baseInput({ urgency: 'whenever' as never })))
      .rejects.toThrow(/Unknown urgency/i);
    await expect(createTransferRequest(baseInput({ effectiveAt: 'not-a-date' })))
      .rejects.toThrow(/Invalid effectiveAt/i);
  });

  test('temporary and shared-care transfers require an end date', async () => {
    await seedPatient();
    await expect(createTransferRequest(baseInput({ transferType: 'temporary' })))
      .rejects.toThrow(/end date/i);
    await expect(createTransferRequest(baseInput({ transferType: 'shared_care' })))
      .rejects.toThrow(/end date/i);
  });
});

describe('shared care and temporary transfers', () => {
  test('shared care adds a care-team member without moving ownership', async () => {
    await seedPatient();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const t = await createTransferRequest(baseInput({
      transferType: 'shared_care', expiresAt,
    }));
    await acceptTransfer(t._id, receiver);

    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-1'); // ownership unchanged
    expect(patient.careTeam).toHaveLength(1);
    expect(patient.careTeam?.[0]).toMatchObject({ providerId: 'doc-2', role: 'consult' });
  });

  test('a temporary transfer parks the previous owner and hands the patient back on expiry', async () => {
    await seedPatient();
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const t = await createTransferRequest(baseInput({
      transferType: 'temporary', expiresAt,
    }));
    await acceptTransfer(t._id, receiver);

    let patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-2');
    expect(patient.careTeam?.find(m => m.role === 'previous_owner')?.providerId).toBe('doc-1');

    // Wind the clock past the expiry and sweep.
    const later = new Date(Date.now() + 2 * 3600_000);
    const result = await applyDueTransfers(later);
    expect(result.expired).toContain(t._id);

    patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-1');
    expect(patient.assignedDoctorName).toBe('Dr Achol');
    expect(patient.careTeam ?? []).toHaveLength(0);
  });

  test('an expired grant is not reported as active access', async () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();
    const patient = {
      careTeam: [
        { providerId: 'a', role: 'consult' as const, grantedAt: past, expiresAt: past },
        { providerId: 'b', role: 'consult' as const, grantedAt: past, expiresAt: future },
        { providerId: 'c', role: 'consult' as const, grantedAt: past },
      ],
    };
    expect(activeCareTeam(patient).map(m => m.providerId)).toEqual(['b', 'c']);
  });
});

describe('scheduled transfers', () => {
  test('a future-dated transfer waits in accepted until its date arrives', async () => {
    await seedPatient();
    const effectiveAt = new Date(Date.now() + 86_400_000).toISOString();
    const t = await createTransferRequest(baseInput({ effectiveAt }));
    const accepted = await acceptTransfer(t._id, receiver);

    expect(accepted?.status).toBe('accepted');
    let patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-1'); // not yet in effect

    // Sweeping before the date changes nothing.
    expect((await applyDueTransfers(new Date())).completed).toHaveLength(0);

    const after = new Date(Date.now() + 2 * 86_400_000);
    expect((await applyDueTransfers(after)).completed).toContain(t._id);
    patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-2');
  });

  test('the sweep reports failures instead of swallowing them', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({
      effectiveAt: new Date(Date.now() + 3600_000).toISOString(),
    }));
    await acceptTransfer(t._id, receiver);

    // Delete the patient out from under the accepted transfer. The sweep must
    // surface this rather than reporting a clean run — a silent failure here
    // means a scheduled transfer never lands and nobody ever finds out.
    const patient = await patientsDB().get('pat-1');
    await patientsDB().remove(patient as { _id: string; _rev: string });

    const result = await applyDueTransfers(new Date(Date.now() + 2 * 3600_000));
    expect(result.completed).toHaveLength(0);
    expect(result.failed.map(f => f.id)).toContain(t._id);
    expect(result.failed[0].error).toBeTruthy();
  });

  test('a clean sweep reports no failures', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({
      effectiveAt: new Date(Date.now() + 3600_000).toISOString(),
    }));
    await acceptTransfer(t._id, receiver);

    const result = await applyDueTransfers(new Date(Date.now() + 2 * 3600_000));
    expect(result.completed).toContain(t._id);
    expect(result.failed).toEqual([]);
  });

  test('the sweep is idempotent — a second run repeats nothing', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({
      effectiveAt: new Date(Date.now() + 3600_000).toISOString(),
    }));
    await acceptTransfer(t._id, receiver);

    const at = new Date(Date.now() + 2 * 3600_000);
    expect((await applyDueTransfers(at)).completed).toContain(t._id);
    // The cron runs hourly against the same data; a second pass must be a no-op
    // rather than re-applying the assignment or logging a failure.
    const second = await applyDueTransfers(at);
    expect(second.completed).toHaveLength(0);
    expect(second.failed).toEqual([]);
  });

  test('auto-complete can be turned off so arrival is confirmed by hand', async () => {
    await seedPatient();
    const effectiveAt = new Date(Date.now() + 3600_000).toISOString();
    const t = await createTransferRequest(baseInput({
      effectiveAt, autoCompleteOnEffectiveDate: false,
    }));
    await acceptTransfer(t._id, receiver);

    const after = new Date(Date.now() + 2 * 3600_000);
    expect((await applyDueTransfers(after)).completed).toHaveLength(0);

    const done = await completeTransfer(t._id, receiver);
    expect(done?.status).toBe('completed');
    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-2');
  });
});

describe('task hand-off', () => {
  test('open tasks move to the receiving provider; completed ones stay put', async () => {
    await seedPatient();
    const now = new Date().toISOString();
    const mkTask = (id: string, status: 'open' | 'completed') => ({
      _id: id,
      type: 'clinician_task',
      userId: 'doc-1',
      title: `Task ${id}`,
      status,
      patientId: 'pat-1',
      createdAt: now,
      updatedAt: now,
    } as unknown as ClinicianTaskDoc);
    await clinicianTasksDB().put(mkTask('task-open', 'open'));
    await clinicianTasksDB().put(mkTask('task-done', 'completed'));

    const t = await createTransferRequest(baseInput());
    const done = await acceptTransfer(t._id, receiver);

    expect(done?.reassignedTaskIds).toEqual(['task-open']);
    expect(((await clinicianTasksDB().get('task-open')) as ClinicianTaskDoc).userId).toBe('doc-2');
    expect(((await clinicianTasksDB().get('task-done')) as ClinicianTaskDoc).userId).toBe('doc-1');
  });

  test('shared care does not move the owner’s tasks', async () => {
    await seedPatient();
    const now = new Date().toISOString();
    await clinicianTasksDB().put({
      _id: 'task-1', type: 'clinician_task', userId: 'doc-1', title: 'Chase result',
      status: 'open', patientId: 'pat-1', createdAt: now, updatedAt: now,
    } as unknown as ClinicianTaskDoc);

    const t = await createTransferRequest(baseInput({
      transferType: 'shared_care',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }));
    await acceptTransfer(t._id, receiver);

    expect(((await clinicianTasksDB().get('task-1')) as ClinicianTaskDoc).userId).toBe('doc-1');
  });
});

describe('forced (direct) transfers', () => {
  test('a forced transfer applies immediately and is flagged as forced', async () => {
    await seedPatient();
    const t = await forceTransfer(baseInput({
      actor: { id: 'admin-1', name: 'Org Admin', role: 'org_admin' as const },
    }));

    expect(t.forced).toBe(true);
    expect(t.status).toBe('completed');
    expect(t.events.map(e => e.kind)).toContain('TRANSFER_REASSIGNED');
    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-2');
  });
});

describe('queries', () => {
  test('the inbox matches personally-addressed and department-addressed requests', async () => {
    await seedPatient();
    await createTransferRequest(baseInput());
    await createTransferRequest(baseInput({
      to: { department: 'Cardiology', facilityId: 'hosp-1' },
    }));
    await createTransferRequest(baseInput({
      to: { providerId: 'doc-9', providerName: 'Dr Other' },
    }));

    const inbox = await getIncomingTransfers({
      id: 'doc-2', department: 'Cardiology', hospitalId: 'hosp-1', role: 'doctor',
    });
    expect(inbox).toHaveLength(2);

    const other = await getIncomingTransfers({
      id: 'doc-9', department: 'Surgery', hospitalId: 'hosp-1', role: 'doctor',
    });
    expect(other).toHaveLength(1);
  });

  test('a clinician at the RECEIVING facility can see a transfer addressed to them', async () => {
    // The scope filter is the tenant barrier for every read. A cross-facility
    // transfer whose only facility tie is the sending hospital is invisible to
    // the receiving side — their inbox stays empty, no notification fires, and
    // the request silently times out. This is the referral `toHospitalId`
    // problem in a new document type.
    await seedPatient();
    const t = await createTransferRequest(baseInput({
      to: { providerId: 'doc-2', providerName: 'Dr Bol', facilityId: 'hosp-2' },
    }));
    expect(t.hospitalId).toBe('hosp-1');

    const receivingScope = {
      orgId: 'org-1',
      hospitalId: 'hosp-2',
      role: 'doctor' as const,
    };
    const visible = await getTransfersByPatient('pat-1', receivingScope);
    expect(visible.map(x => x._id)).toContain(t._id);

    const inbox = await getIncomingTransfers(
      { id: 'doc-2', hospitalId: 'hosp-2', role: 'doctor' },
      receivingScope,
    );
    expect(inbox.map(x => x._id)).toContain(t._id);
  });

  test('toOrgId is set only for a genuine cross-org transfer', async () => {
    await seedPatient();
    // Same org → no cross-tenant grant written.
    const sameOrg = await createTransferRequest(baseInput({
      to: { providerId: 'doc-2', facilityId: 'hosp-2', orgId: 'org-1' },
    }));
    expect(sameOrg.toOrgId).toBeUndefined();

    // Genuinely different org → the receiving tenant can see it.
    const crossOrg = await createTransferRequest(baseInput({
      to: { providerId: 'doc-9', facilityId: 'hosp-9', orgId: 'org-2' },
    }));
    expect(crossOrg.toOrgId).toBe('org-2');
    const otherTenant = await getTransfersByPatient('pat-1', {
      orgId: 'org-2', hospitalId: 'hosp-9', role: 'doctor',
    });
    expect(otherTenant.map(x => x._id)).toEqual([crossOrg._id]);
  });

  test('an unsent draft is visible only to its author', async () => {
    await seedPatient();
    const draft = await createTransferRequest(baseInput({
      checklist: defaultChecklist(), asDraft: true,
    }));
    const sent = await createTransferRequest(baseInput({
      to: { providerId: 'doc-4', providerName: 'Dr Deng' },
    }));

    // The author sees both.
    const mine = await getTransfersByPatient('pat-1', undefined, 'doc-1');
    expect(mine.map(x => x._id).sort()).toEqual([draft._id, sent._id].sort());

    // A colleague opening the same chart sees only the real request — a
    // half-composed draft must not read as "a transfer is in progress".
    const theirs = await getTransfersByPatient('pat-1', undefined, 'doc-2');
    expect(theirs.map(x => x._id)).toEqual([sent._id]);

    // Server-side callers (the sweep) pass no viewer and still see everything.
    expect((await getTransfersByPatient('pat-1')).length).toBe(2);
  });

  test('a transfer stays invisible to an unrelated facility', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({
      to: { providerId: 'doc-2', providerName: 'Dr Bol', facilityId: 'hosp-2' },
    }));
    const strangerScope = { orgId: 'org-1', hospitalId: 'hosp-9', role: 'doctor' as const };
    const visible = await getTransfersByPatient('pat-1', strangerScope);
    expect(visible.map(x => x._id)).not.toContain(t._id);
  });

  test('an unanswered urgent request breaches its SLA; an answered one never does', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput({ urgency: 'emergency' }));

    expect(isTransferOverdue(t, new Date(Date.now() + 3600_000))).toBe(false);
    expect(isTransferOverdue(t, new Date(Date.now() + 3 * 3600_000))).toBe(true);

    const overdue = await getOverdueTransfers(undefined, new Date(Date.now() + 3 * 3600_000));
    expect(overdue.map(x => x._id)).toContain(t._id);

    await acceptTransfer(t._id, receiver);
    const after = await getOverdueTransfers(undefined, new Date(Date.now() + 9 * 3600_000));
    expect(after).toHaveLength(0);
  });

  test('ownerAt answers who was responsible on a given date', async () => {
    await seedPatient();
    const t = await createTransferRequest(baseInput());
    await acceptTransfer(t._id, receiver);
    const rows = await getTransfersByPatient('pat-1');

    // Before the move, the sending clinician held the patient; after it, the
    // receiver does. This is the question an incident review opens with.
    expect(ownerAt(rows, new Date(Date.now() - 86_400_000))?.providerId).toBe('doc-1');
    expect(ownerAt(rows, new Date(Date.now() + 1000))?.providerId).toBe('doc-2');
  });

  test('ownerAt hands the patient back after a temporary transfer lapses', async () => {
    await seedPatient();
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const t = await createTransferRequest(baseInput({ transferType: 'temporary', expiresAt }));
    await acceptTransfer(t._id, receiver);
    await applyDueTransfers(new Date(Date.now() + 2 * 3600_000));

    const rows = await getTransfersByPatient('pat-1');
    // During the cover window the temporary holder is accountable…
    expect(ownerAt(rows, new Date(Date.now() + 60_000))?.providerId).toBe('doc-2');
    // …and once it lapses, accountability is back with the original owner.
    expect(ownerAt(rows, new Date(Date.now() + 3 * 3600_000))?.providerId).toBe('doc-1');
  });

  test('a lapse does not undo a later deliberate transfer', async () => {
    await seedPatient();
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const temp = await createTransferRequest(baseInput({ transferType: 'temporary', expiresAt }));
    await acceptTransfer(temp._id, receiver);

    // Ownership moves on to a third clinician before the cover lapses.
    const onward = await createTransferRequest(baseInput({
      from: { providerId: 'doc-2', providerName: 'Dr Bol' },
      to: { providerId: 'doc-3', providerName: 'Dr Chol' },
      reason: 'Transferred onward to surgery',
    }));
    await acceptTransfer(onward._id, { id: 'doc-3', name: 'Dr Chol', role: 'doctor' });
    await applyDueTransfers(new Date(Date.now() + 2 * 3600_000));

    const rows = await getTransfersByPatient('pat-1');
    expect(ownerAt(rows, new Date(Date.now() + 3 * 3600_000))?.providerId).toBe('doc-3');
    const patient = await patientsDB().get('pat-1') as PatientDoc;
    expect(patient.assignedDoctor).toBe('doc-3');
  });

  test('the hand-off summary snapshots allergies and risk flags from the chart', async () => {
    await seedPatient({
      careAlerts: [
        { id: 'ca-1', category: 'safety', message: 'Falls risk', priority: 'high', status: 'active', recordedAt: new Date().toISOString() },
        { id: 'ca-2', category: 'safety', message: 'Resolved thing', priority: 'normal', status: 'resolved', recordedAt: new Date().toISOString() },
      ],
    } as Partial<PatientDoc>);

    const t = await createTransferRequest(baseInput());
    expect(t.summary?.allergies).toContain('Penicillin');
    expect(t.summary?.riskFlags).toEqual(['Falls risk']);
  });
});
