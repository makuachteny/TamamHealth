import { labResultsDB, hospitalsDB } from '../db';
import type { LabResultDoc, HospitalDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';

async function inferOrgIdFromHospital(hospitalId?: string): Promise<string | undefined> {
  if (!hospitalId) return undefined;
  try {
    const hdb = hospitalsDB();
    const hosp = await hdb.get(hospitalId) as HospitalDoc;
    return hosp.orgId;
  } catch {
    return undefined;
  }
}

export async function getAllLabResults(scope?: DataScope): Promise<LabResultDoc[]> {
  const db = labResultsDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as LabResultDoc)
    .filter(d => d && d.type === 'lab_result')
    .sort((a, b) => (b.orderedAt || '').localeCompare(a.orderedAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function getLabResultsByPatient(patientId: string): Promise<LabResultDoc[]> {
  const all = await getAllLabResults();
  return all.filter(l => l.patientId === patientId);
}

export async function createLabResult(
  data: Omit<LabResultDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<LabResultDoc> {
  const db = labResultsDB();
  const now = new Date().toISOString();
  const orgId = data.orgId || await inferOrgIdFromHospital(data.hospitalId);
  const doc: LabResultDoc = {
    _id: `lab-${uuidv4().slice(0, 8)}`,
    type: 'lab_result',
    ...data,
    orgId,
    createdAt: now,
    updatedAt: now,
  } as LabResultDoc;
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_LAB_ORDER', undefined, undefined, `Lab order ${doc._id}: ${doc.testName} for ${doc.patientName}`);
  emitSyncEvent({
    resourceType: 'lab_result',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.hospitalId,
  });
  return doc;
}

export async function updateLabResult(id: string, data: Partial<LabResultDoc>): Promise<LabResultDoc | null> {
  const db = labResultsDB();
  try {
    const existing = await db.get(id) as LabResultDoc;
    const updated = { ...existing, ...data, _id: existing._id, _rev: existing._rev, updatedAt: new Date().toISOString() };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_LAB_RESULT', undefined, undefined, `Lab ${id} status: ${updated.status}${updated.result ? `, result: ${updated.result}` : ''}`);
    emitSyncEvent({
      resourceType: 'lab_result',
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

export async function getPendingLabResults(): Promise<LabResultDoc[]> {
  const all = await getAllLabResults();
  return all.filter(l => l.status === 'pending' || l.status === 'in_progress');
}
