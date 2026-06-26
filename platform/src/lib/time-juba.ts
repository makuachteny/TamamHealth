/**
 * Date helpers scoped to Africa/Juba (UTC+03:00, no DST).
 *
 * All clinical events are recorded by users physically in South Sudan; if
 * we compare them with `new Date().toISOString()` on a UTC server, a death
 * at 22:00 Juba on Mar 31 shifts into April UTC and lands in the wrong
 * monthly bucket. Use these helpers wherever you'd otherwise slice
 * `toISOString()` for month/day comparisons.
 */
const JUBA_OFFSET_MS = 3 * 60 * 60 * 1000;

function toJuba(d: Date | string | number): Date {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return new Date(date.getTime() + JUBA_OFFSET_MS);
}

export function jubaYearMonth(d: Date | string | number = new Date()): string {
  const j = toJuba(d);
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function jubaDate(d: Date | string | number = new Date()): string {
  const j = toJuba(d);
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${String(j.getUTCDate()).padStart(2, '0')}`;
}

export function jubaIsInMonth(date: string | undefined, yyyyMm: string): boolean {
  if (!date) return false;
  return jubaYearMonth(date) === yyyyMm;
}

export function jubaWeekStart(d: Date | string | number = new Date()): string {
  const j = toJuba(d);
  const day = j.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  j.setUTCDate(j.getUTCDate() - daysFromMonday);
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${String(j.getUTCDate()).padStart(2, '0')}`;
}

/**
 * "Now" as a Date whose LOCAL fields (getHours/getDate/…) equal the current
 * Africa/Juba wall-clock — regardless of the viewer's browser timezone.
 *
 * Appointment dates/times are stored as naive Juba wall-clock strings and are
 * positioned on the calendar via their local fields, so any component that
 * needs "now" relative to those events (the current-time indicator, the
 * default focused date, walk-in timestamps) must use this rather than a raw
 * `new Date()` — otherwise the clock drifts by the browser's UTC offset.
 */
export function jubaNow(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Juba', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const hour = get('hour') % 24; // some engines emit "24" for midnight
  return new Date(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
}

/** Current Africa/Juba time as a "HH:MM" wall-clock string. */
export function jubaTime(): string {
  const n = jubaNow();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}
