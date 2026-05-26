/**
 * Patient Portal API authentication helper.
 * Verifies JWT tokens issued to patients by /api/patient-portal/login.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

// Mirrors the JWT_SECRET resolution + production refusal in lib/auth-token.ts
// so the patient portal can't accidentally run with the hardcoded default.
const HARDCODED_FALLBACK = 'tamamhealth-south-sudan-health-2026-secret-key';
const secret =
  process.env.JWT_SECRET ||
  process.env.NEXT_PUBLIC_JWT_SECRET ||
  HARDCODED_FALLBACK;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_SERVER = typeof window === 'undefined';

if (IS_SERVER && IS_PRODUCTION && secret === HARDCODED_FALLBACK) {
  throw new Error(
    '[SECURITY] JWT_SECRET environment variable must be set in production. ' +
    'Refusing to start with the default fallback secret.'
  );
}

if (IS_SERVER && IS_PRODUCTION && secret.length < 32) {
  throw new Error(
    '[SECURITY] JWT_SECRET must be at least 32 characters in production ' +
    `(got ${secret.length}). Generate one with: openssl rand -hex 32`
  );
}

const JWT_SECRET = new TextEncoder().encode(secret);

const JWT_ISSUER = 'tamamhealth';
const JWT_AUDIENCE = 'tamamhealth-patient';

export type PatientTokenPayload = {
  sub: string; // patient _id
  name: string;
  hospitalNumber: string;
  role: 'patient';
};

/**
 * Web Crypto API availability — same fallback gate as auth-token.ts.
 * crypto.subtle is only available in secure contexts (HTTPS or localhost).
 */
function hasCryptoSubtle(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
}

/**
 * Create a patient-portal JWT (audience: tamamhealth-patient, 8h expiry).
 * Mirrors createToken() in auth-token.ts so a hardcoded secret can't slip
 * back into this code path.
 */
export async function createPatientToken(payload: {
  sub: string;
  name: string;
  hospitalNumber: string;
  role: 'patient';
}): Promise<string> {
  if (!hasCryptoSubtle()) {
    // Patient portal is web-only and always served over HTTPS in production;
    // refuse to issue an unsigned fallback rather than degrade silently.
    throw new Error('[SECURITY] crypto.subtle unavailable — refusing to issue patient token');
  }
  return new SignJWT({
    sub: payload.sub,
    name: payload.name,
    hospitalNumber: payload.hospitalNumber,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
}

/**
 * Verify the patient JWT from the Authorization header.
 * Returns the payload or a 401 NextResponse.
 */
export async function verifyPatientToken(
  req: NextRequest
): Promise<PatientTokenPayload | NextResponse> {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
  }

  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as unknown as PatientTokenPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
