/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Integration test: Pharmacy Dispensing Workflow
 * Tests the complete flow from prescription creation through dispensing
 * to inventory stock decrement, verifying cross-module data consistency.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-pdisp-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { createPrescription, dispensePrescription, getPrescriptionsByPatient } from '@/lib/services/prescription-service';
import { createInventoryItem, getAllInventory, decrementStock, classifyStockStatus } from '@/lib/services/pharmacy-inventory-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

describe('Pharmacy Dispensing Integration', () => {
  test('full flow: prescribe → stock check → dispense → decrement → verify', async () => {
    // Step 1: Stock pharmacy with ACT medication
    const stock = await createInventoryItem({
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
      medicationName: 'Artemether-Lumefantrine 20/120mg',
      category: 'Antimalarials',
      stockLevel: 50,
      unit: 'tablets',
      reorderLevel: 20,
      batchNumber: 'BATCH-ACT-001',
      expiryDate: '2027-06-30',
    } as Parameters<typeof createInventoryItem>[0]);
    expect(classifyStockStatus(stock)).toBe('adequate');

    // Step 2: Doctor prescribes ACT for a malaria patient
    const rx = await createPrescription({
      patientId: 'patient-001',
      patientName: 'Deng Mabior',
      medication: 'Artemether-Lumefantrine 20/120mg',
      dose: '4 tablets',
      route: 'oral',
      frequency: 'BID (twice daily)',
      duration: '3 days',
      prescribedBy: 'Dr. Kuol',
      status: 'pending',
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
    } as Parameters<typeof createPrescription>[0]);
    expect(rx.prescription.status).toBe('pending');

    // Step 3: Pharmacist checks pending prescriptions for the patient
    const pending = await getPrescriptionsByPatient('patient-001');
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe('pending');

    // Step 4: Pharmacist dispenses the medication
    const dispensed = await dispensePrescription(rx.prescription._id, 'pharmacist-001');
    expect(dispensed).not.toBeNull();
    expect(dispensed!.status).toBe('dispensed');
    expect(dispensed!.dispensedAt).toBeDefined();

    // Step 5: Inventory is decremented (24 tablets for a full ACT course)
    await decrementStock('Artemether-Lumefantrine 20/120mg', 'hosp-001', 24);
    const inventory = await getAllInventory();
    const actStock = inventory.find(i => i.medicationName === 'Artemether-Lumefantrine 20/120mg')!;
    expect(actStock.stockLevel).toBe(26); // 50 - 24
    expect(actStock.dispensedToday).toBe(24);
    expect(actStock.lastDispensed).toBeDefined();
    expect(classifyStockStatus(actStock)).toBe('adequate');

    // Step 6: Verify prescription now shows as dispensed
    const afterDispense = await getPrescriptionsByPatient('patient-001');
    expect(afterDispense[0].status).toBe('dispensed');
  });

  test('dispensing with low stock triggers critical classification', async () => {
    // Stock with only 5 tablets left (below reorder level of 20)
    await createInventoryItem({
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
      medicationName: 'Amoxicillin 500mg',
      category: 'Antibiotics',
      stockLevel: 5,
      unit: 'capsules',
      reorderLevel: 20,
      batchNumber: 'BATCH-AMOX-001',
      expiryDate: '2027-12-31',
    } as Parameters<typeof createInventoryItem>[0]);

    // Dispense 3 capsules
    await decrementStock('Amoxicillin 500mg', 'hosp-001', 3);

    const inventory = await getAllInventory();
    const amox = inventory.find(i => i.medicationName === 'Amoxicillin 500mg')!;
    expect(amox.stockLevel).toBe(2); // 5 - 3
    // 2 < 20 * 0.3 = 6, so should be critical
    expect(classifyStockStatus(amox)).toBe('critical');
  });

  test('multiple prescriptions dispense from same stock pool', async () => {
    await createInventoryItem({
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
      medicationName: 'Paracetamol 500mg',
      category: 'Analgesics',
      stockLevel: 100,
      unit: 'tablets',
      reorderLevel: 30,
      batchNumber: 'BATCH-PARA-001',
      expiryDate: '2027-12-31',
    } as Parameters<typeof createInventoryItem>[0]);

    // Patient 1 prescription
    const rx1 = await createPrescription({
      patientId: 'patient-001', patientName: 'Deng',
      medication: 'Paracetamol 500mg', dose: '2 tablets',
      route: 'oral', frequency: 'TID', duration: '5 days',
      prescribedBy: 'Dr. Kuol', status: 'pending',
      hospitalId: 'hosp-001', hospitalName: 'TamamHealth Hospital',
    } as Parameters<typeof createPrescription>[0]);

    // Patient 2 prescription
    const rx2 = await createPrescription({
      patientId: 'patient-002', patientName: 'Achol',
      medication: 'Paracetamol 500mg', dose: '1 tablet',
      route: 'oral', frequency: 'QID', duration: '3 days',
      prescribedBy: 'Dr. Kuol', status: 'pending',
      hospitalId: 'hosp-001', hospitalName: 'TamamHealth Hospital',
    } as Parameters<typeof createPrescription>[0]);

    // Dispense both
    await dispensePrescription(rx1.prescription._id, 'pharmacist-001');
    await decrementStock('Paracetamol 500mg', 'hosp-001', 30); // 2x3x5=30
    await dispensePrescription(rx2.prescription._id, 'pharmacist-001');
    await decrementStock('Paracetamol 500mg', 'hosp-001', 12); // 1x4x3=12

    const inventory = await getAllInventory();
    const para = inventory.find(i => i.medicationName === 'Paracetamol 500mg')!;
    expect(para.stockLevel).toBe(58); // 100 - 30 - 12
    expect(para.dispensedToday).toBe(42);
  });
});
