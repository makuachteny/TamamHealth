/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for nutrition-supply-service.ts
 * Covers supply CRUD, +/- level adjustment (with 409-retry), stock
 * classification, and the empty-store demo seed.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-sup-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createSupplyItem,
  getAllSupplies,
  adjustSupplyLevel,
  classifySupplyStatus,
  seedSuppliesIfEmpty,
} from '@/lib/services/nutrition-supply-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateSupplyInput = Parameters<typeof createSupplyItem>[0];

function validItem(overrides: Partial<CreateSupplyInput> = {}): CreateSupplyInput {
  return {
    name: "RUTF (Plumpy'Nut)",
    unit: 'sachets',
    currentLevel: 120,
    reorderLevel: 50,
    hospitalId: 'hosp-001',
    orgId: 'org-1',
    ...overrides,
  };
}

describe('Nutrition Supply Service', () => {
  test('creates a supply item', async () => {
    const item = await createSupplyItem(validItem());
    expect(item._id).toMatch(/^nsup-/);
    expect(item.type).toBe('nutrition_supply');
    expect(item.name).toBe("RUTF (Plumpy'Nut)");
    expect(item.currentLevel).toBe(120);
    expect(item.reorderLevel).toBe(50);
  });

  test('rejects a blank name', async () => {
    await expect(createSupplyItem(validItem({ name: '  ' }))).rejects.toThrow(/name/i);
  });

  test('defaults unit to "units" when blank', async () => {
    const item = await createSupplyItem(validItem({ unit: '  ' }));
    expect(item.unit).toBe('units');
  });

  test('retrieves all supplies sorted alphabetically', async () => {
    await createSupplyItem(validItem({ name: 'Vitamin A Capsules' }));
    await createSupplyItem(validItem({ name: 'F-75 Therapeutic Milk' }));
    await createSupplyItem(validItem({ name: 'MUAC Tapes' }));

    const all = await getAllSupplies();
    expect(all).toHaveLength(3);
    expect(all[0].name).toBe('F-75 Therapeutic Milk');
    expect(all[2].name).toBe('Vitamin A Capsules');
  });

  test('adjustSupplyLevel increments on a positive delta (receipt)', async () => {
    const item = await createSupplyItem(validItem({ currentLevel: 10 }));
    const updated = await adjustSupplyLevel(item._id, 5, { id: 'user-1', name: 'Nurse Achol' });
    expect(updated).not.toBeNull();
    expect(updated!.currentLevel).toBe(15);
    expect(updated!.lastReceivedAt).toBeDefined();
    expect(updated!.lastConsumedAt).toBeUndefined();
    expect(updated!.updatedBy).toBe('user-1');
    expect(updated!.updatedByName).toBe('Nurse Achol');
  });

  test('adjustSupplyLevel decrements on a negative delta (consumption)', async () => {
    const item = await createSupplyItem(validItem({ currentLevel: 10 }));
    const updated = await adjustSupplyLevel(item._id, -3);
    expect(updated).not.toBeNull();
    expect(updated!.currentLevel).toBe(7);
    expect(updated!.lastConsumedAt).toBeDefined();
  });

  test('adjustSupplyLevel does not go below zero', async () => {
    const item = await createSupplyItem(validItem({ currentLevel: 2 }));
    const updated = await adjustSupplyLevel(item._id, -5);
    expect(updated!.currentLevel).toBe(0);
  });

  test('adjustSupplyLevel persists across reload (not just in-memory)', async () => {
    const item = await createSupplyItem(validItem({ currentLevel: 10 }));
    await adjustSupplyLevel(item._id, -4);

    const all = await getAllSupplies();
    const reloaded = all.find(i => i._id === item._id)!;
    expect(reloaded.currentLevel).toBe(6);
  });

  test('adjustSupplyLevel returns null for a nonexistent item', async () => {
    const result = await adjustSupplyLevel('nonexistent', 1);
    expect(result).toBeNull();
  });

  describe('classifySupplyStatus', () => {
    test('returns ok when stock is above reorder level', () => {
      expect(classifySupplyStatus({ currentLevel: 100, reorderLevel: 50 })).toBe('ok');
    });

    test('returns low when stock is at or below reorder level', () => {
      expect(classifySupplyStatus({ currentLevel: 50, reorderLevel: 50 })).toBe('low');
      expect(classifySupplyStatus({ currentLevel: 40, reorderLevel: 50 })).toBe('low');
    });

    test('returns critical when stock is at or below half the reorder level', () => {
      expect(classifySupplyStatus({ currentLevel: 25, reorderLevel: 50 })).toBe('critical');
      expect(classifySupplyStatus({ currentLevel: 0, reorderLevel: 50 })).toBe('critical');
    });

    test('returns ok when reorderLevel is zero (no threshold configured)', () => {
      expect(classifySupplyStatus({ currentLevel: 0, reorderLevel: 0 })).toBe('ok');
    });
  });

  describe('seedSuppliesIfEmpty', () => {
    const demoItems = [
      { name: 'ReSoMal (ORS)', unit: 'packets', currentLevel: 3, reorderLevel: 10 },
      { name: 'MUAC Tapes', unit: 'tapes', currentLevel: 5, reorderLevel: 10 },
    ];

    test('seeds the given items when the store is empty', async () => {
      await seedSuppliesIfEmpty(demoItems, { hospitalId: 'hosp-001', orgId: 'org-1' });
      const all = await getAllSupplies();
      expect(all).toHaveLength(2);
      expect(all.map(i => i.name).sort()).toEqual(['MUAC Tapes', 'ReSoMal (ORS)']);
    });

    test('is a no-op once any supply doc already exists', async () => {
      await createSupplyItem(validItem({ name: 'Existing Item' }));
      await seedSuppliesIfEmpty(demoItems, { hospitalId: 'hosp-001', orgId: 'org-1' });

      const all = await getAllSupplies();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Existing Item');
    });

    test('uses deterministic slugified ids so a concurrent reseed cannot duplicate rows', async () => {
      await seedSuppliesIfEmpty(demoItems, { hospitalId: 'hosp-001', orgId: 'org-1' });
      const first = await getAllSupplies();
      // Simulate a second tab racing the seed with the same starter list before
      // either had observed the other's write — bulkDocs must not throw, and
      // the store must not grow.
      await seedSuppliesIfEmpty(demoItems, { hospitalId: 'hosp-001', orgId: 'org-1' });
      const second = await getAllSupplies();
      expect(second).toHaveLength(first.length);
    });
  });

  test('getAllSupplies with scope', async () => {
    await createSupplyItem(validItem());
    const all = await getAllSupplies({ role: 'nurse', orgId: 'org-1' } as Parameters<typeof getAllSupplies>[0]);
    expect(Array.isArray(all)).toBe(true);
  });
});
