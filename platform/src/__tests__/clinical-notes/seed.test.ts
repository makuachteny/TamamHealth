/**
 * Starter text shortcuts, seeded once per clinician so Text Shortcut does not
 * open empty on day one.
 *
 * These tests exist to prove:
 *   - a first-time seed creates the whole starter set;
 *   - re-seeding is a no-op — idempotent by construction (deterministic ids),
 *     and it must never clobber a phrase the clinician has since edited;
 *   - a 409 (two mounts racing the same seed) is swallowed, not surfaced as a
 *     failure, because the row landing either way is the whole point of a
 *     deterministic id — but any OTHER failure is a real one and must throw.
 */
import { seedTextShortcutsFor, STARTER_SHORTCUTS } from '@/lib/clinical-notes/seed';
import type { TextShortcutDoc } from '@/lib/clinical-notes/types';

let store: Record<string, TextShortcutDoc> = {};

const shortcutsDb = {
  get: jest.fn(async (id: string) => {
    if (!store[id]) throw Object.assign(new Error('missing'), { status: 404 });
    return { ...store[id] };
  }),
  put: jest.fn(async (doc: TextShortcutDoc) => {
    store[doc._id] = { ...doc };
    return { rev: '1-r', id: doc._id };
  }),
};

jest.mock('@/lib/db', () => ({ getDB: () => shortcutsDb }));

beforeEach(() => {
  store = {};
  jest.clearAllMocks();
});

describe('seedTextShortcutsFor', () => {
  test('creates every starter shortcut for a clinician with none yet', async () => {
    const created = await seedTextShortcutsFor('u-doc');
    expect(created).toBe(STARTER_SHORTCUTS.length);
    expect(Object.keys(store)).toHaveLength(STARTER_SHORTCUTS.length);
  });

  test('every seeded doc is owned by the given user and carries the right shape', async () => {
    await seedTextShortcutsFor('u-doc', { hospitalId: 'hosp-1', orgId: 'org-1' });
    const docs = Object.values(store);
    for (const doc of docs) {
      expect(doc.type).toBe('text_shortcut');
      expect(doc.userId).toBe('u-doc');
      expect(doc.shared).toBe(false);
      expect(doc.useCount).toBe(0);
      expect(doc.hospitalId).toBe('hosp-1');
      expect(doc.orgId).toBe('org-1');
      expect(doc.name.trim().length).toBeGreaterThan(0);
      expect(doc.body.trim().length).toBeGreaterThan(0);
    }
  });

  test('seed ids are deterministic and scoped per user — two clinicians get two separate sets', async () => {
    await seedTextShortcutsFor('u-doc');
    const docIdsForDoc = Object.keys(store);
    await seedTextShortcutsFor('u-nurse');
    const docIdsForNurse = Object.keys(store).filter(id => !docIdsForDoc.includes(id));

    expect(docIdsForNurse).toHaveLength(STARTER_SHORTCUTS.length);
    // No id collisions between the two clinicians' sets.
    expect(new Set([...docIdsForDoc, ...docIdsForNurse]).size).toBe(
      docIdsForDoc.length + docIdsForNurse.length,
    );
  });

  test('re-seeding the same user is a no-op — creates nothing and reports zero created', async () => {
    await seedTextShortcutsFor('u-doc');
    const before = { ...store };

    const createdOnSecondRun = await seedTextShortcutsFor('u-doc');

    expect(createdOnSecondRun).toBe(0);
    expect(store).toEqual(before);
  });

  test('does not overwrite a starter phrase the clinician has since edited', async () => {
    await seedTextShortcutsFor('u-doc');
    const [firstId] = Object.keys(store);
    store[firstId] = { ...store[firstId], body: 'Rewritten by the clinician.' };

    await seedTextShortcutsFor('u-doc');

    expect(store[firstId].body).toBe('Rewritten by the clinician.');
  });

  test('a 409 from a racing seed (two mounts writing the same row) is swallowed, not thrown', async () => {
    shortcutsDb.put.mockRejectedValueOnce(Object.assign(new Error('conflict'), { status: 409 }));
    await expect(seedTextShortcutsFor('u-doc')).resolves.toBeDefined();
  });

  test('a non-409 write failure is a real failure and propagates', async () => {
    shortcutsDb.put.mockRejectedValueOnce(new Error('disk full'));
    await expect(seedTextShortcutsFor('u-doc')).rejects.toThrow('disk full');
  });
});

describe('STARTER_SHORTCUTS integrity', () => {
  test('every starter phrase has a unique key', () => {
    const keys = STARTER_SHORTCUTS.map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every starter phrase has real name and body text', () => {
    for (const s of STARTER_SHORTCUTS) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });
});
