/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Monotonic document counter (KAN-54 / MED-05).
 *
 * These pin the property that matters: a number is never reissued. The
 * `allDocs().total_rows` approach this replaced failed exactly there — deleting
 * a document lowered the count, so the next allocation handed out an identifier
 * that already belonged to a live record.
 */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { nextSequence } from '@/lib/services/doc-counter';
import { getDB } from '@/lib/db';

afterEach(async () => {
  await teardownTestDBs();
});

describe('nextSequence', () => {
  test('allocates monotonically from 1', async () => {
    const db = getDB('tamamhealth_test_counter');
    expect(await nextSequence(db, 'invoice')).toBe(1);
    expect(await nextSequence(db, 'invoice')).toBe(2);
    expect(await nextSequence(db, 'invoice')).toBe(3);
  });

  test('keeps separate keys independent', async () => {
    const db = getDB('tamamhealth_test_counter');
    expect(await nextSequence(db, 'invoice_20260727')).toBe(1);
    expect(await nextSequence(db, 'invoice_20260728')).toBe(1);
    expect(await nextSequence(db, 'invoice_20260727')).toBe(2);
  });

  test('NEVER reissues a number after documents are deleted', async () => {
    // The regression this exists for. A row count would drop back here.
    const db = getDB('tamamhealth_test_counter');
    const issued = [
      await nextSequence(db, 'invoice'),
      await nextSequence(db, 'invoice'),
      await nextSequence(db, 'invoice'),
    ];
    expect(issued).toEqual([1, 2, 3]);

    // Delete every non-counter document; the counter is a _local/ doc and
    // survives, so the sequence keeps climbing.
    const all = await db.allDocs({ include_docs: true });
    for (const row of all.rows) {
      if (row.doc) await db.remove(row.doc as { _id: string; _rev: string });
    }

    const next = await nextSequence(db, 'invoice');
    expect(next).toBe(4);
    expect(issued).not.toContain(next);
  });

  test('seeds above an existing dataset so a fresh counter cannot collide', async () => {
    // Migrated/seeded data already holds INV-00007; starting at 1 would
    // duplicate seven live identifiers.
    const db = getDB('tamamhealth_test_counter');
    expect(await nextSequence(db, 'invoice', async () => 7)).toBe(8);
    // The seed runs only on first allocation.
    expect(await nextSequence(db, 'invoice', async () => 999)).toBe(9);
  });

  test('concurrent allocations all get distinct numbers', async () => {
    const db = getDB('tamamhealth_test_counter');
    const results = await Promise.all(
      Array.from({ length: 8 }, () => nextSequence(db, 'invoice')),
    );
    expect(new Set(results).size).toBe(results.length);
  });

  test('surfaces a non-conflict error rather than looping', async () => {
    const exploding = {
      get: async () => { throw Object.assign(new Error('boom'), { status: 500 }); },
      put: async () => ({}),
    };
    await expect(nextSequence(exploding, 'invoice')).rejects.toThrow('boom');
  });

  test('gives up after maxAttempts of persistent conflict', async () => {
    const alwaysConflicts = {
      get: async () => { throw Object.assign(new Error('nf'), { status: 404 }); },
      put: async () => { throw Object.assign(new Error('conflict'), { status: 409 }); },
    };
    await expect(nextSequence(alwaysConflicts, 'invoice', undefined, 2))
      .rejects.toThrow(/Could not allocate a sequence/);
  });
});
