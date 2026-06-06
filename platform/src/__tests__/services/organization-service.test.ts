/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for organization-service.ts
 * Covers organization CRUD, slug management, and statistics.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-org-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs, putDoc } from '../helpers/test-db';
import {
  getAllOrganizations,
  getOrganizationById,
  getOrganizationBySlug,
  createOrganization,
  updateOrganization,
  deactivateOrganization,
  getOrganizationStats,
} from '@/lib/services/organization-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateOrganizationInput = Parameters<typeof createOrganization>[0];

function validOrganization(overrides: Partial<CreateOrganizationInput> = {}): CreateOrganizationInput {
  return {
    name: 'Ministry of Health',
    slug: 'moh-ss',
    logoUrl: 'https://example.com/logo.png',
    primaryColor: '#3b82f6',
    secondaryColor: '#1E40AF',
    accentColor: '#FF6B6B',
    subscriptionStatus: 'active' as const,
    subscriptionPlan: 'professional' as const,
    maxUsers: 500,
    maxHospitals: 50,
    featureFlags: {
      epidemicIntelligence: true,
      mchAnalytics: true,
      dhis2Export: true,
      aiClinicalSupport: true,
      communityHealth: true,
      facilityAssessments: true,
    },
    orgType: 'public' as const,
    contactEmail: 'admin@moh.gov.ss',
    country: 'South Sudan',
    isActive: true,
    ...overrides,
  };
}

describe('Organization Service', () => {
  test('creates an organization', async () => {
    const org = await createOrganization(validOrganization(), 'admin-001', 'admin');

    expect(org._id).toBe('org-moh-ss');
    expect(org.type).toBe('organization');
    expect(org.name).toBe('Ministry of Health');
    expect(org.slug).toBe('moh-ss');
    expect(org.createdAt).toBeTruthy();
    expect(org.createdBy).toBe('admin-001');
  });

  test('normalizes slug to lowercase and removes special characters', async () => {
    const org = await createOrganization(validOrganization({
      slug: 'Private-Hospital_ONE!',
    }));

    expect(org.slug).toBe('private-hospitalone');
    expect(org._id).toBe('org-private-hospitalone');
  });

  test('throws error when creating organization with existing slug', async () => {
    await createOrganization(validOrganization({ slug: 'health-org' }));

    await expect(
      createOrganization(validOrganization({
        name: 'Different Hospital',
        slug: 'HEALTH-ORG',
      }))
    ).rejects.toThrow(/already exists/);
  });

  test('retrieves all organizations', async () => {
    await createOrganization(validOrganization({ slug: 'org-1' }));
    await createOrganization(validOrganization({
      name: 'Second Org',
      slug: 'org-2',
    }));

    const all = await getAllOrganizations();
    expect(all).toHaveLength(2);
  });

  test('retrieves organization by ID', async () => {
    const org = await createOrganization(validOrganization());
    const found = await getOrganizationById(org._id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Ministry of Health');
  });

  test('returns null for nonexistent organization ID', async () => {
    const found = await getOrganizationById('org-nonexistent');
    expect(found).toBeNull();
  });

  test('retrieves organization by slug', async () => {
    await createOrganization(validOrganization({ slug: 'test-org' }));
    const found = await getOrganizationBySlug('test-org');

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Ministry of Health');
  });

  test('returns null when organization slug not found', async () => {
    const found = await getOrganizationBySlug('nonexistent-slug');
    expect(found).toBeNull();
  });

  test('updates organization data', async () => {
    const org = await createOrganization(validOrganization());

    const updated = await updateOrganization(
      org._id,
      {
        maxUsers: 1000,
        primaryColor: '#FF0000',
        subscriptionStatus: 'suspended',
      },
      'admin-002',
      'admin2'
    );

    expect(updated.maxUsers).toBe(1000);
    expect(updated.primaryColor).toBe('#FF0000');
    expect(updated.subscriptionStatus).toBe('suspended');
    expect(updated.name).toBe('Ministry of Health'); // unchanged
  });

  test('deactivates organization', async () => {
    const org = await createOrganization(validOrganization());

    await deactivateOrganization(org._id, 'admin-001', 'admin');

    const found = await getOrganizationById(org._id);
    expect(found!.isActive).toBe(false);
  });

  test('organization stats counts users correctly', async () => {
    const { usersDB } = require('@/lib/db');
    const org = await createOrganization(validOrganization({ slug: 'stat-org' }));

    // Add users for this org
    await putDoc(usersDB(), {
      _id: 'user-1',
      type: 'user',
      username: 'doctor1',
      passwordHash: 'hash1',
      name: 'Dr. John',
      role: 'doctor',
      orgId: org._id,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await putDoc(usersDB(), {
      _id: 'user-2',
      type: 'user',
      username: 'nurse1',
      passwordHash: 'hash2',
      name: 'Nurse Jane',
      role: 'nurse',
      orgId: org._id,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Add user for different org (should not be counted)
    await putDoc(usersDB(), {
      _id: 'user-3',
      type: 'user',
      username: 'doctor2',
      passwordHash: 'hash3',
      name: 'Dr. Smith',
      role: 'doctor',
      orgId: 'org-other',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const stats = await getOrganizationStats(org._id);
    expect(stats.userCount).toBe(2);
  });

  test('organization stats counts hospitals correctly', async () => {
    const { hospitalsDB } = require('@/lib/db');
    const org = await createOrganization(validOrganization({ slug: 'hosp-org' }));

    await putDoc(hospitalsDB(), {
      _id: 'hosp-1',
      type: 'hospital',
      name: 'Hospital A',
      town: 'Juba',
      state: 'Central Equatoria',
      facilityType: 'county_hospital',
      facilityLevel: 'county' as const,
      totalBeds: 100,
      doctors: 5,
      nurses: 20,
      orgId: org._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await putDoc(hospitalsDB(), {
      _id: 'hosp-2',
      type: 'hospital',
      name: 'Hospital B',
      town: 'Wau',
      state: 'Western Bahr el Ghazal',
      facilityType: 'county_hospital',
      facilityLevel: 'county' as const,
      totalBeds: 80,
      doctors: 4,
      nurses: 15,
      orgId: org._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const stats = await getOrganizationStats(org._id);
    expect(stats.hospitalCount).toBe(2);
  });

  test('organization stats counts patients correctly', async () => {
    const { patientsDB } = require('@/lib/db');
    const org = await createOrganization(validOrganization({ slug: 'pat-org' }));

    await putDoc(patientsDB(), {
      _id: 'pat-1',
      type: 'patient',
      hospitalNumber: 'H-001',
      firstName: 'John',
      surname: 'Doe',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      orgId: org._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await putDoc(patientsDB(), {
      _id: 'pat-2',
      type: 'patient',
      hospitalNumber: 'H-002',
      firstName: 'Jane',
      surname: 'Doe',
      dateOfBirth: '1995-06-15',
      gender: 'Female',
      orgId: org._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const stats = await getOrganizationStats(org._id);
    expect(stats.patientCount).toBe(2);
  });

  test('organization stats returns zeros for new organization', async () => {
    const org = await createOrganization(validOrganization({ slug: 'empty-org' }));

    const stats = await getOrganizationStats(org._id);
    expect(stats.userCount).toBe(0);
    expect(stats.hospitalCount).toBe(0);
    expect(stats.patientCount).toBe(0);
  });

  test('organization has feature flags configuration', async () => {
    const org = await createOrganization(validOrganization({
      featureFlags: {
        epidemicIntelligence: false,
        mchAnalytics: true,
        dhis2Export: false,
        aiClinicalSupport: true,
        communityHealth: false,
        facilityAssessments: false,
      },
    }));

    expect(org.featureFlags.epidemicIntelligence).toBe(false);
    expect(org.featureFlags.mchAnalytics).toBe(true);
  });

  test('preserves createdAt and createdBy on update', async () => {
    const org = await createOrganization(
      validOrganization({ slug: 'preserve-org' }),
      'user-1',
      'user1'
    );

    const originalCreatedAt = org.createdAt;
    const originalCreatedBy = org.createdBy;

    // Small delay to ensure different timestamp
    await new Promise(r => setTimeout(r, 10));
    await updateOrganization(org._id, { maxUsers: 999 }, 'user-2', 'user2');

    const updated = await getOrganizationById(org._id);
    expect(updated!.createdAt).toBe(originalCreatedAt);
    expect(updated!.createdBy).toBe(originalCreatedBy);
    expect(updated!.updatedAt).not.toBe(originalCreatedAt);
  });
});
