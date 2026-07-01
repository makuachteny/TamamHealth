import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';
import { createPatientToken } from '@/lib/patient-portal-auth';

// Rate limit: 10 attempts / 15 min / IP + 10 attempts / 15 min / phone.
// Operational note: this API is process-local and best-effort. Multi-replica
// deployments should front it with an edge/shared rate limiter.
const rateLimit: Record<string, { count: number; windowStart: number }> = {};
const phoneAttempts: Record<string, { count: number; windowStart: number }> = {};
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
  if (isRateLimited(ip, rateLimit)) {
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

  // Per-phone backoff using the same process-local bucket described above.
  if (phone && isRateLimited(phone, phoneAttempts)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  try {
    // Dynamic import to avoid PouchDB SSR crash (same pattern as /api/patients)
    const { patientsDB } = await import('@/lib/db');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = patientsDB() as any;

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
    };
    let found: PatientLike | null = null;

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

    if (!found) {
      return NextResponse.json({ error: 'No matching patient found. Check your details.' }, { status: 401 });
    }

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
        id: found._id,
        firstName: found.firstName,
        surname: found.surname,
        hospitalNumber: found.hospitalNumber,
        phone: found.phone,
        dateOfBirth: found.dateOfBirth,
        gender: found.gender,
        registrationHospital: found.registrationHospital,
      },
    });
  } catch (err) {
    console.error('[patient-portal/login]', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
