import { SignJWT, jwtVerify } from 'jose';

// Server-side secret only — NEXT_PUBLIC_* variables are baked into the browser
// bundle at build time, so a NEXT_PUBLIC_JWT_SECRET would be readable by any
// visitor. JWT_SECRET is the only accepted env var; use the hardcoded fallback
// only in local demo mode.
const HARDCODED_FALLBACK = 'tamamhealth-south-sudan-health-2026-secret-key';
const secret = process.env.JWT_SECRET || HARDCODED_FALLBACK;

const IS_SERVER = typeof window === 'undefined';
// Guard fires whenever demo mode is explicitly off — catches staging, CI, and
// production deployments regardless of NODE_ENV.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

if (IS_SERVER && !IS_DEMO && secret === HARDCODED_FALLBACK) {
  throw new Error(
    '[SECURITY] JWT_SECRET environment variable must be set in any non-demo deployment. ' +
    'Generate one with: openssl rand -base64 48'
  );
}

if (IS_SERVER && !IS_DEMO && secret.length < 32) {
  throw new Error(
    '[SECURITY] JWT_SECRET must be at least 32 characters ' +
    `(got ${secret.length}). Generate one with: openssl rand -hex 32`
  );
}

const JWT_SECRET = new TextEncoder().encode(secret);

const JWT_ISSUER = 'tamamhealth';
const JWT_AUDIENCE = 'tamamhealth-web';

/**
 * Check if Web Crypto API is available.
 * crypto.subtle is only available in secure contexts (HTTPS or localhost).
 * When accessing via HTTP on a LAN IP (e.g., phone on local network), it's unavailable.
 */
function hasCryptoSubtle(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
}

/**
 * Fallback token for non-secure contexts (DEMO / DEVELOPMENT ONLY).
 * Uses base64-encoded JSON — NOT cryptographically secure.
 * In non-demo deployments this path is refused: we fail closed rather than
 * accept unsigned tokens on the wire.
 */
function createFallbackToken(payload: Record<string, unknown>): string {
  if (!IS_DEMO) {
    throw new Error('[SECURITY] Refusing to issue unsigned fallback token in non-demo deployment');
  }
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify({
    ...payload,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 28800, // 8h
  }));
  return `${header}.${body}.dev-fallback`;
}

function verifyFallbackToken(token: string): Record<string, unknown> | null {
  // Refuse unsigned tokens in non-demo deployments. A token with the literal
  // "dev-fallback" signature reaching a deployed verifier is token forgery.
  if (!IS_DEMO) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[2] !== 'dev-fallback') return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createToken(user: { _id: string; username: string; role: string; name: string; hospitalId?: string; orgId?: string; countryId?: string; payam?: string; county?: string; state?: string; mustChangePassword?: boolean }): Promise<string> {
  const payload = {
    sub: user._id,
    username: user.username,
    role: user.role,
    name: user.name,
    hospitalId: user.hospitalId,
    orgId: user.orgId,
    countryId: user.countryId,
    payam: user.payam,
    county: user.county,
    state: user.state,
    mustChangePassword: user.mustChangePassword,
  };

  // Use jose when crypto.subtle is available (HTTPS / localhost / server-side)
  if (hasCryptoSubtle()) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime('8h')
      .sign(JWT_SECRET);
  }

  // Fallback for non-secure contexts (HTTP on LAN — dev only)
  console.warn('[Auth] crypto.subtle unavailable (non-HTTPS). Using dev fallback token.');
  return createFallbackToken(payload);
}

export async function verifyToken(token: string): Promise<{
  sub: string;
  username: string;
  role: string;
  name: string;
  hospitalId?: string;
  orgId?: string;
  countryId?: string;
  payam?: string;
  county?: string;
  state?: string;
  mustChangePassword?: boolean;
} | null> {
  // Try jose first (works server-side and on HTTPS)
  if (hasCryptoSubtle()) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      return payload as {
        sub: string;
        username: string;
        role: string;
        name: string;
        hospitalId?: string;
        orgId?: string;
        countryId?: string;
        payam?: string;
        county?: string;
        state?: string;
        mustChangePassword?: boolean;
      };
    } catch {
      // Fall through to try fallback
    }
  }

  // Try fallback token (dev mode over HTTP)
  const fallback = verifyFallbackToken(token);
  if (fallback) {
    return {
      sub: fallback.sub as string,
      username: fallback.username as string,
      role: fallback.role as string,
      name: fallback.name as string,
      hospitalId: fallback.hospitalId as string | undefined,
      orgId: fallback.orgId as string | undefined,
      countryId: fallback.countryId as string | undefined,
      payam: fallback.payam as string | undefined,
      county: fallback.county as string | undefined,
      state: fallback.state as string | undefined,
      mustChangePassword: fallback.mustChangePassword as boolean | undefined,
    };
  }

  return null;
}
