import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth-token';
import { CSRF_COOKIE_NAME, mintCsrfToken } from '@/lib/csrf';
import { getClientIp } from '@/lib/request-utils';
import { rateLimit, resetRateLimit } from '@/lib/rate-limit';

// Rate limiting: per-user lock stops single-account brute-force; per-IP lock
// stops password spraying across many usernames from one host. Backed by
// lib/rate-limit.ts, which uses shared Upstash Redis when configured (falls
// back to in-process memory otherwise — see that module's docstring).
const USER_LOCK_THRESHOLD = 5;       // tries before user lock
const USER_LOCK_MS = 15 * 60 * 1000; // 15 minutes
const IP_LOCK_THRESHOLD = 20;        // tries from one IP before IP lock
const IP_LOCK_MS = 15 * 60 * 1000;   // 15 minutes

export async function POST(request: NextRequest) {
  try {
    // Parse request body with explicit error handling
    let body: { username?: string; password?: string; hospitalId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { username, password, hospitalId } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Validate username format - reject invalid characters instead of silently stripping
    const trimmedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(trimmedUsername)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const sanitizedUsername = trimmedUsername;
    const clientIp = getClientIp(request);
    const userRateKey = `login:user:${sanitizedUsername}`;
    const ipRateKey = `login:ip:${clientIp}`;

    // Rate limiting check — reject both individual-account lockouts and
    // source-IP lockouts before we touch the password verifier. Counting every
    // attempt (not just failures) keeps this a single round-trip per key; a
    // successful login resets both counters below so a legitimate user who
    // mistyped their password a few times isn't left one guess from a lockout.
    const userVerdict = await rateLimit({ key: userRateKey, limit: USER_LOCK_THRESHOLD, windowMs: USER_LOCK_MS });
    if (!userVerdict.allowed) {
      const remainingMinutes = Math.ceil((userVerdict.resetAt - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.` },
        { status: 429 }
      );
    }
    const ipVerdict = await rateLimit({ key: ipRateKey, limit: IP_LOCK_THRESHOLD, windowMs: IP_LOCK_MS });
    if (!ipVerdict.allowed) {
      return NextResponse.json(
        { error: 'Too many failed attempts from this network. Try again later.' },
        { status: 429 }
      );
    }

    // Server-safe user authentication (no PouchDB — uses static user registry)
    const { authenticateUser } = await import('@/lib/server-users');

    const user = await authenticateUser(sanitizedUsername, password);

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check hospital assignment — super_admin, org_admin, government bypass
    const ROLES_WITHOUT_HOSPITAL = ['super_admin', 'org_admin', 'government', 'county_health_director'];
    if (!ROLES_WITHOUT_HOSPITAL.includes(user.role) && hospitalId && user.hospitalId && user.hospitalId !== hospitalId) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Clear failed attempts on successful login (both counters)
    await Promise.all([resetRateLimit(userRateKey), resetRateLimit(ipRateKey)]);

    // Provision (or refresh) the matching CouchDB user. Runs with admin
    // credentials server-side so the browser never sees them. The browser
    // then issues its own POST /_session to mint an AuthSession cookie.
    // Best-effort: if CouchDB is down, platform login still succeeds — the
    // user just won't sync until CouchDB is back.
    if (process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true') {
      try {
        const { ensureCouchUser } = await import('@/lib/sync/couch-auth');
        await ensureCouchUser({
          username: sanitizedUsername,
          password,
          orgId: user.orgId,
          hospitalId: user.hospitalId,
          platformRole: user.role,
        });
      } catch (err) {
        console.warn(
          '[login] CouchDB user provisioning failed — sync will be unavailable for this session.',
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Create JWT
    const token = await createToken({
      _id: user._id,
      username: user.username,
      role: user.role,
      name: user.name,
      hospitalId: user.hospitalId,
      orgId: user.orgId,
      // May be undefined if the user record predates countryId — that's fine.
      countryId: user.countryId,
      // Geographic tier fields — undefined for users without sub-org scope.
      payam: user.payam,
      county: user.county,
      state: user.state,
      // Carry the forced-change flag so the client can route a freshly created
      // or reset user straight to the "set your password" screen.
      mustChangePassword: user.mustChangePassword,
    });

    const response = NextResponse.json({
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        hospitalId: user.hospitalId,
        hospitalName: user.hospitalName,
        orgId: user.orgId,
        mustChangePassword: user.mustChangePassword,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set('tamamhealth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    // Mint a CSRF token bound to this session and set it as a NON-httpOnly
    // cookie so the browser's apiFetch wrapper can read it and echo it back
    // in the X-CSRF-Token header on every state-changing request. The HMAC
    // binds the token to the JWT subject (user._id), so a token issued for
    // one session can't be replayed against another even if it leaks. The
    // middleware refuses any /api/* mutation that doesn't present a matching
    // pair — without this cookie every client write would 403.
    const csrfToken = await mintCsrfToken(user._id);
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Login error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
