/**
 * Fingerprint service — enrollment, identification, and revocation of
 * fingerprint templates, plus the HTTP client for the local hardware bridge.
 *
 * Architecture (see fingerprint-bridge/README.md):
 *   - Scanners are driven by the `fingerprint-bridge` service on the SAME
 *     machine as the scanner (loopback HTTP). Browsers can't load vendor SDKs.
 *   - Capture and matching happen in the bridge (vendor SDK territory);
 *     template STORAGE lives here, in `tamamhealth_biometric_templates`
 *     (PouchDB/CouchDB) — synced and offline-first like all clinical data.
 *   - Everything degrades gracefully: if the bridge is down or the feature
 *     flag is off, callers get `available: false` and the UI hides itself.
 */

import { biometricTemplatesDB } from '../db';
import type { BiometricTemplateDoc, BiometricTemplateFormat, FingerPosition } from '../db-types-biometrics';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { logAuditSafe } from './audit-service';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Feature flag + bridge client
// ---------------------------------------------------------------------------

export function isFingerprintEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FINGERPRINT_ENABLED === 'true';
}

export function getBridgeUrl(): string {
  // Browser → same-origin proxy (avoids CSP / upgrade-insecure-requests on loopback HTTP).
  if (typeof window !== 'undefined') {
    return '/api/fingerprint-bridge';
  }
  return (process.env.NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL || 'http://127.0.0.1:7345').replace(/\/+$/, '');
}

export interface BridgeStatus {
  available: boolean;
  scannerConnected: boolean;
  driver?: string;
  templateFormat?: BiometricTemplateFormat;
}

export interface CaptureResult {
  template: string;
  quality: number;
  finger?: FingerPosition;
  format: BiometricTemplateFormat;
  driver: string;
}

/** Probe the bridge. Never throws — an unreachable bridge is a normal state. */
export async function getBridgeStatus(): Promise<BridgeStatus> {
  if (!isFingerprintEnabled()) return { available: false, scannerConnected: false };
  try {
    const res = await fetch(`${getBridgeUrl()}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { available: false, scannerConnected: false };
    const body = await res.json();
    return {
      available: body.ok === true,
      scannerConnected: body.scannerConnected === true,
      driver: body.driver,
      templateFormat: body.templateFormat,
    };
  } catch {
    return { available: false, scannerConnected: false };
  }
}

/** Ask the bridge to capture a fingerprint from the attached scanner. */
export async function captureFingerprint(options: { finger?: FingerPosition; simulateId?: string } = {}): Promise<CaptureResult> {
  const res = await fetch(`${getBridgeUrl()}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Generous timeout — the scanner waits for a finger to be placed.
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Fingerprint capture failed (HTTP ${res.status})`);
  }
  return await res.json() as CaptureResult;
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export interface EnrollFingerprintInput {
  patientId: string;
  patientName: string;
  finger: FingerPosition;
  template: string;
  format: BiometricTemplateFormat;
  quality: number;
  driver: string;
  /** Staff member who recorded the patient's verbal/written consent. */
  consentRecordedBy: string;
  enrolledBy?: string;
  hospitalId?: string;
  orgId?: string;
}

export async function enrollFingerprint(input: EnrollFingerprintInput): Promise<BiometricTemplateDoc> {
  if (!input.patientId) throw new Error('patientId is required');
  if (!input.template) throw new Error('template is required');
  if (!input.consentRecordedBy) throw new Error('consent must be recorded before enrolling a fingerprint');

  const db = biometricTemplatesDB();
  const now = new Date().toISOString();
  const doc: BiometricTemplateDoc = {
    _id: `biotpl-${uuidv4().slice(0, 8)}`,
    type: 'biometric_template',
    patientId: input.patientId,
    patientName: input.patientName,
    finger: input.finger,
    template: input.template,
    format: input.format,
    quality: input.quality,
    driver: input.driver,
    consentGiven: true,
    consentRecordedBy: input.consentRecordedBy,
    consentRecordedAt: now,
    enrolledBy: input.enrolledBy,
    hospitalId: input.hospitalId,
    orgId: input.orgId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe(
    'ENROLL_FINGERPRINT', undefined, input.enrolledBy,
    `Enrolled ${input.finger} fingerprint for patient ${input.patientId} (quality ${input.quality}, format ${input.format})`
  );
  return doc;
}

// ---------------------------------------------------------------------------
// Queries + revocation
// ---------------------------------------------------------------------------

async function getAllTemplates(): Promise<BiometricTemplateDoc[]> {
  const db = biometricTemplatesDB();
  const result = await db.allDocs({ include_docs: true });
  return result.rows
    .map(r => r.doc as BiometricTemplateDoc)
    .filter(d => d && d.type === 'biometric_template');
}

export async function getTemplatesForPatient(patientId: string): Promise<BiometricTemplateDoc[]> {
  const all = await getAllTemplates();
  return all.filter(d => d.patientId === patientId && d.isActive);
}

/** Revoke (deactivate) all of a patient's fingerprint templates. */
export async function revokeFingerprints(patientId: string, actor?: string): Promise<number> {
  const db = biometricTemplatesDB();
  const templates = await getTemplatesForPatient(patientId);
  const now = new Date().toISOString();
  for (const tpl of templates) {
    await db.put({ ...tpl, isActive: false, revokedAt: now, revokedBy: actor, updatedAt: now });
  }
  if (templates.length > 0) {
    await logAuditSafe(
      'REVOKE_FINGERPRINTS', undefined, actor,
      `Revoked ${templates.length} fingerprint template(s) for patient ${patientId}`
    );
  }
  return templates.length;
}

// ---------------------------------------------------------------------------
// Identification (1:N)
// ---------------------------------------------------------------------------

export interface IdentifyMatch {
  patientId: string;
  patientName: string;
  finger: FingerPosition;
  score: number;
}

/**
 * Identify a patient from a fresh capture. Loads active templates from the
 * LOCAL replica (works offline), scoped to the caller's org, and asks the
 * bridge to score them. Returns ranked matches, best first.
 */
export async function identifyPatient(probeTemplate: string, scope?: DataScope): Promise<IdentifyMatch[]> {
  let templates = (await getAllTemplates()).filter(d => d.isActive);
  if (scope) templates = filterByScope(templates, scope);
  if (templates.length === 0) return [];

  const res = await fetch(`${getBridgeUrl()}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      probe: probeTemplate,
      candidates: templates.map(t => ({ id: t._id, template: t.template })),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Fingerprint matching failed (HTTP ${res.status})`);
  }
  const { matches } = await res.json() as { matches: { id: string; score: number }[] };

  const byId = new Map(templates.map(t => [t._id, t]));
  const results: IdentifyMatch[] = [];
  const seenPatients = new Set<string>();
  for (const m of matches) {
    const tpl = byId.get(m.id);
    if (!tpl) continue;
    // A patient may have several enrolled fingers; report their best score once.
    if (seenPatients.has(tpl.patientId)) continue;
    seenPatients.add(tpl.patientId);
    results.push({ patientId: tpl.patientId, patientName: tpl.patientName, finger: tpl.finger, score: m.score });
  }
  return results;
}
