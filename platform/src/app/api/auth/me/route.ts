import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-token';
import { CSRF_COOKIE_NAME, mintCsrfToken } from '@/lib/csrf';
import { isTokenRevoked } from '@/lib/token-blacklist';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('tamamhealth-token')?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // /api/auth/me is exempt from the page-middleware auth gate (so an
  // unauthenticated browser can call it on app load and get {user:null}
  // instead of a redirect). That means the blacklist check must run here
  // explicitly — otherwise a logged-out token would still hydrate the user.
  if (await isTokenRevoked(token)) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Hydrate from the live user record, not the 8h-stale JWT, so a
  // deactivation or an admin-forced password reset takes effect on the next
  // app load instead of lingering until the token expires. Falls back to the
  // JWT claims when the DB is unavailable or the account is the synthetic
  // "admin" bootstrap (whose JWT predates any users DB). Mirrors the live
  // re-check in getAuthPayload (lib/api-auth.ts).
  const isProduction = process.env.NODE_ENV === 'production';
  let fresh: {
    name?: string; role?: string; hospitalId?: string; hospitalName?: string;
    orgId?: string; mustChangePassword?: boolean;
  } = {
    name: payload.name,
    role: payload.role,
    hospitalId: payload.hospitalId,
    hospitalName: payload.hospitalName,
    orgId: payload.orgId,
    mustChangePassword: payload.mustChangePassword,
  };
  try {
    const { getUserById } = await import('@/lib/services/user-service');
    const user = await getUserById(payload.sub);
    if (user) {
      // Deactivated mid-session → drop the session on next load.
      if (user.isActive === false) {
        return NextResponse.json({ user: null }, { status: 401 });
      }
      fresh = {
        name: user.name,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalName: user.hospitalName,
        orgId: user.orgId,
        mustChangePassword: user.mustChangePassword,
      };
    } else if (isProduction && payload.sub !== 'admin') {
      // Account no longer exists in production → deny.
      return NextResponse.json({ user: null }, { status: 401 });
    }
  } catch {
    // DB unavailable — fall back to JWT claims (already seeded in `fresh`).
  }

  const response = NextResponse.json({
    user: {
      _id: payload.sub,
      username: payload.username,
      name: fresh.name,
      role: fresh.role,
      hospitalId: fresh.hospitalId,
      hospitalName: fresh.hospitalName,
      orgId: fresh.orgId,
      mustChangePassword: fresh.mustChangePassword,
    },
  });

  // Lazy-mint the CSRF cookie if the client has a valid session JWT but no
  // CSRF cookie — handles the upgrade-across-deploy case and the "user
  // cleared cookies but session JWT still valid" case. /api/auth/me is the
  // right bootstrap trigger because the client calls it on every app load.
  if (!request.cookies.get(CSRF_COOKIE_NAME)) {
    try {
      const csrf = await mintCsrfToken(payload.sub);
      response.cookies.set(CSRF_COOKIE_NAME, csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 8,
        path: '/',
      });
    } catch {
      // Non-fatal: client gets a CSRF rejection on its next mutation.
    }
  }

  return response;
}
