/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for telehealth-reconciliation.ts (KAN-143, KAN-144).
 *
 * The sweep exists to catch drift between an appointment and its session, so
 * these tests care mostly about the cases where the two disagree — and about
 * the cases where they only LOOK like they disagree, since a reconciliation
 * report full of false findings is worse than no report at all.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-tele-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());
jest.mock('@/lib/services/appointment-service', () => ({
  updateAppointmentStatus: jest.fn().mockResolvedValue(null),
  getAppointmentById: jest.fn().mockResolvedValue(null),
}));

import { teardownTestDBs } from '../helpers/test-db';
import { jubaDate } from '@/lib/time-juba';
import { createSession, updateSessionStatus, updateSession, getSessionById } from '@/lib/services/telehealth-service';
import {
  reconcileTelehealth,
  expireStaleSessions,
  NO_SHOW_GRACE_MS,
  ABANDONED_AFTER_MS,
} from '@/lib/services/telehealth-reconciliation';
import type { AppointmentDoc } from '@/lib/db-types';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

type CreateSessionInput = Parameters<typeof createSession>[0];

function session(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    patientId: 'pat-001',
    patientName: 'John Doe',
    providerId: 'prov-001',
    providerName: 'Dr. Smith',
    providerRole: 'doctor',
    facilityId: 'hosp-001',
    facilityName: 'Test Hospital',
    orgId: 'org-001',
    state: 'Central Equatoria',
    sessionType: 'video',
    scheduledDate: jubaDate(),
    scheduledTime: '09:00',
    status: 'scheduled',
    chiefComplaint: 'Follow-up',
    followUpRequired: false,
    referralRequired: false,
    // Consented, because these fixtures drive sessions to `in_session` and
    // admission is now gated on consent (KAN-125). A real in-progress visit
    // always has a consent record behind it, so this makes the fixture more
    // faithful rather than working around the gate.
    patientConsentGiven: true,
    consentMethod: 'patient_portal',
    consentedBy: 'pat-001',
    sessionRecorded: false,
    connectionDrops: 0,
    ...overrides,
  } as CreateSessionInput;
}

function appointment(overrides: Partial<AppointmentDoc> = {}): AppointmentDoc {
  return {
    _id: 'appt-1',
    type: 'appointment',
    appointmentType: 'telehealth',
    status: 'scheduled',
    orgId: 'org-001',
    ...overrides,
  } as AppointmentDoc;
}

describe('expireStaleSessions (KAN-144)', () => {
  it('marks a session that was never joined as no_show once the grace window passes', async () => {
    const s = await createSession(session({ appointmentId: 'appt-ns' }));
    const wellPast = Date.parse(`${s.scheduledDate}T${s.scheduledTime}`) + NO_SHOW_GRACE_MS + 60_000;

    const findings = await expireStaleSessions(wellPast);

    // Nothing wrote `no_show` before this job existed, so the whole
    // session→appointment no_show mapping never fired.
    expect(findings).toHaveLength(1);
    expect((await getSessionById(s._id))?.status).toBe('no_show');
    expect((await getSessionById(s._id))?.terminationReason).toBe('no_show');
  });

  it('leaves a late-but-within-grace session alone', async () => {
    const s = await createSession(session({ appointmentId: 'appt-late' }));
    const slightlyLate = Date.parse(`${s.scheduledDate}T${s.scheduledTime}`) + 40 * 60 * 1000;

    expect(await expireStaleSessions(slightlyLate)).toHaveLength(0);
    // A patient reconnecting 40 minutes late kept their appointment; a false
    // no-show would go on their record and close the appointment.
    expect((await getSessionById(s._id))?.status).toBe('scheduled');
  });

  it('closes a joined-but-never-ended session as abandoned', async () => {
    const s = await createSession(session({ appointmentId: 'appt-ab' }));
    await updateSessionStatus(s._id, 'in_session');
    const started = Date.parse((await getSessionById(s._id))!.actualStartTime!);

    const findings = await expireStaleSessions(started + ABANDONED_AFTER_MS + 60_000);

    expect(findings).toHaveLength(1);
    const closed = await getSessionById(s._id);
    // `failed`, not `completed` — a consultation nobody closed did not
    // necessarily happen, and completed would count it as delivered care.
    expect(closed?.status).toBe('failed');
    expect(closed?.terminationReason).toBe('abandoned');
    // Without this, the visit stays `in_session` forever and every dashboard
    // counts it as an active consultation.
    expect(typeof closed?.duration).toBe('number');
  });

  it('dates an abandoned session from last activity, not from when the job ran', async () => {
    const s = await createSession(session({ appointmentId: 'appt-dur' }));
    await updateSessionStatus(s._id, 'in_session');
    const live = (await getSessionById(s._id))!;
    const started = Date.parse(live.actualStartTime!);

    // Sweep runs a long time after the session went quiet.
    await expireStaleSessions(started + ABANDONED_AFTER_MS * 4);

    const closed = await getSessionById(s._id);
    // Using job-run time would report this as a multi-hour consultation. The
    // end time is the record's last known activity instead.
    expect(Date.parse(closed!.actualEndTime!)).toBeLessThan(started + ABANDONED_AFTER_MS);
    expect(closed!.duration).toBeLessThan(ABANDONED_AFTER_MS / 60000);
  });

  it('never destroys clinical information while closing a session', async () => {
    // KAN-144 item 6. This is the failure mode that would be unrecoverable:
    // a cleanup job that treats an abandoned visit as disposable and takes
    // the consultation note with it.
    const s = await createSession(session({ appointmentId: 'appt-notes' }));
    await updateSessionStatus(s._id, 'in_session');
    await updateSession(s._id, {
      clinicalNotes: 'Patient reports chest pain radiating to left arm.',
      diagnosis: 'Suspected angina',
    });
    const started = Date.parse((await getSessionById(s._id))!.actualStartTime!);

    await expireStaleSessions(started + ABANDONED_AFTER_MS + 60_000);

    const closed = await getSessionById(s._id);
    expect(closed?.clinicalNotes).toBe('Patient reports chest pain radiating to left arm.');
    expect(closed?.diagnosis).toBe('Suspected angina');
  });

  it('does not touch an already-closed session', async () => {
    const s = await createSession(session({ appointmentId: 'appt-done' }));
    await updateSessionStatus(s._id, 'in_session');
    await updateSessionStatus(s._id, 'completed');

    expect(await expireStaleSessions(Date.now() + ABANDONED_AFTER_MS * 10)).toHaveLength(0);
  });
});

describe('reconcileTelehealth (KAN-143)', () => {
  it('reports a telehealth appointment that has no session', async () => {
    const report = await reconcileTelehealth([appointment({ _id: 'appt-orphan' })], { repair: false });
    expect(report.findings.map(f => f.kind)).toContain('appointment_without_session');
  });

  it('does NOT report an in-person appointment with no session', async () => {
    // The failure mode this guards: every routine clinic booking reported as a
    // missing telehealth session, burying the real findings.
    const report = await reconcileTelehealth(
      [appointment({ _id: 'appt-inperson', appointmentType: 'general' })],
      { repair: false },
    );
    expect(report.findings).toHaveLength(0);
  });

  it('reports a session whose appointment no longer exists', async () => {
    await createSession(session({ appointmentId: 'appt-gone' }));
    const report = await reconcileTelehealth([], { repair: false });
    expect(report.findings.map(f => f.kind)).toContain('session_without_appointment');
  });

  it('cancels a live session whose appointment was cancelled', async () => {
    const s = await createSession(session({ appointmentId: 'appt-1' }));
    const report = await reconcileTelehealth([appointment({ status: 'cancelled' })]);

    expect(report.findings.map(f => f.kind)).toContain('cancelled_appointment_live_session');
    expect((await getSessionById(s._id))?.status).toBe('cancelled');
    expect(report.repaired).toBeGreaterThan(0);
  });

  it('reports status divergence without silently rewriting either record', async () => {
    const s = await createSession(session({ appointmentId: 'appt-1' }));
    await updateSessionStatus(s._id, 'in_session');
    // Session says in_progress; appointment still says scheduled.
    const report = await reconcileTelehealth([appointment({ status: 'scheduled' })], { repair: false });

    const divergence = report.findings.find(f => f.kind === 'status_divergence');
    expect(divergence).toBeDefined();
    // Reported, not repaired — which of the two is right is not obvious.
    expect(divergence?.repaired).toBe(false);
  });

  it('is a no-op on a consistent pair', async () => {
    const s = await createSession(session({ appointmentId: 'appt-1' }));
    await updateSessionStatus(s._id, 'in_session');
    const report = await reconcileTelehealth([appointment({ status: 'in_progress' })], { repair: false });
    expect(report.findings).toHaveLength(0);
  });

  it('counts what it scanned', async () => {
    await createSession(session({ appointmentId: 'appt-1' }));
    const report = await reconcileTelehealth([appointment()], { repair: false });
    expect(report.scannedSessions).toBe(1);
    expect(report.scannedAppointments).toBe(1);
  });
});
