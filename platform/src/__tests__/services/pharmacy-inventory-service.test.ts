/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for pharmacy-inventory-service.ts
 * Covers stock CRUD, decrement, stock classification, and deletion.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-inv-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createInventoryItem,
  getAllInventory,
  updateInventoryItem,
  decrementStock,
  deleteInventoryItem,
  classifyStockStatus,
} from '@/lib/services/pharmacy-inventory-service';
import type { PharmacyInventoryDoc } from '@/lib/db-types';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateInventoryInput = Parameters<typeof createInventoryItem>[0];

function validItem(overrides: Partial<CreateInventoryInput> = {}): CreateInventoryInput {
  return {
    hospitalId: 'hosp-001',
    hospitalName: 'TamamHealth Hospital',
    medicationName: 'Artesunate 60mg',
    category: 'Antimalarials',
    stockLevel: 500,
    unit: 'tablets',
    reorderLevel: 100,
    batchNumber: 'BATCH-2026-001',
    expiryDate: '2027-12-31',
    ...overrides,
  };
}

describe('Pharmacy Inventory Service', () => {
  test('creates an inventory item', async () => {
    const item = await createInventoryItem(validItem());
    expect(item._id).toMatch(/^inv-/);
    expect(item.type).toBe('pharmacy_inventory');
    expect(item.medicationName).toBe('Artesunate 60mg');
    expect(item.stockLevel).toBe(500);
    expect(item.dispensedToday).toBe(0);
  });

  test('retrieves all inventory sorted alphabetically', async () => {
    await createInventoryItem(validItem({ medicationName: 'Zinc Sulphate' }));
    await createInventoryItem(validItem({ medicationName: 'Amoxicillin 250mg' }));
    await createInventoryItem(validItem({ medicationName: 'Metformin 500mg' }));

    const all = await getAllInventory();
    expect(all).toHaveLength(3);
    expect(all[0].medicationName).toBe('Amoxicillin 250mg');
    expect(all[2].medicationName).toBe('Zinc Sulphate');
  });

  test('updates an inventory item', async () => {
    const item = await createInventoryItem(validItem());
    const updated = await updateInventoryItem(item._id, { stockLevel: 450 });
    expect(updated).not.toBeNull();
    expect(updated!.stockLevel).toBe(450);
    expect(updated!.updatedAt).toBeDefined();
  });

  test('update returns null for nonexistent item', async () => {
    const result = await updateInventoryItem('nonexistent', { stockLevel: 10 });
    expect(result).toBeNull();
  });

  test('decrements stock correctly', async () => {
    const item = await createInventoryItem(validItem());
    await decrementStock('Artesunate 60mg', 'hosp-001', 3);

    const all = await getAllInventory();
    const updated = all.find(i => i._id === item._id)!;
    expect(updated.stockLevel).toBe(497);
    expect(updated.dispensedToday).toBe(3);
    expect(updated.lastDispensed).toBeDefined();
  });

  test('decrement does not go below zero', async () => {
    await createInventoryItem(validItem({ stockLevel: 2 }));
    await decrementStock('Artesunate 60mg', 'hosp-001', 5);

    const all = await getAllInventory();
    expect(all[0].stockLevel).toBe(0);
  });

  test('decrement is no-op for unknown medication', async () => {
    await createInventoryItem(validItem());
    // Should not throw
    await decrementStock('Unknown Drug', 'hosp-001', 1);
    const all = await getAllInventory();
    expect(all[0].stockLevel).toBe(500); // unchanged
  });

  test('decrement prefers facility-specific match', async () => {
    await createInventoryItem(validItem({ hospitalId: 'hosp-001', stockLevel: 100 }));
    await createInventoryItem(validItem({
      hospitalId: 'hosp-002',
      hospitalName: 'Other Hospital',
      stockLevel: 200,
    }));

    await decrementStock('Artesunate 60mg', 'hosp-002', 5);

    const all = await getAllInventory();
    const hosp1 = all.find(i => i.hospitalId === 'hosp-001')!;
    const hosp2 = all.find(i => i.hospitalId === 'hosp-002')!;
    expect(hosp1.stockLevel).toBe(100); // unchanged
    expect(hosp2.stockLevel).toBe(195); // decremented
  });

  test('deletes an inventory item', async () => {
    const item = await createInventoryItem(validItem());
    const deleted = await deleteInventoryItem(item._id);
    expect(deleted).toBe(true);

    const all = await getAllInventory();
    expect(all).toHaveLength(0);
  });

  test('delete returns false for nonexistent item', async () => {
    const result = await deleteInventoryItem('nonexistent');
    expect(result).toBe(false);
  });

  describe('classifyStockStatus', () => {
    test('returns adequate when stock above reorder level', () => {
      expect(classifyStockStatus({
        stockLevel: 200, reorderLevel: 100, expiryDate: '2027-12-31',
      } as PharmacyInventoryDoc)).toBe('adequate');
    });

    test('returns low when stock below reorder level', () => {
      expect(classifyStockStatus({
        stockLevel: 80, reorderLevel: 100, expiryDate: '2027-12-31',
      } as PharmacyInventoryDoc)).toBe('low');
    });

    test('returns critical when stock below 30% of reorder level', () => {
      expect(classifyStockStatus({
        stockLevel: 25, reorderLevel: 100, expiryDate: '2027-12-31',
      } as PharmacyInventoryDoc)).toBe('critical');
    });

    test('returns critical when stock is zero', () => {
      expect(classifyStockStatus({
        stockLevel: 0, reorderLevel: 100, expiryDate: '2027-12-31',
      } as PharmacyInventoryDoc)).toBe('critical');
    });

    test('returns expired when past expiry date', () => {
      expect(classifyStockStatus({
        stockLevel: 500, reorderLevel: 100, expiryDate: '2020-01-01',
      } as PharmacyInventoryDoc)).toBe('expired');
    });

    test('expired takes precedence over adequate stock', () => {
      expect(classifyStockStatus({
        stockLevel: 1000, reorderLevel: 50, expiryDate: '2024-06-15',
      } as PharmacyInventoryDoc)).toBe('expired');
    });
  });

  test('getAllInventory with scope', async () => {
    await createInventoryItem(validItem());
    const all = await getAllInventory({ role: 'nurse' } as Parameters<typeof getAllInventory>[0]);
    expect(Array.isArray(all)).toBe(true);
  });

  test('decrementStock with undefined hospitalId uses first match', async () => {
    await createInventoryItem(validItem({ hospitalId: 'hosp-001', stockLevel: 100 }));
    await decrementStock('Artesunate 60mg', undefined, 10);

    const all = await getAllInventory();
    expect(all[0].stockLevel).toBe(90);
  });

  test('decrementStock with no medication match is no-op', async () => {
    await createInventoryItem(validItem({ medicationName: 'Different Drug' }));
    await decrementStock('Artesunate 60mg', 'hosp-001', 5);

    const all = await getAllInventory();
    expect(all[0].stockLevel).toBe(500); // unchanged
  });

  test('decrementStock defaults quantity to 1', async () => {
    const item = await createInventoryItem(validItem());
    await decrementStock('Artesunate 60mg', 'hosp-001');

    const all = await getAllInventory();
    const updated = all.find(i => i._id === item._id)!;
    expect(updated.stockLevel).toBe(499);
    expect(updated.dispensedToday).toBe(1);
  });

  test('classifyStockStatus with no expiry date', () => {
    expect(classifyStockStatus({
      stockLevel: 200, reorderLevel: 100, expiryDate: undefined,
    } as unknown as PharmacyInventoryDoc)).toBe('adequate');
  });

  test('classifyStockStatus with expired and zero stock', () => {
    expect(classifyStockStatus({
      stockLevel: 0, reorderLevel: 100, expiryDate: '2020-01-01',
    } as PharmacyInventoryDoc)).toBe('expired');
  });
});
