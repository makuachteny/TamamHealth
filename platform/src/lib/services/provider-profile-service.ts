/**
 * Provider profiles — the public face of a clinician.
 *
 * Deliberately a separate document from `UserDoc`: that record carries
 * `passwordHash` and `pinHash`, and the public booking endpoints read from
 * here. Keeping them apart means an over-broad read on the public path can
 * only ever leak things a clinician chose to publish.
 *
 * Nothing is public until `isPublished` is true. An unpublished profile is a
 * draft an admin is still filling in, and the read helpers used by the public
 * routes never return one.
 */

import { providerProfilesDB } from '../db';
import type { ProviderProfileDoc } from '../db-types-booking';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { findByType } from './db-query';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { slugify } from './visit-reason-service';
import { v4 as uuidv4 } from 'uuid';

/** Everything an admin may set. `userId`/`orgId` anchor the row and are fixed. */
export type ProviderProfileInput = Partial<
  Omit<ProviderProfileDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'userId' | 'orgId'>
>;

async function allProfiles(): Promise<ProviderProfileDoc[]> {
  try {
    return await findByType<ProviderProfileDoc>(providerProfilesDB(), 'provider_profile');
  } catch {
    // No profiles database yet — an org that has never opened the booking
    // settings screen. Nothing published is the correct answer, not an error.
    return [];
  }
}

/** Every profile the caller's scope can see, published or not. For admin UI. */
export async function getAllProviderProfiles(scope?: DataScope): Promise<ProviderProfileDoc[]> {
  const rows = await allProfiles();
  return scope ? filterByScope(rows, scope) : rows;
}

export async function getProviderProfileByUserId(userId: string): Promise<ProviderProfileDoc | null> {
  const rows = await allProfiles();
  return rows.find(p => p.userId === userId) ?? null;
}

/**
 * Published profiles for one org, optionally narrowed to a facility.
 *
 * This is the read the public practice page uses, so the `isPublished` filter
 * is applied here rather than left to the caller — a new call site cannot
 * forget it and expose a draft.
 */
export async function getPublishedProfiles(
  orgId: string,
  facilityId?: string,
): Promise<ProviderProfileDoc[]> {
  const rows = await allProfiles();
  return rows
    .filter(p => p.orgId === orgId && p.isPublished)
    .filter(p => !facilityId || p.facilityIds.includes(facilityId))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** One published profile by its URL segment. Drafts return null. */
export async function getPublishedProfileBySlug(
  orgId: string,
  slug: string,
): Promise<ProviderProfileDoc | null> {
  const rows = await allProfiles();
  return rows.find(p => p.orgId === orgId && p.publicSlug === slug && p.isPublished) ?? null;
}

/**
 * A slug that is free within the org.
 *
 * Two "Dr. James Wani"s in one practice is not a hypothetical, and the loser of
 * that collision would silently overwrite the winner's public URL.
 */
export async function uniqueSlug(orgId: string, displayName: string, selfId?: string): Promise<string> {
  const base = slugify(displayName) || 'provider';
  const rows = await allProfiles();
  const taken = new Set(
    rows.filter(p => p.orgId === orgId && p._id !== selfId).map(p => p.publicSlug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${uuidv4().slice(0, 6)}`;
}

export async function saveProviderProfile(
  userId: string,
  orgId: string,
  input: ProviderProfileInput,
  actorId?: string,
  actorName?: string,
): Promise<ProviderProfileDoc> {
  const db = providerProfilesDB();
  const existing = await getProviderProfileByUserId(userId);
  const now = new Date().toISOString();

  const displayName = input.displayName ?? existing?.displayName ?? '';
  const publicSlug = input.publicSlug
    || existing?.publicSlug
    || await uniqueSlug(orgId, displayName, existing?._id);

  const doc: ProviderProfileDoc = {
    ...(existing ?? {
      _id: `provider-profile-${uuidv4()}`,
      type: 'provider_profile' as const,
      createdAt: now,
    }),
    type: 'provider_profile',
    userId,
    orgId,
    publicSlug,
    displayName,
    credentials: input.credentials ?? existing?.credentials,
    specialtyLabel: input.specialtyLabel ?? existing?.specialtyLabel ?? '',
    photoUrl: input.photoUrl ?? existing?.photoUrl,
    bio: input.bio ?? existing?.bio,
    languages: input.languages ?? existing?.languages ?? [],
    acceptingNewPatients: input.acceptingNewPatients ?? existing?.acceptingNewPatients ?? true,
    facilityIds: input.facilityIds ?? existing?.facilityIds ?? [],
    isPublished: input.isPublished ?? existing?.isPublished ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as ProviderProfileDoc;

  await db.put(doc);

  // Publication is the interesting event — it is the moment a clinician's name,
  // photo and bio become readable by anyone with the link — so it is audited
  // distinctly from an ordinary edit.
  const published = doc.isPublished && !existing?.isPublished;
  const unpublished = !doc.isPublished && existing?.isPublished;
  await logAuditSafe(
    published ? 'PUBLISH_PROVIDER_PROFILE'
      : unpublished ? 'UNPUBLISH_PROVIDER_PROFILE'
        : existing ? 'UPDATE_PROVIDER_PROFILE' : 'CREATE_PROVIDER_PROFILE',
    actorId, actorName,
    `Provider profile ${doc.displayName} (/${doc.publicSlug}) — ${doc.isPublished ? 'public' : 'draft'}`,
  );
  emitSyncEvent({
    resourceType: 'provider_profile',
    resourceId: doc._id,
    operation: existing ? 'update' : 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
  });
  return doc;
}

/** Flip publication without touching anything else. */
export async function setProviderProfilePublished(
  userId: string,
  orgId: string,
  isPublished: boolean,
  actorId?: string,
  actorName?: string,
): Promise<ProviderProfileDoc> {
  return saveProviderProfile(userId, orgId, { isPublished }, actorId, actorName);
}
