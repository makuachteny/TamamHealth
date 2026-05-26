/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
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

describe('SyncManager re-entry', () => {
  function setSyncEnabled() {
    process.env.NEXT_PUBLIC_SYNC_ENABLED = 'true';
    process.env.NEXT_PUBLIC_COUCHDB_URL = 'http://localhost:5984';
  }

  function installLockShim() {
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
          q.push({ resolve: () => {} });
          queues.set(name, q);
          try { await cb({ name }); }
          finally {
            q.shift();
            const next = q[0];
            if (next) next.resolve();
          }
        } else {
          await new Promise<void>((resolve) => {
            q.push({ resolve });
            queues.set(name, q);
          });
          try { await cb({ name }); }
          finally {
            q.shift();
            const next = q[0];
            if (next) next.resolve();
          }
        }
      },
    };
    return () => { delete (navigator as any).locks; };
  }

  test('calling startAll twice on the same manager is idempotent (no duplicate replications)', async () => {
    setSyncEnabled();
    const cleanup = installLockShim();

    const { SyncManager } = require('@/lib/sync/sync-manager');
    const { SyncService } = require('@/lib/sync/sync-service');

    const lockRequestSpy = jest.spyOn((navigator as any).locks, 'request');

    const m = new SyncManager({ orgId: 'org-1' });
    m.startAll();
    m.startAll();
    m.startAll(); // and a third for good measure
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(m.isLeader).toBe(true);
    const callCount = (SyncService as jest.Mock).mock.calls.length;
    expect(callCount).toBeGreaterThan(0);
    // Only ONE Web Lock request should have been made — extra startAll()
    // calls are guarded out before they queue up a duplicate waiter.
    expect(lockRequestSpy).toHaveBeenCalledTimes(1);

    m.stopAll();
    await new Promise<void>((r) => setTimeout(r, 0));
    await new Promise<void>((r) => setTimeout(r, 0));
    await new Promise<void>((r) => setTimeout(r, 0));

    // After stopAll, no leftover queued lock-callback should have promoted
    // again and spawned a second batch of services.
    expect((SyncService as jest.Mock).mock.calls.length).toBe(callCount);
    expect(m.isRunning).toBe(false);
    expect(m.isLeader).toBe(false);
    lockRequestSpy.mockRestore();
    cleanup();
  });

  test('follower tab survives leader teardown without leaking a duplicate startReplications', async () => {
    setSyncEnabled();
    const cleanup = installLockShim();

    const { SyncManager } = require('@/lib/sync/sync-manager');
    const { SyncService } = require('@/lib/sync/sync-service');

    const tab1 = new SyncManager({ orgId: 'org-1' });
    tab1.startAll();
    await new Promise<void>((r) => setTimeout(r, 0));
    const callsAfterT1 = (SyncService as jest.Mock).mock.calls.length;
    expect(tab1.isLeader).toBe(true);

    // Tab 2 enqueues, sees follower.
    const tab2 = new SyncManager({ orgId: 'org-1' });
    tab2.startAll();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(tab2.getStatus().state).toBe('follower');

    // User on tab2 paused sync (gating effect calls stopAll while still
    // queued). This MUST cancel the pending lock request, otherwise tab1
    // closing will silently promote tab2 and start replicating without the
    // user's permission.
    tab2.stopAll();
    expect(tab2.getStatus().state).not.toBe('follower');
    expect(tab2.isRunning).toBe(false);

    // Tab1 closes. Its lock callback resolves. Tab2's queued cb is invoked
    // by the shim. Because tab2 already stopped, its cb's guard
    // (!_started → return) should prevent a stale startReplications.
    tab1.stopAll();
    await new Promise<void>((r) => setTimeout(r, 0));
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(tab2.isLeader).toBe(false);
    // No new SyncService instances should have been created for tab2 (it
    // explicitly stopped before being promoted).
    expect((SyncService as jest.Mock).mock.calls.length).toBe(callsAfterT1);
    cleanup();
  });
});
