/**
 * Tenant control plane (SaaS kill-switch).
 *
 * Lets the platform operator revoke or suspend a tenant (organization) after
 * launch. The state lives on OrganizationDoc (`subscriptionStatus`, `isActive`)
 * and is enforced on EVERY authenticated API request via getAuthPayload, so a
 * suspended/cancelled/deactivated tenant immediately loses all access — no
 * redeploy or client cooperation required.
 *
 * Platform operators (super_admin) are exempt from the check so they can lift a
 * suspension after applying it.
 */
import { getOrganizationById } from './organization-service';

export type TenantDenyReason = 'suspended' | 'cancelled' | 'inactive' | 'expired';

export interface TenantAccess {
  allowed: boolean;
  reason?: TenantDenyReason;
}

/**
 * Whether a tenant org may currently access the platform. Fail-open on a
 * missing/unreadable org record (don't brick a live clinic on a transient DB
 * read); fail-closed only on an explicit operator action (suspended/cancelled/
 * deactivated) or a hard expiry.
 */
export async function getTenantAccess(orgId: string | undefined): Promise<TenantAccess> {
  if (!orgId) return { allowed: true };
  const org = await getOrganizationById(orgId);
  if (!org) return { allowed: true };
  if (org.isActive === false) return { allowed: false, reason: 'inactive' };
  if (org.subscriptionStatus === 'suspended') return { allowed: false, reason: 'suspended' };
  if (org.subscriptionStatus === 'cancelled') return { allowed: false, reason: 'cancelled' };
  // Optional hard expiry — operator may set a date after which access stops.
  const expiry = (org as unknown as { accessExpiresAt?: string }).accessExpiresAt;
  if (expiry && new Date(expiry).getTime() < Date.now()) return { allowed: false, reason: 'expired' };
  return { allowed: true };
}

/** Convenience boolean wrapper for the auth gate. */
export async function isOrgAccessAllowed(orgId: string | undefined): Promise<boolean> {
  return (await getTenantAccess(orgId)).allowed;
}
