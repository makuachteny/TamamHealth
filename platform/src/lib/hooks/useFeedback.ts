'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PatientFeedbackDoc } from '../db-types-feedback';
import { patientFeedbackDB } from '../db';
import { useDataScope } from './useDataScope';

export function useFeedback() {
  const [feedback, setFeedback] = useState<PatientFeedbackDoc[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof import('../services/feedback-service').getFeedbackSummary>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useDataScope();

  const load = useCallback(async () => {
    try {
      setError(null);
      const { getAllFeedback, getFeedbackSummary } = await import('../services/feedback-service');
      const [list, sum] = await Promise.all([getAllFeedback(scope), getFeedbackSummary(scope)]);
      setFeedback(list);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load feedback', err);
      setError('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const changes = patientFeedbackDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => { if (!cancelled) load(); })
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  const submit = useCallback(async (input: Parameters<typeof import('../services/feedback-service').submitFeedback>[0]) => {
    const { submitFeedback } = await import('../services/feedback-service');
    const doc = await submitFeedback(input);
    await load();
    return doc;
  }, [load]);

  const resolve = useCallback(async (id: string, resolution: Parameters<typeof import('../services/feedback-service').resolveFeedback>[1]) => {
    const { resolveFeedback } = await import('../services/feedback-service');
    const doc = await resolveFeedback(id, resolution);
    await load();
    return doc;
  }, [load]);

  return { feedback, summary, loading, error, submit, resolve, reload: load };
}
