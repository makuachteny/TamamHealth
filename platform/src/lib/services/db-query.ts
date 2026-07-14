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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any;

// db name -> set of "field1,field2" index keys already created this process.
const created = new Map<string, Set<string>>();

function dbName(db: AnyDB): string {
  return (db as { name?: string }).name || 'unknown';
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
  await ensureIndex(db, options.indexFields ?? ['type']);
  const res = (await db.find({
    selector: { type, ...extraSelector },
    limit: options.limit ?? 100_000,
  })) as { docs: T[] };
  return (res.docs || []) as T[];
}
