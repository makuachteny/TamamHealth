/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Ledger sync conflict policy (KAN-40 / HIGH-09).
 *
 * The ledger replicates bidirectionally, so two stations can post entries for
 * the same patient at the same time. These tests pin the three properties the
 * policy in `sync/sync-config.ts` depends on. If any of them breaks, concurrent
 * billing silently produces a wrong patient balance.
 *
 * Deliberately NOT mocking uuid here (most service tests do, to get stable
 * ids): the whole point is that real uuid generation keeps concurrent entries
 * on distinct _ids.
 */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createLedgerEntry,
  getPatientBalance,
  getPatientLedger,
} from '@/lib/services/ledger-service';

const entry = (overrides: Record<string, unknown> = {}) => ({
  patientId: 'pat-001',
  entryType: 'charge' as const,
  amount: 100,
  description: 'Consultation fee',
  facilityId: 'hosp-001',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
});

describe('ledger conflict policy', () => {
  test('concurrent writes never collide on _id', async () => {
    // 50 entries posted without awaiting between them — the closest we can get
    // in-process to two cashiers hitting Save at the same moment.
    const created = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        createLedgerEntry(entry({ amount: i + 1, description: `Charge ${i + 1}` })),
      ),
    );

    const ids = created.map((d) => d._id);
    expect(new Set(ids).size).toBe(ids.length);
    // Guard the id scheme itself — a change to a timestamp- or counter-based
    // _id would reintroduce the collision this policy rules out.
    for (const id of ids) expect(id).toMatch(/^ledger-/);
  });

  test('balance converges by summing amounts, regardless of write order', async () => {
    // A charge at the clinic and a payment at the cashier, posted concurrently.
    await Promise.all([
      createLedgerEntry(entry({ amount: 500, description: 'Lab panel' })),
      createLedgerEntry(entry({ entryType: 'payment', amount: -200, description: 'Cash part-payment' })),
      createLedgerEntry(entry({ amount: 150, description: 'Dispensing fee' })),
    ]);

    expect(await getPatientBalance('pat-001')).toBe(450);
  });

  test('runningBalance is a local snapshot and is NOT authoritative after convergence', async () => {
    // Both stations read the same starting balance (0) before either commits,
    // so both stamp a runningBalance that ignores the other's entry. This is
    // expected: the policy says derive the balance, never trust the snapshot.
    await Promise.all([
      createLedgerEntry(entry({ amount: 100, description: 'Station A charge' })),
      createLedgerEntry(entry({ amount: 100, description: 'Station B charge' })),
    ]);

    const entries = await getPatientLedger('pat-001');
    expect(entries).toHaveLength(2);

    // The derived balance is right...
    expect(await getPatientBalance('pat-001')).toBe(200);

    // ...while the highest stored snapshot under-reports it. Asserting the
    // discrepancy is the point: it documents why callers must not read
    // runningBalance to display a balance.
    const maxSnapshot = Math.max(...entries.map((e) => e.runningBalance));
    expect(maxSnapshot).toBeLessThan(200);
  });

  test('entries are append-only — every write produces a new document', async () => {
    const first = await createLedgerEntry(entry({ amount: 100 }));
    const second = await createLedgerEntry(entry({ amount: 100 }));

    expect(second._id).not.toBe(first._id);
    expect(await getPatientLedger('pat-001')).toHaveLength(2);
  });
});
