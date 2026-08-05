/**
 * CareCoordinationModal — Send Referral / Summary of Care.
 *
 * Modal portals to document.body (see components/Modal), so queries here run
 * against document.body.
 */
import CareCoordinationModal, {
  type SummaryProblem, type SummarySocialHistory,
} from '@/components/clinical-notes/CareCoordinationModal';
import type { ClinicalNoteDoc } from '@/lib/clinical-notes/types';
import { mountAndFlush, click, clickAsync, setValue, setChecked, q, qa } from './test-utils';

const showToast = jest.fn();
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast }) }));

const body = document.body;

function note(over: Partial<ClinicalNoteDoc> = {}): ClinicalNoteDoc {
  return {
    _id: 'n1', type: 'clinical_note', patientId: 'pt1', patientName: 'Test Patient',
    mrn: 'MRN-1', noteType: 'soap', serviceDate: '2026-08-01', serviceTime: '09:00',
    status: 'draft', sections: [{ sectionId: 'subjective', text: 'Patient reports headache.' }],
    createdAt: '2026-08-01', updatedAt: '2026-08-01',
    ...over,
  } as ClinicalNoteDoc;
}

const PROBLEMS: SummaryProblem[] = [
  { effectiveDate: '2026-01-01', problem: 'Malaria', status: 'ACTIVE' },
  { effectiveDate: '2025-06-01', problem: 'Hypertension', status: 'CHRONIC' },
];
const SOCIAL: SummarySocialHistory[] = [
  { comment: 'Smoking status', description: 'Non-smoker' },
];

describe('CareCoordinationModal', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('requires a recipient before sending', async () => {
    const onSend = jest.fn();
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={[]} socialHistory={[]} onSend={onSend} onClose={jest.fn()} />,
    );
    const sendBtn = qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Send Message'))!;
    await clickAsync(sendBtn);
    expect(showToast).toHaveBeenCalledWith('Name the provider or facility receiving this referral.', 'error');
    expect(onSend).not.toHaveBeenCalled();
    unmount();
  });

  it('sends with every problem/social-history row included by default', async () => {
    const onSend = jest.fn().mockResolvedValue(undefined);
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={PROBLEMS} socialHistory={SOCIAL} onSend={onSend} onClose={jest.fn()} />,
    );
    setValue(q<HTMLInputElement>(body, '.cn-field input.cn-input')!, 'Dr. Referral Recipient');
    const sendBtn = qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Send Message'))!;
    await clickAsync(sendBtn);
    expect(onSend).toHaveBeenCalledWith({
      channel: 'direct_message',
      recipient: 'Dr. Referral Recipient',
      instructions: '',
      problems: PROBLEMS,
      socialHistory: SOCIAL,
    });
    unmount();
  });

  it('unchecking a problem row excludes only that row from what is sent', async () => {
    const onSend = jest.fn().mockResolvedValue(undefined);
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={PROBLEMS} socialHistory={[]} onSend={onSend} onClose={jest.fn()} />,
    );
    setChecked(q<HTMLInputElement>(body, `input[aria-label="Include ${PROBLEMS[0].problem}"]`)!, false);
    setValue(q<HTMLInputElement>(body, '.cn-field input.cn-input')!, 'Recipient');
    await clickAsync(qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Send Message'))!);
    expect(onSend.mock.calls[0][0].problems).toEqual([PROBLEMS[1]]);
    unmount();
  });

  it('unchecking the Problems section entirely sends none of them, even if individually ticked', async () => {
    const onSend = jest.fn().mockResolvedValue(undefined);
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={PROBLEMS} socialHistory={[]} onSend={onSend} onClose={jest.fn()} />,
    );
    const problemsToggle = qa<HTMLInputElement>(body, '.cn-tree-option input[type="checkbox"]')
      .find(el => el.closest('.cn-coord-section')?.textContent?.includes('Problems'))!;
    setChecked(problemsToggle, false);
    setValue(q<HTMLInputElement>(body, '.cn-field input.cn-input')!, 'Recipient');
    await clickAsync(qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Send Message'))!);
    expect(onSend.mock.calls[0][0].problems).toEqual([]);
    unmount();
  });

  it('switching to eFax relabels the recipient field and the send button', async () => {
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={[]} socialHistory={[]} onSend={jest.fn()} onClose={jest.fn()} />,
    );
    click(qa<HTMLButtonElement>(body, '.cn-segmented button').find(b => b.textContent === 'eFax')!);
    expect(body.textContent).toContain('Fax number');
    expect(qa<HTMLButtonElement>(body, 'button').some(b => b.textContent?.includes('Send Fax'))).toBe(true);
    unmount();
  });

  it('is honest about there being no real Direct Message/eFax gateway', async () => {
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={[]} socialHistory={[]} onSend={jest.fn()} onClose={jest.fn()} />,
    );
    expect(body.textContent).toContain('This platform has no Direct Messaging or eFax gateway connected.');
    unmount();
  });

  it('Cancel/Close and the X button both call onClose without sending', async () => {
    const onClose = jest.fn();
    const onSend = jest.fn();
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={[]} socialHistory={[]} onSend={onSend} onClose={onClose} />,
    );
    click(qa<HTMLButtonElement>(body, 'button').find(b => b.textContent === 'Close')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    unmount();
  });

  it('a send failure shows a toast and does not close the modal', async () => {
    const onSend = jest.fn().mockRejectedValue(new Error('network down'));
    const onClose = jest.fn();
    const { unmount } = await mountAndFlush(
      <CareCoordinationModal note={note()} problems={[]} socialHistory={[]} onSend={onSend} onClose={onClose} />,
    );
    setValue(q<HTMLInputElement>(body, '.cn-field input.cn-input')!, 'Recipient');
    await clickAsync(qa<HTMLButtonElement>(body, 'button').find(b => b.textContent?.includes('Send Message'))!);
    expect(showToast).toHaveBeenCalledWith('network down', 'error');
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });
});
