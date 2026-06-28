/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for patient-reminder-service.ts — queued patient reminders.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-prem-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  queueReminder,
  getRemindersByPatient,
  getDueReminders,
  markReminderSent,
  cancelReminder,
} from '@/lib/services/patient-reminder-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const base = { patientId: 'pat-1', createdById: 'dr-1', createdByName: 'Dr One', orgId: 'org-1' } as const;

describe('Patient reminder service', () => {
  test('queues a reminder with default sms channel', async () => {
    const r = await queueReminder({ ...base, message: 'Come fasted in 3 weeks', sendDate: '2026-07-15' });
    expect(r.status).toBe('queued');
    expect(r.channel).toBe('sms');
    const list = await getRemindersByPatient('pat-1');
    expect(list).toHaveLength(1);
  });

  test('requires a message and a send date', async () => {
    await expect(queueReminder({ ...base, message: '  ', sendDate: '2026-07-15' })).rejects.toThrow();
    await expect(queueReminder({ ...base, message: 'x', sendDate: '' })).rejects.toThrow();
  });

  test('getDueReminders returns only queued reminders whose date has arrived', async () => {
    await queueReminder({ ...base, message: 'Past', sendDate: '2026-06-01', channel: 'sms' });
    await queueReminder({ ...base, message: 'Future', sendDate: '2026-12-01', channel: 'sms' });
    const due = await getDueReminders('2026-06-24');
    expect(due).toHaveLength(1);
    expect(due[0].message).toBe('Past');
  });

  test('mark sent moves it out of due/queued', async () => {
    const r = await queueReminder({ ...base, message: 'Past', sendDate: '2026-06-01' });
    const sent = await markReminderSent(r._id);
    expect(sent!.status).toBe('sent');
    expect(sent!.sentAt).toBeTruthy();
    expect(await getDueReminders('2026-06-24')).toHaveLength(0);
  });

  test('cancel a queued reminder', async () => {
    const r = await queueReminder({ ...base, message: 'Cancel me', sendDate: '2026-07-01' });
    const c = await cancelReminder(r._id);
    expect(c!.status).toBe('cancelled');
  });

  test('queued reminders sort earliest send date first', async () => {
    await queueReminder({ ...base, message: 'Later', sendDate: '2026-08-01' });
    await queueReminder({ ...base, message: 'Sooner', sendDate: '2026-07-01' });
    const list = await getRemindersByPatient('pat-1');
    expect(list[0].message).toBe('Sooner');
  });

  test('status changes on a missing reminder return null', async () => {
    expect(await markReminderSent('nope')).toBeNull();
    expect(await cancelReminder('nope')).toBeNull();
  });
});
