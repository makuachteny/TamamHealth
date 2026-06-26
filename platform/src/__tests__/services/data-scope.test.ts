/**
 * Tests for data-scope.ts
 * Covers multi-tenant data isolation, role-based filtering, and scope building.
 */
import { filterByScope, buildScopeFromAuth } from '@/lib/services/data-scope';
import type { DataScope } from '@/lib/services/data-scope';

// Mock docs representing different facilities and organizations
const docs = [
  { _id: '1', orgId: 'org-001', hospitalId: 'hosp-001', name: 'Doc A' },
  { _id: '2', orgId: 'org-001', hospitalId: 'hosp-002', name: 'Doc B' },
  { _id: '3', orgId: 'org-002', hospitalId: 'hosp-003', name: 'Doc C' },
  { _id: '4', orgId: 'org-001', facilityId: 'hosp-001', name: 'Doc D' },
  { _id: '5', name: 'Doc E (no org or hospital)' },
  { _id: '6', orgId: 'org-001', fromHospitalId: 'hosp-001', toHospitalId: 'hosp-003', name: 'Referral' },
];

describe('Data Scope - Multi-Tenant Isolation', () => {
  test('super_admin sees everything', () => {
    const scope: DataScope = { role: 'super_admin' };
    expect(filterByScope(docs, scope)).toHaveLength(6);
  });

  test('government role sees everything', () => {
    const scope: DataScope = { role: 'government' };
    expect(filterByScope(docs, scope)).toHaveLength(6);
  });

  test('org_admin sees only their org', () => {
    const scope: DataScope = { role: 'org_admin', orgId: 'org-001' };
    const filtered = filterByScope(docs, scope);
    expect(filtered.every(d => d.orgId === 'org-001')).toBe(true);
    expect(filtered.length).toBe(4); // docs 1, 2, 4, 6 are org-001
  });

  test('nurse sees only their hospital within their org', () => {
    const scope: DataScope = { role: 'nurse', orgId: 'org-001', hospitalId: 'hosp-001' };
    const filtered = filterByScope(docs, scope);
    // Should see docs matching hosp-001 (via hospitalId or facilityId or fromHospitalId)
    expect(filtered.length).toBeGreaterThanOrEqual(2);
    // Should NOT see hosp-002 or hosp-003 docs
    expect(filtered.find(d => d.hospitalId === 'hosp-002')).toBeUndefined();
  });

  test('doctor sees referrals they sent (fromHospitalId match)', () => {
    const scope: DataScope = { role: 'doctor', orgId: 'org-001', hospitalId: 'hosp-001' };
    const filtered = filterByScope(docs, scope);
    const referral = filtered.find(d => d.name === 'Referral');
    expect(referral).toBeDefined();
  });

  test('different org sees nothing from other org', () => {
    const scope: DataScope = { role: 'doctor', orgId: 'org-002', hospitalId: 'hosp-003' };
    const filtered = filterByScope(docs, scope);
    expect(filtered.every(d => d.orgId === 'org-002')).toBe(true);
  });

  test('docs without orgId are excluded for org-scoped users', () => {
    const scope: DataScope = { role: 'nurse', orgId: 'org-001', hospitalId: 'hosp-001' };
    const filtered = filterByScope(docs, scope);
    // Doc E has no orgId so should be excluded
    expect(filtered.find(d => d.name === 'Doc E (no org or hospital)')).toBeUndefined();
  });
});

describe('buildScopeFromAuth', () => {
  test('builds scope from JWT auth payload', () => {
    const scope = buildScopeFromAuth({
      role: 'doctor',
      orgId: 'org-001',
      hospitalId: 'hosp-001',
    });
    expect(scope).toEqual({
      role: 'doctor',
      orgId: 'org-001',
      hospitalId: 'hosp-001',
    });
  });

  test('handles auth without optional fields', () => {
    const scope = buildScopeFromAuth({
      role: 'super_admin',
    });
    expect(scope.role).toBe('super_admin');
    expect(scope.orgId).toBeUndefined();
    expect(scope.hospitalId).toBeUndefined();
  });

  test('nurse can see docs with no hospital fields (line 37 fallback)', () => {
    // Tests line 37: return matches || (!d.hospitalId && !d.registrationHospital && !d.facilityId);
    // Docs without any hospital fields should be visible to scoped users
    const docWithoutHospital = { _id: 'generic-001', orgId: 'org-001', name: 'Generic doc' };
    const testDocs = [docWithoutHospital];

    const scope: DataScope = { role: 'nurse', orgId: 'org-001', hospitalId: 'hosp-001' };
    const filtered = filterByScope(testDocs, scope);

    // Should include docs without hospital fields
    expect(filtered).toHaveLength(1);
    expect(filtered[0]._id).toBe('generic-001');
  });

  test('hospital-scoped filter correctly excludes docs from different hospital', () => {
    // Verify that docs with different hospital ID are excluded
    const scope: DataScope = { role: 'nurse', orgId: 'org-001', hospitalId: 'hosp-001' };
    const testDocs = [
      { _id: '1', orgId: 'org-001', hospitalId: 'hosp-002', name: 'Different hospital' },
      { _id: '2', orgId: 'org-001', hospitalId: 'hosp-001', name: 'Same hospital' },
    ];

    const filtered = filterByScope(testDocs, scope);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].hospitalId).toBe('hosp-001');
  });
});
