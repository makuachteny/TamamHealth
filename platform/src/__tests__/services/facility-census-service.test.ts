/* eslint-disable @typescript-eslint/no-require-imports */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-census-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { syncEventsDB } from '@/lib/db';
import { getFacilityCensusByFacility, saveFacilityCensus } from '@/lib/services/facility-census-service';

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('facility-census-service', () => {
  test('saves daily facility census as a durable synced record', async () => {
    const first = await saveFacilityCensus({
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      orgId: 'org-001',
      date: '2026-06-27',
      census: { opdVisitsToday: 18, occupiedBeds: 7 },
      submittedBy: 'user-data',
      submittedByName: 'Data Clerk',
    });
    expect(first._id).toBe('facility-census-hosp-001-2026-06-27');

    const updated = await saveFacilityCensus({
      facilityId: 'hosp-001',
      facilityName: 'Juba Teaching Hospital',
      orgId: 'org-001',
      date: '2026-06-27',
      census: { opdVisitsToday: 20, occupiedBeds: 8 },
      submittedBy: 'user-data',
      submittedByName: 'Data Clerk',
    });
    expect(updated._id).toBe(first._id);
    expect(updated._rev).not.toBe(first._rev);

    const rows = await getFacilityCensusByFacility('hosp-001');
    expect(rows).toHaveLength(1);
    expect(rows[0].census.opdVisitsToday).toBe(20);

    const syncRows = await syncEventsDB().allDocs({ include_docs: true });
    expect(syncRows.rows).toHaveLength(2);
    expect(syncRows.rows.map(r => (r.doc as unknown as { resourceType: string }).resourceType)).toEqual([
      'facility_census',
      'facility_census',
    ]);
  });
});
