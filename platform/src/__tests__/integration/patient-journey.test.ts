/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Integration test: Full patient journey from registration to discharge.
 *
 * Simulates the real hospital workflow:
 * 1. Patient registration at front desk
 * 2. Triage assessment (ETAT)
 * 3. Doctor consultation with diagnosis
 * 4. Lab order → result entry
 * 5. Prescription → dispensing
 * 6. Admission to ward → bed assignment
 * 7. Discharge with follow-up
 * 8. Billing and payment
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs, putDoc } from '../helpers/test-db';
import { createPatient, getPatientById } from '@/lib/services/patient-service';
import { createLabResult, updateLabResult, getLabResultsByPatient } from '@/lib/services/lab-service';
import { createPrescription, dispensePrescription, getPrescriptionsByPatient } from '@/lib/services/prescription-service';
import { createBill, recordPayment, getBillsByPatient } from '@/lib/services/billing-service';
import { createWard, admitPatient, dischargePatient, getActiveAdmissions } from '@/lib/services/ward-service';
import { getDB, hospitalsDB } from '@/lib/db';

beforeEach(async () => {
  // Seed the in-memory hospitalsDB so patient-service.getHospitalPrefix can
  // derive the JTH-* hospital-number prefix from the facility doc.
  await putDoc(hospitalsDB(), { _id: 'hosp-001', type: 'hospital', name: 'Juba Teaching Hospital', code: 'JTH' } as unknown as { _id: string });
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('Integration: patient journey', () => {
  test('Full patient journey from registration to discharge', async () => {
    // === STEP 1: Patient Registration ===
    const patient = await createPatient({
      firstName: 'Deng',
      middleName: 'Mabior',
      surname: 'Akol',
      gender: 'Male' as const,
      dateOfBirth: '1988-03-15',
      phone: '+211912345001',
      state: 'Central Equatoria',
      county: 'Juba',
      tribe: 'Dinka',
      primaryLanguage: 'Dinka',
      bloodType: 'A+',
      allergies: ['Penicillin'],
      chronicConditions: [],
      nokName: 'Akol Mabior',
      nokRelationship: 'Father',
      nokPhone: '+211912345002',
      hospitalNumber: '',
      registrationHospital: 'hosp-001',
      registrationDate: '2026-04-10',
      lastVisitDate: '2026-04-10',
      lastVisitHospital: 'hosp-001',
      isActive: true,
    });

    expect(patient._id).toBeDefined();
    expect(patient.hospitalNumber).toMatch(/^JTH-/);
    expect(patient.allergies).toContain('Penicillin');

    // === STEP 2: Triage (ETAT Assessment) ===
    const db = getDB('tamamhealth_triage');
    const now = new Date().toISOString();
    const triageDoc = {
      _id: `triage-${++uuidCounter}`,
      type: 'triage',
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      airway: 'clear',
      breathing: 'distressed',
      circulation: 'normal',
      consciousness: 'alert',
      priority: 'YELLOW', // Breathing distressed = priority sign
      temperature: '39.2',
      pulse: '110',
      chiefComplaint: 'High fever for 3 days, difficulty breathing',
      triagedBy: 'user-nurse',
      triagedByName: 'Nurse Stella',
      triagedAt: now,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await db.put(triageDoc);

    const savedTriage = await db.get(triageDoc._id) as typeof triageDoc;
    expect(savedTriage.priority).toBe('YELLOW');
    expect(savedTriage.chiefComplaint).toContain('difficulty breathing');

    // === STEP 3: Lab Order ===
    const labOrder = await createLabResult({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      hospitalNumber: patient.hospitalNumber,
      testName: 'Malaria RDT',
      specimen: 'Blood',
      status: 'pending',
      result: '',
      unit: '',
      referenceRange: 'Negative',
      abnormal: false,
      critical: false,
      orderedBy: 'Dr. Wani',
      orderedAt: now,
      completedAt: '',
      hospitalId: 'hosp-001',
      clinicalNotes: 'High fever, suspect malaria',
    });

    expect(labOrder.testName).toBe('Malaria RDT');
    expect(labOrder.status).toBe('pending');

    // === STEP 4: Lab Result Entry ===
    const labResult = await updateLabResult(labOrder._id, {
      status: 'completed',
      result: 'Positive (P. falciparum)',
      abnormal: true,
      critical: true,
      completedAt: now,
    });

    expect(labResult!.status).toBe('completed');
    expect(labResult!.result).toBe('Positive (P. falciparum)');
    expect(labResult!.critical).toBe(true);

    // Verify results are linked to patient
    const patientLabs = await getLabResultsByPatient(patient._id);
    expect(patientLabs).toHaveLength(1);

    // === STEP 5: Prescription ===
    // Note: Penicillin allergy — doctor prescribes Artemether-Lumefantrine instead
    const rxResult = await createPrescription({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      medication: 'Artemether-Lumefantrine (ACT)',
      dose: '80/480mg',
      route: 'oral',
      frequency: 'BD x 3 days',
      duration: '3 days',
      prescribedBy: 'Dr. Wani',
      status: 'pending',
    });
    const prescription = rxResult.prescription;

    expect(prescription.medication).toBe('Artemether-Lumefantrine (ACT)');

    // === STEP 6: Dispensing ===
    const dispensed = await dispensePrescription(prescription._id, 'Pharmacist Rose');
    expect(dispensed!.status).toBe('dispensed');
    expect(dispensed!.dispensedAt).toBeDefined();

    // === STEP 7: Ward Admission ===
    const ward = await createWard({
      name: 'Male Medical Ward',
      wardType: 'general_male',
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      facilityLevel: 'national',
      totalBeds: 20,
      isActive: true,
    });

    const admission = await admitPatient({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      hospitalNumber: patient.hospitalNumber,
      admittingDiagnosis: 'Severe malaria (P. falciparum)',
      icd11Code: '1F40',
      severity: 'severe',
      admittedBy: 'user-001',
      admittedByName: 'Dr. Wani',
      wardId: ward._id,
      wardName: ward.name,
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      facilityLevel: 'national',
      attendingPhysician: 'user-001',
      attendingPhysicianName: 'Dr. Wani',
      state: 'Central Equatoria',
    });

    expect(admission.status).toBe('admitted');
    const active = await getActiveAdmissions();
    expect(active).toHaveLength(1);

    // === STEP 8: Discharge ===
    const discharged = await dischargePatient(admission._id, {
      dischargeType: 'normal',
      dischargeDiagnosis: 'Severe malaria — resolved',
      dischargeIcd11: '1F40',
      dischargeSummary: 'Patient completed IV artesunate course, transitioned to oral ACT. Fever resolved. Cleared for discharge.',
      dischargedBy: 'user-001',
      dischargedByName: 'Dr. Wani',
      followUpRequired: true,
      followUpDate: '2026-04-20',
      followUpInstructions: 'Return for repeat blood smear in 7 days',
    });

    expect(discharged!.status).toBe('discharged');
    expect(discharged!.followUpRequired).toBe(true);
    expect(discharged!.lengthOfStay).toBeGreaterThanOrEqual(1);

    // === STEP 9: Billing ===
    const bill = await createBill({
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.surname}`,
      hospitalNumber: patient.hospitalNumber,
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      facilityLevel: 'national',
      encounterDate: '2026-04-10',
      items: [
        { id: 'i1', category: 'consultation', description: 'Emergency consultation', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
        { id: 'i2', category: 'laboratory', description: 'Malaria RDT', quantity: 1, unitPrice: 2000, totalPrice: 2000 },
        { id: 'i3', category: 'pharmacy', description: 'ACT (3-day course)', quantity: 1, unitPrice: 3000, totalPrice: 3000 },
        { id: 'i4', category: 'bed_charge', description: 'Ward bed (1 night)', quantity: 1, unitPrice: 10000, totalPrice: 10000 },
      ],
      generatedBy: 'user-desk',
      generatedByName: 'Desk Amira',
      state: 'Central Equatoria',
    });

    expect(bill.totalAmount).toBe(20000);
    expect(bill.status).toBe('pending');

    // === STEP 10: Payment ===
    const paid = await recordPayment(
      bill._id, 20000, 'mobile_money', 'user-desk', 'Desk Amira', 'MTN-TX-98765'
    );
    expect(paid!.status).toBe('paid');
    expect(paid!.balanceDue).toBe(0);

    // === Verify Complete Journey Data ===
    const finalPatient = await getPatientById(patient._id);
    expect(finalPatient).not.toBeNull();

    const allLabs = await getLabResultsByPatient(patient._id);
    expect(allLabs).toHaveLength(1);
    expect(allLabs[0].result).toContain('Positive');

    const allRx = await getPrescriptionsByPatient(patient._id);
    expect(allRx).toHaveLength(1);
    expect(allRx[0].status).toBe('dispensed');

    const allBills = await getBillsByPatient(patient._id);
    expect(allBills).toHaveLength(1);
    expect(allBills[0].status).toBe('paid');
  });
});
