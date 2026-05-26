'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BomaVisitDoc } from '../db-types';

export function useBomaVisits(workerId?: string) {
  const [visits, setVisits] = useState<BomaVisitDoc[]>([]);
  const [todaysVisits, setTodaysVisits] = useState<BomaVisitDoc[]>([]);
  const [stats, setStats] = useState<{
    totalVisits: number;
    todaysVisits: number;
    pendingFollowUps: number;
    totalReferrals: number;
    todayReferrals: number;
    uniqueHouseholds: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workerId) return;
    try {
      setError(null);
      const { getVisitsByWorker, getTodaysVisits, getBomaStats } = await import('../services/boma-visit-service');
      const [allVisits, todays, bomaStats] = await Promise.all([
        getVisitsByWorker(workerId),
        getTodaysVisits(workerId),
        getBomaStats(workerId),
      ]);
      setVisits(allVisits);
      setTodaysVisits(todays);
      setStats(bomaStats);
    } catch (err) {
      console.error('Failed to load boma visits:', err);
      setError('Failed to load visit data');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    load();
  }, [load]);

  const createVisit = useCallback(async (
    data: Omit<BomaVisitDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
  ) => {
    const { createBomaVisit } = await import('../services/boma-visit-service');
    const visit = await createBomaVisit(data);
    await load();
    return visit;
  }, [load]);

  const updateVisit = useCallback(async (id: string, data: Partial<BomaVisitDoc>) => {
    const { updateBomaVisit } = await import('../services/boma-visit-service');
    const visit = await updateBomaVisit(id, data);
    await load();
    return visit;
  }, [load]);

  return { visits, todaysVisits, stats, loading, error, reload: load, createVisit, updateVisit };
}
