import { medicalRecordsDB } from '../db';
import type { MedicalRecordDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { validateMedicalRecord, ValidationError } from '../validation';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { findByType } from './db-query';

// Track per-database "we already created the patientId index" state. Mango
// `createIndex` is idempotent server-side but each call still issues a network
// round-trip — once per process per DB is enough.
const indexed = new Set<string>();

async function ensurePatientIdIndex(db: PouchDB.Database): Promise<void> {
  const dbName = (db as unknown as { name?: string }).name || 'unknown';
  if (indexed.has(dbName)) return;
  try {
    // pouchdb-find is loaded by loadPouchDB() in src/lib/db.ts for both
    // browser and server runtimes, so createIndex is always available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).createIndex({ index: { fields: ['type', 'patientId'] } });
  } catch {
    // If index creation fails (older CouchDB / view conflict), find() falls
    // back to a full scan. Cache the failure so we don't retry every call.
  }
  indexed.add(dbName);
}

export async function getRecordsByPatient(patientId: string, scope?: DataScope): Promise<MedicalRecordDoc[]> {
  const db = medicalRecordsDB();
  await ensurePatientIdIndex(db);
  // Mango query: cherry-pick only this patient's records instead of streaming
  // the entire medical_records DB (which at 1M rows is hundreds of MB).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db as any).find({
    selector: { type: 'medical_record', patientId },
    limit: 10000,
  }) as { docs: MedicalRecordDoc[] };
  let docs = (result.docs || []) as MedicalRecordDoc[];
  if (scope) docs = filterByScope(docs, scope);
  // Sort by consultedAt (full datetime) when present so records with the
  // same visitDate still order correctly. Fall back to visitDate/createdAt.
  /* istanbul ignore next -- defensive null-safety in sort fallback chain */
  docs.sort((a, b) => {
    const ak = a.consultedAt || a.visitDate || a.createdAt || '';
    const bk = b.consultedAt || b.visitDate || b.createdAt || '';
    return bk.localeCompare(ak);
  });
  return docs;
}

export async function createMedicalRecord(
  data: Omit<MedicalRecordDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<MedicalRecordDoc> {
  const errors = validateMedicalRecord(data as unknown as Record<string, unknown>);
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  const db = medicalRecordsDB();
  const now = new Date().toISOString();
  const doc: MedicalRecordDoc = {
    _id: `rec-${uuidv4().slice(0, 12)}`,
    type: 'medical_record',
    ...data,
    createdAt: now,
    updatedAt: now,
  } as MedicalRecordDoc;
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_MEDICAL_RECORD', undefined, undefined, `Record ${doc._id} for patient ${doc.patientId}`);
  emitSyncEvent({
    resourceType: 'medical_record',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.hospitalId,
  });
  return doc;
}

export async function updateMedicalRecord(id: string, data: Partial<MedicalRecordDoc>): Promise<MedicalRecordDoc | null> {
  const db = medicalRecordsDB();
  try {
    const existing = await db.get(id) as MedicalRecordDoc;
    const updated = {
      ...existing,
      ...data,
      _id: existing._id,
      _rev: existing._rev,
      updatedAt: new Date().toISOString(),
    };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_MEDICAL_RECORD', undefined, undefined, `Updated record ${id} for patient ${updated.patientId}`);
    emitSyncEvent({
      resourceType: 'medical_record',
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

export async function deleteMedicalRecord(id: string): Promise<boolean> {
  const db = medicalRecordsDB();
  try {
    const doc = await db.get(id);
    await db.remove(doc);
    emitSyncEvent({
      resourceType: 'medical_record',
      resourceId: id,
      operation: 'delete',
    });
    return true;
  } catch {
    return false;
  }
}

export async function getRecentRecords(limit: number = 20, scope?: DataScope): Promise<MedicalRecordDoc[]> {
  const db = medicalRecordsDB();
  let docs = await findByType<MedicalRecordDoc>(db, 'medical_record');
  if (scope) docs = filterByScope(docs, scope);
  return docs
    .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''))
    .slice(0, limit);
}
