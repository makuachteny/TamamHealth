import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth-token';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  mintCsrfToken,
  verifyCsrfToken,
} from './lib/csrf';
import { addBreadcrumb } from './lib/observability';
import {
  getDefaultDashboard,
  hasRoleRouteConfig,
  isPathAllowed,
} from './lib/role-routes';

// NOTE: The authoritative token-revocation check (lib/token-blacklist.ts)
// uses node:fs and therefore can't run in this Edge-runtime proxy.
// It is enforced instead in two Node-runtime locations that every request
// has to pass through:
//
//   1. /api/auth/me   — called by context.tsx on every app load.
//                       A revoked token returns 401 and the client logs out.
//   2. getAuthPayload — used by every /api/* route. A revoked token
//                       cannot perform any mutation or read any PHI.
//
// The proxy here does not duplicate that check. Logout already clears
// the cookie on the same browser; any stolen-cookie use from another
// browser hits the API gate immediately.

/**
 * API paths exempt from CSRF enforcement. These are either public (no
 * authenticated session to abuse), use a separate auth scheme, or are the
 * login flow itself (no session yet to bind a token to).
 */
const CSRF_EXEMPT_API_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/demo-credentials',
]);

// The public pay-by-link checkout helper. No staff session exists (a payer
// opens the link), so the cookie+header CSRF gate can't apply; the Origin
// check above still guards it against cross-site abuse.
function isCheckoutApiPath(pathname: string): boolean {
  return pathname === '/api/checkout' || pathname.startsWith('/api/checkout/');
}

function isCsrfExemptApiPath(pathname: string): boolean {
  if (CSRF_EXEMPT_API_PATHS.has(pathname)) return true;
  // Patient portal has its own JWT scheme; it issues + checks its own
  // anti-forgery tokens internally. Skip the staff CSRF gate here.
  if (pathname.startsWith('/api/patient-portal/')) return true;
  // Read-only public reference data.
  if (pathname === '/api/fhir/metadata') return true;
  if (pathname === '/api/country/metadata') return true;
  if (pathname.startsWith('/api/terminology/')) return true;
  // Public pay-by-link checkout helper — unauthenticated payer, no session
  // cookie to bind a CSRF token to.
  if (isCheckoutApiPath(pathname)) return true;
  return false;
}

// Role -> route allow-list lives in `lib/role-routes.ts` so the richer
// `ROLE_PERMISSIONS` map (nav items + icons, not Edge-safe) can derive its
// `allowedRoutes` from the same source. Only the helpers below are pulled in.

/**
 * Structured request logging for operational visibility and audit trails.
 * Logs: timestamp, method, path, user (if authenticated), status, duration.
 * In production, this would feed into a log aggregation service (e.g. ELK, Loki).
 */
function logRequest(
  request: NextRequest,
  response: NextResponse,
  userId?: string,
  role?: string,
  durationMs?: number,
) {
  // Skip noisy static asset requests
  const path = request.nextUrl.pathname;
  if (path.startsWith('/_next') || path === '/favicon.ico') return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    method: request.method,
    path,
    status: response.status || 200,
    userId: userId || 'anonymous',
    role: role || 'none',
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown',
    userAgent: request.headers.get('user-agent')?.slice(0, 100) || '',
    durationMs: durationMs || 0,
  };

  // Use structured JSON logging for machine-parseable logs
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(logEntry));
  } else if (request.method !== 'GET' || path.startsWith('/api/')) {
    // In dev, only log API calls and state-changing requests to reduce noise
    console.log(`[REQ] ${logEntry.method} ${logEntry.path} → ${logEntry.status} (${logEntry.userId}/${logEntry.role}) ${logEntry.durationMs}ms`);
  }

  // Sentry breadcrumb — only for non-2xx responses, so successful traffic
  // doesn't bloat the breadcrumb buffer or the bundle in dev (the helper
  // no-ops when the SDK isn't initialised). The trail of redirects + 4xx /
  // 5xx that preceded a captured exception is what we actually want.
  if (logEntry.status >= 300) {
    addBreadcrumb({
      category: 'request',
      message: `${logEntry.method} ${logEntry.path} → ${logEntry.status}`,
      level: logEntry.status >= 500 ? 'error' : 'warning',
      data: {
        method: logEntry.method,
        path: logEntry.path,
        status: logEntry.status,
        role: logEntry.role,
        durationMs: logEntry.durationMs,
      },
    });
  }
}

export async function proxy(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = request.nextUrl;

  // Static assets — always public
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Auth API routes — always public (needed for login/logout flow)
  if (
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/me'
  ) {
    return NextResponse.next();
  }

  // Seed-credentials route — public read so the unauthenticated browser-side
  // PouchDB seed and the demo-accounts dropdown on /login can fetch the
  // freshly generated demo passwords. The route itself self-gates: in
  // production it returns only the bootstrap admin row, never the full
  // demo roster.
  if (pathname === '/api/demo-credentials') {
    return NextResponse.next();
  }

  // CSRF defence layer 1: Origin/Host check on state-changing API requests.
  // Runs BEFORE the patient-portal early-return so the patient portal still
  // gets cross-site protection — only the cookie+header CSRF gate is skipped
  // for that path (it uses Bearer auth instead, see below).
  if (pathname.startsWith('/api/')) {
    const method = request.method.toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      const isProd = process.env.NODE_ENV === 'production';

      // In production, require Origin header for state-changing API calls
      if (isProd && !origin) {
        return NextResponse.json({ error: 'Missing Origin header' }, { status: 403 });
      }

      // Verify Origin matches Host when both are present
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return NextResponse.json({ error: 'Origin mismatch' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: 'Invalid Origin' }, { status: 403 });
        }
      }
    }
  }

  // Patient portal API — uses its own JWT auth (not staff auth). The Origin
  // check above still applies; only the cookie-based CSRF gate is skipped.
  if (pathname.startsWith('/api/patient-portal/')) {
    return NextResponse.next();
  }

  // FHIR CapabilityStatement is intentionally public so external clients can
  // discover the API before authenticating. All other FHIR resource paths
  // still require a session token.
  if (pathname === '/api/fhir/metadata') {
    return NextResponse.next();
  }

  // Country metadata is static reference data (no PHI) — facility nodes
  // fetch it to sync code mappings without requiring a session.
  if (pathname === '/api/country/metadata') {
    return NextResponse.next();
  }

  // Terminology registry — shared CodeSystems / ValueSets. Reference data,
  // no PHI; public so external tooling can bind forms to our vocabularies.
  if (pathname.startsWith('/api/terminology/')) {
    return NextResponse.next();
  }

  // Pay-by-link checkout helper — public so an unauthenticated payer can load
  // the link details (GET) and submit a pending payment (POST). The route
  // itself returns only payer-facing fields and never posts to the ledger.
  if (isCheckoutApiPath(pathname)) {
    return NextResponse.next();
  }

  // Login page — always public
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Public pages — root (redirects to /login), public-stats, patient-portal, legal pages
  if (
    pathname === '/' ||
    pathname === '/public-stats' ||
    pathname === '/patient-portal' ||
    pathname === '/terms' ||
    pathname === '/privacy'
  ) {
    return NextResponse.next();
  }

  // Pay-by-link checkout page — a patient/payer opens the link without a staff
  // session, so the public checkout route must not redirect to /login.
  if (pathname === '/checkout' || pathname.startsWith('/checkout/')) {
    return NextResponse.next();
  }

  // All other routes require authentication
  const token = request.cookies.get('tamamhealth-token')?.value;

  if (!token) {
    // API routes return 401, page routes redirect to login
    if (pathname.startsWith('/api/')) {
      const resp = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logRequest(request, resp, undefined, undefined, Date.now() - startTime);
      return resp;
    }
    const resp = NextResponse.redirect(new URL('/login', request.url));
    logRequest(request, resp, undefined, undefined, Date.now() - startTime);
    return resp;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('tamamhealth-token', '', { maxAge: 0, path: '/' });
    logRequest(request, response, undefined, undefined, Date.now() - startTime);
    return response;
  }

  // Role-based route enforcement
  const role = payload.role;
  const userId = payload.sub;

  // CSRF defence layer 2: HMAC-bound double-submit token. For any
  // state-changing API request (POST/PUT/PATCH/DELETE) we require both:
  //   - the X-CSRF-Token header,
  //   - the tamamhealth-csrf cookie,
  //   - both equal, and
  //   - the HMAC verifies for this session subject.
  // The Origin check above stops the simple cross-site form attack; this
  // layer holds even if a future change weakens SameSite cookies or a same-
  // site sub-resource gets compromised.
  if (pathname.startsWith('/api/') && !isCsrfExemptApiPath(pathname)) {
    const method = request.method.toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value || '';
      const headerToken = request.headers.get(CSRF_HEADER_NAME) || '';
      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        const resp = NextResponse.json(
          { error: 'CSRF token missing or mismatched' },
          { status: 403 },
        );
        logRequest(request, resp, userId, role, Date.now() - startTime);
        return resp;
      }
      const ok = await verifyCsrfToken(cookieToken, userId);
      if (!ok) {
        const resp = NextResponse.json(
          { error: 'CSRF token invalid for session' },
          { status: 403 },
        );
        logRequest(request, resp, userId, role, Date.now() - startTime);
        return resp;
      }
    }
  }

  // Page-level routing only. /api/* routes enforce their own role checks via
  // hasRole(auth, ROLES) inside each handler — redirecting them to the
  // default dashboard (a page) would break every authenticated API call.
  // Unknown roles fall through (`hasRoleRouteConfig` returns false), matching
  // the previous behaviour where a missing role entry meant no page gating.
  if (
    hasRoleRouteConfig(role) &&
    !pathname.startsWith('/api/') &&
    !isPathAllowed(role, pathname)
  ) {
    const resp = NextResponse.redirect(
      new URL(getDefaultDashboard(role), request.url),
    );
    logRequest(request, resp, userId, role, Date.now() - startTime);
    return resp;
  }

  const response = NextResponse.next();

  // Lazy-mint the CSRF cookie if a valid session is missing one (e.g. a user
  // upgraded across the deploy that introduced this defence, or their cookie
  // was cleared but the session JWT is still valid). Sets the cookie on the
  // outbound response so the next mutation will succeed without a re-login.
  if (!request.cookies.get(CSRF_COOKIE_NAME)) {
    try {
      const fresh = await mintCsrfToken(userId);
      response.cookies.set(CSRF_COOKIE_NAME, fresh, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 8,
        path: '/',
      });
    } catch {
      // Minting failure is non-fatal here — the request still succeeds; the
      // user's next mutation will be rejected and they'll see a clean error.
    }
  }

  logRequest(request, response, userId, role, Date.now() - startTime);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
