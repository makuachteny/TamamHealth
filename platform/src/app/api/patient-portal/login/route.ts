import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';
import { createPatientToken } from '@/lib/patient-portal-auth';
import { demoFallbackEnabled, findDemoPatientByUsername } from '@/lib/patient-portal-demo';
import { verifyPassword } from '@/lib/auth';

// Rate limit: 10 attempts / 15 min / IP + 10 attempts / 15 min / account.
// Operational note: this API is process-local and best-effort. Multi-replica
// deployments should front it with an edge/shared rate limiter.
const rateLimit: Record<string, { count: number; windowStart: number }> = {};
const accountAttempts: Record<string, { count: number; windowStart: number }> = {};
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;

function isRateLimited(key: string, bucket: Record<string, { count: number; windowStart: number }>): boolean {
  const now = Date.now();
  const entry = bucket[key];
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    bucket[key] = { count: 1, windowStart: now };
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

// Lazy per-process index creation — Mango createIndex is idempotent server-side
// but each call still costs a round-trip, so we cache the attempt.
const indexState = { portalUsername: false };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureIndex(db: any, fields: string[], key: keyof typeof indexState): Promise<void> {
  if (indexState[key]) return;
  try {
    await db.createIndex({ index: { fields } });
  } catch {
    // older couchdb / index conflict — find() will fall back to a full scan
    // once. Cache the attempt either way.
  }
  indexState[key] = true;
}

/**
 * POST /api/patient-portal/login
 * Authenticates the patient by username + password (bcrypt), the same shape as
 * staff sign-in. Returns a patient-scoped JWT for subsequent API calls.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(ip, rateLimit)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let body: { username?: string; password?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  // Per-account backoff (same process-local bucket described above).
  if (isRateLimited(username.toLowerCase(), accountAttempts)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  try {
    type PatientLike = {
      _id: string;
      firstName?: string;
      surname?: string;
      hospitalNumber?: string;
      portalUsername?: string;
      portalPasswordHash?: string;
      // Real patient docs (and the demo fallback) carry plenty more the
      // portal's Overview/Profile tabs read — pass all of it through rather
      // than hand-picking a subset that quietly drifts from what the UI needs.
      [key: string]: unknown;
    };
    let found: PatientLike | null = null;

    try {
      // Dynamic import to avoid PouchDB SSR crash (same pattern as /api/patients)
      const { patientsDB } = await import('@/lib/db');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = patientsDB() as any;
      await ensureIndex(db, ['type', 'portalUsername'], 'portalUsername');
      const byUser = await db.find({
        selector: { type: 'patient', portalUsername: username },
        limit: 1,
      });
      found = ((byUser.docs || [])[0] as PatientLike) || null;
    } catch (dbErr) {
      // The real database is unreachable (e.g. no CouchDB configured in this
      // environment). In demo mode, answer from the same literal seed data the
      // client-side demo uses instead of failing the whole portal.
      if (!demoFallbackEnabled()) throw dbErr;
      console.warn('[patient-portal/login] DB unreachable, using demo fallback', dbErr);
      found = (await findDemoPatientByUsername(username)) as PatientLike | null;
    }

    // Verify the password. One generic error for "no such user" and "wrong
    // password" so the response never reveals which was wrong.
    const passwordOk = !!found?.portalPasswordHash && await verifyPassword(password, found.portalPasswordHash);
    if (!found || !passwordOk) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    // Issue a patient-scoped JWT (8 hour expiry)
    const token = await createPatientToken({
      sub: found._id,
      name: `${found.firstName} ${found.surname}`,
      hospitalNumber: found.hospitalNumber || '',
      role: 'patient',
    });

    // Never leak the credential fields to the browser.
    const { portalPasswordHash: _hash, portalUsername: _user, ...safePatient } = found;
    void _hash; void _user;

    return NextResponse.json({
      token,
      patient: {
        ...safePatient,
        id: found._id,
      },
    });
  } catch (err) {
    console.error('[patient-portal/login]', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
