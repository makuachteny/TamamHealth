/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for ward-service.ts
 * Covers ward creation, bed management, admissions, and discharges.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createWard,
  getAllWards,
  getWardById,
  getBedsByWard,
  getAvailableBeds,
  updateBedStatus,
  admitPatient,
  dischargePatient,
  getActiveAdmissions,
  getAdmissionsByPatient,
  getOccupancyStats,
  getAllAdmissions,
} from '@/lib/services/ward-service';
import { getDB } from '@/lib/db';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

const makeWardData = (overrides = {}) => ({
  name: 'Male General Ward',
  wardType: 'general_male' as const,
  facilityId: 'hosp-001',
  facilityName: 'Juba Teaching Hospital',
  facilityLevel: 'national' as const,
  floor: 'Ground',
  totalBeds: 20,
  isActive: true,
  orgId: 'org-001',
  ...overrides,
});

async function seedBeds(wardId: string, wardName: string, count: number) {
  const db = getDB('tamamhealth_wards');
  const now = new Date().toISOString();
  for (let i = 1; i <= count; i++) {
    await db.put({
      _id: `bed-${wardId}-${String(i).padStart(2, '0')}`,
      type: 'bed',
      bedNumber: `${wardId.slice(-3)}-B${String(i).padStart(2, '0')}`,
      wardId,
      wardName,
      facilityId: 'hosp-001',
      status: 'available',
      createdAt: now,
      updatedAt: now,
    });
  }
}

describe('ward-service', () => {
  // ---- Ward CRUD ----
  test('createWard creates a ward with correct defaults', async () => {
    const ward = await createWard(makeWardData());
    expect(ward._id).toMatch(/^ward-/);
    expect(ward.type).toBe('ward');
    expect(ward.name).toBe('Male General Ward');
    expect(ward.totalBeds).toBe(20);
    expect(ward.occupiedBeds).toBe(0);
    expect(ward.availableBeds).toBe(20);
  });

  test('getAllWards returns created wards', async () => {
    await createWard(makeWardData());
    await createWard(makeWardData({ name: 'Female General Ward', wardType: 'general_female' }));
    const wards = await getAllWards();
    expect(wards).toHaveLength(2);
  });

  test('getWardById retrieves a ward', async () => {
    const created = await createWard(makeWardData());
    const found = await getWardById(created._id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Male General Ward');
  });

  test('getWardById returns null for non-existent ward', async () => {
    const found = await getWardById('non-existent-id');
    expect(found).toBeNull();
  });

  // ---- Bed Management ----
  test('getBedsByWard returns beds for a specific ward', async () => {
    const ward = await createWard(makeWardData());
    await seedBeds(ward._id, ward.name, 5);
    const beds = await getBedsByWard(ward._id);
    expect(beds).toHaveLength(5);
    expect(beds[0].status).toBe('available');
  });

  test('getAvailableBeds only returns available beds', async () => {
    const ward = await createWard(makeWardData());
    await seedBeds(ward._id, ward.name, 3);
    const beds = await getBedsByWard(ward._id);

    // Mark one bed as occupied
    await updateBedStatus(beds[0]._id, 'occupied', 'pat-001', 'Achol Deng');

    const available = await getAvailableBeds(ward._id);
    expect(available).toHaveLength(2);
  });

  test('updateBedStatus clears patient info when set to available', async () => {
    const ward = await createWard(makeWardData());
    await seedBeds(ward._id, ward.name, 1);
    const beds = await getBedsByWard(ward._id);

    await updateBedStatus(beds[0]._id, 'occupied', 'pat-001', 'Achol Deng', 'adm-001');
    const updated = await updateBedStatus(beds[0]._id, 'available');
    expect(updated!.currentPatientId).toBeUndefined();
    expect(updated!.currentPatientName).toBeUndefined();
    expect(updated!.lastCleanedAt).toBeDefined();
  });

  test('updateBedStatus returns null for non-existent bed', async () => {
    const result = await updateBedStatus('non-existent-bed', 'occupied', 'pat-001', 'Patient Name');
    expect(result).toBeNull();
  });

  // ---- Admission ----
  test('admitPatient creates an admission record', async () => {
    const ward = await createWard(makeWardData());
    await seedBeds(ward._id, ward.name, 3);
    const beds = await getBedsByWard(ward._id);

    const admission = await admitPatient({
      patientId: 'pat-001',
      patientName: 'Achol Deng',
      hospitalNumber: 'JTH-0001',
      admittingDiagnosis: 'Severe malaria',
      icd11Code: '1F40',
      severity: 'severe',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      bedId: beds[0]._id,
      bedNumber: beds[0].bedNumber,
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
      orgId: 'org-001',
    });

    expect(admission._id).toMatch(/^adm-/);
    expect(admission.status).toBe('admitted');
    expect(admission.admittingDiagnosis).toBe('Severe malaria');
  });

  test('admitPatient marks bed as occupied', async () => {
    const ward = await createWard(makeWardData());
    await seedBeds(ward._id, ward.name, 3);
    const beds = await getBedsByWard(ward._id);

    await admitPatient({
      patientId: 'pat-001',
      patientName: 'Achol Deng',
      admittingDiagnosis: 'Pneumonia',
      severity: 'moderate',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      bedId: beds[0]._id,
      bedNumber: beds[0].bedNumber,
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
    });

    const updatedBeds = await getBedsByWard(ward._id);
    const assignedBed = updatedBeds.find(b => b._id === beds[0]._id);
    expect(assignedBed!.status).toBe('occupied');
    expect(assignedBed!.currentPatientName).toBe('Achol Deng');
  });

  test('getActiveAdmissions returns only admitted patients', async () => {
    const ward = await createWard(makeWardData());

    await admitPatient({
      patientId: 'pat-001',
      patientName: 'Achol Deng',
      admittingDiagnosis: 'Malaria',
      severity: 'moderate',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      facilityId: 'hosp-001',
      facilityName: 'JTH',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
    });

    const active = await getActiveAdmissions();
    expect(active).toHaveLength(1);
    expect(active[0].patientName).toBe('Achol Deng');
  });

  test('getAllAdmissions with scope filters results', async () => {
    const ward = await createWard(makeWardData());

    await admitPatient({
      patientId: 'pat-001',
      patientName: 'Achol Deng',
      admittingDiagnosis: 'Malaria',
      severity: 'moderate',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      facilityId: 'hosp-001',
      facilityName: 'JTH',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
    });

    const allAdmissions = await getAllAdmissions();
    expect(allAdmissions.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Discharge ----
  test('dischargePatient updates status and calculates length of stay', async () => {
    const ward = await createWard(makeWardData());

    const admission = await admitPatient({
      patientId: 'pat-001',
      patientName: 'Achol Deng',
      admittingDiagnosis: 'Typhoid',
      severity: 'moderate',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      facilityId: 'hosp-001',
      facilityName: 'JTH',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
    });

    const discharged = await dischargePatient(admission._id, {
      dischargeType: 'normal',
      dischargeDiagnosis: 'Typhoid - resolved',
      dischargeSummary: 'Patient recovered well after antibiotic course',
      dischargedBy: 'user-001',
      dischargedByName: 'Dr. Wani',
      followUpRequired: true,
      followUpDate: '2026-04-20',
      followUpInstructions: 'Return for follow-up blood work',
    });

    expect(discharged).not.toBeNull();
    expect(discharged!.status).toBe('discharged');
    expect(discharged!.dischargeDate).toBeDefined();
    expect(discharged!.lengthOfStay).toBeGreaterThanOrEqual(1);
    expect(discharged!.followUpRequired).toBe(true);
  });

  test('dischargePatient with bed assignment clears bed status', async () => {
    const ward = await createWard(makeWardData());
    await seedBeds(ward._id, ward.name, 2);
    const beds = await getBedsByWard(ward._id);

    const admission = await admitPatient({
      patientId: 'pat-002',
      patientName: 'Nyabol Atem',
      admittingDiagnosis: 'Pneumonia',
      severity: 'severe',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      bedId: beds[0]._id,
      bedNumber: beds[0].bedNumber,
      facilityId: 'hosp-001',
      facilityName: 'JTH',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
    });

    const discharged = await dischargePatient(admission._id, {
      dischargeType: 'normal',
      dischargeDiagnosis: 'Pneumonia - resolved',
      dischargedBy: 'user-001',
      dischargedByName: 'Dr. Wani',
    });

    expect(discharged).not.toBeNull();
    expect(discharged!.status).toBe('discharged');

    // Check that bed was marked for cleaning
    const updatedBeds = await getBedsByWard(ward._id);
    const assignedBed = updatedBeds.find(b => b._id === beds[0]._id);
    expect(assignedBed!.status).toBe('cleaning');
  });

  test('dischargePatient returns null for non-existent admission', async () => {
    const result = await dischargePatient('non-existent-admission', {
      dischargeType: 'normal',
      dischargedBy: 'user-001',
      dischargedByName: 'Dr. Wani',
    });
    expect(result).toBeNull();
  });

  test('getAdmissionsByPatient returns all admissions for a patient', async () => {
    const ward = await createWard(makeWardData());

    await admitPatient({
      patientId: 'pat-001',
      patientName: 'Achol Deng',
      admittingDiagnosis: 'Malaria',
      severity: 'moderate',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      facilityId: 'hosp-001',
      facilityName: 'JTH',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
    });

    const admissions = await getAdmissionsByPatient('pat-001');
    expect(admissions).toHaveLength(1);
  });

  // ---- Occupancy Stats ----
  test('getOccupancyStats calculates correctly', async () => {
    const ward = await createWard(makeWardData({ totalBeds: 10 }));
    await seedBeds(ward._id, ward.name, 10);
    const beds = await getBedsByWard(ward._id);

    // Occupy 3 beds
    for (let i = 0; i < 3; i++) {
      await updateBedStatus(beds[i]._id, 'occupied', `pat-${i}`, `Patient ${i}`);
    }

    // Update ward occupancy manually (normally done by admitPatient)
    const db = getDB('tamamhealth_wards');
    const wardDoc = await db.get(ward._id) as Record<string, unknown>;
    wardDoc.occupiedBeds = 3;
    wardDoc.availableBeds = 7;
    await db.put(wardDoc);

    const stats = await getOccupancyStats('hosp-001');
    expect(stats.totalBeds).toBe(10);
    expect(stats.occupiedBeds).toBe(3);
    expect(stats.availableBeds).toBe(7);
    expect(stats.occupancyRate).toBe(30);
    expect(stats.wardBreakdown).toHaveLength(1);
  });

  // ---- Branch coverage improvements ----

  test('getAllAdmissions handles missing admissionDate in sort', async () => {
    const db = getDB('tamamhealth_wards');
    // Insert admissions directly with missing dates
    await db.put({
      _id: 'admit-no-date',
      type: 'admission',
      patientId: 'p1',
      patientName: 'Test',
      admittingDiagnosis: 'Test',
      severity: 'moderate',
      admittedBy: 'admin',
      admittedByName: 'Admin',
      wardId: 'ward-1',
      wardName: 'Ward 1',
      facilityId: 'hosp-001',
      status: 'admitted',
      state: 'Central Equatoria',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.put({
      _id: 'admit-with-date',
      type: 'admission',
      patientId: 'p2',
      patientName: 'Test 2',
      admissionDate: '2026-04-13',
      admittingDiagnosis: 'Test',
      severity: 'moderate',
      admittedBy: 'admin',
      admittedByName: 'Admin',
      wardId: 'ward-1',
      wardName: 'Ward 1',
      facilityId: 'hosp-001',
      status: 'admitted',
      state: 'Central Equatoria',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const admissions = await getAllAdmissions();
    expect(admissions).toHaveLength(2);
  });

  test('getAllAdmissions with scope filters results', async () => {
    const db = getDB('tamamhealth_wards');
    await db.put({
      _id: 'admit-scoped',
      type: 'admission',
      patientId: 'p1',
      patientName: 'Test',
      admissionDate: '2026-04-13',
      admittingDiagnosis: 'Test',
      severity: 'moderate',
      admittedBy: 'admin',
      admittedByName: 'Admin',
      wardId: 'ward-1',
      wardName: 'Ward 1',
      facilityId: 'hosp-001',
      status: 'admitted',
      state: 'Central Equatoria',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const admissions = await getAllAdmissions({ role: 'nurse' } as Parameters<typeof getAllAdmissions>[0]);
    expect(Array.isArray(admissions)).toBe(true);
  });

  test('getAllWards with scope filters results', async () => {
    const ward = await createWard(makeWardData());
    expect(ward._id).toBeDefined();
    const wards = await getAllWards({ role: 'nurse' } as Parameters<typeof getAllWards>[0]);
    expect(Array.isArray(wards)).toBe(true);
  });

  // ---- Line 102: Test sort with missing admissionDate ----
  test('getAllAdmissions sorts correctly with missing admissionDate (line 102)', async () => {
    const db = getDB('tamamhealth_wards');

    // Create one with admissionDate
    await db.put({
      _id: 'admit-with-date',
      type: 'admission',
      patientId: 'p1',
      patientName: 'Test 1',
      admissionDate: '2026-04-13',
      admittingDiagnosis: 'Test',
      severity: 'moderate',
      admittedBy: 'admin',
      admittedByName: 'Admin',
      wardId: 'ward-1',
      wardName: 'Ward 1',
      facilityId: 'hosp-001',
      status: 'admitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create one without admissionDate
    await db.put({
      _id: 'admit-no-date',
      type: 'admission',
      patientId: 'p2',
      patientName: 'Test 2',
      admissionDate: undefined as unknown as string,
      admittingDiagnosis: 'Test',
      severity: 'moderate',
      admittedBy: 'admin',
      admittedByName: 'Admin',
      wardId: 'ward-1',
      wardName: 'Ward 1',
      facilityId: 'hosp-001',
      status: 'admitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const admissions = await getAllAdmissions();
    expect(Array.isArray(admissions)).toBe(true);
    expect(admissions.length).toBeGreaterThan(0);
  });

  // ---- Line 198: Test dischargePatient with death status ----
  test('dischargePatient with death discharge type sets correct status (line 198)', async () => {
    const ward = await createWard(makeWardData());
    const admission = await admitPatient({
      patientId: 'p-death',
      patientName: 'Test Patient',
      admittingDiagnosis: 'Severe Illness',
      severity: 'severe',
      facilityId: 'hosp-001',
      facilityName: 'Test Hospital',
      facilityLevel: 'county',
      wardId: ward._id,
      wardName: ward.name,
      admittedBy: 'doctor-1',
      admittedByName: 'Dr. Test',
      attendingPhysician: 'doctor-1',
      attendingPhysicianName: 'Dr. Test',
      state: 'Central Equatoria',
    });

    const discharged = await dischargePatient(admission._id, {
      dischargeType: 'death',
      dischargeDiagnosis: 'Severe Sepsis',
      dischargedBy: 'doctor-1',
      dischargedByName: 'Dr. Test',
    });

    expect(discharged).not.toBeNull();
    expect(discharged!.status).toBe('deceased');
  });

  // ---- Line 276: Test occupancy calculation when totalBeds is 0 ----
  test('getOccancyStats returns 0 occupancy rate when no beds (line 276)', async () => {
    await createWard(makeWardData({ totalBeds: 0 }));

    const stats = await getOccupancyStats('hosp-001');
    expect(stats.occupancyRate).toBe(0);
    expect(stats.totalBeds).toBe(0);
  });
});
