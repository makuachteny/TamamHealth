/**
 * Offline cache for patient data screens.
 *
 * Backed by `expo-secure-store`, which is encrypted at rest:
 *   - iOS: Keychain (AES, hardware-backed when available)
 *   - Android: EncryptedSharedPreferences (AES-256/GCM)
 *
 * Why SecureStore and not AsyncStorage?
 *   The cached payloads contain PHI (lab results, diagnoses, prescriptions).
 *   AsyncStorage on Android is plaintext on disk, which would be a HIPAA
 *   violation if the device is compromised. SecureStore is the lightest
 *   path to encryption-at-rest without pulling SQLCipher.
 *
 * Storage format (per key): JSON-encoded `{ savedAt, ttlMs, data }`.
 *   - `savedAt`  — millis since epoch when the entry was written.
 *   - `ttlMs`    — caller-supplied TTL; `cacheGet` evicts entries older than
 *                  `savedAt + ttlMs` lazily on read.
 *   - `data`     — opaque payload (the screen's parsed JSON response).
 *
 * Conflict-resolution policy (master plan §sync):
 *   - Clinical reads (records / labs / prescriptions / appointments / immunizations
 *     / messages / billing): server-wins. The local copy is a stale snapshot
 *     used only when the network is unavailable. Whenever a fresh response
 *     arrives, we overwrite unconditionally.
 *   - Profile edits (the only client-originated write today): server-wins on
 *     write because the platform's response after a PATCH is canonical.
 *
 * SecureStore key constraint: keys may only contain [A-Za-z0-9._-]. We
 * sanitize input keys so callers can pass URLs / paths if convenient.
 */

import * as SecureStore from 'expo-secure-store';

/** Namespace prefix so cache entries don't collide with auth/session keys. */
const KEY_PREFIX = 'tamamhealth.cache.';

/** 24 hours — appropriate for clinical reads which change with new visits. */
export const TTL_24H = 24 * 60 * 60 * 1000;

/**
 * 7 days — appropriate for read-only history (e.g. immunizations, completed
 * billing ledger). Old data doesn't churn, so a longer TTL keeps the offline
 * experience usable on flaky networks.
 */
export const TTL_7D = 7 * 24 * 60 * 60 * 1000;

type CacheEnvelope<T> = {
  savedAt: number;
  ttlMs: number;
  data: T;
};

/** Replace any character SecureStore won't accept. */
function safeKey(rawKey: string): string {
  // Only [A-Za-z0-9._-] are valid; everything else becomes _.
  const cleaned = rawKey.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${KEY_PREFIX}${cleaned}`;
}

/**
 * Read a cached value. Returns null if missing, malformed, or past TTL.
 * Past-TTL entries are deleted lazily so stale data doesn't sit on the
 * keychain forever.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const k = safeKey(key);
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(k);
  } catch {
    // SecureStore can throw on locked-keychain edge cases (e.g. just after
    // setting a passcode). Treat as cache miss.
    return null;
  }
  if (!raw) return null;

  let envelope: CacheEnvelope<T>;
  try {
    envelope = JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    // Corrupt entry — drop it.
    await SecureStore.deleteItemAsync(k).catch(() => {});
    return null;
  }

  if (
    typeof envelope?.savedAt !== 'number' ||
    typeof envelope?.ttlMs !== 'number'
  ) {
    await SecureStore.deleteItemAsync(k).catch(() => {});
    return null;
  }

  const expired = Date.now() > envelope.savedAt + envelope.ttlMs;
  if (expired) {
    await SecureStore.deleteItemAsync(k).catch(() => {});
    return null;
  }

  return envelope.data;
}

/**
 * Persist a value under `key`. TTL defaults to 24h.
 * Errors are swallowed — caching is best-effort and must never block UI.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number = TTL_24H
): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    savedAt: Date.now(),
    ttlMs,
    data: value,
  };
  try {
    await SecureStore.setItemAsync(safeKey(key), JSON.stringify(envelope));
  } catch (err) {
    // SecureStore has a ~2KB hard cap on iOS for some entries. If the
    // payload is too large or storage is full, log and drop the write.
    console.warn('[offline-cache] write failed', key, err);
  }
}

/**
 * Read a cached value alongside its `savedAt` timestamp. Useful when the UI
 * wants to render a "Last synced…" badge.
 */
export async function cacheGetWithMeta<T>(
  key: string
): Promise<{ data: T; savedAt: number } | null> {
  const k = safeKey(key);
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(k);
  } catch {
    return null;
  }
  if (!raw) return null;

  let envelope: CacheEnvelope<T>;
  try {
    envelope = JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    await SecureStore.deleteItemAsync(k).catch(() => {});
    return null;
  }

  if (
    typeof envelope?.savedAt !== 'number' ||
    typeof envelope?.ttlMs !== 'number'
  ) {
    await SecureStore.deleteItemAsync(k).catch(() => {});
    return null;
  }

  if (Date.now() > envelope.savedAt + envelope.ttlMs) {
    await SecureStore.deleteItemAsync(k).catch(() => {});
    return null;
  }

  return { data: envelope.data, savedAt: envelope.savedAt };
}

/** Drop a single cache entry. Used on sign-out to clear PHI from disk. */
export async function cacheDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(safeKey(key)).catch(() => {});
}

/**
 * Per-patient cache keys written by screens via `useCachedFetch`. Kept in
 * one place so `clearAllCachedPhi` can drop every PHI surface on sign-out
 * without needing each screen to register its own teardown.
 *
 * SecureStore exposes no enumerate-keys API on iOS/Android, so we can't
 * "find every entry under tamamhealth.cache.*" — we have to know the names.
 * If a new screen adds a `useCachedFetch` call, add its key prefix here too.
 */
const PHI_CACHE_PREFIXES = [
  'records',
  'labs',
  'prescriptions',
  'appointments',
  'immunizations',
  'messages',
  'billing',
] as const;

/**
 * Best-effort wipe of every PHI cache entry for a given patient. Called from
 * `signOut` so a shared-device handoff doesn't leak the previous patient's
 * clinical data to the next sign-in.
 *
 * `patientId` is required: keys are namespaced `<prefix>.<patientId>` (see
 * each screen's `cacheKey` derivation). Passing the wrong id is a no-op.
 */
export async function clearAllCachedPhi(patientId: string): Promise<void> {
  for (const prefix of PHI_CACHE_PREFIXES) {
    await cacheDelete(`${prefix}.${patientId}`);
  }
}
