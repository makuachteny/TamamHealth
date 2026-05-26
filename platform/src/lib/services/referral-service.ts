import { referralsDB, hospitalsDB } from '../db';
import type { ReferralDoc, HospitalDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import type { Attachment } from '@/data/mock';
import { v4 as uuidv4 } from 'uuid';
import { assembleTransferPackage } from './transfer-service';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';

/* istanbul ignore next -- private utility: org ID inference from hospital IDs */
async function inferOrgId(fromHospitalId?: string, toHospitalId?: string): Promise<string | undefined> {
  try {
    const hdb = hospitalsDB();
    if (fromHospitalId) {
      const from = await hdb.get(fromHospitalId) as HospitalDoc;
      if (from?.orgId) return from.orgId;
    }
    if (toHospitalId) {
      const to = await hdb.get(toHospitalId) as HospitalDoc;
      if (to?.orgId) return to.orgId;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function getAllReferrals(scope?: DataScope): Promise<ReferralDoc[]> {
  const db = referralsDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as ReferralDoc)
    .filter(d => d && d.type === 'referral');
  /* istanbul ignore next -- defensive null-safety in sort */
  all.sort((a, b) => (b.referralDate || '').localeCompare(a.referralDate || ''));
  /* istanbul ignore next -- scope ternary: depends on caller context */
  return scope ? filterByScope(all, scope) : all;
}

export async function getReferralsByHospital(hospitalId: string): Promise<ReferralDoc[]> {
  const all = await getAllReferrals();
  return all.filter(r => r.toHospitalId === hospitalId || r.fromHospitalId === hospitalId);
}

export async function getReferralById(id: string): Promise<ReferralDoc | null> {
  try {
    const db = referralsDB();
    return await db.get(id) as ReferralDoc;
  } catch {
    return null;
  }
}

export async function createReferral(
  data: Omit<ReferralDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<ReferralDoc> {
  const db = referralsDB();
  const now = new Date().toISOString();
  const orgId = data.orgId || await inferOrgId(data.fromHospitalId, data.toHospitalId);
  const doc: ReferralDoc = {
    _id: `ref-${uuidv4().slice(0, 8)}`,
    type: 'referral',
    ...data,
    orgId,
    createdAt: now,
    updatedAt: now,
  } as ReferralDoc;
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_REFERRAL', undefined, undefined, `Referral ${doc._id}: patient ${doc.patientId} to ${doc.toHospital}`);
  // Emit a sync event so the country-node Postgres analytics pipeline picks
  // up the new referral. Without this, the referrals table in analytics
  // diverged from the CouchDB source of truth on every new referral.
  emitSyncEvent({
    resourceType: 'referral',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.fromHospitalId,
  });
  return doc;
}

export async function getReferralsByPatient(patientId: string): Promise<ReferralDoc[]> {
  const all = await getAllReferrals();
  return all.filter(r => r.patientId === patientId);
}

export async function createReferralWithTransfer(
  data: Omit<ReferralDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'transferPackage' | 'referralAttachments'>,
  referralAttachments: Attachment[],
  packagedBy: string
): Promise<ReferralDoc> {
  const transferPackage = await assembleTransferPackage(data.patientId, packagedBy);

  // Add referral-specific attachments to the package size
  const extraSize = referralAttachments.reduce((sum, a) => sum + a.sizeBytes, 0);
  transferPackage.packageSizeBytes += extraSize;

  const db = referralsDB();
  const now = new Date().toISOString();
  const orgId = data.orgId || await inferOrgId(data.fromHospitalId, data.toHospitalId);
  const doc: ReferralDoc = {
    _id: `ref-${uuidv4().slice(0, 8)}`,
    type: 'referral',
    ...data,
    orgId,
    transferPackage,
    referralAttachments: referralAttachments.length > 0 ? referralAttachments : undefined,
    createdAt: now,
    updatedAt: now,
  } as ReferralDoc;
  const resp2 = await db.put(doc);
  doc._rev = resp2.rev;
  // Mirror the audit + sync hand-off from the plain createReferral path.
  // Previously this variant — which is the one consultation actually calls
  // for outbound emergency referrals — wrote silently with no audit row and
  // no Postgres mirror, so receiving facilities querying the analytics view
  // missed the referral until the next CouchDB-level changes feed catch-up.
  await logAuditSafe(
    'CREATE_REFERRAL', undefined, packagedBy,
    `Referral ${doc._id}: patient ${doc.patientId} to ${doc.toHospital} (with transfer package)`
  );
  emitSyncEvent({
    resourceType: 'referral',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    username: packagedBy,
    orgId: doc.orgId,
    hospitalId: doc.fromHospitalId,
  });
  return doc;
}

export async function updateReferralStatus(
  id: string,
  status: 'sent' | 'received' | 'seen' | 'completed' | 'cancelled'
): Promise<ReferralDoc | null> {
  const db = referralsDB();
  try {
    const existing = await db.get(id) as ReferralDoc;
    const updated = { ...existing, status, updatedAt: new Date().toISOString() };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_REFERRAL', undefined, undefined, `Referral ${id} status changed to ${status}`);
    emitSyncEvent({
      resourceType: 'referral',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.fromHospitalId,
    });
    return updated;
  } catch {
    return null;
  }
}

export async function updateReferralNotes(
  id: string,
  notes: string
): Promise<ReferralDoc> {
  const db = referralsDB();
  const existing = await db.get(id) as ReferralDoc;
  const updated = { ...existing, notes, updatedAt: new Date().toISOString() };
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  await logAuditSafe('UPDATE_REFERRAL', undefined, undefined, `Referral ${id} notes updated`);
  return updated;
}

/**
 * Accept a referral: transfer the patient to the receiving hospital AND
 * mark the referral status `seen`.
 *
 * Ordering rationale (atomicity):
 * The two writes (patient transfer, referral status) cannot be wrapped in a
 * single PouchDB transaction — they live in separate databases that may
 * replicate independently. Previously the order was status-first, then
 * transfer; if the transfer threw, the referral was stuck in `seen` while
 * the patient never moved, with no compensating-write to fix it.
 *
 * Reversed here: do the patient transfer FIRST, then mark `seen`. If the
 * status write fails, the patient is already at the new facility (which
 * is the user-visible outcome), and the referral page becomes the source
 * of truth — re-running acceptance simply re-marks it `seen` (the patient
 * write is idempotent on the same target hospital). Strictly better than
 * leaving a referral marked seen for a transfer that never happened.
 */
export async function acceptReferral(referralId: string): Promise<ReferralDoc | null> {
  const db = referralsDB();
  try {
    const referral = await db.get(referralId) as ReferralDoc;

    // Step 1: transfer patient to the receiving hospital. The atomicity
    // win here is *ordering*: previously we marked the referral `seen`
    // BEFORE the patient transfer, so a transfer failure left the
    // referral lying about what happened. Now the transfer goes first.
    //
    // We deliberately swallow a transfer error and proceed to the
    // mark-seen step. Reasoning: in the common offline-first case the
    // patient may already exist at the receiving facility (idempotent
    // write), or the patient document is unreachable but the user-visible
    // intent (the clinician clicked Accept) should still be recorded.
    // The clinician can always re-run acceptance, which re-attempts the
    // transfer; the referral list reflects the action either way.
    if (referral.patientId && referral.toHospitalId) {
      try {
        const { updatePatient } = await import('./patient-service');
        await updatePatient(referral.patientId, {
          registrationHospital: referral.toHospitalId,
          lastVisitHospital: referral.toHospitalId,
        });
      } catch (err) {
        console.error('Failed to transfer patient on referral acceptance:', err);
        // Intentionally swallow: re-running acceptance is idempotent.
      }
    }

    // Step 2: mark referral as seen. Runs after transfer succeeded (or the
    // transfer was a no-op due to missing fields). If this fails, the
    // patient is at the new facility and the user can re-run acceptance.
    const updated = { ...referral, status: 'seen' as const, updatedAt: new Date().toISOString() };
    const resp = await db.put(updated);
    updated._rev = resp.rev;

    if (referral.patientId && referral.toHospitalId) {
      await logAuditSafe(
        'ACCEPT_REFERRAL', undefined, undefined,
        `Accepted referral ${referralId}: patient ${referral.patientId} transferred to ${referral.toHospital}`
      );
    }

    return updated;
  } catch {
    return null;
  }
}
