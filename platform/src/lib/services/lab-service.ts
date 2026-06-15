import { labResultsDB, hospitalsDB } from '../db';
import { findByType } from './db-query';
import type { LabResultDoc, HospitalDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { labOrder, RESULT_REVIEW_SLA, type LabOrderStatus } from '../clinical-flow/order-lifecycles';

/**
 * The granular diagnostics-lifecycle stage of an order, defaulting older
 * orders (no `orderStatus`) from their coarse `status` field.
 */
export function effectiveOrderStatus(doc: Pick<LabResultDoc, 'orderStatus' | 'status'>): LabOrderStatus {
  if (doc.orderStatus) return doc.orderStatus;
  if (doc.status === 'completed') return 'resulted';
  if (doc.status === 'in_progress') return 'in_process';
  return 'ordered';
}

/** Coarse `status` derived from the granular lifecycle stage. */
function coarseFromOrderStatus(s: LabOrderStatus): LabResultDoc['status'] {
  if (s === 'in_process') return 'in_progress';
  if (s === 'resulted' || s === 'reviewed_by_clinician' || s === 'acted_upon' || s === 'communicated_to_patient') return 'completed';
  return 'pending';
}

/**
 * Advance a lab order to the next stage of its lifecycle, validated against
 * LAB_ORDER_TRANSITIONS. Keeps the coarse `status` in sync and stamps
 * `completedAt` when results first land. Throws on an illegal transition.
 */
export async function advanceLabOrder(
  id: string,
  to: LabOrderStatus,
  extra?: Partial<LabResultDoc>,
): Promise<LabResultDoc | null> {
  const db = labResultsDB();
  const existing = await db.get(id) as LabResultDoc;
  const from = effectiveOrderStatus(existing);
  if (from !== to && !labOrder.can(from, to)) {
    throw new Error(`Illegal lab order transition: ${from} → ${to}`);
  }
  const now = new Date().toISOString();
  const status = coarseFromOrderStatus(to);
  const completedAt = (to === 'resulted' && !existing.completedAt)
    ? new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : existing.completedAt;
  return updateLabResult(id, { ...extra, orderStatus: to, status, completedAt, updatedAt: now } as Partial<LabResultDoc>);
}

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
  const all = (await findByType<LabResultDoc>(db, 'lab_result'))
    .sort((a, b) => (b.orderedAt || '').localeCompare(a.orderedAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function getLabResultsByPatient(patientId: string): Promise<LabResultDoc[]> {
  return findByType<LabResultDoc>(labResultsDB(), 'lab_result', { patientId }, { indexFields: ['type', 'patientId'] });
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

/**
 * Results that are back (`resulted`) but not yet reviewed by a clinician past
 * their review SLA (24h for critical, 7 days for routine — RESULT_REVIEW_SLA).
 * Powers escalation so abnormal/critical results can't sit unseen.
 */
export async function getOverdueUnreviewedResults(scope?: DataScope): Promise<LabResultDoc[]> {
  const all = await getAllLabResults(scope);
  const now = Date.now();
  return all.filter(r => {
    if (effectiveOrderStatus(r) !== 'resulted') return false;
    const resultedAt = new Date(r.updatedAt || r.createdAt || '').getTime();
    if (!Number.isFinite(resultedAt)) return false;
    const slaHours = r.critical ? RESULT_REVIEW_SLA.criticalHours : RESULT_REVIEW_SLA.routineHours;
    return (now - resultedAt) / 3_600_000 > slaHours;
  });
}

export async function getPendingLabResults(): Promise<LabResultDoc[]> {
  const all = await getAllLabResults();
  return all.filter(l => l.status === 'pending' || l.status === 'in_progress');
}
