/**
 * Procedure service.
 *
 * Bedside/theatre procedures performed on a patient (e.g. wound
 * debridement, incision & drainage, suturing, IUD insertion). Anchored to
 * the patient (not required to be tied to a single encounter, though
 * `encounterId` may record which visit it happened during). Mirrors the
 * Problem List service (`problem-service.ts`) shape/lifecycle.
 */
import { proceduresDB, hospitalsDB } from '../db';
import type { ProcedureDoc, HospitalDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { findByType } from './db-query';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';

async function inferOrgIdFromHospital(hospitalId?: string): Promise<string | undefined> {
  if (!hospitalId) return undefined;
  try {
    const hosp = await hospitalsDB().get(hospitalId) as HospitalDoc;
    return hosp.orgId;
  } catch {
    return undefined;
  }
}

export async function getAllProcedures(scope?: DataScope): Promise<ProcedureDoc[]> {
  const db = proceduresDB();
  const all = (await findByType<ProcedureDoc>(db, 'procedure'))
    .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function getProceduresByPatient(patientId: string): Promise<ProcedureDoc[]> {
  const all = await getAllProcedures();
  return all.filter(p => p.patientId === patientId);
}

export async function createProcedure(
  data: Omit<ProcedureDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<ProcedureDoc> {
  const db = proceduresDB();
  const now = new Date().toISOString();
  const orgId = data.orgId || await inferOrgIdFromHospital(data.hospitalId);
  const doc: ProcedureDoc = {
    _id: `procedure-${uuidv4().slice(0, 8)}`,
    type: 'procedure',
    ...data,
    orgId,
    createdAt: now,
    updatedAt: now,
  } as ProcedureDoc;
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe(
    'PROCEDURE_CREATED',
    undefined,
    data.performedByName,
    `Procedure ${doc._id}: ${doc.name} for ${doc.patientName || doc.patientId}`,
  );
  emitSyncEvent({
    resourceType: 'procedure',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.hospitalId,
  });
  return doc;
}

export async function updateProcedure(id: string, data: Partial<ProcedureDoc>): Promise<ProcedureDoc | null> {
  const db = proceduresDB();
  try {
    const existing = await db.get(id) as ProcedureDoc;
    const updated: ProcedureDoc = {
      ...existing,
      ...data,
      _id: existing._id,
      _rev: existing._rev,
      type: 'procedure',
      updatedAt: new Date().toISOString(),
    };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('PROCEDURE_UPDATED', undefined, undefined, `Procedure ${id}: ${updated.name}`);
    emitSyncEvent({
      resourceType: 'procedure',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.hospitalId,
    });
    return updated;
  } catch {
    return null;
  }
}

export async function deleteProcedure(id: string): Promise<boolean> {
  const db = proceduresDB();
  try {
    const doc = await db.get(id);
    const typed = doc as unknown as ProcedureDoc;
    await db.remove(doc);
    await logAuditSafe('DELETE_PROCEDURE', undefined, undefined, `Procedure ${id}: ${typed.name} for ${typed.patientName || typed.patientId}`);
    emitSyncEvent({
      resourceType: 'procedure',
      resourceId: id,
      operation: 'delete',
      orgId: typed.orgId,
      hospitalId: typed.hospitalId,
    });
    return true;
  } catch {
    return false;
  }
}
