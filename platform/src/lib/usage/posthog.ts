/**
 * Optional PostHog forwarder — no SDK, no autocapture.
 * Only active when NEXT_PUBLIC_POSTHOG_KEY is set.
 */

import type { SanitizedUsageEventInput } from './sanitize';

const KEY = typeof process !== 'undefined'
  ? process.env.NEXT_PUBLIC_POSTHOG_KEY
  : undefined;
const HOST = (typeof process !== 'undefined'
  ? process.env.NEXT_PUBLIC_POSTHOG_HOST
  : undefined) || 'https://us.i.posthog.com';

export function isPostHogEnabled(): boolean {
  return !!KEY;
}

export interface PostHogIdentity {
  userId: string;
  orgId?: string;
  role?: string;
}

/**
 * Fire-and-forget capture of already-sanitized usage events.
 * Never throws to callers.
 */
export function captureUsageToPostHog(
  events: SanitizedUsageEventInput[],
  identity: PostHogIdentity,
): void {
  if (!KEY || typeof fetch === 'undefined' || events.length === 0) return;

  const batch = events.map((ev) => ({
    event: ev.eventName,
    distinct_id: identity.userId,
    timestamp: ev.ts,
    properties: {
      path: ev.path,
      element: ev.element,
      session_id: ev.sessionId,
      org_id: identity.orgId,
      role: identity.role,
      ...(ev.meta || {}),
      $lib: 'tamamhealth-usage',
      $autocapture: false,
    },
  }));

  try {
    void fetch(`${HOST.replace(/\/$/, '')}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        batch,
      }),
      keepalive: true,
    }).catch(() => {
      /* telemetry must never break UX */
    });
  } catch {
    /* ignore */
  }
}
