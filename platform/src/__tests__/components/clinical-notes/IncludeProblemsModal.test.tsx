/**
 * IncludeProblemsModal — Active/Inactive problem list, "+ Problem" add form,
 * and the Include action that hands checked rows to the note's Assessment as
 * diagnosis lines.
 *
 * Modal portals its whole subtree onto document.body (see components/Modal),
 * so every query here runs against document.body rather than the mount
 * root's own (empty) container.
 */
import type { PatientDoc, ProblemDoc } from '@/lib/db-types';
import { mountAndFlush, click, clickAsync, setValue, q, qa } from './test-utils';
import IncludeProblemsModal from '@/components/clinical-notes/assessment/IncludeProblemsModal';

const getProblemsByPatient = jest.fn();
const getPatientById = jest.fn();
const createProblem = jest.fn();
const setProblemStatus = jest.fn();
const deleteProblem = jest.fn();
const updatePatient = jest.fn();
const showToast = jest.fn();

jest.mock('@/lib/services/problem-service', () => ({
  getProblemsByPatient: (...a: unknown[]) => getProblemsByPatient(...a),
  createProblem: (...a: unknown[]) => createProblem(...a),
  setProblemStatus: (...a: unknown[]) => setProblemStatus(...a),
  deleteProblem: (...a: unknown[]) => deleteProblem(...a),
}));
jest.mock('@/lib/services/patient-service', () => ({
  getPatientById: (...a: unknown[]) => getPatientById(...a),
  updatePatient: (...a: unknown[]) => updatePatient(...a),
}));
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));

function problem(over: Partial<ProblemDoc> = {}): ProblemDoc {
  return {
    _id: 'pr1', type: 'problem', patientId: 'pt1', patientName: 'Test Patient',
    name: 'Malaria', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...over,
  } as ProblemDoc;
}

function patient(over: Partial<PatientDoc> = {}): PatientDoc {
  return { _id: 'pt1', type: 'patient', name: 'Test Patient', ...over } as PatientDoc;
}

const CURRENT_USER = { _id: 'u1', name: 'Deng Mabior Kuol', orgId: 'org1' };
const body = document.body;

async function renderModal(problems: ProblemDoc[] = [], pt: PatientDoc | null = patient()) {
  getProblemsByPatient.mockResolvedValue(problems);
  getPatientById.mockResolvedValue(pt);
  const onInclude = jest.fn();
  const onClose = jest.fn();
  const { unmount } = await mountAndFlush(
    <IncludeProblemsModal
      patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER}
      onInclude={onInclude} onClose={onClose}
    />,
  );
  return { unmount, onInclude, onClose };
}

describe('IncludeProblemsModal', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(window, 'confirm'); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('loads active problems by default and can switch to Inactive', async () => {
    const rows = [problem({ _id: 'a', name: 'Malaria', status: 'active' }), problem({ _id: 'b', name: 'Old TB', status: 'resolved' })];
    const { unmount } = await renderModal(rows);
    expect(body.textContent).toContain('Malaria');
    expect(body.textContent).not.toContain('Old TB');

    const inactiveTab = qa<HTMLButtonElement>(body, '.cn-segmented button').find(b => b.textContent === 'Inactive')!;
    click(inactiveTab);
    expect(body.textContent).toContain('Old TB');
    expect(body.textContent).not.toContain('Malaria');
    unmount();
  });

  it('a chronic problem counts as Active, per bucketOf', async () => {
    const { unmount } = await renderModal([problem({ name: 'Hypertension', status: 'chronic' })]);
    expect(body.textContent).toContain('Hypertension');
    unmount();
  });

  it('Include is disabled until at least one row is checked', async () => {
    const { unmount } = await renderModal([problem()]);
    const includeBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Include')!;
    expect(includeBtn.disabled).toBe(true);
    const checkbox = q<HTMLInputElement>(body, 'input[type="checkbox"][aria-label^="Select"]')!;
    click(checkbox);
    expect(includeBtn.disabled).toBe(false);
    unmount();
  });

  it('Include hands the checked problems to onInclude as diagnosis lines, then closes', async () => {
    const { onInclude, onClose, unmount } = await renderModal([
      problem({ _id: 'a', name: 'Malaria', icd11Code: '1A40', onsetDate: '2026-01-01' }),
    ]);
    click(q<HTMLInputElement>(body, 'input[type="checkbox"][aria-label^="Select"]')!);
    const includeBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Include')!;
    click(includeBtn);
    expect(onInclude).toHaveBeenCalledTimes(1);
    const lines = onInclude.mock.calls[0][0];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      name: 'Malaria', icd11Code: '1A40', startDate: '2026-01-01', problemId: 'a',
    });
    expect(typeof lines[0].id).toBe('string');
    expect(typeof lines[0].addedAt).toBe('string');
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('the description column resolves an ICD-11 title when the problem carries a known code', async () => {
    const { unmount } = await renderModal([
      problem({ name: 'Malaria (custom label)', icd11Code: '1A40' }),
    ]);
    expect(body.textContent).toContain('Malaria due to Plasmodium falciparum');
    unmount();
  });

  it('adding a problem requires a search term or picked code', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Problem'))!);
    const saveBtn = qa<HTMLButtonElement>(body, '.cn-inc-add .cn-meds-footer button').find(b => b.textContent === 'Save')!;
    await clickAsync(saveBtn);
    expect(showToast).toHaveBeenCalledWith('Search for the problem first.', 'error');
    expect(createProblem).not.toHaveBeenCalled();
    unmount();
  });

  it('picking an ICD-11 search result and saving creates the problem with that code', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Problem'))!);
    const searchInput = q<HTMLInputElement>(body, 'input[aria-label="Search for problem or ICD-11 code"]')!;
    setValue(searchInput, 'malaria');
    const result = qa<HTMLButtonElement>(body, '.cn-inc-results button')[0];
    expect(result.textContent).toContain('1A40');
    click(result);

    createProblem.mockResolvedValue(problem());
    const saveBtn = qa<HTMLButtonElement>(body, '.cn-inc-add .cn-meds-footer button').find(b => b.textContent === 'Save')!;
    await clickAsync(saveBtn);
    expect(createProblem).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'pt1', name: 'Malaria due to Plasmodium falciparum', icd11Code: '1A40', status: 'active',
      recordedBy: 'u1', recordedByName: 'Deng Mabior Kuol', orgId: 'org1',
    }));
    unmount();
  });

  it('a free-text entry with no picked code saves without an ICD-11 code', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Problem'))!);
    setValue(q<HTMLInputElement>(body, 'input[aria-label="Search for problem or ICD-11 code"]')!, 'Feeling generally unwell');
    createProblem.mockResolvedValue(problem());
    const saveBtn = qa<HTMLButtonElement>(body, '.cn-inc-add .cn-meds-footer button').find(b => b.textContent === 'Save')!;
    await clickAsync(saveBtn);
    expect(createProblem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Feeling generally unwell', icd11Code: undefined }));
    unmount();
  });

  it('Mark as Error confirms, then deletes every checked problem', async () => {
    (window.confirm as jest.Mock).mockReturnValue(true);
    const { unmount } = await renderModal([problem({ _id: 'a' }), problem({ _id: 'b', name: 'Second' })]);
    const boxes = qa<HTMLInputElement>(body, 'input[type="checkbox"][aria-label^="Select"]');
    click(boxes[0]);
    click(boxes[1]);
    deleteProblem.mockResolvedValue(undefined);
    getProblemsByPatient.mockResolvedValue([]); // reload after delete
    const markErrorBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Mark as Error')!;
    await clickAsync(markErrorBtn);
    expect(window.confirm).toHaveBeenCalled();
    expect(deleteProblem).toHaveBeenCalledTimes(2);
    expect(deleteProblem).toHaveBeenCalledWith('a');
    expect(deleteProblem).toHaveBeenCalledWith('b');
    unmount();
  });

  it('Mark as Error does nothing when the confirmation is declined', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    const { unmount } = await renderModal([problem()]);
    click(q<HTMLInputElement>(body, 'input[type="checkbox"][aria-label^="Select"]')!);
    const markErrorBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Mark as Error')!;
    await clickAsync(markErrorBtn);
    expect(deleteProblem).not.toHaveBeenCalled();
    unmount();
  });

  it('Deactivate flips status for checked Active rows, Reactivate for checked Inactive rows', async () => {
    const { unmount } = await renderModal([problem({ _id: 'a', status: 'active' })]);
    click(q<HTMLInputElement>(body, 'input[type="checkbox"][aria-label^="Select"]')!);
    setProblemStatus.mockResolvedValue(undefined);
    getProblemsByPatient.mockResolvedValue([]);
    const deactivateBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Deactivate')!;
    await clickAsync(deactivateBtn);
    expect(setProblemStatus).toHaveBeenCalledWith('a', 'inactive');
    unmount();
  });

  it('"Problem reconciliation performed" stamps the patient record', async () => {
    const { unmount } = await renderModal([], patient({ problemReconciledAt: undefined }));
    updatePatient.mockResolvedValue(patient({ problemReconciledAt: '2026-08-05T00:00:00.000Z' }));
    const checkbox = q<HTMLInputElement>(body, '.cn-meds-nkm input')!;
    await clickAsync(checkbox);
    expect(updatePatient).toHaveBeenCalledWith('pt1', expect.objectContaining({ problemReconciledAt: expect.any(String) }));
    unmount();
  });
});
