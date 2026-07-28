/**
 * @jest-environment node
 *
 * Facility entitlement and replication selector (KAN-95).
 *
 * These tests evaluate the generated selector against documents directly. That
 * is the meaningful check: the selector is what CouchDB applies server-side, so
 * whether a document reaches a device is decided entirely by this shape. The
 * previous implementation was a browser-side `filter` function constrained to
 * `orgId` alone — no facility condition existed at all.
 */

import {
  entitlementFor,
  replicationSelector,
  MULTI_FACILITY_ROLES,
} from '@/lib/sync/facility-entitlements';

/**
 * A minimal Mango-selector evaluator covering the operators this module emits
 * ($and / $or / $in / $exists / equality).
 *
 * Hand-rolled deliberately: asserting on the selector's literal JSON shape
 * would pass while meaning the wrong thing, and would break on any harmless
 * restructuring. What matters is which documents it admits.
 */
function matches(selector: Record<string, unknown> | undefined, doc: Record<string, unknown>): boolean {
  if (!selector) return true;

  return Object.entries(selector).every(([key, cond]) => {
    if (key === '$and') return (cond as Record<string, unknown>[]).every(c => matches(c, doc));
    if (key === '$or') return (cond as Record<string, unknown>[]).some(c => matches(c, doc));

    const value = doc[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      const c = cond as Record<string, unknown>;
      if ('$exists' in c) return (value !== undefined) === c.$exists;
      if ('$in' in c) return (c.$in as unknown[]).includes(value);
    }
    return value === cond;
  });
}

const nurse = { role: 'nurse' as const, orgId: 'org-1', hospitalId: 'hosp-A' };

describe('entitlementFor', () => {
  it('limits a facility-scoped user to their own facility', () => {
    expect(entitlementFor(nurse)).toEqual({
      orgId: 'org-1', facilityIds: ['hosp-A'], allFacilities: false,
    });
  });

  it('grants org-wide access to multi-facility roles', () => {
    for (const role of MULTI_FACILITY_ROLES) {
      const e = entitlementFor({ role, orgId: 'org-1', hospitalId: 'hosp-A' });
      expect(e.allFacilities).toBe(true);
    }
  });

  it('entitles a missing user to nothing', () => {
    // Returning "all facilities" here would let a logged-out or half-loaded
    // client replicate the entire organisation.
    expect(entitlementFor(null)).toEqual({ facilityIds: [], allFacilities: false });
    expect(entitlementFor(undefined).allFacilities).toBe(false);
  });

  it('merges explicit grants with the home facility without duplicating', () => {
    const e = entitlementFor({ ...nurse, facilityIds: ['hosp-B', 'hosp-A'] });
    expect(e.facilityIds.sort()).toEqual(['hosp-A', 'hosp-B']);
  });
});

describe('replicationSelector', () => {
  const selectorFor = (u: Parameters<typeof entitlementFor>[0]) =>
    replicationSelector(entitlementFor(u));

  it("excludes another facility's PHI from a facility-scoped user", () => {
    const sel = selectorFor(nurse);

    // The defect this closes: this document replicated to every device in the
    // org, and only the UI hid it.
    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-B' })).toBe(false);
    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-A' })).toBe(true);
  });

  it("excludes another organisation's data", () => {
    const sel = selectorFor(nurse);
    expect(matches(sel, { type: 'patient', orgId: 'org-2', hospitalId: 'hosp-A' })).toBe(false);
  });

  it('still admits reference data that belongs to no facility', () => {
    const sel = selectorFor(nurse);
    // Excluding these would break every screen — they are not facility PHI.
    expect(matches(sel, { type: 'icd_code', orgId: 'org-1' })).toBe(true);
    expect(matches(sel, { type: 'platform_config' })).toBe(true);
  });

  it('admits every facility in the org for a multi-facility role', () => {
    const sel = selectorFor({ role: 'org_admin', orgId: 'org-1', hospitalId: 'hosp-A' });

    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-A' })).toBe(true);
    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-B' })).toBe(true);
    // But still not another org's.
    expect(matches(sel, { type: 'patient', orgId: 'org-2', hospitalId: 'hosp-B' })).toBe(false);
  });

  it('fails CLOSED for a user with no facility at all', () => {
    const sel = selectorFor({ role: 'nurse', orgId: 'org-1' });

    // A user whose facility is unknown must not fall through to receiving
    // everything — which is precisely what an "empty means all" reading of the
    // facility list would have done.
    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-A' })).toBe(false);
    expect(matches(sel, { type: 'platform_config' })).toBe(true);
  });

  it('honours an explicit multi-facility grant', () => {
    const sel = selectorFor({ ...nurse, facilityIds: ['hosp-B'] });

    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-A' })).toBe(true);
    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-B' })).toBe(true);
    expect(matches(sel, { type: 'patient', orgId: 'org-1', hospitalId: 'hosp-C' })).toBe(false);
  });

  it('produces no selector only when the user is entitled to everything', () => {
    // An unconstrained replication should be an explicit, visible decision.
    expect(replicationSelector({ facilityIds: [], allFacilities: true })).toBeUndefined();
    expect(replicationSelector(entitlementFor(nurse))).toBeDefined();
  });
});

describe('the boundary does not depend on the UI filter (KAN-95 acceptance)', () => {
  it('keeps cross-facility documents out of the replica with no client filtering applied', () => {
    // The acceptance criterion is that removing the client-side scope filter
    // does not expose cross-facility data. `matches` applies ONLY the selector
    // — no filterByScope, no UI — so a pass here means the exclusion happened
    // at the replication layer.
    const sel = replicationSelector(entitlementFor(nurse));

    const remote = [
      { _id: 'p1', type: 'patient', orgId: 'org-1', hospitalId: 'hosp-A' },
      { _id: 'p2', type: 'patient', orgId: 'org-1', hospitalId: 'hosp-B' },
      { _id: 'p3', type: 'patient', orgId: 'org-2', hospitalId: 'hosp-C' },
      { _id: 'r1', type: 'icd_code' },
    ];

    const replicated = remote.filter(d => matches(sel, d));

    expect(replicated.map(d => d._id)).toEqual(['p1', 'r1']);
    // Zero documents belonging to another facility.
    expect(replicated.some(d => d.hospitalId && d.hospitalId !== 'hosp-A')).toBe(false);
  });
});
