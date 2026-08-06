/**
 * ConfirmDialog — the shared "are you sure?" gate.
 *
 * The behaviour worth pinning is the answer the promise resolves to, because
 * every caller is written as `if (!await confirm(...)) return;` — resolve the
 * wrong way and a mis-tap deletes a record, or a deliberate delete silently
 * does nothing.
 */
import { act } from 'react';
import { ConfirmProvider, useConfirm } from '@/components/ConfirmDialog';
import { mount, click, q } from './clinical-notes/test-utils';

/** Harness: a button that asks, and reports the answer into `answers`. */
function Harness({ answers, options }: {
  answers: (boolean | 'pending')[];
  options?: Parameters<ReturnType<typeof useConfirm>>[0];
}) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      id="go"
      onClick={async () => {
        answers.push(await confirm(options ?? { title: 'Delete this document?' }));
      }}
    >
      go
    </button>
  );
}

function findByText(text: string): HTMLElement | null {
  return Array.from(document.body.querySelectorAll('button'))
    .find(b => b.textContent?.trim() === text) as HTMLElement | undefined ?? null;
}

describe('useConfirm', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('resolves true only once the user agrees', async () => {
    const answers: (boolean | 'pending')[] = [];
    const { container, unmount } = mount(
      <ConfirmProvider><Harness answers={answers} /></ConfirmProvider>,
    );

    click(q(container, '#go')!);
    // Nothing has been decided yet — the caller is still awaiting.
    expect(answers).toEqual([]);
    expect(document.body.textContent).toContain('Delete this document?');

    await act(async () => { findByText('Confirm')!.click(); });
    expect(answers).toEqual([true]);
    // And the dialog is gone once answered.
    expect(document.body.textContent).not.toContain('Delete this document?');
    unmount();
  });

  it('resolves false when the user backs out', async () => {
    const answers: (boolean | 'pending')[] = [];
    const { container, unmount } = mount(
      <ConfirmProvider><Harness answers={answers} /></ConfirmProvider>,
    );
    click(q(container, '#go')!);
    await act(async () => { findByText('Cancel')!.click(); });
    expect(answers).toEqual([false]);
    unmount();
  });

  it('focuses Cancel, so clearing the dialog by keyboard is never destructive', async () => {
    // Modal focuses its own panel a render later, so the dialog claims focus on
    // the next tick — hence the timer flush here.
    const answers: (boolean | 'pending')[] = [];
    const { container, unmount } = mount(
      <ConfirmProvider><Harness answers={answers} options={{ title: 'Delete?', tone: 'danger' }} /></ConfirmProvider>,
    );
    click(q(container, '#go')!);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
    unmount();
  });

  it('uses the caller\'s own verb for the action', () => {
    const answers: (boolean | 'pending')[] = [];
    const { container, unmount } = mount(
      <ConfirmProvider>
        <Harness answers={answers} options={{ title: 'Delete?', confirmLabel: 'Delete', tone: 'danger' }} />
      </ConfirmProvider>,
    );
    click(q(container, '#go')!);
    expect(findByText('Delete')).not.toBeNull();
    unmount();
  });

  it('settles the first caller when a second question replaces it', async () => {
    // Two rows asking in quick succession must not strand the first promise:
    // an unresolved await hangs the handler that was mid-save.
    const answers: (boolean | 'pending')[] = [];
    const { container, unmount } = mount(
      <ConfirmProvider><Harness answers={answers} /></ConfirmProvider>,
    );
    click(q(container, '#go')!);
    await act(async () => { (q(container, '#go') as HTMLElement).click(); });
    expect(answers).toEqual([false]);

    await act(async () => { findByText('Confirm')!.click(); });
    expect(answers).toEqual([false, true]);
    unmount();
  });

  it('answers no when there is no provider, rather than proceeding unasked', async () => {
    // A missing provider must never be the reason a record is deleted silently.
    const answers: (boolean | 'pending')[] = [];
    const { container, unmount } = mount(<Harness answers={answers} />);
    await act(async () => { (q(container, '#go') as HTMLElement).click(); });
    expect(answers).toEqual([false]);
    unmount();
  });
});
