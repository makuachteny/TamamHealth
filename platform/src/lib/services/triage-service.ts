import { triageDB } from '../db';
import type { TriageDoc, TriagePriority } from '../db-types';
import { v4 as uuidv4 } from 'uuid';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { findByType } from './db-query';
import { jubaDate } from '../time-juba';

/**
 * ETAT priority calculator — encodes the WHO decision tree.
 * Returns the priority string or '' if the assessment is incomplete.
 */
export function calculatePriority(data: {
  airway: TriageDoc['airway'] | '';
  breathing: TriageDoc['breathing'] | '';
  circulation: TriageDoc['circulation'] | '';
  consciousness: TriageDoc['consciousness'] | '';
}): TriagePriority | '' {
  if (!data.airway || !data.breathing || !data.circulation || !data.consciousness) return '';
  // RED — any life-threatening sign
  if (
    data.airway === 'obstructed' ||
    data.breathing === 'absent' ||
    data.circulation === 'absent' ||
    data.consciousness === 'unresponsive'
  ) return 'RED';
  // YELLOW — any priority sign
  if (
    data.breathing === 'distressed' ||
    data.circulation === 'impaired' ||
    data.consciousness === 'pain' ||
    data.consciousness === 'verbal'
  ) return 'YELLOW';
  return 'GREEN';
}

// Valid triage status transitions (state machine)
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['seen', 'admitted', 'discharged', 'referred'],
  seen: ['admitted', 'discharged', 'referred'],
  admitted: ['discharged', 'referred'],
  discharged: [],
  referred: ['discharged'],
};

export async function getAllTriage(scope?: DataScope): Promise<TriageDoc[]> {
  const db = triageDB();
  const all = await findByType<TriageDoc>(db, 'triage');
  /* istanbul ignore next -- defensive null-safety in sort */
  all.sort((a, b) => (b.triagedAt || '').localeCompare(a.triagedAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

/** Triages for a specific patient, newest first. */
export async function getTriageByPatient(patientId: string): Promise<TriageDoc[]> {
  const all = await getAllTriage();
  return all.filter(t => t.patientId === patientId);
}

/** Active (pending) triages for the current facility — feeds the nurse queue. */
export async function getActiveTriage(scope?: DataScope): Promise<TriageDoc[]> {
  const all = await getAllTriage(scope);
  return all.filter(t => t.status === 'pending' || t.status === 'seen');
}

export async function createTriage(
  data: Omit<TriageDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<TriageDoc> {
  const db = triageDB();
  const now = new Date().toISOString();
  const doc: TriageDoc = {
    _id: `triage-${uuidv4().slice(0, 8)}`,
    type: 'triage',
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('TRIAGE_RECORDED', data.triagedBy, data.triagedByName,
    `${data.priority} triage for ${data.patientName} (${data.patientId})`
  );
  emitSyncEvent({
    resourceType: 'triage',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });
  return doc;
}

export async function updateTriage(
  id: string,
  updates: Partial<TriageDoc>
): Promise<TriageDoc | null> {
  const db = triageDB();
  try {
    const existing = await db.get(id) as TriageDoc;

    // Enforce valid status transitions
    if (updates.status && updates.status !== existing.status) {
      /* istanbul ignore next -- defensive: all known statuses are in VALID_TRANSITIONS */
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(updates.status)) {
        throw new Error(`Invalid triage status transition: ${existing.status} → ${updates.status}`);
      }
    }

    const updated: TriageDoc = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    if (updates.status) {
      await logAuditSafe('TRIAGE_STATUS_CHANGE', updates.handoffTo, updates.handoffToName,
        `Triage ${id}: ${existing.status} → ${updates.status} for ${existing.patientName}`
      );
    }
    emitSyncEvent({
      resourceType: 'triage',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.facilityId,
    });
    return updated;
  } catch {
    return null;
  }
}

/** Stats for the nurse dashboard header (active reds, today's totals). */
export async function getTriageStats(scope?: DataScope) {
  const all = await getAllTriage(scope);
  const today = jubaDate();
  /* istanbul ignore next -- defensive null-safety in filter */
  const todays = all.filter(t => t.triagedAt ? jubaDate(t.triagedAt) === today : false);
  return {
    total: all.length,
    todayTotal: todays.length,
    todayRed: todays.filter(t => t.priority === 'RED').length,
    todayYellow: todays.filter(t => t.priority === 'YELLOW').length,
    todayGreen: todays.filter(t => t.priority === 'GREEN').length,
    pending: all.filter(t => t.status === 'pending').length,
  };
}
