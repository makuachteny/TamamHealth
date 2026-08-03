// Local-timezone date-only helpers.
//
// Date-only fields (appointmentDate, dueDate, …) are compared as YYYY-MM-DD
// strings against "today". "Today" must be the LOCAL calendar date, never
// `new Date().toISOString().slice(0, 10)` (UTC): in any timezone offset from
// UTC there is a daily window where the two disagree, which made some
// dashboards show empty "today" lists while others showed data. The seed
// data (lib/db-seed.ts localIsoDate) uses this same local convention.

/** Format a Date as YYYY-MM-DD in the local timezone. */
export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's YYYY-MM-DD in the local timezone. */
export function todayIsoDate() {
  return toIsoDate(new Date());
}

/**
 * Local YYYY-MM-DD of an ISO timestamp (or Date); '' when missing/invalid.
 * Use this instead of `value.slice(0, 10)` / `.startsWith(today)` when
 * comparing a stored timestamp against a local "today" — slicing an ISO
 * string yields its UTC date, which disagrees with the local date for
 * events near midnight.
 */
export function isoDateOf(value?: string | number | Date | null) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : toIsoDate(d);
}

/** Parse a YYYY-MM-DD string as local midnight. */
export function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function addDays(date: Date, offset: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + offset);
  return copy;
}
