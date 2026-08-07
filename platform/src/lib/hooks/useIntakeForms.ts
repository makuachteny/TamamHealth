'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { makeCoalescer } from './live-reload';
import type { IntakeFormField, PatientIntakeFormDoc } from '../db-types';
import { intakeFormsDB } from '../db';
import { useApp } from '../context';
import type { SmsSendResult, SmsChannel } from '../sms';
import { sendEmail, type EmailSendResult } from '../email';

// Extra field persisted on the intake doc when an SMS notification is
// attempted alongside the request — mirrors the `smsResult` pattern used on
// MessageDoc (see appointment-reminder-service.ts) without needing to widen
// the shared PatientIntakeFormDoc type for a best-effort side channel.
// Delivery receipts for the two patient-facing channels, stored on the intake
// document itself so staff can see what actually reached the patient.
type IntakeFormWithSms = PatientIntakeFormDoc & {
  smsResult?: SmsSendResult;
  emailResult?: EmailSendResult;
};

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

  const submitAnswers = useCallback(async (id: string, answers: Record<string, string>, submittedBy?: string) => {
    const { submitIntakeFormAnswers } = await import('../services/intake-form-service');
    await submitIntakeFormAnswers(id, answers, submittedBy);
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
    // Optional: notify the PATIENT alongside the request — SMS and/or email, to
    // the contact details on their own record. Best-effort in both cases: a
    // delivery failure never blocks the intake request itself from being
    // created, and the raw result is stored so staff can see what happened.
    smsOptions?: { send: boolean; phone?: string; facilityName?: string; channel?: SmsChannel },
    emailOptions?: { send: boolean; email?: string; facilityName?: string },
  ): Promise<{ sms?: SmsSendResult; email?: EmailSendResult }> => {
    const { sendIntakeFormRequest } = await import('../services/intake-form-service');
    const created = await sendIntakeFormRequest(patientId, patientName, fields, data);

    const formList = fields.map(f => f.label).join(', ');
    // The link the patient opens. Built from the browser's own origin so it is
    // right in local dev and on the deployed site without extra config. Sent
    // only when the request actually carries a token — an older document
    // without one would otherwise produce a link to nowhere.
    const { intakeFormPath } = await import('../services/intake-form-service');
    const link = created.accessToken && typeof window !== 'undefined'
      ? `${window.location.origin}${intakeFormPath(created.accessToken)}`
      : '';

    let smsResult: SmsSendResult | undefined;
    if (smsOptions?.send && smsOptions.phone) {
      const facility = smsOptions.facilityName || 'Your clinic';
      const body = link
        ? `${facility}: please complete your intake forms (${formList}) here: ${link} — you will be asked for your surname and date of birth.`
        : `${facility}: please complete your intake forms (${formList}) at reception or on your next visit.`;
      try {
        const { sendSms } = await import('../sms');
        smsResult = await sendSms({ to: smsOptions.phone, body, channel: smsOptions.channel });
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

    let emailResult: EmailSendResult | undefined;
    if (emailOptions?.send && emailOptions.email) {
      const facility = emailOptions.facilityName || 'Your clinic';
      emailResult = await sendEmail({
        to: emailOptions.email,
        subject: `${facility}: your intake forms`,
        // Addressed to the patient, in the second person. Lists exactly what
        // was requested so the mail is actionable on its own.
        body: `Hello ${patientName},\n\n`
          + `${facility} has asked you to complete the following before your visit: ${formList}.\n\n`
          + (link
            ? `Open your forms here:\n${link}\n\n`
              + `You will be asked for your surname and date of birth to confirm the forms are yours.\n\n`
            : `You can fill these in at reception when you arrive, or ask staff for help completing them in advance.\n\n`)
          + `Please do not reply to this message.`,
      });

      try {
        const db = intakeFormsDB();
        const doc = await db.get(created._id) as IntakeFormWithSms;
        const updated: IntakeFormWithSms = { ...doc, emailResult, updatedAt: new Date().toISOString() };
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

    // What the desk needs later: which channels carried the link, not just
    // whether a gateway accepted it. Written once, after both attempts, so a
    // single put covers them.
    const sentVia: ('sms' | 'whatsapp' | 'email')[] = [];
    if (smsResult?.ok) sentVia.push(smsOptions?.channel === 'whatsapp' ? 'whatsapp' : 'sms');
    if (emailResult?.ok) sentVia.push('email');
    if (sentVia.length > 0) {
      try {
        const db = intakeFormsDB();
        const doc = await db.get(created._id) as IntakeFormWithSms;
        await db.put({ ...doc, sentVia, updatedAt: new Date().toISOString() });
      } catch { /* best-effort record-keeping; the sends already happened */ }
    }

    await loadForms();
    return { sms: smsResult, email: emailResult };
  }, [loadForms]);

  return { forms, loading, error, merge, reject, submitAnswers, sendRequest, reload: loadForms };
}
