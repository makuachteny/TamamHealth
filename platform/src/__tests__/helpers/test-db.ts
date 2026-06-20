/**
 * PouchDB test helper — provides in-memory database instances for isolated testing.
 * Uses pouchdb-adapter-memory so tests don't touch the filesystem.
 *
 * The pouchdb-find plugin is registered alongside the memory adapter so the
 * service-layer Mango queries (`db.find(...)` / `db.createIndex(...)`) work
 * exactly the same way in tests as they do in the browser/CouchDB runtime.
 */
import PouchDB from 'pouchdb-browser';
import memoryAdapter from 'pouchdb-adapter-memory';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const findPlugin = require('pouchdb-find');

PouchDB.plugin(memoryAdapter);
PouchDB.plugin(findPlugin.default || findPlugin);

// We mock the @/lib/db module to intercept all database accessors
const databases: Record<string, PouchDB.Database> = {};

function getTestDB(name: string): PouchDB.Database {
  if (!databases[name]) {
    databases[name] = new PouchDB(name, { adapter: 'memory' });
  }
  return databases[name];
}

/**
 * Destroy all in-memory databases created during a test.
 * Call this in afterEach / afterAll.
 */
export async function teardownTestDBs(): Promise<void> {
  for (const [name, db] of Object.entries(databases)) {
    try {
      await db.destroy();
    } catch {
      // ignore
    }
    delete databases[name];
  }
}

/**
 * Create the jest mock object for @/lib/db.
 * Usage in test file:
 *   jest.mock('@/lib/db', () => createDBMock());
 */
export function createDBMock() {
  return {
    getDB: (name: string) => getTestDB(`test_${name}`),
    usersDB: () => getTestDB('test_tamamhealth_users'),
    patientsDB: () => getTestDB('test_tamamhealth_patients'),
    hospitalsDB: () => getTestDB('test_tamamhealth_hospitals'),
    medicalRecordsDB: () => getTestDB('test_tamamhealth_medical_records'),
    referralsDB: () => getTestDB('test_tamamhealth_referrals'),
    labResultsDB: () => getTestDB('test_tamamhealth_lab_results'),
    diseaseAlertsDB: () => getTestDB('test_tamamhealth_disease_alerts'),
    prescriptionsDB: () => getTestDB('test_tamamhealth_prescriptions'),
    auditLogDB: () => getTestDB('test_tamamhealth_audit_log'),
    messagesDB: () => getTestDB('test_tamamhealth_messages'),
    birthsDB: () => getTestDB('test_tamamhealth_births'),
    deathsDB: () => getTestDB('test_tamamhealth_deaths'),
    facilityAssessmentsDB: () => getTestDB('test_tamamhealth_facility_assessments'),
    immunizationsDB: () => getTestDB('test_tamamhealth_immunizations'),
    ancDB: () => getTestDB('test_tamamhealth_anc'),
    followUpsDB: () => getTestDB('test_tamamhealth_follow_ups'),
    organizationsDB: () => getTestDB('test_tamamhealth_organizations'),
    platformConfigDB: () => getTestDB('test_tamamhealth_platform_config'),
    appointmentsDB: () => getTestDB('test_tamamhealth_appointments'),
    telehealthDB: () => getTestDB('test_tamamhealth_telehealth'),
    pharmacyInventoryDB: () => getTestDB('test_tamamhealth_pharmacy_inventory'),
    triageDB: () => getTestDB('test_tamamhealth_triage'),
    billingDB: () => getTestDB('test_tamamhealth_billing'),
    feeScheduleDB: () => getTestDB('test_tamamhealth_fee_schedule'),
    wardDB: () => getTestDB('test_tamamhealth_wards'),
    staffSchedulesDB: () => getTestDB('test_tamamhealth_staff_schedules'),
    bloodBankDB: () => getTestDB('test_tamamhealth_blood_bank'),
    emergencyPlansDB: () => getTestDB('test_tamamhealth_emergency_plans'),
    conflictQueueDB: () => getTestDB('test_tamamhealth_conflict_queue'),
    syncEventsDB: () => getTestDB('test_tamamhealth_sync_events'),
    biometricTemplatesDB: () => getTestDB('test_tamamhealth_biometric_templates'),
    encountersDB: () => getTestDB('test_tamamhealth_encounters'),
    patientNotesDB: () => getTestDB('test_tamamhealth_patient_notes'),
    phoneNotesDB: () => getTestDB('test_tamamhealth_phone_notes'),
    assessmentsDB: () => getTestDB('test_tamamhealth_assessments'),
    SEED_VERSION: 12,
    isSeeded: async () => false,
    markSeeded: async () => {},
    resetAllDatabases: async () => {},
  };
}

/**
 * Helper: put a document into a test DB, returning the stored doc.
 */
export async function putDoc<T extends { _id: string }>(
  db: PouchDB.Database,
  doc: T
): Promise<T & { _rev: string }> {
  const resp = await db.put(doc);
  return { ...doc, _rev: resp.rev };
}
