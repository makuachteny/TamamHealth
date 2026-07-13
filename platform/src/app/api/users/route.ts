/**
 * API: /api/users
 * GET  — List all users (supports filtering by role, hospitalId, etc.)
 * POST — Create user, update user, reset password, or deactivate user
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'pharmacist', 'medical_superintendent', 'hrio',
];
const WRITE_ROLES: UserRole[] = [
  'super_admin', 'org_admin',
];
// Platform-wide / national (cross-tenant) roles. A user holding one of these
// bypasses org scoping in filterByScope, so only a platform operator
// (super_admin) may grant them. Without this guard a tenant's org_admin could
// create — or promote themselves into — a super_admin/government account and
// read every other organization's PHI (privilege-escalation → tenant breakout).
const PRIVILEGED_ASSIGNABLE_ROLES: UserRole[] = ['super_admin', 'government', 'county_health_director'];

/**
 * Return a 403 if `actorRole` is not allowed to assign `targetRole`.
 * super_admin may assign anything; everyone else (i.e. org_admin) is confined
 * to non-privileged roles within their own tenant.
 */
function assignableRoleError(actorRole: UserRole, targetRole: UserRole | undefined): NextResponse | null {
  if (!targetRole) return null;
  if (actorRole === 'super_admin') return null;
  if (PRIVILEGED_ASSIGNABLE_ROLES.includes(targetRole)) {
    return forbidden('You are not permitted to assign platform or national roles.');
  }
  return null;
}
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    const { getAllUsers } = await import('@/lib/services/user-service');
    const { buildScopeFromAuth } = await import('@/lib/services/data-scope');
    const scope = buildScopeFromAuth(auth);
    const users = await getAllUsers(scope);
    return NextResponse.json({ users });
  } catch (err) {
    logApiError('[API /users GET]', err);
    return serverError();
  }
}
async function postHandler(request: NextRequest) {
  try {
    const { checkRateLimit } = await import('@/lib/api-security');
    const rateLimitResponse = checkRateLimit(request, 'users:write', 20);
    if (rateLimitResponse) return rateLimitResponse;
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, WRITE_ROLES)) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { sanitizePayload } = await import('@/lib/validation');
    body = sanitizePayload(body);
    const action = body.action as string;
    const { getUserById } = await import('@/lib/services/user-service');
    // Reset password
    if (action === 'reset_password') {
      if (!body.userId || !body.newPassword) {
        return NextResponse.json(
          { error: 'userId and newPassword are required' },
          { status: 400 }
        );
      }
      if (auth.role === 'org_admin') {
        const target = await getUserById(body.userId as string);
        if (target && target.orgId && auth.orgId && target.orgId !== auth.orgId) {
          return forbidden('Cannot modify users outside your own organization');
        }
      }
      const { resetPassword } = await import('@/lib/services/user-service');
      await resetPassword(
        body.userId as string,
        body.newPassword as string,
        auth.sub,
        auth.username
      );
      return NextResponse.json({ success: true });
    }
    // Deactivate user
    if (action === 'deactivate') {
      if (!body.userId) {
        return NextResponse.json(
          { error: 'userId is required' },
          { status: 400 }
        );
      }
      if (auth.role === 'org_admin') {
        const target = await getUserById(body.userId as string);
        if (target && target.orgId && auth.orgId && target.orgId !== auth.orgId) {
          return forbidden('Cannot modify users outside your own organization');
        }
      }
      const { deactivateUser } = await import('@/lib/services/user-service');
      await deactivateUser(body.userId as string, auth.sub, auth.username);
      return NextResponse.json({ success: true });
    }
    // Update existing user
    if (action === 'update' && body.userId) {
      const roleError = assignableRoleError(auth.role, body.role as UserRole | undefined);
      if (roleError) return roleError;
      const existingUser = await getUserById(body.userId as string);
      if (auth.role === 'org_admin') {
        if (existingUser && existingUser.orgId && auth.orgId && existingUser.orgId !== auth.orgId) {
          return forbidden('Cannot modify users outside your own organization');
        }
        const targetOrgId = (body.orgId as string | undefined) || existingUser?.orgId;
        if (targetOrgId && auth.orgId && targetOrgId !== auth.orgId) {
          return forbidden('Cannot modify users outside your own organization');
        }
        body.orgId = auth.orgId;
        if (body.hospitalId) {
          const { getHospitalById } = await import('@/lib/services/hospital-service');
          const targetHospital = await getHospitalById(body.hospitalId as string);
          if (!targetHospital || (targetHospital.orgId && targetHospital.orgId !== auth.orgId)) {
            return forbidden('Cannot assign user to a facility outside your organization');
          }
        }
      }
      const { updateUser } = await import('@/lib/services/user-service');
      const updated = await updateUser(
        body.userId as string,
        {
          name: body.name as string | undefined,
          role: body.role as UserRole | undefined,
          hospitalId: body.hospitalId as string | undefined,
          hospitalName: body.hospitalName as string | undefined,
          isActive: body.isActive as boolean | undefined,
        },
        auth.sub,
        auth.username
      );
      return NextResponse.json({ user: updated });
    }
    // Create new user
    if (!body.username || !body.password || !body.name || !body.role) {
      return NextResponse.json(
        { error: 'username, password, name, and role are required' },
        { status: 400 }
      );
    }
    const createRoleError = assignableRoleError(auth.role, body.role as UserRole);
    if (createRoleError) return createRoleError;
    if (auth.role === 'org_admin') {
      const targetOrgId = body.orgId as string | undefined;
      if (targetOrgId && auth.orgId && targetOrgId !== auth.orgId) {
        return forbidden('Cannot modify users outside your own organization');
      }
      body.orgId = auth.orgId;
      if (body.hospitalId) {
        const { getHospitalById } = await import('@/lib/services/hospital-service');
        const targetHospital = await getHospitalById(body.hospitalId as string);
        if (!targetHospital || (targetHospital.orgId && targetHospital.orgId !== auth.orgId)) {
          return forbidden('Cannot assign user to a facility outside your organization');
        }
      }
    }
    const { createUser } = await import('@/lib/services/user-service');
    const user = await createUser(
      {
        username: body.username as string,
        password: body.password as string,
        name: body.name as string,
        role: body.role as UserRole,
        hospitalId: body.hospitalId as string | undefined,
        hospitalName: body.hospitalName as string | undefined,
        orgId: body.orgId as string | undefined,
      },
      auth.sub,
      auth.username
    );
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    // The user-service throws plain `Error` for validation problems
    // ("Invalid role", "Clinical users must be assigned to a hospital",
    // "Username already exists", "Invalid username"). Translate those into
    // 400/409 instead of 500 so callers can correct their input.
    if (err instanceof Error) {
      const msg = err.message;
      if (/already exists/i.test(msg)) {
        return NextResponse.json({ error: msg }, { status: 409 });
      }
      if (
        /must be assigned to a hospital/i.test(msg) ||
        /^Invalid role/i.test(msg) ||
        /^Invalid username/i.test(msg) ||
        /^Password/i.test(msg)
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    logApiError('[API /users POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'user.create' });
