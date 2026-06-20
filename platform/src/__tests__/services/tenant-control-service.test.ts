/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for the tenant control plane (SaaS kill-switch).
 */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { getTenantAccess, isOrgAccessAllowed } from '@/lib/services/tenant-control-service';

afterEach(async () => { await teardownTestDBs(); });

async function putOrg(overrides: Record<string, unknown>) {
  const db = require('@/lib/db').organizationsDB();
  const now = new Date().toISOString();
  const doc = {
    _id: 'org-1', type: 'organization', name: 'Demo', slug: 'demo',
    primaryColor: '#000', secondaryColor: '#fff',
    subscriptionStatus: 'active', subscriptionPlan: 'professional',
    maxUsers: 50, maxHospitals: 5, orgType: 'private', contactEmail: 'a@b.c',
    country: 'SS', isActive: true, createdAt: now, updatedAt: now,
    featureFlags: {}, ...overrides,
  };
  await db.put(doc);
  return doc._id as string;
}

describe('Tenant control plane (kill-switch)', () => {
  test('an active org is allowed', async () => {
    const id = await putOrg({ subscriptionStatus: 'active', isActive: true });
    expect(await isOrgAccessAllowed(id)).toBe(true);
  });

  test('a suspended org is denied', async () => {
    const id = await putOrg({ subscriptionStatus: 'suspended' });
    const access = await getTenantAccess(id);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('suspended');
  });

  test('a cancelled org is denied', async () => {
    const id = await putOrg({ subscriptionStatus: 'cancelled' });
    expect((await getTenantAccess(id)).reason).toBe('cancelled');
  });

  test('a deactivated org is denied', async () => {
    const id = await putOrg({ isActive: false });
    expect((await getTenantAccess(id)).reason).toBe('inactive');
  });

  test('a hard access expiry in the past denies', async () => {
    const id = await putOrg({ accessExpiresAt: '2000-01-01T00:00:00Z' });
    expect((await getTenantAccess(id)).reason).toBe('expired');
  });

  test('a future access expiry still allows', async () => {
    const id = await putOrg({ accessExpiresAt: '2999-01-01T00:00:00Z' });
    expect(await isOrgAccessAllowed(id)).toBe(true);
  });

  test('fails open for an unknown org (no record) — does not brick on a bad id', async () => {
    expect(await isOrgAccessAllowed('org-does-not-exist')).toBe(true);
  });

  test('no orgId is allowed (e.g. platform-level account)', async () => {
    expect(await isOrgAccessAllowed(undefined)).toBe(true);
  });
});
