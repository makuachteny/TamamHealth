/**
 * Tests for the HMAC-bound CSRF token mint/verify in lib/csrf.ts.
 *
 * Covers:
 *   - mint produces token verifiable for the same subject
 *   - mint produces a *different* token each call (nonce randomness)
 *   - tokens issued for one subject don't verify for another
 *   - tampered signatures fail
 *   - malformed tokens fail safely
 */

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test'; // 40 chars

import { mintCsrfToken, verifyCsrfToken } from '@/lib/csrf';

describe('CSRF token', () => {
  it('mint produces a token that verifies for the same subject', async () => {
    const token = await mintCsrfToken('user-dr.wani');
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(verifyCsrfToken(token, 'user-dr.wani')).resolves.toBe(true);
  });

  it('mint produces a different token each call (random nonce)', async () => {
    const a = await mintCsrfToken('user-dr.wani');
    const b = await mintCsrfToken('user-dr.wani');
    expect(a).not.toBe(b);
    // Both still verify.
    await expect(verifyCsrfToken(a, 'user-dr.wani')).resolves.toBe(true);
    await expect(verifyCsrfToken(b, 'user-dr.wani')).resolves.toBe(true);
  });

  it('a token issued for user A does NOT verify for user B', async () => {
    const tokenA = await mintCsrfToken('user-dr.wani');
    await expect(verifyCsrfToken(tokenA, 'user-dr.achol')).resolves.toBe(false);
  });

  it('a tampered signature does not verify', async () => {
    const token = await mintCsrfToken('user-dr.wani');
    const dot = token.indexOf('.');
    const tampered = token.slice(0, dot + 1) + 'A' + token.slice(dot + 2);
    await expect(verifyCsrfToken(tampered, 'user-dr.wani')).resolves.toBe(false);
  });

  it('a tampered nonce does not verify (HMAC binds nonce + sub)', async () => {
    const token = await mintCsrfToken('user-dr.wani');
    const dot = token.indexOf('.');
    const tampered = 'X' + token.slice(1, dot) + token.slice(dot);
    await expect(verifyCsrfToken(tampered, 'user-dr.wani')).resolves.toBe(false);
  });

  it.each([
    ['', 'empty token'],
    ['no-dot-here', 'no separator'],
    ['.justasig', 'empty nonce'],
    ['nonce.', 'empty signature'],
    ['nonce.!!!not-base64', 'invalid base64 sig'],
  ])('malformed token (%s) returns false safely', async (token) => {
    await expect(verifyCsrfToken(token, 'user-dr.wani')).resolves.toBe(false);
  });

  it('an empty subject is refused', async () => {
    const token = await mintCsrfToken('user-dr.wani');
    await expect(verifyCsrfToken(token, '')).resolves.toBe(false);
  });
});
