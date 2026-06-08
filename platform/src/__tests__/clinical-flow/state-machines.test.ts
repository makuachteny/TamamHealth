/**
 * Consistency guards for the clinical-flow spec layer (document v1).
 *
 * Pure data tests — no Next/runtime deps — so they validate that every state
 * machine encoded from the architecture document is internally consistent:
 * every transition points to a declared status, terminal statuses are sinks,
 * and stage/coverage maps are complete. If someone edits a workflow and breaks
 * an invariant, the build fails.
 */

import {
  ENCOUNTER_TRANSITIONS, STATUS_STAGE, TERMINAL_STATUSES, FACILITY_CHECKOUT_GATE,
  canTransition, unmetCriticalGateItems, type EncounterStatus,
} from '@/lib/clinical-flow/encounter-journey';
import { LAB_ORDER_TRANSITIONS, PROCEDURE_TRANSITIONS, PRESCRIPTION_TRANSITIONS } from '@/lib/clinical-flow/order-lifecycles';
import { BHW_TASK_TRANSITIONS, BHW_VISIT_TRANSITIONS, SURVEILLANCE_TRANSITIONS } from '@/lib/clinical-flow/bhw-workflow';
import { CLINICAL_FLOW_ROLES, capabilitiesForRoles, clinicalFlowRolesForUserRole } from '@/lib/clinical-flow/roles';

function assertClosedMachine(table: Record<string, readonly string[]>) {
  const keys = new Set(Object.keys(table));
  for (const [from, targets] of Object.entries(table)) {
    for (const to of targets) {
      expect(keys.has(to)).toBe(true); // every transition target is a declared status
      expect(to).not.toBe(from); // no self-loops
    }
  }
}

describe('clinical-flow state machines are closed', () => {
  test('encounter journey', () => assertClosedMachine(ENCOUNTER_TRANSITIONS));
  test('lab order lifecycle', () => assertClosedMachine(LAB_ORDER_TRANSITIONS));
  test('procedure lifecycle', () => assertClosedMachine(PROCEDURE_TRANSITIONS));
  test('prescription lifecycle', () => assertClosedMachine(PRESCRIPTION_TRANSITIONS));
  test('bhw task lifecycle', () => assertClosedMachine(BHW_TASK_TRANSITIONS));
  test('bhw visit lifecycle', () => assertClosedMachine(BHW_VISIT_TRANSITIONS));
  test('surveillance lifecycle', () => assertClosedMachine(SURVEILLANCE_TRANSITIONS));
});

describe('encounter journey invariants', () => {
  test('every status has a stage mapping', () => {
    for (const status of Object.keys(ENCOUNTER_TRANSITIONS) as EncounterStatus[]) {
      expect(STATUS_STAGE[status]).toBeTruthy();
    }
  });

  test('documented terminal statuses are sinks', () => {
    for (const s of TERMINAL_STATUSES) {
      expect(ENCOUNTER_TRANSITIONS[s]).toEqual([]);
    }
  });

  test('a representative happy path is legal', () => {
    const path: EncounterStatus[] = [
      'registered', 'arrived_at_facility', 'awaiting_next_station', 'awaiting_triage',
      'in_triage', 'triaged_awaiting_destination', 'routed_to_clinic',
      'arrived_at_clinic_awaiting_rooming', 'in_rooming', 'ready_for_clinician',
      'with_clinician', 'ready_for_clinic_checkout', 'in_clinic_checkout',
      'clinic_complete_awaiting_next_station', 'awaiting_facility_checkout',
      'in_facility_checkout', 'discharged',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  test('an illegal jump is rejected', () => {
    expect(canTransition('registered', 'discharged')).toBe(false);
    expect(canTransition('awaiting_triage', 'with_clinician')).toBe(false);
  });

  test('facility checkout gate blocks on unmet critical items', () => {
    expect(unmetCriticalGateItems([]).length).toBeGreaterThan(0);
    const allCritical = FACILITY_CHECKOUT_GATE.filter((g) => g.critical).map((g) => g.key);
    expect(unmetCriticalGateItems(allCritical)).toEqual([]);
  });
});

describe('roles & capabilities', () => {
  test('there are exactly 11 documented roles', () => {
    expect(Object.keys(CLINICAL_FLOW_ROLES)).toHaveLength(11);
  });

  test('every role has at least one capability and a primary function', () => {
    for (const def of Object.values(CLINICAL_FLOW_ROLES)) {
      expect(def.capabilities.length).toBeGreaterThan(0);
      expect(def.primaryFunction).toBeTruthy();
      expect(def.mapsToUserRoles.length).toBeGreaterThan(0);
    }
  });

  test('clinician holds consultation + prescribing; cashier does not', () => {
    expect(capabilitiesForRoles(['clinician']).has('prescribing')).toBe(true);
    expect(capabilitiesForRoles(['cashier']).has('prescribing')).toBe(false);
    expect(capabilitiesForRoles(['cashier']).has('payment_collection')).toBe(true);
  });

  test('existing UserRoles map onto clinical-flow roles', () => {
    expect(clinicalFlowRolesForUserRole('doctor')).toContain('clinician');
    expect(clinicalFlowRolesForUserRole('cashier')).toContain('cashier');
    expect(clinicalFlowRolesForUserRole('boma_health_worker')).toContain('boma_health_worker');
  });
});
