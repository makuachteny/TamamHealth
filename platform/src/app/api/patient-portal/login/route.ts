import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';
import { createPatientToken } from '@/lib/patient-portal-auth';
import { demoFallbackEnabled, findDemoPatientByHospitalNumber, findDemoPatientByNameDob } from '@/lib/patient-portal-demo';

// Rate limit: 10 attempts / 15 min / IP + 10 attempts / 15 min / phone.
// Backed by lib/rate-limit.ts, which uses shared Upstash Redis when
// configured so multi-instance deployments share the same counters (falls
// back to in-process memory otherwise — see that module's docstring).
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;

function phoneDigits(p: string | undefined | null): string {
  return (p || '').replace(/\D/g, '');
}

// Lazy per-process index creation — Mango createIndex is idempotent server-side
// but each call still costs a round-trip, so we cache the attempt.
const indexState = { hospitalNumber: false, dateOfBirth: false };

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
 * Authenticates a patient by hospital number + phone, or name + DOB + phone.
 * Returns a JWT token for subsequent API calls.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ipRateKey = `patient-login:ip:${ip}`;
  const ipVerdict = await sharedRateLimit({ key: ipRateKey, limit: RATE_MAX, windowMs: RATE_WINDOW_MS });
  if (!ipVerdict.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let body: {
    hospitalNumber?: string;
    phone?: string;
    firstName?: string;
    surname?: string;
    dateOfBirth?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Normalize to digits only so "+211-912-345-678", "+211 912 345 678",
  // and "211912345678" all compare equal.
  const phone = phoneDigits(body.phone);
  const phoneRateKey = phone ? `patient-login:phone:${phone}` : null;

  // Per-phone backoff using the same shared bucket described above.
  if (phoneRateKey) {
    const phoneVerdict = await sharedRateLimit({ key: phoneRateKey, limit: RATE_MAX, windowMs: RATE_WINDOW_MS });
    if (!phoneVerdict.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }
  }

  try {
    type PatientLike = {
      _id: string;
      firstName?: string;
      surname?: string;
      hospitalNumber?: string;
      geocodeId?: string;
      phone?: string;
      dateOfBirth?: string;
      gender?: string;
      registrationHospital?: string;
      // Real patient docs (and the demo fallback) carry plenty more the
      // portal's Overview/Profile tabs read (registrationHospitalName,
      // county, state, bloodType, allergies, ...) — pass all of it through
      // rather than hand-picking a subset that quietly drifts from what the
      // UI actually needs.
      [key: string]: unknown;
    };
    let found: PatientLike | null = null;

    try {
      // Dynamic import to avoid PouchDB SSR crash (same pattern as /api/patients)
      const { patientsDB } = await import('@/lib/db');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = patientsDB() as any;

      // Method 1: Hospital number (or geocode ID) + phone.
      // Use a (type, hospitalNumber) Mango query; geocodeId is checked in a
      // second narrow query. Phone is filtered in-memory on the tiny result set.
      if (body.hospitalNumber) {
        const hn = body.hospitalNumber.trim().toUpperCase();
        await ensureIndex(db, ['type', 'hospitalNumber'], 'hospitalNumber');
        const byHn = await db.find({
          selector: { type: 'patient', hospitalNumber: hn },
          limit: 50,
        });
        const candidates: PatientLike[] = (byHn.docs || []) as PatientLike[];

        // Also try geocodeId (separate selector — Mango can't OR across two
        // distinct indexed fields efficiently).
        const byGeocode = await db.find({
          selector: { type: 'patient', geocodeId: hn },
          limit: 50,
        });
        candidates.push(...((byGeocode.docs || []) as PatientLike[]));

        found = candidates.find((p) => {
          const pPhone = phoneDigits(p.phone);
          return (
            (p.hospitalNumber?.toUpperCase() === hn || p.geocodeId?.toUpperCase() === hn) &&
            pPhone === phone &&
            pPhone.length > 0
          );
        }) || null;
      }

      // Method 2: Name + DOB + phone.
      // Query by (type, dateOfBirth) — usually a small set — then filter name +
      // phone in memory.
      if (!found && body.firstName && body.surname && body.dateOfBirth) {
        const fn = body.firstName.trim().toLowerCase();
        const sn = body.surname.trim().toLowerCase();
        const dob = body.dateOfBirth.trim();
        await ensureIndex(db, ['type', 'dateOfBirth'], 'dateOfBirth');
        const byDob = await db.find({
          selector: { type: 'patient', dateOfBirth: dob },
          limit: 200,
        });
        const candidates: PatientLike[] = (byDob.docs || []) as PatientLike[];
        found = candidates.find(
          (p) =>
            p.firstName?.toLowerCase() === fn &&
            p.surname?.toLowerCase() === sn &&
            p.dateOfBirth === dob &&
            phoneDigits(p.phone) === phone
        ) || null;
      }
    } catch (dbErr) {
      // The real database is unreachable (e.g. no CouchDB configured in this
      // environment) rather than simply "no match" — in demo mode, answer
      // from the same literal seed data the client-side demo already uses
      // instead of failing the whole portal.
      if (!demoFallbackEnabled()) throw dbErr;
      console.warn('[patient-portal/login] DB unreachable, using demo fallback', dbErr);
      const demoMatch = body.hospitalNumber
        ? await findDemoPatientByHospitalNumber(body.hospitalNumber, body.phone || '')
        : (body.firstName && body.surname && body.dateOfBirth)
          ? await findDemoPatientByNameDob(body.firstName, body.surname, body.dateOfBirth, body.phone || '')
          : null;
      found = demoMatch as PatientLike | null;
    }

    if (!found) {
      return NextResponse.json({ error: 'No matching patient found. Check your details.' }, { status: 401 });
    }

    // Clear both counters on success so a patient who mistyped a few times
    // isn't left one attempt from a lockout.
    await Promise.all([resetRateLimit(ipRateKey), ...(phoneRateKey ? [resetRateLimit(phoneRateKey)] : [])]);

    // Issue a patient-scoped JWT (8 hour expiry)
    const token = await createPatientToken({
      sub: found._id,
      name: `${found.firstName} ${found.surname}`,
      hospitalNumber: found.hospitalNumber || '',
      role: 'patient',
    });

    return NextResponse.json({
      token,
      patient: {
        ...found,
        id: found._id,
      },
    });
  } catch (err) {
    console.error('[patient-portal/login]', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
