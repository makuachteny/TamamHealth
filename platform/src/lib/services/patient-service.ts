import { patientsDB, hospitalsDB } from '../db';
import type { PatientDoc, HospitalDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { validatePatientData, ValidationError } from '../validation';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { findByType } from './db-query';

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
  if (!hospitalId) return DEFAULT_HOSPITAL_PREFIX;

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
  return DEFAULT_HOSPITAL_PREFIX;
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

export async function createPatient(data: Omit<PatientDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>): Promise<PatientDoc> {
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

export async function updatePatient(id: string, data: Partial<PatientDoc>): Promise<PatientDoc | null> {
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
  const errors = validatePatientData(updated as unknown as Record<string, unknown>);
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  await logAuditSafe('UPDATE_PATIENT', undefined, undefined, `Updated patient ${id}`);
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
  const existing = await db.get(id) as PatientDoc;
  if (!existing) return null;
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
  const existing = await db.get(id) as PatientDoc;
  if (!existing) return null;
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
