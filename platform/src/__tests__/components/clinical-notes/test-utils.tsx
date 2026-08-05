/**
 * Shared DOM-rendering harness for clinical-notes component tests.
 *
 * This codebase deliberately does NOT depend on @testing-library/react (see
 * src/__tests__/context-slices.test.tsx: it is present in node_modules but
 * absent from package-lock.json, so `npm ci` would not install it in CI).
 * Every test in this directory instead mounts real components with
 * `react-dom/client` + React's own `act`, and drives the DOM directly.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// React 19 requires this flag outside of a test renderer.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
}

/** Mount `ui` into a fresh detached container and flush effects. */
export function mount(ui: React.ReactElement): Mounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    root,
    unmount: () => {
      act(() => { root.unmount(); });
      container.remove();
    },
  };
}

/** Re-render the same root with new props/children. */
export function rerender(root: Root, ui: React.ReactElement) {
  act(() => { root.render(ui); });
}

/**
 * Mount, then flush the microtasks queued by the component's initial async
 * load effect(s) — the common shape for these popups (`useEffect(() => {
 * void load(); }, [load])`). Always await this; a bare `flush()` call NOT
 * wrapped in `act()` still works but prints "not wrapped in act(...)"
 * warnings for the state updates it triggers.
 */
export async function mountAndFlush(ui: React.ReactElement): Promise<Mounted> {
  const m = mount(ui);
  await act(async () => { await flush(); });
  return m;
}

/**
 * Flush every already-queued microtask (chained promise resolutions from
 * mocked async services) without depending on fake timers. A macrotask
 * (setTimeout) only runs after the microtask queue is fully drained, so one
 * tick here is enough no matter how many `await`s are chained in the
 * component under test.
 */
export function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** act() + flush() together — the common "click then let effects settle" step. */
export async function actFlush(fn: () => void) {
  await act(async () => {
    fn();
    await flush();
  });
}

/** Set a text/number/date input or textarea's value the way a real keystroke would. */
export function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Set a <select>'s value and fire onChange. */
export function setSelect(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * Check/uncheck a checkbox or radio. React listens to the native 'click'
 * event (not 'change') to drive onChange for checkbox/radio inputs — a
 * long-standing quirk carried over from unreliable old-browser 'change'
 * support. So this uses a real `.click()` (which jsdom also uses to flip
 * `.checked` and fire 'click' + 'input' + 'change' natively) rather than
 * fighting the native property setter; it only clicks when the current state
 * disagrees with the requested one, exactly like a person would.
 */
export function setChecked(el: HTMLInputElement, checked: boolean) {
  if (el.checked !== checked) {
    act(() => { el.click(); });
  }
}

/** Click a button/element (act-wrapped, synchronous handlers only). */
export function click(el: Element) {
  act(() => { (el as HTMLElement).click(); });
}

/** Click, then let any async work the handler kicked off settle. */
export async function clickAsync(el: Element) {
  await actFlush(() => { (el as HTMLElement).click(); });
}

export function q<T extends Element = Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

export function qa<T extends Element = Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export { act };
