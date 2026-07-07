/**
 * Shared indexed-query helpers.
 *
 * Replaces the `allDocs({ include_docs: true })` + JS `.filter(d => d.type ===
 * …)` pattern (a full database scan streamed into memory) with a Mango `find()`
 * scoped by document `type`. The backing index is created once per process per
 * database. If the index can't be created (older CouchDB / view conflict),
 * PouchDB's `find()` falls back to an in-memory scan, so callers always get
 * correct results — they just lose the speed-up.
 *
 * `pouchdb-find` is registered by `loadPouchDB()` in src/lib/db.ts for both the
 * browser and server runtimes, so `createIndex`/`find` are always available.
 */

import { clearDBCache, getDB } from '../db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any;

// db name -> set of "field1,field2" index keys already created this process.
const created = new Map<string, Set<string>>();

function dbName(db: AnyDB): string {
  return (db as { name?: string }).name || 'unknown';
}

function isClosingConnectionError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name || '';
  const message = (err as { message?: string } | null)?.message || '';
  return /InvalidStateError|database connection is closing|database is closing|database is closed/i.test(`${name} ${message}`);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFind<T>(db: AnyDB, type: string, extraSelector: Record<string, unknown>, limit: number): Promise<T[]> {
  const res = (await db.find({
    selector: { type, ...extraSelector },
    limit,
  })) as { docs: T[] };
  return (res.docs || []) as T[];
}

/** Idempotently create a Mango index on the given fields (once per process/DB). */
export async function ensureIndex(db: AnyDB, fields: string[]): Promise<void> {
  const name = dbName(db);
  let set = created.get(name);
  if (!set) {
    set = new Set<string>();
    created.set(name, set);
  }
  const key = fields.join(',');
  if (set.has(key)) return;
  try {
    await db.createIndex({ index: { fields } });
  } catch {
    // Index unavailable — find() will scan. Cache so we don't retry each call.
  }
  set.add(key);
}

/**
 * Return all docs of a given `type` in `db`, optionally narrowed by an extra
 * selector. Uses an indexed Mango query instead of a full-DB scan.
 */
export async function findByType<T>(
  db: AnyDB,
  type: string,
  extraSelector: Record<string, unknown> = {},
  options: { limit?: number; indexFields?: string[] } = {},
): Promise<T[]> {
  const name = dbName(db);
  const indexFields = options.indexFields ?? ['type'];
  const limit = options.limit ?? 100_000;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const activeDb = attempt === 0 ? db : getDB(name);
      await ensureIndex(activeDb, indexFields);
      return await runFind<T>(activeDb, type, extraSelector, limit);
    } catch (err) {
      if (!isClosingConnectionError(err)) throw err;

      // The DB is being torn down or reopened. Drop the cached handle + index
      // memo, then retry briefly against a fresh instance. If the app is in
      // logout/reseed teardown, the caller can safely treat this as an empty
      // result set instead of surfacing a noisy console error.
      created.delete(name);
      clearDBCache(name);

      if (attempt < 2) {
        await delay(25 * (attempt + 1));
        continue;
      }
      return [];
    }
  }

  return [];
}
