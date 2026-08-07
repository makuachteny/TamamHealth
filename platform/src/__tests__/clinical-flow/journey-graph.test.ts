/**
 * Patient journey — graph properties of the encounter state machine.
 *
 * `state-machines.test.ts` proves the table is closed (every target is a
 * declared status) and walks one happy path. That leaves the properties that
 * actually bite in production untested: a status nobody can reach is a feature
 * nobody can use, and a status that cannot reach a terminal is a patient whose
 * visit can never be closed — the front desk sees them in a queue forever.
 *
 * These are computed over the whole table rather than asserted case by case,
 * so a new status added to `ENCOUNTER_TRANSITIONS` is checked the moment it
 * appears instead of when someone remembers to write its test.
 */

import {
  ENCOUNTER_TRANSITIONS,
  TERMINAL_STATUSES,
  STATUS_STAGE,
  ENCOUNTER_STAGES,
  FACILITY_CHECKOUT_GATE,
  canTransition,
  nextStatuses,
  isTerminal,
  stageOf,
  unmetCriticalGateItems,
  type EncounterStatus,
} from '@/lib/clinical-flow/encounter-journey';

const ALL_STATUSES = Object.keys(ENCOUNTER_TRANSITIONS) as EncounterStatus[];

/** The doors a patient can come in through. */
const ENTRY_STATUSES: EncounterStatus[] = [
  'scheduled',            // booked ahead
  'registered',           // arrived for an appointment
  'arrived_at_facility',  // walk-in
  'with_clinician',       // direct consultation, no front desk
];

/** Statuses reachable from `from`, following the table. */
function reachableFrom(from: EncounterStatus): Set<EncounterStatus> {
  const seen = new Set<EncounterStatus>();
  const queue: EncounterStatus[] = [from];
  while (queue.length) {
    const status = queue.shift()!;
    for (const next of ENCOUNTER_TRANSITIONS[status] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** Shortest path between two statuses, or null when none exists. */
function pathBetween(from: EncounterStatus, to: EncounterStatus): EncounterStatus[] | null {
  if (from === to) return [from];
  const prev = new Map<EncounterStatus, EncounterStatus>();
  const queue: EncounterStatus[] = [from];
  const seen = new Set<EncounterStatus>([from]);
  while (queue.length) {
    const status = queue.shift()!;
    for (const next of ENCOUNTER_TRANSITIONS[status] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, status);
      if (next === to) {
        const path: EncounterStatus[] = [to];
        let cursor = to;
        while (prev.has(cursor)) { cursor = prev.get(cursor)!; path.unshift(cursor); }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

describe('journey graph — reachability', () => {
  test('every status is reachable from one of the entry doors', () => {
    const reachable = new Set<EncounterStatus>(ENTRY_STATUSES);
    for (const entry of ENTRY_STATUSES) {
      for (const status of reachableFrom(entry)) reachable.add(status);
    }
    const orphans = ALL_STATUSES.filter(s => !reachable.has(s));
    expect(orphans).toEqual([]);
  });

  test('every status can still reach a terminal — no visit can be stranded', () => {
    const stranded = ALL_STATUSES.filter(status => {
      if (isTerminal(status)) return false;
      const reachable = reachableFrom(status);
      return !TERMINAL_STATUSES.some(t => reachable.has(t));
    });
    expect(stranded).toEqual([]);
  });

  test('every non-terminal status has at least one way out', () => {
    const dead = ALL_STATUSES.filter(s => !isTerminal(s) && nextStatuses(s).length === 0);
    expect(dead).toEqual([]);
  });

  test('every terminal status is a sink', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(nextStatuses(status)).toEqual([]);
    }
  });

  test('no status transitions to itself', () => {
    const selfLoops = ALL_STATUSES.filter(s => nextStatuses(s).includes(s));
    expect(selfLoops).toEqual([]);
  });

  test('every status carries a stage, and every stage key is a real stage', () => {
    const stageKeys = new Set(ENCOUNTER_STAGES.map(s => s.key));
    for (const status of ALL_STATUSES) {
      expect(STATUS_STAGE[status]).toBeDefined();
      expect(stageKeys.has(stageOf(status))).toBe(true);
    }
  });
});

describe('journey graph — the branches a real visit takes', () => {
  /**
   * Each of these is a thing that genuinely happens in a clinic. If any becomes
   * unreachable, the corresponding station loses its exit and patients pile up
   * there with no legal move.
   */
  const REQUIRED_ROUTES: Array<[string, EncounterStatus, EncounterStatus]> = [
    ['walk-in reaches triage', 'arrived_at_facility', 'awaiting_triage'],
    ['booked patient reaches the clinician', 'scheduled', 'with_clinician'],
    ['walk-in reaches discharge', 'arrived_at_facility', 'discharged'],
    ['triage can escalate to emergency', 'in_triage', 'escalated_to_emergency'],
    ['emergency can end in admission', 'escalated_to_emergency', 'admitted'],
    ['emergency can end in death', 'escalated_to_emergency', 'deceased'],
    ['a waiting patient can leave without being seen', 'awaiting_triage', 'lwbs'],
    ['a roomed patient can leave without being seen', 'ready_for_clinician', 'lwbs'],
    ['a clinic visit can transfer to another clinic', 'with_clinician', 'transferred_to_other_clinic'],
    ['a transferred patient is roomed again', 'transferred_to_other_clinic', 'ready_for_clinician'],
    ['a paused consultation resumes', 'consultation_paused_draft', 'with_clinician'],
    ['labs return to the clinician', 'awaiting_labs', 'with_clinician'],
    ['imaging returns to the clinician', 'awaiting_imaging', 'with_clinician'],
    ['pharmacy returns to the clinician', 'awaiting_pharmacy', 'with_clinician'],
    ['a procedure returns to the clinician', 'awaiting_procedure', 'with_clinician'],
    ['a referral reaches facility checkout', 'referred_out', 'awaiting_facility_checkout'],
    ['a clinic visit reaches facility checkout', 'with_clinician', 'awaiting_facility_checkout'],
    ['a second clinic can follow the first', 'clinic_complete_awaiting_next_station', 'routed_to_clinic'],
    ['a patient can be dismissed without formal checkout', 'awaiting_facility_checkout', 'dismissed_without_formal_checkout'],
    ['a patient can be admitted from facility checkout', 'awaiting_facility_checkout', 'admitted'],
    ['discharge with a referral is reachable', 'with_clinician', 'discharged_with_referral'],
    ['discharge with pending items is reachable', 'with_clinician', 'discharged_with_pending_items'],
  ];

  test.each(REQUIRED_ROUTES)('%s', (_label, from, to) => {
    expect(pathBetween(from, to)).not.toBeNull();
  });
});

describe('journey graph — moves that must stay illegal', () => {
  /**
   * The rules that protect the record. Skipping triage straight into a
   * consultation, or discharging someone who was never seen, are the moves a
   * hurried UI is most likely to attempt.
   */
  const ILLEGAL: Array<[EncounterStatus, EncounterStatus]> = [
    ['awaiting_triage', 'with_clinician'],            // triage cannot be skipped
    ['awaiting_triage', 'discharged'],                // nor can the whole visit
    ['arrived_at_facility', 'ready_for_clinician'],
    ['scheduled', 'with_clinician'],                  // must register and arrive first
    ['with_clinician', 'discharged'],                 // checkout is not optional
    ['ready_for_clinic_checkout', 'discharged'],
    ['in_triage', 'with_clinician'],                  // routing/rooming come between
    ['discharged', 'with_clinician'],                 // a closed visit never reopens
    ['lwbs', 'awaiting_triage'],
    ['admitted', 'discharged'],                       // inpatient flow owns this
    ['deceased', 'discharged'],
    ['in_rooming', 'awaiting_labs'],                  // orders need a clinician first
  ];

  test.each(ILLEGAL)('%s cannot go straight to %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  test('a terminal status accepts no move at all', () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const status of ALL_STATUSES) {
        expect(canTransition(terminal, status)).toBe(false);
      }
    }
  });

  test('canTransition agrees with the table for every pair', () => {
    for (const from of ALL_STATUSES) {
      const allowed = new Set(ENCOUNTER_TRANSITIONS[from]);
      for (const to of ALL_STATUSES) {
        expect(canTransition(from, to)).toBe(allowed.has(to));
      }
    }
  });
});

describe('journey graph — escape hatches are available where a patient may deteriorate', () => {
  /**
   * A patient can collapse in the waiting room, the rooming bay, or mid
   * consultation. Every status where they are physically present and not yet
   * finished must be able to escalate.
   */
  const PRESENT_AND_UNFINISHED: EncounterStatus[] = [
    // `awaiting_triage` is deliberately absent — see the note on it in
    // ENCOUNTER_TRANSITIONS. A patient nobody has assessed is taken into triage
    // first; the exception is asserted below so it stays a decision rather than
    // drifting into an oversight.
    'awaiting_next_station',
    'in_triage',
    'triaged_awaiting_destination',
    'routed_to_clinic',
    'arrived_at_clinic_awaiting_rooming',
    'in_rooming',
    'ready_for_clinician',
    'with_clinician',
    'awaiting_labs',
    'awaiting_imaging',
    'awaiting_pharmacy',
    'awaiting_procedure',
  ];

  test.each(PRESENT_AND_UNFINISHED)('%s can escalate to emergency', (status) => {
    expect(canTransition(status, 'escalated_to_emergency')).toBe(true);
  });

  /** Somebody waiting to be seen can always give up and walk out. */
  const WAITING: EncounterStatus[] = [
    'awaiting_next_station',
    'awaiting_triage',
    'in_triage',
    'triaged_awaiting_destination',
    'routed_to_clinic',
    'arrived_at_clinic_awaiting_rooming',
    'in_rooming',
    'ready_for_clinician',
  ];

  test.each(WAITING)('%s can end in left-without-being-seen', (status) => {
    expect(canTransition(status, 'lwbs')).toBe(true);
  });

  test('a patient still only queueing cannot be escalated without assessment', () => {
    expect(canTransition('awaiting_triage', 'escalated_to_emergency')).toBe(false);
    // But triage is one hop away, so the escalation is never actually blocked.
    expect(canTransition('awaiting_triage', 'in_triage')).toBe(true);
    expect(canTransition('in_triage', 'escalated_to_emergency')).toBe(true);
  });
});

describe('facility checkout gate', () => {
  test('an empty checklist leaves every critical item unmet', () => {
    const unmet = unmetCriticalGateItems([]);
    expect(unmet.map(i => i.key)).toEqual(
      FACILITY_CHECKOUT_GATE.filter(i => i.critical).map(i => i.key),
    );
  });

  test('satisfying every critical key clears the gate', () => {
    const criticalKeys = FACILITY_CHECKOUT_GATE.filter(i => i.critical).map(i => i.key);
    expect(unmetCriticalGateItems(criticalKeys)).toEqual([]);
  });

  test('non-critical items alone never clear the gate', () => {
    const softKeys = FACILITY_CHECKOUT_GATE.filter(i => !i.critical).map(i => i.key);
    expect(unmetCriticalGateItems(softKeys).length).toBeGreaterThan(0);
  });

  test('each critical item on its own is the only one still met', () => {
    for (const item of FACILITY_CHECKOUT_GATE.filter(i => i.critical)) {
      const unmet = unmetCriticalGateItems([item.key]).map(i => i.key);
      expect(unmet).not.toContain(item.key);
    }
  });

  test('unknown keys are ignored rather than counted as satisfying anything', () => {
    expect(unmetCriticalGateItems(['not_a_real_gate_key']).length)
      .toBe(FACILITY_CHECKOUT_GATE.filter(i => i.critical).length);
  });

  test('gate keys are unique', () => {
    const keys = FACILITY_CHECKOUT_GATE.map(i => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
