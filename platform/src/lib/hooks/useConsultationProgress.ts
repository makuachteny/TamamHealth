'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ConsultationProgressDoc,
  ConsultationProgressMilestone,
  ConsultationProgressStage,
  ConsultationProgressTaskStatus,
  UserRole,
} from '../db-types';
import { consultationProgressDB } from '../db';
import { makeCoalescer } from './live-reload';
import { useApp } from '../context';

export function useConsultationProgress(patientId?: string) {
  const { currentUser } = useApp();
  const [progress, setProgress] = useState<ConsultationProgressDoc | null>(null);
  const [loading, setLoading] = useState(Boolean(patientId));
  const actor = {
    id: currentUser?._id,
    name: currentUser?.name || currentUser?.username,
    role: currentUser?.role as UserRole | undefined,
  };

  const load = useCallback(async () => {
    if (!patientId) { setProgress(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { getConsultationProgressByPatient } = await import('../services/consultation-progress-service');
      const next = await getConsultationProgressByPatient(patientId, currentUser ? {
        orgId: currentUser.orgId,
        hospitalId: currentUser.hospitalId,
        role: currentUser.role,
      } : undefined);
      setProgress(next);
    } catch { setProgress(null); }
    finally { setLoading(false); }
  }, [patientId, currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = consultationProgressDB().changes({ since: 'now', live: true, include_docs: true })
      .on('change', change => {
        const doc = change.doc as ConsultationProgressDoc | undefined;
        if (!doc || doc.patientId === patientId || change.deleted) reload.trigger();
      })
      .on('error', () => { /* offline-first: the next local change retries */ });
    return () => { cancelled = true; reload.cancel(); try { changes.cancel(); } catch { /* noop */ } };
  }, [patientId, load]);

  const ensure = useCallback(async (input: {
    patientName: string;
    hospitalId: string;
    hospitalName?: string;
    encounterId?: string;
    appointmentId?: string;
  }) => {
    if (!patientId) return null;
    const { ensureConsultationProgress } = await import('../services/consultation-progress-service');
    const next = await ensureConsultationProgress({
      ...input,
      patientId,
      orgId: currentUser?.orgId,
      actor,
    });
    setProgress(next);
    return next;
  }, [patientId, currentUser?.orgId, actor.id, actor.name, actor.role]);

  const updateStage = useCallback(async (stage: ConsultationProgressStage, nextAction?: string) => {
    if (!progress) return null;
    const { updateProgressStage } = await import('../services/consultation-progress-service');
    const next = await updateProgressStage(progress._id, stage, actor, nextAction);
    if (next) setProgress(next);
    return next;
  }, [progress, actor.id, actor.name, actor.role]);

  const addTask = useCallback(async (input: { title: string; priority: 'routine' | 'high' | 'urgent'; dueAt?: string }) => {
    if (!progress) return null;
    const { addProgressTask } = await import('../services/consultation-progress-service');
    const next = await addProgressTask(progress._id, { ...input }, actor);
    if (next) setProgress(next);
    return next;
  }, [progress, actor.id, actor.name, actor.role]);

  const updateTask = useCallback(async (taskId: string, status: ConsultationProgressTaskStatus) => {
    if (!progress) return null;
    const { updateProgressTask } = await import('../services/consultation-progress-service');
    const next = await updateProgressTask(progress._id, taskId, status, actor);
    if (next) setProgress(next);
    return next;
  }, [progress, actor.id, actor.name, actor.role]);

  const updateMilestone = useCallback(async (key: string, status: ConsultationProgressMilestone['status'], note?: string) => {
    if (!progress) return null;
    const { updateProgressMilestone } = await import('../services/consultation-progress-service');
    const next = await updateProgressMilestone(progress._id, key, status, actor, note);
    if (next) setProgress(next);
    return next;
  }, [progress, actor.id, actor.name, actor.role]);

  return { progress, loading, ensure, updateStage, addTask, updateTask, updateMilestone, reload: load };
}
