/**
 * Token revocation store — server-side.
 *
 * When a user logs out (or their session is force-revoked) we add the
 * session JWT to this store. Every authenticated request — both the page
 * middleware and the /api/auth/me bootstrap — consults the store before
 * trusting a presented token, so a logged-out session can't be replayed
 * even while the JWT itself is still inside its 8-hour `exp` window.
 *
 * Design choices:
 *
 *   - Keyed by the full JWT string (not the jti) so we don't have to
 *     re-issue every existing token to add a jti claim. Forged tokens
 *     never reach this layer because verifyToken() checks the HMAC first.
 *   - Stores the JWT's `exp` (unix seconds) alongside each entry. Entries
 *     past their exp are evicted lazily on every read and proactively on
 *     a 60-second sweep — once a token is expired it can't be replayed
 *     anyway, so keeping it in the blacklist is wasted memory.
 *   - Persisted to a gitignored JSON file on every write so a server
 *     restart doesn't reset the revocation list. The path is configurable
 *     via TOKEN_BLACKLIST_FILE for tests and tuning.
 *   - Single-process today; the persistence layer is small enough that
 *     swapping to Redis (per the rate-limiting ticket) means replacing
 *     this one file, not touching every caller.
 *
 * NOT a replacement for short JWT lifetimes — it complements them.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

interface RevocationEntry {
  /** Unix epoch *seconds* when the JWT itself expires. */
  expSec: number;
}

const SWEEP_INTERVAL_MS = 60_000;
const PERSIST_DEBOUNCE_MS = 250;

let store: Map<string, RevocationEntry> | null = null;
let loadPromise: Promise<void> | null = null;
let persistTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;

function filePath(): string {
  const override = process.env.TOKEN_BLACKLIST_FILE;
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), '.token-blacklist.json');
}

async function loadFromDisk(): Promise<Map<string, RevocationEntry>> {
  try {
    const raw = await fs.readFile(filePath(), 'utf8');
    const json = raw.replace(/^\s*#[^\n]*\n/, '');
    const parsed = JSON.parse(json) as Record<string, RevocationEntry>;
    const m = new Map<string, RevocationEntry>();
    const nowSec = Math.floor(Date.now() / 1000);
    for (const [token, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.expSec !== 'number') continue;
      if (entry.expSec <= nowSec) continue; // already expired — skip
      m.set(token, entry);
    }
    return m;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return new Map();
    console.warn('[token-blacklist] failed to load persisted entries; starting empty.', err);
    return new Map();
  }
}

async function ensureLoaded(): Promise<void> {
  if (store) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    store = await loadFromDisk();
    if (!sweepTimer) {
      sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
      sweepTimer.unref?.();
    }
  })();
  return loadPromise;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
  persistTimer.unref?.();
}

async function persistNow(): Promise<void> {
  if (!store) return;
  try {
    const obj: Record<string, RevocationEntry> = {};
    for (const [t, e] of store.entries()) obj[t] = e;
    const body =
      '# TamamHealth token blacklist — gitignored, do not commit.\n' +
      JSON.stringify(obj) +
      '\n';
    await fs.writeFile(filePath(), body, { mode: 0o600 });
  } catch (err) {
    console.error('[token-blacklist] failed to persist:', err);
  }
}

function sweep(): void {
  if (!store) return;
  const nowSec = Math.floor(Date.now() / 1000);
  let dropped = 0;
  for (const [t, e] of store.entries()) {
    if (e.expSec <= nowSec) {
      store.delete(t);
      dropped++;
    }
  }
  if (dropped > 0) schedulePersist();
}

/**
 * Best-effort extraction of the JWT `exp` claim. Doesn't verify the signature
 * — by the time we revoke a token we have already verified it (login or the
 * caller's own verifyToken). If the JWT is malformed, fall back to "now + 8h"
 * so the entry still has an upper bound on its lifetime.
 */
function readExpFromJwt(token: string): number {
  const fallback = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const parts = token.split('.');
  if (parts.length !== 3) return fallback;
  try {
    // Accept both base64 and base64url; pad as needed.
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(padded, 'base64').toString('utf8'),
    ) as { exp?: number };
    if (typeof payload.exp === 'number' && payload.exp > 0) return payload.exp;
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * Mark a token as revoked. The store is durable across server restarts —
 * once added, the token cannot be replayed until its `exp` passes.
 */
export async function revokeToken(token: string): Promise<void> {
  if (!token) return;
  await ensureLoaded();
  const expSec = readExpFromJwt(token);
  store!.set(token, { expSec });
  schedulePersist();
}

/**
 * True if the token has been revoked AND has not yet expired. Lazy-evicts
 * an entry that has aged past its `exp`.
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  if (!token) return false;
  await ensureLoaded();
  const entry = store!.get(token);
  if (!entry) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (entry.expSec <= nowSec) {
    store!.delete(token);
    schedulePersist();
    return false;
  }
  return true;
}

/**
 * Test-only helper. Resets the in-memory cache so the next call reloads
 * from disk (or, with TOKEN_BLACKLIST_FILE pointed at a tmp file, gives
 * each test an isolated store).
 */
export function _resetTokenBlacklistForTest(): void {
  store = null;
  loadPromise = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

/** Test-only helper. Force-flush the debounced persist queue. */
export async function _flushTokenBlacklistForTest(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await persistNow();
}
