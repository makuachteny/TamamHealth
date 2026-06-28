/**
 * Shared server-side authentication helper for API routes.
 * Extracts and verifies the JWT from the request cookie, returning the
 * authenticated user payload or null.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth-token';
import { isTokenRevoked } from './token-blacklist';
import { captureException } from './observability';
import type { UserRole } from './db-types';

export interface AuthPayload {
  sub: string;
  username: string;
  role: UserRole;
  name: string;
  hospitalId?: string;
  orgId?: string;
  /** ISO 3166-1 alpha-2 — facility's country (e.g. "SS" for South Sudan) */
  countryId?: string;
  /** Geographic tier fields for sub-org scoping (P0 tier-isolation). */
  payam?: string;
  county?: string;
  state?: string;
  /** True when the user must set a new password before using the app. */
  mustChangePassword?: boolean;
}

/**
 * Verify the JWT cookie on the incoming request.
 * Returns the decoded payload or null if missing/invalid.
 *
 * Also rejects tokens whose underlying user has been deactivated since the
 * JWT was issued. Without this check a deactivated user keeps full access
 * until the JWT's natural expiry (up to 8h), which defeats the point of
 * deactivation. We look the user up in the users DB and require
 * `isActive !== false`. In production this check fails closed: a missing or
 * unreadable user record invalidates the JWT, except for the synthetic
 * bootstrap "admin" account used before the users DB exists.
 */
export async function getAuthPayload(request: NextRequest): Promise<AuthPayload | null> {
  const token = request.cookies.get('tamamhealth-token')?.value;
  if (!token) return null;

  // Reject tokens that have been explicitly revoked (logout). The store is
  // file-backed and survives restarts.
  if (await isTokenRevoked(token)) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;
  const auth = payload as AuthPayload;
  const isProduction = process.env.NODE_ENV === 'production';

  // Live deactivation check. Avoid the lookup for the synthetic "admin"
  // bootstrap account whose JWT is issued before any users DB exists.
  try {
    const { getUserById } = await import('./services/user-service');
    const user = await getUserById(auth.sub);
    // If the user record exists and is explicitly deactivated, deny.
    // Missing user in production → deny; non-production remains permissive for
    // local/demo bootstrap data.
    if (user && user.isActive === false) return null;
    if (!user && isProduction && auth.sub !== 'admin') return null;
  } catch (err) {
    if (isProduction && auth.sub !== 'admin') {
      captureException(err, { area: 'api-auth', check: 'user-active', sub: auth.sub });
      return null;
    }
  }

  // Tenant kill-switch (SaaS control plane). A suspended / cancelled /
  // deactivated organization loses all access on the next request. Platform
  // operators (super_admin) are exempt so they can lift the suspension. In
  // production, tenant lookup errors fail closed rather than granting access
  // while the control plane is unavailable.
  if (auth.role !== 'super_admin' && auth.orgId) {
    try {
      const { isOrgAccessAllowed } = await import('./services/tenant-control-service');
      if (!(await isOrgAccessAllowed(auth.orgId))) return null;
    } catch (err) {
      if (isProduction) {
        captureException(err, { area: 'api-auth', check: 'tenant-access', orgId: auth.orgId });
        return null;
      }
    }
  }

  return auth;
}

/**
 * Convenience: return a 401 JSON response.
 */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Convenience: return a 403 JSON response.
 */
export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Check whether the authenticated user has one of the required roles.
 */
export function hasRole(auth: AuthPayload, allowed: UserRole[]): boolean {
  return allowed.includes(auth.role);
}

/**
 * Standard error response for validation errors.
 */
export function validationError(errors: Record<string, string>) {
  return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 });
}

/**
 * Standard error response for server errors.
 */
export function serverError(message = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Extract a safe loggable representation of an unknown error. Avoids dumping
 * raw error objects that may hold request bodies or other PHI in their
 * properties. Only the message, error name, and a short stack preview are
 * returned.
 */
export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Include the first two stack frames only — enough to locate the throw
    // site without leaking user-supplied values from deeper in the call path.
    const stackHead = err.stack
      ? err.stack.split('\n').slice(0, 3).join(' | ')
      : '';
    return `${err.name}: ${err.message}${stackHead ? ` (${stackHead})` : ''}`;
  }
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

/**
 * Log an API error with a route tag and a sanitized payload. Use this
 * everywhere instead of `console.error('[tag]', err)` so we never
 * accidentally write a raw request body / patient record to the log.
 *
 * Also forwards to Sentry when the SDK is initialised. The local console
 * line is kept for dev visibility; in production the operator gets both a
 * structured log line and a Sentry event with the route tag attached.
 */
export function logApiError(tag: string, err: unknown): void {
  console.error(tag, sanitizeError(err));
  captureException(err, { tag });
}
