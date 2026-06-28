/**
 * Clinician-saved consultation templates — a named bundle of diagnoses,
 * medicines, labs and plan text captured from a real visit and re-applied in
 * one click. The HealthBridge "save as template (bronchitis adult)" idea.
 *
 * Personal to the clinician who saved them (distinct from admin-curated order
 * sets). Synced org-scoped so they follow the clinician across workstations,
 * but excluded from national analytics — see the sync coverage matrix.
 */
import { v4 as uuidv4 } from 'uuid';
import { consultationTemplatesDB } from '../db';
import type { ConsultationTemplateDoc } from '../db-types';
import { findByType } from './db-query';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';

function byUse(a: ConsultationTemplateDoc, b: ConsultationTemplateDoc): number {
  const u = (b.useCount ?? 0) - (a.useCount ?? 0);
  if (u !== 0) return u;
  return (a.name || '').localeCompare(b.name || '');
}

/** A clinician's saved templates, most-used first. */
export async function getConsultationTemplates(userId: string): Promise<ConsultationTemplateDoc[]> {
  const rows = await findByType<ConsultationTemplateDoc>(
    consultationTemplatesDB(),
    'consultation_template',
    { userId },
    { indexFields: ['type', 'userId'] },
  );
  return rows.sort(byUse);
}

export type SaveTemplateInput = Pick<
  ConsultationTemplateDoc,
  'userId' | 'name' | 'diagnoses' | 'labs' | 'medications' | 'planText' | 'hospitalId' | 'orgId'
> & { userName?: string };

/** Persist the current consultation selections as a named template. */
export async function saveConsultationTemplate(input: SaveTemplateInput): Promise<ConsultationTemplateDoc> {
  const name = (input.name || '').trim();
  if (!name) throw new Error('A template name is required');
  const hasContent = (input.diagnoses?.length || input.medications?.length || input.labs?.length || (input.planText || '').trim());
  if (!hasContent) throw new Error('Cannot save an empty template');
  const db = consultationTemplatesDB();
  const now = new Date().toISOString();
  const doc: ConsultationTemplateDoc = {
    _id: `ctmpl-${uuidv4().slice(0, 8)}`,
    type: 'consultation_template',
    userId: input.userId,
    name,
    diagnoses: input.diagnoses,
    labs: input.labs,
    medications: input.medications,
    planText: input.planText,
    useCount: 0,
    hospitalId: input.hospitalId,
    orgId: input.orgId,
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('SAVE_CONSULTATION_TEMPLATE', input.userId, input.userName, `Saved consultation template "${name}"`);
  emitSyncEvent({ resourceType: 'consultation_template', resourceId: doc._id, operation: 'create', resourceVersion: doc._rev, hospitalId: doc.hospitalId, orgId: doc.orgId });
  return doc;
}

/** Delete a template. Returns true if it existed. */
export async function deleteConsultationTemplate(id: string, userName?: string): Promise<boolean> {
  const db = consultationTemplatesDB();
  try {
    const doc = (await db.get(id)) as ConsultationTemplateDoc;
    await db.remove({ _id: doc._id, _rev: doc._rev! });
    await logAuditSafe('DELETE_CONSULTATION_TEMPLATE', doc.userId, userName, `Deleted consultation template "${doc.name}"`);
    emitSyncEvent({ resourceType: 'consultation_template', resourceId: id, operation: 'delete', hospitalId: doc.hospitalId, orgId: doc.orgId });
    return true;
  } catch {
    return false;
  }
}

/** Bump a template's use counter when applied (best-effort, never throws). */
export async function bumpTemplateUse(id: string): Promise<void> {
  const db = consultationTemplatesDB();
  try {
    const doc = (await db.get(id)) as ConsultationTemplateDoc;
    doc.useCount = (doc.useCount ?? 0) + 1;
    doc.updatedAt = new Date().toISOString();
    const resp = await db.put(doc);
    emitSyncEvent({ resourceType: 'consultation_template', resourceId: id, operation: 'update', resourceVersion: resp.rev, hospitalId: doc.hospitalId, orgId: doc.orgId });
  } catch {
    /* missing / transient — nothing to bump */
  }
}
