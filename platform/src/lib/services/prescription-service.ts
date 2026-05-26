import { prescriptionsDB } from '../db';
import type { PrescriptionDoc, MedicationAdministration } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { validatePrescription, ValidationError } from '../validation';
import { checkNewPrescription, type InteractionCheckResult } from './drug-interaction-service';

export async function getAllPrescriptions(scope?: DataScope): Promise<PrescriptionDoc[]> {
  const db = prescriptionsDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as PrescriptionDoc)
    .filter(d => d && d.type === 'prescription');
  /* istanbul ignore next -- defensive null-safety in sort */
  all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function getPrescriptionsByPatient(patientId: string, scope?: DataScope): Promise<PrescriptionDoc[]> {
  const all = await getAllPrescriptions(scope);
  return all.filter(p => p.patientId === patientId);
}

export interface PrescriptionCreateResult {
  prescription: PrescriptionDoc;
  interactionWarnings: InteractionCheckResult | null;
}

/**
 * Check a proposed medication against a patient's active prescriptions.
 */
export async function checkPrescriptionInteractions(
  patientId: string,
  newMedication: string,
): Promise<InteractionCheckResult> {
  const patientRx = await getPrescriptionsByPatient(patientId);
  const activeRx = patientRx
    .filter(rx => rx.status === 'pending')
    .map(rx => rx.medication);
  return checkNewPrescription(newMedication, activeRx);
}

export async function createPrescription(
  data: Omit<PrescriptionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<PrescriptionCreateResult> {
  // Validate required prescription fields
  const errors = validatePrescription(data as unknown as Record<string, unknown>);
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  // Check for drug interactions with patient's active prescriptions
  let interactionWarnings: InteractionCheckResult | null = null;
  try {
    interactionWarnings = await checkPrescriptionInteractions(
      data.patientId,
      data.medication,
    );
    // Log serious interactions to the audit trail
    if (interactionWarnings.hasInteractions &&
        (interactionWarnings.highestSeverity === 'contraindicated' ||
         interactionWarnings.highestSeverity === 'serious')) {
      await logAuditSafe(
        'DRUG_INTERACTION_WARNING',
        undefined,
        data.prescribedBy,
        `${interactionWarnings.highestSeverity?.toUpperCase()} interaction detected: ` +
        `${data.medication} for patient ${data.patientName}. ` +
        `Interactions: ${interactionWarnings.interactions.map(i => `${i.drug1}↔${i.drug2}`).join(', ')}`
      );
    }
  } catch {
    // Drug interaction check is advisory — don't block prescription on failure
  }

  const db = prescriptionsDB();
  const now = new Date().toISOString();
  const doc: PrescriptionDoc = {
    _id: `rx-${uuidv4().slice(0, 8)}`,
    type: 'prescription',
    ...data,
    createdAt: now,
    updatedAt: now,
  } as PrescriptionDoc;
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('PRESCRIPTION_CREATED', undefined, doc.prescribedBy,
    `Rx ${doc._id}: ${doc.medication} ${doc.dose} for ${doc.patientName}`
  );
  emitSyncEvent({
    resourceType: 'prescription',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    username: doc.prescribedBy,
    hospitalId: doc.hospitalId,
  });
  return { prescription: doc, interactionWarnings };
}

export async function updatePrescription(id: string, data: Partial<PrescriptionDoc>): Promise<PrescriptionDoc | null> {
  const db = prescriptionsDB();
  try {
    const existing = await db.get(id) as PrescriptionDoc;
    const updated = { ...existing, ...data, _id: existing._id, _rev: existing._rev, updatedAt: new Date().toISOString() };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('PRESCRIPTION_UPDATED', undefined, undefined, `Prescription ${id} status: ${updated.status}`);
    emitSyncEvent({
      resourceType: 'prescription',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      hospitalId: updated.hospitalId,
    });
    return updated;
  } catch {
    return null;
  }
}

export async function dispensePrescription(id: string, dispensedBy?: string): Promise<PrescriptionDoc | null> {
  const now = new Date().toISOString();
  const result = await updatePrescription(id, {
    status: 'dispensed',
    dispensedAt: now,
  });
  if (result) {
    await logAuditSafe('PRESCRIPTION_DISPENSED', undefined, dispensedBy || 'unknown',
      `Dispensed ${result.medication} ${result.dose} to ${result.patientName} (Rx: ${id})`
    );
  }
  return result;
}

// ===== Medication Administration Record (MAR) =====
//
// recordAdministration appends a new row to the prescription's
// administrations[] array. This is the legal bedside record of a nurse
// giving (or refusing/missing) one scheduled dose. Append-only — to
// correct an entry, append a new row with status='corrected'.

export interface AdministrationInput {
  prescriptionId: string;
  scheduledFor: string;          // ISO datetime of the scheduled dose
  status: MedicationAdministration['status'];
  doseGiven?: string;
  route?: string;
  administeredBy: string;
  administeredByName: string;
  witnessId?: string;
  witnessName?: string;
  reason?: string;
  notes?: string;
}

export async function recordAdministration(
  input: AdministrationInput,
): Promise<PrescriptionDoc | null> {
  const db = prescriptionsDB();
  try {
    const existing = await db.get(input.prescriptionId) as PrescriptionDoc;
    const now = new Date().toISOString();
    const entry: MedicationAdministration = {
      id: `madm-${uuidv4().slice(0, 8)}`,
      scheduledFor: input.scheduledFor,
      recordedAt: now,
      status: input.status,
      doseGiven: input.doseGiven || existing.dose,
      route: input.route || existing.route,
      administeredBy: input.administeredBy,
      administeredByName: input.administeredByName,
      witnessId: input.witnessId,
      witnessName: input.witnessName,
      reason: input.reason,
      notes: input.notes,
    };
    const next: PrescriptionDoc = {
      ...existing,
      administrations: [...(existing.administrations || []), entry],
      updatedAt: now,
    };
    const resp = await db.put(next);
    next._rev = resp.rev;
    await logAuditSafe(
      'MEDICATION_ADMINISTERED',
      undefined,
      input.administeredByName,
      `${entry.status.toUpperCase()} ${existing.medication} ${entry.doseGiven} ` +
      `to ${existing.patientName} (Rx: ${existing._id})` +
      (entry.witnessName ? ` witnessed by ${entry.witnessName}` : ''),
    );
    emitSyncEvent({
      resourceType: 'prescription',
      resourceId: next._id,
      operation: 'update',
      resourceVersion: next._rev,
      hospitalId: next.hospitalId,
      orgId: next.orgId,
    });
    return next;
  } catch {
    return null;
  }
}
