'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { makeCoalescer } from './live-reload';
import type { ClinicalFavoriteDoc, FavoriteKind } from '../db-types';
import { clinicalFavoritesDB } from '../db';
import type { AddFavoriteInput } from '../services/clinical-favorites-service';

/**
 * Per-clinician favorites for a given picker kind (diagnosis / medication /
 * procedure). Live-reloads on the favorites DB so a star toggled in one place
 * updates everywhere, and exposes a fast `isFav` set plus toggle/use helpers.
 */
export function useFavorites(userId?: string, kind?: FavoriteKind) {
  const [favorites, setFavorites] = useState<ClinicalFavoriteDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setFavorites([]); setLoading(false); return; }
    try {
      const { getFavorites } = await import('../services/clinical-favorites-service');
      setFavorites(await getFavorites(userId, kind));
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [userId, kind]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = clinicalFavoritesDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  /** Set of favorited codes for O(1) star rendering. */
  const favCodes = useMemo(() => new Set(favorites.map(f => f.code)), [favorites]);

  const isFav = useCallback((code: string) => favCodes.has(code), [favCodes]);

  /** Toggle a favorite on/off; returns the resulting state. */
  const toggle = useCallback(async (input: Omit<AddFavoriteInput, 'userId'>) => {
    if (!userId) return false;
    const { toggleFavorite } = await import('../services/clinical-favorites-service');
    const now = await toggleFavorite({ ...input, userId });
    await load();
    return now;
  }, [userId, load]);

  /** Record that a favorite was used (re-orders most-used first). */
  const bumpUse = useCallback(async (favKind: FavoriteKind, code: string) => {
    if (!userId) return;
    const { bumpFavoriteUse } = await import('../services/clinical-favorites-service');
    await bumpFavoriteUse(userId, favKind, code);
  }, [userId]);

  return { favorites, favCodes, isFav, toggle, bumpUse, loading, reload: load };
}
