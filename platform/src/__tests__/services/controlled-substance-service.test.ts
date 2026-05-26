/**
 * Controlled-substance audit service — focuses on the validation
 * gates that prevent SSDFCA-noncompliant movements from being recorded.
 * The DB write itself is mocked away so the tests stay fast and pure.
 */
import {
  recordMovement,
  ControlledSubstanceError,
  type RecordMovementInput,
} from '@/lib/services/controlled-substance-service';

// Mock the DB so the test doesn't need PouchDB.
jest.mock('@/lib/db', () => ({
  controlledSubstanceLogDB: () => ({
    put: jest.fn(async (doc) => ({ rev: '1-rev', id: doc._id })),
  }),
}));

// Mock audit so the test doesn't depend on its fetch.
jest.mock('@/lib/services/audit-service', () => ({
  logAudit: jest.fn(async () => undefined),
  logAuditSafe: jest.fn(async () => undefined),
}));

const baseInput: RecordMovementInput = {
  inventoryId: 'inv-001',
  medicationName: 'Morphine 10mg',
  schedule: 'II',
  movement: 'dispense',
  quantity: 5,
  unit: 'tablets',
  beforeBalance: 50,
  operatorId: 'u-1',
  operatorName: 'Operator',
  witnessId: 'u-2',
  witnessName: 'Witness',
  facilityId: 'hosp-001',
  facilityName: 'Test Hospital',
};

describe('controlled-substance-service', () => {
  describe('recordMovement', () => {
    it('writes a movement when operator and witness are different', async () => {
      const doc = await recordMovement({ ...baseInput });
      expect(doc.afterBalance).toBe(45);
      expect(doc.operatorId).toBe('u-1');
      expect(doc.witnessId).toBe('u-2');
    });

    it('rejects when operator and witness are the same person', async () => {
      const promise = recordMovement({ ...baseInput, witnessId: 'u-1', witnessName: 'Operator' });
      await expect(promise).rejects.toBeInstanceOf(ControlledSubstanceError);
      await expect(promise).rejects.toMatchObject({ code: 'SAME_SIGNATORY' });
    });

    it('rejects when witness is missing', async () => {
      const promise = recordMovement({ ...baseInput, witnessId: '', witnessName: '' });
      await expect(promise).rejects.toMatchObject({ code: 'MISSING_WITNESS' });
    });

    it('rejects negative quantity', async () => {
      const promise = recordMovement({ ...baseInput, quantity: -3 });
      await expect(promise).rejects.toMatchObject({ code: 'BAD_INPUT' });
    });

    it('rejects when after-balance would go negative', async () => {
      const promise = recordMovement({ ...baseInput, beforeBalance: 2, quantity: 10 });
      await expect(promise).rejects.toMatchObject({ code: 'NEGATIVE_BALANCE' });
    });

    it('handles intake (positive direction)', async () => {
      const doc = await recordMovement({ ...baseInput, movement: 'intake', quantity: 20 });
      expect(doc.afterBalance).toBe(70);
    });
  });
});
