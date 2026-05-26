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
