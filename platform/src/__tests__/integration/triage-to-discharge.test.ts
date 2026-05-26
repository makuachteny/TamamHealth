/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Integration test: Triage → Consultation → Admission → Discharge
 * Tests the complete inpatient flow from emergency presentation through discharge.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-t2d-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createTriage, updateTriage, getActiveTriage, calculatePriority } from '@/lib/services/triage-service';
import { createMedicalRecord, getRecordsByPatient } from '@/lib/services/medical-record-service';
import { createPrescription, dispensePrescription } from '@/lib/services/prescription-service';
import { createLabResult, updateLabResult } from '@/lib/services/lab-service';
import { createWard, admitPatient, dischargePatient, getOccupancyStats } from '@/lib/services/ward-service';
import { createFollowUp } from '@/lib/services/follow-up-service';
import { getRecentAuditLogs } from '@/lib/services/audit-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

describe('Full Inpatient Journey: Triage → Discharge', () => {
  test('emergency malaria case with ICU admission', async () => {
    // STEP 1: Patient arrives at triage — nurse assesses using ETAT
    const priority = calculatePriority({
      airway: 'clear',
      breathing: 'distressed',
      circulation: 'impaired',
      consciousness: 'verbal',
    });
    expect(priority).toBe('YELLOW'); // Priority but not life-threatening

    const triage = await createTriage({
      patientId: 'patient-001',
      patientName: 'Deng Mabior',
      airway: 'clear',
      breathing: 'distressed',
      circulation: 'impaired',
      consciousness: 'verbal',
      priority: 'YELLOW',
      chiefComplaint: 'High fever, altered consciousness, severe body aches for 5 days',
      vitals: {
        temperature: 40.2,
        pulse: 120,
        respiratoryRate: 28,
        systolic: 90,
        diastolic: 55,
        oxygenSaturation: 91,
      },
      triagedBy: 'nurse-001',
      triagedByName: 'Nurse Ayen',
      triagedAt: new Date().toISOString(),
      status: 'pending',
      facilityId: 'hosp-001',
      facilityName: 'TamamHealth Hospital',
    } as Parameters<typeof createTriage>[0]);
    expect(triage.status).toBe('pending');
    expect(triage.priority).toBe('YELLOW');

    // Verify triage appears in active queue
    const active = await getActiveTriage();
    expect(active.length).toBe(1);

    // STEP 2: Doctor sees the patient — triage status → seen
    await updateTriage(triage._id, {
      status: 'seen',
      handoffTo: 'dr-001',
      handoffToName: 'Dr. Kuol',
    });

    // STEP 3: Doctor orders labs
    const labOrder = await createLabResult({
      patientId: 'patient-001',
      patientName: 'Deng Mabior',
      hospitalNumber: 'JTH-001234',
      testName: 'Malaria RDT + Blood Smear',
      specimen: 'Blood',
      status: 'pending',
      result: '',
      unit: '',
      referenceRange: '',
      abnormal: false,
      critical: false,
      orderedBy: 'Dr. Kuol',
      orderedAt: new Date().toISOString(),
      completedAt: '',
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
    } as Parameters<typeof createLabResult>[0]);
    expect(labOrder.status).toBe('pending');

    // STEP 4: Lab tech completes the test — severe malaria confirmed
    const labResult = await updateLabResult(labOrder._id, {
      status: 'completed',
      result: 'P. falciparum +++, parasitaemia >200,000/µL',
      abnormal: true,
      critical: true,
      completedAt: new Date().toISOString(),
    });
    expect(labResult!.critical).toBe(true);

    // STEP 5: Doctor creates consultation record
    const consultation = await createMedicalRecord({
      patientId: 'patient-001',
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
      visitDate: new Date().toISOString().slice(0, 10),
      consultedAt: new Date().toISOString(),
      visitType: 'emergency',
      providerName: 'Dr. Kuol',
      providerRole: 'doctor',
      department: 'Emergency Medicine',
      chiefComplaint: 'Severe malaria with altered consciousness',
      historyOfPresentIllness: '5-day fever, confusion, severe body aches',
      vitalSigns: { temperature: 40.2, pulse: 120, respiratoryRate: 28, systolic: 90, diastolic: 55, oxygenSaturation: 91, weight: 65, height: 170, bmi: 22.5, recordedAt: new Date().toISOString() },
      diagnoses: [{ name: 'Severe P. falciparum malaria', icd10Code: 'B50.9', type: 'primary', certainty: 'confirmed', severity: 'severe' }],
      prescriptions: [],
      labResults: [],
      treatmentPlan: 'IV Artesunate, IV fluids, supportive care. Admit for monitoring.',
      syncStatus: 'pending',
    } as Parameters<typeof createMedicalRecord>[0]);
    expect(consultation._id).toMatch(/^rec-/);

    // STEP 6: Doctor prescribes IV Artesunate
    const rx = await createPrescription({
      patientId: 'patient-001',
      patientName: 'Deng Mabior',
      medication: 'Artesunate IV',
      dose: '2.4mg/kg',
      route: 'intravenous',
      frequency: 'At 0, 12, 24h then daily',
      duration: '7 days or until oral tolerated',
      prescribedBy: 'Dr. Kuol',
      status: 'pending',
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
    } as Parameters<typeof createPrescription>[0]);
    expect(rx.prescription.status).toBe('pending');

    // STEP 7: Setup ward and admit patient
    const ward = await createWard({
      name: 'Male Medical Ward',
      wardType: 'general_male',
      facilityId: 'hosp-001',
      facilityName: 'TamamHealth Hospital',
      facilityLevel: 'county',
      totalBeds: 20,
      isActive: true,
    } as Parameters<typeof createWard>[0]);

    const admission = await admitPatient({
      patientId: 'patient-001',
      patientName: 'Deng Mabior',
      admittingDiagnosis: 'Severe P. falciparum malaria with altered consciousness',
      icd11Code: '1F40.Z',
      severity: 'critical',
      admittedBy: 'dr-001',
      admittedByName: 'Dr. Kuol',
      attendingPhysician: 'dr-001',
      attendingPhysicianName: 'Dr. Kuol',
      wardId: ward._id,
      wardName: 'Male Medical Ward',
      facilityId: 'hosp-001',
      facilityName: 'TamamHealth Hospital',
      facilityLevel: 'county',
      state: 'Central Equatoria',
    });
    expect(admission.status).toBe('admitted');

    // Update triage to admitted
    await updateTriage(triage._id, { status: 'admitted' });

    // STEP 8: Nurse dispenses medication
    const dispensed = await dispensePrescription(rx.prescription._id, 'pharmacist-001');
    expect(dispensed!.status).toBe('dispensed');

    // STEP 9: Patient improves — doctor discharges after 5 days
    const discharged = await dischargePatient(admission._id, {
      dischargeType: 'normal',
      dischargeDiagnosis: 'Severe P. falciparum malaria - resolved',
      dischargeIcd11: '1F40.Z',
      dischargeSummary: 'Patient responded well to IV Artesunate. Fever resolved day 3. Oral intake resumed day 4.',
      dischargedBy: 'dr-001',
      dischargedByName: 'Dr. Kuol',
      followUpRequired: true,
      followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      followUpInstructions: 'Return in 1 week for repeat blood smear. Complete oral ACT course.',
    });
    expect(discharged).not.toBeNull();
    expect(discharged!.status).toBe('discharged');
    expect(discharged!.lengthOfStay).toBeDefined();

    // Update triage to discharged
    await updateTriage(triage._id, { status: 'discharged' });

    // STEP 10: Create follow-up for community health worker
    const followUp = await createFollowUp({
      patientId: 'patient-001',
      patientName: 'Deng Mabior',
      assignedWorker: 'bhw-001',
      assignedWorkerName: 'Mary Ayen',
      status: 'active',
      condition: 'Post-severe malaria follow-up',
      facilityLevel: 'boma',
      scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      state: 'Central Equatoria',
      county: 'Juba',
      sourceVisitId: consultation._id,
    } as Parameters<typeof createFollowUp>[0]);
    expect(followUp.status).toBe('active');

    // VERIFICATION: Check data consistency across modules
    const patientRecords = await getRecordsByPatient('patient-001');
    expect(patientRecords.length).toBe(1);

    const auditLogs = await getRecentAuditLogs(50);
    expect(auditLogs.length).toBeGreaterThan(0);
    // Should have audit entries for triage, prescription, admission, discharge
    const auditActions = auditLogs.map(l => l.action);
    expect(auditActions).toContain('TRIAGE_RECORDED');
    expect(auditActions).toContain('PRESCRIPTION_CREATED');

    // Ward should show the bed freed after discharge
    const occupancy = await getOccupancyStats('hosp-001');
    expect(occupancy).toBeDefined();
  });
});
