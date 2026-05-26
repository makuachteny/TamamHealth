/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for telehealth-service.ts
 * Covers telehealth session creation, status updates, and statistics.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tele-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getAllSessions,
  getSessionsByPatient,
  getSessionsByProvider,
  getUpcomingSessions,
  getTodaysSessions,
  createSession,
  updateSessionStatus,
  updateSession,
  addClinicalNotes,
  rateSession,
  getTelehealthStats,
} from '@/lib/services/telehealth-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateSessionInput = Parameters<typeof createSession>[0];

function validSession(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  const today = new Date().toISOString().slice(0, 10);

  return {
    patientId: 'pat-001',
    patientName: 'John Doe',
    patientPhone: '211912345678',
    patientEmail: 'john@example.com',
    providerId: 'prov-001',
    providerName: 'Dr. Smith',
    providerRole: 'doctor',
    facilityId: 'hosp-001',
    facilityName: 'TamamHealth Hospital',
    sessionType: 'video' as const,
    scheduledDate: today,
    scheduledTime: '14:00',
    status: 'scheduled' as const,
    chiefComplaint: 'Follow-up consultation',
    followUpRequired: false,
    referralRequired: false,
    connectionDrops: 0,
    patientConsentGiven: true,
    sessionRecorded: false,
    state: 'Central Equatoria',
    ...overrides,
  };
}

describe('Telehealth Service', () => {
  test('creates a telehealth session', async () => {
    const session = await createSession(validSession());

    expect(session._id).toMatch(/^tele-/);
    expect(session.type).toBe('telehealth_session');
    expect(session.patientName).toBe('John Doe');
    expect(session.status).toBe('scheduled');
    expect(session.roomId).toMatch(/^tamamhealth-/);
    expect(session.createdAt).toBeTruthy();
  });

  test('retrieves all sessions', async () => {
    await createSession(validSession());
    await createSession(validSession({
      patientName: 'Jane Doe',
      patientId: 'pat-002',
    }));

    const all = await getAllSessions();
    expect(all).toHaveLength(2);
    expect(all[0].type).toBe('telehealth_session');
  });

  test('retrieves sessions by patient ID', async () => {
    await createSession(validSession());
    await createSession(validSession({
      patientId: 'pat-002',
      patientName: 'Jane Doe',
    }));

    const sessions = await getSessionsByPatient('pat-001');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].patientId).toBe('pat-001');
  });

  test('retrieves sessions by provider ID', async () => {
    await createSession(validSession());
    await createSession(validSession({
      providerId: 'prov-002',
      providerName: 'Dr. Jones',
    }));

    const sessions = await getSessionsByProvider('prov-001');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].providerId).toBe('prov-001');
  });

  test('retrieves upcoming sessions excluding completed and cancelled', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // Create scheduled session for tomorrow
    await createSession(validSession({
      scheduledDate: tomorrow,
      status: 'scheduled',
    }));

    // Create completed session for today
    await createSession(validSession({
      scheduledDate: today,
      status: 'completed',
    }));

    // Create cancelled session
    await createSession(validSession({
      scheduledDate: tomorrow,
      status: 'cancelled',
    }));

    const upcoming = await getUpcomingSessions();
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].status).toBe('scheduled');
  });

  test('retrieves today sessions', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    await createSession(validSession({
      scheduledDate: today,
    }));

    await createSession(validSession({
      patientId: 'pat-002',
      patientName: 'Jane Doe',
      scheduledDate: tomorrow,
    }));

    const todaySessions = await getTodaysSessions();
    expect(todaySessions).toHaveLength(1);
    expect(todaySessions[0].scheduledDate).toBe(today);
  });

  test('updates session status to in_session and sets start time', async () => {
    const session = await createSession(validSession());
    const before = new Date();

    const updated = await updateSessionStatus(session._id, 'in_session');

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('in_session');
    expect(updated!.actualStartTime).toBeTruthy();
    const startTime = new Date(updated!.actualStartTime!);
    expect(startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  test('updates session status to completed and calculates duration', async () => {
    const session = await createSession(validSession());

    // First mark as in_session
    await updateSessionStatus(session._id, 'in_session');

    // Wait a moment and mark as completed
    await new Promise(resolve => setTimeout(resolve, 100));

    const completed = await updateSessionStatus(session._id, 'completed');

    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
    expect(completed!.actualEndTime).toBeTruthy();
    expect(completed!.duration).toBeGreaterThanOrEqual(0);
  });

  test('returns null when updating nonexistent session', async () => {
    const result = await updateSessionStatus('tele-nonexistent', 'in_session');
    expect(result).toBeNull();
  });

  test('updates session with partial data', async () => {
    const session = await createSession(validSession());

    const updated = await updateSession(session._id, {
      sessionQuality: 'good',
      connectionDrops: 2,
    });

    expect(updated).not.toBeNull();
    expect(updated!.sessionQuality).toBe('good');
    expect(updated!.connectionDrops).toBe(2);
    expect(updated!.patientName).toBe('John Doe'); // unchanged
  });

  test('adds clinical notes to session', async () => {
    const session = await createSession(validSession());

    const updated = await addClinicalNotes(
      session._id,
      'Patient shows improvement in symptoms',
      'Resolved pneumonia',
      'J18.9'
    );

    expect(updated).not.toBeNull();
    expect(updated!.clinicalNotes).toBe('Patient shows improvement in symptoms');
    expect(updated!.diagnosis).toBe('Resolved pneumonia');
    expect(updated!.icd10Code).toBe('J18.9');
  });

  test('rates telehealth session', async () => {
    const session = await createSession(validSession());

    const rated = await rateSession(session._id, 4, 'Excellent consultation');

    expect(rated).not.toBeNull();
    expect(rated!.patientRating).toBe(4);
    expect(rated!.patientFeedback).toBe('Excellent consultation');
  });

  test('calculates telehealth stats correctly', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // Create scheduled session for today
    await createSession(validSession({
      scheduledDate: today,
      status: 'scheduled',
    }));

    // Create completed session with duration and rating
    const completed = await createSession(validSession({
      patientId: 'pat-002',
      patientName: 'Jane Doe',
      scheduledDate: today,
      status: 'scheduled',
    }));

    await updateSessionStatus(completed._id, 'in_session');
    await new Promise(resolve => setTimeout(resolve, 100));
    await updateSessionStatus(completed._id, 'completed', { patientRating: 5 });

    // Create cancelled session for tomorrow (so it doesn't count in todayTotal)
    await createSession(validSession({
      patientId: 'pat-003',
      patientName: 'Bob Smith',
      scheduledDate: tomorrow,
      status: 'cancelled',
    }));

    const stats = await getTelehealthStats();

    expect(stats.total).toBe(3);
    expect(stats.todayTotal).toBe(2);
    expect(stats.completedTotal).toBe(1);
    expect(stats.cancelledTotal).toBe(1);
    expect(stats.avgRating).toBeGreaterThan(0);
  });

  test('stats with no completed sessions returns zero average', async () => {
    await createSession(validSession({
      status: 'scheduled',
    }));

    const stats = await getTelehealthStats();

    expect(stats.completedTotal).toBe(0);
    expect(stats.avgDuration).toBe(0);
    expect(stats.avgRating).toBe(0);
  });

  test('sorts sessions by most recent first by default', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    await createSession(validSession({
      patientId: 'pat-001',
      scheduledDate: yesterday,
      scheduledTime: '09:00',
    }));

    await createSession(validSession({
      patientId: 'pat-002',
      patientName: 'Jane Doe',
      scheduledDate: today,
      scheduledTime: '14:00',
    }));

    const all = await getAllSessions();
    expect(all[0].scheduledDate).toBe(today);
    expect(all[1].scheduledDate).toBe(yesterday);
  });

  test('marks follow up required on session', async () => {
    const session = await createSession(validSession({
      followUpRequired: true,
      followUpDate: '2024-02-01',
    }));

    expect(session.followUpRequired).toBe(true);
    expect(session.followUpDate).toBe('2024-02-01');
  });

  test('creates session with referral requirement', async () => {
    const session = await createSession(validSession({
      referralRequired: true,
      referralFacility: 'Juba Teaching Hospital',
    }));

    expect(session.referralRequired).toBe(true);
    expect(session.referralFacility).toBe('Juba Teaching Hospital');
  });

  test('getUpcomingSessions sorts by date and time ascending', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // Create sessions out of order
    await createSession(validSession({
      scheduledDate: tomorrow,
      scheduledTime: '15:00',
      patientId: 'pat-001',
    }));

    await createSession(validSession({
      scheduledDate: tomorrow,
      scheduledTime: '09:00',
      patientId: 'pat-002',
      patientName: 'Another Patient',
    }));

    const upcoming = await getUpcomingSessions();
    // Should be sorted by date+time ascending
    expect(upcoming[0].scheduledTime).toBe('09:00');
    expect(upcoming[1].scheduledTime).toBe('15:00');
  });

  test('updateSession returns null for nonexistent session', async () => {
    const result = await updateSession('tele-nonexistent', { sessionQuality: 'good' });
    expect(result).toBeNull();
  });

  test('getUpcomingSessions with scope parameter', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await createSession(validSession({
      scheduledDate: tomorrow,
      status: 'scheduled',
    }));

    const upcoming = await getUpcomingSessions({ role: 'nurse' } as Parameters<typeof getUpcomingSessions>[0]);
    expect(Array.isArray(upcoming)).toBe(true);
  });

  test('getTelehealthStats includes failed sessions', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await createSession(validSession({
      scheduledDate: today,
      status: 'failed',
    }));

    const stats = await getTelehealthStats();
    expect(stats.failedTotal).toBe(1);
  });
});
