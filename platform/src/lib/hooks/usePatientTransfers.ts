'use client';

/**
 * Client access to the internal patient-transfer workflow.
 *
 * Reads go straight to the local PouchDB replica so the transfer history and
 * the pending-request banner work offline like the rest of the chart. Writes go
 * through the service layer too — the permission checks that matter are
 * re-enforced server-side on `/api/patient-transfers`, and enforcing them here
 * as well is what keeps the UI from offering a button that will 403.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PatientTransferDoc,
  PatientTransferChecklistItem,
  PatientTransferType,
  PatientTransferUrgency,
  PatientDoc,
} from '../db-types';
import { patientTransfersDB } from '../db';
import { makeCoalescer } from './live-reload';
import { useApp } from '../context';

export interface TransferDraftInput {
  to: {
    providerId?: string;
    providerName?: string;
    department?: string;
    facilityId?: string;
    facilityName?: string;
    orgId?: string;
  };
  reason: string;
  transferType?: PatientTransferType;
  urgency?: PatientTransferUrgency;
  handoffNotes?: string;
  checklist?: PatientTransferChecklistItem[];
  effectiveAt?: string;
  expiresAt?: string;
  asDraft?: boolean;
  destination?: PatientTransferDoc['destination'];
  transport?: PatientTransferDoc['transport'];
  clinicalReadiness?: PatientTransferDoc['clinicalReadiness'];
  communication?: PatientTransferDoc['communication'];
}

export function usePatientTransfers(patientId?: string) {
  const { currentUser } = useApp();
  const [transfers, setTransfers] = useState<PatientTransferDoc[]>([]);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [error, setError] = useState<string | null>(null);

  const scope = useMemo(() => (currentUser ? {
    orgId: currentUser.orgId,
    hospitalId: currentUser.hospitalId,
    role: currentUser.role,
  } : undefined), [currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  const load = useCallback(async () => {
    if (!patientId) { setTransfers([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { getTransfersByPatient } = await import('../services/patient-transfer-service');
      // viewer id hides other people's unsent drafts.
      setTransfers(await getTransfersByPatient(patientId, scope, currentUser?._id));
    } catch {
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, scope, currentUser?._id]);

  useEffect(() => { load(); }, [load]);

  // Live-refresh: an accept/reject landing on another device must update this
  // chart, otherwise two clinicians can each believe they own the patient.
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = patientTransfersDB()
      .changes({ since: 'now', live: true, include_docs: true })
      .on('change', change => {
        const doc = change.doc as PatientTransferDoc | undefined;
        if (!doc || doc.patientId === patientId || change.deleted) reload.trigger();
      })
      .on('error', () => { /* offline-first: next local change retries */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [patientId, load]);

  /** The live transfer worth showing in a chart banner, if any. */
  const activeTransfer = useMemo(() => {
    const pending = transfers.find(t => t.status === 'requested' || t.status === 'accepted');
    if (pending) return pending;
    const now = Date.now();
    return transfers.find(t =>
      t.status === 'completed'
      && t.transferType !== 'permanent'
      && t.expiresAt
      && new Date(t.expiresAt).getTime() > now) ?? null;
  }, [transfers]);

  /** Wrap a mutation so every caller gets the same error/refresh handling. */
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setError(null);
    try {
      const result = await fn();
      await load();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer action failed');
      throw e;
    }
  }, [load]);

  const apiMutation = useCallback(async <T,>(body: Record<string, unknown>): Promise<T> => {
    const response = await fetch('/api/patient-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Transfer action failed');
    return payload.transfer as T;
  }, []);

  const request = useCallback(async (patient: PatientDoc, input: TransferDraftInput) => {
    return run(() => apiMutation({ action: input.asDraft ? 'request' : 'request', patientId: patient._id, ...input }));
  }, [run, apiMutation]);

  const accept = useCallback(async (id: string, notes?: string) => {
    return run(() => apiMutation({ action: 'accept', transferId: id, notes }));
  }, [run, apiMutation]);

  const reject = useCallback(async (id: string, notes: string) => {
    return run(() => apiMutation({ action: 'reject', transferId: id, notes }));
  }, [run, apiMutation]);

  const cancel = useCallback(async (id: string, reason?: string) => {
    return run(() => apiMutation({ action: 'cancel', transferId: id, reason }));
  }, [run, apiMutation]);

  const complete = useCallback(async (id: string) => {
    return run(() => apiMutation({ action: 'complete', transferId: id }));
  }, [run, apiMutation]);

  const addNote = useCallback(async (id: string, note: string) => {
    return run(() => apiMutation({ action: 'note', transferId: id, notes: note }));
  }, [run, apiMutation]);

  const updateLogistics = useCallback(async (id: string, patch: Record<string, unknown>) =>
    run(() => apiMutation({ action: 'logistics', transferId: id, ...patch })), [run, apiMutation]);
  const arrive = useCallback(async (id: string, assessment?: Record<string, unknown>) =>
    run(() => apiMutation({ action: 'arrive', transferId: id, assessment })), [run, apiMutation]);
  const close = useCallback(async (id: string) =>
    run(() => apiMutation({ action: 'close', transferId: id })), [run, apiMutation]);

  return {
    transfers,
    activeTransfer,
    loading,
    error,
    reload: load,
    request,
    accept,
    reject,
    cancel,
    complete,
    addNote,
    updateLogistics,
    arrive,
    close,
  };
}

/**
 * The signed-in user's transfer queue — requests awaiting their decision, and
 * the ones they sent that are still open.
 *
 * Separate from `usePatientTransfers` because it watches every transfer rather
 * than one chart's. This is what the dashboard's outstanding-work list reads:
 * a transfer request that only ever appears on the patient's own chart is
 * invisible to the person who has to answer it, since they have no reason to
 * open a chart that isn't theirs yet.
 */
export function useTransferQueue() {
  const { currentUser } = useApp();
  const [incoming, setIncoming] = useState<PatientTransferDoc[]>([]);
  const [outgoing, setOutgoing] = useState<PatientTransferDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser?._id) { setIncoming([]); setOutgoing([]); setLoading(false); return; }
    setLoading(true);
    try {
      const svc = await import('../services/patient-transfer-service');
      const scope = {
        orgId: currentUser.orgId,
        hospitalId: currentUser.hospitalId,
        role: currentUser.role,
      };
      const [inRows, outRows] = await Promise.all([
        svc.getIncomingTransfers({
          id: currentUser._id,
          department: currentUser.department,
          hospitalId: currentUser.hospitalId,
          role: currentUser.role,
        }, scope),
        svc.getOutgoingTransfers(currentUser._id, scope),
      ]);
      setIncoming(inRows);
      setOutgoing(outRows);
    } catch {
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }, [
    currentUser?._id, currentUser?.orgId, currentUser?.hospitalId,
    currentUser?.role, currentUser?.department,
  ]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = patientTransfersDB()
      .changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* offline-first: next local change retries */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  return { incoming, outgoing, loading, reload: load };
}
