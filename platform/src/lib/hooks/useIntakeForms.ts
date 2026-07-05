'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { makeCoalescer } from './live-reload';
import type { IntakeFormField, PatientIntakeFormDoc } from '../db-types';
import { intakeFormsDB } from '../db';
import { useApp } from '../context';

export function useIntakeForms() {
  const [forms, setForms] = useState<PatientIntakeFormDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useApp();
  const scope = useMemo(() => (
    currentUser ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role } : undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  const loadForms = useCallback(async () => {
    try {
      setError(null);
      const { getAllIntakeForms } = await import('../services/intake-form-service');
      const data = await getAllIntakeForms(scope);
      setForms(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load intake forms');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) loadForms(); });
    const changes = intakeFormsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [loadForms]);

  const merge = useCallback(async (id: string, patientUpdates: Record<string, unknown>, mergedBy: string) => {
    const { mergeIntakeFormToChart } = await import('../services/intake-form-service');
    await mergeIntakeFormToChart(id, patientUpdates, mergedBy);
    await loadForms();
  }, [loadForms]);

  const reject = useCallback(async (id: string, rejectedBy: string) => {
    const { rejectIntakeForm } = await import('../services/intake-form-service');
    await rejectIntakeForm(id, rejectedBy);
    await loadForms();
  }, [loadForms]);

  const sendRequest = useCallback(async (
    patientId: string | undefined,
    patientName: string,
    fields: IntakeFormField[],
    data: Partial<Pick<PatientIntakeFormDoc, 'hospitalNumber' | 'providerId' | 'providerName' | 'hospitalId' | 'orgId'>> = {}
  ) => {
    const { sendIntakeFormRequest } = await import('../services/intake-form-service');
    await sendIntakeFormRequest(patientId, patientName, fields, data);
    await loadForms();
  }, [loadForms]);

  return { forms, loading, error, merge, reject, sendRequest, reload: loadForms };
}
