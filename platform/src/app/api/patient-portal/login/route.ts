import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';
import { createPatientToken } from '@/lib/patient-portal-auth';
import { demoFallbackEnabled, logDemoFallback, findDemoPatientByUsername } from '@/lib/patient-portal-demo';
import { verifyPassword } from '@/lib/auth';
import { otpEnabled, issueOtp } from '@/lib/patient-portal-otp';

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
      logDemoFallback('login', dbErr);
      found = (await findDemoPatientByUsername(username)) as PatientLike | null;
    }

    // Verify the password. One generic error for "no such user" and "wrong
    // password" so the response never reveals which was wrong.
    const passwordOk = !!found?.portalPasswordHash && await verifyPassword(password, found.portalPasswordHash);
    if (!found || !passwordOk) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    // Second factor (KAN-76). When OTP is enabled we stop here and prove
    // possession of the registered phone before issuing any session token —
    // the portal is otherwise protected by a single shared secret, on shared
    // devices, for users who often cannot reset it themselves.
    //
    // Fails CLOSED: if the SMS cannot be delivered no token is issued. A
    // second factor nobody receives is not a factor. The one exception is a
    // patient with no number on file, who would otherwise be permanently
    // locked out of their own records by a config change — they fall through
    // to password-only, and the response says so.
    if (otpEnabled()) {
      const phone = typeof found.phone === 'string' ? found.phone : '';
      const issued = await issueOtp(found._id, phone);

      if (issued.ok) {
        return NextResponse.json({
          otpRequired: true,
          // Identifies the pending challenge on the verify call. Not a
          // session token and carries no privilege — the patient id alone is
          // useless without the code, which only reaches the registered phone.
          challengeId: found._id,
          maskedPhone: issued.maskedPhone,
        });
      }

      if (issued.error !== 'no-phone') {
        return NextResponse.json(
          { error: 'Could not send your verification code. Please try again.' },
          { status: 503 },
        );
      }
      console.warn('[patient-portal/login] OTP enabled but patient has no phone on file — allowing password-only login.');
    }

    // Issue a patient-scoped JWT (8 hour expiry)
    const token = await createPatientToken({
      sub: found._id,
      name: `${found.firstName} ${found.surname}`,
      hospitalNumber: found.hospitalNumber || '',
      role: 'patient',
    });

    // Minimal identity only — enough to render "logged in as", nothing more.
    //
    // This previously spread the whole patient document (credential fields
    // aside), so authentication returned date of birth, phone, next-of-kin,
    // allergies and chronic conditions. The authentication boundary is the
    // worst place to carry PHI: it is the request most likely to be captured
    // by request logging, proxied, retried, or persisted client-side next to
    // the token.
    //
    // An explicit allow-list, not a spread-and-delete — a spread silently
    // re-leaks every field added to PatientDoc in future.
    //
    // Everything else now comes from GET /api/patient-portal/profile, which
    // requires the token this response issues.
    return NextResponse.json({
      token,
      patient: {
        id: found._id,
        firstName: found.firstName,
        surname: found.surname,
        hospitalNumber: found.hospitalNumber || '',
        registrationHospital: found.registrationHospital,
      },
    });
  } catch (err) {
    console.error('[patient-portal/login]', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
