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
  copyNoteForward, recordPlanAction, listClinicalNotes, deleteClinicalNote,
  hasContent, notePreview, isNoteLocked, NoteLockedError,
} from '@/lib/clinical-notes/note-service';
import type { ClinicalNoteDoc } from '@/lib/clinical-notes/types';

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

jest.mock('@/lib/services/data-scope', () => ({
  filterByScope: (rows: unknown[]) => rows,
  buildScopeFromAuth: () => ({}),
}));

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
    const note = await createClinicalNote(baseInput);
    await saveNoteSection(note._id, 'cc', { text: 'Headache.' });
    const signed = await signClinicalNote(note._id, {
      signedBy: 'u-intern', signedByName: 'Dr Intern', awaitingCosign: true,
    });
    expect(signed!.status).toBe('awaiting_cosign');

    const cosigned = await cosignClinicalNote(note._id, 'u-cons', 'Dr Consultant');
    expect(cosigned!.status).toBe('signed');
    expect(cosigned!.cosignedByName).toBe('Dr Consultant');
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
