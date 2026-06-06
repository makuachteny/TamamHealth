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

/** Canonical roster of seeded demo usernames + the role they get assigned. */
export interface SeedUserProfile {
  username: string;
  name: string;
  role: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

const PUBLIC_ORG_ID = 'org-moh-ss';
const PRIVATE_ORG_ID = 'org-mercy-hospital';

export const DEMO_USER_PROFILES: SeedUserProfile[] = [
  { username: 'superadmin',      name: 'TamamHealth Platform Admin', role: 'super_admin' },
  { username: 'admin',           name: 'Ministry of Health',         role: 'government',             orgId: PUBLIC_ORG_ID },
  { username: 'dr.wani',         name: 'Dr. James Wani Igga',        role: 'doctor',                 hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'dr.achol',        name: 'Dr. Achol Mayen Deng',       role: 'doctor',                 hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'co.deng',         name: 'CO Deng Mabior Kuol',        role: 'clinical_officer',       hospitalId: 'hosp-002', hospitalName: 'Wau State Hospital',         orgId: PUBLIC_ORG_ID },
  { username: 'nurse.stella',    name: 'Nurse Stella Keji Lemi',     role: 'nurse',                  hospitalId: 'hosp-003', hospitalName: 'Malakal Teaching Hospital',  orgId: PUBLIC_ORG_ID },
  { username: 'lab.gatluak',     name: 'Lab Tech Gatluak Puok',      role: 'lab_tech',               hospitalId: 'hosp-004', hospitalName: 'Bentiu State Hospital',      orgId: PUBLIC_ORG_ID },
  { username: 'pharma.rose',     name: 'Pharmacist Rose Gbudue',     role: 'pharmacist',             hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'desk.amira',      name: 'Amira Juma Hassan',          role: 'front_desk',             hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'bhw.akol',        name: 'Akol Deng Mading',           role: 'boma_health_worker',     hospitalId: 'phcu-001', hospitalName: 'Kajo-keji Boma PHCU',        orgId: PUBLIC_ORG_ID },
  { username: 'sup.mary',        name: 'Mary Lado Kenyi',            role: 'payam_supervisor',       hospitalId: 'phcc-001', hospitalName: 'Kajo-keji PHCC',             orgId: PUBLIC_ORG_ID },
  { username: 'data.ayen',       name: 'Ayen Dut Malual',            role: 'data_entry_clerk',       hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'supt.lado',       name: 'Dr. Lado Tombe Kenyi',       role: 'medical_superintendent', hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'manager.aluel',   name: 'Aluel Bol Maker',            role: 'hospital_manager',       hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'biller.nyandeng', name: 'Nyandeng Chol Atem',         role: 'medical_biller',         hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'hrio.dut',        name: 'Dut Machar Kuol',            role: 'hrio',                   hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'chv.ajak',        name: 'Ajak Deng Mawien',           role: 'community_health_volunteer', hospitalId: 'phcu-001', hospitalName: 'Kajo-keji Boma PHCU',    orgId: PUBLIC_ORG_ID },
  { username: 'nutr.nyabol',     name: 'Nyabol Koang Jal',           role: 'nutritionist',           hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'rad.tamamhealth', name: 'TamamHealth Ladu Soro',      role: 'radiologist',            hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'midwife.nyakong', name: 'Midwife Nyakong Gatkuoth',    role: 'midwife',                hospitalId: 'hosp-003', hospitalName: 'Malakal Teaching Hospital',  orgId: PUBLIC_ORG_ID },
  { username: 'cashier.deng',    name: 'Deng Akec Ring',             role: 'cashier',                hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PUBLIC_ORG_ID },
  { username: 'county.lopez',    name: 'Dr. Lopez Lokai Modi',       role: 'county_health_director',                                                                     orgId: PUBLIC_ORG_ID },
  { username: 'org.admin',       name: 'Mercy Org Administrator',    role: 'org_admin',                                                                                  orgId: PRIVATE_ORG_ID },
  { username: 'dr.mercy',        name: 'Dr. Grace Lado',             role: 'doctor',                 hospitalId: 'hosp-001', hospitalName: 'Juba Teaching Hospital',     orgId: PRIVATE_ORG_ID },
];

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
