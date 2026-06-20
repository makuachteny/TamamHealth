/**
 * Patient directives / consent service (P2.1).
 *
 * Like allergies, directives live ON the patient document so they ride the
 * patient's existing sync + scoping. Entries are deactivated (with a reason)
 * rather than hard-deleted, so the consent/authorization history is preserved.
 * Writes go through `mutatePatient` (optimistic-concurrency retry).
 */
import { v4 as uuidv4 } from 'uuid';
import type { DirectiveEntry, DirectiveType } from '../../data/mock';
import type { PatientDoc } from '../db-types';
import { getPatientById } from './patient-service';
import { mutatePatientListField } from './patient-list-field';

/** All directive entries for a patient (active + inactive). */
export async function getDirectives(patientId: string): Promise<DirectiveEntry[]> {
  const patient = await getPatientById(patientId);
  return patient?.directives ?? [];
}

/** Active directives only. */
export async function getActiveDirectives(patientId: string): Promise<DirectiveEntry[]> {
  return (await getDirectives(patientId)).filter((d) => d.status === 'active');
}

export interface AddDirectiveInput {
  type: DirectiveType;
  description: string;
  startDate?: string;
  recordedBy?: string;
  recordedByName?: string;
}

/** Record a new directive. Returns the full updated list, or null if no patient. */
export async function addDirective(patientId: string, input: AddDirectiveInput): Promise<DirectiveEntry[] | null> {
  if (!input.description || input.description.trim().length === 0) {
    throw new Error('Directive description is required');
  }
  const entry: DirectiveEntry = {
    id: uuidv4().slice(0, 8),
    type: input.type,
    description: input.description.trim(),
    startDate: input.startDate || new Date().toISOString().slice(0, 10),
    status: 'active',
    recordedBy: input.recordedBy,
    recordedByName: input.recordedByName,
    recordedAt: new Date().toISOString(),
  };
  return mutatePatientListField<DirectiveEntry>(
    patientId,
    (patient) => {
      const next = [...(patient.directives ?? []), entry];
      return { patch: { directives: next } as Partial<PatientDoc>, entries: next };
    },
    { action: 'ADD_DIRECTIVE', by: input.recordedBy, byName: input.recordedByName, detail: `Directive "${input.type}" added for patient ${patientId}` },
  );
}

/** Edit fields of an existing directive in place. */
export async function updateDirective(
  patientId: string,
  directiveId: string,
  patch: Partial<Omit<DirectiveEntry, 'id'>>,
): Promise<DirectiveEntry[] | null> {
  return mutatePatientListField<DirectiveEntry>(
    patientId,
    (patient) => {
      const existing = patient.directives ?? [];
      if (!existing.some((d) => d.id === directiveId)) return null;
      const next = existing.map((d) => (d.id === directiveId ? { ...d, ...patch, id: d.id } : d));
      return { patch: { directives: next } as Partial<PatientDoc>, entries: next };
    },
    { action: 'UPDATE_DIRECTIVE', detail: `Directive ${directiveId} updated for patient ${patientId}` },
  );
}

/**
 * Remove (deactivate / revoke) a directive. A reason is required; the entry is
 * retained for the audit trail rather than hard-deleted.
 */
export async function removeDirective(
  patientId: string,
  directiveId: string,
  removalReason: string,
  status: 'inactive' | 'expired' | 'revoked' = 'revoked',
): Promise<DirectiveEntry[] | null> {
  if (!removalReason || removalReason.trim().length === 0) {
    throw new Error('A removal reason is required');
  }
  return mutatePatientListField<DirectiveEntry>(
    patientId,
    (patient) => {
      const existing = patient.directives ?? [];
      if (!existing.some((d) => d.id === directiveId)) return null;
      const next = existing.map((d) => (d.id === directiveId ? { ...d, status, removalReason: removalReason.trim() } : d));
      return { patch: { directives: next } as Partial<PatientDoc>, entries: next };
    },
    { action: 'REVOKE_DIRECTIVE', detail: `Directive ${directiveId} ${status} (${removalReason.trim()}) for patient ${patientId}` },
  );
}
