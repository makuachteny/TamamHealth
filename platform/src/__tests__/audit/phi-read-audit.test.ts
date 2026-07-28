/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * PHI read auditing (KAN-97).
 *
 * Writes were audited; reads were not. There was no record of who opened which
 * chart, viewed which lab result, or read which prescription — the first thing
 * asked for after a suspected privacy breach.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-phi-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { logPhiRead, logPhiSearch, getRecentAuditLogs } from '@/lib/services/audit-service';
import type { AuditLogDoc } from '@/lib/db-types';

const CTX = {
  userId: 'user-1', username: 'dr.wani', role: 'doctor',
  orgId: 'org-moh-ss', hospitalId: 'hosp-001', route: '/api/lab',
};

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('logPhiRead', () => {
  test('captures actor, role, facility, patient, document and route', async () => {
    // Every field an access review pivots on — previously all of this lived in
    // a free-text `details` string, which is useless for "who accessed this
    // patient's record?".
    await logPhiRead(CTX, 'lab_result', { patientId: 'pat-1', resourceId: 'lab-9' });

    const [entry] = await getRecentAuditLogs(10) as AuditLogDoc[];
    expect(entry.action).toBe('PHI_READ');
    expect(entry.userId).toBe('user-1');
    expect(entry.username).toBe('dr.wani');
    expect(entry.role).toBe('doctor');
    expect(entry.orgId).toBe('org-moh-ss');
    expect(entry.hospitalId).toBe('hosp-001');
    expect(entry.patientId).toBe('pat-1');
    expect(entry.resourceType).toBe('lab_result');
    expect(entry.resourceId).toBe('lab-9');
    expect(entry.route).toBe('/api/lab');
    expect(entry.createdAt).toBeTruthy();
  });

  test('a human-readable detail line is still written', async () => {
    await logPhiRead(CTX, 'prescription', { patientId: 'pat-1', resourceId: 'rx-2' });
    const [entry] = await getRecentAuditLogs(10);
    expect(entry.details).toMatch(/Read prescription rx-2 for patient pat-1/);
  });
});

describe('logPhiSearch', () => {
  test('records the query and result count as ONE entry', async () => {
    // A registry search returning 400 patients must not write 400 rows — that
    // drowns the log and makes retention cost scale with browsing.
    await logPhiSearch({ ...CTX, route: '/api/patients' }, 'patient', {
      query: 'Deng', resultCount: 43,
    });

    const logs = await getRecentAuditLogs(50);
    expect(logs).toHaveLength(1);
    const [entry] = logs;
    expect(entry.action).toBe('PHI_SEARCH');
    expect(entry.query).toBe('Deng');
    expect(entry.resultCount).toBe(43);
    expect(entry.details).toMatch(/Searched patient for "Deng" — 43 record\(s\)/);
  });

  test('an unfiltered list read is distinguishable from a query', async () => {
    await logPhiSearch(CTX, 'patient', { resultCount: 120 });
    const [entry] = await getRecentAuditLogs(10);
    expect(entry.query).toBeUndefined();
    expect(entry.details).toMatch(/unfiltered list/);
    expect(entry.resultCount).toBe(120);
  });

  test('a zero-result search is still recorded', async () => {
    // Someone searching repeatedly and finding nothing is itself a signal.
    await logPhiSearch(CTX, 'patient', { query: 'Nyandeng', resultCount: 0 });
    const [entry] = await getRecentAuditLogs(10);
    expect(entry.resultCount).toBe(0);
  });
});

describe('audit failure never breaks the read path', () => {
  test('a write failure is swallowed', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getDB } = await import('@/lib/db');
    const db = getDB('tamamhealth_audit_log');
    const original = db.put;
    // Deliberately break the store for this test.
    (db as unknown as { put: () => Promise<never> }).put = async () => { throw new Error('disk full'); };

    // Must resolve, not reject: a clinician opening a chart cannot be blocked
    // because the audit log is unwritable.
    await expect(logPhiRead(CTX, 'lab_result', { patientId: 'pat-1' })).resolves.toBeUndefined();

    db.put = original;
    errSpy.mockRestore();
  });
});
