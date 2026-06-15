'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PrescriptionDoc } from '../db-types';
import { prescriptionsDB } from '../db';
import { makeCoalescer } from './live-reload';
import { useDataScope } from './useDataScope';

export function usePrescriptions() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useDataScope();

  const loadPrescriptions = useCallback(async () => {
    try {
      setError(null);
      const { getAllPrescriptions } = await import('../services/prescription-service');
      const data = await getAllPrescriptions(scope);
      setPrescriptions(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  // Live subscription: re-load whenever a prescription is created or
  // dispensed anywhere in the app (consultation page, pharmacy queue, etc.).
  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) loadPrescriptions(); });
    const changes = prescriptionsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', (err) => { console.warn('Prescriptions subscription error:', err); });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [loadPrescriptions]);

  const create = useCallback(async (data: Omit<PrescriptionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) => {
    const { createPrescription } = await import('../services/prescription-service');
    const result = await createPrescription(data);
    await loadPrescriptions();
    return result;
  }, [loadPrescriptions]);

  const dispense = useCallback(async (id: string) => {
    const { dispensePrescription } = await import('../services/prescription-service');
    const result = await dispensePrescription(id);
    await loadPrescriptions();
    return result;
  }, [loadPrescriptions]);

  const administer = useCallback(async (
    input: import('../services/prescription-service').AdministrationInput,
  ) => {
    const { recordAdministration } = await import('../services/prescription-service');
    const result = await recordAdministration(input);
    await loadPrescriptions();
    return result;
  }, [loadPrescriptions]);

  const advance = useCallback(async (
    id: string,
    to: import('../clinical-flow/order-lifecycles').PrescriptionStatus,
    extra?: Partial<import('../db-types').PrescriptionDoc>,
  ) => {
    const { advancePrescription } = await import('../services/prescription-service');
    const result = await advancePrescription(id, to, extra);
    await loadPrescriptions();
    return result;
  }, [loadPrescriptions]);

  return { prescriptions, loading, error, create, dispense, administer, advance, reload: loadPrescriptions };
}
