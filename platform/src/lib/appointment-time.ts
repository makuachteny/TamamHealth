/**
 * Appointment clock arithmetic, kept pure and free of database imports so both
 * the service (which rejects a clashing booking) and the edit form (which warns
 * about one while you are still choosing the time) apply the same rule.
 */

/** "HH:MM" → minutes since midnight. Returns NaN for anything unparseable. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = String(time).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

/**
 * Do two slots overlap? Touching ends do not: an appointment ending at 10:00 and
 * the next starting at 10:00 are back-to-back, not a clash.
 */
export function isTimeOverlap(startA: string, durationA: number, startB: string, durationB: number): boolean {
  const a1 = timeToMinutes(startA);
  const b1 = timeToMinutes(startB);
  if (Number.isNaN(a1) || Number.isNaN(b1)) return false;
  return a1 < b1 + durationB && b1 < a1 + durationA;
}
