import { patientsDB, hospitalsDB } from '../db';
import type { PatientDoc, HospitalDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { validatePatientData, ValidationError } from '../validation';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { findByType } from './db-query';
import { getSettings } from '../settings/settings-store';
import { normalizePhone, normalizeEmail, normalizeNationalId } from '../field-formats';

/**
 * Canonicalize contact/identity fields before validation + storage so every
 * patient record holds the same format (phones as +211XXXXXXXXX, email
 * lower-cased, national ID upper-cased). Invalid phones are left untouched so
 * validation surfaces a clear error rather than silently dropping the value.
 */
function normalizePatientContact<T extends Record<string, unknown>>(data: T): T {
  const out = { ...data } as Record<string, unknown>;
  for (const f of ['phone', 'altPhone', 'whatsapp', 'nokPhone']) {
    if (out[f]) {
      const n = normalizePhone(out[f]);
      if (n) out[f] = n;
    }
  }
  if (out.email) out.email = normalizeEmail(out.email);
  if (out.nationalId) out.nationalId = normalizeNationalId(out.nationalId);
  return out as T;
}

/**
 * Generate a geocode ID from boma code and household number.
 * Format: BOMA-{bomaCode}-HH{householdNumber}
 * Expert recommendation: Use household geocoding instead of national IDs.
 */
export function generateGeocodeId(bomaCode: string, householdNumber: number): string {
  const code = bomaCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `BOMA-${code}-HH${householdNumber}`;
}

export async function getAllPatients(scope?: DataScope): Promise<PatientDoc[]> {
  const db = patientsDB();
  const all = await findByType<PatientDoc>(db, 'patient');
  /* istanbul ignore next -- scope filter: tested with and without */
  return scope ? filterByScope(all, scope) : all;
}

export async function getPatientById(id: string): Promise<PatientDoc | null> {
  try {
    const db = patientsDB();
    return await db.get(id) as PatientDoc;
  } catch {
    return null;
  }
}

export async function searchPatients(query: string, scope?: DataScope): Promise<PatientDoc[]> {
  const all = await getAllPatients(scope);
  const q = query.toLowerCase();
  /* istanbul ignore next -- defensive null-safety in search filter */
  return all.filter(p =>
    `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase().includes(q) ||
    (p.hospitalNumber || '').toLowerCase().includes(q) ||
    (p.phone || '').includes(q) ||
    (p.geocodeId || '').toLowerCase().includes(q) ||
    (p.boma || '').toLowerCase().includes(q)
  );
}

/**
 * Default fallback prefix used in hospital-number generation when a facility's
 * own prefix can't be resolved (no hospitalId, hospitalsDB lookup miss, no
 * `code`/`name` field on the doc). Override at deploy time via
 * `NEXT_PUBLIC_HOSPITAL_NUMBER_DEFAULT_PREFIX` so non-South-Sudan deploys
 * don't ship with a Tamam-branded code.
 */
const DEFAULT_HOSPITAL_PREFIX =
  process.env.NEXT_PUBLIC_HOSPITAL_NUMBER_DEFAULT_PREFIX || 'TAB';

/**
 * Effective default hospital-number prefix: prefer the live facility setting,
 * then the env-configured default, then 'TAB'. The settings default mirrors
 * 'TAB', so behaviour is identical until an admin changes it.
 */
function defaultHospitalPrefix(): string {
  return getSettings().hospitalNumberPrefix || DEFAULT_HOSPITAL_PREFIX;
}

/**
 * Derive a 3-letter prefix from a hospital's display name when no explicit
 * `code` field exists on the doc. Picks initials of the first three words
 * (e.g. "Juba Teaching Hospital" -> "JTH"). Falls back to the first three
 * upper-cased letters if the name is a single word.
 */
function deriveHospitalPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return DEFAULT_HOSPITAL_PREFIX;
  if (words.length >= 2) {
    return words.slice(0, 3).map(w => w[0]?.toUpperCase() || '').join('').padEnd(3, 'X').slice(0, 3);
  }
  return words[0].slice(0, 3).toUpperCase().padEnd(3, 'X');
}

/* istanbul ignore next -- private utility: hospital prefix lookup */
async function getHospitalPrefix(hospitalId?: string): Promise<string> {
  if (!hospitalId) return defaultHospitalPrefix();

  // Prefer the hospital's own `code` (or derived from name) when the doc is
  // present in hospitalsDB. This works for any deployment, not just the demo
  // seed, because every facility document carries its own identifying info.
  try {
    const hosp = await hospitalsDB().get(hospitalId) as HospitalDoc & { code?: string };
    if (hosp.code && typeof hosp.code === 'string' && hosp.code.length > 0) {
      return hosp.code.toUpperCase();
    }
    if (hosp.name) return deriveHospitalPrefix(hosp.name);
  } catch {
    // Fall through to ID-pattern heuristics below.
  }

  // Structural ID prefixes — independent of any specific deployment's data.
  if (hospitalId.startsWith('phcc-')) return 'PHC';
  if (hospitalId.startsWith('phcu-')) return 'BMU';
  if (hospitalId.startsWith('county-')) return 'CTY';
  return defaultHospitalPrefix();
}

/* istanbul ignore next -- private utility: org ID inference */
async function inferOrgIdFromHospital(hospitalId?: string): Promise<string | undefined> {
  if (!hospitalId) return undefined;
  try {
    const hdb = hospitalsDB();
    const hosp = await hdb.get(hospitalId) as HospitalDoc;
    return hosp.orgId;
  } catch {
    return undefined;
  }
}

/**
 * Generate a unique hospital number using UUID suffix to avoid race conditions.
 * Format: PREFIX-XXXXXX (e.g., JTH-A3F2B1)
 */
async function generateHospitalNumber(hospitalId?: string): Promise<string> {
  const prefix = await getHospitalPrefix(hospitalId);
  const db = patientsDB();
  const count = (await db.allDocs()).total_rows;
  // Use count + random suffix for uniqueness without race conditions
  const suffix = `${String(count + 1).padStart(4, '0')}${uuidv4().slice(0, 2).toUpperCase()}`;
  return `${prefix}-${suffix}`;
}

/**
 * Check for potential duplicate patients by name+DOB, phone, geocodeId, or nationalId.
 */
async function checkDuplicates(data: Record<string, unknown>, scope?: DataScope): Promise<string | null> {
  const all = await getAllPatients(scope);
  const firstName = ((data.firstName as string) || '').toLowerCase().trim();
  const surname = ((data.surname as string) || '').toLowerCase().trim();
  const dob = data.dateOfBirth as string | undefined;
  const phone = data.phone as string | undefined;
  const geocodeId = data.geocodeId as string | undefined;
  const nationalId = data.nationalId as string | undefined;

  for (const p of all) {
    // Match by name + DOB
    if (firstName && surname && dob &&
        p.firstName.toLowerCase() === firstName &&
        p.surname.toLowerCase() === surname &&
        p.dateOfBirth === dob) {
      return `A patient named "${p.firstName} ${p.surname}" with the same date of birth already exists (${p.hospitalNumber})`;
    }
    // Match by phone
    if (phone && phone.length >= 7 && p.phone === phone) {
      return `A patient with phone number ${phone} already exists (${p.firstName} ${p.surname}, ${p.hospitalNumber})`;
    }
    // Match by geocode ID
    if (geocodeId && p.geocodeId === geocodeId) {
      return `A patient with Geocode ID ${geocodeId} already exists (${p.firstName} ${p.surname})`;
    }
    // Match by national ID
    if (nationalId && nationalId.length >= 3 && p.nationalId === nationalId) {
      return `A patient with National ID ${nationalId} already exists (${p.firstName} ${p.surname})`;
    }
  }
  return null;
}

export async function createPatient(rawData: Omit<PatientDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>): Promise<PatientDoc> {
  const data = normalizePatientContact(rawData as unknown as Record<string, unknown>) as typeof rawData;
  const errors = validatePatientData(data as unknown as Record<string, unknown>);

  // Check for duplicate patients
  const duplicateMsg = await checkDuplicates(data as unknown as Record<string, unknown>);
  if (duplicateMsg) {
    errors.duplicate = duplicateMsg;
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  const db = patientsDB();
  const now = new Date().toISOString();
  const id = `pat-${uuidv4().slice(0, 8)}`;
  const hospitalNumber = data.hospitalNumber || await generateHospitalNumber(data.registrationHospital);
  const orgId = data.orgId || await inferOrgIdFromHospital(data.registrationHospital);
  const doc: PatientDoc = {
    _id: id,
    type: 'patient',
    ...data,
    orgId,
    hospitalNumber,
    registeredAt: data.registeredAt || now,
    createdAt: now,
    updatedAt: now,
  } as PatientDoc;
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_PATIENT', undefined, undefined, `Created patient ${doc._id}: ${data.firstName} ${data.surname} (${hospitalNumber})`);
  emitSyncEvent({
    resourceType: 'patient',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.registrationHospital,
  });
  return doc;
}

export async function updatePatient(id: string, rawData: Partial<PatientDoc>): Promise<PatientDoc | null> {
  const data = normalizePatientContact(rawData as unknown as Record<string, unknown>) as Partial<PatientDoc>;
  const db = patientsDB();
  let existing: PatientDoc;
  try {
    existing = await db.get(id) as PatientDoc;
  } catch (err) {
    // PouchDB / CouchDB throws on missing docs (name === 'not_found' / status 404).
    // Translate that into the null contract the route relies on, so callers can
    // distinguish "doesn't exist" (404) from "real server error" (500).
    const e = err as { name?: string; status?: number } | undefined;
    if (e && (e.name === 'not_found' || e.status === 404)) return null;
    throw err;
  }
  const inferredOrg = data.orgId || existing.orgId || await inferOrgIdFromHospital(data.registrationHospital || existing.registrationHospital);
  const updated = {
    ...existing,
    ...data,
    orgId: inferredOrg,
    _id: existing._id,
    _rev: existing._rev,
    updatedAt: new Date().toISOString(),
  };
  // Validate the merged document, but only *block* on errors for fields the
  // caller is actually writing. Full-document validation here used to reject
  // any partial update to a record with pre-existing gaps (e.g. legacy/seed
  // patients created before `primaryLanguage` became required), which made
  // those records permanently un-updatable — referral acceptance could never
  // re-home the patient (its transfer patches only hospital/org fields). The
  // invariant we keep: a write cannot *introduce* invalid data — any invalid
  // value in the patch itself still throws. Pre-existing gaps in untouched
  // fields are tolerated and left for the next full-form edit to fill.
  const errors = validatePatientData(updated as unknown as Record<string, unknown>);
  const blockingErrors = Object.fromEntries(
    Object.entries(errors).filter(([field]) => field in data),
  );
  if (Object.keys(blockingErrors).length > 0) {
    throw new ValidationError(blockingErrors);
  }
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  // Record which fields changed (names only, no PII values) so patient-record
  // edits are attributable at the field level for audit/compliance.
  const changedFields = Object.keys(data).filter(
    (k) => !['_id', '_rev', 'updatedAt'].includes(k),
  );
  await logAuditSafe(
    'UPDATE_PATIENT',
    undefined,
    undefined,
    `Updated patient ${id}${changedFields.length ? ` — fields: ${changedFields.join(', ')}` : ''}`,
  );
  emitSyncEvent({
    resourceType: 'patient',
    resourceId: updated._id,
    operation: 'update',
    resourceVersion: updated._rev,
    orgId: updated.orgId,
    hospitalId: updated.registrationHospital,
  });
  return updated;
}

/**
 * Atomically read-modify-write a patient document with optimistic-concurrency
 * retry. The `mutate` callback receives the LATEST persisted patient on each
 * attempt and returns the field patch to apply (or null to abort as a no-op).
 * On a revision conflict (concurrent write) the read+mutate is retried against
 * fresh data, so two simultaneous edits to array fields like `structuredAllergies`
 * can't silently drop each other (audit finding H2).
 *
 * Used for the on-chart structured lists (allergies, directives, care alerts).
 */
export async function mutatePatient(
  id: string,
  mutate: (patient: PatientDoc) => Partial<PatientDoc> | null,
  maxRetries = 5,
): Promise<PatientDoc | null> {
  const db = patientsDB();
  for (let attempt = 0; ; attempt++) {
    let existing: PatientDoc;
    try {
      existing = await db.get(id) as PatientDoc;
    } catch (err) {
      const e = err as { name?: string; status?: number } | undefined;
      if (e && (e.name === 'not_found' || e.status === 404)) return null;
      throw err;
    }
    const patch = mutate(existing);
    if (patch === null) return existing;
    const updated = {
      ...existing,
      ...patch,
      _id: existing._id,
      _rev: existing._rev,
      updatedAt: new Date().toISOString(),
    } as PatientDoc;
    const errors = validatePatientData(updated as unknown as Record<string, unknown>);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }
    try {
      const resp = await db.put(updated);
      updated._rev = resp.rev;
      emitSyncEvent({
        resourceType: 'patient',
        resourceId: updated._id,
        operation: 'update',
        resourceVersion: updated._rev,
        orgId: updated.orgId,
        hospitalId: updated.registrationHospital,
      });
      return updated;
    } catch (err) {
      const e = err as { name?: string; status?: number } | undefined;
      if (e && (e.name === 'conflict' || e.status === 409) && attempt < maxRetries) {
        continue; // re-read latest revision and re-apply the mutation
      }
      throw err;
    }
  }
}

// One-shot per-process index creation. Mango createIndex is idempotent
// server-side but each call costs an HTTP round-trip, so we cache.
const hospitalIndexCreated = { done: false };

export async function getPatientsByHospital(hospitalId: string): Promise<PatientDoc[]> {
  const db = patientsDB();
  if (!hospitalIndexCreated.done) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).createIndex({ index: { fields: ['type', 'registrationHospital'] } });
    } catch {
      // older couchdb / index conflict — find() will fall back to a full
      // scan once. Cache the attempt either way.
    }
    hospitalIndexCreated.done = true;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await (db as any).find({
    selector: { type: 'patient', registrationHospital: hospitalId },
    limit: 1000000,
  });
  return (r.docs || []) as PatientDoc[];
}

export async function archivePatient(id: string, actor?: string): Promise<PatientDoc | null> {
  const db = patientsDB();
  // PouchDB.get throws on not-found (it never returns falsy), so translate that
  // into the documented null contract instead of letting it propagate.
  let existing: PatientDoc;
  try {
    existing = await db.get(id) as PatientDoc;
  } catch {
    return null;
  }
  const updated: PatientDoc = {
    ...existing,
    isActive: false,
    updatedAt: new Date().toISOString(),
  };
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  await logAuditSafe('ARCHIVE_PATIENT', undefined, actor, `Archived patient ${id}`);
  emitSyncEvent({
    resourceType: 'patient',
    resourceId: updated._id,
    operation: 'archive',
    resourceVersion: updated._rev,
    username: actor,
    orgId: updated.orgId,
    hospitalId: updated.registrationHospital,
  });
  return updated;
}

export async function unarchivePatient(id: string, actor?: string): Promise<PatientDoc | null> {
  const db = patientsDB();
  let existing: PatientDoc;
  try {
    existing = await db.get(id) as PatientDoc;
  } catch {
    return null;
  }
  const updated: PatientDoc = {
    ...existing,
    isActive: true,
    updatedAt: new Date().toISOString(),
  };
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  await logAuditSafe('UNARCHIVE_PATIENT', undefined, actor, `Restored patient ${id}`);
  emitSyncEvent({
    resourceType: 'patient',
    resourceId: updated._id,
    operation: 'update',
    resourceVersion: updated._rev,
    username: actor,
    orgId: updated.orgId,
    hospitalId: updated.registrationHospital,
  });
  return updated;
}
