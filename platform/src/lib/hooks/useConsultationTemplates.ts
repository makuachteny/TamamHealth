'use client';

import { useState, useEffect, useCallback } from 'react';
import { makeCoalescer } from './live-reload';
import type { ConsultationTemplateDoc } from '../db-types';
import { consultationTemplatesDB } from '../db';
import type { SaveTemplateInput } from '../services/consultation-template-service';

/** A clinician's saved consultation templates, live-reloaded, most-used first. */
export function useConsultationTemplates(userId?: string) {
  const [templates, setTemplates] = useState<ConsultationTemplateDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setTemplates([]); setLoading(false); return; }
    try {
      const { getConsultationTemplates } = await import('../services/consultation-template-service');
      setTemplates(await getConsultationTemplates(userId));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = consultationTemplatesDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  const save = useCallback(async (input: Omit<SaveTemplateInput, 'userId'>) => {
    if (!userId) return null;
    const { saveConsultationTemplate } = await import('../services/consultation-template-service');
    const doc = await saveConsultationTemplate({ ...input, userId });
    await load();
    return doc;
  }, [userId, load]);

  const remove = useCallback(async (id: string) => {
    const { deleteConsultationTemplate } = await import('../services/consultation-template-service');
    const ok = await deleteConsultationTemplate(id);
    await load();
    return ok;
  }, [load]);

  const bumpUse = useCallback(async (id: string) => {
    const { bumpTemplateUse } = await import('../services/consultation-template-service');
    await bumpTemplateUse(id);
  }, []);

  return { templates, loading, save, remove, bumpUse, reload: load };
}
