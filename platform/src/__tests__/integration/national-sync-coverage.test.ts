/**
 * National sync coverage guard.
 *
 * Data flow: facility PouchDB ──replicate──▶ CouchDB ──sync-worker──▶
 *            POST /api/sync ──▶ PostgreSQL (national analytics) ──▶ government dashboards.
 *
 * These tests fail the build if that chain ever develops a hole — i.e. a data
 * type that lives at a hospital but never reaches the national level. They
 * assert three invariants:
 *
 *   1. Every database registered for sync (DATABASE_SYNC_CONFIGS) either has a
 *      national PostgreSQL writeback (DB_TABLE_MAP in /api/sync/route.ts) or is
 *      one of the explicitly-documented exclusions.
 *   2. Every facility database declared in lib/db.ts is registered for sync
 *      (so nothing stays trapped in browser storage).
 *   3. The sync-worker's hardcoded fallback DB list covers every nationally-
 *      synced database (so national writeback still works if the worker can't
 *      read the platform source at runtime).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DATABASE_SYNC_CONFIGS } from '@/lib/sync/sync-config';

// Databases that intentionally do NOT flow to the national analytics store.
// Keep this list in lock-step with the "Coverage matrix" comment at the top of
// platform/src/app/api/sync/route.ts.
const NATIONAL_SYNC_EXCLUSIONS = new Set<string>([
  'tamamhealth_users',                 // identity / PII — served via /api/users
  'tamamhealth_platform_config',       // server-pushed config, not data
  'tamamhealth_sync_events',           // sync infrastructure (ephemeral)
  'tamamhealth_conflict_queue',        // sync infrastructure (per-client)
  'tamamhealth_saved_payment_methods', // PCI tokens — never leave the clinic
  'tamamhealth_availability',          // provider booking windows — facility-operational, not national analytics
  'tamamhealth_announcements',         // staff notices — facility-operational, not national analytics
]);

// Local-only databases that never participate in sync at all.
const LOCAL_ONLY_DBS = new Set<string>([
  'tamamhealth_meta', // local sync cursors / device metadata
]);

const repoRoot = process.cwd();

function readSource(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

/** Extract the `tamamhealth_*` keys of the DB_TABLE_MAP object literal. */
function extractDbTableMapKeys(): string[] {
  const src = readSource('src/app/api/sync/route.ts');
  const block = src.match(/DB_TABLE_MAP[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('Could not locate DB_TABLE_MAP in /api/sync/route.ts');
  return [...block[1].matchAll(/(tamamhealth_[a-z0-9_]+)\s*:/g)].map((m) => m[1]);
}

/** Every distinct `tamamhealth_*` database name referenced in lib/db.ts. */
function extractDbRegistryNames(): Set<string> {
  const src = readSource('src/lib/db.ts');
  return new Set([...src.matchAll(/tamamhealth_[a-z0-9_]+/g)].map((m) => m[0]));
}

/** The sync-worker's hardcoded FALLBACK_DBS list. */
function extractWorkerFallbackDbs(): string[] {
  const src = readSource('../sync-worker/index.mjs');
  const block = src.match(/FALLBACK_DBS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (!block) throw new Error('Could not locate FALLBACK_DBS in sync-worker/index.mjs');
  return [...block[1].matchAll(/'(tamamhealth_[a-z0-9_]+)'/g)].map((m) => m[1]);
}

describe('national sync coverage', () => {
  const dbTableMapKeys = new Set(extractDbTableMapKeys());
  const syncConfigDbs = DATABASE_SYNC_CONFIGS.map((c) => c.localName);

  test('every synced database reaches the national level (or is a documented exclusion)', () => {
    const orphans = syncConfigDbs.filter(
      (db) => !dbTableMapKeys.has(db) && !NATIONAL_SYNC_EXCLUSIONS.has(db),
    );
    expect(orphans).toEqual([]);
  });

  test('every national writeback target corresponds to a real synced database', () => {
    const configured = new Set(syncConfigDbs);
    const dangling = [...dbTableMapKeys].filter((db) => !configured.has(db));
    expect(dangling).toEqual([]);
  });

  test('every facility database in lib/db.ts is registered for sync', () => {
    const configured = new Set(syncConfigDbs);
    const unsynced = [...extractDbRegistryNames()].filter(
      (db) => !configured.has(db) && !LOCAL_ONLY_DBS.has(db),
    );
    expect(unsynced).toEqual([]);
  });

  test('exclusions are real databases, not typos', () => {
    const configured = new Set(syncConfigDbs);
    for (const db of NATIONAL_SYNC_EXCLUSIONS) {
      expect(configured.has(db)).toBe(true);
    }
  });

  test('sync-worker fallback list covers every nationally-synced database', () => {
    const fallback = new Set(extractWorkerFallbackDbs());
    const missing = [...dbTableMapKeys].filter((db) => !fallback.has(db));
    expect(missing).toEqual([]);
  });
});
