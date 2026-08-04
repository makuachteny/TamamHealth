/**
 * Who a patient belongs to right now — the provider carrying the visit, and the
 * nurse looking after them.
 *
 * Assigning a provider is more than a field write: it stamps the patient's
 * assignment fields, opens (or reuses) the shared consultation-progress tracker
 * so the provider's board shows the handoff, and records the handoff on the
 * triage entry the patient arrived through. That sequence lived inside
 * `AssignDoctorModal`, which meant the front desk's inline pickers could only
 * have had a partial copy of it. It lives here so every entry point performs
 * the same assignment.
 *
 * Ordering matters: the patient document is the source of truth and is written
 * first. The tracker and the triage stamp are additive, so a failure in either
 * leaves the assignment standing rather than rolling it back.
 */
import type { UserRole } from '../db-types';

export interface AssignmentActor {
  id?: string;
  name?: string;
  /** Kept to `UserRole` so it feeds the consultation tracker unchanged. */
  role?: UserRole;
}

export interface AssignProviderInput {
  patientId: string;
  patientName: string;
  provider: { id: string; name: string; role?: UserRole };
  actor?: AssignmentActor;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
  /** The triage entry the patient arrived through, when there is one. */
  triageId?: string;
  note?: string;
}

/** Assigns the provider who will carry the visit. */
export async function assignProviderToPatient(input: AssignProviderInput): Promise<void> {
  const now = new Date().toISOString();
  const { updatePatient } = await import('./patient-service');
  await updatePatient(input.patientId, {
    assignedDoctor: input.provider.id,
    assignedDoctorName: input.provider.name,
    assignedAt: now,
    assignedBy: input.actor?.id,
    assignedByName: input.actor?.name,
    assignmentNote: input.note?.trim() || undefined,
    assignmentStatus: 'assigned',
    // A fresh assignment is unaccepted, whatever the previous provider had done.
    assignmentAcceptedAt: undefined,
    assignmentAcceptedBy: undefined,
    assignmentAcceptedByName: undefined,
  });

  try {
    const { ensureConsultationProgress, assignProgressOwner, updateProgressStage } =
      await import('./consultation-progress-service');
    const tracker = await ensureConsultationProgress({
      patientId: input.patientId,
      patientName: input.patientName,
      hospitalId: input.hospitalId || '',
      hospitalName: input.hospitalName || '',
      orgId: input.orgId,
      actor: input.actor,
    });
    await assignProgressOwner(tracker._id, input.provider, input.actor);
    await updateProgressStage(tracker._id, 'waiting_for_provider', input.actor, 'Provider to accept assignment');
  } catch {
    // Operational tracking is additive and must not prevent assignment.
  }

  if (input.triageId) {
    try {
      const { updateTriage } = await import('./triage-service');
      await updateTriage(input.triageId, {
        handoffTo: input.provider.id,
        handoffToName: input.provider.name,
        handoffAt: now,
      });
    } catch {
      // non-fatal — the patient assignment is the source of truth
    }
  }
}

export interface AssignNurseInput {
  patientId: string;
  nurse: { id: string; name: string } | null;
  actor?: AssignmentActor;
}

/**
 * Assigns (or clears) the nurse looking after the patient. Deliberately lighter
 * than a provider assignment: nursing care needs no acceptance handshake and no
 * consultation tracker — the desk records who is covering the patient and the
 * ward boards read it back.
 */
export async function assignNurseToPatient(input: AssignNurseInput): Promise<void> {
  const { updatePatient } = await import('./patient-service');
  await updatePatient(input.patientId, {
    assignedNurse: input.nurse?.id,
    assignedNurseName: input.nurse?.name,
    assignedNurseAt: input.nurse ? new Date().toISOString() : undefined,
    assignedNurseBy: input.nurse ? input.actor?.id : undefined,
    assignedNurseByName: input.nurse ? input.actor?.name : undefined,
  });
}
