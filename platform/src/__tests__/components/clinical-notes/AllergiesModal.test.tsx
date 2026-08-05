/**
 * AllergiesModal — Active/Inactive tabs, NKDA attestation, "+ Allergy" add
 * form, and Discontinue/Resolve/Reactivate/Mark as Error. Entries are never
 * hard-deleted — every removal must carry a reason so the allergy history
 * keeps no silent gaps.
 *
 * Modal portals to document.body, so queries run there.
 */
import type { PatientDoc } from '@/lib/db-types';
import type { AllergyEntry } from '@/lib/types/patient-clinical';
import { mountAndFlush, click, clickAsync, setValue, q, qa } from './test-utils';
import AllergiesModal from '@/components/clinical-notes/AllergiesModal';

const getAllergies = jest.fn();
const getPatientById = jest.fn();
const addAllergy = jest.fn();
const removeAllergy = jest.fn();
const updateAllergy = jest.fn();
const updatePatient = jest.fn();
const showToast = jest.fn();

jest.mock('@/lib/services/allergy-service', () => ({
  getAllergies: (...a: unknown[]) => getAllergies(...a),
  addAllergy: (...a: unknown[]) => addAllergy(...a),
  removeAllergy: (...a: unknown[]) => removeAllergy(...a),
  updateAllergy: (...a: unknown[]) => updateAllergy(...a),
}));
jest.mock('@/lib/services/patient-service', () => ({
  getPatientById: (...a: unknown[]) => getPatientById(...a),
  updatePatient: (...a: unknown[]) => updatePatient(...a),
}));
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));

const body = document.body;
const CURRENT_USER = { _id: 'u1', name: 'Stella Keji Lemi' };

function entry(over: Partial<AllergyEntry> = {}): AllergyEntry {
  return {
    id: 'a1', substance: 'Penicillin', status: 'active', criticality: 'severe',
    recordedAt: '2026-01-01T00:00:00.000Z', ...over,
  };
}

function patient(over: Partial<PatientDoc> = {}): PatientDoc {
  return { _id: 'pt1', type: 'patient', name: 'Test Patient', ...over } as PatientDoc;
}

async function renderModal(entries: AllergyEntry[] = [], pt: PatientDoc | null = patient()) {
  getAllergies.mockResolvedValue(entries);
  getPatientById.mockResolvedValue(pt);
  const onClose = jest.fn();
  const { unmount } = await mountAndFlush(
    <AllergiesModal patientId="pt1" currentUser={CURRENT_USER} onClose={onClose} />,
  );
  return { unmount, onClose };
}

describe('AllergiesModal', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(window, 'prompt'); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('lists active allergies by default and switches to Inactive', async () => {
    const { unmount } = await renderModal([
      entry({ id: 'a', substance: 'Penicillin', status: 'active' }),
      entry({ id: 'b', substance: 'Latex', status: 'resolved' }),
    ]);
    expect(body.textContent).toContain('Penicillin');
    expect(body.textContent).not.toContain('Latex');
    click(qa<HTMLButtonElement>(body, '.cn-segmented button').find(b => b.textContent?.startsWith('Inactive'))!);
    expect(body.textContent).toContain('Latex');
    expect(body.textContent).not.toContain('Penicillin');
    unmount();
  });

  it('an entered-in-error entry appears in neither tab — mistakes are not history', async () => {
    const { unmount } = await renderModal([entry({ id: 'x', substance: 'Aspirin', status: 'entered_in_error' })]);
    expect(body.textContent).not.toContain('Aspirin');
    click(qa<HTMLButtonElement>(body, '.cn-segmented button').find(b => b.textContent?.startsWith('Inactive'))!);
    expect(body.textContent).not.toContain('Aspirin');
    unmount();
  });

  it('adding an allergy requires an allergen', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Allergy'))!);
    const addBtn = qa<HTMLButtonElement>(body, '.cn-allergy-add-row button').find(b => b.textContent === 'Add')!;
    await clickAsync(addBtn);
    expect(showToast).toHaveBeenCalledWith('Pick or enter the allergen first.', 'error');
    expect(addAllergy).not.toHaveBeenCalled();
    unmount();
  });

  it('adding a custom (unlisted) allergen records it with no classification code', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Allergy'))!);
    setValue(q<HTMLInputElement>(body, 'input[placeholder="Search common allergens…"]')!, 'Novel Substance X');
    const customRow = qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Add “Novel Substance X”'))!;
    expect(customRow).toBeTruthy();
    click(customRow);
    setValue(q<HTMLInputElement>(body, 'input[aria-label="Reaction"]')!, 'Hives');
    addAllergy.mockResolvedValue([entry({ substance: 'Novel Substance X', classification: undefined })]);
    const addBtn = qa<HTMLButtonElement>(body, '.cn-allergy-add-row button').find(b => b.textContent === 'Add')!;
    await clickAsync(addBtn);
    expect(addAllergy).toHaveBeenCalledWith('pt1', expect.objectContaining({
      substance: 'Novel Substance X', classification: undefined, reaction: 'Hives',
    }));
    unmount();
  });

  it('picking a known allergen and adding calls addAllergy with substance/classification/recorder', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Allergy'))!);
    setValue(q<HTMLInputElement>(body, 'input[placeholder="Search common allergens…"]')!, 'Penicillin');
    const suggestion = qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Penicillin'))!;
    expect(suggestion).toBeTruthy();
    click(suggestion);
    setValue(q<HTMLInputElement>(body, 'input[aria-label="Reaction"]')!, 'Rash');
    addAllergy.mockResolvedValue([entry({ substance: 'Penicillin' })]);
    const addBtn = qa<HTMLButtonElement>(body, '.cn-allergy-add-row button').find(b => b.textContent === 'Add')!;
    await clickAsync(addBtn);
    expect(addAllergy).toHaveBeenCalledWith('pt1', expect.objectContaining({
      substance: 'Penicillin', reaction: 'Rash', recordedBy: 'u1', recordedByName: 'Stella Keji Lemi',
    }));
    unmount();
  });

  it('Discontinue requires a non-empty reason; declining leaves the entry untouched', async () => {
    (window.prompt as jest.Mock).mockReturnValue(null); // user cancelled the prompt
    const { unmount } = await renderModal([entry({ id: 'a', substance: 'Penicillin' })]);
    click(q<HTMLInputElement>(body, '.cn-meds-row')!);
    const discontinueBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Discontinue')!;
    await clickAsync(discontinueBtn);
    expect(showToast).toHaveBeenCalledWith('A reason is required.', 'error');
    expect(removeAllergy).not.toHaveBeenCalled();
    unmount();
  });

  it('Discontinue with a reason moves the entry to Inactive', async () => {
    (window.prompt as jest.Mock).mockReturnValue('No longer reactive');
    const { unmount } = await renderModal([entry({ id: 'a', substance: 'Penicillin' })]);
    click(q(body, '.cn-meds-row')!);
    removeAllergy.mockResolvedValue([entry({ id: 'a', substance: 'Penicillin', status: 'inactive', removalReason: 'No longer reactive' })]);
    const discontinueBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Discontinue')!;
    await clickAsync(discontinueBtn);
    expect(removeAllergy).toHaveBeenCalledWith('pt1', 'a', 'No longer reactive', 'inactive');
    unmount();
  });

  it('Mark as Error never prompts — it always records "Entered in error" and needs no reason', async () => {
    const { unmount } = await renderModal([entry({ id: 'a', substance: 'Penicillin' })]);
    click(q(body, '.cn-meds-row')!);
    removeAllergy.mockResolvedValue([]);
    const markErrorBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Mark as Error')!;
    await clickAsync(markErrorBtn);
    expect(window.prompt).not.toHaveBeenCalled();
    expect(removeAllergy).toHaveBeenCalledWith('pt1', 'a', 'Entered in error', 'entered_in_error');
    unmount();
  });

  it('Reactivate is only offered on the Inactive tab and calls updateAllergy', async () => {
    const { unmount } = await renderModal([entry({ id: 'a', substance: 'Latex', status: 'inactive' })]);
    expect(qa<HTMLButtonElement>(body, '.cn-meds-footer button').some(b => b.textContent === 'Reactivate')).toBe(false);
    click(qa<HTMLButtonElement>(body, '.cn-segmented button').find(b => b.textContent?.startsWith('Inactive'))!);
    click(q(body, '.cn-meds-row')!);
    updateAllergy.mockResolvedValue([entry({ id: 'a', substance: 'Latex', status: 'active' })]);
    const reactivateBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Reactivate')!;
    await clickAsync(reactivateBtn);
    expect(updateAllergy).toHaveBeenCalledWith('pt1', 'a', { status: 'active', removalReason: undefined });
    unmount();
  });

  it('"No known drug allergies" is disabled while an active allergy is recorded', async () => {
    const { unmount } = await renderModal([entry({ status: 'active' })]);
    const nkda = q<HTMLInputElement>(body, '.cn-meds-nkm input')!;
    expect(nkda.disabled).toBe(true);
    unmount();
  });

  it('"No known drug allergies" is settable when there are no active allergies', async () => {
    const { unmount } = await renderModal([], patient({ noKnownDrugAllergies: false }));
    updatePatient.mockResolvedValue(patient({ noKnownDrugAllergies: true }));
    const nkda = q<HTMLInputElement>(body, '.cn-meds-nkm input')!;
    expect(nkda.disabled).toBe(false);
    await clickAsync(nkda);
    expect(updatePatient).toHaveBeenCalledWith('pt1', { noKnownDrugAllergies: true });
    unmount();
  });

  it('row actions are disabled without a selection', async () => {
    const { unmount } = await renderModal([entry()]);
    expect(qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Discontinue')!.disabled).toBe(true);
    expect(qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Resolve')!.disabled).toBe(true);
    unmount();
  });
});
