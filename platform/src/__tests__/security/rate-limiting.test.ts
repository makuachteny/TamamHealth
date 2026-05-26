/**
 * Tests for rate limiting and API security utilities.
 * Covers: checkRateLimit, verifyCsrf, checkContentLength.
 */

import type { NextRequest } from 'next/server';

// Mock NextResponse.json since NextResponse doesn't instantiate cleanly in Jest
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    _body: unknown;
    _headers: Map<string, string>;

    constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body;
      this.status = init?.status || 200;
      this._headers = new Map(Object.entries(init?.headers || {}));
    }

    async json() {
      return this._body;
    }

    get headers() {
      return {
        get: (key: string) => this._headers.get(key) || null,
        set: (key: string, value: string) => this._headers.set(key, value),
      };
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

// Mock NextRequest since it doesn't instantiate cleanly in Jest
function mockRequest(
  method: string = 'POST',
  headerMap: Record<string, string> = {},
) {
  const allHeaders: Record<string, string> = {
    'x-forwarded-for': '127.0.0.1',
    ...headerMap,
  };
  return {
    method,
    headers: {
      get: (key: string) => allHeaders[key.toLowerCase()] ?? null,
    },
    nextUrl: { pathname: '/api/test' },
  } as unknown as NextRequest;
}

describe('api-security: checkRateLimit', () => {
  let checkRateLimit: typeof import('@/lib/api-security').checkRateLimit;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    checkRateLimit = require('@/lib/api-security').checkRateLimit;
  });

  test('allows requests within the limit', () => {
    const req = mockRequest();
    const result = checkRateLimit(req, 'test-endpoint', 5);
    expect(result).toBeNull();
  });

  test('allows exactly maxRequests requests', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(mockRequest(), 'limit-test', 5);
      expect(result).toBeNull();
    }
  });

  test('returns 429 when exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(mockRequest(), 'exceed-test', 5);
    }
    const result = checkRateLimit(mockRequest(), 'exceed-test', 5);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  test('429 response includes Retry-After header', async () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit(mockRequest(), 'retry-test', 3);
    }
    const result = checkRateLimit(mockRequest(), 'retry-test', 3);
    expect(result).not.toBeNull();
    expect(result!.headers.get('Retry-After')).toBeTruthy();
    const body = await result!.json();
    expect(body.error).toContain('Too many requests');
  });

  test('separate endpoint keys are tracked independently', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(mockRequest(), 'endpoint-a', 5);
    }
    // endpoint-b should still be allowed
    const result = checkRateLimit(mockRequest(), 'endpoint-b', 5);
    expect(result).toBeNull();
  });

  test('different IPs are tracked independently', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(mockRequest('POST', { 'x-forwarded-for': '10.0.0.1' }), 'ip-test', 5);
    }
    const result = checkRateLimit(
      mockRequest('POST', { 'x-forwarded-for': '10.0.0.2' }),
      'ip-test',
      5
    );
    expect(result).toBeNull();
  });

  test('uses x-real-ip as fallback when x-forwarded-for missing', () => {
    const req = mockRequest('POST', { 'x-real-ip': '192.168.1.1' });
    // Override to remove x-forwarded-for
    req.headers.get = (key: string) => {
      if (key === 'x-forwarded-for') return null;
      if (key === 'x-real-ip') return '192.168.1.1';
      return null;
    };
    const result = checkRateLimit(req, 'fallback-ip', 5);
    expect(result).toBeNull();
  });

  test('uses default max when not specified', () => {
    const req = mockRequest();
    // Default is 60 requests per minute
    const result = checkRateLimit(req, 'default-test');
    expect(result).toBeNull();
  });
});

describe('api-security: verifyCsrf', () => {
  let verifyCsrf: typeof import('@/lib/api-security').verifyCsrf;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    verifyCsrf = require('@/lib/api-security').verifyCsrf;
  });

  afterEach(() => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
  });

  test('allows GET requests without Origin', () => {
    const req = mockRequest('GET');
    expect(verifyCsrf(req)).toBeNull();
  });

  test('allows HEAD and OPTIONS without Origin', () => {
    expect(verifyCsrf(mockRequest('HEAD'))).toBeNull();
    expect(verifyCsrf(mockRequest('OPTIONS'))).toBeNull();
  });

  test('allows POST with matching Origin and Host', () => {
    const req = mockRequest('POST', {
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    });
    expect(verifyCsrf(req)).toBeNull();
  });

  test('rejects POST with mismatched Origin and Host', () => {
    const req = mockRequest('POST', {
      origin: 'http://evil.com',
      host: 'localhost:3000',
    });
    const result = verifyCsrf(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('rejects POST with invalid Origin URL', () => {
    const req = mockRequest('POST', {
      origin: 'not-a-valid-url',
      host: 'localhost:3000',
    });
    const result = verifyCsrf(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('allows POST without Origin in non-production', () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    verifyCsrf = require('@/lib/api-security').verifyCsrf;

    const req = mockRequest('POST', { host: 'localhost:3000' });
    expect(verifyCsrf(req)).toBeNull();
  });

  test('rejects POST without Origin in production', () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    verifyCsrf = require('@/lib/api-security').verifyCsrf;

    const req = mockRequest('POST', { host: 'localhost:3000' });
    const result = verifyCsrf(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

describe('api-security: checkContentLength', () => {
  let checkContentLength: typeof import('@/lib/api-security').checkContentLength;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    checkContentLength = require('@/lib/api-security').checkContentLength;
  });

  test('allows request within size limit', () => {
    const req = mockRequest('POST', { 'content-length': '1024' });
    const result = checkContentLength(req, 2048);
    expect(result).toBeNull();
  });

  test('rejects request exceeding size limit', async () => {
    const req = mockRequest('POST', { 'content-length': '5000000' });
    const result = checkContentLength(req, 1048576);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
    const body = await result!.json();
    expect(body.error).toContain('too large');
  });

  test('allows request without content-length header', () => {
    const req = mockRequest('POST');
    const result = checkContentLength(req, 1024);
    expect(result).toBeNull();
  });

  test('uses default 1MB limit', () => {
    const req = mockRequest('POST', { 'content-length': '500000' });
    const result = checkContentLength(req);
    expect(result).toBeNull();
  });
});
