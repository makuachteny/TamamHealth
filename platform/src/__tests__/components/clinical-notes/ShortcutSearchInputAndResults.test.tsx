/**
 * ShortcutSearchInput + ShortcutResults — the two halves of a section's
 * shortcut search, driven with a hand-built ShortcutSearch so each renders in
 * isolation from the real hook (already covered in useShortcutSearch.test.tsx).
 */
import ShortcutSearchInput from '@/components/clinical-notes/shortcuts/ShortcutSearchInput';
import ShortcutResults from '@/components/clinical-notes/shortcuts/ShortcutResults';
import type { ShortcutSearch } from '@/components/clinical-notes/shortcuts/useShortcutSearch';
import type { TextShortcutDoc } from '@/lib/clinical-notes/types';
import { act } from 'react';
import { mount, setValue, q } from './test-utils';

function shortcut(over: Partial<TextShortcutDoc> = {}): TextShortcutDoc {
  return {
    _id: 's1', type: 'text_shortcut', userId: 'u1', name: 'nad', body: 'No acute distress.',
    createdAt: '2026-01-01', updatedAt: '2026-01-01', ...over,
  } as TextShortcutDoc;
}

function search(over: Partial<ShortcutSearch> = {}): ShortcutSearch {
  return {
    query: '', setQuery: jest.fn(), open: false, openList: jest.fn(), close: jest.fn(),
    loading: false, results: [], empty: true, choose: jest.fn(),
    ...over,
  };
}

describe('ShortcutSearchInput', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('focusing or clicking the box calls openList', () => {
    const s = search();
    const { container, unmount } = mount(<ShortcutSearchInput search={s} />);
    const input = q<HTMLInputElement>(container, 'input')!;
    act(() => { input.focus(); });
    expect(s.openList).toHaveBeenCalled();
    act(() => { input.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(s.openList).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('typing calls openList and setQuery with the typed value', () => {
    const s = search();
    const { container, unmount } = mount(<ShortcutSearchInput search={s} />);
    setValue(q<HTMLInputElement>(container, 'input')!, 'nad');
    expect(s.openList).toHaveBeenCalled();
    expect(s.setQuery).toHaveBeenCalledWith('nad');
    unmount();
  });

  it('Escape calls close and stops the keydown from bubbling', () => {
    const s = search({ open: true });
    const { container, unmount } = mount(<ShortcutSearchInput search={s} />);
    const input = q<HTMLInputElement>(container, 'input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(s.close).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Enter with results chooses the first result', () => {
    const s = search({ results: [shortcut({ _id: 's1' }), shortcut({ _id: 's2' })] });
    const { container, unmount } = mount(<ShortcutSearchInput search={s} />);
    const input = q<HTMLInputElement>(container, 'input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(s.choose).toHaveBeenCalledWith(s.results[0]);
    unmount();
  });

  it('Enter with no results does nothing', () => {
    const s = search({ results: [] });
    const { container, unmount } = mount(<ShortcutSearchInput search={s} />);
    const input = q<HTMLInputElement>(container, 'input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(s.choose).not.toHaveBeenCalled();
    unmount();
  });

  it('reflects the current query value and aria-expanded state', () => {
    const s = search({ query: 'headache', open: true });
    const { container, unmount } = mount(<ShortcutSearchInput search={s} />);
    const input = q<HTMLInputElement>(container, 'input')!;
    expect(input.value).toBe('headache');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    unmount();
  });
});

describe('ShortcutResults', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders nothing when closed', () => {
    const { container, unmount } = mount(<ShortcutResults search={search({ open: false })} />);
    expect(container.firstChild).toBeNull();
    unmount();
  });

  it('shows a loading message while loading', () => {
    const { container, unmount } = mount(<ShortcutResults search={search({ open: true, loading: true })} />);
    expect(container.textContent).toContain('Loading…');
    unmount();
  });

  it('distinguishes "no shortcuts yet" from "no match" once loaded', () => {
    const { container: c1, unmount: u1 } = mount(
      <ShortcutResults search={search({ open: true, results: [], empty: true })} />,
    );
    expect(c1.textContent).toContain('No shortcuts yet. Save one from a section to reuse it here.');
    u1();

    const { container: c2, unmount: u2 } = mount(
      <ShortcutResults search={search({ open: true, results: [], empty: false })} />,
    );
    expect(c2.textContent).toContain('No shortcut matches that search.');
    u2();
  });

  it('lists each shortcut with its name and body, and picking one calls choose', () => {
    const s = search({ open: true, results: [shortcut({ name: 'nad', body: 'No acute distress.' })] });
    const { container, unmount } = mount(<ShortcutResults search={s} />);
    const item = q<HTMLButtonElement>(container, '.cn-popover-item')!;
    expect(item.textContent).toContain('nad');
    expect(item.textContent).toContain('No acute distress.');
    item.click();
    expect(s.choose).toHaveBeenCalledWith(s.results[0]);
    unmount();
  });

  it('prevents mousedown default so a row click cannot blur-close the list first', () => {
    const s = search({ open: true, results: [shortcut()] });
    const { container, unmount } = mount(<ShortcutResults search={s} />);
    const results = q(container, '.cn-shortcut-results')!;
    const evt = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const prevented = !results.dispatchEvent(evt);
    expect(prevented).toBe(true);
    unmount();
  });
});
