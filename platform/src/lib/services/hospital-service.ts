import { hospitalsDB } from '../db';
import type { HospitalDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';

export async function getAllHospitals(scope?: DataScope): Promise<HospitalDoc[]> {
  const db = hospitalsDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as HospitalDoc)
    .filter(d => d && d.type === 'hospital');
  return scope ? filterByScope(all, scope) : all;
}

export async function getHospitalById(id: string): Promise<HospitalDoc | null> {
  try {
    const db = hospitalsDB();
    return await db.get(id) as HospitalDoc;
  } catch {
    return null;
  }
}

export async function createHospital(
  data: Omit<HospitalDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSync' | 'patientCount' | 'todayVisits'>,
  actorId?: string,
  actorUsername?: string
): Promise<HospitalDoc> {
  const db = hospitalsDB();
  const now = new Date().toISOString();
  const { v4: uuidv4 } = await import('uuid');
  const shortId = uuidv4().split('-')[0];

  const doc: HospitalDoc = {
    ...data,
    _id: `hosp-${shortId}`,
    type: 'hospital',
    syncStatus: 'offline',
    lastSync: now,
    patientCount: 0,
    todayVisits: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;
  const { logAudit } = await import('./audit-service');
  await logAudit('hospital_created', actorId, actorUsername, `Created hospital "${data.name}"`, true);
  return doc;
}

export async function updateHospitalStatus(
  id: string,
  data: Partial<HospitalDoc>
): Promise<HospitalDoc | null> {
  const db = hospitalsDB();
  try {
    const existing = await db.get(id) as HospitalDoc;
    const updated = { ...existing, ...data, _id: existing._id, _rev: existing._rev, updatedAt: new Date().toISOString() };
    const resp2 = await db.put(updated);
    updated._rev = resp2.rev;
    return updated;
  } catch {
    return null;
  }
}
