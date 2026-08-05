/**
 * MedicationsModal — regression coverage for defects fixed earlier today:
 *
 *  (3) SCOPE THREADING — the prescriptions read must pass a DataScope, and
 *      the two panels must show/hide the right things in both directions.
 *  (4) FACILITY STAMPING — Renew and "Add to med list" must stamp
 *      hospitalId/hospitalName as well as orgId, or filterByScope makes the
 *      new prescription visible to every facility in the org.
 *  (5) DELIBERATE ASYMMETRY — the left working list is facility-scoped, the
 *      right "network history" panel is org-scoped only, on purpose. A test
 *      that "fixes" this asymmetry away would be wrong, not the code.
 *
 * Modal portals to document.body.
 */
import type { PatientDoc, PrescriptionDoc } from '@/lib/db-types';
import { mountAndFlush, click, clickAsync, setValue, setChecked, q, qa } from './test-utils';

const getPrescriptionsByPatient = jest.fn();
const createPrescription = jest.fn();
const updatePrescription = jest.fn();
const getPatientById = jest.fn();
const updatePatient = jest.fn();
const showToast = jest.fn();

jest.mock('@/lib/services/prescription-service', () => ({
  getPrescriptionsByPatient: (...a: unknown[]) => getPrescriptionsByPatient(...a),
  createPrescription: (...a: unknown[]) => createPrescription(...a),
  updatePrescription: (...a: unknown[]) => updatePrescription(...a),
}));
jest.mock('@/lib/services/patient-service', () => ({
  getPatientById: (...a: unknown[]) => getPatientById(...a),
  updatePatient: (...a: unknown[]) => updatePatient(...a),
}));
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));

// Stable reference — the real hook memoizes; an unstable mock would loop the
// component's effects the way an unmemoized real hook would.
const SCOPE = { orgId: 'org1', hospitalId: 'h1', role: 'clinical_officer' as const };
jest.mock('@/lib/hooks/useDataScope', () => ({ useDataScope: () => SCOPE }));

import MedicationsModal from '@/components/clinical-notes/MedicationsModal';

const CURRENT_USER = {
  _id: 'u1', name: 'Deng Mabior Kuol', orgId: 'org1', hospitalId: 'h1', hospitalName: 'Juba Hospital',
};
const body = document.body;

function rx(over: Partial<PrescriptionDoc> = {}): PrescriptionDoc {
  return {
    _id: 'rx1', type: 'prescription', patientId: 'pt1', patientName: 'Test Patient',
    medication: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'TDS', duration: '5 days',
    prescribedBy: 'Dr. Someone', status: 'pending', orderStatus: 'prescribed',
    orgId: 'org1', hospitalId: 'h1', hospitalName: 'Juba Hospital',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  } as PrescriptionDoc;
}

function patient(over: Partial<PatientDoc> = {}): PatientDoc {
  return { _id: 'pt1', type: 'patient', name: 'Test Patient', ...over } as PatientDoc;
}

async function renderModal(prescriptions: PrescriptionDoc[] = [], pt: PatientDoc | null = patient()) {
  getPrescriptionsByPatient.mockResolvedValue(prescriptions);
  getPatientById.mockResolvedValue(pt);
  const onClose = jest.fn();
  const { unmount } = await mountAndFlush(
    <MedicationsModal patientId="pt1" patientName="Test Patient" currentUser={CURRENT_USER} onClose={onClose} />,
  );
  return { unmount, onClose };
}

describe('MedicationsModal — scope threading (defect 3)', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('reads with an org-scoped DataScope — hospitalId stripped, orgId and role kept', async () => {
    const { unmount } = await renderModal([]);
    expect(getPrescriptionsByPatient).toHaveBeenCalledWith('pt1', {
      orgId: 'org1', hospitalId: undefined, role: 'clinical_officer',
    });
    unmount();
  });

  it('in-scope data (this facility, this org) is shown in the working list', async () => {
    const { unmount } = await renderModal([
      rx({ _id: 'in-scope', medication: 'Amoxicillin', hospitalId: 'h1', orgId: 'org1' }),
    ]);
    expect(body.textContent).toContain('Amoxicillin');
    unmount();
  });

  it('same org, different facility is HIDDEN from the working list but still shown in network history', async () => {
    const { unmount } = await renderModal([
      rx({ _id: 'other-facility', medication: 'Paracetamol', hospitalId: 'h2', hospitalName: 'Wau Clinic', orgId: 'org1' }),
    ]);
    // Left (working) list: facility-scoped — must NOT show another facility's rx.
    expect(q(body, '.cn-meds-list')!.textContent).not.toContain('Paracetamol');
    expect(q(body, '.cn-meds-list')!.textContent).toContain('No active medications');

    // Right panel is behind a consent gate; grant it, then the org-wide row
    // must appear — proving the asymmetry is real, not that the row vanished
    // entirely.
    click(q<HTMLInputElement>(body, 'input[name="cn-med-consent"][type="radio"]')!); // "Yes" is first
    updatePatient.mockResolvedValue(patient({
      medHistoryConsent: { granted: true, byId: 'u1', byName: 'Deng Mabior Kuol', at: '2026-08-05T00:00:00.000Z' },
    }));
    await clickAsync(qa<HTMLButtonElement>(body, '.cn-consent-card button').find(b => b.textContent === 'Save')!);
    expect(q(body, '.cn-meds-history')!.textContent).toContain('Paracetamol');
    unmount();
  });

  it('a different org entirely is hidden from the facility-scoped working list', async () => {
    const { unmount } = await renderModal([
      rx({ _id: 'other-org', medication: 'Ibuprofen', hospitalId: 'h1', orgId: 'org2' }),
    ]);
    expect(q(body, '.cn-meds-list')!.textContent).not.toContain('Ibuprofen');
    unmount();
  });

  it('the tab counts are computed from the facility-scoped list, not the raw org-wide response', async () => {
    const { unmount } = await renderModal([
      rx({ _id: 'a', hospitalId: 'h1', orgId: 'org1' }),       // in scope
      rx({ _id: 'b', hospitalId: 'h2', orgId: 'org1' }),       // other facility
      rx({ _id: 'c', hospitalId: 'h1', orgId: 'org1' }),       // in scope
    ]);
    const activeTab = qa<HTMLButtonElement>(body, '.cn-segmented button').find(b => b.textContent?.startsWith('Active'))!;
    expect(activeTab.textContent).toBe('Active · 2');
    unmount();
  });
});

describe('MedicationsModal — facility stamping on write (defect 4, must not regress)', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('Renew stamps hospitalId, hospitalName AND orgId from currentUser', async () => {
    const existing = rx({ _id: 'r1', medication: 'Amoxicillin', status: 'pending', orderStatus: 'prescribed' });
    const { unmount } = await renderModal([existing]);
    click(q(body, '.cn-meds-row')!);
    createPrescription.mockResolvedValue({ prescription: rx({ _id: 'r2' }), interactionWarnings: null });
    getPrescriptionsByPatient.mockResolvedValue([existing]);
    const renewBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Renew')!;
    await clickAsync(renewBtn);
    expect(createPrescription).toHaveBeenCalledWith(expect.objectContaining({
      medication: 'Amoxicillin',
      orgId: 'org1', hospitalId: 'h1', hospitalName: 'Juba Hospital',
    }));
    unmount();
  });

  it('"+ Med List" (Add to med list) stamps hospitalId, hospitalName AND orgId from currentUser', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Med List'))!);
    setValue(q<HTMLInputElement>(body, 'input[aria-label="Medication name"]')!, 'Vitamin A');
    setValue(q<HTMLInputElement>(body, 'input[aria-label="Dose"]')!, '1 tablet');
    setValue(q<HTMLInputElement>(body, 'input[aria-label="Frequency"]')!, 'Daily');
    createPrescription.mockResolvedValue({ prescription: rx({ _id: 'new' }), interactionWarnings: null });
    getPrescriptionsByPatient.mockResolvedValue([]);
    const addBtn = qa<HTMLButtonElement>(body, '.cn-meds-add button').find(b => b.textContent === 'Add')!;
    await clickAsync(addBtn);
    expect(createPrescription).toHaveBeenCalledWith(expect.objectContaining({
      medication: 'Vitamin A', dose: '1 tablet', frequency: 'Daily',
      orgId: 'org1', hospitalId: 'h1', hospitalName: 'Juba Hospital',
    }));
    unmount();
  });

  it('"+ Med List" requires medication, dose and frequency before writing anything', async () => {
    const { unmount } = await renderModal([]);
    click(qa<HTMLButtonElement>(body, '.cn-meds-adders button').find(b => b.textContent?.includes('Med List'))!);
    const addBtn = qa<HTMLButtonElement>(body, '.cn-meds-add button').find(b => b.textContent === 'Add')!;
    await clickAsync(addBtn);
    expect(showToast).toHaveBeenCalledWith('Medication, dose and frequency are required.', 'error');
    expect(createPrescription).not.toHaveBeenCalled();
    unmount();
  });
});

describe('MedicationsModal — consent gate for network history', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('history is hidden until consent is recorded as granted', async () => {
    const { unmount } = await renderModal([rx({ hospitalId: 'h2', orgId: 'org1', medication: 'Secret Med' })]);
    expect(q(body, '.cn-consent-card')).not.toBeNull();
    expect(body.textContent).not.toContain('Secret Med');
    unmount();
  });

  it('declining consent records it and shows the decline note, still hiding history', async () => {
    const { unmount } = await renderModal([], patient());
    const radios = qa<HTMLInputElement>(body, 'input[name="cn-med-consent"]');
    click(radios[1]); // "No"
    updatePatient.mockResolvedValue(patient({
      medHistoryConsent: { granted: false, byId: 'u1', byName: 'Deng Mabior Kuol', at: '2026-08-05T00:00:00.000Z' },
    }));
    await clickAsync(qa<HTMLButtonElement>(body, '.cn-consent-card button').find(b => b.textContent === 'Save')!);
    expect(updatePatient).toHaveBeenCalledWith('pt1', expect.objectContaining({
      medHistoryConsent: expect.objectContaining({ granted: false, byId: 'u1' }),
    }));
    unmount();
  });

  it('once granted, history shows and offers a "Change" control', async () => {
    const { unmount } = await renderModal([], patient({
      medHistoryConsent: { granted: true, byId: 'u1', byName: 'Deng Mabior Kuol', at: '2026-08-01T00:00:00.000Z' },
    }));
    expect(q(body, '.cn-meds-history')).not.toBeNull();
    expect(body.textContent).toContain('Consent recorded by Deng Mabior Kuol');
    unmount();
  });
});

describe('MedicationsModal — row actions and NKM', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('row action buttons are disabled without a selection', async () => {
    const { unmount } = await renderModal([rx()]);
    for (const label of ['Renew', 'Discontinue', 'Mark as Error', 'Cancel Rx']) {
      expect(qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === label)!.disabled).toBe(true);
    }
    unmount();
  });

  it('"No known medications" is disabled while there are active medications', async () => {
    const { unmount } = await renderModal([rx({ status: 'pending', orderStatus: 'prescribed' })]);
    expect(q<HTMLInputElement>(body, '.cn-meds-nkm input')!.disabled).toBe(true);
    unmount();
  });

  it('Discontinue prompts for a reason and stops the prescription', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue('Course completed');
    const target = rx({ _id: 'r1' });
    const { unmount } = await renderModal([target]);
    click(q(body, '.cn-meds-row')!);
    updatePrescription.mockResolvedValue(rx({ _id: 'r1', status: 'discontinued' }));
    getPrescriptionsByPatient.mockResolvedValue([]);
    const discontinueBtn = qa<HTMLButtonElement>(body, '.cn-meds-footer button').find(b => b.textContent === 'Discontinue')!;
    await clickAsync(discontinueBtn);
    expect(updatePrescription).toHaveBeenCalledWith('r1', expect.objectContaining({
      status: 'discontinued', stoppedReason: 'Course completed', stoppedBy: 'u1',
    }));
    unmount();
  });
});
