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
 *   2. Every facility database opened anywhere under src/ (via getDB(), not
 *      just in lib/db.ts) is registered for sync (so nothing stays trapped
 *      in browser storage).
 *   3. The sync-worker's hardcoded fallback DB list covers every nationally-
 *      synced database (so national writeback still works if the worker can't
 *      read the platform source at runtime).
 */

import { readFileSync, readdirSync } from 'node:fs';
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
  'tamamhealth_conversations',         // internal staff chat — facility-operational PHI, not national analytics
  'tamamhealth_patient_notes',         // internal clinical notes — facility-operational PHI, not national analytics
  'tamamhealth_encounters',            // in-progress consultation workflow state — facility-operational, not national analytics
  'tamamhealth_consultation_progress', // shared consultation tracker — facility-operational, not national analytics
  'tamamhealth_handoffs',              // nurse shift handoffs (SBAR) — facility-operational PHI, not national analytics
  'tamamhealth_biometric_templates',   // biometric identifiers — in-org identification only, never national
  'tamamhealth_order_sets',            // clinical protocol templates — org-scoped reference data, not national analytics
  'tamamhealth_phone_notes',           // patient call notes / callbacks — facility-operational PHI, not national analytics
  'tamamhealth_assessments',           // scored intake/outcome-measure forms — facility-operational PHI, not national analytics
  'tamamhealth_clinical_favorites',    // per-clinician picker shortcuts — personal/operational preference data, not national analytics
  'tamamhealth_consultation_templates', // clinician-saved consultation bundles — personal/operational templates, not national analytics
  'tamamhealth_clinician_tasks',       // per-clinician personal to-dos — personal/operational data, not national analytics
  'tamamhealth_patient_documents',     // scanned chart documents (films, letters, IDs) — facility-operational PHI blobs, not national analytics
  'tamamhealth_patient_reminders',     // queued patient reminders — facility-operational, not national analytics
  'tamamhealth_intake_forms',          // patient-submitted intake forms awaiting review/merge — facility-operational workflow, not national analytics
  'tamamhealth_procedures',            // bedside/theatre procedures — facility-operational clinical detail, not a national/DHIS2 indicator today
  'tamamhealth_nutrition_supplies',    // facility supply stock levels (RUTF/F-75/…) — facility-operational logistics, not national analytics
  'tamamhealth_patient_transfers',     // internal care-ownership transfers — facility-operational staffing detail naming individual clinicians; cross-facility movement flows via tamamhealth_referrals
  'tamamhealth_clinical_notes',        // clinical-notes module (SOAP/H&P/consult/etc.) — facility-operational PHI narrative, not national analytics
  'tamamhealth_text_shortcuts',        // per-clinician "dot phrase" shortcuts for the notes module — personal/operational preference data, not national analytics
  'tamamhealth_facility_census',       // per-facility periodic census submissions — facility-operational reporting, not (yet) wired to a national analytics table
  'tamamhealth_visit_reasons',         // a practice's own bookable service menu — facility configuration, not national analytics
  'tamamhealth_booking_policies',      // per-facility online-booking rules (lead time, consent wording) — facility configuration, not national analytics
  'tamamhealth_provider_profiles',     // public-facing clinician profiles (photo, bio, slug) — facility marketing content, not national analytics
  'tamamhealth_provider_reviews',      // patient reviews of a clinician — facility reputation content, not a national health indicator
  // (tamamhealth_nutrition_screenings is NOT excluded — SAM/MAM now writes back
  //  to the `nutrition_screenings` national table via DB_TABLE_MAP + mapper.
  //  tamamhealth_program_enrollments is NOT excluded either — ART/TB/PMTCT/
  //  ANC/Nutrition/EPI/NCD enrollment writes back to `program_enrollments`.)
]);

// Local-only databases that never participate in sync at all.
const LOCAL_ONLY_DBS = new Set<string>([
  'tamamhealth_meta', // local sync cursors / device metadata
  'tamamhealth_usage_events', // facility analytics; not part of national sync
  // Ten-minute claims on a booking slot, written and read by the server while a
  // patient fills in the form. Replicating them to every clinician's browser
  // would be pure churn for documents that are gone before they arrive.
  'tamamhealth_slot_holds',
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

// Directories whose contents are never a database *declaration* — either
// build output, or test code, which legitimately opens scratch/fixture
// databases (see tamamhealth_test_counter in doc-counter.test.ts) that must
// never be mistaken for a real facility database needing sync coverage.
const EXCLUDED_DIR_NAMES = new Set(['node_modules', '__tests__', '.next']);

/** Recursively list every .ts/.tsx source file under `dir`, tests excluded. */
function listSourceFiles(dir: string): string[] {
  const absDir = path.join(repoRoot, dir);
  const files: string[] = [];
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(rel));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      files.push(rel);
    }
  }
  return files;
}

/**
 * Every distinct `tamamhealth_*` database name opened anywhere under `src/`
 * via `getDB('tamamhealth_...')`, excluding tests.
 *
 * Scans the whole tree rather than just lib/db.ts: a database accessor
 * declared in its own module (e.g. `clinicalNotesDB` in
 * lib/clinical-notes/note-service.ts) is exactly as real a database as one
 * declared in db.ts, and must be just as covered by this guard. Scoping to
 * db.ts alone let tamamhealth_clinical_notes, tamamhealth_text_shortcuts and
 * tamamhealth_facility_census go undetected — each declared its own getDB()
 * call outside db.ts and was never registered for sync.
 */
function extractDbRegistryNames(): Set<string> {
  const names = new Set<string>();
  for (const rel of listSourceFiles('src')) {
    const src = readSource(rel);
    for (const m of src.matchAll(/getDB\(\s*['"](tamamhealth_[a-z0-9_]+)['"]\s*\)/g)) {
      names.add(m[1]);
    }
  }
  return names;
}

/** The sync-worker's hardcoded FALLBACK_DBS list. */
function extractWorkerFallbackDbs(): string[] {
  const src = readSource('../sync-worker/index.mjs');
  const block = src.match(/FALLBACK_DBS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (!block) throw new Error('Could not locate FALLBACK_DBS in sync-worker/index.mjs');
  return [...block[1].matchAll(/'(tamamhealth_[a-z0-9_]+)'/g)].map((m) => m[1]);
}

/** Top-level keys of the FIELD_MAPPERS object in /api/sync/route.ts. */
function extractFieldMapperKeys(): Set<string> {
  const src = readSource('src/app/api/sync/route.ts');
  const block = src.match(/FIELD_MAPPERS[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('Could not locate FIELD_MAPPERS in /api/sync/route.ts');
  // Match `name: (doc) => ({` entries at the start of a line.
  return new Set([...block[1].matchAll(/^\s{2}([a-z_]+):\s*\(doc\)/gm)].map((m) => m[1]));
}

/** The WARDS_DB_TABLES type→table map in /api/sync/route.ts. */
function extractWardsDbTables(): Record<string, string> {
  const src = readSource('src/app/api/sync/route.ts');
  const block = src.match(/const WARDS_DB_TABLES[^{]*\{([\s\S]*?)\};/);
  if (!block) throw new Error('Could not locate WARDS_DB_TABLES in /api/sync/route.ts');
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/(\w+):\s*'([a-z_]+)'/g)) out[m[1]] = m[2];
  return out;
}

/** The Postgres `ALLOWED_TABLES` SQL-injection allowlist in lib/db/postgres.ts. */
function extractAllowedTables(): Set<string> {
  const src = readSource('src/lib/db/postgres.ts');
  const block = src.match(/const ALLOWED_TABLES = new Set<string>\(\[([\s\S]*?)\]\);/);
  if (!block) throw new Error('Could not locate ALLOWED_TABLES in lib/db/postgres.ts');
  return new Set([...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
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

  test('every facility database opened anywhere under src/ is registered for sync', () => {
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

  // The wards database co-locates ward + bed + admission docs. Guard that every
  // one of those types fans out to its own analytics table WITH a field mapper —
  // otherwise inpatient/bed data gets flattened into `wards` (or dropped).
  test('wards multi-type DB fans out each doc type to a mapped national table', () => {
    const wardsTables = extractWardsDbTables();
    const mapperKeys = extractFieldMapperKeys();
    for (const type of ['ward', 'bed', 'admission']) {
      const table = wardsTables[type];
      expect(table).toBeTruthy();
      expect(mapperKeys.has(table)).toBe(true);
    }
  });

  // Regression guard: every table a FIELD_MAPPER writes to MUST be in the
  // Postgres `ALLOWED_TABLES` allowlist, or `assertSafeTable` throws on every
  // upsert and the sync-worker silently drops those docs (this is exactly how
  // beds/admissions writeback was dead for a release — mapper + migration
  // existed, allowlist didn't). Catches the whole class at build time.
  test('every national writeback target table is in the Postgres ALLOWED_TABLES guard', () => {
    const allowed = extractAllowedTables();
    const targets = [
      ...extractFieldMapperKeys(),
      ...Object.values(extractWardsDbTables()),
    ];
    const unlisted = targets.filter((t) => !allowed.has(t));
    expect(unlisted).toEqual([]);
  });
});
