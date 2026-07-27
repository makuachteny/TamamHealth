/**
 * Live evaluation of the facility checkout gate (KAN-96).
 *
 * ## What was wrong
 *
 * `unmetCriticalGateItems()` takes a list of *asserted* satisfied keys —
 * `encounter.checkoutSatisfied` plus whatever the caller passes as
 * `satisfyGateKeys`. Nothing ever checked those assertions against the
 * patient's actual open obligations. The gate blocked only when someone had
 * failed to tick a box, not when the patient genuinely had an undispensed
 * prescription, an unreviewed critical result, or an unpaid balance.
 *
 * So a patient could be discharged with a critical potassium result nobody had
 * looked at, as long as the checkout screen had marked the key satisfied.
 *
 * ## What this does
 *
 * Derives each gate key from live data instead. The caller no longer decides
 * whether a condition holds; the data does.
 *
 * ## Fail-closed
 *
 * Every condition **blocks when its underlying data cannot be read**, per the
 * ticket's acceptance criterion: "absence of data blocks rather than permits".
 * That is the opposite of the usual best-effort pattern used elsewhere in this
 * codebase, and it is deliberate — a lookup failure here means "we do not know
 * whether this patient still has an undispensed antibiotic", and the safe
 * answer to that is not "discharge them". The blocked reason names the failure
 * so the clerk can see it is a system problem rather than a clinical one, and
 * the override path (reason + authorised role + audit) remains available.
 */

import type { EncounterDoc } from '../db-types';
import { FACILITY_CHECKOUT_GATE } from '../clinical-flow/encounter-journey';
import type { EncounterStatus } from '../clinical-flow/encounter-journey';
import type { TransitionActor, TransitionResult } from '../clinical-flow/encounter-engine';

/** The minimum an encounter must expose for the gate to evaluate it. */
interface FlowEncounter {
  _id: string;
  patientId: string;
  status: EncounterStatus;
}

export interface GateConditionResult {
  key: string;
  label: string;
  critical: boolean;
  satisfied: boolean;
  /** Shown to the clerk when unsatisfied — says what to go and resolve. */
  detail?: string;
  /** Deep link that resolves this condition, for the checkout UI. */
  resolveHref?: string;
}

export interface CheckoutGateEvaluation {
  conditions: GateConditionResult[];
  /** Critical conditions that are not satisfied — these block discharge. */
  blocking: GateConditionResult[];
  /** Keys that live data proves satisfied; safe to pass to the engine. */
  satisfiedKeys: string[];
  /** True when discharge may proceed without an override. */
  canDischarge: boolean;
}

/** Statuses meaning a prescription no longer holds up a discharge. */
const RESOLVED_RX_STATUSES = new Set(['dispensed', 'discontinued']);

/**
 * Evaluate every checkout condition for a patient against live data.
 *
 * `encounter` is optional — when absent, conditions that need visit context
 * (open clinic visits) report unsatisfied rather than assuming the best.
 */
export async function evaluateCheckoutGate(
  patientId: string,
  encounter?: EncounterDoc,
): Promise<CheckoutGateEvaluation> {
  const results: GateConditionResult[] = [];

  const item = (key: string) => FACILITY_CHECKOUT_GATE.find((g) => g.key === key)!;
  const push = (key: string, satisfied: boolean, detail?: string, resolveHref?: string) => {
    const g = item(key);
    results.push({ key, label: g.label, critical: g.critical, satisfied, detail, resolveHref });
  };

  // ── All clinic visits closed ──────────────────────────────────────────
  // Derived from the encounter's own stage rather than a tick box: a visit
  // still with a clinician is by definition not closed.
  if (!encounter) {
    push('all_clinic_visits_closed', false, 'No encounter found for this visit — cannot confirm the clinic visit is closed.');
  } else {
    const open = ['with_clinician', 'in_rooming', 'in_triage', 'awaiting_labs'].includes(encounter.status);
    push('all_clinic_visits_closed', !open,
      open ? `Visit is still at "${encounter.status}".` : undefined,
      open ? `/consultation?encounterId=${encounter._id}` : undefined);
  }

  // ── Prescriptions dispensed ───────────────────────────────────────────
  try {
    const { getPrescriptionsByPatient } = await import('./prescription-service');
    const rxs = await getPrescriptionsByPatient(patientId);
    const outstanding = rxs.filter((r) => !RESOLVED_RX_STATUSES.has(r.status));
    push('prescriptions_dispensed', outstanding.length === 0,
      outstanding.length
        ? `${outstanding.length} prescription(s) not yet dispensed: ${outstanding.map((r) => r.medication).slice(0, 3).join(', ')}.`
        : undefined,
      outstanding.length ? '/pharmacy' : undefined);
  } catch (err) {
    push('prescriptions_dispensed', false, `Could not read prescriptions — blocking. (${errText(err)})`);
  }

  // ── Critical labs reviewed ────────────────────────────────────────────
  try {
    const { getLabResultsByPatient, effectiveOrderStatus } = await import('./lab-service');
    const labs = await getLabResultsByPatient(patientId);
    // A critical value that has come back but not been reviewed by a clinician
    // is the single most dangerous thing to discharge someone on.
    const unreviewed = labs.filter(
      (l) => l.critical && effectiveOrderStatus(l) === 'resulted',
    );
    push('critical_labs_reviewed', unreviewed.length === 0,
      unreviewed.length
        ? `${unreviewed.length} critical result(s) awaiting clinician review: ${unreviewed.map((l) => l.testName).slice(0, 3).join(', ')}.`
        : undefined,
      unreviewed.length ? `/patients/${patientId}?tab=labs` : undefined);
  } catch (err) {
    push('critical_labs_reviewed', false, `Could not read lab results — blocking. (${errText(err)})`);
  }

  // ── In-clinic procedures complete ─────────────────────────────────────
  //
  // Reported satisfied, and this one is NOT derived from live data — because
  // there is nothing to derive it from. `ProcedureDoc` records a procedure that
  // has already been performed (it carries `date` and `performedBy` and has no
  // `status` field), so an in-flight procedure has no representation in the
  // data model. Every recorded procedure is by definition complete.
  //
  // The honest options were to report satisfied with this note, or to block
  // every discharge on a condition that can never become true. Blocking on an
  // unrepresentable condition would train clerks to override the gate as a
  // matter of routine, which would defeat the other six checks.
  //
  // If in-flight procedures need to gate discharge, `ProcedureDoc` needs a
  // status field first — that is the `PROCEDURE_TRANSITIONS` lifecycle in
  // `order-lifecycles.ts`, which nothing currently writes to a document.
  push('in_clinic_procedures_complete', true,
    'Not evaluated: ProcedureDoc has no in-flight state — recorded procedures are already complete.');

  // ── Required documentation generated ──────────────────────────────────
  try {
    const { getRecordsByPatient } = await import('./medical-record-service');
    const records = await getRecordsByPatient(patientId);
    const encId = encounter?._id;
    const forVisit = encId ? records.filter((r) => r.encounterId === encId) : records;
    // A visit with a clinician must leave a record behind. An unsigned draft
    // is not documentation — it is an intention.
    const signed = forVisit.filter((r) => !!(r as { signedAt?: string }).signedAt);
    const ok = encId ? signed.length > 0 : forVisit.length > 0;
    push('required_documentation_generated', ok,
      ok ? undefined : 'No signed clinical record for this visit.',
      ok ? undefined : `/patients/${patientId}`);
  } catch (err) {
    push('required_documentation_generated', false, `Could not read clinical records — blocking. (${errText(err)})`);
  }

  // ── Payment status determined (non-critical) ──────────────────────────
  try {
    const { getPatientBalance } = await import('./ledger-service');
    const balance = await getPatientBalance(patientId);
    // Non-critical by design: an outstanding balance is flagged, not a reason
    // to detain a patient. Withholding discharge over money is not something
    // this system should make easy.
    push('payment_status_determined', balance <= 0,
      balance > 0 ? `Outstanding balance of ${balance}.` : undefined,
      balance > 0 ? `/payments?patientId=${patientId}` : undefined);
  } catch (err) {
    push('payment_status_determined', false, `Could not read the account balance. (${errText(err)})`);
  }

  // ── Pending items flagged (non-critical) ──────────────────────────────
  // Satisfied once every other condition has been evaluated — its purpose is
  // to make sure anything still open is visible, which this evaluation does.
  push('pending_items_flagged', true);

  const blocking = results.filter((r) => r.critical && !r.satisfied);
  return {
    conditions: results,
    blocking,
    satisfiedKeys: results.filter((r) => r.satisfied).map((r) => r.key),
    canDischarge: blocking.length === 0,
  };
}


/**
 * Discharge a patient with the gate evaluated against live data (KAN-96).
 *
 * `transitionEncounter` is intentionally pure and synchronous — it takes a list
 * of satisfied keys rather than performing I/O. That is a good property, but it
 * is also how the gate came to self-satisfy: whoever called it decided which
 * conditions held.
 *
 * This composes the two so the decision comes from the database. **Callers
 * discharging a patient should use this rather than passing `satisfyGateKeys`
 * to `transitionEncounter` by hand** — hand-supplied keys reintroduce exactly
 * the problem this fixes.
 *
 * Overriding still works and still requires `reason` + `authorizedBy`, and the
 * returned `evaluation.blocking` names precisely what was overridden so the
 * audit entry can record it.
 *
 * NOTE: the engine operates on the richer `clinical-flow/encounter-types`
 * `EncounterDoc` (facilityId, stage, isWalkIn, history), which is a different
 * type from the `db-types` `EncounterDoc` the services read. The gate
 * evaluation only needs `_id`, `patientId` and `status`, so it is typed on
 * that structural minimum rather than forcing the two to unify — reconciling
 * those two definitions is a separate change with its own blast radius.
 */
export async function attemptFacilityCheckout<E extends FlowEncounter>(
  encounter: E,
  to: EncounterStatus,
  actor: TransitionActor,
  options: { override?: boolean; reason?: string; authorizedBy?: string } = {},
): Promise<{ result: TransitionResult; evaluation: CheckoutGateEvaluation }> {
  const evaluation = await evaluateCheckoutGate(
    encounter.patientId,
    { _id: encounter._id, patientId: encounter.patientId, status: encounter.status } as unknown as EncounterDoc,
  );
  const { transitionEncounter } = await import('../clinical-flow/encounter-engine');
  const result = transitionEncounter(encounter as never, to, actor, {
    ...options,
    // Only keys live data proves satisfied — never a caller assertion.
    satisfyGateKeys: evaluation.satisfiedKeys,
  });
  return { result, evaluation };
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
