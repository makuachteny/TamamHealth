/**
 * Synchronous, app-wide store for the current facility settings.
 *
 * Why a singleton (not just React context): plenty of non-React code needs the
 * live values at call time — the ledger reads the currency, patient-service
 * builds hospital numbers from the prefix, the lab escalation job reads the
 * SLA, etc. Those can't call a React hook. They read getSettings() here.
 *
 * The SettingsProvider keeps this store hydrated from the synced
 * `facility_settings` doc and pushes every change in, so both React components
 * (via useSettings) and plain modules (via getSettings) always see the same,
 * current configuration. Defaults apply until the provider hydrates.
 */
import { DEFAULT_FACILITY_SETTINGS, type FacilitySettings } from './facility-settings';

let current: FacilitySettings = DEFAULT_FACILITY_SETTINGS;
const subscribers = new Set<(s: FacilitySettings) => void>();

/** Current effective facility settings (defaults until hydrated). */
export function getSettings(): FacilitySettings {
  return current;
}

/** Replace the current settings and notify subscribers. */
export function setSettings(next: FacilitySettings): void {
  current = next;
  for (const cb of subscribers) {
    try { cb(current); } catch { /* a bad subscriber must not break others */ }
  }
}

/** Subscribe to settings changes. Returns an unsubscribe function. */
export function subscribeSettings(cb: (s: FacilitySettings) => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
