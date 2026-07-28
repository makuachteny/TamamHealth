/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Patient reminder dispatch — retry, backoff, terminal failure, idempotency
 * (KAN-104).
 *
 * The dispatch function and its API route already existed; nothing called them
 * on a schedule, and a failed send left the reminder looking `queued` —
 * indistinguishable from one still waiting its turn. A clinical recall nobody
 * chased is exactly what this queue exists to prevent.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-rem-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

const smsOutbox: Array<{ to: string; body: string }> = [];
let smsResult: { ok: boolean; providerId: string; error?: string } = { ok: true, providerId: 'test' };
jest.mock('@/lib/sms', () => ({
  sendSms: jest.fn(async (input: { to: string; body: string }) => {
    smsOutbox.push(input);
    return smsResult;
  }),
}));

import { teardownTestDBs } from '../helpers/test-db';
import {
  queueReminder, dispatchDueReminders, getDueReminders, getRemindersByPatient,
  isRetryDue, MAX_DISPATCH_ATTEMPTS,
} from '@/lib/services/patient-reminder-service';
import { patientsDB } from '@/lib/db';
import type { PatientReminderDoc } from '@/lib/db-types';

const ORIGINAL_ENV = { ...process.env };

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV, PATIENT_REMINDER_SMS_ENABLED: 'true' };
  smsOutbox.length = 0;
  smsResult = { ok: true, providerId: 'test' };
  await patientsDB().put({ _id: 'pat-1', type: 'patient', phone: '+211912345678' } as never);
});

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  await teardownTestDBs();
  uuidCounter = 0;
});

const queue = () => queueReminder({
  patientId: 'pat-1', patientName: 'Achol Deng',
  message: 'Come fasted for your blood test tomorrow.',
  sendDate: '2020-01-01', channel: 'sms',
});

describe('gateway opt-in', () => {
  test('does nothing when the gateway is disabled', async () => {
    process.env.PATIENT_REMINDER_SMS_ENABLED = 'false';
    await queue();
    const out = await dispatchDueReminders();
    expect(out.gatewayEnabled).toBe(false);
    expect(smsOutbox).toHaveLength(0);
    // The reminder stays queued for staff to work by hand.
    expect(await getDueReminders()).toHaveLength(1);
  });
});

describe('successful dispatch', () => {
  test('sends a due reminder and marks it sent', async () => {
    await queue();
    const out = await dispatchDueReminders();
    expect(out.sent).toBe(1);
    expect(smsOutbox[0].to).toBe('+211912345678');
    expect(await getDueReminders()).toHaveLength(0);
  });

  test('is IDEMPOTENT — a second run does not re-send', async () => {
    // The acceptance criterion. Status flips to 'sent' before the next read,
    // and getDueReminders only returns 'queued'.
    await queue();
    await dispatchDueReminders();
    const second = await dispatchDueReminders();
    expect(second.attempted).toBe(0);
    expect(smsOutbox).toHaveLength(1);
  });
});

describe('failure handling', () => {
  test('a failed send stays queued and records the error', async () => {
    smsResult = { ok: false, providerId: 'test', error: 'gateway timeout' };
    await queue();
    const out = await dispatchDueReminders();

    expect(out.failed).toBe(1);
    expect(out.permanentlyFailed).toBe(0);
    const [r] = await getRemindersByPatient('pat-1');
    expect(r.status).toBe('queued');       // retryable
    expect(r.attempts).toBe(1);
    expect(r.lastError).toMatch(/gateway timeout/);
  });

  test('becomes terminally failed after the attempt cap, and is VISIBLE as failed', async () => {
    smsResult = { ok: false, providerId: 'test', error: 'invalid number' };
    await queue();

    // Exhaust the cap, bypassing backoff by clearing lastAttemptAt between runs.
    for (let i = 0; i < MAX_DISPATCH_ATTEMPTS; i++) {
      await dispatchDueReminders();
      const [r] = await getRemindersByPatient('pat-1');
      if (r.status === 'queued') {
        const db = (await import('@/lib/db')).getDB('tamamhealth_patient_reminders');
        const doc = await db.get(r._id) as PatientReminderDoc;
        await db.put({ ...doc, lastAttemptAt: undefined });
      }
    }

    const [final] = await getRemindersByPatient('pat-1');
    expect(final.status).toBe('failed');
    expect(final.attempts).toBe(MAX_DISPATCH_ATTEMPTS);
    // Terminal — no longer picked up as due, so it can't spin forever.
    expect(await getDueReminders()).toHaveLength(0);
  });
});

describe('retry backoff', () => {
  test('a never-attempted reminder is immediately due', () => {
    expect(isRetryDue({ attempts: 0 } as PatientReminderDoc)).toBe(true);
    expect(isRetryDue({} as PatientReminderDoc)).toBe(true);
  });

  test('a recently-attempted reminder waits', () => {
    const justNow = new Date().toISOString();
    expect(isRetryDue({ attempts: 1, lastAttemptAt: justNow } as PatientReminderDoc)).toBe(false);
  });

  test('the wait grows with each attempt', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    // After 1 attempt the wait is 1h — two hours is enough.
    expect(isRetryDue({ attempts: 1, lastAttemptAt: twoHoursAgo } as PatientReminderDoc)).toBe(true);
    // After 2 attempts the wait is 6h — two hours is not.
    expect(isRetryDue({ attempts: 2, lastAttemptAt: twoHoursAgo } as PatientReminderDoc)).toBe(false);
  });

  test('a reminder inside its backoff window is skipped, not consumed', async () => {
    smsResult = { ok: false, providerId: 'test', error: 'timeout' };
    await queue();
    await dispatchDueReminders();          // attempt 1, fails
    const out = await dispatchDueReminders(); // immediately again

    expect(out.skippedBackoff).toBe(1);
    expect(out.attempted).toBe(0);
    const [r] = await getRemindersByPatient('pat-1');
    expect(r.attempts).toBe(1); // not burned
  });
});

describe('channel and contact handling', () => {
  test('non-SMS channels stay staff-worked', async () => {
    await queueReminder({
      patientId: 'pat-1', message: 'Call the patient', sendDate: '2020-01-01', channel: 'call',
    });
    const out = await dispatchDueReminders();
    expect(out.skippedChannel).toBe(1);
    expect(smsOutbox).toHaveLength(0);
  });

  test('a patient with no phone is skipped, not failed', async () => {
    await patientsDB().put({ _id: 'pat-2', type: 'patient' } as never);
    await queueReminder({
      patientId: 'pat-2', message: 'Reminder', sendDate: '2020-01-01', channel: 'sms',
    });
    const out = await dispatchDueReminders();
    expect(out.skippedNoPhone).toBe(1);
  });
});
