/**
 * Security test for the SQL identifier allowlist in lib/db/postgres.ts.
 *
 * These guard against the regression where a poisoned CouchDB doc could
 * inject arbitrary SQL via table or column names into upsertDocument /
 * deleteDocument (pg cannot parameterize identifiers, so we have to reject
 * anything outside the allowlist).
 */

// Mock the 'pg' Pool so we don't need a real database.
jest.mock('pg', () => {
  class FakePool {
    connect() {
      return Promise.resolve({
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn(),
      });
    }
    on() {}
  }
  return { Pool: FakePool };
});

// DATABASE_URL must be present or getPool() throws.
process.env.DATABASE_URL = 'postgres://test';

import { upsertDocument, deleteDocument } from '@/lib/db/postgres';

describe('SQL identifier allowlist', () => {
  it('accepts a known table + known columns', async () => {
    // upsertDocument now returns an UpsertResult — a known table + known
    // columns must resolve cleanly, regardless of whether the mocked rowCount
    // claims a row was written.
    await expect(
      upsertDocument('patients', 'pat-1', {
        id: 'pat-1',
        name: 'Test',
        gender: 'Female',
      })
    ).resolves.toEqual(expect.objectContaining({ policy: expect.any(String) }));
  });

  it('rejects an unknown table', async () => {
    await expect(
      upsertDocument('evil_table', 'x', { id: 'x' })
    ).rejects.toThrow(/allowlist/);
  });

  it('rejects SQL-injection payload in table name', async () => {
    await expect(
      upsertDocument('patients; DROP TABLE patients;--', 'x', { id: 'x' })
    ).rejects.toThrow();
  });

  it('rejects an unknown column', async () => {
    await expect(
      upsertDocument('patients', 'pat-2', {
        id: 'pat-2',
        evil_column: 'x',
      })
    ).rejects.toThrow(/allowlist/);
  });

  it('rejects column name with SQL payload', async () => {
    await expect(
      upsertDocument('patients', 'pat-3', {
        id: 'pat-3',
        'name) VALUES (0);--': 'x',
      })
    ).rejects.toThrow();
  });

  it('rejects uppercase / mixed-case identifiers', async () => {
    await expect(
      upsertDocument('Patients', 'pat-4', { id: 'pat-4' })
    ).rejects.toThrow();
  });

  it('deleteDocument rejects unknown table', async () => {
    await expect(deleteDocument('evil', 'x')).rejects.toThrow();
  });

  it('deleteDocument accepts known table', async () => {
    await expect(deleteDocument('patients', 'x')).resolves.toBeUndefined();
  });
});
