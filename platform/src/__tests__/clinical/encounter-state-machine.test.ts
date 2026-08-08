/**
 * Clinical-flow — the encounter state machine (src/lib/clinical-flow/encounter-journey.ts).
 *
 * The transition graph is the safety backbone of a visit: an illegal jump
 * (e.g. discharging a patient who never reached checkout, or escalating a
 * not-yet-triaged patient without passing through triage) must be impossible.
 */
import {
  canTransition,
  nextStatuses,
  ENCOUNTER_TRANSITIONS,
  TERMINAL_STATUSES,
  STATUS_STAGE,
  type EncounterStatus,
} from '@/lib/clinical-flow/encounter-journey';

describe('encounter transitions: legal happy-path edges', () => {
  const legal: Array<[EncounterStatus, EncounterStatus]> = [
    ['scheduled', 'registered'],
    ['registered', 'arrived_at_facility'],
    ['in_triage', 'triaged_awaiting_destination'],
    ['with_clinician', 'awaiting_labs'],
    ['with_clinician', 'awaiting_pharmacy'],
    ['ready_for_clinic_checkout', 'in_clinic_checkout'],
    ['in_facility_checkout', 'discharged'],
  ];
  test.each(legal)('%s → %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(nextStatuses(from)).toContain(to);
  });
});

describe('encounter transitions: illegal jumps are rejected', () => {
  const illegal: Array<[EncounterStatus, EncounterStatus]> = [
    ['scheduled', 'discharged'],
    ['registered', 'with_clinician'],
    ['with_clinician', 'discharged'],
    ['awaiting_triage', 'escalated_to_emergency'], // must pass through in_triage
  ];
  test.each(illegal)('%s ↛ %s is blocked', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  test('awaiting_triage reaches escalation only via in_triage (documented safety rule)', () => {
    expect(canTransition('awaiting_triage', 'escalated_to_emergency')).toBe(false);
    expect(canTransition('awaiting_triage', 'in_triage')).toBe(true);
    expect(canTransition('in_triage', 'escalated_to_emergency')).toBe(true);
  });
});

describe('encounter transitions: terminal states are sinks', () => {
  test.each(TERMINAL_STATUSES)('%s has no outgoing transitions', (status) => {
    expect(nextStatuses(status)).toHaveLength(0);
    expect(canTransition(status, 'with_clinician')).toBe(false);
  });

  test('the terminal set covers the real end-states', () => {
    expect(TERMINAL_STATUSES).toEqual(
      expect.arrayContaining(['discharged', 'admitted', 'deceased', 'lwbs']),
    );
  });
});

describe('encounter transitions: graph integrity', () => {
  test('every status referenced as a target is itself a key in the graph', () => {
    const keys = new Set(Object.keys(ENCOUNTER_TRANSITIONS));
    for (const [, targets] of Object.entries(ENCOUNTER_TRANSITIONS)) {
      for (const t of targets) expect(keys.has(t)).toBe(true);
    }
  });

  test('every status maps to a defined stage', () => {
    for (const status of Object.keys(ENCOUNTER_TRANSITIONS) as EncounterStatus[]) {
      expect(STATUS_STAGE[status]).toBeDefined();
    }
  });

  test('no status lists itself as a next status', () => {
    for (const [from, targets] of Object.entries(ENCOUNTER_TRANSITIONS)) {
      expect(targets).not.toContain(from as EncounterStatus);
    }
  });
});
