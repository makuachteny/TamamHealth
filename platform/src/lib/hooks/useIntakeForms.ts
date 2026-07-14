'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { makeCoalescer } from './live-reload';
import type { IntakeFormField, PatientIntakeFormDoc } from '../db-types';
import { intakeFormsDB } from '../db';
import { useApp } from '../context';
import type { SmsSendResult } from '../sms';

// Extra field persisted on the intake doc when an SMS notification is
// attempted alongside the request — mirrors the `smsResult` pattern used on
// MessageDoc (see appointment-reminder-service.ts) without needing to widen
// the shared PatientIntakeFormDoc type for a best-effort side channel.
type IntakeFormWithSms = PatientIntakeFormDoc & { smsResult?: SmsSendResult };

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
    data: Partial<Pick<PatientIntakeFormDoc, 'hospitalNumber' | 'providerId' | 'providerName' | 'hospitalId' | 'orgId'>> = {},
    // Optional: dispatch an SMS notification alongside the request. Best-effort —
    // a delivery failure never blocks the intake request itself from being created.
    smsOptions?: { send: boolean; phone?: string; facilityName?: string },
  ): Promise<SmsSendResult | undefined> => {
    const { sendIntakeFormRequest } = await import('../services/intake-form-service');
    const created = await sendIntakeFormRequest(patientId, patientName, fields, data);

    let smsResult: SmsSendResult | undefined;
    if (smsOptions?.send && smsOptions.phone) {
      const formList = fields.map(f => f.label).join(', ');
      const facility = smsOptions.facilityName || 'Your clinic';
      const body = `${facility}: please complete your intake forms (${formList}) at reception or on your next visit.`;
      try {
        const { sendSms } = await import('../sms');
        smsResult = await sendSms({ to: smsOptions.phone, body });
      } catch (err) {
        smsResult = { ok: false, providerId: 'error', error: err instanceof Error ? err.message : 'unknown_error' };
      }

      // Persist the raw send result on the intake doc (same field name/shape as
      // MessageDoc.smsResult) so staff can see delivery status; swallow any
      // persistence failure since the SMS attempt itself already happened.
      try {
        const db = intakeFormsDB();
        const doc = await db.get(created._id) as IntakeFormWithSms;
        const updated: IntakeFormWithSms = { ...doc, smsResult, updatedAt: new Date().toISOString() };
        const resp = await db.put(updated);
        updated._rev = resp.rev;
        const { emitSyncEvent } = await import('../services/sync-event-service');
        emitSyncEvent({
          resourceType: 'patient_intake_form',
          resourceId: updated._id,
          operation: 'update',
          resourceVersion: updated._rev,
          orgId: updated.orgId,
          hospitalId: updated.hospitalId,
        });
      } catch { /* best-effort; do not surface as a send failure */ }
    }

    await loadForms();
    return smsResult;
  }, [loadForms]);

  return { forms, loading, error, merge, reject, sendRequest, reload: loadForms };
}
