/**
 * Capability storage — remembers, per user, which workflow capabilities they
 * have exercised at least once. The role dashboards render these as a
 * "Capabilities" card: every item a role can perform is listed, unchecked
 * until the user first completes it, then checked forever. It is a record of
 * what the user knows how to do, not a daily task list — so a mark is never
 * cleared by later state (an empty pharmacy queue doesn't un-learn dispensing).
 *
 * Same mechanism and trade-offs as tour-storage.ts: localStorage, keyed by
 * capability + user id, so it is per-device and survives reloads. Wrapped in
 * try/catch for private-mode/quota failures — storage errors must never break
 * a dashboard.
 */

const STORAGE_PREFIX = 'tamamhealth.capability.';

function key(capabilityKey: string, userId: string): string {
  return `${STORAGE_PREFIX}${capabilityKey}.${userId}`;
}

export function hasCapabilityMark(capabilityKey: string, userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key(capabilityKey, userId)) !== null;
  } catch {
    return false;
  }
}

export function markCapability(capabilityKey: string, userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    // First completion only — keep the original timestamp on repeats.
    if (window.localStorage.getItem(key(capabilityKey, userId)) === null) {
      window.localStorage.setItem(key(capabilityKey, userId), new Date().toISOString());
    }
  } catch {
    // Ignore storage failures (private mode, quota).
  }
}
