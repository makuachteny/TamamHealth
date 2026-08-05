/**
 * ClinicalNoteEditor — regression coverage for two defects fixed earlier
 * today:
 *
 * (1) AUTOSAVE DATA LOSS. Section edits are optimistic + debounced
 *     (AUTOSAVE_MS): a `pendingSaves` ref holds the patch, a timer fires the
 *     real write. Navigating away (unmount) inside the debounce window used
 *     to just clearTimeout the pending write and lose it; the fix flushes
 *     pendingSaves synchronously on unmount. Also: handleIncludeProblems
 *     must MERGE into whatever is already pending for a section rather than
 *     clobbering it, and handleSaveAndClose's own direct writes must not
 *     leave stale pendingSaves/timers that fire AGAIN on the unmount that
 *     follows it.
 *
 * (2) FALSE ATTESTATION. The Plan section must not record "ordered from the
 *     note" merely because a clinician clicked an order button — opening the
 *     lab-order flow or the referral flow must record NOTHING until the
 *     order/referral actually exists. A cancelled/failed attempt must leave
 *     no plan action behind.
 *
 * These are integration-shaped defects (state living in closures inside the
 * component), so they're exercised by actually mounting the real component
 * and driving it, not by testing an extracted pure function.
 */
import type { ClinicalNoteDoc, NoteDiagnosis } from '@/lib/clinical-notes/types';
import { mountAndFlush, actFlush, click, clickAsync, setValue, q, qa } from './test-utils';

// ── note-service: mock the DB-touching exports, keep pure helpers real ──
const getClinicalNoteById = jest.fn();
const updateClinicalNote = jest.fn();
const saveNoteSection = jest.fn();
const addNoteSection = jest.fn();
const removeNoteSection = jest.fn();
const changeNoteType = jest.fn();
const clearNote = jest.fn();
const signClinicalNote = jest.fn();
const addNoteAddendum = jest.fn();
const recordPlanAction = jest.fn();
const listClinicalNotes = jest.fn();

jest.mock('@/lib/clinical-notes/note-service', () => {
  const actual = jest.requireActual('@/lib/clinical-notes/note-service');
  return {
    ...actual, // isNoteLocked and any other pure helpers stay real
    getClinicalNoteById: (...a: unknown[]) => getClinicalNoteById(...a),
    updateClinicalNote: (...a: unknown[]) => updateClinicalNote(...a),
    saveNoteSection: (...a: unknown[]) => saveNoteSection(...a),
    addNoteSection: (...a: unknown[]) => addNoteSection(...a),
    removeNoteSection: (...a: unknown[]) => removeNoteSection(...a),
    changeNoteType: (...a: unknown[]) => changeNoteType(...a),
    clearNote: (...a: unknown[]) => clearNote(...a),
    signClinicalNote: (...a: unknown[]) => signClinicalNote(...a),
    addNoteAddendum: (...a: unknown[]) => addNoteAddendum(...a),
    recordPlanAction: (...a: unknown[]) => recordPlanAction(...a),
    listClinicalNotes: (...a: unknown[]) => listClinicalNotes(...a),
  };
});

// ── chart-snapshot: mock only the DB-touching loader, keep the pure
//    formatter (snapshotForSection) real. Fixture notes below carry their
//    own snapshot text already, so the "fill empty derived sections on
//    first open" effect finds nothing empty and never calls this. ──
const loadChartSnapshot = jest.fn().mockResolvedValue({});
jest.mock('@/lib/clinical-notes/chart-snapshot', () => {
  const actual = jest.requireActual('@/lib/clinical-notes/chart-snapshot');
  return { ...actual, loadChartSnapshot: (...a: unknown[]) => loadChartSnapshot(...a) };
});

// ── Chart-context services the left rail reads; neutral empty defaults ──
const getPatientById = jest.fn().mockResolvedValue(null);
const getProblemsByPatient = jest.fn().mockResolvedValue([]);
const getLabResultsByPatient = jest.fn().mockResolvedValue([]);
const getPatientDocuments = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/services/patient-service', () => ({ getPatientById: (...a: unknown[]) => getPatientById(...a) }));
jest.mock('@/lib/services/problem-service', () => ({ getProblemsByPatient: (...a: unknown[]) => getProblemsByPatient(...a) }));
jest.mock('@/lib/services/lab-service', () => ({ getLabResultsByPatient: (...a: unknown[]) => getLabResultsByPatient(...a) }));
jest.mock('@/lib/services/patient-document-service', () => ({ getPatientDocuments: (...a: unknown[]) => getPatientDocuments(...a) }));

// ── Referral creation — the write that must precede recording a plan action ──
const createReferral = jest.fn();
jest.mock('@/lib/services/referral-service', () => ({ createReferral: (...a: unknown[]) => createReferral(...a) }));

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushSpy }) }));
const pushSpy = jest.fn();

const showToast = jest.fn();
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));

const SCOPE = { orgId: 'org1', hospitalId: 'h1', role: 'clinical_officer' as const };
jest.mock('@/lib/hooks/useDataScope', () => ({ useDataScope: () => SCOPE }));

// ── LabOrderModal is out of this component's ownership and heavy (its own
//    catalog/service tree) — faked so the note editor's "record only after
//    a real order exists" contract can be tested against its onPlaced
//    callback precisely, without depending on the real order flow. ──
jest.mock('@/components/lab/order/LabOrderModal', () => ({
  __esModule: true,
  default: ({ onClose, onPlaced }: { onClose: () => void; onPlaced: () => void }) => (
    <div data-testid="fake-lab-order-modal">
      <button type="button" onClick={onPlaced}>Simulate order placed</button>
      <button type="button" onClick={onClose}>Close without ordering</button>
    </div>
  ),
}));

// ── IncludeProblemsModal's own search/select flow is covered by its own
//    test file; here it's faked down to the one thing this component's
//    contract cares about — what onInclude hands back. ──
const FIXED_DIAGNOSIS_LINES: NoteDiagnosis[] = [
  { id: 'dx-fixed-1', name: 'Malaria', icd11Code: '1A40', addedAt: '2026-08-05T00:00:00.000Z', problemId: 'p1' },
];
jest.mock('@/components/clinical-notes/assessment/IncludeProblemsModal', () => ({
  __esModule: true,
  default: ({ onInclude, onClose }: { onInclude: (lines: NoteDiagnosis[]) => void; onClose: () => void }) => (
    <div data-testid="fake-include-problems-modal">
      <button type="button" onClick={() => onInclude(FIXED_DIAGNOSIS_LINES)}>Include fake problem</button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}));

import ClinicalNoteEditor from '@/components/clinical-notes/ClinicalNoteEditor';

const CURRENT_USER = { _id: 'u1', name: 'Deng Mabior Kuol', role: 'clinical_officer', orgId: 'org1' };
const body = document.body;

function makeNote(over: Partial<ClinicalNoteDoc> = {}): ClinicalNoteDoc {
  return {
    _id: 'note1', type: 'clinical_note', patientId: 'pt1', patientName: 'Test Patient',
    noteType: 'soap', status: 'draft',
    serviceDate: '2026-08-05', serviceTime: '09:00',
    hospitalId: 'h1', hospitalName: 'Juba Hospital', orgId: 'org1',
    sections: [
      { sectionId: 'cc', text: '' },
      { sectionId: 'subjective', text: '' },
      // Derived sections already carry a snapshot so the "fill empty derived
      // sections on first open" effect has nothing to do — keeps these tests
      // isolated to the behaviour actually under test.
      { sectionId: 'medications', snapshot: 'No known medications.', snapshotAt: '2026-08-01T00:00:00.000Z' },
      { sectionId: 'allergies', snapshot: 'No known allergies.', snapshotAt: '2026-08-01T00:00:00.000Z' },
      { sectionId: 'mental_functional', text: '' },
      { sectionId: 'vitals', snapshot: 'Temp: 37.0 °C', snapshotAt: '2026-08-01T00:00:00.000Z' },
      { sectionId: 'objective', text: '' },
      { sectionId: 'assessment', text: '', diagnoses: [] },
      { sectionId: 'plan', text: '' },
    ],
    createdAt: '2026-08-05T08:00:00.000Z', updatedAt: '2026-08-05T08:00:00.000Z',
    ...over,
  } as ClinicalNoteDoc;
}

async function renderEditor(noteOverrides: Partial<ClinicalNoteDoc> = {}, props: Partial<{ onClose: () => void }> = {}) {
  const note = makeNote(noteOverrides);
  getClinicalNoteById.mockResolvedValue(note);
  listClinicalNotes.mockResolvedValue([]);
  const { container, unmount } = await mountAndFlush(
    <ClinicalNoteEditor noteId="note1" currentUser={CURRENT_USER} {...props} />,
  );
  return { container, unmount, note };
}

function textareaFor(sectionId: string): HTMLTextAreaElement {
  const section = q<HTMLElement>(document.body, `#cn-section-${sectionId}`)!;
  return section.querySelector('textarea')!;
}

beforeEach(() => {
  jest.clearAllMocks();
  getPatientById.mockResolvedValue(null);
  getProblemsByPatient.mockResolvedValue([]);
  getLabResultsByPatient.mockResolvedValue([]);
  getPatientDocuments.mockResolvedValue([]);
  loadChartSnapshot.mockResolvedValue({});
  listClinicalNotes.mockResolvedValue([]);
  // Default write mocks resolve null (persist() then leaves `note` state
  // alone) — most of these tests only care what the mock was CALLED with.
  updateClinicalNote.mockResolvedValue(null);
  saveNoteSection.mockResolvedValue(null);
  recordPlanAction.mockResolvedValue(null);
});
afterEach(() => { document.body.innerHTML = ''; });

describe('ClinicalNoteEditor — autosave data loss (defect 1)', () => {
  it('navigating away inside the debounce window still persists the last edit', async () => {
    const { unmount } = await renderEditor();
    setValue(textareaFor('subjective'), 'Patient reports a two-day headache.');
    // No time has been allowed to pass — this is squarely "inside the
    // debounce window." The old bug just cleared the timer here and the
    // edit vanished.
    expect(saveNoteSection).not.toHaveBeenCalled();
    unmount();
    expect(saveNoteSection).toHaveBeenCalledTimes(1);
    expect(saveNoteSection).toHaveBeenCalledWith('note1', 'subjective', { text: 'Patient reports a two-day headache.' });
  });

  it('flushes a pending edit in EVERY section with unsaved text, not just one', async () => {
    const { unmount } = await renderEditor();
    setValue(textareaFor('subjective'), 'Subjective text.');
    setValue(textareaFor('objective'), 'Objective text.');
    unmount();
    expect(saveNoteSection).toHaveBeenCalledTimes(2);
    expect(saveNoteSection).toHaveBeenCalledWith('note1', 'subjective', { text: 'Subjective text.' });
    expect(saveNoteSection).toHaveBeenCalledWith('note1', 'objective', { text: 'Objective text.' });
  });

  it('a second keystroke before the timer fires still only flushes the LATEST text once on unmount', async () => {
    const { unmount } = await renderEditor();
    const ta = textareaFor('subjective');
    setValue(ta, 'First draft');
    setValue(ta, 'First draft, revised');
    unmount();
    expect(saveNoteSection).toHaveBeenCalledTimes(1);
    expect(saveNoteSection).toHaveBeenCalledWith('note1', 'subjective', { text: 'First draft, revised' });
  });

  it('does nothing on unmount when there is no pending edit', async () => {
    const { unmount } = await renderEditor();
    unmount();
    expect(saveNoteSection).not.toHaveBeenCalled();
  });

  it('handleIncludeProblems MERGES into a pending save rather than clobbering it', async () => {
    const { container, unmount } = await renderEditor();
    // Start editing Assessment's narrative — queues a pending {text: ...}
    // patch for 'assessment' and starts its debounce timer.
    setValue(textareaFor('assessment'), 'Working assessment narrative.');

    // Before that timer fires, land the Include Problems popup's result —
    // this must merge into the SAME pending patch, not replace it.
    const assessmentSection = q<HTMLElement>(body, '#cn-section-assessment')!;
    const includeBtn = qa<HTMLButtonElement>(assessmentSection, '.cn-tool')
      .find(b => b.textContent?.includes('Include Problems'))!;
    click(includeBtn);
    click(q<HTMLButtonElement>(body, '[data-testid="fake-include-problems-modal"] button')!);

    unmount();
    // Exactly one write for the section, carrying BOTH the still-pending
    // narrative text AND the newly-included diagnosis line.
    expect(saveNoteSection).toHaveBeenCalledTimes(1);
    expect(saveNoteSection).toHaveBeenCalledWith('note1', 'assessment', {
      text: 'Working assessment narrative.',
      diagnoses: FIXED_DIAGNOSIS_LINES,
    });
    void container;
  });

  it('handleSaveAndClose writes every section directly and leaves nothing for the unmount that follows to re-flush', async () => {
    const onClose = jest.fn();
    const { unmount } = await renderEditor({}, { onClose });
    setValue(textareaFor('subjective'), 'Some notes before saving.');

    const saveAndCloseBtn = qa<HTMLButtonElement>(body, '.cn-footer button')
      .find(b => b.textContent?.includes('Save & Close'))!;
    await clickAsync(saveAndCloseBtn);

    // handleSaveAndClose writes every section directly (not via the pending-
    // save path), so by now saveNoteSection has already been called once per
    // section in the note.
    const callsAfterSaveAndClose = saveNoteSection.mock.calls.length;
    expect(callsAfterSaveAndClose).toBeGreaterThan(0);
    expect(onClose).toHaveBeenCalledTimes(1);
    saveNoteSection.mockClear();

    // The component doesn't actually unmount itself on Save & Close (the
    // HOST does, once onClose navigates away) — simulate that now and prove
    // the cleanup effect has nothing left to flush a second time.
    unmount();
    expect(saveNoteSection).not.toHaveBeenCalled();
  });

  it('handleSaveAndClose is honest that a pending debounce timer is abandoned in favour of its own direct write, not silently dropped', async () => {
    // This documents the actual contract: Save & Close clears
    // timers/pendingSaves up front and then writes the CURRENT (already
    // optimistically-applied) section text directly — so the edit is not
    // lost even though the specific debounce timer never fires.
    const onClose = jest.fn();
    const { unmount } = await renderEditor({}, { onClose });
    setValue(textareaFor('plan'), 'Follow up in two weeks.');
    const saveAndCloseBtn = qa<HTMLButtonElement>(body, '.cn-footer button')
      .find(b => b.textContent?.includes('Save & Close'))!;
    await clickAsync(saveAndCloseBtn);
    expect(saveNoteSection).toHaveBeenCalledWith('note1', 'plan', expect.objectContaining({ text: 'Follow up in two weeks.' }));
    unmount();
  });
});

describe('ClinicalNoteEditor — false attestation (defect 2)', () => {
  it('opening the lab order flow records nothing', async () => {
    const { unmount } = await renderEditor();
    const planSection = q<HTMLElement>(body, '#cn-section-plan')!;
    click(qa<HTMLButtonElement>(planSection, '.cn-tool').find(b => b.textContent?.includes('Labs/Studies'))!);
    expect(q(body, '[data-testid="fake-lab-order-modal"]')).not.toBeNull();
    expect(recordPlanAction).not.toHaveBeenCalled();
    unmount();
  });

  it('closing the lab order flow without placing an order records nothing', async () => {
    const { unmount } = await renderEditor();
    const planSection = q<HTMLElement>(body, '#cn-section-plan')!;
    click(qa<HTMLButtonElement>(planSection, '.cn-tool').find(b => b.textContent?.includes('Labs/Studies'))!);
    click(qa<HTMLButtonElement>(body, '[data-testid="fake-lab-order-modal"] button').find(b => b.textContent === 'Close without ordering')!);
    expect(q(body, '[data-testid="fake-lab-order-modal"]')).toBeNull();
    expect(recordPlanAction).not.toHaveBeenCalled();
    unmount();
  });

  it('an order actually placed (onPlaced) records exactly one plan action, attributed to the acting user', async () => {
    const { unmount } = await renderEditor();
    const planSection = q<HTMLElement>(body, '#cn-section-plan')!;
    click(qa<HTMLButtonElement>(planSection, '.cn-tool').find(b => b.textContent?.includes('Labs/Studies'))!);
    await clickAsync(qa<HTMLButtonElement>(body, '[data-testid="fake-lab-order-modal"] button').find(b => b.textContent === 'Simulate order placed')!);
    expect(recordPlanAction).toHaveBeenCalledTimes(1);
    expect(recordPlanAction).toHaveBeenCalledWith('note1', {
      kind: 'lab', label: 'Lab/study ordered from the note', createdBy: 'u1',
    });
    unmount();
  });

  it('a referral records the plan action only once createReferral has actually written it', async () => {
    createReferral.mockResolvedValue({ _id: 'referral-1' });
    const { unmount } = await renderEditor();
    click(qa<HTMLButtonElement>(body, '.cn-footer button').find(b => b.textContent?.includes('Care Coordination'))!);

    expect(recordPlanAction).not.toHaveBeenCalled(); // opening the popup alone attests nothing

    const recipientInput = q<HTMLInputElement>(body, 'input[placeholder="Provider or facility"]')!;
    setValue(recipientInput, 'Dr. Referral Recipient');
    const sendBtn = qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Send Message'))!;
    await clickAsync(sendBtn);

    expect(createReferral).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'pt1', patientName: 'Test Patient', fromHospitalId: 'h1', fromHospital: 'Juba Hospital',
      toHospital: 'Dr. Referral Recipient', orgId: 'org1', status: 'sent',
    }));
    expect(recordPlanAction).toHaveBeenCalledTimes(1);
    expect(recordPlanAction).toHaveBeenCalledWith('note1', {
      kind: 'referral', label: 'Referral to Dr. Referral Recipient', targetId: 'referral-1', createdBy: 'u1',
    });
    unmount();
  });

  it('a FAILED referral write records NOTHING and leaves the popup open to retry', async () => {
    createReferral.mockRejectedValue(new Error('Network unreachable'));
    const { unmount } = await renderEditor();
    click(qa<HTMLButtonElement>(body, '.cn-footer button').find(b => b.textContent?.includes('Care Coordination'))!);
    setValue(q<HTMLInputElement>(body, 'input[placeholder="Provider or facility"]')!, 'Dr. Referral Recipient');
    const sendBtn = qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Send Message'))!;
    await clickAsync(sendBtn);

    expect(recordPlanAction).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Network unreachable', 'error');
    // The referral popup is still open — a failed send does not silently
    // dismiss the clinician's in-progress work.
    expect(qa<HTMLButtonElement>(body, 'button').some(b => b.textContent?.includes('Send Message'))).toBe(true);
    unmount();
  });

  it('hand-offs with no in-place flow (vaccine order, patient education) navigate but attest nothing', async () => {
    const { unmount } = await renderEditor();
    const planSection = q<HTMLElement>(body, '#cn-section-plan')!;
    click(qa<HTMLButtonElement>(planSection, '.cn-tool').find(b => b.textContent?.includes('Vaccines'))!);
    expect(pushSpy).toHaveBeenCalledWith('/immunizations?patientId=pt1');
    expect(recordPlanAction).not.toHaveBeenCalled();
    unmount();
  });
});
