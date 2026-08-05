/**
 * PrescribeModal — "Prescribe Medications" writing flow from inside a note.
 *
 * Covers:
 *  - SCOPE THREADING (defect 3): the active-prescriptions read (used for the
 *    interaction check + "Checked against" list) must pass the real
 *    DataScope through unmodified. Unlike MedicationsModal, this component
 *    does no client-side re-filtering of what the service returns — it
 *    trusts the service's own scoping — so the meaningful assertion here is
 *    that the correct scope argument reaches the read, and that whatever the
 *    (properly-scoped) service returns is actually surfaced, not silently
 *    dropped again on the client.
 *  - FACILITY STAMPING fix: write() was missing hospitalName (present on
 *    PrescriptionDoc, stamped everywhere else) alongside hospitalId/orgId —
 *    fixed in this session; this locks it in.
 *
 * Modal portals to document.body.
 */
import type { PatientDoc, PharmacyInventoryDoc, PrescriptionDoc, ProblemDoc } from '@/lib/db-types';
import { mountAndFlush, click, clickAsync, setValue, q, qa } from './test-utils';

const getPatientById = jest.fn();
const getProblemsByPatient = jest.fn();
const getPrescriptionsByPatient = jest.fn();
const createPrescription = jest.fn();
const getAllInventory = jest.fn();
const getPatientBalance = jest.fn();
const loadChartSnapshot = jest.fn();
const checkNewPrescription = jest.fn();
const isFavorite = jest.fn();
const toggleFavorite = jest.fn();
const showToast = jest.fn();

jest.mock('@/lib/services/patient-service', () => ({ getPatientById: (...a: unknown[]) => getPatientById(...a) }));
jest.mock('@/lib/services/problem-service', () => ({ getProblemsByPatient: (...a: unknown[]) => getProblemsByPatient(...a) }));
jest.mock('@/lib/services/prescription-service', () => ({
  getPrescriptionsByPatient: (...a: unknown[]) => getPrescriptionsByPatient(...a),
  createPrescription: (...a: unknown[]) => createPrescription(...a),
}));
jest.mock('@/lib/services/pharmacy-inventory-service', () => ({ getAllInventory: (...a: unknown[]) => getAllInventory(...a) }));
jest.mock('@/lib/services/ledger-service', () => ({ getPatientBalance: (...a: unknown[]) => getPatientBalance(...a) }));
jest.mock('@/lib/clinical-notes/chart-snapshot', () => ({ loadChartSnapshot: (...a: unknown[]) => loadChartSnapshot(...a) }));
jest.mock('@/lib/services/drug-interaction-service', () => ({ checkNewPrescription: (...a: unknown[]) => checkNewPrescription(...a) }));
jest.mock('@/lib/services/clinical-favorites-service', () => ({
  isFavorite: (...a: unknown[]) => isFavorite(...a),
  toggleFavorite: (...a: unknown[]) => toggleFavorite(...a),
}));
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));

const SCOPE = { orgId: 'org1', hospitalId: 'h1', role: 'clinical_officer' as const };
jest.mock('@/lib/hooks/useDataScope', () => ({ useDataScope: () => SCOPE }));

import PrescribeModal from '@/components/clinical-notes/prescribe/PrescribeModal';

const CURRENT_USER = {
  _id: 'u1', name: 'Deng Mabior Kuol', orgId: 'org1', hospitalId: 'h1', hospitalName: 'Juba Hospital',
};
const body = document.body;

function patient(over: Partial<PatientDoc> = {}): PatientDoc {
  return { _id: 'pt1', type: 'patient', name: 'Test Patient', ...over } as PatientDoc;
}

function activeRx(over: Partial<PrescriptionDoc> = {}): PrescriptionDoc {
  return {
    _id: 'rx1', type: 'prescription', patientId: 'pt1', patientName: 'Test Patient',
    medication: 'Warfarin', dose: '5mg', route: 'Oral', frequency: 'OD', duration: '',
    prescribedBy: 'Dr. X', status: 'pending', orderStatus: 'prescribed',
    orgId: 'org1', hospitalId: 'h1',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  } as PrescriptionDoc;
}

async function renderModal(opts: {
  patient?: PatientDoc | null;
  problems?: ProblemDoc[];
  activeRx?: PrescriptionDoc[];
  inventory?: PharmacyInventoryDoc[];
  balance?: number;
} = {}) {
  getPatientById.mockResolvedValue(opts.patient ?? patient());
  getProblemsByPatient.mockResolvedValue(opts.problems ?? []);
  getPrescriptionsByPatient.mockResolvedValue(opts.activeRx ?? []);
  getAllInventory.mockResolvedValue(opts.inventory ?? []);
  getPatientBalance.mockResolvedValue(opts.balance ?? 0);
  loadChartSnapshot.mockResolvedValue({});
  checkNewPrescription.mockReturnValue({ hasInteractions: false, interactions: [], highestSeverity: null });
  isFavorite.mockResolvedValue(false);

  const onClose = jest.fn();
  const onPrescribed = jest.fn();
  const { unmount } = await mountAndFlush(
    <PrescribeModal patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} onClose={onClose} onPrescribed={onPrescribed} />,
  );
  return { unmount, onClose, onPrescribed };
}

// Picking a drug kicks off the async interaction/allergy-check and favorite
// lookup effects, so this must flush like any other async-triggering action.
async function pickDrug(name: string) {
  const input = q<HTMLInputElement>(body, 'input[aria-label="Drug name"]')!;
  setValue(input, name);
  const match = qa<HTMLButtonElement>(body, '.cn-rx-results button').find(b => b.textContent?.includes(name))!;
  await clickAsync(match);
}

describe('PrescribeModal — scope threading (defect 3)', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('reads active prescriptions with the real DataScope, not unscoped', async () => {
    const { unmount } = await renderModal();
    expect(getPrescriptionsByPatient).toHaveBeenCalledWith('pt1', SCOPE);
    unmount();
  });

  it('a prescription the (properly-scoped) service returns is actually surfaced, not dropped again on the client', async () => {
    const { unmount } = await renderModal({ activeRx: [activeRx({ medication: 'Metformin', dose: '500mg' })] });
    await pickDrug('Amoxicillin');
    // The "Checked against" list in the monograph panel reflects activeRx.
    expect(body.textContent).toContain('Checked against');
    expect(body.textContent).toContain('Metformin');
    unmount();
  });

  it('an interaction against an in-scope active medication is flagged', async () => {
    const { unmount } = await renderModal({ activeRx: [activeRx({ medication: 'Warfarin' })] });
    // renderModal() seeds the happy-path (no-interaction) mock as part of its
    // own setup, so the real value under test is set afterwards, right before
    // it's exercised by pickDrug().
    checkNewPrescription.mockReturnValue({
      hasInteractions: true,
      interactions: [{ drug1: 'Warfarin', drug2: 'Amoxicillin', severity: 'moderate', description: 'Increased bleeding risk', clinicalAdvice: 'Monitor INR' }],
      highestSeverity: 'moderate',
    });
    await pickDrug('Amoxicillin');
    expect(checkNewPrescription).toHaveBeenCalledWith('Amoxicillin', ['Warfarin']);
    expect(body.textContent).toContain('Warfarin');
    expect(body.textContent).toContain('Increased bleeding risk');
    unmount();
  });
});

describe('PrescribeModal — facility stamping on write', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('Add Rx stamps hospitalId, hospitalName AND orgId — fixed to match MedicationsModal', async () => {
    const { unmount } = await renderModal();
    await pickDrug('Amoxicillin');
    setValue(q<HTMLTextAreaElement>(body, 'textarea[aria-label="Patient instructions"]')!, 'One tablet three times daily.');
    createPrescription.mockResolvedValue({ prescription: activeRx({ _id: 'new' }), interactionWarnings: null });
    const addRxBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Add Rx')!;
    await clickAsync(addRxBtn);
    expect(createPrescription).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org1', hospitalId: 'h1', hospitalName: 'Juba Hospital',
    }));
    unmount();
  });

  it('Add Rx keeps the modal open and resets the draft for the next prescription', async () => {
    const { unmount, onClose } = await renderModal();
    await pickDrug('Amoxicillin');
    setValue(q<HTMLTextAreaElement>(body, 'textarea[aria-label="Patient instructions"]')!, 'Twice daily.');
    createPrescription.mockResolvedValue({ prescription: activeRx({ _id: 'new' }), interactionWarnings: null });
    const addRxBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Add Rx')!;
    await clickAsync(addRxBtn);
    expect(onClose).not.toHaveBeenCalled();
    expect(q<HTMLInputElement>(body, 'input[aria-label="Drug name"]')!.value).toBe('');
    unmount();
  });

  it('Send Medication writes with orderStatus received_in_pharmacy_queue and closes the modal', async () => {
    const { unmount, onClose } = await renderModal();
    await pickDrug('Amoxicillin');
    setValue(q<HTMLTextAreaElement>(body, 'textarea[aria-label="Patient instructions"]')!, 'Twice daily.');
    createPrescription.mockResolvedValue({ prescription: activeRx({ _id: 'new' }), interactionWarnings: null });
    const sendBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Send Medication')!;
    await clickAsync(sendBtn);
    expect(createPrescription).toHaveBeenCalledWith(expect.objectContaining({ orderStatus: 'received_in_pharmacy_queue' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('requires a drug before writing anything', async () => {
    const { unmount } = await renderModal();
    const addRxBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Add Rx')!;
    await clickAsync(addRxBtn);
    expect(showToast).toHaveBeenCalledWith('Pick the drug first.', 'error');
    expect(createPrescription).not.toHaveBeenCalled();
    unmount();
  });

  it('requires patient instructions before writing anything', async () => {
    const { unmount } = await renderModal();
    await pickDrug('Amoxicillin');
    const addRxBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Add Rx')!;
    await clickAsync(addRxBtn);
    expect(showToast).toHaveBeenCalledWith('Patient instructions are required.', 'error');
    expect(createPrescription).not.toHaveBeenCalled();
    unmount();
  });
});

describe('PrescribeModal — allergy warnings and favorites', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('flags a recorded active allergy that matches the picked drug', async () => {
    const { unmount } = await renderModal({
      patient: patient({ structuredAllergies: [{ id: 'al1', substance: 'Amoxicillin', status: 'active', recordedAt: '2026-01-01T00:00:00.000Z', reaction: 'Rash' }] }),
    });
    await pickDrug('Amoxicillin');
    expect(body.textContent).toContain('ALLERGY');
    expect(body.textContent).toContain('Rash');
    unmount();
  });

  it('does not flag a resolved/inactive allergy', async () => {
    const { unmount } = await renderModal({
      patient: patient({ structuredAllergies: [{ id: 'al1', substance: 'Amoxicillin', status: 'inactive', recordedAt: '2026-01-01T00:00:00.000Z' }] }),
    });
    await pickDrug('Amoxicillin');
    expect(body.textContent).not.toContain('ALLERGY');
    unmount();
  });

  it('toggling favorite calls toggleFavorite with the drug identity and this user/facility', async () => {
    toggleFavorite.mockResolvedValue(true);
    const { unmount } = await renderModal();
    await pickDrug('Amoxicillin');
    const favBtn = q<HTMLButtonElement>(body, '.cn-rx-favorite')!;
    await clickAsync(favBtn);
    expect(toggleFavorite).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', kind: 'medication', code: 'Amoxicillin', orgId: 'org1', hospitalId: 'h1',
    }));
    unmount();
  });
});
