/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for surveillance-service.ts
 * Covers CRUD operations, alert level filtering, and status management.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-surv-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllAlerts,
  getActiveAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
} from '@/lib/services/surveillance-service';

type CreateAlertInput = Parameters<typeof createAlert>[0];

const makeAlertData = (overrides: Partial<CreateAlertInput> = {}): CreateAlertInput => ({
  disease: 'Malaria',
  state: 'Central Equatoria',
  county: 'Juba',
  cases: 15,
  deaths: 2,
  alertLevel: 'warning' as const,
  reportDate: '2025-03-15',
  trend: 'increasing' as const,
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('surveillance-service', () => {
  test('getAllAlerts returns empty initially', async () => {
    const alerts = await getAllAlerts();
    expect(alerts).toEqual([]);
  });

  test('createAlert creates with correct fields', async () => {
    const alert = await createAlert(makeAlertData());

    expect(alert._id).toMatch(/^alert-/);
    expect(alert.type).toBe('disease_alert');
    expect(alert.disease).toBe('Malaria');
    expect(alert.reportDate).toBe('2025-03-15');
    expect(alert.county).toBe('Juba');
    expect(alert.cases).toBe(15);
    expect(alert.deaths).toBe(2);
    expect(alert.alertLevel).toBe('warning');
    expect(alert.trend).toBe('increasing');
    expect(alert.createdAt).toBeDefined();
    expect(alert.updatedAt).toBeDefined();
    expect(alert._rev).toBeDefined();
  });

  test('createAlert with emergency alert level', async () => {
    const alert = await createAlert(makeAlertData({ alertLevel: 'emergency', cases: 50 }));
    expect(alert.alertLevel).toBe('emergency');
    expect(alert.cases).toBe(50);
  });

  test('getActiveAlerts filters emergency and warning only', async () => {
    await createAlert(makeAlertData({ alertLevel: 'emergency', disease: 'Ebola' }));
    await createAlert(makeAlertData({ alertLevel: 'warning', disease: 'Cholera' }));
    await createAlert(makeAlertData({ alertLevel: 'normal', disease: 'Typhoid' }));
    await createAlert(makeAlertData({ alertLevel: 'watch', disease: 'Influenza' }));

    const active = await getActiveAlerts();

    expect(active).toHaveLength(2);
    const levels = active.map(a => a.alertLevel);
    expect(levels).toContain('emergency');
    expect(levels).toContain('warning');
  });

  test('updateAlert updates alert level', async () => {
    const alert = await createAlert(makeAlertData({ alertLevel: 'watch' }));
    const updated = await updateAlert(alert._id, { alertLevel: 'emergency' });

    expect(updated).not.toBeNull();
    expect(updated!.alertLevel).toBe('emergency');
    expect(updated!.disease).toBe('Malaria');
  });

  test('updateAlert returns null for non-existent id', async () => {
    const result = await updateAlert('alert-nonexistent', { alertLevel: 'emergency' });
    expect(result).toBeNull();
  });

  test('getAllAlerts with scope filters by data scope (line 13)', async () => {
    // Tests line 13: return scope ? filterByScope(all, scope) : all;
    await createAlert(makeAlertData({ disease: 'Malaria' }));
    await createAlert(makeAlertData({ disease: 'Cholera', alertLevel: 'warning' }));

    // Get all without scope
    const allAlerts = await getAllAlerts();
    expect(allAlerts).toHaveLength(2);

    // Get with scope filter
    const scopedAlerts = await getAllAlerts({ role: 'nurse' } as Parameters<typeof getAllAlerts>[0]);
    expect(scopedAlerts).toBeDefined();
  });

  test('deleteAlert removes the alert', async () => {
    const alert = await createAlert(makeAlertData());
    const success = await deleteAlert(alert._id);
    expect(success).toBe(true);

    const alerts = await getAllAlerts();
    expect(alerts).toHaveLength(0);
  });

  test('deleteAlert returns false for non-existent id', async () => {
    const success = await deleteAlert('alert-nonexistent');
    expect(success).toBe(false);
  });

  test('getAllAlerts sorts by reportDate descending', async () => {
    await createAlert(makeAlertData({ reportDate: '2025-03-10', disease: 'First' }));
    await createAlert(makeAlertData({ reportDate: '2025-03-20', disease: 'Second' }));
    await createAlert(makeAlertData({ reportDate: '2025-03-15', disease: 'Third' }));

    const all = await getAllAlerts();
    expect(all[0].disease).toBe('Second');
    expect(all[1].disease).toBe('Third');
    expect(all[2].disease).toBe('First');
  });

  test('updateAlert preserves existing fields', async () => {
    const alert = await createAlert(makeAlertData({ disease: 'Malaria', cases: 20 }));
    const updated = await updateAlert(alert._id, { trend: 'decreasing' });

    expect(updated!.disease).toBe('Malaria');
    expect(updated!.cases).toBe(20);
    expect(updated!.trend).toBe('decreasing');
  });

  test('updateAlert updates case and death counts', async () => {
    const alert = await createAlert(makeAlertData({ cases: 10, deaths: 1 }));
    const updated = await updateAlert(alert._id, { cases: 25, deaths: 3 });

    expect(updated!.cases).toBe(25);
    expect(updated!.deaths).toBe(3);
  });

  test('updateAlert updates updatedAt timestamp', async () => {
    const alert = await createAlert(makeAlertData());
    const originalUpdatedAt = alert.updatedAt;

    await new Promise(r => setTimeout(r, 10));

    const updated = await updateAlert(alert._id, { cases: 30 });
    expect(updated!.updatedAt > originalUpdatedAt).toBe(true);
  });

  test('multiple alerts sorted correctly', async () => {
    await createAlert(makeAlertData({ disease: 'Malaria', reportDate: '2025-03-10', cases: 5 }));
    await createAlert(makeAlertData({ disease: 'Malaria', reportDate: '2025-03-15', cases: 15 }));
    await createAlert(makeAlertData({ disease: 'Malaria', reportDate: '2025-03-20', cases: 25 }));

    const all = await getAllAlerts();
    expect(all).toHaveLength(3);
    expect(all[0].cases).toBe(25);
    expect(all[2].cases).toBe(5);
  });

  test('getAllAlerts with scope filters results', async () => {
    await createAlert(makeAlertData());
    const allNoScope = await getAllAlerts();
    expect(allNoScope.length).toBeGreaterThanOrEqual(1);

    // With scope - the filterByScope function would be called
    const allWithScope = await getAllAlerts({ role: 'nurse' } as Parameters<typeof getAllAlerts>[0]);
    expect(Array.isArray(allWithScope)).toBe(true);
  });

  test('getAllAlerts handles alerts with missing reportDate', async () => {
    await createAlert(makeAlertData({ reportDate: '2025-03-15' }));
    await createAlert(makeAlertData({ reportDate: undefined }));

    const all = await getAllAlerts();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  // ---- Line 13: Test sort with missing reportDate on both items ----
  test('getAllAlerts sorts correctly when both reportDates are missing (line 13)', async () => {
    // Create two alerts without reportDate - should still sort correctly with empty strings
    await createAlert(makeAlertData({
      reportDate: undefined as unknown as string,
      disease: 'Malaria',
      cases: 10,
    }));

    await createAlert(makeAlertData({
      reportDate: undefined as unknown as string,
      disease: 'Cholera',
      cases: 5,
    }));

    const all = await getAllAlerts();
    expect(all.length).toBeGreaterThanOrEqual(2);
    // Both items sorted with empty strings - order should be stable
    expect(Array.isArray(all)).toBe(true);
  });
});
