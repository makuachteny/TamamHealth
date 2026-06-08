/**
 * Engine + capability gating tests. Verifies the system is restricted to the
 * documented workflow: illegal journey moves and role-unauthorized moves are
 * rejected, the facility-checkout gate blocks unless overridden with reason +
 * authorization, and `availableActions` only surfaces capability-permitted moves.
 */

import {
  transitionEncounter,
  availableActions,
  type EncounterDoc,
} from '@/lib/clinical-flow';
import { capabilitiesForUserRole } from '@/lib/clinical-flow/capabilities';

function makeEncounter(over: Partial<EncounterDoc> = {}): EncounterDoc {
  return {
    _id: 'enc-1', type: 'encounter', patientId: 'p1', facilityId: 'hosp-001',
    status: 'awaiting_triage', stage: 'triage', isWalkIn: true,
    history: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const at = () => '2026-01-01T01:00:00Z';

describe('transitionEncounter', () => {
  test('rejects an illegal journey move', () => {
    const r = transitionEncounter(makeEncounter({ status: 'registered', stage: 'arrival_registration' }), 'discharged',
      { userId: 'u1', role: 'front_desk' }, { now: at });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('illegal_transition');
  });

  test('rejects a legal move the role is not authorized for', () => {
    // front_desk lacks the `triage` capability, so cannot move into in_triage
    const r = transitionEncounter(makeEncounter(), 'in_triage',
      { userId: 'u1', role: 'front_desk' }, { now: at });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('not_authorized');
  });

  test('allows a legal, authorized move and records attribution', () => {
    const r = transitionEncounter(makeEncounter(), 'in_triage',
      { userId: 'nurse-1', role: 'nurse', station: 'triage' }, { now: at });
    expect(r.ok).toBe(true);
    expect(r.encounter?.status).toBe('in_triage');
    expect(r.encounter?.stage).toBe('triage');
    const last = r.encounter!.history.at(-1)!;
    expect(last).toMatchObject({ from: 'awaiting_triage', to: 'in_triage', byRole: 'nurse', station: 'triage' });
    expect(last.capability).toBe('triage');
  });

  test('does not mutate the input encounter', () => {
    const enc = makeEncounter();
    transitionEncounter(enc, 'in_triage', { userId: 'n', role: 'nurse' }, { now: at });
    expect(enc.status).toBe('awaiting_triage');
    expect(enc.history).toHaveLength(0);
  });

  test('facility checkout gate blocks discharge with unmet critical items', () => {
    const enc = makeEncounter({ status: 'in_facility_checkout', stage: 'facility_checkout', checkoutSatisfied: [] });
    const r = transitionEncounter(enc, 'discharged', { userId: 'clerk', role: 'front_desk' }, { now: at });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('gate_blocked');
    expect((r.blockedBy ?? []).length).toBeGreaterThan(0);
  });

  test('checkout override requires reason + authorization', () => {
    const enc = makeEncounter({ status: 'in_facility_checkout', stage: 'facility_checkout', checkoutSatisfied: [] });
    const noReason = transitionEncounter(enc, 'discharged', { userId: 'clerk', role: 'front_desk' }, { override: true, now: at });
    expect(noReason.error).toBe('override_requires_reason');

    const ok = transitionEncounter(enc, 'discharged', { userId: 'clerk', role: 'front_desk' },
      { override: true, reason: 'patient insisted on leaving', authorizedBy: 'supt.lado', now: at });
    expect(ok.ok).toBe(true);
    expect(ok.encounter?.history.at(-1)?.override).toBe(true);
  });

  test('discharge proceeds when all critical gate items satisfied', () => {
    const satisfied = ['all_clinic_visits_closed', 'prescriptions_dispensed', 'critical_labs_reviewed', 'in_clinic_procedures_complete', 'required_documentation_generated'];
    const enc = makeEncounter({ status: 'in_facility_checkout', stage: 'facility_checkout', checkoutSatisfied: satisfied });
    const r = transitionEncounter(enc, 'discharged', { userId: 'clerk', role: 'front_desk' }, { now: at });
    expect(r.ok).toBe(true);
  });

  test('cannot transition a terminal encounter', () => {
    const enc = makeEncounter({ status: 'discharged', stage: 'facility_checkout' });
    const r = transitionEncounter(enc, 'in_facility_checkout', { userId: 'x', role: 'front_desk' }, { now: at });
    expect(r.error).toBe('terminal');
  });
});

describe('availableActions (capability-gated)', () => {
  test('a nurse at awaiting_triage may start triage', () => {
    const actions = availableActions(makeEncounter(), 'nurse');
    expect(actions).toContain('in_triage');
  });

  test('a cashier sees no triage action (capability hidden, not greyed)', () => {
    const actions = availableActions(makeEncounter(), 'cashier');
    expect(actions).not.toContain('in_triage');
  });

  test('a clinician can branch to orders from with_clinician', () => {
    const enc = makeEncounter({ status: 'with_clinician', stage: 'clinical_consultation' });
    const actions = availableActions(enc, 'doctor');
    expect(actions).toEqual(expect.arrayContaining(['awaiting_labs', 'ready_for_clinic_checkout', 'referred_out']));
  });
});

describe('capability resolution', () => {
  test('doctor resolves clinician capabilities', () => {
    const caps = capabilitiesForUserRole('doctor');
    expect(caps.has('consultation')).toBe(true);
    expect(caps.has('prescribing')).toBe(true);
    expect(caps.has('payment_collection')).toBe(false);
  });
  test('cashier resolves payment capability only', () => {
    const caps = capabilitiesForUserRole('cashier');
    expect(caps.has('payment_collection')).toBe(true);
    expect(caps.has('consultation')).toBe(false);
  });
});
