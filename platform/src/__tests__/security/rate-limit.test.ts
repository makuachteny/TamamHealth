/**
 * Tests for the centralised rate limiter in lib/rate-limit.ts.
 *
 * The Upstash backend is exercised by stubbing global.fetch — we never hit
 * a real Redis. The in-memory backend runs whenever the Upstash env vars
 * are absent.
 *
 * Covers:
 *   - limit enforcement (requests beyond `limit` get `allowed: false`)
 *   - window roll (counter resets after `windowMs` elapses)
 *   - reset (resetRateLimit clears the bucket)
 *   - graceful degradation to in-memory when Upstash env is unset
 *   - Upstash 5xx fail-open
 *   - keys with the same logical input share state regardless of hash
 */

describe('rate-limit (in-memory fallback)', () => {
  let rateLimit: typeof import('@/lib/rate-limit').rateLimit;
  let resetRateLimit: typeof import('@/lib/rate-limit').resetRateLimit;
  let _resetRateLimitForTest: typeof import('@/lib/rate-limit')._resetRateLimitForTest;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/rate-limit');
    rateLimit = mod.rateLimit;
    resetRateLimit = mod.resetRateLimit;
    _resetRateLimitForTest = mod._resetRateLimitForTest;
    _resetRateLimitForTest();
  });

  it('allows up to `limit` requests, then denies', async () => {
    const opts = { key: 'login:user:dr.wani', limit: 3, windowMs: 60_000 };

    const v1 = await rateLimit(opts);
    expect(v1.allowed).toBe(true);
    expect(v1.remaining).toBe(2);

    const v2 = await rateLimit(opts);
    expect(v2.allowed).toBe(true);
    expect(v2.remaining).toBe(1);

    const v3 = await rateLimit(opts);
    expect(v3.allowed).toBe(true);
    expect(v3.remaining).toBe(0);

    // Fourth request crosses the limit.
    const v4 = await rateLimit(opts);
    expect(v4.allowed).toBe(false);
    expect(v4.remaining).toBe(0);
  });

  it('different keys do not share state', async () => {
    const a = await rateLimit({ key: 'a', limit: 2, windowMs: 60_000 });
    const b = await rateLimit({ key: 'b', limit: 2, windowMs: 60_000 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    // Both counters are at 1, not at 2.
    expect(a.remaining).toBe(1);
    expect(b.remaining).toBe(1);
  });

  it('window roll: after the window expires the counter resets', async () => {
    const opts = { key: 'window-roll', limit: 1, windowMs: 50 };
    const first = await rateLimit(opts);
    expect(first.allowed).toBe(true);

    const second = await rateLimit(opts);
    expect(second.allowed).toBe(false);

    // Wait past the window. Use real timers — the window is 50ms so the test
    // is bounded.
    await new Promise((r) => setTimeout(r, 80));

    const third = await rateLimit(opts);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0); // limit=1, count=1
  });

  it('resetRateLimit clears the bucket', async () => {
    const opts = { key: 'reset-me', limit: 2, windowMs: 60_000 };
    await rateLimit(opts);
    await rateLimit(opts);
    const denied = await rateLimit(opts);
    expect(denied.allowed).toBe(false);

    await resetRateLimit('reset-me');

    const fresh = await rateLimit(opts);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(1); // back to a fresh window
  });

  it('does not call fetch when Upstash env is unset', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as never);
    await rateLimit({ key: 'no-fetch', limit: 5, windowMs: 60_000 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('warns operator once on first use of the in-memory backend', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await rateLimit({ key: 'warn-test-1', limit: 5, windowMs: 60_000 });
    await rateLimit({ key: 'warn-test-2', limit: 5, windowMs: 60_000 });
    const calls = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('[rate-limit]'),
    );
    // One-time warn: even though we hit the backend twice, we expect a single
    // warning so production logs aren't spammed.
    expect(calls.length).toBe(1);
    warnSpy.mockRestore();
  });
});

describe('rate-limit (Upstash backend)', () => {
  let rateLimit: typeof import('@/lib/rate-limit').rateLimit;
  let resetRateLimit: typeof import('@/lib/rate-limit').resetRateLimit;
  let fetchMock: jest.Mock;

  function loadFresh() {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/rate-limit');
    rateLimit = mod.rateLimit;
    resetRateLimit = mod.resetRateLimit;
  }

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    loadFresh();
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    jest.restoreAllMocks();
  });

  function upstashOk(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  function upstashFail(status: number, body = 'boom'): Response {
    return {
      ok: false,
      status,
      json: async () => ({ error: body }),
      text: async () => body,
    } as unknown as Response;
  }

  it('issues an INCR + EXPIRE pipeline against Upstash', async () => {
    fetchMock.mockResolvedValueOnce(
      upstashOk([{ result: 1 }, { result: 1 }, { result: 60_000 }]),
    );

    const verdict = await rateLimit({ key: 'login:ip:1.2.3.4', limit: 5, windowMs: 60_000 });
    expect(verdict.allowed).toBe(true);
    expect(verdict.remaining).toBe(4);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.upstash.io/pipeline');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const sent = JSON.parse(init.body);
    expect(sent[0][0]).toBe('INCR');
    expect(sent[1][0]).toBe('EXPIRE');
    expect(sent[2][0]).toBe('PTTL');
    // The key sent to Redis is hashed — usernames / IPs MUST NOT appear
    // in plaintext.
    expect(sent[0][1]).not.toContain('1.2.3.4');
    expect(sent[0][1]).toMatch(/^rl:[a-f0-9]{16}$/);
  });

  it('reports allowed=false when INCR result exceeds limit', async () => {
    fetchMock.mockResolvedValueOnce(
      upstashOk([{ result: 6 }, { result: 0 }, { result: 30_000 }]),
    );
    const verdict = await rateLimit({ key: 'spammer', limit: 5, windowMs: 60_000 });
    expect(verdict.allowed).toBe(false);
    expect(verdict.remaining).toBe(0);
  });

  it('fails open on Upstash 5xx (after one retry)', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(upstashFail(503));

    const verdict = await rateLimit({ key: 'flaky', limit: 5, windowMs: 60_000 });
    expect(verdict.allowed).toBe(true);
    expect(verdict.remaining).toBe(5);
    // INCR → fail; retry → fail → 2 calls.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });

  it('resetRateLimit issues a DEL pipeline', async () => {
    fetchMock.mockResolvedValueOnce(upstashOk([{ result: 1 }]));
    await resetRateLimit('login:user:dr.wani');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent[0][0]).toBe('DEL');
  });

  it('hashes the key so plaintext usernames never reach Redis', async () => {
    fetchMock.mockResolvedValueOnce(
      upstashOk([{ result: 1 }, { result: 1 }, { result: 60_000 }]),
    );
    await rateLimit({ key: 'login:user:secret-username', limit: 5, windowMs: 60_000 });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const keyArg = sent[0][1];
    expect(keyArg).not.toContain('secret-username');
    expect(keyArg).toMatch(/^rl:[a-f0-9]{16}$/);
  });
});
