/**
 * Text shortcuts — the "dot phrase" picker behind a section's Text Shortcut
 * button.
 *
 * These tests exist to prove:
 *   - visibility is mine-or-shared, never section-filtered — a shortcut tagged
 *     for one section must still show up when editing another;
 *   - ranking puts the current section's own phrases first without hiding the
 *     rest, then falls back to use-count, then recency, then name;
 *   - a shortcut is never lost or corrupted by the create/update/use/delete
 *     cycle.
 *
 * Follows the note-service test's convention: an in-memory fake DB rather than
 * a mock returning fixed values, so ranking and persistence are checked
 * against the real stored documents.
 */
import {
  getTextShortcuts, getTextShortcutById, saveTextShortcut, bumpShortcutUse,
  deleteTextShortcut, applyShortcut,
} from '@/lib/clinical-notes/text-shortcut-service';
import type { TextShortcutDoc } from '@/lib/clinical-notes/types';

let store: Record<string, TextShortcutDoc> = {};

const shortcutsDb = {
  get: jest.fn(async (id: string) => {
    if (!store[id]) throw Object.assign(new Error('missing'), { status: 404 });
    return { ...store[id] };
  }),
  put: jest.fn(async (doc: TextShortcutDoc) => {
    store[doc._id] = { ...doc, _rev: `${Number((doc._rev || '0-x').split('-')[0]) + 1}-r` };
    return { rev: store[doc._id]._rev, id: doc._id };
  }),
  remove: jest.fn(async (doc: { _id: string }) => {
    delete store[doc._id];
    return { ok: true };
  }),
};

jest.mock('@/lib/db', () => ({ getDB: () => shortcutsDb }));

jest.mock('@/lib/services/db-query', () => ({
  findByType: jest.fn(async () => Object.values(store)),
}));

jest.mock('@/lib/services/audit-service', () => ({
  logAudit: jest.fn(async () => undefined),
  logAuditSafe: jest.fn(async () => undefined),
}));

beforeEach(() => {
  store = {};
  jest.clearAllMocks();
});

function seedDoc(over: Partial<TextShortcutDoc>): TextShortcutDoc {
  const doc: TextShortcutDoc = {
    _id: over._id || `shortcut-${Math.random().toString(36).slice(2, 8)}`,
    type: 'text_shortcut',
    userId: 'u-doc',
    name: 'Headache',
    body: 'Patient presents with a headache.',
    useCount: 0,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  };
  store[doc._id] = doc;
  return doc;
}

describe('saveTextShortcut', () => {
  test('creates a new shortcut owned by the caller', async () => {
    const saved = await saveTextShortcut({ userId: 'u-doc', name: 'Headache', body: 'Text here.' });
    expect(saved.userId).toBe('u-doc');
    expect(saved.name).toBe('Headache');
    expect(saved.body).toBe('Text here.');
    expect(saved.useCount).toBe(0);
    expect(saved.shared).toBe(false);
  });

  test('trims the name and body', async () => {
    const saved = await saveTextShortcut({ userId: 'u-doc', name: '  Fever  ', body: '  Text.  ' });
    expect(saved.name).toBe('Fever');
    expect(saved.body).toBe('Text.');
  });

  test('rejects an empty name', async () => {
    await expect(saveTextShortcut({ userId: 'u-doc', name: '   ', body: 'Text.' }))
      .rejects.toThrow(/needs a name/i);
  });

  test('rejects empty body text', async () => {
    await expect(saveTextShortcut({ userId: 'u-doc', name: 'Fever', body: '   ' }))
      .rejects.toThrow(/needs body text/i);
  });

  test('updates an existing shortcut in place when an id is given', async () => {
    const created = await saveTextShortcut({ userId: 'u-doc', name: 'Headache', body: 'v1' });
    const updated = await saveTextShortcut({
      id: created._id, userId: 'u-doc', name: 'Headache (revised)', body: 'v2',
    });
    expect(updated._id).toBe(created._id);
    expect(updated.body).toBe('v2');
    expect(Object.keys(store)).toHaveLength(1);
  });

  test('a shared shortcut is visible to a colleague in the same org', async () => {
    await saveTextShortcut({
      userId: 'u-doc', name: 'Malaria plan', body: 'RDT then ACT.', shared: true, orgId: 'org-1',
    });
    const rows = await getTextShortcuts({ userId: 'u-nurse', orgId: 'org-1' });
    expect(rows.map(r => r.name)).toContain('Malaria plan');
  });
});

describe('getTextShortcutById', () => {
  test('fetches by id', async () => {
    const created = await saveTextShortcut({ userId: 'u-doc', name: 'Headache', body: 'x' });
    const found = await getTextShortcutById(created._id);
    expect(found?.name).toBe('Headache');
  });

  test('returns null for an id that does not exist', async () => {
    expect(await getTextShortcutById('nope')).toBeNull();
  });
});

describe('getTextShortcuts — visibility', () => {
  test("a clinician sees their own shortcuts", async () => {
    seedDoc({ _id: 's-mine', userId: 'u-doc', name: 'Mine' });
    seedDoc({ _id: 's-other', userId: 'u-other', name: 'Not mine', shared: false });

    const rows = await getTextShortcuts({ userId: 'u-doc' });
    expect(rows.map(r => r.name)).toEqual(['Mine']);
  });

  test('an unshared colleague shortcut is invisible', async () => {
    seedDoc({ _id: 's-other', userId: 'u-other', name: 'Private', shared: false });
    const rows = await getTextShortcuts({ userId: 'u-doc' });
    expect(rows).toHaveLength(0);
  });

  test('a shared shortcut from a DIFFERENT org is not shown when the caller has an orgId', async () => {
    seedDoc({ _id: 's-other', userId: 'u-other', name: 'Other org', shared: true, orgId: 'org-2' });
    const rows = await getTextShortcuts({ userId: 'u-doc', orgId: 'org-1' });
    expect(rows).toHaveLength(0);
  });

  test('a shared shortcut with no orgId at all is still visible — legacy data is not hidden', async () => {
    seedDoc({ _id: 's-legacy', userId: 'u-other', name: 'Legacy shared', shared: true, orgId: undefined });
    const rows = await getTextShortcuts({ userId: 'u-doc', orgId: 'org-1' });
    expect(rows.map(r => r.name)).toContain('Legacy shared');
  });

  test(
    'section no longer hides a shortcut tagged for a different section — it only reorders',
    async () => {
      seedDoc({ _id: 's-plan', userId: 'u-doc', name: 'Malaria plan', sectionId: 'plan' });
      const rows = await getTextShortcuts({ userId: 'u-doc', sectionId: 'subjective' });
      expect(rows.map(r => r.name)).toContain('Malaria plan');
    },
  );

  test('a section match is ranked ahead of everything else, without hiding the rest', async () => {
    seedDoc({ _id: 's-cc', userId: 'u-doc', name: 'CC phrase', sectionId: 'cc', useCount: 50 });
    seedDoc({ _id: 's-plan', userId: 'u-doc', name: 'Plan phrase', sectionId: 'plan', useCount: 1 });
    const rows = await getTextShortcuts({ userId: 'u-doc', sectionId: 'plan' });
    expect(rows.map(r => r.name)).toEqual(['Plan phrase', 'CC phrase']);
  });

  test('within the same rank tier, higher use count sorts first', async () => {
    seedDoc({ _id: 's-a', userId: 'u-doc', name: 'A', useCount: 1 });
    seedDoc({ _id: 's-b', userId: 'u-doc', name: 'B', useCount: 9 });
    const rows = await getTextShortcuts({ userId: 'u-doc' });
    expect(rows.map(r => r.name)).toEqual(['B', 'A']);
  });

  test('a tie on use count breaks by most-recently-used', async () => {
    seedDoc({ _id: 's-a', userId: 'u-doc', name: 'A', useCount: 3, lastUsedAt: '2026-08-01T00:00:00Z' });
    seedDoc({ _id: 's-b', userId: 'u-doc', name: 'B', useCount: 3, lastUsedAt: '2026-08-03T00:00:00Z' });
    const rows = await getTextShortcuts({ userId: 'u-doc' });
    expect(rows.map(r => r.name)).toEqual(['B', 'A']);
  });

  test('a full tie breaks alphabetically by name — deterministic ordering', async () => {
    seedDoc({ _id: 's-z', userId: 'u-doc', name: 'Zebra' });
    seedDoc({ _id: 's-a', userId: 'u-doc', name: 'Apple' });
    const rows = await getTextShortcuts({ userId: 'u-doc' });
    expect(rows.map(r => r.name)).toEqual(['Apple', 'Zebra']);
  });

  test('search matches name or body text, case-insensitively', async () => {
    seedDoc({ _id: 's-a', userId: 'u-doc', name: 'Headache', body: 'Frontal headache, throbbing.' });
    seedDoc({ _id: 's-b', userId: 'u-doc', name: 'Fever', body: 'Chills and rigors.' });
    const rows = await getTextShortcuts({ userId: 'u-doc', search: 'THROBBING' });
    expect(rows.map(r => r.name)).toEqual(['Headache']);
  });

  test('limit truncates the ranked list without changing the order', async () => {
    seedDoc({ _id: 's-a', userId: 'u-doc', name: 'A', useCount: 5 });
    seedDoc({ _id: 's-b', userId: 'u-doc', name: 'B', useCount: 3 });
    seedDoc({ _id: 's-c', userId: 'u-doc', name: 'C', useCount: 1 });
    const rows = await getTextShortcuts({ userId: 'u-doc', limit: 2 });
    expect(rows.map(r => r.name)).toEqual(['A', 'B']);
  });
});

describe('bumpShortcutUse', () => {
  test('increments the counter and records lastUsedAt', async () => {
    const created = await saveTextShortcut({ userId: 'u-doc', name: 'Headache', body: 'x' });
    await bumpShortcutUse(created._id);
    const after = await getTextShortcutById(created._id);
    expect(after?.useCount).toBe(1);
    expect(after?.lastUsedAt).toBeTruthy();
  });

  test('is a no-op (never throws) for a shortcut id that does not exist', async () => {
    await expect(bumpShortcutUse('nope')).resolves.toBeUndefined();
  });
});

describe('deleteTextShortcut', () => {
  test('deletes an existing shortcut', async () => {
    const created = await saveTextShortcut({ userId: 'u-doc', name: 'Headache', body: 'x' });
    expect(await deleteTextShortcut(created._id)).toBe(true);
    expect(await getTextShortcutById(created._id)).toBeNull();
  });

  test('returns false for a shortcut id that does not exist, rather than throwing', async () => {
    expect(await deleteTextShortcut('nope')).toBe(false);
  });
});

describe('applyShortcut', () => {
  test('inserts the phrase into empty text', () => {
    expect(applyShortcut('', 'Patient presents with a headache.')).toBe('Patient presents with a headache.');
  });

  test('appends after existing text with a blank line between, rather than replacing it', () => {
    expect(applyShortcut('Seen with her daughter.', 'Headache for two days.')).toBe(
      'Seen with her daughter.\n\nHeadache for two days.',
    );
  });

  test('trims trailing whitespace from the existing text before appending', () => {
    expect(applyShortcut('Existing text.   \n\n', 'More.')).toBe('Existing text.\n\nMore.');
  });

  test('an empty shortcut body leaves the existing text untouched', () => {
    expect(applyShortcut('Existing text.', '   ')).toBe('Existing text.');
  });
});
