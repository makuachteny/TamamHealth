'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DiseaseAlertDoc } from '../db-types';
import { diseaseAlertsDB } from '../db';
import { useApp } from '../context';

export function useSurveillance() {
  const [alerts, setAlerts] = useState<DiseaseAlertDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useApp();
  const scope = useMemo(() => (
    currentUser ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role } : undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      const { getAllAlerts } = await import('../services/surveillance-service');
      const data = await getAllAlerts(scope);
      setAlerts(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load surveillance alerts');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Live PouchDB subscription: re-load on any disease alert change.
  useEffect(() => {
    let cancelled = false;
    const changes = diseaseAlertsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => { if (!cancelled) loadAlerts(); })
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [loadAlerts]);

  const create = useCallback(async (
    data: Omit<DiseaseAlertDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
  ) => {
    const { createAlert } = await import('../services/surveillance-service');
    const alert = await createAlert(data);
    await loadAlerts();
    return alert;
  }, [loadAlerts]);

  return { alerts, loading, error, create, reload: loadAlerts };
}
