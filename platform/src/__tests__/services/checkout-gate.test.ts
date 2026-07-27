/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Facility checkout gate — live evaluation (KAN-96).
 *
 * The gate previously read a list of ASSERTED satisfied keys
 * (`encounter.checkoutSatisfied` + caller-supplied `satisfyGateKeys`) and never
 * checked them against the patient's real obligations. It blocked only when
 * someone forgot to tick a box — so a patient could be discharged with an
 * unreviewed critical result as long as the screen had marked it satisfied.
 *
 * Each test here proves a condition refuses discharge while it holds and
 * permits it once cleared, per the ticket's acceptance criteria.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-gate-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { evaluateCheckoutGate } from '@/lib/services/checkout-gate-service';
import { createPrescription, dispensePrescription } from '@/lib/services/prescription-service';
import { createLabResult, updateLabResult } from '@/lib/services/lab-service';
import type { EncounterDoc } from '@/lib/db-types';

const PATIENT = 'pat-gate-001';

const closedEncounter = { _id: 'enc-1', status: 'awaiting_facility_checkout' } as unknown as EncounterDoc;

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

/** Convenience: is a specific key currently blocking? */
function blocks(evaluation: Awaited<ReturnType<typeof evaluateCheckoutGate>>, key: string): boolean {
  return evaluation.blocking.some((b) => b.key === key);
}

describe('open clinic visit', () => {
  test('a visit still with the clinician blocks discharge', async () => {
    const open = { _id: 'enc-2', status: 'with_clinician' } as unknown as EncounterDoc;
    const ev = await evaluateCheckoutGate(PATIENT, open);
    expect(blocks(ev, 'all_clinic_visits_closed')).toBe(true);
    expect(ev.canDischarge).toBe(false);
  });

  test('a closed visit clears that condition', async () => {
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(blocks(ev, 'all_clinic_visits_closed')).toBe(false);
  });

  test('NO encounter blocks rather than permits', async () => {
    // "Absence of data blocks rather than permits" — an unknown visit state is
    // not evidence the visit is finished.
    const ev = await evaluateCheckoutGate(PATIENT, undefined);
    expect(blocks(ev, 'all_clinic_visits_closed')).toBe(true);
  });
});

describe('undispensed prescriptions', () => {
  const rx = () => ({
    patientId: PATIENT, patientName: 'Achol Deng', medication: 'Amoxicillin',
    dose: '500mg', route: 'PO', frequency: 'TDS', duration: '5 days',
    prescribedBy: 'Dr. Wani', status: 'pending' as const, hospitalId: 'hosp-001',
  });

  test('an undispensed prescription blocks discharge', async () => {
    await createPrescription(rx() as never);
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(blocks(ev, 'prescriptions_dispensed')).toBe(true);
    // The clerk is told what to resolve and where.
    const cond = ev.conditions.find((c) => c.key === 'prescriptions_dispensed')!;
    expect(cond.detail).toMatch(/Amoxicillin/);
    expect(cond.resolveHref).toBe('/pharmacy');
  });

  test('dispensing it clears the condition', async () => {
    // createPrescription returns { prescription }, not the doc itself.
    const created = await createPrescription(rx() as never);
    await dispensePrescription(created.prescription._id);
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(blocks(ev, 'prescriptions_dispensed')).toBe(false);
  });

  test('no prescriptions at all is satisfied, not blocked', async () => {
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(blocks(ev, 'prescriptions_dispensed')).toBe(false);
  });
});

describe('unreviewed critical lab results', () => {
  const order = () => ({
    patientId: PATIENT, patientName: 'Achol Deng', hospitalNumber: 'JTH-1',
    testName: 'Potassium', specimen: 'Blood', status: 'pending' as const,
    result: '', unit: 'mmol/L', referenceRange: '3.5-5.1',
    abnormal: false, critical: false, orderedBy: 'Dr. Wani', hospitalId: 'hosp-001',
  });

  test('a resulted critical value blocks discharge', async () => {
    // The single most dangerous thing to discharge someone on.
    const doc = await createLabResult(order() as never);
    await updateLabResult(doc._id, { status: 'completed', result: '7.2', critical: true });

    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(blocks(ev, 'critical_labs_reviewed')).toBe(true);
    expect(ev.conditions.find((c) => c.key === 'critical_labs_reviewed')!.detail).toMatch(/Potassium/);
  });

  test('reviewing it clears the condition', async () => {
    const doc = await createLabResult(order() as never);
    await updateLabResult(doc._id, { status: 'completed', result: '7.2', critical: true });
    await updateLabResult(doc._id, { orderStatus: 'reviewed_by_clinician' });

    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(blocks(ev, 'critical_labs_reviewed')).toBe(false);
  });

  test('a NON-critical unreviewed result does not block', async () => {
    const doc = await createLabResult(order() as never);
    await updateLabResult(doc._id, { status: 'completed', result: '4.1' });
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(blocks(ev, 'critical_labs_reviewed')).toBe(false);
  });
});

describe('gate shape', () => {
  test('an outstanding balance is flagged but does NOT block', async () => {
    // Deliberate: withholding discharge over money is not something this
    // system should make easy. Payment is a non-critical condition.
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    const payment = ev.conditions.find((c) => c.key === 'payment_status_determined')!;
    expect(payment.critical).toBe(false);
    expect(ev.blocking.map((b) => b.key)).not.toContain('payment_status_determined');
  });

  test('satisfiedKeys reflects live data, not caller assertions', async () => {
    await createPrescription({
      patientId: PATIENT, patientName: 'Achol Deng', medication: 'Amoxicillin',
      dose: '500mg', route: 'PO', frequency: 'TDS', duration: '5 days',
      prescribedBy: 'Dr. Wani', status: 'pending', hospitalId: 'hosp-001',
    } as never);
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    expect(ev.satisfiedKeys).not.toContain('prescriptions_dispensed');
  });

  test('every gate condition is reported, satisfied or not', async () => {
    const ev = await evaluateCheckoutGate(PATIENT, closedEncounter);
    const keys = ev.conditions.map((c) => c.key);
    for (const k of [
      'all_clinic_visits_closed', 'prescriptions_dispensed', 'critical_labs_reviewed',
      'in_clinic_procedures_complete', 'required_documentation_generated',
      'payment_status_determined', 'pending_items_flagged',
    ]) {
      expect(keys).toContain(k);
    }
  });
});
