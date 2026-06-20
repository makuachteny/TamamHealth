/**
 * Per-device user preferences (UI choices that aren't security- or
 * facility-policy-level): spacing density and whether to raise desktop
 * notifications for new chat messages.
 *
 * Stored in localStorage (per browser/device, like the theme + lock PIN) and
 * exposed as a tiny reactive store so the Settings page, the density applier,
 * and the notification watcher all stay in sync.
 */

import { getDefaultDashboard } from './role-routes';

export type Density = 'comfortable' | 'compact';

export interface UserPrefs {
  /** UI spacing. 'compact' tightens page padding and header spacing. */
  density: Density;
  /** Raise a desktop notification for new chat messages while the tab is hidden. */
  messageNotifications: boolean;
}

const KEY = 'tamamhealth.user-prefs';

export const DEFAULT_USER_PREFS: UserPrefs = {
  density: 'comfortable',
  messageNotifications: false,
};

let cache: UserPrefs | null = null;
const subscribers = new Set<(p: UserPrefs) => void>();

function read(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_USER_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_USER_PREFS };
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return { ...DEFAULT_USER_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_USER_PREFS };
  }
}

export function getUserPrefs(): UserPrefs {
  if (!cache) cache = read();
  return cache;
}

export function setUserPrefs(patch: Partial<UserPrefs>): UserPrefs {
  const next = { ...getUserPrefs(), ...patch };
  cache = next;
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* best effort */ }
  }
  // Density is a DOM-level concern — apply immediately so every page reflects it.
  if (patch.density !== undefined) applyDensity(next.density);
  for (const cb of subscribers) { try { cb(next); } catch { /* isolate */ } }
  return next;
}

export function subscribeUserPrefs(cb: (p: UserPrefs) => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

/** Reflect the density choice on <html data-density="…"> for CSS to target. */
export function applyDensity(density: Density): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.density = density;
}

/**
 * The page a user should land on after login: always the role's default
 * dashboard.
 */
export function resolveLandingPage(role: string): string {
  return getDefaultDashboard(role);
}
