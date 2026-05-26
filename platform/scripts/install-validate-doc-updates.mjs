#!/usr/bin/env node
/**
 * Install the org-scoping validate_doc_update design doc on every CouchDB
 * database flagged orgScoped: true in lib/sync/sync-config.ts.
 *
 * Run as part of deployment (after the databases themselves exist).
 * Idempotent: re-running updates the existing _design/tamamhealth-org-scope.
 *
 * Required env (same fallbacks as platform/src/lib/db.ts):
 *   COUCHDB_URL              (or NEXT_PUBLIC_COUCHDB_URL, default http://couchdb:5984)
 *   COUCHDB_ADMIN_USER       (or COUCHDB_USER)
 *   COUCHDB_ADMIN_PASSWORD   (or COUCHDB_PASSWORD)
 *
 * NOTE: This script is intentionally a plain Node ESM module so it can run
 * without tsx / a TypeScript toolchain. The orgScoped database list and the
 * validate function string are duplicated below to keep the script free of
 * .ts imports. Keep them in sync with:
 *   - platform/src/lib/sync/sync-config.ts  (orgScoped flags)
 *   - platform/src/lib/sync/validate-doc-update.ts  (ORG_SCOPED_VALIDATE_FN)
 */

import { Buffer } from 'node:buffer';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Duplicated from platform/src/lib/sync/sync-config.ts — orgScoped: true only.
// If you add/remove orgScoped databases there, update this list too.
// ---------------------------------------------------------------------------
const ORG_SCOPED_DATABASES = [
  // Core clinical
  'tamamhealth_patients',
  'tamamhealth_medical_records',
  'tamamhealth_referrals',
  'tamamhealth_lab_results',
  'tamamhealth_prescriptions',
  'tamamhealth_messages',
  'tamamhealth_births',
  'tamamhealth_deaths',
  'tamamhealth_facility_assessments',
  'tamamhealth_immunizations',
  'tamamhealth_anc',
  'tamamhealth_boma_visits',
  'tamamhealth_follow_ups',
  'tamamhealth_hospitals',
  'tamamhealth_problems',
  'tamamhealth_triage',
  'tamamhealth_appointments',
  'tamamhealth_telehealth',
  // Operational / facility
  'tamamhealth_pharmacy_inventory',
  'tamamhealth_wards',
  'tamamhealth_blood_bank',
  'tamamhealth_emergency_plans',
  'tamamhealth_assets',
  'tamamhealth_staff_schedules',
  'tamamhealth_leave_requests',
  'tamamhealth_payroll_entries',
  'tamamhealth_patient_feedback',
  // Billing / payments / insurance
  'tamamhealth_billing',
  'tamamhealth_fee_schedule',
  'tamamhealth_insurance_policies',
  'tamamhealth_eligibility_checks',
  'tamamhealth_charges',
  'tamamhealth_claims',
  'tamamhealth_adjustments',
  'tamamhealth_payments',
  'tamamhealth_refunds',
  'tamamhealth_saved_payment_methods',
  'tamamhealth_payment_plans',
  'tamamhealth_invoices',
  // Sync infrastructure
  'tamamhealth_sync_events',
  'tamamhealth_conflict_queue',
  // Identity / config (orgScoped subset)
  'tamamhealth_users',
  // Append-only audit trails
  'tamamhealth_audit_log',
  'tamamhealth_controlled_substance_log',
  'tamamhealth_ledger',
];

// ---------------------------------------------------------------------------
// Duplicated verbatim from platform/src/lib/sync/validate-doc-update.ts.
// Keep these byte-for-byte identical.
// ---------------------------------------------------------------------------
const ORG_SCOPED_VALIDATE_FN = `function (newDoc, oldDoc, userCtx, secObj) {
  // Replication brings in _deleted tombstones; allow them through so deletes propagate.
  if (newDoc._deleted) return;

  // Design docs are admin-only; the CouchDB security object handles that.
  if (newDoc._id && newDoc._id.indexOf('_design/') === 0) return;

  // Admin role bypasses tenant enforcement (server-side service writes use this).
  var roles = (userCtx && userCtx.roles) || [];
  if (roles.indexOf('_admin') !== -1) return;

  // Require orgId on every non-design, non-deleted document.
  if (!newDoc.orgId || typeof newDoc.orgId !== 'string') {
    throw({ forbidden: 'orgId is required on this database' });
  }

  // If the user's CouchDB roles include 'org:<orgId>', enforce it matches.
  // Otherwise (e.g., service account writing on behalf of any org) allow.
  for (var i = 0; i < roles.length; i++) {
    if (roles[i].indexOf('org:') === 0) {
      var allowedOrg = roles[i].substring(4);
      if (newDoc.orgId !== allowedOrg) {
        throw({ forbidden: 'orgId mismatch: doc=' + newDoc.orgId + ' user=' + allowedOrg });
      }
      // On update, the orgId must not change.
      if (oldDoc && oldDoc.orgId && oldDoc.orgId !== newDoc.orgId) {
        throw({ forbidden: 'orgId is immutable' });
      }
      return;
    }
  }
}`;

const DESIGN_DOC_ID = '_design/tamamhealth-org-scope';

function resolveConfig() {
  const url =
    process.env.COUCHDB_URL ||
    process.env.NEXT_PUBLIC_COUCHDB_URL ||
    'http://couchdb:5984';
  const user = process.env.COUCHDB_ADMIN_USER || process.env.COUCHDB_USER;
  const pass = process.env.COUCHDB_ADMIN_PASSWORD || process.env.COUCHDB_PASSWORD;
  if (!user || !pass) {
    console.error(
      '[install-validate-doc-updates] Missing CouchDB admin credentials. ' +
      'Set COUCHDB_ADMIN_USER and COUCHDB_ADMIN_PASSWORD (or COUCHDB_USER / ' +
      'COUCHDB_PASSWORD) in the environment.',
    );
    process.exit(1);
  }
  const authHeader = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  return { baseUrl: url.replace(/\/+$/, ''), authHeader };
}

async function installOne(baseUrl, authHeader, dbName) {
  const designUrl = `${baseUrl}/${dbName}/${DESIGN_DOC_ID}`;

  // 1. Probe for an existing design doc to capture _rev (idempotent updates).
  let existingRev = null;
  const probe = await fetch(designUrl, {
    method: 'GET',
    headers: { Authorization: authHeader },
  });
  if (probe.status === 200) {
    const body = await probe.json();
    existingRev = body && body._rev ? body._rev : null;
  } else if (probe.status !== 404) {
    return { ok: false, reason: `GET ${probe.status}` };
  }

  // 2. PUT the new (or updated) design doc body.
  const body = {
    _id: DESIGN_DOC_ID,
    validate_doc_update: ORG_SCOPED_VALIDATE_FN,
  };
  if (existingRev) body._rev = existingRev;

  const put = await fetch(designUrl, {
    method: 'PUT',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (put.status === 201 || put.status === 202) {
    return { ok: true };
  }
  let reason = `PUT ${put.status}`;
  try {
    const errBody = await put.json();
    if (errBody && (errBody.error || errBody.reason)) {
      reason += ` ${errBody.error || ''} ${errBody.reason || ''}`.trim();
    }
  } catch {
    // ignore — non-JSON error body
  }
  return { ok: false, reason };
}

async function main() {
  const { baseUrl, authHeader } = resolveConfig();
  console.log(
    `[install-validate-doc-updates] target=${baseUrl.replace(/\/\/[^@]*@/, '//***@')} ` +
    `databases=${ORG_SCOPED_DATABASES.length}`,
  );

  let okCount = 0;
  let errCount = 0;
  for (const db of ORG_SCOPED_DATABASES) {
    try {
      const result = await installOne(baseUrl, authHeader, db);
      if (result.ok) {
        console.log(`[ok] ${db}`);
        okCount++;
      } else {
        console.log(`[error] ${db} ${result.reason}`);
        errCount++;
      }
    } catch (err) {
      console.log(`[error] ${db} ${err && err.message ? err.message : String(err)}`);
      errCount++;
    }
  }

  console.log(
    `[install-validate-doc-updates] done ok=${okCount} error=${errCount} ` +
    `total=${ORG_SCOPED_DATABASES.length}`,
  );
  if (errCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[install-validate-doc-updates] fatal', err);
  process.exit(1);
});
