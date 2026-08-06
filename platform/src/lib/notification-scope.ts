/**
 * Whose notification is it?
 *
 * The feed used to be facility-wide for everyone, so a doctor opened the bell
 * to every future appointment in the hospital and every result that had come
 * back for anybody — five hundred rows, of which a handful were theirs. A feed
 * that large is not a feed: nobody reads it, so the one row that mattered is
 * missed as reliably as if it had never been raised.
 *
 * Two rules keep it honest:
 *
 *   1. Only clinicians get a personal feed. A receptionist, a triage nurse, a
 *      lab tech and a pharmacist are each responsible for the whole floor —
 *      narrowing their feed to "patients assigned to me" would hide the work
 *      their job actually consists of.
 *
 *   2. Critical never filters. An unreviewed critical result reaches every
 *      clinician whether or not their name is on the order, because the cost of
 *      showing it to the wrong doctor is a moment's attention and the cost of
 *      hiding it from the right one is a patient. Ownership decides what is
 *      *routine* enough to leave out.
 */

import type { UserRole } from './db-types';

/**
 * Roles that carry a named panel of patients, and so get a feed narrowed to it.
 * Everyone else covers the floor and keeps the facility-wide view.
 */
const PERSONAL_FEED_ROLES: readonly UserRole[] = ['doctor', 'clinical_officer', 'clinician'] as const;

export function hasPersonalFeed(role?: UserRole | string): boolean {
  return !!role && (PERSONAL_FEED_ROLES as readonly string[]).includes(role);
}

export interface FeedViewer {
  _id?: string;
  name?: string;
  username?: string;
  role?: UserRole | string;
}

/** The record's claim on a user: an id where one is stored, else the name. */
export interface RecordOwner {
  /** e.g. AppointmentDoc.providerId. */
  ownerId?: string;
  /** e.g. LabResultDoc.orderedBy, which is free text rather than an id. */
  ownerName?: string;
}

/** Does this record name the viewer as its clinician? */
export function isOwnedByViewer(owner: RecordOwner, viewer: FeedViewer | null | undefined): boolean {
  if (!viewer) return false;
  if (owner.ownerId && viewer._id && owner.ownerId === viewer._id) return true;
  if (!owner.ownerName) return false;
  // Names are compared case-insensitively and trimmed: `orderedBy` is typed by
  // whoever placed the order, so "Dr. Peter Garang Deng " and the account's
  // stored name differ by punctuation more often than by person.
  const recorded = owner.ownerName.trim().toLowerCase();
  return [viewer.name, viewer.username]
    .some(candidate => !!candidate && candidate.trim().toLowerCase() === recorded);
}

/**
 * Should this row reach this viewer? The single test every filtered source
 * calls, so the safety carve-out for critical lives in exactly one place.
 */
export function isForViewer(
  row: RecordOwner & { severity?: 'critical' | 'warning' | 'info' },
  viewer: FeedViewer | null | undefined,
): boolean {
  if (!hasPersonalFeed(viewer?.role)) return true;
  if (row.severity === 'critical') return true;
  return isOwnedByViewer(row, viewer);
}
