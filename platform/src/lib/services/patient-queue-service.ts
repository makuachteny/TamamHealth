/**
 * Patient Queue Service — derives queue state from existing triage, consultation,
 * prescription, and lab order documents. No new document type is needed; queue
 * state is computed from the lifecycle of existing records.
 *
 * Priority algorithm:
 *   score = acuity_weight + (minutes_waiting / target_wait_minutes) * 1.5
 *   RED=3  YELLOW=2  GREEN=1
 *
 * Patients exceeding 1.5× their target wait time are flagged for reassessment.
 */

import type { TriageDoc } from '@/lib/db-types';

export type QueueStage =
  | 'awaiting_triage'
  | 'awaiting_rooming'
  | 'awaiting_consultation'
  | 'awaiting_lab'
  | 'awaiting_pharmacy'
  | 'awaiting_checkout';

export const STAGE_LABELS: Record<QueueStage, string> = {
  awaiting_triage: 'Awaiting Triage',
  awaiting_rooming: 'Awaiting Rooming',
  awaiting_consultation: 'Awaiting Consultation',
  awaiting_lab: 'Awaiting Lab Results',
  awaiting_pharmacy: 'Awaiting Pharmacy',
  awaiting_checkout: 'Awaiting Checkout',
};

/** Default target wait time in minutes per stage */
const TARGET_WAIT: Record<QueueStage, number> = {
  awaiting_triage: 10,
  awaiting_rooming: 15,
  awaiting_consultation: 30,
  awaiting_lab: 45,
  awaiting_pharmacy: 20,
  awaiting_checkout: 15,
};

const ACUITY_WEIGHT: Record<'RED' | 'YELLOW' | 'GREEN', number> = {
  RED: 3,
  YELLOW: 2,
  GREEN: 1,
};

export interface QueueEntry {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  stage: QueueStage;
  acuity: 'RED' | 'YELLOW' | 'GREEN';
  chiefComplaint?: string;
  enteredStageAt: string; // ISO datetime
  minutesWaiting: number;
  targetWaitMinutes: number;
  score: number;
  flaggedForReassessment: boolean;
  triageId: string;
  assignedToId?: string;
  assignedToName?: string;
}

export function buildQueueFromTriage(
  triageDocs: TriageDoc[],
  /** Optional: map of patientId → current consultation status */
  consultationStatusByPatient?: Record<string, string>,
  /** Optional: set of patientIds who have pending prescriptions in pharmacy */
  pendingPharmacyPatients?: Set<string>,
  /** Optional: set of patientIds with outstanding lab orders */
  pendingLabPatients?: Set<string>,
): QueueEntry[] {
  const now = Date.now();
  const entries: QueueEntry[] = [];

  for (const triage of triageDocs) {
    if (triage.status === 'admitted' || triage.status === 'discharged' || triage.status === 'referred') continue;

    const acuity = (triage.priority as 'RED' | 'YELLOW' | 'GREEN') ?? 'GREEN';
    const consultStatus = consultationStatusByPatient?.[triage.patientId];

    let stage: QueueStage;
    let stageEnteredAt: string;

    if (pendingLabPatients?.has(triage.patientId)) {
      stage = 'awaiting_lab';
      stageEnteredAt = triage.triagedAt;
    } else if (pendingPharmacyPatients?.has(triage.patientId)) {
      stage = 'awaiting_pharmacy';
      stageEnteredAt = triage.triagedAt;
    } else if (consultStatus === 'completed' || consultStatus === 'clinic_checkout') {
      stage = 'awaiting_checkout';
      stageEnteredAt = triage.triagedAt;
    } else if (consultStatus === 'with_clinician' || consultStatus === 'in_progress') {
      // Already in consultation — skip the active stage, it's not "waiting"
      continue;
    } else if (triage.status === 'seen' && triage.assignedRoom) {
      stage = 'awaiting_consultation';
      stageEnteredAt = triage.triagedAt;
    } else if (triage.status === 'seen') {
      stage = 'awaiting_rooming';
      stageEnteredAt = triage.triagedAt;
    } else {
      stage = 'awaiting_triage';
      stageEnteredAt = triage.triagedAt;
    }

    const target = TARGET_WAIT[stage];
    const minutesWaiting = Math.floor((now - new Date(stageEnteredAt).getTime()) / 60000);
    const timeFactor = target > 0 ? (minutesWaiting / target) * 1.5 : 0;
    const score = ACUITY_WEIGHT[acuity] + timeFactor;
    const flaggedForReassessment = minutesWaiting > target * 1.5;

    entries.push({
      patientId: triage.patientId,
      patientName: triage.patientName,
      hospitalNumber: triage.hospitalNumber,
      stage,
      acuity,
      chiefComplaint: triage.chiefComplaint,
      enteredStageAt: stageEnteredAt,
      minutesWaiting,
      targetWaitMinutes: target,
      score,
      flaggedForReassessment,
      triageId: triage._id,
      assignedToId: triage.handoffTo,
      assignedToName: triage.handoffToName,
    });
  }

  // Sort by score descending (highest priority first)
  return entries.sort((a, b) => b.score - a.score);
}
