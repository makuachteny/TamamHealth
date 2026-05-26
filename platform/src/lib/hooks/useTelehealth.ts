'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TelehealthSessionDoc, TelehealthStatus } from '../db-types';
import { telehealthDB } from '../db';
import { useDataScope } from './useDataScope';

export function useTelehealth() {
  const [sessions, setSessions] = useState<TelehealthSessionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useDataScope();

  const load = useCallback(async () => {
    try {
      setError(null);
      const { getAllSessions } = await import('../services/telehealth-service');
      const data = await getAllSessions(scope);
      setSessions(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load telehealth sessions');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const changes = telehealthDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => { if (!cancelled) load(); })
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  const create = useCallback(async (
    data: Omit<TelehealthSessionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'roomId'>
  ) => {
    const { createSession } = await import('../services/telehealth-service');
    const session = await createSession(data);
    await load();
    return session;
  }, [load]);

  const updateStatus = useCallback(async (
    id: string,
    status: TelehealthStatus,
    extra?: Partial<TelehealthSessionDoc>
  ) => {
    const { updateSessionStatus } = await import('../services/telehealth-service');
    await updateSessionStatus(id, status, extra);
    await load();
  }, [load]);

  const addNotes = useCallback(async (id: string, notes: string, diagnosis?: string, icd10Code?: string) => {
    const { addClinicalNotes } = await import('../services/telehealth-service');
    await addClinicalNotes(id, notes, diagnosis, icd10Code);
    await load();
  }, [load]);

  const rate = useCallback(async (id: string, rating: number, feedback?: string) => {
    const { rateSession } = await import('../services/telehealth-service');
    await rateSession(id, rating, feedback);
    await load();
  }, [load]);

  const update = useCallback(async (id: string, updates: Partial<TelehealthSessionDoc>) => {
    const { updateSession } = await import('../services/telehealth-service');
    await updateSession(id, updates);
    await load();
  }, [load]);

  return { sessions, loading, error, create, updateStatus, addNotes, rate, update, reload: load };
}

export function useTelehealthStats() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof import('../services/telehealth-service').getTelehealthStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const scope = useDataScope();

  const load = useCallback(async () => {
    try {
      const { getTelehealthStats } = await import('../services/telehealth-service');
      const data = await getTelehealthStats(scope);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let cancelled = false;
    const changes = telehealthDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => { if (!cancelled) load(); })
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  return { stats, loading, reload: load };
}
