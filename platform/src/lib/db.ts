/**
 * PouchDB database accessors.
 *
 * Two runtime environments, one API:
 *
 * - Browser → `pouchdb-browser` with the IndexedDB backend. Each getDB() call
 *   returns a local PouchDB instance. Clinicians' work is stored offline-first
 *   and replicates to CouchDB via the sync manager when online.
 *
 * - Server (Node) → `pouchdb` with the http adapter, pointed directly at the
 *   shared CouchDB cluster. This lets API routes (`/api/*`) read and write the
 *   same databases that browser clients replicate to, so external consumers
 *   (mobile, integrations, server cron) can use the REST surface without a
 *   browser in the loop.
 *
 * All service functions call the same accessors (usersDB(), patientsDB(),
 * etc.), so nothing above this layer has to care which runtime it's in.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PouchDBCtor = any;
type PouchDatabase = PouchDB.Database;

const IS_BROWSER = typeof window !== 'undefined';

let PouchDBRef: PouchDBCtor | null = null;
const databases: Record<string, PouchDatabase> = {};

function loadPouchDB(): PouchDBCtor {
  if (PouchDBRef) return PouchDBRef;

  if (IS_BROWSER) {
    // Browser path — pouchdb-browser uses IndexedDB and imports browser-only
    // globals at module load, so it must not be evaluated server-side.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PouchDBModule = require('pouchdb-browser');
    const PouchDB = PouchDBModule.default || PouchDBModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PouchDBFindModule = require('pouchdb-find');
    const PouchDBFind = PouchDBFindModule.default || PouchDBFindModule;
    PouchDB.plugin(PouchDBFind);
    PouchDBRef = PouchDB;
  } else {
    // Server path — use pouchdb-core with ONLY the http + mapreduce + find
    // plugins. The full `pouchdb` package bundles leveldb, which needs
    // platform-specific native binaries (they don't exist for every
    // runtime + arch combo the platform gets deployed to). http-only is
    // stateless on our end; all persistence happens in CouchDB.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const coreMod = require('pouchdb-core');
    const PouchDB = coreMod.default || coreMod;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const httpMod = require('pouchdb-adapter-http');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mapReduceMod = require('pouchdb-mapreduce');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const findMod = require('pouchdb-find');
    PouchDB
      .plugin(httpMod.default || httpMod)
      .plugin(mapReduceMod.default || mapReduceMod)
      .plugin(findMod.default || findMod);
    PouchDBRef = PouchDB;
  }
  return PouchDBRef;
}

/**
 * Resolve the server-side CouchDB base URL — credentials are NOT embedded
 * here; they're attached per-request via a fetch override in getDB() so they
 * never end up in cached PouchDB instance URLs or in log lines.
 */
function serverCouchBaseUrl(): string {
  const base =
    process.env.COUCHDB_URL ||
    process.env.NEXT_PUBLIC_COUCHDB_URL ||
    'http://couchdb:5984';
  const user = process.env.COUCHDB_ADMIN_USER || process.env.COUCHDB_USER;
  const pass = process.env.COUCHDB_ADMIN_PASSWORD || process.env.COUCHDB_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      '[db] Server-side CouchDB access requires COUCHDB_ADMIN_USER and ' +
      'COUCHDB_ADMIN_PASSWORD (or COUCHDB_USER / COUCHDB_PASSWORD). Set them ' +
      'in platform/.env.production or the compose root .env before any /api/* ' +
      'route that reads the database is hit.'
    );
  }

  return base.replace(/\/$/, '');
}

/**
 * Computed once at module load: `Basic <base64(user:pass)>` for the server
 * fetch override. Returns null if creds are missing — getDB() will then call
 * serverCouchBaseUrl() which throws the loud config error.
 */
function computeServerAuthHeader(): string | null {
  if (IS_BROWSER) return null;
  const user = process.env.COUCHDB_ADMIN_USER || process.env.COUCHDB_USER;
  const pass = process.env.COUCHDB_ADMIN_PASSWORD || process.env.COUCHDB_PASSWORD;
  if (!user || !pass) return null;
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}
const serverAuthHeader = computeServerAuthHeader();

export function getDB(name: string): PouchDatabase {
  if (!databases[name]) {
    const PouchDB = loadPouchDB();
    if (IS_BROWSER) {
      databases[name] = new PouchDB(name, { auto_compaction: true });
    } else {
      const base = serverCouchBaseUrl();
      const authHeader = serverAuthHeader!; // serverCouchBaseUrl() above already threw if missing
      // skip_setup: false → PouchDB will PUT /<db> on first access if it does
      // not exist. The admin credentials are attached per-request via the
      // fetch override below, so they never appear in the cached PouchDB URL.
      databases[name] = new PouchDB(`${base}/${name}`, {
        skip_setup: false,
        fetch: (url: RequestInfo | URL, opts?: RequestInit) =>
          fetch(url, {
            ...(opts ?? {}),
            headers: { ...(opts?.headers ?? {}), Authorization: authHeader },
          }),
      } as PouchDB.Configuration.RemoteDatabaseConfiguration);
    }
  }
  return databases[name];
}

/**
 * Get a PouchDB instance pointing at the remote CouchDB server (for the
 * browser's sync manager). Returns null if sync is not enabled or called
 * during SSR.
 */
const remoteDatabases: Record<string, PouchDatabase> = {};

export function getRemoteDB(name: string): PouchDatabase | null {
  if (!IS_BROWSER) return null;
  const syncEnabled = process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true';
  const couchdbUrl = process.env.NEXT_PUBLIC_COUCHDB_URL;
  if (!syncEnabled || !couchdbUrl) return null;

  if (!remoteDatabases[name]) {
    const PouchDB = loadPouchDB();
    const url = `${couchdbUrl.replace(/\/+$/, '')}/${name}`;
    remoteDatabases[name] = new PouchDB(url, { skip_setup: true });
  }
  return remoteDatabases[name];
}

// Typed database accessors
export const usersDB = () => getDB('tamamhealth_users');
export const patientsDB = () => getDB('tamamhealth_patients');
export const hospitalsDB = () => getDB('tamamhealth_hospitals');
export const medicalRecordsDB = () => getDB('tamamhealth_medical_records');
export const referralsDB = () => getDB('tamamhealth_referrals');
export const labResultsDB = () => getDB('tamamhealth_lab_results');
export const diseaseAlertsDB = () => getDB('tamamhealth_disease_alerts');
export const prescriptionsDB = () => getDB('tamamhealth_prescriptions');
export const auditLogDB = () => getDB('tamamhealth_audit_log');
export const messagesDB = () => getDB('tamamhealth_messages');
export const conversationsDB = () => getDB('tamamhealth_conversations');
export const patientNotesDB = () => getDB('tamamhealth_patient_notes');
export const birthsDB = () => getDB('tamamhealth_births');
export const deathsDB = () => getDB('tamamhealth_deaths');
export const facilityAssessmentsDB = () => getDB('tamamhealth_facility_assessments');
export const immunizationsDB = () => getDB('tamamhealth_immunizations');
export const ancDB = () => getDB('tamamhealth_anc');
export const followUpsDB = () => getDB('tamamhealth_follow_ups');
export const organizationsDB = () => getDB('tamamhealth_organizations');
export const platformConfigDB = () => getDB('tamamhealth_platform_config');
export const appointmentsDB = () => getDB('tamamhealth_appointments');
export const availabilityDB = () => getDB('tamamhealth_availability');
export const announcementsDB = () => getDB('tamamhealth_announcements');
export const telehealthDB = () => getDB('tamamhealth_telehealth');
export const pharmacyInventoryDB = () => getDB('tamamhealth_pharmacy_inventory');
export const triageDB = () => getDB('tamamhealth_triage');
export const billingDB = () => getDB('tamamhealth_billing');
export const feeScheduleDB = () => getDB('tamamhealth_fee_schedule');
export const wardDB = () => getDB('tamamhealth_wards');
export const staffSchedulesDB = () => getDB('tamamhealth_staff_schedules');
export const bloodBankDB = () => getDB('tamamhealth_blood_bank');
export const emergencyPlansDB = () => getDB('tamamhealth_emergency_plans');
export const assetsDB = () => getDB('tamamhealth_assets');
export const leaveRequestsDB = () => getDB('tamamhealth_leave_requests');
export const payrollEntriesDB = () => getDB('tamamhealth_payroll_entries');
export const controlledSubstanceLogDB = () => getDB('tamamhealth_controlled_substance_log');
export const problemsDB = () => getDB('tamamhealth_problems');
// In-progress / paused clinical encounters (consultation workflow state machine).
export const encountersDB = () => getDB('tamamhealth_encounters');
// Fingerprint minutiae templates (no raw images) — see db-types-biometrics.ts
export const biometricTemplatesDB = () => getDB('tamamhealth_biometric_templates');

// Sync + conflict databases (Phase 1 closeout)
export const syncEventsDB = () => getDB('tamamhealth_sync_events');
export const conflictQueueDB = () => getDB('tamamhealth_conflict_queue');

// Patient Insurance & Payments databases
export const insurancePoliciesDB = () => getDB('tamamhealth_insurance_policies');
export const eligibilityChecksDB = () => getDB('tamamhealth_eligibility_checks');
export const chargesDB = () => getDB('tamamhealth_charges');
export const claimsDB = () => getDB('tamamhealth_claims');
export const adjustmentsDB = () => getDB('tamamhealth_adjustments');
export const paymentsDB = () => getDB('tamamhealth_payments');
export const refundsDB = () => getDB('tamamhealth_refunds');
export const savedPaymentMethodsDB = () => getDB('tamamhealth_saved_payment_methods');
export const paymentPlansDB = () => getDB('tamamhealth_payment_plans');
export const invoicesDB = () => getDB('tamamhealth_invoices');
export const ledgerDB = () => getDB('tamamhealth_ledger');

// Bump this version to force a re-seed (destroys all data and re-creates).
// Bumped to 34: v2 demo deployment flipped to demo mode — force browsers that
// previously seeded in production mode (admin-only) to re-seed the full demo
// dataset (sample patients + the complete user roster).
// Bumped to 37: added today-dated reception walk-ins + appointments so the
// front-desk queue is populated on seed day.
export const SEED_VERSION = 37;

export async function isSeeded(): Promise<boolean> {
  try {
    const db = getDB('tamamhealth_meta');
    const doc = await db.get('seeded') as { version?: number };
    return doc.version === SEED_VERSION;
  } catch {
    return false;
  }
}

export async function markSeeded(): Promise<void> {
  const db = getDB('tamamhealth_meta');
  try {
    // Remove old marker if it exists
    try {
      const existing = await db.get('seeded');
      await db.remove(existing);
    } catch {
      // No existing marker
    }
    await db.put({ _id: 'seeded', version: SEED_VERSION, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e.status === 409) return; // Already marked
    throw err;
  }
}

// Reset all databases (useful for debugging).
// Browser-only: destroying a remote CouchDB database from a server process
// would take out data for every clinic on the cluster.
export async function resetAllDatabases(): Promise<void> {
  if (!IS_BROWSER) return;
  const PouchDB = loadPouchDB();
  const dbNames = [
    'tamamhealth_users', 'tamamhealth_patients', 'tamamhealth_hospitals',
    'tamamhealth_medical_records', 'tamamhealth_referrals', 'tamamhealth_lab_results',
    'tamamhealth_disease_alerts', 'tamamhealth_prescriptions', 'tamamhealth_audit_log', 'tamamhealth_messages', 'tamamhealth_conversations', 'tamamhealth_patient_notes',
    'tamamhealth_births', 'tamamhealth_deaths', 'tamamhealth_facility_assessments',
    'tamamhealth_immunizations', 'tamamhealth_anc', 'tamamhealth_follow_ups',
    'tamamhealth_organizations', 'tamamhealth_platform_config',
    'tamamhealth_appointments', 'tamamhealth_telehealth', 'tamamhealth_pharmacy_inventory',
    'tamamhealth_triage',
    'tamamhealth_billing', 'tamamhealth_fee_schedule', 'tamamhealth_wards',
    'tamamhealth_staff_schedules', 'tamamhealth_blood_bank',
    'tamamhealth_insurance_policies', 'tamamhealth_eligibility_checks', 'tamamhealth_charges',
    'tamamhealth_claims', 'tamamhealth_adjustments', 'tamamhealth_payments', 'tamamhealth_refunds',
    'tamamhealth_saved_payment_methods', 'tamamhealth_payment_plans', 'tamamhealth_invoices', 'tamamhealth_ledger',
    'tamamhealth_sync_events', 'tamamhealth_conflict_queue',
    'tamamhealth_problems', 'tamamhealth_encounters', 'tamamhealth_biometric_templates',
    // Operational DBs that were created + synced but previously missed here,
    // leaving stale data behind on reset/re-seed.
    'tamamhealth_availability', 'tamamhealth_announcements',
    'tamamhealth_emergency_plans', 'tamamhealth_assets',
    'tamamhealth_leave_requests', 'tamamhealth_payroll_entries',
    // NOTE: 'tamamhealth_controlled_substance_log' is deliberately NOT reset
    // here — it is an append-only regulatory audit trail and resetAllDatabases()
    // runs on production seed-version bumps (see seedProduction).
    'tamamhealth_meta'
  ];
  for (const name of dbNames) {
    try {
      // Prefer the cached instance — destroying a NEW PouchDB while the cached
      // one still holds an open IndexedDB connection causes the IndexedDB
      // deleteDatabase request to block until the open connection is closed.
      // Destroying the cached instance first releases the connection.
      const db = databases[name] ?? new PouchDB(name);
      // Remove from cache before destroy so any in-flight getDB() that fires
      // during the destroy doesn't get a half-deleted handle.
      delete databases[name];
      await db.destroy();
    } catch {
      // OK — may not exist yet, or already destroyed in a concurrent call
      delete databases[name];
    }
  }
  // Clear any remaining cached instances (entries created since the loop
  // started, e.g. by a parallel render that called getDB() while we were
  // mid-destroy).
  for (const key of Object.keys(databases)) {
    delete databases[key];
  }
}
