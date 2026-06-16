/**
 * Sync Configuration — maps each PouchDB database to its CouchDB remote.
 *
 * sync direction:
 *   'both'  – bidirectional live replication (default for most DBs)
 *   'push'  – local → remote only (e.g., audit log)
 *   'pull'  – remote → local only (e.g., platform config pushed by admins)
 */

export type SyncDirection = 'both' | 'push' | 'pull';

export interface DatabaseSyncConfig {
  /** Local PouchDB name (matches db.ts) */
  localName: string;
  /** Sync direction */
  direction: SyncDirection;
  /** If true, sync is scoped to the user's orgId */
  orgScoped: boolean;
}

/** All databases that participate in sync */
export const DATABASE_SYNC_CONFIGS: DatabaseSyncConfig[] = [
  // ----- Core clinical -----
  { localName: 'tamamhealth_patients',              direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_medical_records',       direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_referrals',             direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_lab_results',           direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_prescriptions',         direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_disease_alerts',        direction: 'both', orgScoped: false },
  { localName: 'tamamhealth_messages',              direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_births',                direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_deaths',                direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_facility_assessments',  direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_immunizations',         direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_anc',                   direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_follow_ups',            direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_hospitals',             direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_problems',              direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_triage',                direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_appointments',          direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_availability',          direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_announcements',         direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_conversations',         direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_patient_notes',         direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_encounters',            direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_telehealth',            direction: 'both', orgScoped: true },
  // Fingerprint templates — synced so identification works at any facility in
  // the org, scoped to the org like other patient-identifying data.
  { localName: 'tamamhealth_biometric_templates',   direction: 'both', orgScoped: true },

  // ----- Operational / facility -----
  { localName: 'tamamhealth_pharmacy_inventory',    direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_wards',                 direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_blood_bank',            direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_emergency_plans',       direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_assets',                direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_staff_schedules',       direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_leave_requests',        direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_payroll_entries',       direction: 'both', orgScoped: true },

  // ----- Billing / payments / insurance -----
  { localName: 'tamamhealth_billing',               direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_fee_schedule',          direction: 'pull', orgScoped: true },
  { localName: 'tamamhealth_insurance_policies',    direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_eligibility_checks',    direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_charges',               direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_claims',                direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_adjustments',           direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_payments',              direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_refunds',               direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_saved_payment_methods', direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_payment_plans',         direction: 'both', orgScoped: true },
  { localName: 'tamamhealth_invoices',              direction: 'both', orgScoped: true },

  // ----- Sync infrastructure (offline-first conflict surfaces) -----
  { localName: 'tamamhealth_sync_events',           direction: 'push', orgScoped: true },
  { localName: 'tamamhealth_conflict_queue',        direction: 'both', orgScoped: true },

  // ----- Identity / config (server-pushed, read-only on the client) -----
  { localName: 'tamamhealth_users',                 direction: 'pull', orgScoped: true },
  { localName: 'tamamhealth_organizations',         direction: 'pull', orgScoped: false },
  { localName: 'tamamhealth_platform_config',       direction: 'pull', orgScoped: false },

  // ----- Append-only audit trails (push only) -----
  { localName: 'tamamhealth_audit_log',             direction: 'push', orgScoped: true },
  { localName: 'tamamhealth_controlled_substance_log', direction: 'push', orgScoped: true },

  // ----- Financial ledger (append-only, but READ for live balances) -----
  // Must replicate BOTH ways: a charge raised at one station (e.g. the clinic)
  // and a payment taken at another (the cashier) have to converge so every
  // device computes the same patient balance. Unlike the audit/controlled logs
  // (write-only trails), the ledger is read at the point of care.
  { localName: 'tamamhealth_ledger',                direction: 'both', orgScoped: true },
];

/** Build the full CouchDB remote URL for a given database name */
export function getRemoteUrl(localName: string, couchdbUrl: string): string {
  // Strip trailing slash from base URL
  const base = couchdbUrl.replace(/\/+$/, '');
  return `${base}/${localName}`;
}

/** Check whether sync is enabled via environment variable */
export function isSyncEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true' &&
    !!process.env.NEXT_PUBLIC_COUCHDB_URL
  );
}

/** Get the configured CouchDB base URL */
export function getCouchDBUrl(): string {
  return process.env.NEXT_PUBLIC_COUCHDB_URL || 'http://localhost:5984';
}
