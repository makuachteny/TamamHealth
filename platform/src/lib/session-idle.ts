/**
 * Idle-session timeout — sliding window on top of the JWT's fixed 8h expiry.
 *
 * The auth JWT (`lib/auth-token.ts`) carries a fixed 8h `exp`, which caps the
 * absolute session length but doesn't log an unattended device out sooner.
 * A HIPAA-relevant control also expects an idle timeout: if no authenticated
 * request arrives for `IDLE_TIMEOUT_MS`, the session should end even if the
 * 8h cap hasn't been reached.
 *
 * Implementation: a small non-sensitive cookie (`IDLE_ACTIVITY_COOKIE_NAME`)
 * holds the epoch-ms of the last authenticated request and is refreshed on
 * every one (see `proxy.ts`). It's plain (not signed) because tampering with
 * it only grants what stealing the httpOnly auth cookie already grants —
 * this cookie defends against "left an unattended browser logged in", not
 * cookie theft, which the httpOnly/secure/sameSite/CSRF layers already cover.
 */

export const IDLE_ACTIVITY_COOKIE_NAME = 'tamamhealth-last-activity';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns true iff the session should be treated as idle-expired.
 * A missing or malformed marker fails open (returns false) so that sessions
 * created before this feature shipped aren't force-logged-out on their next
 * request — the marker gets set from that point on instead.
 */
export function isIdleExpired(lastActivityCookieValue: string | undefined, now: number): boolean {
  if (!lastActivityCookieValue) return false;
  const lastActivity = Number(lastActivityCookieValue);
  if (!Number.isFinite(lastActivity)) return false;
  return now - lastActivity > IDLE_TIMEOUT_MS;
}
