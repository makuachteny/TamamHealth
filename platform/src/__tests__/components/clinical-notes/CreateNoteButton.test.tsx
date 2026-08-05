/**
 * CreateNoteButton — the split "start a note" control, and its two exported
 * pure helpers (menu ordering, context-derived default type).
 */
import { act } from 'react';
import CreateNoteButton, { defaultNoteTypeFor, noteTypeMenuOrder } from '@/components/clinical-notes/CreateNoteButton';
import { NOTE_TYPE_ORDER, NOTE_TYPES } from '@/lib/clinical-notes/note-catalog';
import { mount, click, q, qa } from './test-utils';

describe('noteTypeMenuOrder', () => {
  it('puts the selected type first, then the rest alphabetically by label', () => {
    const order = noteTypeMenuOrder('soap');
    expect(order[0]).toBe('soap');
    const rest = order.slice(1).map(id => NOTE_TYPES[id].label);
    const sorted = [...rest].sort((a, b) => a.localeCompare(b));
    expect(rest).toEqual(sorted);
    expect(order).toHaveLength(NOTE_TYPE_ORDER.length);
  });

  it('reorders when a different type is selected — the list is not a fixed constant', () => {
    const order = noteTypeMenuOrder('phone');
    expect(order[0]).toBe('phone');
    expect(order).toContain('soap');
  });
});

describe('defaultNoteTypeFor', () => {
  it('defaults to SOAP with no context', () => {
    expect(defaultNoteTypeFor({})).toBe('soap');
  });

  it('picks Telehealth SOAP for a telehealth visit', () => {
    expect(defaultNoteTypeFor({ telehealth: true })).toBe('telehealth_soap');
  });

  it('picks OB Evaluation for an antenatal reason for visit', () => {
    expect(defaultNoteTypeFor({ reason: 'ANC follow-up' })).toBe('ob_evaluation');
    expect(defaultNoteTypeFor({ reason: 'Antenatal booking' })).toBe('ob_evaluation');
    expect(defaultNoteTypeFor({ reason: 'possible pregnancy' })).toBe('ob_evaluation');
  });

  it('an antenatal reason wins even on a telehealth appointment', () => {
    expect(defaultNoteTypeFor({ telehealth: true, reason: 'ANC visit' })).toBe('ob_evaluation');
  });

  it('picks Nurse Visit for nurse/triage/rooming roles', () => {
    expect(defaultNoteTypeFor({ role: 'nurse' })).toBe('nurse_visit');
    expect(defaultNoteTypeFor({ role: 'triage_nurse' })).toBe('nurse_visit');
    expect(defaultNoteTypeFor({ role: 'rooming_nurse' })).toBe('nurse_visit');
  });

  it('picks OB Evaluation for a midwife', () => {
    expect(defaultNoteTypeFor({ role: 'midwife' })).toBe('ob_evaluation');
  });

  it('does not match "pregnan" inside an unrelated word', () => {
    // Sanity: the regex is \bpregnan — matches "pregnancy"/"pregnant" as a
    // word, not as a substring of something else entirely unrelated.
    expect(defaultNoteTypeFor({ reason: 'routine checkup' })).toBe('soap');
  });
});

describe('CreateNoteButton', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clicking the main half creates the default type without opening the menu', () => {
    const onCreate = jest.fn();
    const { container, unmount } = mount(<CreateNoteButton onCreate={onCreate} defaultType="soap" />);
    const main = q<HTMLButtonElement>(container, '.cn-split-main')!;
    expect(main.title).toBe('New SOAP note');
    click(main);
    expect(onCreate).toHaveBeenCalledWith('soap');
    expect(document.querySelector('.cn-type-menu')).toBeNull();
    unmount();
  });

  it('respects a non-default defaultType', () => {
    const onCreate = jest.fn();
    const { container, unmount } = mount(<CreateNoteButton onCreate={onCreate} defaultType="hp" />);
    click(q(container, '.cn-split-main')!);
    expect(onCreate).toHaveBeenCalledWith('hp');
    unmount();
  });

  it('the caret opens a portalled menu with the current type ticked first', () => {
    const onCreate = jest.fn();
    const { container, unmount } = mount(<CreateNoteButton onCreate={onCreate} defaultType="soap" />);
    const caret = q<HTMLButtonElement>(container, '.cn-split-caret')!;
    expect(caret.getAttribute('aria-expanded')).toBe('false');
    click(caret);
    expect(caret.getAttribute('aria-expanded')).toBe('true');

    // Portalled onto document.body, not inside the component's own container.
    const menu = document.querySelector('.cn-type-menu');
    expect(menu).not.toBeNull();
    expect(container.contains(menu)).toBe(false);

    const items = qa<HTMLButtonElement>(document.body, '.cn-type-item');
    expect(items).toHaveLength(NOTE_TYPE_ORDER.length);
    expect(items[0].textContent).toContain(NOTE_TYPES.soap.label);
    expect(items[0].getAttribute('aria-checked')).toBe('true');
    unmount();
  });

  it('picking a menu item creates that type and closes the menu', () => {
    const onCreate = jest.fn();
    const { container, unmount } = mount(<CreateNoteButton onCreate={onCreate} defaultType="soap" />);
    click(q(container, '.cn-split-caret')!);
    const phoneItem = qa<HTMLButtonElement>(document.body, '.cn-type-item')
      .find(b => b.textContent?.includes(NOTE_TYPES.phone.label))!;
    click(phoneItem);
    expect(onCreate).toHaveBeenCalledWith('phone');
    expect(document.querySelector('.cn-type-menu')).toBeNull();
    unmount();
  });

  it('Escape closes the menu', () => {
    const onCreate = jest.fn();
    const { container, unmount } = mount(<CreateNoteButton onCreate={onCreate} defaultType="soap" />);
    click(q(container, '.cn-split-caret')!);
    expect(document.querySelector('.cn-type-menu')).not.toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.querySelector('.cn-type-menu')).toBeNull();
    unmount();
  });

  it('a click outside the trigger and menu closes it', () => {
    const onCreate = jest.fn();
    const { container, unmount } = mount(<CreateNoteButton onCreate={onCreate} defaultType="soap" />);
    click(q(container, '.cn-split-caret')!);
    expect(document.querySelector('.cn-type-menu')).not.toBeNull();
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    act(() => { outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(document.querySelector('.cn-type-menu')).toBeNull();
    outside.remove();
    unmount();
  });

  it('disabled disables both halves of the split button', () => {
    const onCreate = jest.fn();
    const { container, unmount } = mount(<CreateNoteButton onCreate={onCreate} disabled />);
    expect(q<HTMLButtonElement>(container, '.cn-split-main')!.disabled).toBe(true);
    expect(q<HTMLButtonElement>(container, '.cn-split-caret')!.disabled).toBe(true);
    unmount();
  });
});
