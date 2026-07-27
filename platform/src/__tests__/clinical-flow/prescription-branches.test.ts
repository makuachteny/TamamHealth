/**
 * Pharmacy lifecycle reachability (KAN-39 / HIGH-07).
 *
 * `PRESCRIPTION_TRANSITIONS` defines ten states, but the pharmacy UI only ever
 * drove the happy path: `stockout_partial_referred` was reachable purely as a
 * side effect of "Clear" finding an empty shelf, and
 * `held_awaiting_clarification` / `dispensing_error_recalled` could not be
 * entered at all. These pin the transitions the new branch actions rely on, so
 * a change to the table can't silently strand a state again.
 */
import {
  prescription as rxLifecycle,
  PRESCRIPTION_TRANSITIONS,
  type PrescriptionStatus,
} from '@/lib/clinical-flow/order-lifecycles';

describe('branch transitions the pharmacy UI offers', () => {
  test('Hold is reachable from review and clinician-consultation', () => {
    expect(rxLifecycle.can('under_review', 'held_awaiting_clarification')).toBe(true);
    expect(rxLifecycle.can('clinician_consultation_in_progress', 'held_awaiting_clarification')).toBe(true);
  });

  test('Stockout is reachable from review and from cleared-for-dispensing', () => {
    // The second one matters: stock can run out between clearing and dispensing.
    expect(rxLifecycle.can('under_review', 'stockout_partial_referred')).toBe(true);
    expect(rxLifecycle.can('cleared_for_dispensing', 'stockout_partial_referred')).toBe(true);
  });

  test('Recall is reachable only after the drug has actually been dispensed', () => {
    expect(rxLifecycle.can('dispensed', 'dispensing_error_recalled')).toBe(true);
    expect(rxLifecycle.can('under_review', 'dispensing_error_recalled')).toBe(false);
    expect(rxLifecycle.can('cleared_for_dispensing', 'dispensing_error_recalled')).toBe(false);
  });

  test('a stocked-out or recalled prescription returns to the queue, not to limbo', () => {
    // The prescription is still unfilled — it has to be actionable again.
    expect(rxLifecycle.can('stockout_partial_referred', 'received_in_pharmacy_queue')).toBe(true);
    expect(rxLifecycle.can('dispensing_error_recalled', 'received_in_pharmacy_queue')).toBe(true);
  });

  test('a held prescription can resume', () => {
    expect(rxLifecycle.can('held_awaiting_clarification', 'under_review')).toBe(true);
    expect(rxLifecycle.can('held_awaiting_clarification', 'cleared_for_dispensing')).toBe(true);
  });
});

describe('lifecycle integrity', () => {
  test('every state except the terminal one has an exit', () => {
    for (const [state, nexts] of Object.entries(PRESCRIPTION_TRANSITIONS)) {
      if (state === 'complete') continue;
      expect(nexts.length).toBeGreaterThan(0);
    }
  });

  test('every state is reachable from `prescribed`', () => {
    // Guards against adding a state to the table that nothing can ever enter —
    // exactly the class of gap this ticket was about.
    const seen = new Set<PrescriptionStatus>(['prescribed']);
    const queue: PrescriptionStatus[] = ['prescribed'];
    while (queue.length) {
      const from = queue.shift()!;
      for (const to of PRESCRIPTION_TRANSITIONS[from]) {
        if (!seen.has(to)) { seen.add(to); queue.push(to); }
      }
    }
    const all = Object.keys(PRESCRIPTION_TRANSITIONS) as PrescriptionStatus[];
    expect([...seen].sort()).toEqual(all.sort());
  });

  test('no transition points at a state outside the table', () => {
    const all = new Set(Object.keys(PRESCRIPTION_TRANSITIONS));
    for (const nexts of Object.values(PRESCRIPTION_TRANSITIONS)) {
      for (const to of nexts) expect(all.has(to)).toBe(true);
    }
  });
});
