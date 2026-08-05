/**
 * AssignPicker — the "Assigned to" menu-as-a-list-of-buttons control.
 */
import { act } from 'react';
import AssignPicker, { type AssignOption } from '@/components/clinical-notes/AssignPicker';
import { mount, click, clickAsync, q, qa } from './test-utils';

const OPTIONS: AssignOption[] = [
  { _id: 'u1', name: 'Deng Mabior Kuol' },
  { _id: 'u2', name: 'Stella Keji Lemi' },
];

describe('AssignPicker', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows "None" when nothing is assigned', () => {
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} onAssign={jest.fn()} />,
    );
    expect(q(container, '.cn-assign-name')!.textContent).toBe('None');
    unmount();
  });

  it('falls back to valueName when the assigned id is not among the options', () => {
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} value="gone" valueName="Departed Provider" onAssign={jest.fn()} />,
    );
    expect(q(container, '.cn-assign-name')!.textContent).toBe('Departed Provider');
    unmount();
  });

  it('shows the matched option name when value matches an option', () => {
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} value="u1" onAssign={jest.fn()} />,
    );
    expect(q(container, '.cn-assign-name')!.textContent).toBe('Deng Mabior Kuol');
    unmount();
  });

  it('opens a portalled menu listing None + every option, ticking the current one', () => {
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} value="u2" onAssign={jest.fn()} />,
    );
    click(q(container, '.cn-assign-trigger')!);
    const menu = document.querySelector('.cn-type-menu');
    expect(menu).not.toBeNull();
    expect(container.contains(menu)).toBe(false);

    const items = qa<HTMLButtonElement>(document.body, '.cn-type-item');
    expect(items.map(i => i.textContent?.replace('✓', '').trim())).toEqual(
      ['None', 'Deng Mabior Kuol', 'Stella Keji Lemi'],
    );
    const selected = items.find(i => i.getAttribute('aria-checked') === 'true');
    expect(selected?.textContent).toContain('Stella Keji Lemi');
    unmount();
  });

  it('picking a provider calls onAssign with that option and closes the menu', async () => {
    const onAssign = jest.fn().mockResolvedValue(undefined);
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} onAssign={onAssign} />,
    );
    click(q(container, '.cn-assign-trigger')!);
    const item = qa<HTMLButtonElement>(document.body, '.cn-type-item')
      .find(b => b.textContent?.includes('Stella Keji Lemi'))!;
    await clickAsync(item);
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign).toHaveBeenCalledWith(OPTIONS[1]);
    expect(document.querySelector('.cn-type-menu')).toBeNull();
    unmount();
  });

  it('picking "None" calls onAssign with null to unassign', async () => {
    const onAssign = jest.fn().mockResolvedValue(undefined);
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} value="u1" onAssign={onAssign} />,
    );
    click(q(container, '.cn-assign-trigger')!);
    const none = qa<HTMLButtonElement>(document.body, '.cn-type-item')[0];
    await clickAsync(none);
    expect(onAssign).toHaveBeenCalledWith(null);
    unmount();
  });

  it('re-picking the already-assigned provider is a no-op — onAssign is not called', async () => {
    const onAssign = jest.fn().mockResolvedValue(undefined);
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} value="u1" onAssign={onAssign} />,
    );
    click(q(container, '.cn-assign-trigger')!);
    const same = qa<HTMLButtonElement>(document.body, '.cn-type-item')
      .find(b => b.textContent?.includes('Deng Mabior Kuol'))!;
    await clickAsync(same);
    expect(onAssign).not.toHaveBeenCalled();
    // Still closes the menu even though nothing changed.
    expect(document.querySelector('.cn-type-menu')).toBeNull();
    unmount();
  });

  it('shows "Saving…" on the trigger while onAssign is in flight', async () => {
    let resolve!: () => void;
    const onAssign = jest.fn(() => new Promise<void>(r => { resolve = r; }));
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} onAssign={onAssign} />,
    );
    click(q(container, '.cn-assign-trigger')!);
    const item = qa<HTMLButtonElement>(document.body, '.cn-type-item')
      .find(b => b.textContent?.includes('Deng Mabior Kuol'))!;
    click(item);
    expect(q(container, '.cn-assign-name')!.textContent).toBe('Saving…');
    await act(async () => { resolve(); await Promise.resolve(); });
    unmount();
  });

  it('disabled disables the trigger', () => {
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} onAssign={jest.fn()} disabled />,
    );
    expect(q<HTMLButtonElement>(container, '.cn-assign-trigger')!.disabled).toBe(true);
    unmount();
  });

  it('shows an empty-state message when there are no providers to assign', () => {
    const { container, unmount } = mount(
      <AssignPicker options={[]} onAssign={jest.fn()} />,
    );
    click(q(container, '.cn-assign-trigger')!);
    expect(document.querySelector('.cn-assign-empty')?.textContent)
      .toBe('No providers available to assign.');
    unmount();
  });

  it('Escape closes the menu', () => {
    const { container, unmount } = mount(
      <AssignPicker options={OPTIONS} onAssign={jest.fn()} />,
    );
    click(q(container, '.cn-assign-trigger')!);
    expect(document.querySelector('.cn-type-menu')).not.toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.querySelector('.cn-type-menu')).toBeNull();
    unmount();
  });
});
