'use client';

import { useState, useEffect, useCallback } from 'react';
import { makeCoalescer } from './live-reload';
import type { NutritionScreeningDoc } from '../db-types';
import { nutritionScreeningsDB } from '../db';
import type { AddNutritionScreeningInput } from '../services/nutrition-screening-service';

/** All nutrition screenings, newest first, live-reloaded on changes. */
export function useNutritionScreenings() {
  const [screenings, setScreenings] = useState<NutritionScreeningDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { getAllNutritionScreenings } = await import('../services/nutrition-screening-service');
      setScreenings(await getAllNutritionScreenings());
    } catch {
      setScreenings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = nutritionScreeningsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  const add = useCallback(async (input: AddNutritionScreeningInput) => {
    const { addNutritionScreening } = await import('../services/nutrition-screening-service');
    const doc = await addNutritionScreening(input);
    await load();
    return doc;
  }, [load]);

  return { screenings, loading, add, reload: load };
}
