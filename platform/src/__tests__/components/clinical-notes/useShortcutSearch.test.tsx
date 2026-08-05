/**
 * useShortcutSearch — state behind a note section's Text Shortcut search:
 * lazy load-on-first-open, seeding the starter set when a user has none,
 * per-section reset, and use-count bumping on pick.
 */
import { useShortcutSearch, type ShortcutSearch } from '@/components/clinical-notes/shortcuts/useShortcutSearch';
import type { TextShortcutDoc } from '@/lib/clinical-notes/types';
import { mount, rerender, actFlush } from './test-utils';

const getTextShortcuts = jest.fn();
const bumpShortcutUse = jest.fn().mockResolvedValue(undefined);
const seedTextShortcutsFor = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/clinical-notes/text-shortcut-service', () => ({
  getTextShortcuts: (...args: unknown[]) => getTextShortcuts(...args),
  bumpShortcutUse: (...args: unknown[]) => bumpShortcutUse(...args),
}));
jest.mock('@/lib/clinical-notes/seed', () => ({
  seedTextShortcutsFor: (...args: unknown[]) => seedTextShortcutsFor(...args),
}));

function shortcut(over: Partial<TextShortcutDoc> = {}): TextShortcutDoc {
  return {
    _id: 's1', type: 'text_shortcut', userId: 'u1', name: 'nad', body: 'No acute distress.',
    createdAt: '2026-01-01', updatedAt: '2026-01-01', ...over,
  } as TextShortcutDoc;
}

/** Captures the hook's latest return value on every render for assertions. */
function Harness({ userId = 'u1', orgId, sectionId = 'plan' as const, onPick, out }: {
  userId?: string; orgId?: string; sectionId?: 'plan' | 'assessment'; onPick: (s: TextShortcutDoc) => void;
  out: { current: ShortcutSearch };
}) {
  out.current = useShortcutSearch({ userId, orgId, sectionId, onPick });
  return null;
}

describe('useShortcutSearch', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('does not load anything until openList() is called', () => {
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    expect(getTextShortcuts).not.toHaveBeenCalled();
    expect(out.current.open).toBe(false);
    unmount();
  });

  it('openList loads the section\'s shortcuts and opens the list', async () => {
    getTextShortcuts.mockResolvedValue([shortcut()]);
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    expect(getTextShortcuts).toHaveBeenCalledWith({ userId: 'u1', orgId: undefined, sectionId: 'plan' });
    expect(out.current.open).toBe(true);
    expect(out.current.results.map(r => r._id)).toEqual(['s1']);
    unmount();
  });

  it('opening a second time for the same section does not reload', async () => {
    getTextShortcuts.mockResolvedValue([shortcut()]);
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    await actFlush(() => out.current.close());
    await actFlush(() => out.current.openList());
    expect(getTextShortcuts).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('seeds the starter set when the user has no shortcuts yet, then re-reads', async () => {
    getTextShortcuts
      .mockResolvedValueOnce([]) // first read: nothing yet
      .mockResolvedValueOnce([shortcut({ name: 'starter' })]); // after seeding
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    expect(seedTextShortcutsFor).toHaveBeenCalledWith('u1', { orgId: undefined });
    expect(getTextShortcuts).toHaveBeenCalledTimes(2);
    expect(out.current.results.map(r => r.name)).toEqual(['starter']);
    unmount();
  });

  it('seeding failure still leaves a usable (empty) search rather than an unhandled rejection', async () => {
    getTextShortcuts.mockResolvedValueOnce([]);
    seedTextShortcutsFor.mockRejectedValueOnce(new Error('seed failed'));
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    expect(out.current.results).toEqual([]);
    expect(out.current.empty).toBe(true);
    expect(out.current.loading).toBe(false);
    unmount();
  });

  it('does not seed when the section genuinely has shortcuts already', async () => {
    getTextShortcuts.mockResolvedValue([shortcut()]);
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    expect(seedTextShortcutsFor).not.toHaveBeenCalled();
    unmount();
  });

  it('filters results by query against name and body', async () => {
    getTextShortcuts.mockResolvedValue([
      shortcut({ _id: 's1', name: 'nad', body: 'No acute distress.' }),
      shortcut({ _id: 's2', name: 'ros-neg', body: 'Review of systems negative.' }),
    ]);
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    await actFlush(() => out.current.setQuery('distress'));
    expect(out.current.results.map(r => r._id)).toEqual(['s1']);
    await actFlush(() => out.current.setQuery(''));
    expect(out.current.results.map(r => r._id)).toEqual(['s1', 's2']);
    unmount();
  });

  it('choose() applies the pick, bumps use count, and closes/clears the query', async () => {
    const picked = shortcut();
    getTextShortcuts.mockResolvedValue([picked]);
    const onPick = jest.fn();
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={onPick} out={out} />);
    await actFlush(() => out.current.openList());
    await actFlush(() => out.current.setQuery('nad'));
    await actFlush(() => out.current.choose(picked));
    expect(onPick).toHaveBeenCalledWith(picked);
    expect(bumpShortcutUse).toHaveBeenCalledWith('s1');
    expect(out.current.open).toBe(false);
    expect(out.current.query).toBe('');
    unmount();
  });

  it('switching section id resets the list — a section change must not keep the previous section\'s shortcuts', async () => {
    getTextShortcuts
      .mockResolvedValueOnce([shortcut({ _id: 'plan-1' })])
      .mockResolvedValueOnce([shortcut({ _id: 'assessment-1' })]);
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { root, unmount } = mount(<Harness sectionId="plan" onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    expect(out.current.results.map(r => r._id)).toEqual(['plan-1']);

    await actFlush(() => rerender(root, <Harness sectionId="assessment" onPick={jest.fn()} out={out} />));
    expect(out.current.open).toBe(false);
    expect(out.current.results).toEqual([]);

    await actFlush(() => out.current.openList());
    expect(getTextShortcuts).toHaveBeenLastCalledWith({ userId: 'u1', orgId: undefined, sectionId: 'assessment' });
    expect(out.current.results.map(r => r._id)).toEqual(['assessment-1']);
    unmount();
  });

  it('empty vs no-match are distinguished for the results panel to word correctly', async () => {
    getTextShortcuts.mockResolvedValue([]);
    const out: { current: ShortcutSearch } = { current: null as unknown as ShortcutSearch };
    const { unmount } = mount(<Harness onPick={jest.fn()} out={out} />);
    await actFlush(() => out.current.openList());
    expect(out.current.empty).toBe(true); // no shortcuts saved at all
    unmount();
  });
});
