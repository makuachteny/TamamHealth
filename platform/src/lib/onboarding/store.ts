// Persistence for first-run onboarding progress.
//
// Source of truth is the user's (synced) PouchDB doc, so progress follows the
// user across devices. We also mirror to localStorage for an instant,
// offline-safe read on load and so progress survives even when the local user
// doc isn't present (e.g. an API-only login against a browser DB that was never
// seeded). Reads prefer the doc when available and fall back to the mirror.

'use client';

import type { OnboardingState, UserDoc } from '../db-types';
import { usersDB } from '../db';

const EMPTY: OnboardingState = { completedStepIds: [] };

function lsKey(userId: string): string {
  return `tamamhealth.onboarding.${userId}`;
}

function readMirror(userId: string): OnboardingState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(lsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingState;
    if (!Array.isArray(parsed.completedStepIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMirror(userId: string, state: OnboardingState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lsKey(userId), JSON.stringify(state));
  } catch {
    // best-effort
  }
}

/** Load onboarding state, preferring the synced user doc, falling back to the
 *  localStorage mirror, then to an empty state. Never throws. */
export async function loadOnboardingState(userId: string): Promise<OnboardingState> {
  try {
    const doc = (await usersDB().get(userId)) as UserDoc;
    if (doc.onboarding && Array.isArray(doc.onboarding.completedStepIds)) {
      writeMirror(userId, doc.onboarding); // keep the mirror fresh
      return doc.onboarding;
    }
  } catch {
    // doc missing / offline — fall through to the mirror
  }
  return readMirror(userId) ?? { ...EMPTY };
}

/**
 * Merge a partial update into the stored state and persist it. Writes the
 * mirror synchronously-ish (best-effort) and the user doc when present. Returns
 * the merged state so callers can update React state optimistically.
 */
export async function saveOnboardingState(
  userId: string,
  patch: Partial<OnboardingState>,
): Promise<OnboardingState> {
  const current = await loadOnboardingState(userId);
  const next: OnboardingState = { ...current, ...patch };
  // Always mirror — this is what guarantees persistence regardless of whether
  // the local user doc exists.
  writeMirror(userId, next);

  // Best-effort write-through to the synced user doc. A 404 (no local doc) or
  // a transient conflict just means this device relies on the mirror until the
  // doc syncs in; onboarding state is non-critical, so we never surface errors.
  try {
    const db = usersDB();
    const doc = (await db.get(userId)) as UserDoc;
    const updated: UserDoc = {
      ...doc,
      onboarding: next,
      updatedAt: new Date().toISOString(),
    };
    await db.put(updated);
  } catch {
    // best-effort — mirror already holds the truth for this device
  }

  return next;
}
