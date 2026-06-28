/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for clinician-task-service.ts — personal to-dos with reminders.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-task-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createTask,
  getTasks,
  completeTask,
  reopenTask,
  rescheduleTask,
  updateTask,
  deleteTask,
} from '@/lib/services/clinician-task-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const base = { userId: 'dr-1', userName: 'Dr One', orgId: 'org-1' } as const;

describe('Clinician task service', () => {
  test('creates a task and lists it', async () => {
    await createTask({ ...base, title: 'Phone John' });
    const list = await getTasks('dr-1');
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Phone John');
    expect(list[0].status).toBe('open');
  });

  test('requires a title', async () => {
    await expect(createTask({ ...base, title: '   ' })).rejects.toThrow();
  });

  test('tasks are scoped per user', async () => {
    await createTask({ ...base, title: 'Mine' });
    expect(await getTasks('dr-2')).toHaveLength(0);
  });

  test('complete then reopen', async () => {
    const t = await createTask({ ...base, title: 'Contact Dr Smith' });
    const done = await completeTask(t._id);
    expect(done!.status).toBe('completed');
    expect(done!.completedAt).toBeTruthy();
    const open = await reopenTask(t._id);
    expect(open!.status).toBe('open');
    expect(open!.completedAt).toBeUndefined();
  });

  test('reschedule changes the due date', async () => {
    const t = await createTask({ ...base, title: 'Follow up', dueDate: '2026-06-25' });
    const r = await rescheduleTask(t._id, '2026-06-26');
    expect(r!.dueDate).toBe('2026-06-26');
  });

  test('open tasks sort before completed; earliest due first', async () => {
    const a = await createTask({ ...base, title: 'A', dueDate: '2026-06-26' });
    await createTask({ ...base, title: 'B', dueDate: '2026-06-24' });
    await completeTask(a._id);
    const list = await getTasks('dr-1');
    expect(list[0].title).toBe('B');          // open + earliest due
    expect(list[list.length - 1].title).toBe('A'); // completed last
  });

  test('update edits fields', async () => {
    const t = await createTask({ ...base, title: 'Old' });
    const u = await updateTask(t._id, { title: 'New', priority: 'high' });
    expect(u!.title).toBe('New');
    expect(u!.priority).toBe('high');
  });

  test('delete reports whether it existed', async () => {
    const t = await createTask({ ...base, title: 'Temp' });
    expect(await deleteTask(t._id)).toBe(true);
    expect(await deleteTask(t._id)).toBe(false);
  });

  test('mutations on a missing task return null', async () => {
    expect(await completeTask('nope')).toBeNull();
    expect(await rescheduleTask('nope', '2026-01-01')).toBeNull();
  });
});
