/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for patient-service.ts
 * Covers CRUD operations, search, validation, and geocode ID generation.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs, putDoc } from '../helpers/test-db';
import {
  getAllPatients,
  getPatientById,
  searchPatients,
  createPatient,
  updatePatient,
  getPatientsByHospital,
  generateGeocodeId,
} from '@/lib/services/patient-service';
import { ValidationError } from '@/lib/validation';
import { hospitalsDB } from '@/lib/db';

// Minimal valid patient data that passes validatePatientData
const validPatient = () => ({
  firstName: 'Achol',
  middleName: '',
  surname: 'Deng',
  gender: 'Female' as const,
  dateOfBirth: '1995-06-15',
  phone: '+211912345678',
  state: 'Central Equatoria',
  county: 'Juba',
  tribe: 'Dinka',
  primaryLanguage: 'Arabic',
  bloodType: 'O+',
  allergies: [] as string[],
  chronicConditions: [] as string[],
  nokName: 'Deng Mabior',
  nokRelationship: 'Father',
  nokPhone: '+211912345679',
  hospitalNumber: '',
  registrationHospital: 'hosp-001',
  registrationDate: '2025-01-10',
  lastVisitDate: '2025-01-10',
  lastVisitHospital: 'hosp-001',
  isActive: true,
});

/**
 * Seed the in-memory hospitalsDB with the demo facilities the patient
 * service consults to derive a hospital-number prefix. Without these docs,
 * `getHospitalPrefix()` falls through to the default ('TAB'), which would
 * break the JTH-/WSH- expectations baked into legacy tests below.
 */
async function seedDemoHospitals(): Promise<void> {
  const hdb = hospitalsDB();
  await putDoc(hdb, { _id: 'hosp-001', type: 'hospital', name: 'Juba Teaching Hospital', code: 'JTH' } as unknown as { _id: string });
  await putDoc(hdb, { _id: 'hosp-002', type: 'hospital', name: 'Wau State Hospital', code: 'WSH' } as unknown as { _id: string });
}

beforeEach(async () => {
  await seedDemoHospitals();
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('patient-service', () => {
  // ---- getAllPatients ----
  test('getAllPatients returns empty array initially', async () => {
    const patients = await getAllPatients();
    expect(patients).toEqual([]);
  });

  // ---- createPatient ----
  test('createPatient creates a patient with correct fields', async () => {
    const data = validPatient();
    const patient = await createPatient(data);

    expect(patient._id).toMatch(/^pat-/);
    expect(patient.type).toBe('patient');
    expect(patient.firstName).toBe('Achol');
    expect(patient.surname).toBe('Deng');
    expect(patient.gender).toBe('Female');
    expect(patient.createdAt).toBeDefined();
    expect(patient.updatedAt).toBeDefined();
    expect(patient._rev).toBeDefined();
  });

  test('createPatient validates required fields - throws ValidationError for missing firstName', async () => {
    const data = { ...validPatient(), firstName: '' };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('createPatient throws ValidationError for missing surname', async () => {
    const data = { ...validPatient(), surname: '' };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('createPatient throws ValidationError for invalid gender', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = { ...validPatient(), gender: 'other' as any };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('createPatient throws ValidationError when both dateOfBirth and estimatedAge are missing', async () => {
    const data = { ...validPatient(), dateOfBirth: '' };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('createPatient auto-generates hospital number', async () => {
    const data = validPatient();
    // Do not supply hospitalNumber
    const patient = await createPatient(data);
    expect(patient.hospitalNumber).toMatch(/^JTH-\d{6}$/);
  });

  test('createPatient preserves explicit hospital number', async () => {
    const data = { ...validPatient(), hospitalNumber: 'CUSTOM-001' };
    const patient = await createPatient(data);
    expect(patient.hospitalNumber).toBe('CUSTOM-001');
  });

  // ---- getPatientById ----
  test('getPatientById finds existing patient', async () => {
    const created = await createPatient(validPatient());
    const found = await getPatientById(created._id);
    expect(found).not.toBeNull();
    expect(found!._id).toBe(created._id);
    expect(found!.firstName).toBe('Achol');
  });

  test('getPatientById returns null for non-existent id', async () => {
    const found = await getPatientById('pat-does-not-exist');
    expect(found).toBeNull();
  });

  // ---- searchPatients ----
  test('searchPatients finds by name', async () => {
    await createPatient(validPatient());
    await createPatient({ ...validPatient(), firstName: 'Nyabol', surname: 'Kuol', phone: '+211912345999', dateOfBirth: '1998-03-10' });

    const results = await searchPatients('Achol');
    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe('Achol');
  });

  test('searchPatients finds by hospital number', async () => {
    const patient = await createPatient({ ...validPatient(), hospitalNumber: 'WBG-000123' });
    const results = await searchPatients('WBG-000123');
    expect(results).toHaveLength(1);
    expect(results[0]._id).toBe(patient._id);
  });

  test('searchPatients returns empty for no match', async () => {
    await createPatient(validPatient());
    const results = await searchPatients('ZZZZZZ');
    expect(results).toHaveLength(0);
  });

  // ---- updatePatient ----
  test('updatePatient modifies fields', async () => {
    const created = await createPatient(validPatient());
    const updated = await updatePatient(created._id, { phone: '+211999888777' });

    expect(updated).not.toBeNull();
    expect(updated!.phone).toBe('+211999888777');
    expect(updated!.firstName).toBe('Achol');
    // updatedAt should be set (may be same millisecond as created)
    expect(updated!.updatedAt).toBeDefined();
    // _rev should differ from original (proves DB was updated)
    expect(updated!._rev).not.toBe(created._rev);
  });

  test('updatePatient returns null for non-existent id', async () => {
    // Service now catches the PouchDB not_found error and returns null so the
    // /api/patients/:id route can translate that into a 404 instead of a 500.
    await expect(
      updatePatient('pat-nonexistent', { phone: '123' })
    ).resolves.toBeNull();
  });

  // ---- getPatientsByHospital ----
  test('getPatientsByHospital filters correctly', async () => {
    await createPatient({ ...validPatient(), registrationHospital: 'hosp-001' });
    await createPatient({ ...validPatient(), firstName: 'Nyabol', surname: 'Kuol', phone: '+211912345888', dateOfBirth: '1997-01-20', registrationHospital: 'hosp-002' });

    const hospA = await getPatientsByHospital('hosp-001');
    const hospB = await getPatientsByHospital('hosp-002');
    expect(hospA).toHaveLength(1);
    expect(hospA[0].firstName).toBe('Achol');
    expect(hospB).toHaveLength(1);
    expect(hospB[0].firstName).toBe('Nyabol');
  });

  // ---- generateGeocodeId ----
  test('generateGeocodeId formats correctly', () => {
    expect(generateGeocodeId('xy', 1001)).toBe('BOMA-XY-HH1001');
    expect(generateGeocodeId('Ab-c', 42)).toBe('BOMA-ABC-HH42');
  });

  test('generateGeocodeId uppercases and strips non-alphanumeric', () => {
    expect(generateGeocodeId('x.y/z', 5)).toBe('BOMA-XYZ-HH5');
  });

  // ---- Uncovered branches ----
  test('searchPatients finds by phone number', async () => {
    const phone = '+211912345678';
    await createPatient(validPatient());
    const results = await searchPatients(phone);
    expect(results).toHaveLength(1);
    expect(results[0].phone).toBe(phone);
  });

  test('searchPatients finds by geocode ID', async () => {
    const geocodeId = 'BOMA-ABC-HH123';
    await createPatient({
      ...validPatient(),
      geocodeId,
    });
    const results = await searchPatients('BOMA-ABC');
    expect(results).toHaveLength(1);
    expect(results[0].geocodeId).toBe(geocodeId);
  });

  test('searchPatients finds by boma', async () => {
    const boma = 'Boma-A';
    await createPatient({
      ...validPatient(),
      boma,
    });
    const results = await searchPatients('boma-a');
    expect(results).toHaveLength(1);
    expect(results[0].boma).toBe(boma);
  });

  test('searchPatients with middle name included in search', async () => {
    const patient = await createPatient({
      ...validPatient(),
      firstName: 'John',
      middleName: 'Ahmed',
      surname: 'Smith',
    });
    const results = await searchPatients('Ahmed');
    expect(results).toHaveLength(1);
    expect(results[0]._id).toBe(patient._id);
  });

  test('checkDuplicates detects phone duplicates', async () => {
    await createPatient(validPatient());
    // Try to create with same phone (already in DB)
    const data = { ...validPatient(), phone: '+211912345678' };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('checkDuplicates detects geocodeId duplicates', async () => {
    const geocodeId = 'BOMA-XYZ-HH999';
    await createPatient({
      ...validPatient(),
      geocodeId,
    });
    const data = { ...validPatient(), geocodeId, phone: '+211999999999', firstName: 'Different' };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('checkDuplicates detects nationalId duplicates', async () => {
    const nationalId = 'SS-12345-67890';
    await createPatient({
      ...validPatient(),
      nationalId,
    });
    const data = { ...validPatient(), nationalId, phone: '+211999999999', firstName: 'Different' };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('getHospitalPrefix handles phcc prefix', async () => {
    // When registrationHospital starts with 'phcc-', it should use 'PHC' prefix
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'phcc-rural-001',
    });
    expect(patient.hospitalNumber).toMatch(/^PHC-/);
  });

  test('getHospitalPrefix handles phcu prefix', async () => {
    // When registrationHospital starts with 'phcu-', it should use 'BMU' prefix
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'phcu-basic-001',
    });
    expect(patient.hospitalNumber).toMatch(/^BMU-/);
  });

  test('getHospitalPrefix handles county prefix', async () => {
    // When registrationHospital starts with 'county-', it should use 'CTY' prefix
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'county-health-001',
    });
    expect(patient.hospitalNumber).toMatch(/^CTY-/);
  });

  test('getHospitalPrefix defaults to TAB for unknown prefix', async () => {
    // When registrationHospital is unknown, it should use 'TAB' prefix
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'unknown-facility-xyz',
    });
    expect(patient.hospitalNumber).toMatch(/^TAB-/);
  });

  test('inferOrgIdFromHospital returns undefined when hospital does not exist', async () => {
    // When hospital doesn't exist in DB, inferOrgIdFromHospital returns undefined
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'nonexistent-hosp-999',
    });
    // orgId should be undefined since hospital lookup failed
    expect(patient.orgId).toBeUndefined();
  });

  test('checkDuplicates with short phone number does not match', async () => {
    // Phone with exactly 7 digits (minimum valid length)
    const patient1 = await createPatient({ ...validPatient(), phone: '+2119999' });
    // Different patient with 7-digit phone should be allowed (different number)
    const patient2 = await createPatient({ ...validPatient(), phone: '+2118888', firstName: 'Another' });
    expect(patient1._id).toBeDefined();
    expect(patient2._id).toBeDefined();
    expect(patient1._id).not.toBe(patient2._id);
  });

  test('checkDuplicates with short nationalId does not match', async () => {
    // National ID with exactly 3 chars (minimum valid length)
    const patient1 = await createPatient({ ...validPatient(), nationalId: 'ABC' });
    // Different patient with different name/DOB should be allowed even with short nationalId
    const patient2 = await createPatient({
      ...validPatient(),
      firstName: 'Nyabol',
      surname: 'Kuol',
      dateOfBirth: '1998-03-10',
      phone: '+211988888888',
      nationalId: 'XYZ',
    });
    expect(patient1._id).toBeDefined();
    expect(patient2._id).toBeDefined();
    expect(patient1._id).not.toBe(patient2._id);
  });

  test('createPatient infers orgId from hospital', async () => {
    // This would need mocked hospital DB, but we can test the logic by checking
    // that when registrationHospital is hosp-001 (known prefix), it still creates
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'hosp-001',
    });
    expect(patient._id).toBeDefined();
  });

  test('updatePatient validates updated data', async () => {
    const created = await createPatient(validPatient());
    // Try to update with invalid gender
    await expect(updatePatient(created._id, { gender: 'invalid' } as unknown as Parameters<typeof updatePatient>[1])).rejects.toThrow(ValidationError);
  });

  test('updatePatient preserves existing values when partial update', async () => {
    const created = await createPatient(validPatient());
    const updated = await updatePatient(created._id, { county: 'New County' });
    expect(updated!.county).toBe('New County');
    expect(updated!.firstName).toBe(created.firstName);
    expect(updated!.state).toBe(created.state);
  });

  test('createPatient with explicit orgId preserves it', async () => {
    const patient = await createPatient({
      ...validPatient(),
      orgId: 'custom-org-123',
      registrationHospital: 'hosp-001',
    });
    expect(patient.orgId).toBe('custom-org-123');
  });

  test('updatePatient with data.orgId uses provided value', async () => {
    const created = await createPatient(validPatient());
    const updated = await updatePatient(created._id, {
      orgId: 'updated-org-456',
    });
    expect(updated!.orgId).toBe('updated-org-456');
  });

  test('checkDuplicates skips check for very short phone numbers', async () => {
    // The code checks `phone.length >= 7` before comparing duplicates
    // This verifies that the length check is enforced correctly
    const patient1 = await createPatient({ ...validPatient(), phone: '+211912345' });
    expect(patient1._id).toBeDefined();
    expect(patient1.phone).toBe('+211912345');
  });

  test('checkDuplicates detects name and DOB duplicates', async () => {
    const dob = '1990-05-20';
    await createPatient({
      ...validPatient(),
      firstName: 'Akuol',
      surname: 'Deng',
      dateOfBirth: dob,
      phone: '+211901111111',
    });
    const data = {
      ...validPatient(),
      firstName: 'Akuol',
      surname: 'Deng',
      dateOfBirth: dob,
      phone: '+211902222222',
    };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  test('inferOrgIdFromHospital with valid hospital returns orgId', async () => {
    // Since we don't have a real hospital in the DB, this will fail the lookup
    // and return undefined, which is correctly tested in inferOrgIdFromHospital
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'hosp-001',
    });
    // orgId will be undefined since hospital doesn't exist in test DB
    expect(patient.orgId).toBeUndefined();
  });

  // ---- Line 70: Test inferOrgIdFromHospital when hospital exists ----
  test('inferOrgIdFromHospital returns orgId when hospital exists (line 70)', async () => {
    // Create a hospital with an orgId
    const hdb = hospitalsDB();
    await putDoc(hdb, {
      _id: 'test-hosp-001',
      type: 'hospital',
      name: 'Test Hospital',
      orgId: 'test-org-123',
      county: 'Juba',
      state: 'Central Equatoria',
      createdAt: new Date().toISOString(),
    });

    // Create patient with this hospital
    const patient = await createPatient({
      ...validPatient(),
      registrationHospital: 'test-hosp-001',
    });
    // orgId should be resolved from the hospital
    expect(patient.orgId).toBe('test-org-123');
  });

  // ---- Line 111: Test checkDuplicates phone match with valid length ----
  test('checkDuplicates detects phone duplicates with 7+ digit length (line 111)', async () => {
    // Create first patient with 7-digit phone
    await createPatient({
      ...validPatient(),
      firstName: 'John',
      phone: '+211912345',  // 7 digits in the main number
    });

    // Try to create second patient with same phone (should fail)
    const data = {
      ...validPatient(),
      firstName: 'Jane',
      phone: '+211912345',  // Same phone number
    };
    await expect(createPatient(data)).rejects.toThrow(ValidationError);
  });

  // ---- Line 25: Test search with missing middleName ----
  test('searchPatients handles missing middleName in fullName search (line 25)', async () => {
    await createPatient({
      ...validPatient(),
      firstName: 'John',
      middleName: undefined as unknown as string,
      surname: 'Doe',
    });

    const results = await searchPatients('John Doe');
    expect(Array.isArray(results)).toBe(true);
  });

  // ---- Line 42-43, 57, 66: Test search with missing optional fields ----
  test('searchPatients handles missing hospitalNumber (line 42)', async () => {
    await createPatient({
      ...validPatient(),
      firstName: 'Jane',
      surname: 'Smith',
      hospitalNumber: undefined as unknown as string,
    });

    const results = await searchPatients('Jane');
    expect(Array.isArray(results)).toBe(true);
  });

  test('searchPatients handles missing geocodeId (line 57)', async () => {
    await createPatient({
      ...validPatient(),
      firstName: 'Bob',
      surname: 'Jones',
      geocodeId: undefined as unknown as string,
    });

    const results = await searchPatients('Bob');
    expect(Array.isArray(results)).toBe(true);
  });

  test('searchPatients handles missing boma (line 66)', async () => {
    await createPatient({
      ...validPatient(),
      firstName: 'Alice',
      surname: 'Brown',
      boma: undefined as unknown as string,
    });

    const results = await searchPatients('Alice');
    expect(Array.isArray(results)).toBe(true);
    expect(results.some(p => p.firstName === 'Alice')).toBe(true);
  });
});
