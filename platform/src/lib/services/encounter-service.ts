/**
 * Clinical encounter service — persists and transitions an in-progress
 * consultation through the documented patient-journey state machine
 * (lib/clinical-flow/encounter-journey.ts). This is what lets a clinician
 * order labs, pause the visit (`awaiting_labs`), and resume it when results
 * return, instead of finalising everything in one shot.
 *
 * Transitions are validated against `canTransition()` so the system can only
 * move an encounter the way the architecture document allows.
 */
import { v4 as uuidv4 } from 'uuid';
import { encountersDB } from '../db';
import type { EncounterDoc } from '../db-types';
import {
  canTransition, stageOf, isTerminal, type EncounterStatus,
} from '../clinical-flow/encounter-journey';
import { findByType } from './db-query';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';

/** Statuses where the clinician has handed off and is waiting on a parallel order. */
export const RESUMABLE_STATUSES: EncounterStatus[] = [
  'awaiting_labs',
  'awaiting_imaging',
  'consultation_paused_draft',
];

export async function getEncounter(id: string): Promise<EncounterDoc | null> {
  try {
    return await encountersDB().get(id) as EncounterDoc;
  } catch {
    return null;
  }
}

export async function getAllEncounters(scope?: DataScope): Promise<EncounterDoc[]> {
  const rows = await findByType<EncounterDoc>(encountersDB(), 'clinical_encounter', {}, { indexFields: ['type'] });
  rows.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  return scope ? filterByScope(rows, scope) : rows;
}

/** Open (non-closed) encounters a clinician can resume, newest first. */
export async function getResumableEncounters(clinicianId?: string): Promise<EncounterDoc[]> {
  const rows = await findByType<EncounterDoc>(encountersDB(), 'clinical_encounter', {}, { indexFields: ['type'] });
  return rows
    .filter(e => !e.closedAt && RESUMABLE_STATUSES.includes(e.status))
    .filter(e => !clinicianId || e.clinicianId === clinicianId)
    .sort((a, b) => new Date(b.updatedAt || '').getTime() - new Date(a.updatedAt || '').getTime());
}

/** Create a new in-progress encounter (defaults to `with_clinician`). */
export async function createEncounter(
  data: Omit<EncounterDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'stageKey'> & { status?: EncounterStatus },
): Promise<EncounterDoc> {
  const db = encountersDB();
  const now = new Date().toISOString();
  const status: EncounterStatus = data.status ?? 'with_clinician';
  const doc: EncounterDoc = {
    _id: `enc-${uuidv4().slice(0, 8)}`,
    type: 'clinical_encounter',
    ...data,
    status,
    stageKey: stageOf(status),
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc as unknown as Record<string, unknown>);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_ENCOUNTER', data.clinicianId, undefined, `Encounter ${doc._id} for ${data.patientName} (${status})`);
  emitSyncEvent({ resourceType: 'clinical_encounter', resourceId: doc._id, operation: 'create', resourceVersion: doc._rev, orgId: doc.orgId, hospitalId: doc.hospitalId });
  return doc;
}

/** Patch an encounter's snapshot / lab order ids without changing status. */
export async function updateEncounter(id: string, patch: Partial<EncounterDoc>): Promise<EncounterDoc | null> {
  const db = encountersDB();
  try {
    const existing = await db.get(id) as EncounterDoc;
    const updated: EncounterDoc = { ...existing, ...patch, _id: existing._id, _rev: existing._rev, type: 'clinical_encounter', updatedAt: new Date().toISOString() };
    const resp = await db.put(updated as unknown as Record<string, unknown>);
    updated._rev = resp.rev;
    emitSyncEvent({ resourceType: 'clinical_encounter', resourceId: id, operation: 'update', resourceVersion: updated._rev, orgId: updated.orgId, hospitalId: updated.hospitalId });
    return updated;
  } catch {
    return null;
  }
}

/**
 * Move an encounter to a new status, enforcing the journey state machine.
 * Throws if the transition is not allowed by the architecture document.
 */
export async function transitionEncounter(
  id: string,
  to: EncounterStatus,
  opts?: { snapshot?: Record<string, unknown>; labOrderIds?: string[]; medicalRecordId?: string; actorId?: string },
): Promise<EncounterDoc> {
  const db = encountersDB();
  const existing = await db.get(id) as EncounterDoc;
  if (existing.status !== to && !canTransition(existing.status, to)) {
    throw new Error(`Illegal encounter transition: ${existing.status} → ${to}`);
  }
  const now = new Date().toISOString();
  const closed = ['ready_for_clinic_checkout', 'referred_out', 'admitted', 'deceased'].includes(to);
  const updated: EncounterDoc = {
    ...existing,
    status: to,
    stageKey: stageOf(to),
    snapshot: opts?.snapshot ?? existing.snapshot,
    labOrderIds: opts?.labOrderIds ?? existing.labOrderIds,
    medicalRecordId: opts?.medicalRecordId ?? existing.medicalRecordId,
    closedAt: closed ? now : existing.closedAt,
    updatedAt: now,
    _id: existing._id,
    _rev: existing._rev,
    type: 'clinical_encounter',
  };
  const resp = await db.put(updated as unknown as Record<string, unknown>);
  updated._rev = resp.rev;
  await logAuditSafe('TRANSITION_ENCOUNTER', opts?.actorId ?? existing.clinicianId, undefined, `Encounter ${id}: ${existing.status} → ${to}`);
  emitSyncEvent({ resourceType: 'clinical_encounter', resourceId: id, operation: 'update', resourceVersion: updated._rev, orgId: updated.orgId, hospitalId: updated.hospitalId });
  return updated;
}

/** The most recent still-open (non-terminal) encounter for a patient, or null. */
export async function getOpenEncounterForPatient(patientId: string): Promise<EncounterDoc | null> {
  const rows = await findByType<EncounterDoc>(
    encountersDB(), 'clinical_encounter', { patientId }, { indexFields: ['type', 'patientId'] },
  );
  const open = rows.filter(e => !isTerminal(e.status));
  open.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return open[0] ?? null;
}

/**
 * Facility checkout (Stage 10): advance an encounter that has finished its
 * clinical work through the legal clinic-checkout → facility-checkout chain to
 * a terminal `discharged` status (or `discharged_with_pending_items` when the
 * checkout gate had unmet items that were overridden). Encounters that are
 * already terminal, or that haven't reached the clinic-checkout stage yet (e.g.
 * still `with_clinician`, or admitted/deceased/referred), are left untouched —
 * we never force a discharge on a visit the clinician hasn't closed.
 */
const FACILITY_DISCHARGE_CHAIN: EncounterStatus[] = [
  'ready_for_clinic_checkout',
  'in_clinic_checkout',
  'clinic_complete_awaiting_next_station',
  'awaiting_facility_checkout',
  'in_facility_checkout',
];

export async function dischargeEncounter(
  id: string,
  opts: { actorId?: string; pendingItems?: boolean } = {},
): Promise<EncounterDoc | null> {
  const enc = await getEncounter(id);
  if (!enc) return null;
  if (isTerminal(enc.status)) return enc; // already closed — nothing to do
  const startIdx = FACILITY_DISCHARGE_CHAIN.indexOf(enc.status);
  if (startIdx === -1) return enc; // not in a checkout-eligible state — leave as-is

  const finalStatus: EncounterStatus = opts.pendingItems
    ? 'discharged_with_pending_items'
    : 'discharged';

  let current = enc;
  // Step through the remaining chain hops, then the terminal discharge.
  for (let i = startIdx + 1; i < FACILITY_DISCHARGE_CHAIN.length; i++) {
    current = await transitionEncounter(id, FACILITY_DISCHARGE_CHAIN[i], { actorId: opts.actorId });
  }
  current = await transitionEncounter(id, finalStatus, { actorId: opts.actorId });
  return current;
}
