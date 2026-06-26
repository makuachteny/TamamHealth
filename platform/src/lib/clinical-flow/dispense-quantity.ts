/**
 * Best-effort estimate of how many dispensing units a prescription's full
 * course needs, from its free-text frequency and duration. Used so the
 * pharmacy decrements stock by the course size instead of a hard-coded 1.
 *
 * The maps are deliberately data-driven and conservative: an unrecognised
 * frequency/duration falls back to 1 unit/day for 1 day, never to 0.
 */

/** Doses per day for the frequency options offered in the prescriber UI. */
export const FREQUENCY_PER_DAY: Record<string, number> = {
  'once daily': 1,
  'od': 1,
  'every morning': 1,
  'every night': 1,
  'nocte': 1,
  'twice daily': 2,
  'bd': 2,
  'bid': 2,
  'three times daily': 3,
  'tds': 3,
  'tid': 3,
  'four times daily': 4,
  'qds': 4,
  'qid': 4,
  'every 6 hours': 4,
  'every 8 hours': 3,
  'every 12 hours': 2,
  'once weekly': 1 / 7,
  'as needed': 1,
  'prn': 1,
  'stat': 1,
  'single dose': 1,
};

/** Parse a free-text duration like "7 days", "2 weeks", "1 month" into days. */
export function durationToDays(duration: string): number {
  if (!duration) return 1;
  const m = duration.trim().toLowerCase().match(/(\d+(?:\.\d+)?)\s*(day|week|month|hour|hr)/);
  if (!m) {
    const n = parseFloat(duration);
    return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 1;
  }
  const value = parseFloat(m[1]);
  const unit = m[2];
  const days =
    unit.startsWith('week') ? value * 7 :
    unit.startsWith('month') ? value * 30 :
    unit.startsWith('hour') || unit === 'hr' ? value / 24 :
    value;
  return Math.max(1, Math.ceil(days));
}

/** Frequency per day from free text, defaulting to once-daily. */
export function frequencyPerDay(frequency: string): number {
  if (!frequency) return 1;
  const key = frequency.trim().toLowerCase();
  return FREQUENCY_PER_DAY[key] ?? 1;
}

/** Whole dispensing units a course needs (>= 1). */
export function estimateDispenseQuantity(rx: { frequency?: string; duration?: string }): number {
  const perDay = frequencyPerDay(rx.frequency || '');
  const days = durationToDays(rx.duration || '');
  return Math.max(1, Math.ceil(perDay * days));
}
