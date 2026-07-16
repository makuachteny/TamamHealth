/**
 * Shared formatting utilities used across the app for consistent date/time
 * display. Always prefer these helpers over inline `toLocaleDateString()`
 * calls so date formatting stays uniform across modules.
 */

/**
 * Format an ISO 8601 timestamp as "Mon DD, YYYY at HH:mm" (e.g. "Apr 10, 2026 at 14:32").
 *
 * - Returns "—" for falsy / empty inputs.
 * - Returns the raw string if it can't be parsed.
 * - If the input has only a date component (no time), returns the date alone.
 */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hasTime = /T\d{2}:\d{2}/.test(iso);
  const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  if (!hasTime) return dateStr;
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Compact variant: "Mon DD · HH:mm" (e.g. "Apr 10 · 14:32"). Used for dense
 * tables where vertical space matters. No year shown — assume "this year".
 */
export function formatCompactDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const hasTime = /T\d{2}:\d{2}/.test(iso);
  if (!hasTime) return dateStr;
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} · ${timeStr}`;
}

/**
 * Clock time, ALWAYS 12-hour with AM/PM ("8:00 AM", "3:30 PM"), regardless of
 * locale or source shape. Accepts a bare "HH:MM"(:SS) 24-hour slot string
 * (appointment times) or an ISO/Date timestamp. Returns '' for empty input.
 * Use everywhere a time-of-day is shown so appointments (raw "15:30") and
 * timestamps (formatted) never render in different formats side by side.
 */
export function formatClockTime(value?: string | Date | null): string {
  if (!value) return '';
  if (typeof value === 'string') {
    // Bare "HH:MM" / "HH:MM:SS" slot with no date component.
    const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) {
      let h = parseInt(m[1], 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m[2]} ${ampm}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Date-only formatter: "Mon DD, YYYY" (e.g. "Apr 10, 2026").
 */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Long, human header date: "Wednesday, 17 June 2026". Used in dashboard
 * headers. Accepts a Date or ISO string; defaults to now.
 */
export function formatLongDate(input?: Date | string | null): string {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Canonical money formatter. Standardizes the previously-inconsistent
 * "{n} SSP" / "SSP {n}" inline renderings into one symbol-prefixed form:
 * "SSP 1,234". Null/undefined/NaN render as the zero amount.
 *
 * @param amount  numeric value (minor handling: undefined/null → 0)
 * @param opts.currency  currency code/symbol (default "SSP")
 * @param opts.decimals  fixed decimal places (default 0, matching prior `.toLocaleString()`)
 */
export function formatMoney(
  amount?: number | null,
  opts?: { currency?: string; decimals?: number },
): string {
  const currency = opts?.currency ?? 'SSP';
  const decimals = opts?.decimals ?? 0;
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const num = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${currency} ${num}`;
}

/** Part of day for greetings. Pure function of the hour (local time). */
export function timeOfDay(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

