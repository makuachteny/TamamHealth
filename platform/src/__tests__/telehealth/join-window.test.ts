/**
 * Telehealth join window (KAN-124).
 *
 * The window is what stops a patient joining a consultation hours early or a
 * day late, and it is enforced server-side before a media token is minted. The
 * cases that matter most here are the timezone ones: `scheduledDate` /
 * `scheduledTime` are naive Africa/Juba wall-clock, so any parse that leaks the
 * runner's own timezone would pass on a UTC CI box and fail in Juba.
 */

import {
  evaluateJoinWindow,
  parseScheduledInstant,
  DEFAULT_JOIN_WINDOW,
} from '@/lib/telehealth-join-window';

/** A Juba wall-clock Date, i.e. what jubaNow() returns. */
function juba(y: number, mo: number, d: number, hh: number, mm: number): Date {
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

const SESSION = { scheduledDate: '2026-07-28', scheduledTime: '14:30' };

describe('parseScheduledInstant', () => {
  test('parses naive Juba wall-clock into matching local fields', () => {
    const dt = parseScheduledInstant('2026-07-28', '14:30')!;
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(6);
    expect(dt.getDate()).toBe(28);
    expect(dt.getHours()).toBe(14);
    expect(dt.getMinutes()).toBe(30);
  });

  test('accepts a single-digit hour', () => {
    expect(parseScheduledInstant('2026-07-28', '9:05')!.getHours()).toBe(9);
  });

  test.each([
    ['missing date', undefined, '14:30'],
    ['missing time', '2026-07-28', undefined],
    ['empty time', '2026-07-28', ''],
    ['non-ISO date', '28/07/2026', '14:30'],
    ['hour out of range', '2026-07-28', '25:00'],
    ['minute out of range', '2026-07-28', '14:75'],
    ['garbage', 'not-a-date', 'not-a-time'],
  ])('returns null for %s', (_label, date, time) => {
    expect(parseScheduledInstant(date, time)).toBeNull();
  });

  test('rejects an impossible calendar date rather than rolling it over', () => {
    // JS would turn this into 2026-03-02 and open a window on the wrong day.
    expect(parseScheduledInstant('2026-02-30', '10:00')).toBeNull();
  });
});

describe('evaluateJoinWindow', () => {
  test('open exactly at the scheduled time', () => {
    const s = evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 14, 30));
    expect(s.open).toBe(true);
    expect(s.reason).toBe('open');
  });

  test('open at the leading edge, closed one minute before it', () => {
    // Default window is 15 before / 30 after → opens 14:15, closes 15:00.
    expect(evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 14, 15)).open).toBe(true);
    expect(evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 14, 14)).open).toBe(false);
  });

  test('open at the trailing edge, closed one minute after it', () => {
    expect(evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 15, 0)).open).toBe(true);
    expect(evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 15, 1)).open).toBe(false);
  });

  test('too early states the slot and when joining opens', () => {
    const s = evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 9, 0));
    expect(s.reason).toBe('too_early');
    expect(s.message).toContain('14:30');
    expect(s.message).toContain('14:15');
  });

  test('too late says what to do next, not just that it closed', () => {
    const s = evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 18, 0));
    expect(s.reason).toBe('too_late');
    expect(s.message).toContain('15:00');
    expect(s.message).toMatch(/contact your clinic/i);
  });

  test('the previous day is too early and the next day too late', () => {
    expect(evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 27, 14, 30)).reason).toBe('too_early');
    expect(evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 29, 14, 30)).reason).toBe('too_late');
  });

  test('a walk-in with no schedule is joinable, not refused', () => {
    // Clinician-initiated visits carry no slot and are the common path today;
    // treating "unparseable" as "closed" would break them.
    const s = evaluateJoinWindow({}, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 14, 30));
    expect(s.open).toBe(true);
    expect(s.reason).toBe('unscheduled');
    expect(s.scheduledAt).toBeNull();
  });

  test('honours a facility-configured window', () => {
    const wide = { beforeMinutes: 120, afterMinutes: 120 };
    expect(evaluateJoinWindow(SESSION, wide, juba(2026, 7, 28, 13, 0)).open).toBe(true);
    expect(evaluateJoinWindow(SESSION, wide, juba(2026, 7, 28, 16, 25)).open).toBe(true);
    expect(evaluateJoinWindow(SESSION, wide, juba(2026, 7, 28, 16, 31)).open).toBe(false);
  });

  test('a zero-width window still admits the exact minute', () => {
    const none = { beforeMinutes: 0, afterMinutes: 0 };
    expect(evaluateJoinWindow(SESSION, none, juba(2026, 7, 28, 14, 30)).open).toBe(true);
    expect(evaluateJoinWindow(SESSION, none, juba(2026, 7, 28, 14, 31)).open).toBe(false);
  });

  test('negative configuration is clamped rather than inverting the window', () => {
    const s = evaluateJoinWindow(SESSION, { beforeMinutes: -60, afterMinutes: -60 }, juba(2026, 7, 28, 14, 30));
    expect(s.open).toBe(true);
  });

  test('window boundaries are exposed for the UI to render', () => {
    const s = evaluateJoinWindow(SESSION, DEFAULT_JOIN_WINDOW, juba(2026, 7, 28, 14, 30));
    expect(s.opensAt!.getHours()).toBe(14);
    expect(s.opensAt!.getMinutes()).toBe(15);
    expect(s.closesAt!.getHours()).toBe(15);
    expect(s.closesAt!.getMinutes()).toBe(0);
  });

  test('crosses midnight without changing the calendar day of the slot', () => {
    const late = { scheduledDate: '2026-07-28', scheduledTime: '23:50' };
    const s = evaluateJoinWindow(late, DEFAULT_JOIN_WINDOW, juba(2026, 7, 29, 0, 15));
    expect(s.open).toBe(true);
    expect(s.closesAt!.getDate()).toBe(29);
  });
});
