/**
 * Clinical note lifecycle. These tests exist to prove the guarantees a clinical
 * record is worthless without:
 *
 *   - a signed note is locked: no edit, no delete, corrections are addenda;
 *   - an empty note cannot be signed (a signature must attest to something);
 *   - changing note type never discards narrative already written;
 *   - copy-forward carries the story but NOT stale observations.
 *
 * The DB is an in-memory fake rather than a mock returning fixed values, so the
 * lock and merge assertions check the real stored document afterwards.
 */
import {
  createClinicalNote, getClinicalNoteById, updateClinicalNote,
  saveNoteSection, addNoteSection, removeNoteSection, changeNoteType,
  clearNote, signClinicalNote, cosignClinicalNote, addNoteAddendum,
  copyNoteForward, recordPlanAction, listClinicalNotes, getNotesByPatient,
  getUnsignedNotes, deleteClinicalNote,
  hasContent, notePreview, isNoteLocked, NoteLockedError, NoteSigningAuthorizationError,
} from '@/lib/clinical-notes/note-service';
import type { ClinicalNoteDoc } from '@/lib/clinical-notes/types';
import type { DataScope } from '@/lib/services/data-scope';

let store: Record<string, ClinicalNoteDoc> = {};

const notesDb = {
  get: jest.fn(async (id: string) => {
    if (!store[id]) throw Object.assign(new Error('missing'), { status: 404 });
    return { ...store[id] };
  }),
  put: jest.fn(async (doc: ClinicalNoteDoc) => {
    store[doc._id] = { ...doc, _rev: `${Number((doc._rev || '0-x').split('-')[0]) + 1}-r` };
    return { rev: store[doc._id]._rev, id: doc._id };
  }),
  remove: jest.fn(async (doc: { _id: string }) => {
    delete store[doc._id];
    return { ok: true };
  }),
};

jest.mock('@/lib/db', () => ({ getDB: () => notesDb }));

jest.mock('@/lib/services/db-query', () => ({
  findByType: jest.fn(async (_db: unknown, _type: string, selector?: { patientId?: string }) =>
    Object.values(store).filter(n => !selector?.patientId || n.patientId === selector.patientId)),
}));

jest.mock('@/lib/services/audit-service', () => ({
  logAudit: jest.fn(async () => undefined),
  logAuditSafe: jest.fn(async () => undefined),
}));

jest.mock('@/lib/services/sync-event-service', () => ({ emitSyncEvent: jest.fn() }));

// The real scoping logic, not a passthrough stub — the tenancy tests below
// (`describe('scope / tenancy')`) need actual org/hospital filtering, and
// every other test in this file calls the service functions with no `scope`
// argument at all, so filterByScope never runs for them either way.
jest.mock('@/lib/services/data-scope', () => jest.requireActual('@/lib/services/data-scope'));

const baseInput = {
  patientId: 'pat-1',
  patientName: 'Deng Mabior',
  mrn: 'JTH-000001',
  noteType: 'soap' as const,
  serviceDate: '2026-08-04',
  serviceTime: '08:30',
  authorId: 'u-doc',
  authorName: 'Dr Achol',
  hospitalId: 'hosp-001',
};

beforeEach(() => {
  store = {};
  jest.clearAllMocks();
});

describe('creating a note', () => {
  it('seeds every section of the type so the editor has a shape to render', async () => {
    const note = await createClinicalNote(baseInput);
    expect(note.status).toBe('draft');
    expect(note.sections.map(s => s.sectionId)).toEqual([
      'cc', 'subjective', 'medications', 'allergies', 'mental_functional',
      'vitals', 'objective', 'assessment', 'plan',
    ]);
  });

  it('marks a telehealth note type as telehealth without being told', async () => {
    const note = await createClinicalNote({ ...baseInput, noteType: 'telehealth_soap' });
    expect(note.telehealth).toBe(true);
  });

  it('falls back to SOAP for an unrecognised type rather than creating a shapeless note', async () => {
    const note = await createClinicalNote({
      ...baseInput, noteType: 'nonsense' as unknown as 'soap',
    });
    expect(note.noteType).toBe('soap');
  });

  it('keeps pre-filled sections passed in at creation', async () => {
    const note = await createClinicalNote({
      ...baseInput,
      sections: [{ sectionId: 'vitals', snapshot: 'BP 150/90', snapshotAt: '2026-08-04T08:42:00Z' }],
    });
    expect(note.sections.find(s => s.sectionId === 'vitals')?.snapshot).toBe('BP 150/90');
  });
});

describe('editing a draft', () => {
  it('saves one section without disturbing the others', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache for two days.' });
    await saveNoteSection(note._id, 'plan', { text: 'Paracetamol PRN.' });

    const reloaded = await getClinicalNoteById(note._id);
    expect(reloaded!.sections.find(s => s.sectionId === 'cc')?.text).toBe('Headache for two days.');
    expect(reloaded!.sections.find(s => s.sectionId === 'plan')?.text).toBe('Paracetamol PRN.');
    expect(reloaded!.sections.find(s => s.sectionId === 'subjective')?.text).toBe('');
  });

  it('adds an optional section in its clinical position', async () => {
    const note = await createClinicalNote(baseInput);
    const updated = await addNoteSection(note._id, 'hpi');
    const ids = updated!.sections.map(s => s.sectionId);
    expect(ids).toContain('hpi');
    expect(ids.indexOf('hpi')).toBeLessThan(ids.indexOf('plan'));
  });

  it('removes a section the clinician added', async () => {
    const note = await createClinicalNote(baseInput);
    await addNoteSection(note._id, 'hpi');
    const updated = await removeNoteSection(note._id, 'hpi');
    expect(updated!.sections.map(s => s.sectionId)).not.toContain('hpi');
  });

  it('refuses to remove a section the type requires', async () => {
    const note = await createClinicalNote(baseInput);
    const updated = await removeNoteSection(note._id, 'plan');
    expect(updated!.sections.map(s => s.sectionId)).toContain('plan');
  });

  it('clears narrative but keeps the note and its identity', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    const cleared = await clearNote(note._id);
    expect(hasContent(cleared!)).toBe(false);
    expect(cleared!.patientName).toBe('Deng Mabior');
  });
});

describe('changing note type', () => {
  // Retyping is a correction of a mis-click, not a decision to discard work.
  it('never discards narrative that the new type has no section for', async () => {
    const note = await createClinicalNote({ ...baseInput, noteType: 'procedure' });
    await saveNoteSection(note._id, 'anesthesia', { text: 'Local lignocaine.' });

    const retyped = await changeNoteType(note._id, 'soap');
    const anesthesia = retyped!.sections.find(s => s.sectionId === 'anesthesia');
    expect(anesthesia?.text).toBe('Local lignocaine.');
    expect(retyped!.noteType).toBe('soap');
  });

  it('drops empty sections the new type does not use', async () => {
    const note = await createClinicalNote({ ...baseInput, noteType: 'procedure' });
    const retyped = await changeNoteType(note._id, 'soap');
    expect(retyped!.sections.map(s => s.sectionId)).not.toContain('anesthesia');
  });

  it('adopts telehealth when switching to a telehealth type', async () => {
    const note = await createClinicalNote(baseInput);
    const retyped = await changeNoteType(note._id, 'telehealth_soap');
    expect(retyped!.telehealth).toBe(true);
  });
});

describe('signing', () => {
  it('refuses to sign an empty note', async () => {
    const note = await createClinicalNote(baseInput);
    await expect(signClinicalNote(note._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' }))
      .rejects.toThrow(/empty note/i);
  });

  it('signs a note that has content and records who and when', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });

    const signed = await signClinicalNote(note._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' });
    expect(signed!.status).toBe('signed');
    expect(signed!.signedByName).toBe('Dr Achol');
    expect(signed!.signedAt).toBeTruthy();
    expect(isNoteLocked(signed!)).toBe(true);
  });

  it('locks the note against further edits', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    await signClinicalNote(note._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' });

    await expect(updateClinicalNote(note._id, { serviceDate: '2026-01-01' }))
      .rejects.toThrow(NoteLockedError);
    await expect(saveNoteSection(note._id, 'cc', { text: 'rewritten' }))
      .rejects.toThrow(NoteLockedError);
    await expect(addNoteSection(note._id, 'hpi')).rejects.toThrow(NoteLockedError);
    await expect(clearNote(note._id)).rejects.toThrow(NoteLockedError);
    await expect(changeNoteType(note._id, 'hp')).rejects.toThrow(NoteLockedError);
  });

  it('refuses to delete a signed note', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    await signClinicalNote(note._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' });

    await expect(deleteClinicalNote(note._id)).rejects.toThrow(NoteLockedError);
    expect(await getClinicalNoteById(note._id)).not.toBeNull();
  });

  it('deletes an unsigned draft', async () => {
    const note = await createClinicalNote(baseInput);
    expect(await deleteClinicalNote(note._id)).toBe(true);
    expect(await getClinicalNoteById(note._id)).toBeNull();
  });

  it('holds a trainee note for countersignature', async () => {
    // The intern is the note's own author/assignee, so she may sign her own
    // documented encounter even though `nurse` is not a provider role.
    const note = await createClinicalNote({ ...baseInput, authorId: 'u-intern', authorName: 'Dr Intern' });
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    const signed = await signClinicalNote(note._id, {
      signedBy: 'u-intern', signedByName: 'Dr Intern', signerRole: 'nurse', awaitingCosign: true,
    });
    expect(signed!.status).toBe('awaiting_cosign');

    const cosigned = await cosignClinicalNote(note._id, 'u-cons', 'Dr Consultant', 'doctor');
    expect(cosigned!.status).toBe('signed');
    expect(cosigned!.cosignedByName).toBe('Dr Consultant');
  });
});

describe('signing authorisation (KAN — anyone-can-sign-anyone\'s-note)', () => {
  async function draftAuthoredByDoc() {
    const note = await createClinicalNote(baseInput); // authorId: 'u-doc'
    await saveNoteSection(note._id, 'cc', { text: 'Headache, two days.' });
    return note._id;
  }

  it('refuses a signer who is neither the author nor the assignee and holds no provider role', async () => {
    // The exact defect scenario: a rooming nurse opens a doctor's draft and
    // presses Sign. She is not the author, not the assignee, and her role has
    // no standing attestation authority.
    const id = await draftAuthoredByDoc();
    await expect(signClinicalNote(id, {
      signedBy: 'u-rooming-nurse', signedByName: 'Nurse Akuc', signerRole: 'rooming_nurse',
    })).rejects.toThrow(NoteSigningAuthorizationError);

    // The note must not have locked — the attempt is rejected outright, not
    // silently accepted.
    const reloaded = await getClinicalNoteById(id);
    expect(reloaded!.status).toBe('draft');
    expect(reloaded!.signedBy).toBeUndefined();
  });

  it('refuses a signer with no identity/role information at all', async () => {
    const id = await draftAuthoredByDoc();
    await expect(signClinicalNote(id, { signedBy: '', signedByName: 'Unknown' }))
      .rejects.toThrow(NoteSigningAuthorizationError);
  });

  it('allows the note\'s assignee to sign even when they are not its author', async () => {
    const note = await createClinicalNote({
      ...baseInput, authorId: 'u-doc', assignedToId: 'u-covering-doc', assignedToName: 'Dr Covering',
    });
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    const signed = await signClinicalNote(note._id, {
      signedBy: 'u-covering-doc', signedByName: 'Dr Covering',
    });
    expect(signed!.status).toBe('signed');
  });

  it('allows a provider role to sign a note that names neither them as author nor assignee', async () => {
    // A supervising physician picking up an unassigned/legacy draft — the
    // "explicit attest permission" carve-out.
    const id = await draftAuthoredByDoc();
    const signed = await signClinicalNote(id, {
      signedBy: 'u-supervising-doc', signedByName: 'Dr Supervisor', signerRole: 'doctor',
    });
    expect(signed!.status).toBe('signed');
  });

  it('does not let a non-provider role sign someone else\'s note merely by claiming a clinical role name', async () => {
    const id = await draftAuthoredByDoc();
    await expect(signClinicalNote(id, {
      signedBy: 'u-triage-nurse', signedByName: 'Nurse Nyibol', signerRole: 'triage_nurse',
    })).rejects.toThrow(NoteSigningAuthorizationError);
  });

  it('refuses a co-signature from a non-supervisory role', async () => {
    const note = await createClinicalNote({ ...baseInput, authorId: 'u-intern' });
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    await signClinicalNote(note._id, {
      signedBy: 'u-intern', signedByName: 'Dr Intern', awaitingCosign: true,
    });

    await expect(cosignClinicalNote(note._id, 'u-rooming-nurse', 'Nurse Akuc', 'rooming_nurse'))
      .rejects.toThrow(NoteSigningAuthorizationError);
    await expect(cosignClinicalNote(note._id, 'u-someone', 'Someone'))
      .rejects.toThrow(NoteSigningAuthorizationError);

    const reloaded = await getClinicalNoteById(note._id);
    expect(reloaded!.status).toBe('awaiting_cosign');
  });

  it('refuses a co-signature from the same person who signed', async () => {
    const note = await createClinicalNote({ ...baseInput, authorId: 'u-intern' });
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    await signClinicalNote(note._id, {
      signedBy: 'u-intern', signedByName: 'Dr Intern', signerRole: 'doctor', awaitingCosign: true,
    });

    await expect(cosignClinicalNote(note._id, 'u-intern', 'Dr Intern', 'doctor'))
      .rejects.toThrow(NoteSigningAuthorizationError);
  });
});

describe('addenda', () => {
  async function signedNote() {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    await signClinicalNote(note._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' });
    return note._id;
  }

  it('appends a correction without altering the original narrative', async () => {
    const id = await signedNote();
    const amended = await addNoteAddendum(id, 'BP was 150/90, not 130/80.', 'u-doc', 'Dr Achol');

    expect(amended!.status).toBe('amended');
    expect(amended!.addenda).toHaveLength(1);
    expect(amended!.addenda![0].text).toBe('BP was 150/90, not 130/80.');
    // The original text is untouched — an inspector sees both.
    expect(amended!.sections.find(s => s.sectionId === 'cc')?.text).toBe('Headache.');
  });

  it('rejects an empty addendum', async () => {
    const id = await signedNote();
    await expect(addNoteAddendum(id, '   ', 'u-doc', 'Dr Achol')).rejects.toThrow(/needs text/i);
  });

  it('rejects an addendum on a draft — edit it instead', async () => {
    const note = await createClinicalNote(baseInput);
    await expect(addNoteAddendum(note._id, 'x', 'u-doc', 'Dr Achol'))
      .rejects.toThrow(/signed notes/i);
  });

  it('an amended note stays locked', async () => {
    const id = await signedNote();
    await addNoteAddendum(id, 'Correction.', 'u-doc', 'Dr Achol');
    await expect(saveNoteSection(id, 'cc', { text: 'nope' })).rejects.toThrow(NoteLockedError);
  });
});

describe('copy forward (SALT)', () => {
  it('carries the narrative into a new draft', async () => {
    const first = await createClinicalNote(baseInput);
    await saveNoteSection(first._id, 'cc', { text: 'Headache, ongoing.' });
    await saveNoteSection(first._id, 'plan', { text: 'Continue paracetamol.' });
    await signClinicalNote(first._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' });

    const next = await copyNoteForward(first._id, { ...baseInput, serviceDate: '2026-08-18' });

    expect(next!.status).toBe('draft');
    expect(next!.copiedFromId).toBe(first._id);
    expect(next!.serviceDate).toBe('2026-08-18');
    expect(next!.sections.find(s => s.sectionId === 'cc')?.text).toBe('Headache, ongoing.');
    expect(next!.sections.find(s => s.sectionId === 'plan')?.text).toBe('Continue paracetamol.');
  });

  // The clinical point of the rule: repeating last visit's vitals as if freshly
  // taken would be a fabricated observation.
  it('does not carry derived snapshots forward', async () => {
    const first = await createClinicalNote(baseInput);
    await saveNoteSection(first._id, 'cc', { text: 'Headache.' });
    await saveNoteSection(first._id, 'vitals', { snapshot: 'BP 150/90', snapshotAt: '2026-08-04T08:42:00Z' });

    const next = await copyNoteForward(first._id, { ...baseInput, serviceDate: '2026-08-18' });
    const vitals = next!.sections.find(s => s.sectionId === 'vitals');
    expect(vitals?.snapshot).toBeUndefined();
  });

  it('carries a section the new type does not declare', async () => {
    const first = await createClinicalNote({ ...baseInput, noteType: 'procedure' });
    await saveNoteSection(first._id, 'anesthesia', { text: 'Local lignocaine.' });

    const next = await copyNoteForward(first._id, { ...baseInput, serviceDate: '2026-08-18', noteType: 'soap' });
    expect(next!.sections.find(s => s.sectionId === 'anesthesia')?.text).toBe('Local lignocaine.');
  });

  it('returns null for a source that does not exist', async () => {
    expect(await copyNoteForward('nope', baseInput)).toBeNull();
  });
});

describe('plan actions', () => {
  it('records an order raised from the Plan section', async () => {
    const note = await createClinicalNote(baseInput);
    const updated = await recordPlanAction(note._id, {
      kind: 'lab', label: 'Malaria RDT', targetId: 'lab-99',
    });
    expect(updated!.planActions).toHaveLength(1);
    expect(updated!.planActions![0]).toMatchObject({ kind: 'lab', label: 'Malaria RDT', targetId: 'lab-99' });
  });

  it('refuses to attach an order to a signed note', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    await signClinicalNote(note._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' });
    await expect(recordPlanAction(note._id, { kind: 'lab', label: 'FBC' }))
      .rejects.toThrow(NoteLockedError);
  });
});

/**
 * Every mutator resolves an id against the DB before doing anything else. A
 * caller racing a delete, or acting on a stale id from a closed tab, must get
 * a clean `null` back rather than an exception that crashes the page — only
 * the *locked* and *authorisation* refusals below are meant to throw.
 */
describe('operating on a note id that does not exist', () => {
  const missing = 'note-does-not-exist';

  it('getClinicalNoteById', async () => {
    expect(await getClinicalNoteById(missing)).toBeNull();
  });

  it('updateClinicalNote', async () => {
    expect(await updateClinicalNote(missing, { serviceDate: '2026-01-01' })).toBeNull();
  });

  it('saveNoteSection', async () => {
    expect(await saveNoteSection(missing, 'cc', { text: 'x' })).toBeNull();
  });

  it('addNoteSection', async () => {
    expect(await addNoteSection(missing, 'hpi')).toBeNull();
  });

  it('removeNoteSection', async () => {
    expect(await removeNoteSection(missing, 'hpi')).toBeNull();
  });

  it('changeNoteType', async () => {
    expect(await changeNoteType(missing, 'soap')).toBeNull();
  });

  it('clearNote', async () => {
    expect(await clearNote(missing)).toBeNull();
  });

  it('recordPlanAction', async () => {
    expect(await recordPlanAction(missing, { kind: 'lab', label: 'FBC' })).toBeNull();
  });

  it('signClinicalNote', async () => {
    expect(await signClinicalNote(missing, { signedBy: 'u-doc', signedByName: 'Dr Achol' })).toBeNull();
  });

  it('cosignClinicalNote', async () => {
    expect(await cosignClinicalNote(missing, 'u-cons', 'Dr Consultant', 'doctor')).toBeNull();
  });

  it('addNoteAddendum', async () => {
    expect(await addNoteAddendum(missing, 'text', 'u-doc', 'Dr Achol')).toBeNull();
  });

  it('deleteClinicalNote resolves false rather than throwing', async () => {
    expect(await deleteClinicalNote(missing)).toBe(false);
  });
});

describe('listing and filters', () => {
  async function seed() {
    const a = await createClinicalNote({ ...baseInput, serviceDate: '2026-08-01' });
    await saveNoteSection(a._id, 'cc', { text: 'First visit.' });
    await signClinicalNote(a._id, { signedBy: 'u-doc', signedByName: 'Dr Achol' });

    const b = await createClinicalNote({ ...baseInput, serviceDate: '2026-08-10' });
    await saveNoteSection(b._id, 'cc', { text: 'Second visit.' });

    const c = await createClinicalNote({
      ...baseInput, patientId: 'pat-2', patientName: 'Other Patient',
      serviceDate: '2026-08-05', noteType: 'phone', authorId: 'u-nurse', authorName: 'Nurse Grace',
    });
    return { a: a._id, b: b._id, c: c._id };
  }

  it('sorts newest first by date of service', async () => {
    const { a, b } = await seed();
    const rows = await listClinicalNotes({ patientId: 'pat-1' });
    expect(rows.map(r => r._id)).toEqual([b, a]);
  });

  it('filters to one patient', async () => {
    await seed();
    const rows = await listClinicalNotes({ patientId: 'pat-1' });
    expect(rows.every(r => r.patientId === 'pat-1')).toBe(true);
  });

  it('filters unsigned', async () => {
    const { b } = await seed();
    const rows = await listClinicalNotes({ patientId: 'pat-1', display: 'unsigned' });
    expect(rows.map(r => r._id)).toEqual([b]);
  });

  it('filters signed', async () => {
    const { a } = await seed();
    const rows = await listClinicalNotes({ patientId: 'pat-1', display: 'signed' });
    expect(rows.map(r => r._id)).toEqual([a]);
  });

  it('filters by note type', async () => {
    const { c } = await seed();
    const rows = await listClinicalNotes({ noteType: 'phone' });
    expect(rows.map(r => r._id)).toEqual([c]);
  });

  it('filters by user, matching author or assignee', async () => {
    const { c } = await seed();
    const rows = await listClinicalNotes({ userId: 'u-nurse' });
    expect(rows.map(r => r._id)).toEqual([c]);
  });

  it('treats userId "all" as no filter', async () => {
    await seed();
    const rows = await listClinicalNotes({ userId: 'all' });
    expect(rows).toHaveLength(3);
  });
});

/**
 * Tenant isolation. `filterByScope` (the real implementation — see the
 * `data-scope` mock above) drops any document whose `orgId` does not match
 * the caller's `DataScope`, INCLUDING documents that carry no `orgId` at all.
 * A scope fix that hides everything is exactly as broken as one that hides
 * nothing, so every read here is asserted in both directions: the matching
 * org's note comes back, and the other org's note does not.
 */
describe('scope / tenancy', () => {
  const scopeOrgA: DataScope = { role: 'nurse', orgId: 'org-a' };
  const scopeOrgB: DataScope = { role: 'nurse', orgId: 'org-b' };

  async function seedTwoOrgs() {
    const a = await createClinicalNote({ ...baseInput, orgId: 'org-a' });
    await saveNoteSection(a._id, 'cc', { text: 'Org A visit.' });
    const b = await createClinicalNote({ ...baseInput, orgId: 'org-b' });
    await saveNoteSection(b._id, 'cc', { text: 'Org B visit.' });
    return { a: a._id, b: b._id };
  }

  test('createClinicalNote stamps orgId onto the stored document', async () => {
    // filterByScope drops any document with no orgId at all once a scope with
    // an orgId is applied — if this stamping regressed, every note would
    // silently vanish from every scoped list/get below despite belonging to
    // a real, known organisation.
    const note = await createClinicalNote({ ...baseInput, orgId: 'org-a' });
    expect(note.orgId).toBe('org-a');
    const reloaded = await getClinicalNoteById(note._id);
    expect(reloaded!.orgId).toBe('org-a');
  });

  test('a note created with no orgId at all is invisible to every org-scoped read', async () => {
    // This is `filterByScope`'s own documented behaviour (data isolation
    // favours hiding over leaking), exercised here through the notes module
    // so a regression in orgId-stamping is caught where it would actually
    // bite: the chart's own notes list.
    const orphan = await createClinicalNote({ ...baseInput, orgId: undefined });
    expect(await getClinicalNoteById(orphan._id, scopeOrgA)).toBeNull();
    const rows = await getNotesByPatient(orphan.patientId, scopeOrgA);
    expect(rows.map(r => r._id)).not.toContain(orphan._id);
  });

  describe('getClinicalNoteById', () => {
    test('returns the note when its orgId matches the scope', async () => {
      const { a } = await seedTwoOrgs();
      const found = await getClinicalNoteById(a, scopeOrgA);
      expect(found).not.toBeNull();
      expect(found!._id).toBe(a);
    });

    test('returns null for a note whose orgId does not match the scope', async () => {
      const { b } = await seedTwoOrgs();
      expect(await getClinicalNoteById(b, scopeOrgA)).toBeNull();
    });
  });

  describe('getNotesByPatient', () => {
    test('scopes to org A in both directions: keeps A\'s note, drops B\'s', async () => {
      // Both notes are for the same patient — only the org boundary should
      // decide what comes back.
      const { a, b } = await seedTwoOrgs();
      const rows = await getNotesByPatient(baseInput.patientId, scopeOrgA);
      const ids = rows.map(r => r._id);
      expect(ids).toContain(a);
      expect(ids).not.toContain(b);
    });

    test('scopes to org B in both directions: a scope bug that hides everything is as broken as one that hides nothing', async () => {
      const { a, b } = await seedTwoOrgs();
      const rows = await getNotesByPatient(baseInput.patientId, scopeOrgB);
      const ids = rows.map(r => r._id);
      expect(ids).toContain(b);
      expect(ids).not.toContain(a);
    });
  });

  describe('listClinicalNotes', () => {
    test('scopes the chart notes list by org in both directions', async () => {
      const { a, b } = await seedTwoOrgs();
      const rows = await listClinicalNotes({ patientId: baseInput.patientId }, scopeOrgA);
      const ids = rows.map(r => r._id);
      expect(ids).toContain(a);
      expect(ids).not.toContain(b);
    });

    test('without a patient filter, still only ever returns the scoped org', async () => {
      const { a, b } = await seedTwoOrgs();
      const rows = await listClinicalNotes({}, scopeOrgA);
      const ids = rows.map(r => r._id);
      expect(ids).toContain(a);
      expect(ids).not.toContain(b);
    });
  });

  describe('getUnsignedNotes', () => {
    test('a signing queue only ever shows the caller\'s own org', async () => {
      const a = await createClinicalNote({ ...baseInput, orgId: 'org-a' });
      await saveNoteSection(a._id, 'cc', { text: 'Needs a signature.' });
      const b = await createClinicalNote({ ...baseInput, orgId: 'org-b' });
      await saveNoteSection(b._id, 'cc', { text: 'Also needs a signature.' });

      const rows = await getUnsignedNotes(undefined, scopeOrgA);
      const ids = rows.map(r => r._id);
      expect(ids).toContain(a._id);
      expect(ids).not.toContain(b._id);
    });

    test('the other org\'s queue is not empty either — it just sees its own note', async () => {
      const a = await createClinicalNote({ ...baseInput, orgId: 'org-a' });
      await saveNoteSection(a._id, 'cc', { text: 'Needs a signature.' });
      const b = await createClinicalNote({ ...baseInput, orgId: 'org-b' });
      await saveNoteSection(b._id, 'cc', { text: 'Also needs a signature.' });

      const rows = await getUnsignedNotes(undefined, scopeOrgB);
      const ids = rows.map(r => r._id);
      expect(ids).toContain(b._id);
      expect(ids).not.toContain(a._id);
    });
  });
});

describe('preview helpers', () => {
  it('shows the first narrative it finds', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Patient presents with a headache.' });
    const reloaded = await getClinicalNoteById(note._id);
    expect(notePreview(reloaded!)).toBe('Patient presents with a headache.');
  });

  it('says so when there is nothing yet', async () => {
    const note = await createClinicalNote(baseInput);
    expect(notePreview(note)).toBe('No content yet');
  });

  it('truncates a long narrative', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'x'.repeat(400) });
    const reloaded = await getClinicalNoteById(note._id);
    expect(notePreview(reloaded!, 50).length).toBeLessThanOrEqual(50);
  });

  it('ignores template markers when judging emptiness', async () => {
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: '<!--template--><!--/template-->' });
    const reloaded = await getClinicalNoteById(note._id);
    expect(hasContent(reloaded!)).toBe(false);
  });
});
