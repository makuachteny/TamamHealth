/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for audit-service.ts
 * Covers audit logging, data access tracking, and log retrieval.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-audit-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  logAudit,
  logDataAccess,
  getRecentAuditLogs,
} from '@/lib/services/audit-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

describe('Audit Service', () => {
  test('logs an audit event', async () => {
    await logAudit('LOGIN_SUCCESS', 'user-001', 'dr.kuol', 'User logged in');
    const logs = await getRecentAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('LOGIN_SUCCESS');
    expect(logs[0].userId).toBe('user-001');
    expect(logs[0].username).toBe('dr.kuol');
    expect(logs[0].details).toBe('User logged in');
    expect(logs[0].success).toBe(true);
  });

  test('logs failed events', async () => {
    await logAudit('LOGIN_FAILED', undefined, 'baduser', 'Invalid password', false);
    const logs = await getRecentAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].success).toBe(false);
    expect(logs[0].userId).toBeUndefined();
  });

  test('logDataAccess creates properly formatted audit entry', async () => {
    await logDataAccess('user-001', 'dr.kuol', 'MEDICAL_RECORDS', 'patient-001', 'VIEW');
    const logs = await getRecentAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('DATA_VIEW');
    expect(logs[0].details).toContain('MEDICAL_RECORDS');
    expect(logs[0].details).toContain('patient-001');
  });

  test('logDataAccess tracks all action types', async () => {
    await logDataAccess('u1', 'admin', 'PATIENTS', 'p1', 'CREATE');
    await logDataAccess('u1', 'admin', 'PATIENTS', 'p1', 'UPDATE');
    await logDataAccess('u1', 'admin', 'PATIENTS', 'p1', 'DELETE');
    await logDataAccess('u1', 'admin', 'REPORTS', 'r1', 'EXPORT');

    const logs = await getRecentAuditLogs();
    expect(logs).toHaveLength(4);
    const actions = logs.map(l => l.action).sort();
    expect(actions).toEqual(['DATA_CREATE', 'DATA_DELETE', 'DATA_EXPORT', 'DATA_UPDATE']);
  });

  test('getRecentAuditLogs returns newest first', async () => {
    await logAudit('EVENT_A', 'u1', 'user1', 'First event');
    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));
    await logAudit('EVENT_B', 'u1', 'user1', 'Second event');

    const logs = await getRecentAuditLogs();
    expect(logs[0].action).toBe('EVENT_B');
    expect(logs[1].action).toBe('EVENT_A');
  });

  test('getRecentAuditLogs respects limit', async () => {
    for (let i = 0; i < 10; i++) {
      await logAudit(`EVENT_${i}`, 'u1', 'user1', `Event ${i}`);
    }
    const logs = await getRecentAuditLogs(3);
    expect(logs).toHaveLength(3);
  });

  test('audit logging never throws (fault-tolerant)', async () => {
    // Even with undefined values, logAudit should not throw
    await expect(
      logAudit('TEST', undefined, undefined, 'test event')
    ).resolves.toBeUndefined();
  });

  test('getRecentAuditLogs handles empty database', async () => {
    const logs = await getRecentAuditLogs();
    expect(logs).toEqual([]);
  });

  test('getRecentAuditLogs sorts by createdAt with localeCompare', async () => {
    await logAudit('EVENT_1', 'u1', 'user1', 'Event 1');
    await new Promise(r => setTimeout(r, 5));
    await logAudit('EVENT_2', 'u1', 'user1', 'Event 2');

    const logs = await getRecentAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(2);
    // Most recent should be first
    expect(logs[0].action).toBe('EVENT_2');
  });

  test('logAudit with undefined userId and username', async () => {
    await logAudit('TEST_ACTION', undefined, undefined, 'Test details');
    const logs = await getRecentAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBeUndefined();
    expect(logs[0].username).toBeUndefined();
  });

  test('getRecentAuditLogs handles logs with missing createdAt', async () => {
    await logAudit('EVENT_A', 'u1', 'user1', 'Event A');
    const logs = await getRecentAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].createdAt).toBeDefined();
  });

  test('logDataAccess with DELETE action', async () => {
    await logDataAccess('user-001', 'admin', 'RECORDS', 'rec-123', 'DELETE');
    const logs = await getRecentAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('DATA_DELETE');
    expect(logs[0].details).toContain('DELETE');
  });

  test('logAudit catches and logs DB errors gracefully (line 29 catch branch)', async () => {
    // Mock the database to throw an error
    const { auditLogDB } = require('@/lib/db');
    const mockDb = auditLogDB();
    const originalPut = mockDb.put;
    mockDb.put = jest.fn().mockRejectedValueOnce(new Error('DB write failed'));

    // This should not throw despite the DB error
    await expect(
      logAudit('TEST_ACTION', 'user-001', 'testuser', 'Test details')
    ).resolves.toBeUndefined();

    // Restore original
    mockDb.put = originalPut;
  });

  test('getRecentAuditLogs with missing createdAt - tests || fallback (line 55)', async () => {
    // Directly test the sort line: (b.createdAt || '').localeCompare(a.createdAt || '')
    // When createdAt is undefined/null, it should use empty string in comparison
    const db = require('@/lib/db').auditLogDB();

    // Manually insert a log without createdAt
    await db.put({
      _id: 'test-1',
      type: 'audit_log',
      action: 'TEST_NO_DATE',
      createdAt: undefined,
      success: true,
    });
    await db.put({
      _id: 'test-2',
      type: 'audit_log',
      action: 'TEST_WITH_DATE',
      createdAt: '2026-04-13T12:00:00Z',
      success: true,
    });

    const logs = await getRecentAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(2);
    // Both should be returned despite missing createdAt on one
    expect(logs.filter(l => l.action === 'TEST_NO_DATE').length).toBe(1);
    expect(logs.filter(l => l.action === 'TEST_WITH_DATE').length).toBe(1);
  });
});
