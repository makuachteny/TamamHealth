/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Lab result review SLA enforcement (KAN-75 / LOW-03).
 *
 * `RESULT_REVIEW_SLA` (24h critical / 7d routine) existed with nothing reading
 * it: no query, no job, no escalation. A critical result could sit at
 * `resulted` indefinitely. These cover both halves of the fix — the overdue
 * query behind the dashboard panel, and the task raised the moment a critical
 * value arrives.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-test-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createLabResult,
  updateLabResult,
  getOverdueUnreviewedResults,
} from '@/lib/services/lab-service';
import { getTasks } from '@/lib/services/clinician-task-service';
import { labResultsDB } from '@/lib/db';
import type { LabResultDoc } from '@/lib/db-types';

const HOUR = 3_600_000;

const order = (overrides: Record<string, unknown> = {}) => ({
  patientId: 'pat-001',
  patientName: 'Achol Deng',
  hospitalNumber: 'JTH-0001',
  testName: 'Haemoglobin',
  specimen: 'Blood',
  status: 'pending' as const,
  result: '',
  unit: 'g/dL',
  referenceRange: '12-16',
  abnormal: false,
  critical: false,
  orderedBy: 'Dr. James Wani Igga',
  hospitalId: 'hosp-001',
  ...overrides,
});

/** Backdate a doc so the SLA clock has visibly elapsed. */
async function backdate(id: string, hoursAgo: number): Promise<void> {
  const db = labResultsDB();
  const doc = await db.get(id) as LabResultDoc;
  await db.put({ ...doc, updatedAt: new Date(Date.now() - hoursAgo * HOUR).toISOString() });
}

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('getOverdueUnreviewedResults', () => {
  test('flags a critical result unreviewed past 24h', async () => {
    const doc = await createLabResult(order({ critical: true }) as never);
    await updateLabResult(doc._id, { status: 'completed', result: '4.1' });
    await backdate(doc._id, 30);

    const overdue = await getOverdueUnreviewedResults();
    expect(overdue.map((r) => r._id)).toContain(doc._id);
  });

  test('does NOT flag a critical result still inside 24h', async () => {
    const doc = await createLabResult(order({ critical: true }) as never);
    await updateLabResult(doc._id, { status: 'completed', result: '4.1' });
    await backdate(doc._id, 5);

    expect(await getOverdueUnreviewedResults()).toHaveLength(0);
  });

  test('routine results get the longer 7-day window', async () => {
    const doc = await createLabResult(order() as never);
    await updateLabResult(doc._id, { status: 'completed', result: '13.5' });

    // 30h would breach the critical SLA but not the routine one.
    await backdate(doc._id, 30);
    expect(await getOverdueUnreviewedResults()).toHaveLength(0);

    await backdate(doc._id, 8 * 24);
    expect(await getOverdueUnreviewedResults()).toHaveLength(1);
  });

  test('a result still pending is not "awaiting review"', async () => {
    // Nothing has come back yet — that is the lab's clock, not the clinician's.
    const doc = await createLabResult(order({ critical: true }) as never);
    await backdate(doc._id, 30);
    expect(await getOverdueUnreviewedResults()).toHaveLength(0);
  });

  test('a reviewed result drops out of the queue', async () => {
    const doc = await createLabResult(order({ critical: true }) as never);
    await updateLabResult(doc._id, { status: 'completed', result: '4.1' });
    await backdate(doc._id, 30);
    expect(await getOverdueUnreviewedResults()).toHaveLength(1);

    await updateLabResult(doc._id, { orderStatus: 'reviewed_by_clinician' });
    expect(await getOverdueUnreviewedResults()).toHaveLength(0);
  });
});

describe('critical result raises a task for the ordering clinician', () => {
  test('filing a critical result creates a high-priority due-dated task', async () => {
    const doc = await createLabResult(order({ critical: true }) as never);
    await updateLabResult(doc._id, { status: 'completed', result: '4.1' });

    const tasks = await getTasks('Dr. James Wani Igga');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Critical result: Haemoglobin');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].patientId).toBe('pat-001');
    // Due at the 24h critical SLA, not an arbitrary date.
    const hoursUntilDue = (new Date(tasks[0].dueDate!).getTime() - Date.now()) / HOUR;
    expect(Math.round(hoursUntilDue)).toBe(24);
  });

  test('a non-critical result raises nothing', async () => {
    const doc = await createLabResult(order() as never);
    await updateLabResult(doc._id, { status: 'completed', result: '13.5' });
    expect(await getTasks('Dr. James Wani Igga')).toHaveLength(0);
  });

  test('re-saving the same critical result does not raise a second task', async () => {
    // Only the transition INTO critical+resulted fires. Otherwise every edit
    // to an already-critical result would spam the clinician's queue.
    const doc = await createLabResult(order({ critical: true }) as never);
    await updateLabResult(doc._id, { status: 'completed', result: '4.1' });
    await updateLabResult(doc._id, { result: '4.2' });
    await updateLabResult(doc._id, { result: '4.3' });

    expect(await getTasks('Dr. James Wani Igga')).toHaveLength(1);
  });

  test('a result with no ordering clinician does not throw', async () => {
    // The dashboard panel still surfaces it; there is just nobody to task.
    const doc = await createLabResult(order({ critical: true, orderedBy: '' }) as never);
    await expect(updateLabResult(doc._id, { status: 'completed', result: '4.1' })).resolves.toBeTruthy();
  });
});

/**
 * Guards the fix in the lab-desk order path (KAN-72).
 *
 * That page used to set `critical: orderPriority === 'stat'` at ORDER time.
 * `critical` describes the result VALUE, not the order's urgency — and nothing
 * has come back at order time, so it cannot be critical. Combined with the
 * KAN-75 alerting above, every STAT order would have announced itself as a
 * critical result the moment it was filed, and raised a task for a value that
 * was never critical. Two false alarms a day trains people to ignore the panel.
 */
describe('STAT priority is not a critical value', () => {
  test('a STAT-priority order filed with a normal result raises no critical task', async () => {
    // How the lab desk now creates a STAT order: urgency in `status`, and
    // `critical` left false until a value proves otherwise.
    const doc = await createLabResult(order({ status: 'in_progress', critical: false }) as never);
    await updateLabResult(doc._id, { status: 'completed', result: '13.5' });

    expect(await getTasks('Dr. James Wani Igga')).toHaveLength(0);
    expect(await getOverdueUnreviewedResults()).toHaveLength(0);
  });

  test('a genuinely critical value still alerts, whatever the order priority', async () => {
    const doc = await createLabResult(order({ status: 'in_progress', critical: false }) as never);
    // The lab flags it critical when the value comes back out of range.
    await updateLabResult(doc._id, { status: 'completed', result: '4.1', critical: true });

    expect(await getTasks('Dr. James Wani Igga')).toHaveLength(1);
  });
});
