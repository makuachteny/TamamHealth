'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FacilityAssessmentDoc } from '../db-types';
import { useDataScope } from './useDataScope';

export function useFacilityAssessments() {
  const [assessments, setAssessments] = useState<FacilityAssessmentDoc[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof import('../services/facility-assessment-service').getAssessmentSummary>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scope = useDataScope();

  const load = useCallback(async () => {
    try {
      setError(null);
      const { getAllAssessments, getAssessmentSummary } = await import('../services/facility-assessment-service');
      const [data, s] = await Promise.all([getAllAssessments(scope), getAssessmentSummary(scope)]);
      setAssessments(data);
      setSummary(s);
    } catch (err) {
      console.error('Failed to load assessments', err);
      setError('Failed to load facility assessments');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: Omit<FacilityAssessmentDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) => {
    const { createAssessment } = await import('../services/facility-assessment-service');
    const doc = await createAssessment(data);
    await load();
    return doc;
  }, [load]);

  return { assessments, summary, loading, error, create, reload: load };
}
