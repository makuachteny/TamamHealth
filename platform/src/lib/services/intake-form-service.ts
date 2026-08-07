import { intakeFormsDB } from '../db';
import type { IntakeFormField, PatientIntakeFormDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { findByType } from './db-query';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { v4 as uuidv4 } from 'uuid';

export async function getAllIntakeForms(scope?: DataScope): Promise<PatientIntakeFormDoc[]> {
  const db = intakeFormsDB();
  const all = await findByType<PatientIntakeFormDoc>(db, 'patient_intake_form');
  all.sort((a, b) => (b.receivedAt || b.requestedAt).localeCompare(a.receivedAt || a.requestedAt));
  return scope ? filterByScope(all, scope) : all;
}

export async function getIntakeFormById(id: string): Promise<PatientIntakeFormDoc | null> {
  try {
    const db = intakeFormsDB();
    return await db.get(id) as PatientIntakeFormDoc;
  } catch {
    return null;
  }
}

export async function createIntakeForm(
  data: Omit<PatientIntakeFormDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<PatientIntakeFormDoc> {
  const db = intakeFormsDB();
  const now = new Date().toISOString();
  const doc: PatientIntakeFormDoc = {
    _id: `intake-${uuidv4().slice(0, 8)}`,
    type: 'patient_intake_form',
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  emitSyncEvent({
    resourceType: 'patient_intake_form',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.hospitalId,
  });
  return doc;
}

/**
 * Reject a submitted intake form without writing anything to the chart. The
 * form leaves the pending-review queue and is recorded as rejected.
 */
export async function rejectIntakeForm(id: string, rejectedBy: string): Promise<PatientIntakeFormDoc | null> {
  const db = intakeFormsDB();
  try {
    const existing = await db.get(id) as PatientIntakeFormDoc;
    const updated: PatientIntakeFormDoc = {
      ...existing,
      status: 'rejected',
      mergedBy: rejectedBy,
      updatedAt: new Date().toISOString(),
    };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('REJECT_INTAKE_FORM', existing.patientId, rejectedBy, `Intake form ${id} rejected`);
    emitSyncEvent({
      resourceType: 'patient_intake_form',
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
 * Merge a submitted intake form's fields into the matching patient's chart
 * and mark the form as merged. `updates` is a Partial<PatientDoc>-shaped
 * object built by the reviewer from the form's fields (kept loosely typed
 * here to avoid a circular import on PatientDoc from a service that's
 * primarily about the intake form lifecycle).
 *
 * Failures are NOT swallowed: a failed `updatePatient` or `db.put` reaches
 * the caller as a rejected promise, not a silent `null`, so the
 * front-desk/patient-intake UI can show a real error instead of telling the
 * clerk the form was merged when the chart was never touched.
 */
export async function mergeIntakeFormToChart(
  id: string,
  patientUpdates: Record<string, unknown>,
  mergedBy: string
): Promise<PatientIntakeFormDoc> {
  const db = intakeFormsDB();
  const existing = await db.get(id) as PatientIntakeFormDoc;
  // A merge only ever ADDS what the patient answered. An unanswered field
  // arrives as an empty string, and writing that through would erase whatever
  // the desk had already recorded — a blank intake line silently deleting a
  // phone number on file. Nothing here can clear a chart field; correcting one
  // to empty stays a deliberate edit in the chart itself.
  const additions = Object.fromEntries(
    Object.entries(patientUpdates).filter(([, value]) => (
      value !== undefined && value !== null && String(value).trim() !== ''
    )),
  );
  if (existing.patientId && Object.keys(additions).length > 0) {
    const { updatePatient } = await import('./patient-service');
    await updatePatient(existing.patientId, additions);
  }
  const updated: PatientIntakeFormDoc = {
    ...existing,
    status: 'merged',
    mergedAt: new Date().toISOString(),
    mergedBy,
    updatedAt: new Date().toISOString(),
  };
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  await logAuditSafe('MERGE_INTAKE_FORM', existing.patientId, mergedBy, `Intake form ${id} merged into patient chart`);
  emitSyncEvent({
    resourceType: 'patient_intake_form',
    resourceId: updated._id,
    operation: 'update',
    resourceVersion: updated._rev,
    orgId: updated.orgId,
    hospitalId: updated.hospitalId,
  });
  return updated;
}

export async function sendIntakeFormRequest(
  patientId: string | undefined,
  patientName: string,
  fields: IntakeFormField[],
  data: Partial<Pick<PatientIntakeFormDoc, 'hospitalNumber' | 'providerId' | 'providerName' | 'hospitalId' | 'orgId'>>
): Promise<PatientIntakeFormDoc> {
  return createIntakeForm({
    patientId,
    patientName,
    status: 'not_submitted',
    requestedAt: new Date().toISOString(),
    fields,
    ...data,
  });
}
