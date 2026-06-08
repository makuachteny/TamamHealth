/**
 * Capability access layer.
 *
 * Implements Principle 2.3 (capabilities decoupled from positions) and the
 * Section 4 role-behavior rule that "features visible in the UI depend on the
 * active role's permissions; unavailable actions are hidden, not greyed out".
 *
 * Permission checks across the clinical flow are made against CAPABILITIES, not
 * job titles. A user's capabilities are the union of the capabilities of the
 * clinical-flow roles their (active) platform UserRole maps to.
 *
 * This also declares ACTION_CAPABILITY: which capability is required to move an
 * encounter INTO each status — the role-restriction half of "restrict the
 * system to the workflows".
 */

import type { UserRole } from '../db-types';
import {
  type Capability,
  CLINICAL_FLOW_ROLES,
  clinicalFlowRolesForUserRole,
} from './roles';
import type { EncounterStatus } from './encounter-journey';

/** All capabilities granted to a platform UserRole (union over mapped roles). */
export function capabilitiesForUserRole(userRole: UserRole): Set<Capability> {
  const out = new Set<Capability>();
  for (const r of clinicalFlowRolesForUserRole(userRole)) {
    for (const c of CLINICAL_FLOW_ROLES[r].capabilities) out.add(c);
  }
  return out;
}

export function userRoleHasCapability(userRole: UserRole, cap: Capability): boolean {
  return capabilitiesForUserRole(userRole).has(cap);
}

/**
 * Capability required to perform the transition INTO a given status. A value
 * may be a single capability or an array meaning "any of". A status not listed
 * here has no station gate (system/automatic transitions).
 *
 * Derived directly from the Section 6 stage interfaces (who performs each step).
 */
export const ACTION_CAPABILITY: Partial<Record<EncounterStatus, Capability | Capability[]>> = {
  // Stage 2 — registration / routing (central registration clerk)
  registered: 'patient_registration',
  arrived_at_facility: 'patient_registration',
  awaiting_next_station: 'patient_routing',
  awaiting_triage: 'patient_routing',
  routed_to_clinic: ['patient_routing', 'triage'],
  lwbs: ['patient_routing', 'clinic_queue_management', 'triage'],

  // Stage 3 — triage
  in_triage: 'triage',
  triaged_awaiting_destination: 'triage',
  // escalation is a clinical judgement available to any clinical station
  escalated_to_emergency: ['triage', 'rooming', 'consultation'],

  // Stage 4 — clinic intake / rooming
  arrived_at_clinic_awaiting_rooming: ['clinic_checkin', 'clinic_queue_management'],
  in_rooming: 'rooming',
  ready_for_clinician: 'rooming',
  transferred_to_other_clinic: ['rooming', 'clinic_checkin', 'triage'],

  // Stage 5 — consultation (clinician)
  with_clinician: 'consultation',
  awaiting_labs: 'ordering',
  awaiting_imaging: 'ordering',
  awaiting_pharmacy: ['ordering', 'prescribing'],
  awaiting_procedure: 'ordering',
  ready_for_clinic_checkout: 'consultation',
  referred_out: 'ordering',
  admitted: ['ordering', 'consultation'],
  deceased: 'consultation',
  consultation_paused_draft: 'consultation',

  // Stage 9 — clinic checkout (clinic clerk)
  in_clinic_checkout: ['clinic_followup_scheduling', 'clinic_queue_management'],
  clinic_complete_awaiting_next_station: ['clinic_followup_scheduling', 'clinic_queue_management'],

  // Stage 10 — facility checkout (central registration clerk + cashier)
  awaiting_facility_checkout: ['patient_routing', 'clinic_followup_scheduling'],
  in_facility_checkout: 'facility_checkout',
  discharged: 'facility_checkout',
  discharged_with_referral: 'facility_checkout',
  discharged_with_pending_items: 'facility_checkout',
  dismissed_without_formal_checkout: 'facility_checkout',
};

/** Does the capability set satisfy a single/any-of capability requirement? */
export function satisfiesRequirement(
  caps: Set<Capability>,
  required: Capability | Capability[] | undefined,
): boolean {
  if (required == null) return true; // no station gate
  if (Array.isArray(required)) return required.some((c) => caps.has(c));
  return caps.has(required);
}

/** Capability required to enter `status` (if any). */
export function capabilityForStatus(status: EncounterStatus): Capability | Capability[] | undefined {
  return ACTION_CAPABILITY[status];
}
