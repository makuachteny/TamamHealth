/**
 * Encounter engine — the single guarded path for moving an encounter through
 * the documented journey. Application code MUST call `transitionEncounter`
 * rather than mutating `status` directly, so the system stays restricted to the
 * workflows defined in `encounter-journey.ts` and the role gates in
 * `capabilities.ts`.
 *
 * Pure functions (no I/O): callers persist the returned encounter to PouchDB.
 */

import {
  type EncounterStatus,
  nextStatuses,
  canTransition,
  stageOf,
  isTerminal,
  unmetCriticalGateItems,
} from './encounter-journey';
import { type Capability } from './roles';
import {
  capabilitiesForUserRole,
  capabilityForStatus,
  satisfiesRequirement,
} from './capabilities';
import type { EncounterDoc, EncounterTransitionRecord, DeliveryChannel } from './encounter-types';
import type { UserRole } from '../db-types';

export interface TransitionActor {
  userId: string;
  /** Active platform role at the time (logged with every action — §2.4). */
  role: UserRole;
  station?: string;
  channel?: DeliveryChannel;
}

export interface TransitionOptions {
  reason?: string;
  /** Override the facility-checkout gate (requires reason + authorizedBy). */
  override?: boolean;
  authorizedBy?: string;
  /** Concrete clinic/station target for parameterised statuses. */
  currentClinic?: string;
  nextStation?: string;
  /** Mark gate checklist keys satisfied as part of this transition. */
  satisfyGateKeys?: string[];
  /** Explicit capability override (else inferred from the actor's role). */
  capability?: Capability;
  /** Wall clock (injectable for tests). */
  now?: () => string;
}

export type TransitionError =
  | 'illegal_transition' // not allowed by the journey state machine
  | 'not_authorized' // actor lacks the required capability
  | 'terminal' // encounter already closed
  | 'gate_blocked' // facility checkout gate has unmet critical items (no override)
  | 'override_requires_reason';

export interface TransitionResult {
  ok: boolean;
  error?: TransitionError;
  blockedBy?: string[]; // unmet critical gate items, when error === 'gate_blocked'
  encounter?: EncounterDoc;
}

const FINAL_CHECKOUT_STATUSES: EncounterStatus[] = [
  'discharged',
  'discharged_with_referral',
];

/** Transition an encounter, enforcing the journey + role gates + checkout gate. */
export function transitionEncounter(
  encounter: EncounterDoc,
  to: EncounterStatus,
  actor: TransitionActor,
  options: TransitionOptions = {},
): TransitionResult {
  const now = options.now ?? (() => new Date().toISOString());

  if (isTerminal(encounter.status)) {
    return { ok: false, error: 'terminal' };
  }
  if (!canTransition(encounter.status, to)) {
    return { ok: false, error: 'illegal_transition' };
  }

  // Role / capability gate.
  const caps = capabilitiesForUserRole(actor.role);
  const required = capabilityForStatus(to);
  if (!satisfiesRequirement(caps, required)) {
    return { ok: false, error: 'not_authorized' };
  }

  // Facility checkout gate: routine dismissal blocked on unmet critical items.
  if (FINAL_CHECKOUT_STATUSES.includes(to)) {
    const satisfied = [...(encounter.checkoutSatisfied ?? []), ...(options.satisfyGateKeys ?? [])];
    const unmet = unmetCriticalGateItems(satisfied);
    if (unmet.length > 0) {
      if (!options.override) {
        return { ok: false, error: 'gate_blocked', blockedBy: unmet.map((g) => g.key) };
      }
      if (!options.reason || !options.authorizedBy) {
        return { ok: false, error: 'override_requires_reason' };
      }
    }
  }

  const record: EncounterTransitionRecord = {
    from: encounter.status,
    to,
    at: now(),
    byUserId: actor.userId,
    byRole: actor.role,
    capability: options.capability ?? firstCapability(required),
    station: actor.station,
    channel: actor.channel,
    reason: options.reason,
    override: options.override,
    authorizedBy: options.authorizedBy,
  };

  const updated: EncounterDoc = {
    ...encounter,
    status: to,
    stage: stageOf(to),
    currentClinic: options.currentClinic ?? encounter.currentClinic,
    nextStation: options.nextStation ?? encounter.nextStation,
    checkoutSatisfied: options.satisfyGateKeys
      ? Array.from(new Set([...(encounter.checkoutSatisfied ?? []), ...options.satisfyGateKeys]))
      : encounter.checkoutSatisfied,
    history: [...encounter.history, record],
    updatedAt: record.at,
  };

  return { ok: true, encounter: updated };
}

function firstCapability(required: Capability | Capability[] | undefined): Capability | undefined {
  if (required == null) return undefined;
  return Array.isArray(required) ? required[0] : required;
}
// (capabilitiesForRoles is exported from ./roles via the index barrel)

/**
 * The transitions a given actor may perform from the encounter's current
 * status — i.e. legal journey moves filtered to the actor's capabilities.
 * UIs render exactly these as action buttons (hidden, not greyed — §4).
 */
export function availableActions(encounter: EncounterDoc, role: UserRole): EncounterStatus[] {
  if (isTerminal(encounter.status)) return [];
  const caps = capabilitiesForUserRole(role);
  return nextStatuses(encounter.status).filter((to) =>
    satisfiesRequirement(caps, capabilityForStatus(to)),
  );
}

/** As above, but for a set of explicit clinical-flow roles (multi-role users). */
export function availableActionsForCapabilities(
  encounter: EncounterDoc,
  caps: Set<Capability>,
): EncounterStatus[] {
  if (isTerminal(encounter.status)) return [];
  return nextStatuses(encounter.status).filter((to) =>
    satisfiesRequirement(caps, capabilityForStatus(to)),
  );
}
