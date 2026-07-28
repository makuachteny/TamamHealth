/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for telehealth-service.ts
 * Covers telehealth session creation, status updates, and statistics.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tele-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
// telehealth-service reaches appointment-service through a dynamic import;
// ES module exports are non-configurable so jest.spyOn cannot redefine them.
jest.mock('@/lib/services/appointment-service', () => ({
  updateAppointmentStatus: jest.fn().mockResolvedValue(null),
  // The status sync reads the appointment before mapping onto it, to refuse
  // reopening a cancelled visit (KAN-127). Defaults to "no such appointment",
  // which the sync treats as nothing to guard against; tests that care
  // override it per case.
  getAppointmentById: jest.fn().mockResolvedValue(null),
}));

import { teardownTestDBs } from '../helpers/test-db';
import { jubaDate } from '@/lib/time-juba';
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
  recordConsent,
  getTelehealthStats,
  getSessionByAppointmentId,
  sessionIdForAppointment,
  rateSessionTechnical,
  aggregateRatings,
  AlreadyRatedError,
} from '@/lib/services/telehealth-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateSessionInput = Parameters<typeof createSession>[0];

function validSession(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  const today = jubaDate();

  return {
    patientId: 'pat-001',
    patientName: 'John Doe',
    patientPhone: '211912345678',
    patientEmail: 'support.tamam@gmail.com',
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
    // roomId is DERIVED from the session id rather than randomly generated, so
    // the room name can never drift from the record it belongs to — two people
    // "in the same visit" who cannot see each other is the worst class of bug
    // to diagnose remotely.
    expect(session.roomId).toBe(`th-${session._id}`);
    expect(session.createdAt).toBeTruthy();
  });

  test('issues join links that carry no token', async () => {
    const session = await createSession(validSession());

    // A join link that leaks — forwarded SMS, screenshot, shoulder-surfed —
    // must grant nothing on its own. Credentials are minted per request at
    // /api/telehealth/token after the caller authenticates and is checked
    // against the session's participants.
    expect(session.joinUrl).toContain(`/telehealth/join/${session._id}`);
    expect(session.providerJoinUrl).toContain(`/telehealth/visit/${session._id}`);
    for (const url of [session.joinUrl, session.providerJoinUrl]) {
      expect(url).not.toMatch(/token|jwt|secret|key=/i);
    }
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
    const today = jubaDate();
    const tomorrow = jubaDate(Date.now() + 86400000);

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
    const today = jubaDate();
    const tomorrow = jubaDate(Date.now() + 86400000);

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
    const today = jubaDate();
    const tomorrow = jubaDate(Date.now() + 86400000);

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
    const today = jubaDate();
    const yesterday = jubaDate(Date.now() - 86400000);

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
    const tomorrow = jubaDate(Date.now() + 86400000);

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
    const tomorrow = jubaDate(Date.now() + 86400000);
    await createSession(validSession({
      scheduledDate: tomorrow,
      status: 'scheduled',
    }));

    const upcoming = await getUpcomingSessions({ role: 'nurse' } as Parameters<typeof getUpcomingSessions>[0]);
    expect(Array.isArray(upcoming)).toBe(true);
  });

  test('getTelehealthStats includes failed sessions', async () => {
    const today = jubaDate();
    await createSession(validSession({
      scheduledDate: today,
      status: 'failed',
    }));

    const stats = await getTelehealthStats();
    expect(stats.failedTotal).toBe(1);
  });

  // ── Consent provenance ────────────────────────────────────────────────────
  // The provider room used to write `patientConsentGiven: true` with a
  // timestamp at session creation, fabricating an affirmative consent record
  // for a patient nobody had asked. These lock in that consent can only be
  // recorded deliberately, and always with its provenance.
  describe('consent', () => {
    test('records provider-attested consent with method and attester', async () => {
      const created = await createSession(validSession({ patientConsentGiven: false }));

      const updated = await recordConsent(created._id, {
        method: 'provider_attested_verbal',
        attestedBy: 'user-dr-smith',
        attestedByName: 'Dr. Smith',
      });

      expect(updated?.patientConsentGiven).toBe(true);
      expect(updated?.consentMethod).toBe('provider_attested_verbal');
      expect(updated?.consentAttestedBy).toBe('user-dr-smith');
      expect(updated?.consentAttestedByName).toBe('Dr. Smith');
      expect(updated?.consentTimestamp).toBeTruthy();
    });

    test('refuses a provider attestation with no attester', async () => {
      const created = await createSession(validSession({ patientConsentGiven: false }));

      // An attestation nobody is accountable for is the exact record we removed.
      await expect(
        recordConsent(created._id, { method: 'provider_attested_verbal' }),
      ).rejects.toThrow(/attestedBy/);
    });

    test('patient-portal consent records the patient, not an attester', async () => {
      const created = await createSession(validSession({ patientConsentGiven: false }));

      const updated = await recordConsent(created._id, {
        method: 'patient_portal',
        consentedBy: 'pat-001',
        policyVersion: '2026-07-01',
      });

      expect(updated?.patientConsentGiven).toBe(true);
      expect(updated?.consentMethod).toBe('patient_portal');
      // No clinician is involved in a first-party consent.
      expect(updated?.consentAttestedBy).toBeUndefined();
      // The patient IS named, and so is the text they agreed to.
      expect(updated?.consentedBy).toBe('pat-001');
      expect(updated?.consentPolicyVersion).toBe('2026-07-01');
    });

    test('refuses patient-portal consent with no patient id', async () => {
      const created = await createSession(validSession({ patientConsentGiven: false }));

      // The mirror of the attestation rule. "The patient consented" with
      // nobody named is an unsourced claim wearing a first-party label —
      // worse than an honest attestation, because it looks like better
      // evidence than it is.
      await expect(
        recordConsent(created._id, { method: 'patient_portal' }),
      ).rejects.toThrow(/consentedBy/);
    });
  });

  // ── Appointment lifecycle linkage ─────────────────────────────────────────
  describe('appointment linkage', () => {
    const { updateAppointmentStatus } = require('@/lib/services/appointment-service');

    beforeEach(() => { (updateAppointmentStatus as jest.Mock).mockClear(); });

    test('maps session status onto the linked appointment', async () => {
      const created = await createSession(validSession({ appointmentId: 'appt-42' }));

      await updateSessionStatus(created._id, 'in_session');
      expect(updateAppointmentStatus).toHaveBeenCalledWith('appt-42', 'in_progress');

      await updateSessionStatus(created._id, 'completed');
      expect(updateAppointmentStatus).toHaveBeenCalledWith('appt-42', 'completed');
    });

    test('waiting_room maps to checked_in', async () => {
      const created = await createSession(validSession({ appointmentId: 'appt-43' }));
      await updateSessionStatus(created._id, 'waiting_room');
      expect(updateAppointmentStatus).toHaveBeenCalledWith('appt-43', 'checked_in');
    });

    test('does nothing when the session has no appointment', async () => {
      const created = await createSession(validSession());
      await updateSessionStatus(created._id, 'in_session');
      expect(updateAppointmentStatus).not.toHaveBeenCalled();
    });
  });

  // ── KAN-126 / KAN-127 / KAN-141 ─────────────────────────────────────────
  describe('one session per appointment (KAN-126)', () => {
    it('returns the SAME session when called twice for one appointment', async () => {
      const first = await createSession(validSession({ appointmentId: 'appt-77' }));
      const second = await createSession(validSession({ appointmentId: 'appt-77' }));

      // The defect this pins: every call used to mint a fresh `tele-<uuid>` id
      // and a fresh room, so a refresh put the clinician in a different room
      // from the patient.
      expect(second._id).toBe(first._id);
      expect(second.roomId).toBe(first.roomId);
      expect((await getAllSessions()).filter(x => x.appointmentId === 'appt-77')).toHaveLength(1);
    });

    it('derives the id from the appointment so CouchDB enforces uniqueness', async () => {
      const s = await createSession(validSession({ appointmentId: 'appt-88' }));
      expect(s._id).toBe(sessionIdForAppointment('appt-88'));
      expect(await getSessionByAppointmentId('appt-88')).toMatchObject({ _id: s._id });
    });

    it('still mints independent ids for walk-ins with no appointment', async () => {
      // Walk-ins are deliberately exempt: each one genuinely is a new
      // encounter, and there is no key to converge on.
      const a = await createSession(validSession({ appointmentId: undefined }));
      const b = await createSession(validSession({ appointmentId: undefined }));
      expect(a._id).not.toBe(b._id);
    });

    it('does not resurrect a completed session for the same appointment', async () => {
      const first = await createSession(validSession({ appointmentId: 'appt-99' }));
      await updateSessionStatus(first._id, 'completed');
      // A follow-up visit must not reopen closed history. The deterministic id
      // means this create collides — it must surface, not silently return the
      // completed record as if it were live.
      await expect(createSession(validSession({ appointmentId: 'appt-99' }))).rejects.toBeDefined();
    });
  });

  describe('appointment status guard (KAN-127)', () => {
    it('refuses to move a cancelled appointment to completed', async () => {
      const appointmentService = require('@/lib/services/appointment-service');
      appointmentService.getAppointmentById.mockResolvedValueOnce({ _id: 'appt-x', status: 'cancelled' });
      appointmentService.updateAppointmentStatus.mockClear();

      const s = await createSession(validSession({ appointmentId: 'appt-x' }));
      await updateSessionStatus(s._id, 'completed');

      // Without the guard a stale completion from an abandoned room would
      // reopen a cancelled visit as attended, and it would then bill and
      // report as real activity.
      expect(appointmentService.updateAppointmentStatus).not.toHaveBeenCalled();
    });

    it('still syncs a normal appointment', async () => {
      const appointmentService = require('@/lib/services/appointment-service');
      appointmentService.getAppointmentById.mockResolvedValue({ _id: 'appt-y', status: 'scheduled' });
      appointmentService.updateAppointmentStatus.mockClear();

      const s = await createSession(validSession({ appointmentId: 'appt-y' }));
      await updateSessionStatus(s._id, 'in_session');

      expect(appointmentService.updateAppointmentStatus).toHaveBeenCalledWith('appt-y', 'in_progress');
    });
  });

  describe('statistics byType (KAN-141)', () => {
    it('counts sessions by modality instead of reporting zeros', async () => {
      await createSession(validSession({ sessionType: 'video' }));
      await createSession(validSession({ sessionType: 'video' }));
      await createSession(validSession({ sessionType: 'audio' }));

      const stats = await getTelehealthStats();

      expect(stats.byType).toEqual({ video: 2, audio: 1, chat: 0 });
      // The breakdown must account for every session, or it misleads.
      const summed = Object.values(stats.byType).reduce((a, b) => a + b, 0);
      expect(summed).toBe(stats.total);
    });
  });

  describe('session timeline (KAN-127)', () => {
    it('derives duration from stored timestamps and records why it ended', async () => {
      const s = await createSession(validSession({ appointmentId: 'appt-t1' }));
      await updateSessionStatus(s._id, 'in_session');
      const done = await updateSessionStatus(s._id, 'completed');

      expect(done?.actualStartTime).toBeTruthy();
      expect(done?.actualEndTime).toBeTruthy();
      expect(typeof done?.duration).toBe('number');
      expect(done?.terminationReason).toBe('provider_ended');
    });

    it('records a reason and an end time for non-completed terminal states', async () => {
      // An abandoned or failed visit used to leave no end time and no duration
      // at all, so it silently averaged in as a zero-minute session.
      const s = await createSession(validSession({ appointmentId: 'appt-t2' }));
      await updateSessionStatus(s._id, 'in_session');
      const failed = await updateSessionStatus(s._id, 'failed');

      expect(failed?.terminationReason).toBe('connection_failed');
      expect(failed?.actualEndTime).toBeTruthy();
      expect(typeof failed?.duration).toBe('number');
    });

    it('does not restart the clock when a session re-enters in_session', async () => {
      const s = await createSession(validSession({ appointmentId: 'appt-t3' }));
      const first = await updateSessionStatus(s._id, 'in_session');
      const startedAt = first?.actualStartTime;
      // A reconnect re-enters in_session; the visit did not start over.
      const again = await updateSessionStatus(s._id, 'in_session');
      expect(again?.actualStartTime).toBe(startedAt);
    });

    it('lets an explicit termination reason override the implied one', async () => {
      const s = await createSession(validSession({ appointmentId: 'appt-t4' }));
      await updateSessionStatus(s._id, 'in_session');
      const done = await updateSessionStatus(s._id, 'completed', { terminationReason: 'patient_left' });
      expect(done?.terminationReason).toBe('patient_left');
    });
  });

  describe('ratings (KAN-132)', () => {
    it('refuses a second patient rating on the write path', async () => {
      const s = await createSession(validSession({ appointmentId: 'appt-r1' }));
      await rateSession(s._id, 5, 'Great');
      // Enforced server-side, not by hiding the button — the form is on a
      // patient-facing screen, so this is the only place the rule can hold.
      await expect(rateSession(s._id, 1, 'Changed my mind')).rejects.toThrow(AlreadyRatedError);
    });

    it('keeps the provider technical rating separate from patient satisfaction', async () => {
      const s = await createSession(validSession({ appointmentId: 'appt-r2' }));
      await rateSession(s._id, 5, 'Doctor was kind');
      const rated = await rateSessionTechnical(s._id, 2, 'Audio kept dropping');

      // A clinically excellent visit over a terrible line: averaging these
      // together would hide the operational problem entirely.
      expect(rated?.patientRating).toBe(5);
      expect(rated?.providerTechnicalRating).toBe(2);
    });

    it('rejects out-of-range ratings', async () => {
      const s = await createSession(validSession({ appointmentId: 'appt-r3' }));
      await expect(rateSession(s._id, 0)).rejects.toThrow();
      await expect(rateSession(s._id, 6)).rejects.toThrow();
    });

    it('suppresses an average built from too few ratings', async () => {
      const few = [
        { status: 'completed', patientRating: 5 },
        { status: 'completed', patientRating: 1 },
      ] as never[];
      const agg = aggregateRatings(few);

      // Two ratings is one identifiable patient's view of one identifiable
      // clinician. `null` means suppressed, which is not the same as 0.
      expect(agg.suppressed).toBe(true);
      expect(agg.avgPatientRating).toBeNull();
      expect(agg.patientResponses).toBe(2);
    });

    it('reports an average and response rate once the group is large enough', async () => {
      const many = [
        ...Array.from({ length: 5 }, () => ({ status: 'completed', patientRating: 4 })),
        { status: 'completed' },            // completed but unrated
        { status: 'cancelled', patientRating: 1 },  // not eligible
      ] as never[];
      const agg = aggregateRatings(many);

      expect(agg.avgPatientRating).toBe(4);
      expect(agg.suppressed).toBe(false);
      // Denominator is completed visits only — 5 of 6 responded.
      expect(agg.eligible).toBe(6);
      expect(agg.patientResponseRate).toBe(83);
    });
  });
});
