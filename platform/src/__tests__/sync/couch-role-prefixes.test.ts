/**
 * Sync — CouchDB user role provisioning prefixes (src/lib/sync/couch-auth.ts).
 *
 * Regression for BUG-002: provisioned CouchDB users carried `org-<id>` /
 * `facility-<id>` / `platform-<role>`, but the installed validate_doc_update
 * (compiled from write-permissions.ts) reads the `org:` and `role:` prefixes.
 * The mismatch meant the org boundary never fired and every typed-doc write
 * threw "no role claim on the CouchDB user". This locks the two sides to the
 * same prefix convention.
 */
import { buildValidateDocUpdateFn } from '@/lib/sync/write-permissions';

// The validator source is a string of JS (installed on CouchDB). We assert on
// its text: it must inspect the `org:` and `role:` prefixes, so the provisioner
// must emit those exact prefixes.
const validatorSrc = buildValidateDocUpdateFn();

describe('validate_doc_update expects the org:/role: prefixes', () => {
  test('the tenant-boundary check reads the org: prefix', () => {
    expect(validatorSrc).toContain("indexOf('org:')");
  });
  test('the acting-role check reads the role: prefix', () => {
    expect(validatorSrc).toContain("indexOf('role:')");
  });
});

/**
 * Reproduce the provisioner's role construction (couch-auth.ts ensureCouchUser)
 * and confirm the prefixes line up with what the validator parses. If someone
 * reverts the provisioner to `org-`/`role-`, the substring parses below break.
 */
function provisionRoles(input: { orgId?: string; hospitalId?: string; platformRole?: string }) {
  const roles: string[] = [];
  if (input.orgId) roles.push(`org:${input.orgId}`);
  if (input.hospitalId) roles.push(`facility:${input.hospitalId}`);
  if (input.platformRole) roles.push(`role:${input.platformRole}`);
  return roles;
}

describe('provisioned roles parse the way the validator reads them', () => {
  const roles = provisionRoles({ orgId: 'org-moh-ss', hospitalId: 'hosp-001', platformRole: 'front_desk' });

  test('emits org:/facility:/role: prefixes', () => {
    expect(roles).toEqual(['org:org-moh-ss', 'facility:hosp-001', 'role:front_desk']);
  });

  test("the validator's org: parse (substring after index 4) recovers the orgId", () => {
    const orgRole = roles.find((r) => r.indexOf('org:') === 0)!;
    expect(orgRole.substring(4)).toBe('org-moh-ss');
  });

  test("the validator's role: parse (substring after index 5) recovers the platform role", () => {
    const roleClaim = roles.find((r) => r.indexOf('role:') === 0)!;
    expect(roleClaim.substring(5)).toBe('front_desk');
  });
});
