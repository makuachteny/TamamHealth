import type { UserRole } from '../db-types';

export interface DataScope {
  orgId?: string;
  hospitalId?: string;
  payam?: string;
  county?: string;
  state?: string;
  role: UserRole;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterByScope<T extends Record<string, any>>(
  docs: T[],
  scope: DataScope
): T[] {
  // Super admin and national government see everything
  if (scope.role === 'super_admin' || scope.role === 'government') return docs;

  // Everyone else is filtered by orgId
  let filtered = docs;
  if (scope.orgId) {
    // Require orgId match — reject docs without orgId for data isolation
    filtered = filtered.filter(d => d.orgId === scope.orgId);
  }

  // Payam supervisors are scoped to their payam, not their hospital — they
  // oversee every facility in the payam (P0 tier-isolation fix).
  if (scope.role === 'payam_supervisor' && scope.payam) {
    const sPayam = scope.payam;
    filtered = filtered.filter(d => d.payam === sPayam);
    return filtered;
  }

  // Non-admin roles that have a hospitalId are further scoped
  const ADMIN_ROLES: UserRole[] = ['super_admin', 'org_admin', 'government'];
  if (!ADMIN_ROLES.includes(scope.role) && scope.hospitalId) {
    const hospId = scope.hospitalId;
    filtered = filtered.filter(d => {
      const matches =
        d.hospitalId === hospId ||
        d.registrationHospital === hospId ||
        d.lastVisitHospital === hospId ||
        d.fromHospitalId === hospId ||
        d.toHospitalId === hospId ||
        d.facilityId === hospId;
      // Only allow docs that explicitly match this hospital or have no hospital field
      return matches || (!d.hospitalId && !d.registrationHospital && !d.facilityId);
    });
  }

  return filtered;
}

/**
 * Build a DataScope from a JWT auth payload (used by API routes).
 */
export function buildScopeFromAuth(auth: {
  role: string;
  orgId?: string;
  hospitalId?: string;
  payam?: string;
  county?: string;
  state?: string;
}): DataScope {
  return {
    role: auth.role as UserRole,
    orgId: auth.orgId,
    hospitalId: auth.hospitalId,
    payam: auth.payam,
    county: auth.county,
    state: auth.state,
  };
}
