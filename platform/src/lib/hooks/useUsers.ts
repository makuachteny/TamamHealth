'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserDoc, UserRole } from '../db-types';
import { useDataScope } from './useDataScope';
import { makeCoalescer } from './live-reload';
import { usersDB } from '../db';

export function useUsers() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useDataScope();

  const loadUsers = useCallback(async () => {
    try {
      const { getAllUsers } = await import('../services/user-service');
      const data = await getAllUsers(scope);
      setUsers(data);
      setError(null);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Live PouchDB subscription — reflect writes arriving from sync/other tabs.
  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) loadUsers(); });
    const changes = usersDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* transient feed errors; next load resyncs */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [loadUsers]);

  const create = useCallback(async (data: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    hospitalId?: string;
    hospitalName?: string;
  }, actorId?: string, actorUsername?: string) => {
    const { createUser } = await import('../services/user-service');
    const user = await createUser(data, actorId, actorUsername);
    await loadUsers();
    return user;
  }, [loadUsers]);

  const update = useCallback(async (id: string, data: {
    name?: string;
    phone?: string;
    role?: UserRole;
    hospitalId?: string;
    hospitalName?: string;
    isActive?: boolean;
  }, actorId?: string, actorUsername?: string) => {
    const { updateUser } = await import('../services/user-service');
    const user = await updateUser(id, data, actorId, actorUsername);
    await loadUsers();
    return user;
  }, [loadUsers]);

  const resetPassword = useCallback(async (
    id: string,
    newPassword: string,
    actorId?: string,
    actorUsername?: string
  ) => {
    const { resetPassword: resetPw } = await import('../services/user-service');
    await resetPw(id, newPassword, actorId, actorUsername);
  }, []);

  const deactivate = useCallback(async (
    id: string,
    actorId?: string,
    actorUsername?: string
  ) => {
    const { deactivateUser } = await import('../services/user-service');
    await deactivateUser(id, actorId, actorUsername);
    await loadUsers();
  }, [loadUsers]);

  return { users, loading, error, create, update, resetPassword, deactivate, reload: loadUsers };
}
