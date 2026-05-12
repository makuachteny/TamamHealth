/**
 * `useCachedFetch` — fetch-on-focus + offline cache for patient data screens.
 *
 * Behavior:
 *   1. Mounts / regains focus -> fire `apiFetch(path)`.
 *   2. On 2xx: render fresh data; write through to `cacheSet` with the
 *      configured TTL. `lastSyncedAt` becomes `Date.now()`.
 *   3. On network error or non-2xx: try `cacheGet`. If a non-expired entry
 *      exists, render it and surface `lastSyncedAt` so the UI can show a
 *      "Last synced…" badge. Otherwise expose `error` and an empty `data`.
 *
 * The hook is generic over the parsed response type and accepts a
 * `select` mapper so callers can pluck `{ records: [...] }` -> `[...]`.
 *
 * PHI handling: the only persisted state is in `cacheSet`, which routes
 * through `expo-secure-store`. In-component state is plain React state and
 * is dropped when the component unmounts (modulo the cache write).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from './api-client';
import { cacheGetWithMeta, cacheSet, TTL_24H } from './offline-cache';

export type UseCachedFetchOptions<TRaw, TData> = {
  /** Stable cache key. Include patient id so two patients on the same device don't share. */
  cacheKey: string;
  /** Path to fetch. Pass null to disable (e.g. before patient is loaded). */
  path: string | null;
  /** Map raw JSON response -> caller-friendly shape. */
  select: (raw: TRaw) => TData;
  /** TTL for the on-disk cache. Defaults to 24h (clinical-read sweet spot). */
  ttlMs?: number;
};

export type CachedFetchState<TData> = {
  data: TData | null;
  /** True on initial load when nothing has rendered yet. */
  loading: boolean;
  /** True when a pull-to-refresh is in-flight. */
  refreshing: boolean;
  /** Friendly error string if the fetch failed AND no cache fallback was found. */
  error: string | null;
  /** Millis since epoch when `data` was last sourced from a fresh server response. */
  lastSyncedAt: number | null;
  /** Set true when `data` is currently rendering from cache (offline / error fallback). */
  isStale: boolean;
  /** Manually trigger a re-fetch (used by RefreshControl). */
  refresh: () => Promise<void>;
};

export function useCachedFetch<TRaw, TData>(
  opts: UseCachedFetchOptions<TRaw, TData>
): CachedFetchState<TData> {
  const { cacheKey, path, select, ttlMs = TTL_24H } = opts;

  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Track the latest in-flight fetch so a stale response doesn't overwrite
  // a newer one (e.g. user pulls-to-refresh while focus event fires).
  const fetchIdRef = useRef(0);
  // Track mount state to avoid setState-after-unmount on slow networks.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!path) {
        setLoading(false);
        return;
      }
      const myFetchId = ++fetchIdRef.current;
      if (mode === 'refresh') setRefreshing(true);

      try {
        const response = await apiFetch(path);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as TRaw;
        if (myFetchId !== fetchIdRef.current || !mountedRef.current) return;

        const mapped = select(json);
        setData(mapped);
        setError(null);
        setIsStale(false);
        const now = Date.now();
        setLastSyncedAt(now);
        // Best-effort write-through; never blocks UI.
        void cacheSet(cacheKey, mapped, ttlMs);
      } catch (err) {
        // Network or non-2xx — attempt cache fallback.
        if (myFetchId !== fetchIdRef.current || !mountedRef.current) return;
        const cached = await cacheGetWithMeta<TData>(cacheKey);
        if (myFetchId !== fetchIdRef.current || !mountedRef.current) return;

        if (cached) {
          setData(cached.data);
          setLastSyncedAt(cached.savedAt);
          setIsStale(true);
          setError(null);
        } else {
          setError(toFriendlyError(err));
          setIsStale(false);
        }
      } finally {
        if (mountedRef.current && myFetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [cacheKey, path, select, ttlMs]
  );

  // Hydrate from cache once, immediately, so the UI doesn't flash empty
  // while the network call is pending.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await cacheGetWithMeta<TData>(cacheKey);
      if (cancelled || !mountedRef.current) return;
      if (cached && data === null) {
        setData(cached.data);
        setLastSyncedAt(cached.savedAt);
        setIsStale(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally only run on cacheKey change, not on `data`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Re-fetch every time the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      void run('initial');
    }, [run])
  );

  const refresh = useCallback(() => run('refresh'), [run]);

  return { data, loading, refreshing, error, lastSyncedAt, isStale, refresh };
}

function toFriendlyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('HTTP 401')) {
      return 'Your session expired. Please sign in again.';
    }
    if (err.message.includes('HTTP 5')) {
      return 'The server is having trouble. Please try again shortly.';
    }
    if (err.message === 'Network request failed') {
      return "You're offline and we don't have a cached copy yet.";
    }
  }
  return "We couldn't load this right now. Pull down to retry.";
}
