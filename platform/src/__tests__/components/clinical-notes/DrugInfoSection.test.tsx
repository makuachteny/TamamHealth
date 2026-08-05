/**
 * DrugInfoSection — the prescribing form: drug search (name-only by default,
 * widens to class/ATC under Advanced Search), quantity/refills/days supply,
 * Reason For Rx cited from the active problem list, recommended sigs, and the
 * favorites toggle.
 */
import { useState } from 'react';
import DrugInfoSection from '@/components/clinical-notes/prescribe/DrugInfoSection';
import { emptyDraft, type RxDraft } from '@/components/clinical-notes/prescribe/types';
import type { ProblemDoc } from '@/lib/db-types';
import { mount, setValue, click, q, qa } from './test-utils';

function Harness({ problems = [] as ProblemDoc[], isFavorite = false, onToggleFavorite = jest.fn() }) {
  const [draft, setDraft] = useState<RxDraft>(() => emptyDraft('This facility'));
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [showSigs, setShowSigs] = useState(true);
  const [showReasons, setShowReasons] = useState(false);
  return (
    <DrugInfoSection
      draft={draft}
      onChange={p => setDraft(d => ({ ...d, ...p }))}
      query={query}
      onQueryChange={setQuery}
      advanced={advanced}
      onToggleAdvanced={() => setAdvanced(v => !v)}
      problems={problems}
      serviceLocations={['This facility']}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      showSigs={showSigs}
      onToggleSigs={() => setShowSigs(v => !v)}
      showReasons={showReasons}
      onToggleReasons={() => setShowReasons(v => !v)}
    />
  );
}

function problem(over: Partial<ProblemDoc> = {}): ProblemDoc {
  return {
    _id: 'pr1', type: 'problem', patientId: 'pt1', patientName: 'Test',
    name: 'Malaria', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...over,
  } as ProblemDoc;
}

describe('DrugInfoSection', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('does not search until at least two characters are typed', () => {
    const { container, unmount } = mount(<Harness />);
    const input = q<HTMLInputElement>(container, 'input[aria-label="Drug name"]')!;
    setValue(input, 'a');
    expect(document.querySelector('.cn-rx-results')).toBeNull();
    unmount();
  });

  it('name search (non-advanced) matches by name only, not category', () => {
    const { container, unmount } = mount(<Harness />);
    const input = q<HTMLInputElement>(container, 'input[aria-label="Drug name"]')!;
    setValue(input, 'antibiotic'); // a category, not a drug name
    expect(qa(container, '.cn-rx-results button')).toHaveLength(0);
    setValue(input, 'Amoxicillin');
    const results = qa<HTMLButtonElement>(container, '.cn-rx-results button');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(b => b.textContent?.includes('Amoxicillin'))).toBe(true);
    unmount();
  });

  it('Advanced Search widens matching to category and ATC prefix', () => {
    const { container, unmount } = mount(<Harness />);
    click(q(container, '.cn-rx-inlinerow .cn-card-head-action')!); // Advanced Search toggle
    const input = q<HTMLInputElement>(container, 'input[aria-label="Drug name"]')!;
    setValue(input, 'antibiotic');
    const results = qa<HTMLButtonElement>(container, '.cn-rx-results button');
    expect(results.length).toBeGreaterThan(0);
    unmount();
  });

  it('picking a result sets the drug and clears the query', () => {
    const { container, unmount } = mount(<Harness />);
    const input = q<HTMLInputElement>(container, 'input[aria-label="Drug name"]')!;
    setValue(input, 'Amoxicillin');
    const first = qa<HTMLButtonElement>(container, '.cn-rx-results button')[0];
    click(first);
    expect(input.value).toContain('Amoxicillin');
    expect(document.querySelector('.cn-rx-results')).toBeNull();
    unmount();
  });

  it('editing the drug name after a pick clears the picked drug', () => {
    const { container, unmount } = mount(<Harness />);
    const input = q<HTMLInputElement>(container, 'input[aria-label="Drug name"]')!;
    setValue(input, 'Amoxicillin');
    click(qa<HTMLButtonElement>(container, '.cn-rx-results button')[0]);
    // Favorite button is disabled without a drug, enabled once picked.
    expect(q<HTMLButtonElement>(container, '.cn-rx-favorite')!.disabled).toBe(false);
    setValue(input, 'Something else');
    expect(q<HTMLButtonElement>(container, '.cn-rx-favorite')!.disabled).toBe(true);
    unmount();
  });

  it('Reason For Rx offers nothing to cite when there are no active problems', () => {
    const { container, unmount } = mount(<Harness problems={[]} />);
    click(qa<HTMLButtonElement>(container, '.cn-card-head-action')
      .find(b => b.textContent === 'Add Reason')!);
    expect(container.textContent).toContain('No active problems to cite — add one from the Assessment.');
    unmount();
  });

  it('picking a problem sets the reason, prefixed with its ICD-11 code', () => {
    const { container, unmount } = mount(
      <Harness problems={[problem({ name: 'Malaria', icd11Code: '1F40' })]} />,
    );
    click(qa<HTMLButtonElement>(container, '.cn-card-head-action')
      .find(b => b.textContent === 'Add Reason')!);
    const problemBtn = qa<HTMLButtonElement>(container, '.cn-rx-results button')
      .find(b => b.textContent?.includes('Malaria'))!;
    click(problemBtn);
    expect(container.textContent).toContain('1F40 · Malaria');
    // Picking closes the reason picker again.
    expect(document.querySelector('.cn-rx-reason .cn-rx-results')).toBeNull();
    unmount();
  });

  it('a problem with no ICD-11 code is cited by name alone', () => {
    const { container, unmount } = mount(
      <Harness problems={[problem({ name: 'Unspecified fever', icd11Code: undefined })]} />,
    );
    click(qa<HTMLButtonElement>(container, '.cn-card-head-action')
      .find(b => b.textContent === 'Add Reason')!);
    click(qa<HTMLButtonElement>(container, '.cn-rx-results button')[0]);
    const chip = q(container, '.cn-rx-reason-chip')!;
    expect(chip.textContent).toBe('Unspecified fever');
    unmount();
  });

  it('clicking a recommended sig sets it as the patient instructions', () => {
    const { container, unmount } = mount(<Harness />);
    const sigButtons = qa<HTMLButtonElement>(container, '.cn-rx-sigs button');
    expect(sigButtons.length).toBeGreaterThan(0);
    click(sigButtons[0]);
    const textarea = q<HTMLTextAreaElement>(container, 'textarea[aria-label="Patient instructions"]')!;
    expect(textarea.value).toContain(sigButtons[0].textContent!.replace('• ', ''));
    unmount();
  });

  it('the favorites toggle is disabled until a drug is picked, and calls back once picked', () => {
    const onToggleFavorite = jest.fn();
    const { container, unmount } = mount(<Harness onToggleFavorite={onToggleFavorite} />);
    const favBtn = q<HTMLButtonElement>(container, '.cn-rx-favorite')!;
    expect(favBtn.disabled).toBe(true);
    const input = q<HTMLInputElement>(container, 'input[aria-label="Drug name"]')!;
    setValue(input, 'Amoxicillin');
    click(qa<HTMLButtonElement>(container, '.cn-rx-results button')[0]);
    expect(favBtn.disabled).toBe(false);
    click(favBtn);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('reflects isFavorite in the button label and pressed state', () => {
    const { container, unmount } = mount(<Harness isFavorite />);
    const favBtn = q<HTMLButtonElement>(container, '.cn-rx-favorite')!;
    expect(favBtn.textContent).toContain('In Favorites');
    expect(favBtn.getAttribute('aria-pressed')).toBe('true');
    unmount();
  });
});
