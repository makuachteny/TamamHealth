/**
 * Tests for the persisted token revocation store in lib/token-blacklist.ts.
 *
 * Each test points the store at a fresh tmp file via the
 * TOKEN_BLACKLIST_FILE env var, then resets the in-memory cache between
 * cases so the store reloads from disk.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  revokeToken,
  isTokenRevoked,
  _resetTokenBlacklistForTest,
  _flushTokenBlacklistForTest,
} from '@/lib/token-blacklist';

let tokenCounter = 0;

/**
 * Build a JWT-shaped string with a payload claiming a specific `exp`. Each
 * call gets a unique `jti` so two tokens with the same expiry are still
 * distinct strings.
 */
function buildToken(expSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user-x', exp: expSec, jti: `t-${++tokenCounter}` }),
  ).toString('base64url');
  return `${header}.${payload}.signature-not-checked-at-this-layer`;
}

describe('token-blacklist (persisted)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tamam-blacklist-'));
    process.env.TOKEN_BLACKLIST_FILE = path.join(tmpDir, '.token-blacklist.json');
    _resetTokenBlacklistForTest();
  });

  afterEach(async () => {
    _resetTokenBlacklistForTest();
    delete process.env.TOKEN_BLACKLIST_FILE;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('a fresh token is not revoked', async () => {
    const t = buildToken(Math.floor(Date.now() / 1000) + 3600);
    await expect(isTokenRevoked(t)).resolves.toBe(false);
  });

  it('after revoke, the same token reads as revoked', async () => {
    const t = buildToken(Math.floor(Date.now() / 1000) + 3600);
    await revokeToken(t);
    await expect(isTokenRevoked(t)).resolves.toBe(true);
  });

  it('revoking does not blacklist a different token', async () => {
    const t1 = buildToken(Math.floor(Date.now() / 1000) + 3600);
    const t2 = buildToken(Math.floor(Date.now() / 1000) + 3600);
    await revokeToken(t1);
    await expect(isTokenRevoked(t2)).resolves.toBe(false);
  });

  it('a revocation persists across an in-process restart (file-backed)', async () => {
    const t = buildToken(Math.floor(Date.now() / 1000) + 3600);
    await revokeToken(t);
    await _flushTokenBlacklistForTest();

    // Simulate the process restarting: clear the in-memory cache. The next
    // isTokenRevoked() call must reload from disk and still see the entry.
    _resetTokenBlacklistForTest();

    await expect(isTokenRevoked(t)).resolves.toBe(true);
  });

  it('an entry whose exp is past now is not considered revoked (lazy eviction)', async () => {
    const expired = buildToken(Math.floor(Date.now() / 1000) - 60);
    await revokeToken(expired);
    await expect(isTokenRevoked(expired)).resolves.toBe(false);
  });

  it('expired entries do not leak across a process restart', async () => {
    const expired = buildToken(Math.floor(Date.now() / 1000) - 60);
    await revokeToken(expired);
    await _flushTokenBlacklistForTest();
    _resetTokenBlacklistForTest();
    await expect(isTokenRevoked(expired)).resolves.toBe(false);
  });

  it('the store does not flush itself on size growth (the old MAX_SIZE bug)', async () => {
    // Add 5,000 distinct revoked tokens. The previous in-memory implementation
    // hit MAX_SIZE=1000 and called Set.clear() — a denial-of-revocation: an
    // attacker could log in 1,000 times to flush the blacklist, replaying
    // any previously-revoked token. Make sure that's gone.
    const expSec = Math.floor(Date.now() / 1000) + 3600;
    const tokens: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const t = buildToken(expSec);
      tokens.push(t);
      await revokeToken(t);
    }
    // Spot-check the first, middle, and last — each must still be revoked.
    await expect(isTokenRevoked(tokens[0])).resolves.toBe(true);
    await expect(isTokenRevoked(tokens[2500])).resolves.toBe(true);
    await expect(isTokenRevoked(tokens[4999])).resolves.toBe(true);
  });

  it('isTokenRevoked is safe on an empty token', async () => {
    await expect(isTokenRevoked('')).resolves.toBe(false);
  });

  it('revokeToken is safe on an empty token (no-op)', async () => {
    await revokeToken('');
    await expect(isTokenRevoked('')).resolves.toBe(false);
  });

  it('a malformed JWT still gets a fallback expiry, not an immediate eviction', async () => {
    // The old code stored everything indefinitely. The new code parses the
    // exp claim — but a malformed JWT must still be tracked, otherwise an
    // attacker could craft one to bypass revocation.
    const garbage = 'not.a.real.jwt';
    await revokeToken(garbage);
    await expect(isTokenRevoked(garbage)).resolves.toBe(true);
  });
});
