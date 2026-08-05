/**
 * NoteSectionCard — one section of a note: heading, action row, shortcut
 * search, and body (narrative textarea, or a derived read-only snapshot).
 */
import { act } from 'react';
import type { NoteSectionContent } from '@/lib/clinical-notes/types';
import { mount, click, setValue, q, qa } from './test-utils';

const getTextShortcuts = jest.fn().mockResolvedValue([]);
const bumpShortcutUse = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/clinical-notes/text-shortcut-service', () => ({
  getTextShortcuts: (...a: unknown[]) => getTextShortcuts(...a),
  bumpShortcutUse: (...a: unknown[]) => bumpShortcutUse(...a),
  applyShortcut: (existing: string, body: string) => (existing ? `${existing}\n\n${body}` : body),
}));
jest.mock('@/lib/clinical-notes/seed', () => ({ seedTextShortcutsFor: jest.fn().mockResolvedValue(undefined) }));

import NoteSectionCard from '@/components/clinical-notes/NoteSectionCard';

function content(over: Partial<NoteSectionContent> = {}): NoteSectionContent {
  return { sectionId: 'plan', text: '', ...over } as NoteSectionContent;
}

describe('NoteSectionCard — narrative sections', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('an editable narrative section renders a labelled textarea and calls onChange on typing', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard
        sectionId="subjective" content={content({ sectionId: 'subjective', text: '' })}
        readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={onChange}
      />,
    );
    const textarea = q<HTMLTextAreaElement>(container, 'textarea[aria-label="Subjective"]')!;
    setValue(textarea, 'Patient reports headache.');
    expect(onChange).toHaveBeenCalledWith({ text: 'Patient reports headache.' });
    unmount();
  });

  it('a read-only narrative section shows stripped text, not a textarea', () => {
    const { container, unmount } = mount(
      <NoteSectionCard
        sectionId="subjective" content={content({ sectionId: 'subjective', text: 'Some history.' })}
        readOnly userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()}
      />,
    );
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain('Some history.');
    unmount();
  });

  it('a read-only section with no content says "Not documented."', () => {
    const { container, unmount } = mount(
      <NoteSectionCard
        sectionId="subjective" content={content({ sectionId: 'subjective', text: '' })}
        readOnly userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()}
      />,
    );
    expect(container.textContent).toContain('Not documented.');
    unmount();
  });

  it('focusing the textarea calls onFocus', () => {
    const onFocus = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard
        sectionId="subjective" content={content({ sectionId: 'subjective' })}
        readOnly={false} userId="u1" active={false} onFocus={onFocus} onChange={jest.fn()}
      />,
    );
    const textarea = q<HTMLTextAreaElement>(container, 'textarea')!;
    act(() => { textarea.focus(); });
    expect(onFocus).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('adds "is-active" only when active is true', () => {
    const { container: c1, unmount: u1 } = mount(
      <NoteSectionCard sectionId="subjective" content={content({ sectionId: 'subjective' })} readOnly={false} userId="u1" active onFocus={jest.fn()} onChange={jest.fn()} />,
    );
    expect(q(c1, '.cn-section')!.className).toContain('is-active');
    u1();
    const { container: c2, unmount: u2 } = mount(
      <NoteSectionCard sectionId="subjective" content={content({ sectionId: 'subjective' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} />,
    );
    expect(q(c2, '.cn-section')!.className).not.toContain('is-active');
    u2();
  });

  it('narrative sections with no defined actions (e.g. Subjective) show no action buttons, but sections do show the shortcut search', () => {
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="subjective" content={content({ sectionId: 'subjective' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} onAction={jest.fn()} />,
    );
    expect(qa(container, '.cn-tool[title]').length).toBe(0);
    expect(q(container, '.cn-shortcut-field')).not.toBeNull();
    unmount();
  });

  it('hides the shortcut search and action row entirely when read-only', () => {
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="plan" content={content({ sectionId: 'plan' })} readOnly userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} onAction={jest.fn()} />,
    );
    expect(q(container, '.cn-shortcut-field')).toBeNull();
    expect(qa(container, '.cn-tool').length).toBe(0);
    unmount();
  });

  it('Plan renders its full action row and reports the pressed action id', () => {
    const onAction = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="plan" content={content({ sectionId: 'plan' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} onAction={onAction} />,
    );
    const labels = qa<HTMLButtonElement>(container, '.cn-section-tools .cn-tool').map(b => b.textContent);
    expect(labels.join('|')).toContain('Prescribe');
    expect(labels.join('|')).toContain('Refer');
    const orderLab = qa<HTMLButtonElement>(container, '.cn-tool').find(b => b.textContent?.includes('Labs/Studies'))!;
    click(orderLab);
    expect(onAction).toHaveBeenCalledWith('order_lab');
    unmount();
  });

  it('does not render an action row at all when onAction is omitted, even for Plan', () => {
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="plan" content={content({ sectionId: 'plan' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} />,
    );
    expect(qa(container, '.cn-tool').filter(el => el.getAttribute('title')?.includes('Raise a laboratory'))).toHaveLength(0);
    unmount();
  });

  it('the remove control appears only when removable, onRemove is set, and not read-only', () => {
    const onRemove = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard
        sectionId="ros" content={content({ sectionId: 'ros' })} readOnly={false} userId="u1" active={false}
        onFocus={jest.fn()} onChange={jest.fn()} removable onRemove={onRemove}
      />,
    );
    const removeBtn = q<HTMLButtonElement>(container, '[aria-label="Remove the Review of Systems section"]')!;
    click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('picking a shortcut applies it into the section text via onChange', async () => {
    getTextShortcuts.mockResolvedValue([{ _id: 's1', type: 'text_shortcut', userId: 'u1', name: 'nad', body: 'No acute distress.', createdAt: '', updatedAt: '' }]);
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="ros" content={content({ sectionId: 'ros', text: 'Existing.' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={onChange} />,
    );
    const input = q<HTMLInputElement>(container, 'input.cn-shortcut-input')!;
    act(() => { input.focus(); });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    const item = qa<HTMLButtonElement>(container, '.cn-popover-item').find(b => b.textContent?.includes('nad'))!;
    click(item);
    expect(onChange).toHaveBeenCalledWith({ text: 'Existing.\n\nNo acute distress.' });
    unmount();
  });
});

describe('NoteSectionCard — assessment section', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders diagnosis lines above the narrative textarea, and removing one patches onChange with diagnoses only', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard
        sectionId="assessment"
        content={content({
          sectionId: 'assessment', text: 'Narrative here.',
          diagnoses: [{ id: 'dx1', name: 'Malaria', addedAt: '2026-01-01T00:00:00.000Z' }],
        })}
        readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={onChange}
      />,
    );
    expect(container.textContent).toContain('Malaria');
    click(q<HTMLButtonElement>(container, '.cn-dx-remove')!);
    expect(onChange).toHaveBeenCalledWith({ diagnoses: [] });
    // The narrative textarea is untouched by the diagnosis-line change.
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.anything() }));
    unmount();
  });

  it('renders no diagnosis block when there are none yet', () => {
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="assessment" content={content({ sectionId: 'assessment', diagnoses: [] })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} />,
    );
    expect(q(container, '.cn-dx')).toBeNull();
    unmount();
  });
});

describe('NoteSectionCard — derived sections', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders the snapshot read-only with no textarea, even when not readOnly', () => {
    const { container, unmount } = mount(
      <NoteSectionCard
        sectionId="medications" content={content({ sectionId: 'medications', snapshot: 'Amoxicillin 500mg TDS' })}
        readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()}
      />,
    );
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain('Amoxicillin 500mg TDS');
    unmount();
  });

  it('shows a "no medications recorded" fallback when the snapshot is empty', () => {
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="medications" content={content({ sectionId: 'medications', snapshot: '' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} />,
    );
    expect(container.textContent).toContain('No medications recorded for this patient.');
    unmount();
  });

  it('Refresh calls onRefreshDerived with this section id', () => {
    const onRefreshDerived = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="vitals" content={content({ sectionId: 'vitals' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} onRefreshDerived={onRefreshDerived} />,
    );
    click(qa<HTMLButtonElement>(container, '.cn-tool').find(b => b.textContent?.includes('Refresh'))!);
    expect(onRefreshDerived).toHaveBeenCalledWith('vitals');
    unmount();
  });

  it('with onOpenDerived, the snapshot itself is a button-role click target', () => {
    const onOpenDerived = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="medications" content={content({ sectionId: 'medications', snapshot: 'Amoxicillin' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} onOpenDerived={onOpenDerived} />,
    );
    const clickable = q<HTMLDivElement>(container, '.cn-derived-clickable')!;
    expect(clickable.getAttribute('role')).toBe('button');
    click(clickable);
    expect(onOpenDerived).toHaveBeenCalledWith('medications');
    unmount();
  });

  it('Enter and Space on the clickable snapshot also open the derived view', () => {
    const onOpenDerived = jest.fn();
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="medications" content={content({ sectionId: 'medications', snapshot: 'Amoxicillin' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} onOpenDerived={onOpenDerived} />,
    );
    const clickable = q<HTMLDivElement>(container, '.cn-derived-clickable')!;
    act(() => { clickable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
    expect(onOpenDerived).toHaveBeenCalledTimes(1);
    act(() => { clickable.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })); });
    expect(onOpenDerived).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('without onOpenDerived, the snapshot is a plain non-interactive block', () => {
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="medications" content={content({ sectionId: 'medications', snapshot: 'Amoxicillin' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} />,
    );
    expect(q(container, '.cn-derived-clickable')).toBeNull();
    expect(q(container, '[role="button"]')).toBeNull();
    unmount();
  });

  it('a derived section is not offered a "removable" X even if the props claim it — only narrative sections support removal in the markup', () => {
    // Medications is never optional (it's a source-backed derived section);
    // the derived branch of the component simply never renders a remove
    // control, regardless of the removable/onRemove props.
    const { container, unmount } = mount(
      <NoteSectionCard sectionId="medications" content={content({ sectionId: 'medications' })} readOnly={false} userId="u1" active={false} onFocus={jest.fn()} onChange={jest.fn()} removable onRemove={jest.fn()} />,
    );
    expect(qa(container, '.cn-section-nav-remove, .cn-dx-remove').length).toBe(0);
    unmount();
  });
});
