/**
 * Dispensing transaction (KAN-113). These tests exist to prove the four
 * guarantees the pharmacy module is worthless without:
 *
 *   - stock cannot go negative, and a short shelf refuses the dispense;
 *   - FEFO decides which batch leaves, and expired stock never does;
 *   - a controlled substance cannot be dispensed without a witnessed
 *     register entry;
 *   - a failure part-way through leaves NEITHER a dispense record NOR a
 *     stock movement (compensation rollback).
 *
 * The DB is an in-memory fake rather than a mock returning fixed values, so
 * the rollback assertions check real balances after the fact.
 */
import {
  dispenseMedication,
  planFefoAllocation,
  getDispensableBatches,
  medicationMatches,
  normalizeMedicationName,
  DispenseError,
} from '@/lib/services/dispensing-service';
import type { PharmacyInventoryDoc, PrescriptionDoc } from '@/lib/db-types';

// ── In-memory inventory store ────────────────────────────────────────────
let store: Record<string, PharmacyInventoryDoc> = {};
/** Set to an _id to make the next put() for that doc fail with a 409 once. */
let conflictOnce: string | null = null;

const inventoryDb = {
  get: jest.fn(async (id: string) => {
    if (!store[id]) throw Object.assign(new Error('missing'), { status: 404 });
    return { ...store[id] };
  }),
  put: jest.fn(async (doc: PharmacyInventoryDoc) => {
    if (conflictOnce === doc._id) {
      conflictOnce = null;
      throw Object.assign(new Error('conflict'), { status: 409 });
    }
    store[doc._id] = { ...doc, _rev: `${Number((doc._rev || '0-x').split('-')[0]) + 1}-r` };
    return { rev: store[doc._id]._rev, id: doc._id };
  }),
};

jest.mock('@/lib/db', () => ({
  pharmacyInventoryDB: () => inventoryDb,
  controlledSubstanceLogDB: () => ({ put: jest.fn(async (d: { _id: string }) => ({ rev: '1-r', id: d._id })) }),
}));

jest.mock('@/lib/services/db-query', () => ({
  findByType: jest.fn(async (_db: unknown, _type: string, selector?: { medicationName?: string }) =>
    Object.values(store).filter(r => !selector?.medicationName || r.medicationName === selector.medicationName)),
}));

jest.mock('@/lib/services/audit-service', () => ({
  logAudit: jest.fn(async () => undefined),
  logAuditSafe: jest.fn(async () => undefined),
}));

jest.mock('@/lib/services/sync-event-service', () => ({
  emitSyncEvent: jest.fn(),
}));

// jubaDate drives the expired-batch filter; pin it so the fixtures are stable.
jest.mock('@/lib/time-juba', () => ({ jubaDate: () => '2026-07-30' }));

// Prescription updates + controlled register are separately tested; here they
// are switchable so the failure paths can be driven.
const updatePrescription = jest.fn(
  async (id: string, patch: Partial<PrescriptionDoc>) => ({ _id: id, ...patch } as PrescriptionDoc),
);
jest.mock('@/lib/services/prescription-service', () => ({
  updatePrescription: (...args: unknown[]) =>
    (updatePrescription as unknown as (...a: unknown[]) => unknown)(...args),
}));

const recordMovement = jest.fn(async () => ({ _id: 'cslog-1' }));
jest.mock('@/lib/services/controlled-substance-service', () => ({
  recordMovement: (...args: unknown[]) =>
    (recordMovement as unknown as (...a: unknown[]) => unknown)(...args),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────
const batch = (over: Partial<PharmacyInventoryDoc>): PharmacyInventoryDoc => ({
  _id: 'inv-x', _rev: '1-a', type: 'pharmacy_inventory',
  hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',
  medicationName: 'Amoxicillin', category: 'Antibiotic',
  stockLevel: 100, unit: 'tablets', reorderLevel: 20,
  batchNumber: 'B-1', expiryDate: '2027-01-01',
  dispensedToday: 0, createdAt: '', updatedAt: '',
  ...over,
});

const rx: PrescriptionDoc = {
  _id: 'rx-1', type: 'prescription',
  patientId: 'pat-1', patientName: 'Test Patient',
  medication: 'Amoxicillin', dose: '500mg', route: 'Oral',
  frequency: 'TDS', duration: '7 days', prescribedBy: 'Dr. Test',
  status: 'pending', orderStatus: 'cleared_for_dispensing',
  quantityToDispense: 21, hospitalId: 'hosp-001',
  createdAt: '', updatedAt: '',
};

const input = {
  prescription: rx,
  quantity: 21,
  dispenserId: 'u-pharm',
  dispenserName: 'Rose Pharmacist',
  facilityId: 'hosp-001',
};

beforeEach(() => {
  store = {};
  conflictOnce = null;
  jest.clearAllMocks();
  updatePrescription.mockImplementation(
    async (id: string, patch: Partial<PrescriptionDoc>) => ({ _id: id, ...patch } as PrescriptionDoc),
  );
  recordMovement.mockImplementation(async () => ({ _id: 'cslog-1' }));
});

// ── FEFO ordering ────────────────────────────────────────────────────────
describe('FEFO allocation', () => {
  it('takes the earliest-expiring batch first', async () => {
    store['inv-late'] = batch({ _id: 'inv-late', batchNumber: 'LATE', expiryDate: '2028-01-01', stockLevel: 100 });
    store['inv-soon'] = batch({ _id: 'inv-soon', batchNumber: 'SOON', expiryDate: '2026-09-01', stockLevel: 100 });

    const result = await dispenseMedication(input);

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].batchNumber).toBe('SOON');
    expect(store['inv-soon'].stockLevel).toBe(79);
    expect(store['inv-late'].stockLevel).toBe(100);
  });

  it('spans batches when the earliest cannot cover the quantity', async () => {
    store['inv-soon'] = batch({ _id: 'inv-soon', batchNumber: 'SOON', expiryDate: '2026-09-01', stockLevel: 5 });
    store['inv-late'] = batch({ _id: 'inv-late', batchNumber: 'LATE', expiryDate: '2028-01-01', stockLevel: 100 });

    const result = await dispenseMedication(input);

    expect(result.allocations.map(a => [a.batchNumber, a.quantity])).toEqual([['SOON', 5], ['LATE', 16]]);
    expect(store['inv-soon'].stockLevel).toBe(0);
    expect(store['inv-late'].stockLevel).toBe(84);
  });

  it('never dispenses expired stock, even when it is the only stock', async () => {
    store['inv-exp'] = batch({ _id: 'inv-exp', batchNumber: 'EXPIRED', expiryDate: '2026-01-01', stockLevel: 500 });

    await expect(dispenseMedication(input)).rejects.toMatchObject({ code: 'STOCK_OUT' });
    expect(store['inv-exp'].stockLevel).toBe(500);
  });

  it('sorts undated batches last so a known expiry always goes first', () => {
    const plan = planFefoAllocation(
      [batch({ _id: 'a', batchNumber: 'DATED', expiryDate: '2027-01-01', stockLevel: 10 })],
      5,
    );
    expect(plan.allocated).toBe(5);
    expect(plan.shortfall).toBe(0);
  });

  it('excludes other facilities’ stock', async () => {
    store['inv-other'] = batch({ _id: 'inv-other', hospitalId: 'hosp-999', stockLevel: 500 });
    const batches = await getDispensableBatches('Amoxicillin', 'hosp-001');
    expect(batches).toHaveLength(0);
  });
});

// ── Stock gate ───────────────────────────────────────────────────────────
describe('stock gate', () => {
  it('refuses when the shelf is short and moves no stock', async () => {
    store['inv-1'] = batch({ _id: 'inv-1', stockLevel: 10 });

    await expect(dispenseMedication(input)).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK', available: 10,
    });
    expect(store['inv-1'].stockLevel).toBe(10);
    expect(updatePrescription).not.toHaveBeenCalled();
  });

  it('refuses a zero or negative quantity', async () => {
    store['inv-1'] = batch({ _id: 'inv-1' });
    await expect(dispenseMedication({ ...input, quantity: 0 })).rejects.toMatchObject({ code: 'BAD_QUANTITY' });
  });

  it('refuses an order that has not been cleared for dispensing', async () => {
    store['inv-1'] = batch({ _id: 'inv-1' });
    await expect(dispenseMedication({
      ...input,
      prescription: { ...rx, orderStatus: 'under_review' },
    })).rejects.toMatchObject({ code: 'NOT_CLEARED' });
    expect(store['inv-1'].stockLevel).toBe(100);
  });
});

// ── Controlled substances ────────────────────────────────────────────────
describe('controlled substances', () => {
  const controlled = () => batch({
    _id: 'inv-cs', medicationName: 'Morphine', batchNumber: 'CS-1',
    controlledSchedule: 'II', requiresWitness: true, stockLevel: 100,
  });
  const csInput = { ...input, prescription: { ...rx, medication: 'Morphine' }, quantity: 10 };

  it('refuses without a witness and leaves stock untouched', async () => {
    store['inv-cs'] = controlled();
    await expect(dispenseMedication(csInput)).rejects.toMatchObject({ code: 'WITNESS_REQUIRED' });
    expect(store['inv-cs'].stockLevel).toBe(100);
    expect(recordMovement).not.toHaveBeenCalled();
  });

  it('refuses when the witness is the dispenser', async () => {
    store['inv-cs'] = controlled();
    await expect(dispenseMedication({
      ...csInput, witnessId: 'u-pharm', witnessName: 'Rose Pharmacist',
    })).rejects.toMatchObject({ code: 'WITNESS_REQUIRED' });
    expect(store['inv-cs'].stockLevel).toBe(100);
  });

  it('writes a register entry with the dispense when witnessed', async () => {
    store['inv-cs'] = controlled();
    const result = await dispenseMedication({
      ...csInput, witnessId: 'u-2', witnessName: 'Witness Nurse',
    });
    expect(recordMovement).toHaveBeenCalledWith(expect.objectContaining({
      movement: 'dispense', quantity: 10, schedule: 'II',
      operatorId: 'u-pharm', witnessId: 'u-2', prescriptionId: 'rx-1',
    }));
    expect(result.controlledLogId).toBe('cslog-1');
    expect(store['inv-cs'].stockLevel).toBe(90);
  });

  it('rolls stock back when the register entry fails', async () => {
    store['inv-cs'] = controlled();
    recordMovement.mockRejectedValueOnce(new Error('register down'));

    await expect(dispenseMedication({
      ...csInput, witnessId: 'u-2', witnessName: 'Witness Nurse',
    })).rejects.toMatchObject({ code: 'REGISTER_FAILED' });

    expect(store['inv-cs'].stockLevel).toBe(100);
    expect(updatePrescription).not.toHaveBeenCalled();
  });
});

// ── Atomicity ────────────────────────────────────────────────────────────
describe('atomicity', () => {
  it('returns stock across every touched batch when the dispense record fails', async () => {
    store['inv-soon'] = batch({ _id: 'inv-soon', batchNumber: 'SOON', expiryDate: '2026-09-01', stockLevel: 5 });
    store['inv-late'] = batch({ _id: 'inv-late', batchNumber: 'LATE', expiryDate: '2028-01-01', stockLevel: 100 });
    updatePrescription.mockResolvedValueOnce(null as unknown as PrescriptionDoc);

    await expect(dispenseMedication(input)).rejects.toMatchObject({ code: 'WRITE_FAILED' });

    expect(store['inv-soon'].stockLevel).toBe(5);
    expect(store['inv-late'].stockLevel).toBe(100);
    expect(store['inv-soon'].dispensedToday).toBe(0);
    expect(store['inv-late'].dispensedToday).toBe(0);
  });

  it('retries a concurrent revision conflict instead of losing the decrement', async () => {
    store['inv-1'] = batch({ _id: 'inv-1', stockLevel: 100 });
    conflictOnce = 'inv-1';

    const result = await dispenseMedication(input);

    expect(result.quantityDispensed).toBe(21);
    expect(store['inv-1'].stockLevel).toBe(79);
  });
});

// ── Outcomes ─────────────────────────────────────────────────────────────
describe('outcomes', () => {
  it('marks a full fill dispensed and records the batch trail', async () => {
    store['inv-1'] = batch({ _id: 'inv-1', batchNumber: 'B-77' });

    const result = await dispenseMedication(input);

    expect(result.outcome).toBe('full');
    expect(updatePrescription).toHaveBeenCalledWith('rx-1', expect.objectContaining({
      status: 'dispensed',
      orderStatus: 'dispensed',
      quantityDispensed: 21,
      dispensedBy: 'u-pharm',
      dispenseOutcome: 'full',
    }));
    const patch = updatePrescription.mock.calls[0][1] as Partial<PrescriptionDoc>;
    expect(patch.dispenseAllocations).toEqual([expect.objectContaining({
      batchNumber: 'B-77', quantity: 21, beforeBalance: 100, afterBalance: 79,
    })]);
  });

  it('keeps a partial fill active as stockout_partial_referred', async () => {
    store['inv-1'] = batch({ _id: 'inv-1', stockLevel: 100 });

    const result = await dispenseMedication({ ...input, quantity: 10 });

    expect(result.outcome).toBe('partial');
    expect(updatePrescription).toHaveBeenCalledWith('rx-1', expect.objectContaining({
      status: 'pending',
      orderStatus: 'stockout_partial_referred',
      quantityDispensed: 10,
      dispenseOutcome: 'partial',
    }));
  });

  it('accumulates quantity across a second partial fill', async () => {
    store['inv-1'] = batch({ _id: 'inv-1', stockLevel: 100 });

    await dispenseMedication({
      ...input,
      prescription: { ...rx, quantityDispensed: 10, orderStatus: 'cleared_for_dispensing' },
      quantity: 11,
    });

    expect(updatePrescription).toHaveBeenCalledWith('rx-1', expect.objectContaining({
      quantityDispensed: 21, dispenseOutcome: 'full',
    }));
  });
});

// ── Prescription ↔ inventory name linkage ────────────────────────────────
describe('medication name matching', () => {
  it('links a prescription written without a strength to the catalogued line', () => {
    expect(medicationMatches('Amoxicillin', 'Amoxicillin 500mg')).toBe(true);
    expect(medicationMatches('Amlodipine', 'Amlodipine 5mg')).toBe(true);
    expect(medicationMatches('Morphine', 'Morphine 10mg/mL injection')).toBe(true);
  });

  it('ignores brand parentheticals and pack form', () => {
    expect(normalizeMedicationName('Artemether-Lumefantrine (Coartem)')).toBe('artemether-lumefantrine');
    expect(normalizeMedicationName('Diazepam 5mg/mL injection')).toBe('diazepam');
    expect(medicationMatches('Artemether-Lumefantrine (Coartem)', 'Artemether-Lumefantrine')).toBe(true);
  });

  it('keeps combination names that carry no strength token intact', () => {
    expect(normalizeMedicationName('TDF/3TC/DTG')).toBe('tdf/3tc/dtg');
    expect(normalizeMedicationName('Ferrous Sulfate + Folic Acid')).toBe('ferrous sulfate + folic acid');
  });

  it('does not match two different drugs', () => {
    expect(medicationMatches('Amoxicillin', 'Metformin 500mg')).toBe(false);
    expect(medicationMatches('Paracetamol', 'Morphine 10mg/mL injection')).toBe(false);
    expect(medicationMatches('', 'Amoxicillin 500mg')).toBe(false);
  });

  it('finds stock for a prescription whose name omits the strength', async () => {
    store['inv-amox'] = batch({ _id: 'inv-amox', medicationName: 'Amoxicillin 500mg', stockLevel: 100 });
    const found = await getDispensableBatches('Amoxicillin', 'hosp-001');
    expect(found.map(f => f._id)).toEqual(['inv-amox']);
  });
});
