/**
 * NotesList — the chart's Notes view and the standalone /notes queue.
 * Not Modal-wrapped, so it renders directly into the mount container.
 */
import { mountAndFlush, click, clickAsync, actFlush, setSelect, q, qa } from './test-utils';
import type { ClinicalNoteDoc } from '@/lib/clinical-notes/types';

const listClinicalNotes = jest.fn();
const createClinicalNote = jest.fn();
const deleteClinicalNote = jest.fn();
const push = jest.fn();
const showToast = jest.fn();

jest.mock('@/lib/clinical-notes/note-service', () => {
  const actual = jest.requireActual('@/lib/clinical-notes/note-service');
  return {
    ...actual,
    listClinicalNotes: (...a: unknown[]) => listClinicalNotes(...a),
    createClinicalNote: (...a: unknown[]) => createClinicalNote(...a),
    deleteClinicalNote: (...a: unknown[]) => deleteClinicalNote(...a),
  };
});
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));
// A stable reference matters: the real hook memoizes on the user's identity
// fields, and NotesList's load() effect depends on `scope` — a fresh object
// literal every render would retrigger the effect every render (infinite
// fetch loop) exactly the way an unmemoized real hook would.
const SCOPE = { orgId: 'org1', hospitalId: 'h1', role: 'clinical_officer' };
jest.mock('@/lib/hooks/useDataScope', () => ({ useDataScope: () => SCOPE }));

import NotesList from '@/components/clinical-notes/NotesList';

const CURRENT_USER = {
  _id: 'u1', name: 'Deng Mabior Kuol', hospitalId: 'h1', hospitalName: 'Juba Hospital', orgId: 'org1',
};

function note(over: Partial<ClinicalNoteDoc> = {}): ClinicalNoteDoc {
  return {
    _id: 'n1', type: 'clinical_note', patientId: 'pt1', patientName: 'Test Patient',
    noteType: 'soap', serviceDate: '2026-08-01', status: 'draft',
    sections: [{ sectionId: 'subjective', text: 'Headache for 2 days.' }],
    createdAt: '2026-08-01', updatedAt: '2026-08-01',
    ...over,
  } as ClinicalNoteDoc;
}

describe('NotesList', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(window, 'confirm'); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('loads notes for the patient on mount and renders a preview line', async () => {
    listClinicalNotes.mockResolvedValue([note()]);
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} />,
    );
    expect(listClinicalNotes).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'pt1' }),
      { orgId: 'org1', hospitalId: 'h1', role: 'clinical_officer' },
    );
    expect(container.textContent).toContain('Headache for 2 days.');
    unmount();
  });

  it('shows the empty state when there are no matching notes', async () => {
    listClinicalNotes.mockResolvedValue([]);
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} />,
    );
    expect(container.textContent).toContain('No notes match these filters.');
    unmount();
  });

  it('counts and calls out unsigned notes', async () => {
    listClinicalNotes.mockResolvedValue([
      note({ _id: 'a', status: 'draft' }),
      note({ _id: 'b', status: 'signed' }),
      note({ _id: 'c', status: 'awaiting_cosign' }),
    ]);
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} />,
    );
    expect(container.textContent).toContain('2 unsigned notes — unsigned notes are not');
    unmount();
  });

  it('a signed note is labelled "View" and offers no delete; a draft is "Open" with a delete control', async () => {
    listClinicalNotes.mockResolvedValue([
      note({ _id: 'signed', status: 'signed' }),
      note({ _id: 'draft', status: 'draft' }),
    ]);
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} />,
    );
    const cards = qa(container, '.cn-note-card');
    expect(cards[0].querySelector('button')!.textContent).toBe('View');
    expect(cards[0].querySelector('[aria-label="Delete draft"]')).toBeNull();
    expect(cards[1].querySelector('button')!.textContent).toBe('Open');
    expect(cards[1].querySelector('[aria-label="Delete draft"]')).not.toBeNull();
    unmount();
  });

  it('creating a note stamps the author/assignee AND the facility (hospitalId/hospitalName/orgId)', async () => {
    listClinicalNotes.mockResolvedValue([]);
    createClinicalNote.mockResolvedValue(note({ _id: 'new1' }));
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" mrn="MRN-9" currentUser={CURRENT_USER} />,
    );
    const mainBtn = q<HTMLButtonElement>(container, '.cn-split-main')!;
    await clickAsync(mainBtn);
    expect(createClinicalNote).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'pt1', patientName: 'Test Patient', mrn: 'MRN-9', noteType: 'soap',
      assignedToId: 'u1', assignedToName: 'Deng Mabior Kuol',
      authorId: 'u1', authorName: 'Deng Mabior Kuol',
      hospitalId: 'h1', hospitalName: 'Juba Hospital', orgId: 'org1',
    }));
    expect(push).toHaveBeenCalledWith('/notes/new1');
    unmount();
  });

  it('onOpenNote, when supplied, is used instead of navigating — for opening the note in the chart drawer', async () => {
    listClinicalNotes.mockResolvedValue([note({ _id: 'n9' })]);
    const onOpenNote = jest.fn();
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} onOpenNote={onOpenNote} />,
    );
    click(qa<HTMLButtonElement>(container, '.cn-note-card button')[0]);
    expect(onOpenNote).toHaveBeenCalledWith('n9');
    expect(push).not.toHaveBeenCalled();
    unmount();
  });

  it('delete asks for confirmation and does nothing when declined', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    listClinicalNotes.mockResolvedValue([note({ _id: 'd1', status: 'draft' })]);
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} />,
    );
    click(q<HTMLButtonElement>(container, '[aria-label="Delete draft"]')!);
    expect(window.confirm).toHaveBeenCalled();
    expect(deleteClinicalNote).not.toHaveBeenCalled();
    unmount();
  });

  it('delete removes the draft and reloads the list on confirmation', async () => {
    (window.confirm as jest.Mock).mockReturnValue(true);
    listClinicalNotes.mockResolvedValue([note({ _id: 'd1', status: 'draft' })]);
    deleteClinicalNote.mockResolvedValue(true);
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} />,
    );
    await clickAsync(q<HTMLButtonElement>(container, '[aria-label="Delete draft"]')!);
    expect(deleteClinicalNote).toHaveBeenCalledWith('d1', 'Deng Mabior Kuol');
    expect(showToast).toHaveBeenCalledWith('Draft deleted.', 'success');
    unmount();
  });

  it('does not offer create controls in the cross-patient queue (no patientId)', async () => {
    listClinicalNotes.mockResolvedValue([]);
    const { container, unmount } = await mountAndFlush(
      <NotesList currentUser={CURRENT_USER} />,
    );
    expect(q(container, '.cn-split-main')).toBeNull();
    unmount();
  });

  it('changing the Display filter re-loads with the new filter value', async () => {
    listClinicalNotes.mockResolvedValue([]);
    const { container, unmount } = await mountAndFlush(
      <NotesList patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} />,
    );
    listClinicalNotes.mockClear();
    listClinicalNotes.mockResolvedValue([]);
    const displaySelect = qa<HTMLSelectElement>(container, 'select').find(s =>
      Array.from(s.options).map(o => o.value).includes('unsigned'))!;
    await actFlush(() => setSelect(displaySelect, 'unsigned'));
    expect(listClinicalNotes).toHaveBeenCalledWith(
      expect.objectContaining({ display: 'unsigned' }),
      expect.anything(),
    );
    unmount();
  });
});
