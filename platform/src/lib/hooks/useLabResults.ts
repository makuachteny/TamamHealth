'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { LabResultDoc } from '../db-types';
import { labResultsDB } from '../db';
import { useApp } from '../context';

export function useLabResults() {
  const [results, setResults] = useState<LabResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useApp();
  const scope = useMemo(() => (
    currentUser ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role } : undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  const loadResults = useCallback(async () => {
    try {
      setError(null);
      const { getAllLabResults } = await import('../services/lab-service');
      const data = await getAllLabResults(scope);
      setResults(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load lab results');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // Live subscription: re-load whenever any lab result doc changes anywhere
  // (consultation page creating an order, lab tech entering a result, etc.).
  // Replaces the previous 30-second polling so cross-module updates are
  // reflected immediately without manual refresh.
  useEffect(() => {
    let cancelled = false;
    const changes = labResultsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => { if (!cancelled) loadResults(); })
      .on('error', (err) => { console.warn('Lab results subscription error:', err); });
    return () => {
      cancelled = true;
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [loadResults]);

  const create = useCallback(async (data: Omit<LabResultDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) => {
    const { createLabResult } = await import('../services/lab-service');
    const result = await createLabResult(data);
    await loadResults();
    return result;
  }, [loadResults]);

  const update = useCallback(async (id: string, data: Partial<LabResultDoc>) => {
    const { updateLabResult } = await import('../services/lab-service');
    const result = await updateLabResult(id, data);
    await loadResults();
    return result;
  }, [loadResults]);

  return { results, loading, error, create, update, reload: loadResults };
}
