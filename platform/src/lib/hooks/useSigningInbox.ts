'use client';

import { useState, useEffect, useCallback } from 'react';
import { makeCoalescer } from './live-reload';
import type { MedicalRecordDoc, AssessmentDoc } from '../db-types';
import { medicalRecordsDB, assessmentsDB } from '../db';
import { useDataScope } from './useDataScope';

export interface SigningInboxState {
  /** Draft/legacy consult notes that have not yet been signed. */
  unsignedDrafts: MedicalRecordDoc[];
  /** Trainee-signed notes awaiting a supervising provider's co-signature. */
  awaitingCosign: MedicalRecordDoc[];
  /** Outcome-measure assessments entered by the front desk, awaiting review/signature. */
  heldAssessments: AssessmentDoc[];
  loading: boolean;
  reload: () => void;
}

/**
 * The logged-in clinician's "documents to sign" worklist — the EHR equivalent
 * of the Centricity Chart Desktop inbox. Surfaces unsigned drafts and notes
 * pending co-signature, scoped to the user's facility/org, and live-reloads as
 * records are signed or created elsewhere.
 */
export function useSigningInbox(): SigningInboxState {
  const scope = useDataScope();
  const [unsignedDrafts, setUnsignedDrafts] = useState<MedicalRecordDoc[]>([]);
  const [awaitingCosign, setAwaitingCosign] = useState<MedicalRecordDoc[]>([]);
  const [heldAssessments, setHeldAssessments] = useState<AssessmentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [{ getSigningInbox }, { getHeldAssessments }] = await Promise.all([
        import('../services/medical-record-service'),
        import('../services/assessment-service'),
      ]);
      const [inbox, held] = await Promise.all([getSigningInbox(scope), getHeldAssessments(scope)]);
      setUnsignedDrafts(inbox.unsignedDrafts);
      setAwaitingCosign(inbox.awaitingCosign);
      setHeldAssessments(held);
    } catch (err) {
      console.error('Failed to load signing inbox', err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const recChanges = medicalRecordsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger()).on('error', () => { /* noop */ });
    const asmtChanges = assessmentsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger()).on('error', () => { /* noop */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { recChanges.cancel(); } catch { /* noop */ }
      try { asmtChanges.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  return { unsignedDrafts, awaitingCosign, heldAssessments, loading, reload: load };
}
