/**
 * AssessmentSection — the diagnosis-line cards above the Assessment
 * narrative, sourced only from what "Include Problems" hands over.
 */
import AssessmentSection from '@/components/clinical-notes/assessment/AssessmentSection';
import type { NoteDiagnosis } from '@/lib/clinical-notes/types';
import { mount, click, qa } from './test-utils';

function dx(over: Partial<NoteDiagnosis> = {}): NoteDiagnosis {
  return { id: 'dx-1', name: 'Malaria', addedAt: '2025-12-09T10:00:00.000Z', ...over };
}

describe('AssessmentSection', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders nothing when there are no diagnoses', () => {
    const { container, unmount } = mount(
      <AssessmentSection diagnoses={[]} readOnly={false} onChangeDiagnoses={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
    unmount();
  });

  it('renders name, ICD-11 code, description and a modified date', () => {
    const { container, unmount } = mount(
      <AssessmentSection
        diagnoses={[dx({
          name: 'Influenza', icd11Code: '1E32',
          description: 'Flu due to unidentified influenza virus',
          addedAt: '2025-12-09T10:00:00.000Z',
        })]}
        readOnly={false}
        onChangeDiagnoses={jest.fn()}
      />,
    );
    const line = container.textContent!;
    expect(line).toContain('Influenza');
    expect(line).toContain('(1E32)');
    expect(line).toContain('Flu due to unidentified influenza virus');
    expect(line).toContain('modified 9 Dec 2025');
    unmount();
  });

  it('does not repeat the description when it is identical to the name', () => {
    const { container, unmount } = mount(
      <AssessmentSection diagnoses={[dx({ name: 'Malaria', description: 'Malaria' })]} readOnly={false} onChangeDiagnoses={jest.fn()} />,
    );
    // "Malaria" should appear once as the bold name, not duplicated.
    expect(container.textContent!.match(/Malaria/g)?.length).toBe(1);
    unmount();
  });

  it('omits the ICD-11 parenthetical for an uncoded (free-text) diagnosis', () => {
    const { container, unmount } = mount(
      <AssessmentSection diagnoses={[dx({ name: 'Feeling unwell', icd11Code: undefined })]} readOnly={false} onChangeDiagnoses={jest.fn()} />,
    );
    expect(container.textContent).not.toContain('(');
    unmount();
  });

  it('removing a line calls onChangeDiagnoses with that line filtered out', () => {
    const onChangeDiagnoses = jest.fn();
    const lines = [dx({ id: 'dx-1', name: 'Malaria' }), dx({ id: 'dx-2', name: 'Anaemia' })];
    const { container, unmount } = mount(
      <AssessmentSection diagnoses={lines} readOnly={false} onChangeDiagnoses={onChangeDiagnoses} />,
    );
    const removeButtons = qa<HTMLButtonElement>(container, '.cn-dx-remove');
    expect(removeButtons).toHaveLength(2);
    click(removeButtons[0]);
    expect(onChangeDiagnoses).toHaveBeenCalledWith([lines[1]]);
    unmount();
  });

  it('hides the remove control when read-only (a signed note)', () => {
    const { container, unmount } = mount(
      <AssessmentSection diagnoses={[dx()]} readOnly onChangeDiagnoses={jest.fn()} />,
    );
    expect(qa(container, '.cn-dx-remove')).toHaveLength(0);
    unmount();
  });
});
