'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FollowUpDoc } from '../db-types';
import { useDataScope } from './useDataScope';
import { makeCoalescer } from './live-reload';
import { followUpsDB } from '../db';

export function useFollowUps(workerId?: string) {
  const [followUps, setFollowUps] = useState<FollowUpDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useDataScope();

  const load = useCallback(async () => {
    try {
      setError(null);
      const { getFollowUpsByWorker, getAllFollowUps } = await import('../services/follow-up-service');
      // When a workerId is passed (CHV/Boma worker dashboards), the
      // assignedWorker filter is already strict enough. For ungated callers
      // we fall back to the org/hospital scope so cross-org leakage cannot
      // happen if a non-admin role ever consumes this hook.
      const data = workerId ? await getFollowUpsByWorker(workerId) : await getAllFollowUps(scope);
      setFollowUps(data);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
      setError('Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [workerId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  // Live PouchDB subscription — reflect writes arriving from sync/other tabs,
  // not just this hook's own mutations (same pattern as useMessages).
  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = followUpsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* transient feed errors; next load resyncs */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  const createFollowUp = useCallback(async (
    data: Omit<FollowUpDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
  ) => {
    const { createFollowUp: create } = await import('../services/follow-up-service');
    const doc = await create(data);
    await load();
    return doc;
  }, [load]);

  const updateFollowUp = useCallback(async (id: string, data: Partial<FollowUpDoc>) => {
    const { updateFollowUp: update } = await import('../services/follow-up-service');
    const doc = await update(id, data);
    await load();
    return doc;
  }, [load]);

  return { followUps, loading, error, reload: load, createFollowUp, updateFollowUp };
}
