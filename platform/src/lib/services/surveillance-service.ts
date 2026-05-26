import { diseaseAlertsDB } from '../db';
import type { DiseaseAlertDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';

export async function getAllAlerts(scope?: DataScope): Promise<DiseaseAlertDoc[]> {
  const db = diseaseAlertsDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as DiseaseAlertDoc)
    .filter(d => d && d.type === 'disease_alert')
    .sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function getActiveAlerts(): Promise<DiseaseAlertDoc[]> {
  const all = await getAllAlerts();
  return all.filter(a => a.alertLevel === 'emergency' || a.alertLevel === 'warning');
}

export async function updateAlert(id: string, data: Partial<DiseaseAlertDoc>): Promise<DiseaseAlertDoc | null> {
  const db = diseaseAlertsDB();
  try {
    const existing = await db.get(id) as DiseaseAlertDoc;
    const updated = {
      ...existing,
      ...data,
      _id: existing._id,
      _rev: existing._rev,
      updatedAt: new Date().toISOString(),
    };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    return updated;
  } catch {
    return null;
  }
}

export async function deleteAlert(id: string): Promise<boolean> {
  const db = diseaseAlertsDB();
  try {
    const doc = await db.get(id);
    await db.remove(doc);
    return true;
  } catch {
    return false;
  }
}

export async function createAlert(
  data: Omit<DiseaseAlertDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<DiseaseAlertDoc> {
  const db = diseaseAlertsDB();
  const now = new Date().toISOString();
  const doc: DiseaseAlertDoc = {
    _id: `alert-${uuidv4().slice(0, 8)}`,
    type: 'disease_alert',
    ...data,
    createdAt: now,
    updatedAt: now,
  } as DiseaseAlertDoc;
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  return doc;
}
