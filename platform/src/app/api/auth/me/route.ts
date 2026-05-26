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

  const response = NextResponse.json({
    user: {
      _id: payload.sub,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      hospitalId: payload.hospitalId,
      orgId: payload.orgId,
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
