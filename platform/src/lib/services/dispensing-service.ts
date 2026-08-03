/**
 * Dispensing — the single transaction that moves medicine off the shelf.
 *
 * Before this service, dispensing was three independent client-side writes
 * (decrement stock → mark prescription dispensed → maybe log the controlled
 * substance). Any failure between them left the pharmacy in a state that
 * cannot be reconciled: stock gone with no dispense record, or a prescription
 * marked dispensed against stock that never moved. Worse, the controlled-drug
 * register was written by the UI, so any caller that skipped that branch
 * dispensed a Schedule II drug with no register entry at all.
 *
 * Everything now runs here, in one guarded sequence:
 *
 *   1. validate (clearance, quantity, witness) — nothing is written until
 *      every precondition holds, so the common failure costs no writes;
 *   2. plan a FEFO allocation across batches and refuse if stock is short;
 *   3. apply the batch decrements, remembering each one;
 *   4. write the controlled-substance register entry when the schedule
 *      requires it;
 *   5. update the prescription.
 *
 * PouchDB has no multi-document transaction, so atomicity is compensation-
 * based: a failure at step 4 or 5 rolls the applied decrements back (and, for
 * a register entry that already landed, appends a `reconciliation` movement —
 * the register is append-only, so a mistake is corrected by a counter-entry,
 * never by deletion). The invariant the ticket asks for holds either way:
 * you never end up with stock movement and no dispense record, or the reverse.
 */
import { pharmacyInventoryDB } from '../db';
import type {
  PharmacyInventoryDoc, PrescriptionDoc, DispenseAllocation,
} from '../db-types';
import { findByType } from './db-query';
import { recordMovement } from './controlled-substance-service';
import { updatePrescription } from './prescription-service';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { jubaDate } from '../time-juba';

export type DispenseErrorCode =
  | 'NOT_CLEARED'
  | 'BAD_QUANTITY'
  | 'STOCK_OUT'
  | 'INSUFFICIENT_STOCK'
  | 'WITNESS_REQUIRED'
  | 'REGISTER_FAILED'
  | 'WRITE_FAILED';

export class DispenseError extends Error {
  constructor(
    message: string,
    public readonly code: DispenseErrorCode,
    /** Stock actually on hand, for the "X available, Y needed" message. */
    public readonly available?: number,
  ) {
    super(message);
    this.name = 'DispenseError';
  }
}

export interface DispenseInput {
  prescription: PrescriptionDoc;
  /** Units to hand over. May be less than the prescribed course (partial fill). */
  quantity: number;
  dispenserId: string;
  dispenserName: string;
  facilityId: string;
  facilityName?: string;
  orgId?: string;
  /** Required when any allocated batch is a controlled schedule. */
  witnessId?: string;
  witnessName?: string;
  /** Set when the pharmacist knowingly fills short of the full course. */
  allowPartial?: boolean;
  note?: string;
}

export interface DispenseResult {
  prescription: PrescriptionDoc;
  allocations: DispenseAllocation[];
  quantityDispensed: number;
  outcome: 'full' | 'partial';
  controlledLogId?: string;
}

/** Stages from which a dispense is legal — mirrors PRESCRIPTION_TRANSITIONS. */
const DISPENSABLE_STAGES = new Set(['cleared_for_dispensing']);

/** Dose strengths ("500mg", "5mg/mL", "80/480mg", "10 IU") and pack forms. */
const STRENGTH_RE = /\b\d+(?:[./]\d+)*\s*(?:mg|mcg|g|ml|l|iu|units?|%)(?:\s*\/\s*\d*\s*(?:ml|l|mg|dose))?\b/gi;
const FORM_RE = /\b(?:injection|inj|tablets?|tabs?|capsules?|caps?|syrup|suspension|solution|cream|ointment|drops?|vials?|ampoules?|sachets?|powder|infusion|oral|iv|im)\b/gi;

/**
 * Compare a prescribed drug name to an inventory line.
 *
 * Prescriptions are written as the clinician says them ("Amoxicillin") while
 * stock is catalogued with strength and form ("Amoxicillin 500mg"), so an
 * exact-string match — what both the stock gate and the decrement used to
 * do — found nothing for most orders. The gate then silently passed and no
 * stock ever moved, which is precisely the failure this ticket is about.
 * Normalising both sides (drop strength, pack form, brand parenthetical and
 * punctuation) links the two without needing a catalogue migration.
 */
export function normalizeMedicationName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')   // brand name in parentheses
    .replace(STRENGTH_RE, ' ')
    .replace(FORM_RE, ' ')
    .replace(/[.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function medicationMatches(prescribed: string, stocked: string): boolean {
  const a = normalizeMedicationName(prescribed);
  const b = normalizeMedicationName(stocked);
  if (!a || !b) return false;
  // Equality first; then containment, so "Amoxicillin" also matches a stock
  // line catalogued as "Amoxicillin trihydrate".
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Batches of one medication at one facility, oldest-expiry first.
 *
 * Expired batches are excluded rather than sorted last: dispensing expired
 * stock is never correct, so it must not be reachable by asking for a large
 * enough quantity. They stay in inventory (a physical count still has to find
 * them) but can only leave via a `waste` movement.
 */
export async function getDispensableBatches(
  medicationName: string,
  facilityId: string | undefined,
): Promise<PharmacyInventoryDoc[]> {
  const db = pharmacyInventoryDB();
  // Fetched by type (not by an exact medicationName selector) because the
  // match is normalised — see medicationMatches. Inventory is per-facility
  // and small, so the in-memory filter is not a concern.
  const rows = await findByType<PharmacyInventoryDoc>(db, 'pharmacy_inventory');
  const today = jubaDate();
  return rows
    .filter(r => medicationMatches(medicationName, r.medicationName))
    .filter(r => !facilityId || r.hospitalId === facilityId)
    .filter(r => (r.stockLevel || 0) > 0)
    .filter(r => !r.expiryDate || r.expiryDate >= today)
    .sort((a, b) => {
      // FEFO: earliest expiry leaves first. Undated batches go last — an
      // unknown expiry must not jump ahead of a batch known to expire soon.
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
}

export interface FefoPlan {
  allocations: Array<{ batch: PharmacyInventoryDoc; quantity: number }>;
  allocated: number;
  shortfall: number;
  available: number;
}

/**
 * Work out which batches would satisfy `quantity`, without writing anything.
 * Exposed so the UI can show the stock position (and the shortfall) before
 * the pharmacist commits.
 */
export function planFefoAllocation(
  batches: PharmacyInventoryDoc[],
  quantity: number,
): FefoPlan {
  const allocations: FefoPlan['allocations'] = [];
  const available = batches.reduce((sum, b) => sum + (b.stockLevel || 0), 0);
  let remaining = quantity;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.stockLevel || 0, remaining);
    if (take <= 0) continue;
    allocations.push({ batch, quantity: take });
    remaining -= take;
  }
  return {
    allocations,
    allocated: quantity - remaining,
    shortfall: Math.max(0, remaining),
    available,
  };
}

/**
 * Decrement one batch, retrying on revision conflict.
 *
 * Two pharmacists dispensing the same batch concurrently each read the same
 * stockLevel; PouchDB rejects the second write with a 409, and re-reading lets
 * the loser apply its decrement on top of the winner's instead of silently
 * overwriting it. The final read-check also refuses to take more than the
 * batch currently holds, so a concurrent dispense cannot push stock negative.
 */
async function applyBatchDecrement(
  inventoryId: string,
  quantity: number,
): Promise<DispenseAllocation> {
  const db = pharmacyInventoryDB();
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const batch = await db.get(inventoryId) as PharmacyInventoryDoc;
    const before = batch.stockLevel || 0;
    if (before < quantity) {
      throw new DispenseError(
        `Batch ${batch.batchNumber} now holds only ${before} ${batch.unit}; another dispense took the stock.`,
        'INSUFFICIENT_STOCK',
        before,
      );
    }
    const now = new Date().toISOString();
    const updated: PharmacyInventoryDoc = {
      ...batch,
      stockLevel: before - quantity,
      dispensedToday: (batch.dispensedToday || 0) + quantity,
      lastDispensed: now,
      updatedAt: now,
    };
    try {
      const resp = await db.put(updated);
      emitSyncEvent({
        resourceType: 'pharmacy_inventory',
        resourceId: updated._id,
        operation: 'update',
        resourceVersion: resp.rev,
        orgId: updated.orgId,
        hospitalId: updated.hospitalId,
      });
      return {
        inventoryId: updated._id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantity,
        beforeBalance: before,
        afterBalance: updated.stockLevel,
      };
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 409 && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  throw new DispenseError('Could not reserve stock after repeated conflicts.', 'WRITE_FAILED');
}

/** Put stock back on a batch — the compensating write for a failed dispense. */
async function revertBatchDecrement(allocation: DispenseAllocation): Promise<void> {
  const db = pharmacyInventoryDB();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const batch = await db.get(allocation.inventoryId) as PharmacyInventoryDoc;
      const now = new Date().toISOString();
      const resp = await db.put({
        ...batch,
        stockLevel: (batch.stockLevel || 0) + allocation.quantity,
        dispensedToday: Math.max(0, (batch.dispensedToday || 0) - allocation.quantity),
        updatedAt: now,
      } as PharmacyInventoryDoc);
      emitSyncEvent({
        resourceType: 'pharmacy_inventory',
        resourceId: allocation.inventoryId,
        operation: 'update',
        resourceVersion: resp.rev,
        orgId: batch.orgId,
        hospitalId: batch.hospitalId,
      });
      return;
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 409 && attempt < 4) continue;
      // A rollback that itself fails is a reconciliation problem, not a
      // reason to hide the original error — record it and move on.
      await logAuditSafe('PHARMACY_ROLLBACK_FAILED', undefined, undefined,
        `Could not return ${allocation.quantity} to batch ${allocation.batchNumber} (${allocation.inventoryId}). Physical count required.`,
      ).catch(() => {});
      return;
    }
  }
}

/**
 * Dispense a prescription: stock gate → FEFO decrement → controlled-substance
 * register → prescription update, with rollback of anything already applied
 * if a later step fails.
 */
export async function dispenseMedication(input: DispenseInput): Promise<DispenseResult> {
  const { prescription: rx, quantity } = input;

  // ── 1. Validate. Nothing is written before every check passes. ──
  const stage = rx.orderStatus;
  if (stage && !DISPENSABLE_STAGES.has(stage)) {
    throw new DispenseError(
      'This order must be reviewed and cleared before it can be dispensed.',
      'NOT_CLEARED',
    );
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new DispenseError('Dispense quantity must be greater than zero.', 'BAD_QUANTITY');
  }

  const batches = await getDispensableBatches(rx.medication, input.facilityId);
  if (batches.length === 0) {
    throw new DispenseError(
      `${rx.medication} is out of stock at this facility.`,
      'STOCK_OUT',
      0,
    );
  }

  const plan = planFefoAllocation(batches, quantity);
  if (plan.shortfall > 0) {
    throw new DispenseError(
      `Insufficient stock: ${plan.available} available, ${quantity} requested.`,
      'INSUFFICIENT_STOCK',
      plan.available,
    );
  }

  // A controlled schedule on ANY allocated batch forces the two-signature
  // path — checked before the first write so a missing witness costs nothing.
  const controlledBatch = plan.allocations
    .map(a => a.batch)
    .find(b => b.controlledSchedule || b.requiresWitness);
  if (controlledBatch) {
    if (!input.witnessId || !input.witnessName) {
      throw new DispenseError(
        `${rx.medication} is a controlled substance — a witnessing staff member is required.`,
        'WITNESS_REQUIRED',
      );
    }
    if (input.witnessId === input.dispenserId) {
      throw new DispenseError(
        'Operator and witness must be two different staff members.',
        'WITNESS_REQUIRED',
      );
    }
  }

  // ── 2. Apply the batch decrements, remembering each for rollback. ──
  const applied: DispenseAllocation[] = [];
  const rollback = async () => {
    for (const a of applied) await revertBatchDecrement(a);
  };

  try {
    for (const { batch, quantity: take } of plan.allocations) {
      applied.push(await applyBatchDecrement(batch._id, take));
    }
  } catch (err) {
    await rollback();
    throw err;
  }

  // ── 3. Controlled-substance register. ──
  let controlledLogId: string | undefined;
  if (controlledBatch) {
    try {
      const entry = await recordMovement({
        inventoryId: controlledBatch._id,
        medicationName: controlledBatch.medicationName,
        schedule: controlledBatch.controlledSchedule || 'II',
        movement: 'dispense',
        quantity,
        unit: controlledBatch.unit,
        // Balance across every batch this dispense touched, so the register
        // reconciles against the shelf rather than against one batch.
        beforeBalance: applied.reduce((sum, a) => sum + a.beforeBalance, 0),
        patientId: rx.patientId,
        patientName: rx.patientName,
        prescriptionId: rx._id,
        operatorId: input.dispenserId,
        operatorName: input.dispenserName,
        witnessId: input.witnessId!,
        witnessName: input.witnessName!,
        reason: input.note,
        facilityId: input.facilityId,
        facilityName: input.facilityName || '',
        orgId: input.orgId,
      });
      controlledLogId = entry._id;
    } catch (err) {
      await rollback();
      throw new DispenseError(
        err instanceof Error ? err.message : 'Controlled-substance register entry failed.',
        'REGISTER_FAILED',
      );
    }
  }

  // ── 4. Update the prescription. ──
  const requested = rx.quantityToDispense || quantity;
  // Completeness is cumulative, not per-visit: a patient who collected 10 of
  // 21 last week and 11 today has the full course. Comparing only this
  // dispense against the course would leave that order open forever.
  const totalDispensed = (rx.quantityDispensed || 0) + quantity;
  const outcome: 'full' | 'partial' = totalDispensed < requested ? 'partial' : 'full';
  const now = new Date().toISOString();

  let updated: PrescriptionDoc | null = null;
  try {
    updated = await updatePrescription(rx._id, {
      // A partial fill leaves the order live so the balance can still be
      // collected; only a full fill closes it.
      status: outcome === 'full' ? 'dispensed' : 'pending',
      orderStatus: outcome === 'full' ? 'dispensed' : 'stockout_partial_referred',
      dispensedAt: now,
      quantityDispensed: totalDispensed,
      dispenseAllocations: [...(rx.dispenseAllocations || []), ...applied],
      dispensedBy: input.dispenserId,
      dispensedByName: input.dispenserName,
      dispenseOutcome: outcome,
      ...(input.note ? { dispenseNote: input.note } : {}),
      ...(controlledLogId ? { controlledLogId } : {}),
    });
  } catch {
    updated = null;
  }

  if (!updated) {
    await rollback();
    if (controlledLogId && input.witnessId && input.witnessName) {
      // The register is append-only: correct a landed entry with a counter-
      // movement rather than deleting it, so the audit trail shows both.
      await recordMovement({
        inventoryId: controlledBatch!._id,
        medicationName: controlledBatch!.medicationName,
        schedule: controlledBatch!.controlledSchedule || 'II',
        movement: 'reconciliation',
        quantity,
        unit: controlledBatch!.unit,
        beforeBalance: applied.reduce((sum, a) => sum + a.afterBalance, 0),
        prescriptionId: rx._id,
        operatorId: input.dispenserId,
        operatorName: input.dispenserName,
        witnessId: input.witnessId,
        witnessName: input.witnessName,
        reason: `Reversal of ${controlledLogId} — dispense record could not be written.`,
        facilityId: input.facilityId,
        facilityName: input.facilityName || '',
        orgId: input.orgId,
      }).catch(() => {});
    }
    throw new DispenseError(
      'Could not record the dispense; stock has been returned. Please retry.',
      'WRITE_FAILED',
    );
  }

  await logAuditSafe('PRESCRIPTION_DISPENSED', input.dispenserId, input.dispenserName,
    `Dispensed ${quantity} ${controlledBatch?.unit || plan.allocations[0]?.batch.unit || 'unit(s)'} of ${rx.medication} to ${rx.patientName} `
    + `from batch(es) ${applied.map(a => a.batchNumber).join(', ')} (Rx: ${rx._id})`
    + (outcome === 'partial' ? ` — PARTIAL fill, ${requested - totalDispensed} outstanding` : ''),
  );

  return {
    prescription: updated,
    allocations: applied,
    quantityDispensed: quantity,
    outcome,
    controlledLogId,
  };
}

/**
 * Record that a prescription cannot be filled — no stock at all, or the
 * pharmacist needs the prescriber to clarify. Both leave the order active so
 * it stays on someone's list rather than disappearing.
 */
export async function recordUnfilled(
  rx: PrescriptionDoc,
  reason: 'stock_out' | 'clarification_requested',
  note: string,
  actor: { id: string; name: string },
): Promise<PrescriptionDoc | null> {
  const updated = await updatePrescription(rx._id, {
    orderStatus: reason === 'stock_out' ? 'stockout_partial_referred' : 'held_awaiting_clarification',
    status: 'pending',
    dispenseOutcome: reason,
    dispenseNote: note,
  });
  if (updated) {
    await logAuditSafe(
      reason === 'stock_out' ? 'PRESCRIPTION_STOCKOUT' : 'PRESCRIPTION_CLARIFICATION',
      actor.id, actor.name,
      `${rx.medication} for ${rx.patientName} (Rx: ${rx._id}): ${note}`,
    );
  }
  return updated;
}
