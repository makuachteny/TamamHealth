/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * sync-event-service — pending-event queries (KAN-54 / MED-05).
 *
 * The regression these cover is subtle and was silent: `getPendingSyncEvents`
 * used to call `allDocs({ include_docs: true, limit })` and filter afterwards,
 * so `limit` bounded the DOCUMENTS SCANNED rather than the results returned. It
 * only ever looked at the first N documents in _id order. Since every
 * create/update in the platform emits a sync event, the database passes 500
 * documents almost immediately — and any pending event sitting past that
 * boundary was invisible to the push job forever.
 */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { emitSyncEvent, getPendingSyncEvents } from '@/lib/services/sync-event-service';
import { syncEventsDB } from '@/lib/db';
import type { SyncEventDoc } from '@/lib/db-types';

afterEach(async () => {
  await teardownTestDBs();
});

async function emit(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await emitSyncEvent({
      resourceType: 'patient',
      resourceId: `pat-${String(i).padStart(5, '0')}`,
      operation: 'create',
    });
  }
}

describe('getPendingSyncEvents', () => {
  test('returns pending events', async () => {
    await emit(3);
    const pending = await getPendingSyncEvents();
    expect(pending).toHaveLength(3);
    expect(pending.every((e) => e.syncStatus === 'pending')).toBe(true);
  });

  test('limit bounds the RESULT COUNT, not the documents scanned', async () => {
    await emit(10);
    expect(await getPendingSyncEvents(4)).toHaveLength(4);
  });

  test('finds a pending event even when many synced events precede it', async () => {
    // The exact shape of the old bug. Mark everything synced except the last
    // one; under the old allDocs+filter code a small limit would scan only the
    // already-synced head of the database and report zero pending work.
    await emit(30);
    const db = syncEventsDB();
    const all = await db.allDocs({ include_docs: true });
    const docs = all.rows.map((r) => r.doc as SyncEventDoc).filter(Boolean);
    // Sort by _id so "last" matches the order allDocs would have walked.
    docs.sort((a, b) => a._id.localeCompare(b._id));

    for (const doc of docs.slice(0, docs.length - 1)) {
      await db.put({ ...doc, syncStatus: 'synced' });
    }

    const pending = await getPendingSyncEvents(5);
    expect(pending).toHaveLength(1);
    expect(pending[0].syncStatus).toBe('pending');
  });

  test('returns an empty list when nothing is pending', async () => {
    expect(await getPendingSyncEvents()).toEqual([]);
  });
});
