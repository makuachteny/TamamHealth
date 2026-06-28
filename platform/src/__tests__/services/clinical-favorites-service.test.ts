/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for clinical-favorites-service.ts — per-clinician one-tap shortcuts.
 */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  addFavorite,
  removeFavorite,
  toggleFavorite,
  isFavorite,
  getFavorites,
  bumpFavoriteUse,
} from '@/lib/services/clinical-favorites-service';

afterEach(async () => { await teardownTestDBs(); });

const base = { userId: 'dr-1', userName: 'Dr One', orgId: 'org-1' } as const;

describe('Clinical favorites service', () => {
  test('adds and reads a favorite', async () => {
    await addFavorite({ ...base, kind: 'diagnosis', code: 'J06.9', label: 'Acute URTI' });
    expect(await isFavorite('dr-1', 'diagnosis', 'J06.9')).toBe(true);
    const list = await getFavorites('dr-1', 'diagnosis');
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Acute URTI');
  });

  test('adding is idempotent (one doc per user+kind+code)', async () => {
    await addFavorite({ ...base, kind: 'medication', code: 'AMOX500', label: 'Amoxicillin 500mg' });
    await addFavorite({ ...base, kind: 'medication', code: 'AMOX500', label: 'Amoxicillin 500mg (caps)' });
    const list = await getFavorites('dr-1', 'medication');
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Amoxicillin 500mg (caps)');
  });

  test('favorites are scoped per user', async () => {
    await addFavorite({ ...base, kind: 'procedure', code: 'PPE', label: 'PPE' });
    expect(await getFavorites('dr-2', 'procedure')).toHaveLength(0);
    expect(await getFavorites('dr-1', 'procedure')).toHaveLength(1);
  });

  test('toggle adds then removes', async () => {
    const on = await toggleFavorite({ ...base, kind: 'diagnosis', code: 'I10', label: 'Hypertension' });
    expect(on).toBe(true);
    expect(await isFavorite('dr-1', 'diagnosis', 'I10')).toBe(true);
    const off = await toggleFavorite({ ...base, kind: 'diagnosis', code: 'I10', label: 'Hypertension' });
    expect(off).toBe(false);
    expect(await isFavorite('dr-1', 'diagnosis', 'I10')).toBe(false);
  });

  test('removeFavorite reports whether it existed', async () => {
    await addFavorite({ ...base, kind: 'diagnosis', code: 'J20', label: 'Acute bronchitis' });
    expect(await removeFavorite('dr-1', 'diagnosis', 'J20')).toBe(true);
    expect(await removeFavorite('dr-1', 'diagnosis', 'J20')).toBe(false);
  });

  test('bumpFavoriteUse orders most-used first and is safe on misses', async () => {
    await addFavorite({ ...base, kind: 'medication', code: 'A', label: 'Drug A' });
    await addFavorite({ ...base, kind: 'medication', code: 'B', label: 'Drug B' });
    await bumpFavoriteUse('dr-1', 'medication', 'B');
    await bumpFavoriteUse('dr-1', 'medication', 'B');
    await bumpFavoriteUse('dr-1', 'medication', 'missing'); // no throw
    const list = await getFavorites('dr-1', 'medication');
    expect(list[0].code).toBe('B');
    expect(list[0].useCount).toBe(2);
  });

  test('getFavorites without kind returns all kinds', async () => {
    await addFavorite({ ...base, kind: 'diagnosis', code: 'J06.9', label: 'URTI' });
    await addFavorite({ ...base, kind: 'medication', code: 'AMOX', label: 'Amox' });
    expect(await getFavorites('dr-1')).toHaveLength(2);
  });
});
