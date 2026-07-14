'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OrganizationDoc } from '../db-types';
import { makeCoalescer } from './live-reload';
import { organizationsDB } from '../db';

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<OrganizationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    try {
      setError(null);
      const { getAllOrganizations } = await import('../services/organization-service');
      const data = await getAllOrganizations();
      setOrganizations(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrganizations(); }, [loadOrganizations]);

  // Live PouchDB subscription — reflect writes arriving from sync/other tabs.
  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) loadOrganizations(); });
    const changes = organizationsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* transient feed errors; next load resyncs */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [loadOrganizations]);

  const create = useCallback(async (
    data: Omit<OrganizationDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>,
    actorId?: string, actorUsername?: string
  ) => {
    const { createOrganization } = await import('../services/organization-service');
    const org = await createOrganization(data, actorId, actorUsername);
    await loadOrganizations();
    return org;
  }, [loadOrganizations]);

  const update = useCallback(async (
    id: string,
    data: Partial<OrganizationDoc>,
    actorId?: string, actorUsername?: string
  ) => {
    const { updateOrganization } = await import('../services/organization-service');
    const org = await updateOrganization(id, data, actorId, actorUsername);
    await loadOrganizations();
    return org;
  }, [loadOrganizations]);

  const deactivate = useCallback(async (
    id: string,
    actorId?: string, actorUsername?: string
  ) => {
    const { deactivateOrganization } = await import('../services/organization-service');
    await deactivateOrganization(id, actorId, actorUsername);
    await loadOrganizations();
  }, [loadOrganizations]);

  const getStats = useCallback(async (orgId: string) => {
    const { getOrganizationStats } = await import('../services/organization-service');
    return getOrganizationStats(orgId);
  }, []);

  return { organizations, loading, error, create, update, deactivate, getStats, reload: loadOrganizations };
}
