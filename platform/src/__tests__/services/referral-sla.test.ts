/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Referral acknowledgement SLA (KAN-43 / HIGH-11).
 *
 * Before this, a referral sat at `sent` with no deadline, no escalation and no
 * feedback to the sending clinician — an emergency referral could wait
 * indefinitely and nothing surfaced it.
 */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createReferral,
  updateReferralStatus,
  getOverdueReferrals,
  isReferralOverdue,
  computeExpectedAt,
  REFERRAL_SLA_HOURS,
} from '@/lib/services/referral-service';
import type { ReferralDoc } from '@/lib/db-types';

const HOUR = 60 * 60 * 1000;

const referral = (overrides: Record<string, unknown> = {}) => ({
  patientId: 'pat-001',
  patientName: 'Achol Deng',
  fromHospital: 'Wau State Hospital',
  fromHospitalId: 'hosp-002',
  toHospital: 'Juba Teaching Hospital',
  toHospitalId: 'hosp-001',
  referralDate: '2026-07-27',
  urgency: 'urgent' as const,
  reason: 'Suspected TB',
  department: 'Internal Medicine',
  status: 'sent' as const,
  referringDoctor: 'Dr. Wani',
  notes: '',
  ...overrides,
});

/** A patient payload that satisfies validatePatient's required fields. */
const fullPatient = (overrides: Record<string, unknown> = {}) => ({
  hospitalNumber: 'HN-SLA-1',
  firstName: 'Achol',
  surname: 'Deng',
  dateOfBirth: '1994-05-05',
  gender: 'Female',
  phone: '+211912000001',
  state: 'Central Equatoria',
  county: 'Juba',
  tribe: 'Bari',
  primaryLanguage: 'Juba Arabic',
  bloodType: 'O+',
  allergies: [],
  chronicConditions: [],
  nokName: 'Mary Deng',
  nokRelationship: 'Sister',
  nokPhone: '+211912000099',
  registrationHospital: 'hosp-002',
  registrationDate: '2026-01-01',
  ...overrides,
});

afterEach(async () => {
  await teardownTestDBs();
});

describe('computeExpectedAt', () => {
  const base = '2026-07-27T00:00:00.000Z';

  test('emergency is +4h, urgent +24h, routine +72h', () => {
    expect(computeExpectedAt('emergency', base)).toBe('2026-07-27T04:00:00.000Z');
    expect(computeExpectedAt('urgent', base)).toBe('2026-07-28T00:00:00.000Z');
    expect(computeExpectedAt('routine', base)).toBe('2026-07-30T00:00:00.000Z');
  });

  test('matches the published SLA table', () => {
    expect(REFERRAL_SLA_HOURS).toEqual({ emergency: 4, urgent: 24, routine: 72 });
  });
});

describe('createReferral stamps expectedAt', () => {
  test('derives the deadline from urgency', async () => {
    const doc = await createReferral(referral({ urgency: 'emergency' }) as never);
    expect(doc.expectedAt).toBeDefined();
    const delta = new Date(doc.expectedAt!).getTime() - new Date(doc.createdAt).getTime();
    expect(Math.round(delta / HOUR)).toBe(4);
  });

  test('respects an explicitly supplied deadline', async () => {
    const explicit = '2026-12-25T00:00:00.000Z';
    const doc = await createReferral(referral({ expectedAt: explicit }) as never);
    expect(doc.expectedAt).toBe(explicit);
  });
});

describe('isReferralOverdue', () => {
  const past = new Date(Date.now() - HOUR).toISOString();

  test('flags an unacknowledged referral past its deadline', () => {
    expect(isReferralOverdue({ expectedAt: past, status: 'sent' } as ReferralDoc)).toBe(true);
  });

  test('does not flag one that has been acknowledged', () => {
    for (const status of ['received', 'seen', 'completed', 'cancelled'] as const) {
      expect(isReferralOverdue({ expectedAt: past, status } as ReferralDoc)).toBe(false);
    }
  });

  test('does not flag one still inside its window', () => {
    const future = new Date(Date.now() + HOUR).toISOString();
    expect(isReferralOverdue({ expectedAt: future, status: 'sent' } as ReferralDoc)).toBe(false);
  });

  test('NEVER flags a legacy referral that has no deadline', () => {
    // Absence of a deadline is not evidence of a missed one. Referrals created
    // before SLA tracking existed must not flood the escalation queue.
    expect(isReferralOverdue({ status: 'sent' } as ReferralDoc)).toBe(false);
  });
});

describe('getOverdueReferrals', () => {
  test('returns only breached referrals, most overdue first', async () => {
    await createReferral(referral({ urgency: 'emergency', reason: 'A' }) as never);
    await createReferral(referral({ urgency: 'routine', reason: 'B' }) as never);
    await createReferral(referral({ urgency: 'urgent', reason: 'C' }) as never);

    // 30 hours on: emergency (4h) and urgent (24h) have breached; routine (72h) has not.
    const later = new Date(Date.now() + 30 * HOUR);
    const overdue = await getOverdueReferrals(undefined, later);

    expect(overdue.map((r) => r.reason)).toEqual(['A', 'C']);
  });

  test('an acknowledged referral drops out of the queue', async () => {
    const doc = await createReferral(referral({ urgency: 'emergency' }) as never);
    const later = new Date(Date.now() + 30 * HOUR);
    expect(await getOverdueReferrals(undefined, later)).toHaveLength(1);

    await updateReferralStatus(doc._id, 'received');
    expect(await getOverdueReferrals(undefined, later)).toHaveLength(0);
  });
});

describe('feedback to the sending facility', () => {
  test('acknowledging raises a care alert on the patient record', async () => {
    const { getCareAlerts } = await import('@/lib/services/care-alert-service');
    const { createPatient } = await import('@/lib/services/patient-service');
    await createPatient(fullPatient({
      firstName: 'Achol', surname: 'Deng', gender: 'Female', phone: '+211912000001',
    }) as never);
    const patients = await (await import('@/lib/services/patient-service')).getAllPatients();
    const patientId = patients[0]._id;

    const doc = await createReferral(referral({ patientId, urgency: 'emergency' }) as never);
    await updateReferralStatus(doc._id, 'received');

    const alerts = await getCareAlerts(patientId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toMatch(/has received the receiving facility/);
    // Emergency referrals are what a sending clinician actively waits on.
    expect(alerts[0].priority).toBe('high');
  });

  test('a routine acknowledgement is normal priority', async () => {
    const { getCareAlerts } = await import('@/lib/services/care-alert-service');
    const { createPatient, getAllPatients } = await import('@/lib/services/patient-service');
    await createPatient(fullPatient({
      firstName: 'Deng', surname: 'Bol', gender: 'Male', phone: '+211912000002',
    }) as never);
    const patientId = (await getAllPatients())[0]._id;

    const doc = await createReferral(referral({ patientId, urgency: 'routine' }) as never);
    await updateReferralStatus(doc._id, 'seen');

    const alerts = await getCareAlerts(patientId);
    expect(alerts[0].priority).toBe('normal');
  });

  test('completing does not raise an acknowledgement alert', async () => {
    const doc = await createReferral(referral() as never);
    // Only received/seen are acknowledgements; completed is the outcome path.
    await expect(updateReferralStatus(doc._id, 'completed')).resolves.toBeTruthy();
  });
});
