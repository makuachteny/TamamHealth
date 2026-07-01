/**
 * Server-only credential generator for seeded users.
 *
 * Demo and dev installations need plaintext passwords for the canned user
 * accounts ("dr.wani", "nurse.stella", etc.) so the staging environment is
 * usable. Hardcoding those plaintexts in source — even behind
 * NEXT_PUBLIC_DEMO_MODE — leaks them to every shipped JS bundle.
 *
 * This module instead generates a random password per username on first run
 * and persists the username → plaintext mapping to a single gitignored file
 * (`.seed-credentials.json` by default). Subsequent boots reuse the file so
 * the same passwords keep working across server restarts.
 *
 * Consumers:
 *   - `server-users.ts`              — reads to verify logins.
 *   - `/api/demo-credentials` route  — surfaces the map to the browser seed
 *                                      and the demo-accounts dropdown
 *                                      (only when NEXT_PUBLIC_DEMO_MODE !== 'false').
 *
 * NEVER import this from the browser. It uses `node:fs` and the import
 * graph treats this file as server-only — pulling it into a Client Component
 * would break the build at bundle time.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEMO_USER_PROFILES, type DemoUserProfile } from './demo-users';
import { getDemoPasswordMap } from './demo-passwords';

/** Canonical roster of seeded demo usernames + the role they get assigned. */
export type SeedUserProfile = DemoUserProfile;
export { DEMO_USER_PROFILES };

const DEMO_USERNAMES = DEMO_USER_PROFILES.map(p => p.username);

interface CredentialsFile {
  generatedAt: string;
  passwords: Record<string, string>;
}

const FILE_VERSION_HEADER = '# TamamHealth seed credentials — generated, gitignored, do not commit.\n';

function credentialsFilePath(): string {
  const override = process.env.SEED_CREDENTIALS_FILE;
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), '.seed-credentials.json');
}

/**
 * 24-character random password from a URL-safe alphabet, generated via the
 * Node CSPRNG. Avoids look-alike characters (0/O, 1/l/I) so the password can
 * be read off a console without ambiguity.
 */
function generatePassword(length = 24): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * Deterministically derive a password for `username` from a server-only
 * secret. Because the secret is identical on every instance (it's an env
 * var), every instance computes the SAME password — no shared file required.
 *
 * This is what makes seeded logins consistent on horizontally-scaled / read-
 * only-FS hosts (e.g. Vercel serverless), where the old random-per-instance
 * file approach left the browser seed and the login verifier disagreeing.
 * Uses a readable alphabet (no look-alike chars) so creds are console-safe.
 */
function deterministicPassword(username: string, secret: string, length = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const mac = crypto.createHmac('sha256', secret).update(`seed-password:${username}`).digest();
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[mac[i] % alphabet.length];
  }
  return out;
}

let cache: CredentialsFile | null = null;
let inflight: Promise<CredentialsFile> | null = null;

async function readFile(): Promise<CredentialsFile | null> {
  try {
    const raw = await fs.readFile(credentialsFilePath(), 'utf8');
    // Tolerate the version comment at the top of the file.
    const json = raw.replace(/^\s*#[^\n]*\n/, '');
    const parsed = JSON.parse(json) as CredentialsFile;
    if (!parsed.passwords || typeof parsed.passwords !== 'object') return null;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function writeFile(data: CredentialsFile): Promise<void> {
  const filePath = credentialsFilePath();
  const body = FILE_VERSION_HEADER + JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(filePath, body, { mode: 0o600 });
}

function logFreshGeneration(filePath: string, demoMode: boolean): void {
  const banner = demoMode
    ? 'TamamHealth demo credentials generated'
    : 'TamamHealth bootstrap admin credential generated';
  console.log('');
  console.log('  ============================================================');
  console.log(`  ${banner}`);
  console.log(`  File: ${filePath}`);
  console.log('  Mode: 0600 (owner read/write only). Do not commit.');
  console.log('  ============================================================');
  console.log('');
}

/**
 * Returns the username → plaintext-password map for seeded users, generating
 * and persisting it on first run. Idempotent and concurrency-safe (single
 * inflight read+write).
 */
export async function getOrCreateSeedCredentials(): Promise<CredentialsFile> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
    const expectedUsers = demoMode ? DEMO_USERNAMES : ['admin'];

    if (demoMode) {
      cache = {
        generatedAt: '1970-01-01T00:00:00.000Z',
        passwords: getDemoPasswordMap(),
      };
      inflight = null;
      return cache;
    }

    // Deterministic mode (serverless-safe). When SEED_CREDENTIALS_SECRET is
    // set, derive every password from it instead of generating random ones and
    // persisting a file. All instances then agree on the same credentials, so
    // the browser seed, the demo-accounts dropdown, and the login verifier
    // stay consistent across the platform — no shared/writable filesystem
    // required. `admin` still honours an explicit ADMIN_INITIAL_PASSWORD.
    const secret = process.env.SEED_CREDENTIALS_SECRET;
    if (secret) {
      const adminOverride = process.env.ADMIN_INITIAL_PASSWORD;
      const passwords: Record<string, string> = {};
      for (const username of expectedUsers) {
        passwords[username] = username === 'admin' && adminOverride
          ? adminOverride
          : deterministicPassword(username, secret);
      }
      cache = { generatedAt: '1970-01-01T00:00:00.000Z', passwords };
      inflight = null;
      return cache;
    }

    const existing = await readFile();
    let next: CredentialsFile;
    let touched = !existing;

    if (existing) {
      next = { generatedAt: existing.generatedAt, passwords: { ...existing.passwords } };
      // Fill in any users missing from a stale file (e.g. a new role added).
      for (const username of expectedUsers) {
        if (!next.passwords[username]) {
          next.passwords[username] = generatePassword();
          touched = true;
        }
      }
    } else {
      next = { generatedAt: new Date().toISOString(), passwords: {} };
      // Honour an operator-supplied admin password the first time we generate.
      const adminOverride = process.env.ADMIN_INITIAL_PASSWORD;
      for (const username of expectedUsers) {
        if (username === 'admin' && adminOverride) {
          next.passwords[username] = adminOverride;
        } else {
          next.passwords[username] = generatePassword();
        }
      }
    }

    if (touched) {
      await writeFile(next);
      logFreshGeneration(credentialsFilePath(), demoMode);
    }

    cache = next;
    inflight = null;
    return next;
  })();

  return inflight;
}

/** Test/development hook — clears the in-memory cache. */
export function _resetSeedCredentialsCache(): void {
  cache = null;
  inflight = null;
}

/** Plain-text lookup for one username. Returns undefined if not seeded. */
export async function getSeedPasswordFor(username: string): Promise<string | undefined> {
  const file = await getOrCreateSeedCredentials();
  return file.passwords[username];
}
