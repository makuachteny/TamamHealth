/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for backup-status-service (KAN-117).
 *
 * The point of this module is that "unknown" is a real answer. Four admin
 * screens previously each decided for themselves what a missing backup
 * timestamp meant, and two of them reached opposite conclusions from identical
 * data — one reported a definite overdue backup, the other a clean bill of
 * health. These tests hold the three-way distinction that makes that
 * impossible.
 */

jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { getBackupStatus, recordBackupCompleted } from '@/lib/services/backup-status-service';

afterEach(async () => { await teardownTestDBs(); });

describe('getBackupStatus', () => {
  it('reports unknown when nothing has ever recorded a backup', async () => {
    const status = await getBackupStatus(24);

    // NOT 'overdue'. The absence of a report is not evidence of a failure, and
    // claiming otherwise raises an alarm the system has not earned.
    expect(status.state).toBe('unknown');
    expect(status.lastBackupAt).toBeNull();
    // Never Infinity — that value is what let a caller compute "overdue".
    expect(status.ageHours).toBeNull();
  });

  it('reports ok for a recent backup', async () => {
    await recordBackupCompleted(new Date(Date.now() - 2 * 3600_000).toISOString());
    const status = await getBackupStatus(24);

    expect(status.state).toBe('ok');
    expect(status.ageHours).toBeGreaterThan(1.5);
    expect(status.ageHours).toBeLessThan(3);
  });

  it('reports overdue once the backup is older than the objective', async () => {
    await recordBackupCompleted(new Date(Date.now() - 30 * 3600_000).toISOString());
    const status = await getBackupStatus(24);

    expect(status.state).toBe('overdue');
    expect(status.detail).toContain('past the 24h objective');
  });

  it('treats an unparseable timestamp as unknown, not as overdue', async () => {
    const { platformConfigDB } = require('@/lib/db');
    await platformConfigDB().put({
      _id: 'platform-config',
      type: 'platform_config',
      lastBackupAt: 'not-a-date',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const status = await getBackupStatus(24);
    // Corrupt data means we cannot tell, which is a different problem from a
    // late backup and should not be reported as one.
    expect(status.state).toBe('unknown');
  });

  it('honours the RPO it is given', async () => {
    await recordBackupCompleted(new Date(Date.now() - 10 * 3600_000).toISOString());

    expect((await getBackupStatus(24)).state).toBe('ok');
    expect((await getBackupStatus(8)).state).toBe('overdue');
  });
});

describe('recordBackupCompleted', () => {
  it('creates the config document when none exists', async () => {
    // Reporting a backup must not require someone to have visited the config
    // screen first.
    const at = new Date().toISOString();
    await recordBackupCompleted(at);
    expect((await getBackupStatus()).lastBackupAt).toBe(at);
  });

  it('preserves existing config when recording', async () => {
    const { platformConfigDB } = require('@/lib/db');
    await platformConfigDB().put({
      _id: 'platform-config',
      type: 'platform_config',
      platformName: 'TamamHealth',
      superAdminPolicies: { backupRpoHours: 12 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await recordBackupCompleted(new Date().toISOString());

    const doc = await platformConfigDB().get('platform-config');
    expect(doc.platformName).toBe('TamamHealth');
    // And the recorded RPO is the one the status is judged against.
    expect((await getBackupStatus()).rpoHours).toBe(12);
  });

  it('rejects an invalid timestamp rather than storing it', async () => {
    await expect(recordBackupCompleted('yesterday-ish')).rejects.toThrow();
    expect((await getBackupStatus()).state).toBe('unknown');
  });
});
