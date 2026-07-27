/**
 * @jest-environment node
 *
 * Runs in the NODE environment, not jsdom: this exercises the real token
 * creation/verification path, and `NextResponse.json` needs the Web Fetch
 * globals that jsdom does not provide. The sibling route tests mock
 * patient-portal-auth away entirely, which would defeat the purpose here.
 */
import { createPatientToken, verifyPatientToken, PATIENT_SESSION_MAX_SECONDS } from '@/lib/patient-portal-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long!!';

/**
 * Header-stub request. `new NextRequest(...)` needs the edge-runtime cookie
 * plumbing, which is unavailable under jsdom — the repo's other API tests use
 * the same cast, and `verifyPatientToken` only reads the authorization header.
 */
function reqWith(token: string | null): NextRequest {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null) },
  } as unknown as NextRequest;
}

describe('patient token session claims', () => {
  test('a fresh login stamps a session start', async () => {
    const token = await createPatientToken({
      sub: 'pat-001', name: 'Achol Deng', hospitalNumber: 'JTH-1', role: 'patient',
    });
    const payload = await verifyPatientToken(reqWith(token));
    expect(payload).not.toBeInstanceOf(NextResponse);
    const p = payload as { sst?: number; sub: string };
    expect(p.sub).toBe('pat-001');
    expect(typeof p.sst).toBe('number');
  });

  test('renewal PRESERVES the original session start', async () => {
    // This is what stops a sliding session sliding forever: the ceiling is
    // measured from the original sign-in, not from the last renewal.
    const started = Math.floor(Date.now() / 1000) - 3600;
    const renewed = await createPatientToken({
      sub: 'pat-001', name: 'Achol Deng', hospitalNumber: 'JTH-1', role: 'patient',
      sessionStart: started,
    });
    const p = (await verifyPatientToken(reqWith(renewed))) as { sst?: number };
    expect(p.sst).toBe(started);
  });

  test('the absolute ceiling is 24h', () => {
    expect(PATIENT_SESSION_MAX_SECONDS).toBe(24 * 60 * 60);
  });

  test('a session past the ceiling is identifiable from the claim alone', async () => {
    const started = Math.floor(Date.now() / 1000) - (PATIENT_SESSION_MAX_SECONDS + 60);
    const token = await createPatientToken({
      sub: 'pat-001', name: 'Achol Deng', hospitalNumber: 'JTH-1', role: 'patient',
      sessionStart: started,
    });
    const p = (await verifyPatientToken(reqWith(token))) as { sst: number };
    const age = Math.floor(Date.now() / 1000) - p.sst;
    expect(age).toBeGreaterThanOrEqual(PATIENT_SESSION_MAX_SECONDS);
  });

  test('an invalid token is rejected, so renewal cannot resurrect a dead session', async () => {
    const result = await verifyPatientToken(reqWith('not.a.token'));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  test('a missing Authorization header is rejected', async () => {
    const result = await verifyPatientToken(reqWith(null));
    expect((result as NextResponse).status).toBe(401);
  });
});
