/**
 * Server-safe user registry for API route authentication.
 *
 * PouchDB (pouchdb-browser) cannot run in Node.js API routes because it
 * references `self` (a browser global). This module provides a static user
 * roster (DEMO_USER_PROFILES) and verifies passwords against
 * `seed-credentials.ts`, which lazily generates and persists random
 * passwords on first boot. There is no plaintext password in this file.
 */

import bcrypt from 'bcryptjs';
import { DEMO_USER_PROFILES, getOrCreateSeedCredentials } from './seed-credentials';

export interface ServerUser {
  _id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
  /** ISO 3166-1 alpha-2 — facility's country (e.g. "SS" for South Sudan). */
  countryId?: string;
  /** Geographic tier fields for sub-org scoping (P0 tier-isolation). */
  payam?: string;
  county?: string;
  state?: string;
  isActive: boolean;
}

const profileByUsername = new Map(DEMO_USER_PROFILES.map(p => [p.username, p]));

// Per-username bcrypt-hash cache. Each entry remembers which plaintext we
// hashed against, so a regenerated password file invalidates automatically.
const hashCache: Record<string, { plaintext: string; hash: string }> = {};

async function getHash(username: string, plaintext: string): Promise<string> {
  const cached = hashCache[username];
  if (cached && cached.plaintext === plaintext) return cached.hash;
  const hash = await bcrypt.hash(plaintext, 12);
  hashCache[username] = { plaintext, hash };
  return hash;
}

/**
 * Look up a user by username and verify the password — server-safe.
 */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<ServerUser | null> {
  const profile = profileByUsername.get(username);
  if (!profile) {
    // Constant-time: still run a hash so a non-existent user takes roughly
    // the same time as a valid one. Prevents trivial username enumeration.
    await bcrypt.hash(password, 12);
    return null;
  }

  const credentials = await getOrCreateSeedCredentials();
  const expected = credentials.passwords[username];
  if (!expected) {
    await bcrypt.hash(password, 12);
    return null;
  }

  const hash = await getHash(username, expected);
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return null;

  return {
    _id: `user-${profile.username}`,
    username: profile.username,
    passwordHash: hash,
    name: profile.name,
    role: profile.role,
    hospitalId: profile.hospitalId,
    hospitalName: profile.hospitalName,
    orgId: profile.orgId,
    isActive: true,
  };
}
