import { useMemo } from 'react';
import { useApp } from '@/lib/context';
import type { UserRole } from '@/lib/db-types';
import {
  type Capability,
  capabilitiesForUserRole,
  clinicalFlowRolesForUserRole,
} from '@/lib/clinical-flow';

/**
 * Capability-aware permissions for the current user (Principle 2.3 + §4 role
 * behavior). UI shows features based on the active role's capabilities —
 * unavailable actions are hidden, not greyed out. `can()` is the check the
 * clinical-flow UI uses instead of job-title comparisons.
 */
export function useCapabilities() {
  const { currentUser } = useApp();
  const role = currentUser?.role as UserRole | undefined;

  const capabilities = useMemo<Set<Capability>>(
    () => (role ? capabilitiesForUserRole(role) : new Set<Capability>()),
    [role],
  );

  const clinicalFlowRoles = useMemo(
    () => (role ? clinicalFlowRolesForUserRole(role) : []),
    [role],
  );

  function can(cap: Capability): boolean {
    return capabilities.has(cap);
  }

  /** True if the user holds ANY of the listed capabilities. */
  function canAny(...caps: Capability[]): boolean {
    return caps.some((c) => capabilities.has(c));
  }

  return { role, capabilities, clinicalFlowRoles, can, canAny };
}
