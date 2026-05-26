/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for sync-service.surfaceHighRiskConflicts + conflict-service.enqueueConflict.
 *
 * Item 1 of the iter-2 architectural fixes wires the conflict-queue into the
 * live sync change handler so high-risk PouchDB conflicts (allergies,
 * referrals, discharge status, adverse events, medication allergies) surface
 * to clinicians instead of being silently auto-resolved by most-recent-rev
 * wins.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-conflict-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import PouchDB from 'pouchdb-browser';
import memoryAdapter from 'pouchdb-adapter-memory';
import { teardownTestDBs } from '../helpers/test-db';
import { surfaceHighRiskConflicts } from '@/lib/sync/sync-service';
import { listConflicts } from '@/lib/services/conflict-service';

PouchDB.plugin(memoryAdapter);

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

/**
 * Plant a doc that has competing revisions in a fresh memory PouchDB.
 * PouchDB stores both sibling revisions; the head will report the loser
 * via `_conflicts` when read with { conflicts: true }.
 */
async function plantConflict(
  db: PouchDB.Database,
  docId: string,
  type: string,
  baseFields: Record<string, unknown> = {}
): Promise<{ winningRev: string; losingRevs: string[] }> {
  // Manually insert two sibling revisions using new_edits=false. Both have
  // the same _id but different revision histories — the classic conflict.
  const winnerRev = '2-winner';
  const loserRev = '2-loser';

  await db.bulkDocs(
    [
      {
        _id: docId,
        _rev: winnerRev,
        _revisions: { start: 2, ids: ['winner', 'root'] },
        type,
        ...baseFields,
        version: 'winner',
      } as PouchDB.Core.PutDocument<{ _rev: string; _revisions: { start: number; ids: string[] } }>,
      {
        _id: docId,
        _rev: loserRev,
        _revisions: { start: 2, ids: ['loser', 'root'] },
        type,
        ...baseFields,
        version: 'loser',
      } as PouchDB.Core.PutDocument<{ _rev: string; _revisions: { start: number; ids: string[] } }>,
    ],
    { new_edits: false }
  );

  const head = await db.get(docId, { conflicts: true }) as PouchDB.Core.GetMeta & {
    _conflicts?: string[];
  };
  return { winningRev: head._rev, losingRevs: head._conflicts ?? [] };
}

describe('Sync conflict surfacing', () => {
  test('high-risk type with conflicts → row is added to the conflict queue', async () => {
    const db = require('@/lib/db').referralsDB() as PouchDB.Database;
    const planted = await plantConflict(db, 'ref-conflict-1', 'referral', {
      patientId: 'patient-001',
      orgId: 'org-1',
      fromHospitalId: 'hosp-1',
      toHospitalId: 'hosp-2',
    });
    expect(planted.losingRevs.length).toBeGreaterThan(0);

    await surfaceHighRiskConflicts(db, [{ _id: 'ref-conflict-1', _rev: planted.winningRev }]);

    const queued = await listConflicts({ status: 'pending' });
    expect(queued).toHaveLength(1);
    expect(queued[0].resourceType).toBe('referral');
    expect(queued[0].resourceId).toBe('ref-conflict-1');
    expect(queued[0].risk).toBe('high');
    expect(queued[0].orgId).toBe('org-1');
    expect(queued[0].winningRev).toBe(planted.winningRev);
    expect(queued[0].losingRevs).toEqual(planted.losingRevs);
  });

  test('low-risk type with conflicts → no queue row (default rev-wins applies)', async () => {
    const db = require('@/lib/db').patientsDB() as PouchDB.Database;
    await plantConflict(db, 'patient-conflict-1', 'patient', {
      orgId: 'org-1',
      fullName: 'Aluk Garang',
    });

    await surfaceHighRiskConflicts(db, [{ _id: 'patient-conflict-1' }]);

    const queued = await listConflicts({ status: 'pending' });
    expect(queued).toHaveLength(0);
  });

  test('high-risk type without conflicts → no queue row', async () => {
    const db = require('@/lib/db').referralsDB() as PouchDB.Database;
    await db.put({
      _id: 'ref-no-conflict',
      type: 'referral',
      patientId: 'p1',
      orgId: 'org-1',
    });

    await surfaceHighRiskConflicts(db, [{ _id: 'ref-no-conflict' }]);

    const queued = await listConflicts({ status: 'pending' });
    expect(queued).toHaveLength(0);
  });

  test('multiple high-risk types in one batch → one queue row per conflicted doc', async () => {
    const refDB = require('@/lib/db').referralsDB() as PouchDB.Database;
    const recDB = require('@/lib/db').medicalRecordsDB() as PouchDB.Database;

    await plantConflict(refDB, 'ref-multi-1', 'referral', { orgId: 'org-1' });
    await plantConflict(recDB, 'allergy-1', 'allergy', { orgId: 'org-1', patientId: 'p1' });

    await surfaceHighRiskConflicts(refDB, [{ _id: 'ref-multi-1' }]);
    await surfaceHighRiskConflicts(recDB, [{ _id: 'allergy-1' }]);

    const queued = await listConflicts({ status: 'pending' });
    expect(queued).toHaveLength(2);
    const types = queued.map(r => r.resourceType).sort();
    expect(types).toEqual(['allergy', 'referral']);
  });

  test('design docs are skipped', async () => {
    const db = require('@/lib/db').referralsDB() as PouchDB.Database;
    await surfaceHighRiskConflicts(db, [{ _id: '_design/views' }]);
    const queued = await listConflicts({ status: 'pending' });
    expect(queued).toHaveLength(0);
  });

  test('errors during conflict-surfacing do not throw', async () => {
    const db = require('@/lib/db').referralsDB() as PouchDB.Database;
    // _id pointing at a missing doc should silently no-op.
    await expect(
      surfaceHighRiskConflicts(db, [{ _id: 'nonexistent-doc' }])
    ).resolves.toBeUndefined();
    const queued = await listConflicts({ status: 'pending' });
    expect(queued).toHaveLength(0);
  });
});
