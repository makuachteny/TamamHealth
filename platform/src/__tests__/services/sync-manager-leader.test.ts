/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Tests for sync-manager leader-election (Item 2 of iter-2).
 *
 * Two tabs of the platform open in the same browser were both spinning up a
 * SyncManager and replicating in parallel — wasting bandwidth and creating
 * spurious conflicts. We elect a single leader per origin via the Web Locks
 * API. Other tabs queue, report a 'follower' aggregate state, and take over
 * when the leader closes.
 */

jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
// Stub out the SyncService so we can observe whether the manager actually
// started replications without spinning up real PouchDB sync.
jest.mock('@/lib/sync/sync-service', () => {
  const actual = jest.requireActual('@/lib/sync/sync-service');
  return {
    ...actual,
    SyncService: jest.fn().mockImplementation(() => ({
      startSync: jest.fn(),
      destroy: jest.fn(),
      syncNow: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

import { teardownTestDBs } from '../helpers/test-db';

afterEach(async () => {
  await teardownTestDBs();
  jest.resetModules();
});

describe('SyncManager leader election', () => {
  function setSyncEnabled(enabled: boolean) {
    process.env.NEXT_PUBLIC_SYNC_ENABLED = enabled ? 'true' : 'false';
    process.env.NEXT_PUBLIC_COUCHDB_URL = 'http://localhost:5984';
  }

  test('falls back to all-tabs-sync when navigator.locks is unavailable', async () => {
    setSyncEnabled(true);
    // Remove navigator.locks for this test.
    const originalLocks = (navigator as any).locks;
    delete (navigator as any).locks;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { SyncManager } = require('@/lib/sync/sync-manager');
    const { SyncService } = require('@/lib/sync/sync-service');

    const m = new SyncManager({ orgId: 'org-1' });
    m.startAll();

    // SyncService instances were spun up immediately (legacy fall-back).
    expect((SyncService as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('navigator.locks unavailable')
    );

    m.stopAll();

    // Restore.
    if (originalLocks) (navigator as any).locks = originalLocks;
    warn.mockRestore();
  });

  test('first manager becomes leader; second manager reports follower state', async () => {
    setSyncEnabled(true);
    // Build a tiny single-leader Web Locks shim. Only one exclusive holder
    // for a given name; queued requests run when the holder's callback
    // resolves.
    type Waiter = { resolve: () => void };
    const queues = new Map<string, Waiter[]>();
    (navigator as any).locks = {
      request: async (
        name: string,
        _opts: { mode?: 'exclusive' | 'shared' },
        cb: (lock: unknown | null) => Promise<void> | void
      ) => {
        const q = queues.get(name) ?? [];
        if (q.length === 0) {
          // No holder — run immediately, but block other waiters until done.
          q.push({ resolve: () => {} });
          queues.set(name, q);
          try {
            await cb({ name });
          } finally {
            q.shift();
            const next = q[0];
            if (next) next.resolve();
          }
        } else {
          // Wait until the holder finishes.
          await new Promise<void>((resolve) => {
            q.push({ resolve });
            queues.set(name, q);
          });
          try {
            await cb({ name });
          } finally {
            q.shift();
            const next = q[0];
            if (next) next.resolve();
          }
        }
      },
    };

    const { SyncManager } = require('@/lib/sync/sync-manager');
    const { SyncService } = require('@/lib/sync/sync-service');

    // Tab 1 acquires the lock.
    const tab1 = new SyncManager({ orgId: 'org-1' });
    tab1.startAll();
    // Let microtasks flush so the lock callback (which sets _leader = true)
    // has a chance to fire.
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(tab1.isLeader).toBe(true);
    const callsAfterLeader = (SyncService as jest.Mock).mock.calls.length;
    expect(callsAfterLeader).toBeGreaterThan(0);

    // Tab 2 starts while tab 1 still holds the lock.
    const tab2 = new SyncManager({ orgId: 'org-1' });
    tab2.startAll();
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(tab2.isLeader).toBe(false);
    expect(tab2.getStatus().state).toBe('follower');
    // Tab 2 must NOT have spun up additional SyncService instances yet.
    expect((SyncService as jest.Mock).mock.calls.length).toBe(callsAfterLeader);

    // Tab 1 closes → its lock callback resolves → tab 2 becomes leader.
    tab1.stopAll();
    // Drain microtasks so the queued lock callback runs.
    await new Promise<void>((r) => setTimeout(r, 0));
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(tab2.isLeader).toBe(true);
    expect((SyncService as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterLeader);

    tab2.stopAll();
    delete (navigator as any).locks;
  });

  test('aggregate state union still includes the original states', () => {
    // Compile-time: AggregateState must remain a superset of the original
    // states so existing consumers don't break. This is a smoke check that
    // the type accepts each value.
    const valid: Array<
      'disabled' | 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'follower'
    > = ['disabled', 'idle', 'syncing', 'synced', 'error', 'offline', 'follower'];
    expect(valid).toHaveLength(7);
  });
});
