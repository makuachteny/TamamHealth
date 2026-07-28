/**
 * Telehealth join window — when a patient may enter a scheduled visit.
 *
 * Pure and dependency-free so the server (which enforces it before minting a
 * media token) and the join page (which explains it) share one implementation.
 * Two implementations of "is this visit open yet" would drift, and the failure
 * mode is a patient told they may join by a page that the token route then
 * refuses.
 *
 * ## Timezone
 *
 * `scheduledDate` / `scheduledTime` are stored as NAIVE Africa/Juba wall-clock
 * strings — "2026-07-28" + "14:30" means half past two in Juba, with no offset
 * recorded. So they must never be parsed as UTC (`new Date('...Z')`) nor with
 * the server's own timezone: a Vercel box in UTC would open the window three
 * hours late, and one in US-Pacific ten hours early.
 *
 * Both sides of the comparison are therefore expressed as Dates whose LOCAL
 * fields carry Juba wall-clock — `jubaNow()` for the current instant, and
 * `new Date(y, m, d, hh, mm)` for the slot. The difference between two such
 * Dates is correct regardless of where the code runs, because the same offset
 * is baked into both and cancels.
 */

/** Minutes either side of the slot during which joining is allowed. */
export interface JoinWindowConfig {
  beforeMinutes: number;
  afterMinutes: number;
}

/** Matches DEFAULT_FACILITY_SETTINGS.telehealthJoinWindow. */
export const DEFAULT_JOIN_WINDOW: JoinWindowConfig = {
  beforeMinutes: 15,
  afterMinutes: 30,
};

export type JoinWindowReason = 'open' | 'too_early' | 'too_late' | 'unscheduled';

export interface JoinWindowState {
  open: boolean;
  reason: JoinWindowReason;
  /** Null when the session carries no parseable schedule. */
  scheduledAt: Date | null;
  opensAt: Date | null;
  closesAt: Date | null;
  /** Patient-facing explanation. Never "access denied" with no reason. */
  message: string;
}

const HHMM = /^(\d{1,2}):(\d{2})$/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a naive Juba date + time into a Date whose LOCAL fields hold that
 * wall-clock. Returns null on anything malformed rather than an Invalid Date,
 * so callers get one explicit "unscheduled" path instead of NaN arithmetic
 * silently comparing as false everywhere.
 */
export function parseScheduledInstant(
  scheduledDate: string | undefined,
  scheduledTime: string | undefined,
): Date | null {
  const dm = YMD.exec((scheduledDate || '').trim());
  const tm = HHMM.exec((scheduledTime || '').trim());
  if (!dm || !tm) return null;

  const [, y, mo, d] = dm;
  const [, hh, mm] = tm;
  const hour = Number(hh);
  const minute = Number(mm);
  if (hour > 23 || minute > 59) return null;

  const dt = new Date(Number(y), Number(mo) - 1, Number(d), hour, minute, 0, 0);
  // Rejects impossible calendar dates that JS would otherwise roll over
  // (2026-02-30 becoming March 2nd, which would open a window on the wrong day).
  if (dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) return null;
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Format a Juba wall-clock Date as "HH:MM" for a patient-facing message. */
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Evaluate whether the visit may be joined at `now`.
 *
 * `now` must be a Juba wall-clock Date (i.e. `jubaNow()`), matching how the
 * schedule is parsed above. It is a required argument rather than a default so
 * a caller cannot accidentally pass raw `new Date()` by omitting it.
 */
export function evaluateJoinWindow(
  session: { scheduledDate?: string; scheduledTime?: string },
  config: JoinWindowConfig,
  now: Date,
): JoinWindowState {
  const scheduledAt = parseScheduledInstant(session.scheduledDate, session.scheduledTime);

  if (!scheduledAt) {
    // A walk-in / ad-hoc visit has no slot to be early or late for. Refusing it
    // would break the clinician-initiated visit, which is the common path
    // today, so an unscheduled session is joinable.
    return {
      open: true,
      reason: 'unscheduled',
      scheduledAt: null,
      opensAt: null,
      closesAt: null,
      message: 'This visit is not tied to a scheduled time.',
    };
  }

  const before = Math.max(0, config.beforeMinutes);
  const after = Math.max(0, config.afterMinutes);
  const opensAt = new Date(scheduledAt.getTime() - before * 60_000);
  const closesAt = new Date(scheduledAt.getTime() + after * 60_000);

  if (now < opensAt) {
    return {
      open: false,
      reason: 'too_early',
      scheduledAt,
      opensAt,
      closesAt,
      message: `Your visit is at ${hhmm(scheduledAt)}. You can join from ${hhmm(opensAt)}.`,
    };
  }

  if (now > closesAt) {
    return {
      open: false,
      reason: 'too_late',
      scheduledAt,
      opensAt,
      closesAt,
      // Deliberately tells them what to do next. "Window closed" alone leaves a
      // patient who is ten minutes late with no idea whether care is coming.
      message: `The join window for your ${hhmm(scheduledAt)} visit closed at ${hhmm(closesAt)}. Please contact your clinic to rebook.`,
    };
  }

  return {
    open: true,
    reason: 'open',
    scheduledAt,
    opensAt,
    closesAt,
    message: `Your visit is at ${hhmm(scheduledAt)}.`,
  };
}
