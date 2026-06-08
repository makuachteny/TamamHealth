/**
 * Encounter data model for the facility patient journey (Section 6).
 *
 * An Encounter is the unit that moves through the 11-stage journey. Its status
 * is governed by `encounter-journey.ts`; every transition is recorded with full
 * attribution (who, when, in what role, at which station, via which channel) so
 * audit trails stay clean even when one person wears many hats (Principle 2.4).
 */

import type { UserRole } from '../db-types';
import type { EncounterStatus, EncounterStageKey } from './encounter-journey';
import type { Capability } from './roles';
import type { PayorType } from './payment-model';

/** Multi-channel provenance for an action (Principle 2.2 / §10.6.1). */
export type DeliveryChannel = 'direct_sync' | 'phone_to_clerk' | 'paper';

/** One status transition, fully attributed. */
export interface EncounterTransitionRecord {
  from: EncounterStatus | null; // null for the creating transition
  to: EncounterStatus;
  at: string; // ISO timestamp (on-device creation time)
  syncedAt?: string; // ISO timestamp when it reached the server (channel-preserving)
  byUserId: string;
  byRole: UserRole; // the ACTIVE role at the time (logged with every action)
  capability?: Capability; // capability exercised
  station?: string; // e.g. 'triage', 'mch_clinic', 'central_pharmacy'
  channel?: DeliveryChannel;
  reason?: string; // required for overrides, aborts, refusals
  override?: boolean; // checkout gate override (reason + auth required)
  authorizedBy?: string; // for overrides / exemptions
}

/** A service rendered, tagged with its payor at the time of service (Section 5). */
export interface ServicePayorTag {
  serviceId: string;
  serviceLabel: string;
  payor: PayorType;
  exempt?: boolean;
}

export interface EncounterDoc {
  _id: string;
  _rev?: string;
  type: 'encounter';
  patientId: string;
  facilityId: string;
  orgId?: string;
  countryId?: string;

  /** Current journey position. */
  status: EncounterStatus;
  stage: EncounterStageKey;
  /** Parameterised destination carried alongside generic statuses. */
  currentClinic?: string;
  nextStation?: string;

  /** Acuity (Principle 2.9) — higher weight = higher priority. */
  acuityLevel?: number;
  acuityWeight?: number;

  /** Reason for visit (high-level, captured at registration). */
  reasonForVisit?: string;
  isWalkIn: boolean;

  /** Per-service payor tagging (Section 5). */
  servicePayors?: ServicePayorTag[];

  /** Full transition history (audit trail / multi-channel chronology). */
  history: EncounterTransitionRecord[];

  /** Gate checklist keys already satisfied (Stage 10). */
  checkoutSatisfied?: string[];

  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
