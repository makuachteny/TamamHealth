/**
 * Tests for the Postgres migration runner.
 *
 * Uses an in-memory mock of `pg.Pool` so we can assert the runner's logic
 * (advisory lock, tracking-table writes, hash-based idempotency) without
 * needing a live Postgres. The mock is just thorough enough to hold rows
 * for the `_migrations` table.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { runMigrations } from '@/lib/db/migrate';

interface MockPoolHandle {
  pool: import('pg').Pool;
  rows: { version: string; name: string; hash: string }[];
  /** Every SQL string passed to `client.query`, in order. */
  queries: string[];
  /** Override one statement's response — useful for forcing failures. */
  failOn?: { fragment: string; error: Error };
}

function buildMockPool(): MockPoolHandle {
  const rows: MockPoolHandle['rows'] = [];
  const queries: string[] = [];
  const handle: MockPoolHandle = { pool: undefined as unknown as import('pg').Pool, rows, queries };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      queries.push(text);
      if (handle.failOn && text.includes(handle.failOn.fragment)) {
        throw handle.failOn.error;
      }
      const norm = text.replace(/\s+/g, ' ').trim();

      if (/^CREATE TABLE IF NOT EXISTS _migrations/i.test(norm)) {
        return { rows: [], rowCount: 0 };
      }
      if (/^SELECT version, name, hash FROM _migrations/i.test(norm)) {
        return { rows: [...rows], rowCount: rows.length };
      }
      if (/^INSERT INTO _migrations/i.test(norm)) {
        const [version, name, hash] = (params ?? []) as [string, string, string];
        rows.push({ version, name, hash });
        return { rows: [], rowCount: 1 };
      }
      if (/^SELECT pg_advisory_lock|^SELECT pg_advisory_unlock/i.test(norm)) {
        return { rows: [], rowCount: 0 };
      }
      if (/^BEGIN$|^COMMIT$|^ROLLBACK$/i.test(norm)) {
        return { rows: [], rowCount: 0 };
      }
      // Migration body — assume success.
      return { rows: [], rowCount: 0 };
    }),
    release: jest.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool: any = {
    connect: jest.fn(async () => client),
    end: jest.fn(async () => undefined),
    on: jest.fn(),
  };
  handle.pool = pool;
  return handle;
}

async function makeMigrationsDir(files: { name: string; body: string }[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tamam-migrate-'));
  for (const f of files) {
    await fs.writeFile(path.join(dir, f.name), f.body, 'utf8');
  }
  return dir;
}

describe('runMigrations', () => {
  const log = jest.fn();

  beforeEach(() => {
    log.mockClear();
  });

  it('applies a fresh migration and records it', async () => {
    const dir = await makeMigrationsDir([
      { name: '0001_first.sql', body: 'CREATE TABLE foo (id TEXT PRIMARY KEY);' },
    ]);
    const handle = buildMockPool();

    const summary = await runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log });

    expect(summary.applied).toEqual(['0001']);
    expect(summary.skipped).toEqual([]);
    expect(handle.rows).toHaveLength(1);
    expect(handle.rows[0].name).toBe('0001_first.sql');
    expect(handle.queries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('pg_advisory_lock'),
        expect.stringContaining('CREATE TABLE foo'),
        expect.stringContaining('INSERT INTO _migrations'),
        expect.stringContaining('pg_advisory_unlock'),
      ]),
    );
  });

  it('is idempotent — second run skips already-applied migrations', async () => {
    const dir = await makeMigrationsDir([
      { name: '0001_first.sql', body: 'CREATE TABLE foo (id TEXT PRIMARY KEY);' },
      { name: '0002_second.sql', body: 'CREATE TABLE bar (id TEXT PRIMARY KEY);' },
    ]);
    const handle = buildMockPool();

    const first = await runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log });
    expect(first.applied).toEqual(['0001', '0002']);

    const second = await runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log });
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(['0001', '0002']);
    expect(handle.rows).toHaveLength(2);
  });

  it('refuses to run if an applied migration was edited after the fact', async () => {
    const dir = await makeMigrationsDir([
      { name: '0001_first.sql', body: 'CREATE TABLE foo (id TEXT PRIMARY KEY);' },
    ]);
    const handle = buildMockPool();
    await runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log });

    // Edit the file after it was applied — runner should detect the hash drift.
    await fs.writeFile(
      path.join(dir, '0001_first.sql'),
      'CREATE TABLE foo (id TEXT PRIMARY KEY, extra TEXT);',
      'utf8',
    );

    await expect(
      runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log }),
    ).rejects.toThrow(/different hash/);
  });

  it('rolls back when a migration body fails', async () => {
    const dir = await makeMigrationsDir([
      { name: '0001_first.sql', body: 'CREATE TABLE will_fail (id TEXT PRIMARY KEY);' },
    ]);
    const handle = buildMockPool();
    handle.failOn = { fragment: 'will_fail', error: new Error('boom') };

    await expect(
      runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log }),
    ).rejects.toThrow(/boom/);

    expect(handle.rows).toHaveLength(0);
    expect(handle.queries).toEqual(expect.arrayContaining([expect.stringMatching(/^ROLLBACK$/)]));
    // Lock must still be released even on failure.
    expect(handle.queries.filter((q) => q.includes('pg_advisory_unlock'))).toHaveLength(1);
  });

  it('rejects duplicate migration version prefixes', async () => {
    const dir = await makeMigrationsDir([
      { name: '0001_first.sql', body: 'SELECT 1;' },
      { name: '0001_dupe.sql', body: 'SELECT 2;' },
    ]);
    const handle = buildMockPool();
    await expect(
      runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log }),
    ).rejects.toThrow(/duplicate migration version/);
  });

  it('ignores files that do not match the NNNN_name.sql pattern', async () => {
    const dir = await makeMigrationsDir([
      { name: '0001_first.sql', body: 'SELECT 1;' },
      { name: 'README.md', body: '# notes' },
      { name: 'wip.sql', body: 'SELECT 99;' },
    ]);
    const handle = buildMockPool();
    const summary = await runMigrations({ pool: handle.pool, migrationsDir: dir, logger: log });
    expect(summary.applied).toEqual(['0001']);
  });
});
