'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { OrderSetDoc } from '../db-types';
import { orderSetsDB } from '../db';
import { makeCoalescer } from './live-reload';
import { useApp } from '../context';

/**
 * Live list of order sets / clinical protocols visible to the current user.
 * Reference data, so writes are rare; we still subscribe to changes so an
 * admin edit shows up everywhere without a refresh.
 */
export function useOrderSets() {
  const [orderSets, setOrderSets] = useState<OrderSetDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useApp();
  const scope = useMemo(() => (
    currentUser ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role } : undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { getAllOrderSets } = await import('../services/order-set-service');
      setOrderSets(await getAllOrderSets(scope));
    } catch (err) {
      console.error(err);
      setError('Failed to load order sets');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = orderSetsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', (err) => { console.warn('Order sets subscription error:', err); });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  return { orderSets, loading, error, reload: load };
}
