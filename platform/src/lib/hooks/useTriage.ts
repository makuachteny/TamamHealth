'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TriageDoc } from '../db-types';
import { triageDB } from '../db';
import { useDataScope } from './useDataScope';

/**
 * Triage queue hook for the nurse dashboard and the patient detail page.
 *
 * Passing a `patientId` scopes the returned list to that patient's triage
 * history (newest first). Passing no args returns every triage visible to
 * the current user via DataScope filtering.
 */
export function useTriage(patientId?: string) {
  const [triages, setTriages] = useState<TriageDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useDataScope();

  const load = useCallback(async () => {
    try {
      setError(null);
      const svc = await import('../services/triage-service');
      if (patientId) {
        const data = await svc.getTriageByPatient(patientId);
        setTriages(data);
      } else {
        const data = await svc.getAllTriage(scope);
        setTriages(data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load triage records');
    } finally {
      setLoading(false);
    }
  }, [scope, patientId]);

  useEffect(() => { load(); }, [load]);

  // Live subscription — any triage write anywhere re-renders consumers.
  useEffect(() => {
    let cancelled = false;
    const changes = triageDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => { if (!cancelled) load(); })
      .on('error', (err) => { console.warn('Triage subscription error:', err); });
    return () => {
      cancelled = true;
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  const create = useCallback(async (
    data: Omit<TriageDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
  ) => {
    const { createTriage } = await import('../services/triage-service');
    const doc = await createTriage(data);
    await load();
    return doc;
  }, [load]);

  const update = useCallback(async (id: string, updates: Partial<TriageDoc>) => {
    const { updateTriage } = await import('../services/triage-service');
    const doc = await updateTriage(id, updates);
    await load();
    return doc;
  }, [load]);

  return { triages, loading, error, create, update, reload: load };
}
