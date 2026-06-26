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
 * Compact relative-time label: how long ago a timestamp was, using the largest
 * sensible unit — seconds, minutes, hours, days, months, or years
 * (e.g. "5s ago", "3m ago", "2h ago", "4d ago", "2mo ago", "1y ago").
 * Returns "—" for falsy/unparseable input and "just now" under 5 seconds.
 * Months use "mo" to avoid clashing with minutes ("m").
 */
export function formatRelativeShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
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

