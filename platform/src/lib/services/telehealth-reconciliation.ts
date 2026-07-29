/**
 * Telehealth reconciliation and expiry (KAN-143, KAN-144).
 *
 * ## Why this exists
 *
 * A telehealth visit is recorded in two places — an `AppointmentDoc` and a
 * `TelehealthSessionDoc` — and the write that keeps them in step is
 * deliberately best-effort, because rolling back a completed consultation
 * because an appointment write failed would be the worse outcome (KAN-127).
 * That trade is right, but it means the two records CAN drift, and until now
 * nothing ever noticed. A silently dropped completion leaves an appointment
 * open forever; it ages into a false no-show and reports as activity that
 * never happened.
 *
 * This module is the sweep that finds those. It is deliberately a *reporter*
 * first and a repairer second: every divergence it can describe is returned,
 * and only the unambiguous ones are fixed automatically.
 *
 * ## What it will not do
 *
 * It does not merge duplicate sessions. Pre-existing duplicates (from before
 * the deterministic ids in KAN-126) are reported for a human to merge, because
 * choosing which of two real consultations to discard is not a decision code
 * should make silently.
 */

import type { AppointmentDoc, AppointmentStatus, TelehealthSessionDoc, TelehealthStatus } from '../db-types';
import { getAllSessions, updateSessionStatus, sessionIdForAppointment } from './telehealth-service';
import { logAuditSafe } from './audit-service';

/** A single divergence found by the sweep. */
export interface ReconciliationFinding {
  kind:
    | 'appointment_without_session'
    | 'session_without_appointment'
    | 'cancelled_appointment_live_session'
    | 'status_divergence'
    | 'duplicate_sessions'
    | 'abandoned_session';
  sessionId?: string;
  appointmentId?: string;
  detail: string;
  /** Whether this sweep changed anything to resolve the finding. */
  repaired: boolean;
}

export interface ReconciliationReport {
  scannedSessions: number;
  scannedAppointments: number;
  findings: ReconciliationFinding[];
  repaired: number;
}

/**
 * How long a session may sit un-joined past its scheduled time before it is
 * treated as a no-show.
 *
 * Two hours, not minutes: connectivity in the facilities this runs in is
 * intermittent, and a patient who reconnects 40 minutes late has still kept
 * their appointment. Marking them absent would put a false no-show on their
 * record and, through the KAN-127 status mapping, close the appointment.
 */
export const NO_SHOW_GRACE_MS = 2 * 60 * 60 * 1000;

/**
 * How long a session that was joined but never closed stays open before it is
 * treated as abandoned. Sessions do not end cleanly when a browser is closed
 * or a connection dies, so without this they stay `in_session` forever and are
 * counted as active visits on every dashboard.
 */
export const ABANDONED_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * How long a patient may sit in the waiting room, un-admitted, before the
 * session is closed as abandoned (KAN-128).
 *
 * Ninety minutes rather than the ticket's suggested twenty: a busy clinic runs
 * over, and closing a session out from under a clinician who was about to take
 * it would be worse than a long wait. It is measured from the patient's
 * recorded arrival, so it bounds the wait itself rather than the slot — a
 * patient who arrives an hour early is not penalised for it.
 */
export const ABANDONED_WAIT_MS = 90 * 60 * 1000;

/** Statuses that are still "open" and therefore eligible for expiry. */
const OPEN_STATUSES: readonly TelehealthStatus[] = ['scheduled', 'waiting_room', 'in_session'];

/** The scheduled start of a session as an epoch milliseconds value. */
function scheduledAt(session: TelehealthSessionDoc): number {
  // Stored as local date + time strings; `Date.parse` of the combined value is
  // consistent with how the rest of the app reads these fields.
  const parsed = Date.parse(`${session.scheduledDate}T${session.scheduledTime || '00:00'}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Find sessions that should have ended but never did, and close them.
 *
 * `now` is injected rather than read from the clock so the behaviour is
 * testable without freezing time globally.
 */
export async function expireStaleSessions(now: number = Date.now(), excludedAppointmentIds?: Set<string>): Promise<ReconciliationFinding[]> {
  const findings: ReconciliationFinding[] = [];
  const sessions = await getAllSessions();

  for (const s of sessions) {
    if (!OPEN_STATUSES.includes(s.status)) continue;
    if (s.appointmentId && excludedAppointmentIds?.has(s.appointmentId)) continue;
    const due = scheduledAt(s);
    if (!due) continue;

    // Waited but was never admitted (KAN-128). NOT a no-show: the patient
    // turned up, and the visit failed on the clinic's side. Recording it
    // against them would put a false missed-appointment on a patient record,
    // which is the kind of error that follows someone through a health system
    // and is never corrected.
    //
    // Checked BEFORE the no-show branch, because such a session also has no
    // `actualStartTime` and would otherwise be swept up by it.
    if (!s.actualStartTime && s.waitingSince) {
      const waited = Date.parse(s.waitingSince);
      if (!Number.isNaN(waited) && now - waited > ABANDONED_WAIT_MS) {
        await updateSessionStatus(s._id, 'failed', {
          terminationReason: 'abandoned',
          actualEndTime: s.waitingSince,
        });
        findings.push({
          kind: 'abandoned_session',
          sessionId: s._id,
          appointmentId: s.appointmentId,
          detail: `Patient waited from ${s.waitingSince} and was never admitted. Marked failed/abandoned, NOT no_show.`,
          repaired: true,
        });
        continue;
      }
      // Still inside the grace period — leave them waiting rather than closing
      // a session the clinician may yet pick up.
      continue;
    }

    // Never joined, well past its slot → no-show. This is the writer the
    // `no_show` → `no_show` appointment mapping has been waiting for; nothing
    // set that status before, so the mapping never fired.
    if (!s.actualStartTime && now - due > NO_SHOW_GRACE_MS) {
      await updateSessionStatus(s._id, 'no_show', { terminationReason: 'no_show' });
      findings.push({
        kind: 'abandoned_session',
        sessionId: s._id,
        appointmentId: s.appointmentId,
        detail: `Never joined; scheduled ${s.scheduledDate} ${s.scheduledTime}. Marked no_show.`,
        repaired: true,
      });
      continue;
    }

    // Joined but never closed → abandoned. Measured from the actual start, not
    // the scheduled slot: a visit that legitimately began late should get its
    // full window before being closed out from under the clinician.
    if (s.actualStartTime) {
      const started = Date.parse(s.actualStartTime);
      if (!Number.isNaN(started) && now - started > ABANDONED_AFTER_MS) {
        // `failed`, not `completed`. A consultation nobody closed did not
        // necessarily happen, and recording it as completed would let an
        // abandoned visit count as delivered care.
        //
        // The end time is the last known ACTIVITY on the record, not the
        // moment this job happened to run. Using job-run time would inflate
        // every abandoned session's duration by however long it took the
        // sweep to notice — a session abandoned at 09:10 and swept at 18:00
        // would report as an 8-hour consultation.
        await updateSessionStatus(s._id, 'failed', {
          terminationReason: 'abandoned',
          actualEndTime: s.updatedAt || s.actualStartTime,
        });
        findings.push({
          kind: 'abandoned_session',
          sessionId: s._id,
          appointmentId: s.appointmentId,
          detail: `Open since ${s.actualStartTime}, last activity ${s.updatedAt || 'unknown'}. Marked failed/abandoned.`,
          repaired: true,
        });
      }
    }
  }

  return findings;
}

/**
 * Compare appointments against sessions and report every divergence.
 *
 * Appointments are passed in rather than fetched so the caller controls the
 * scope of the sweep — running this across every organisation at once is not
 * something this module should decide.
 */
export async function reconcileTelehealth(
  appointments: AppointmentDoc[],
  options: { now?: number; repair?: boolean } = {},
): Promise<ReconciliationReport> {
  const { now = Date.now(), repair = true } = options;
  const findings: ReconciliationFinding[] = [];

  const cancelledAppointmentIds = new Set(
    appointments.filter(appointment => appointment.status === 'cancelled').map(appointment => appointment._id),
  );
  if (repair) findings.push(...await expireStaleSessions(now, cancelledAppointmentIds));

  const sessions = await getAllSessions();
  const byAppointment = new Map<string, TelehealthSessionDoc[]>();
  for (const s of sessions) {
    if (!s.appointmentId) continue;
    const list = byAppointment.get(s.appointmentId) || [];
    list.push(s);
    byAppointment.set(s.appointmentId, list);
  }

  // More than one session for an appointment — only possible for records that
  // predate the deterministic ids. Reported, never merged automatically.
  for (const [appointmentId, list] of byAppointment) {
    if (list.length > 1) {
      findings.push({
        kind: 'duplicate_sessions',
        appointmentId,
        detail:
          `${list.length} sessions share appointment ${appointmentId} (${list.map(s => s._id).join(', ')}). ` +
          `Expected id ${sessionIdForAppointment(appointmentId)}. Needs manual merge.`,
        repaired: false,
      });
    }
  }

  const appointmentById = new Map(appointments.map(a => [a._id, a]));

  for (const a of appointments) {
    const linked = byAppointment.get(a._id);
    if (!linked || linked.length === 0) {
      // Only a telehealth appointment is expected to have a session; an
      // in-person one having none is normal, not a finding.
      if (isTelehealthAppointment(a)) {
        findings.push({
          kind: 'appointment_without_session',
          appointmentId: a._id,
          detail: `Telehealth appointment ${a._id} (${a.status}) has no session.`,
          repaired: false,
        });
      }
    }
  }

  for (const s of sessions) {
    if (!s.appointmentId) continue;
    const appointment = appointmentById.get(s.appointmentId);

    if (!appointment) {
      findings.push({
        kind: 'session_without_appointment',
        sessionId: s._id,
        appointmentId: s.appointmentId,
        detail: `Session ${s._id} references appointment ${s.appointmentId}, which does not exist.`,
        repaired: false,
      });
      continue;
    }

    // A cancelled appointment with a session still live is the case the
    // KAN-127 guard prevents going forward; this catches the ones already in
    // the data.
    if (appointment.status === 'cancelled' && OPEN_STATUSES.includes(s.status)) {
      if (repair) {
        await updateSessionStatus(s._id, 'cancelled', { terminationReason: 'cancelled' });
      }
      findings.push({
        kind: 'cancelled_appointment_live_session',
        sessionId: s._id,
        appointmentId: s.appointmentId,
        detail: `Appointment cancelled but session was ${s.status}.`,
        repaired: repair,
      });
      continue;
    }

    const expected = APPOINTMENT_FOR_SESSION[s.status];
    if (expected && appointment.status !== expected) {
      findings.push({
        kind: 'status_divergence',
        sessionId: s._id,
        appointmentId: s.appointmentId,
        detail: `Session is ${s.status} (implies appointment ${expected}) but appointment is ${appointment.status}.`,
        repaired: false,
      });
    }
  }

  if (findings.length > 0) {
    await logAuditSafe(
      'TELEHEALTH_RECONCILIATION',
      undefined,
      undefined,
      `Reconciliation found ${findings.length} divergence(s): ` +
      findings.map(f => f.kind).join(', '),
    );
  }

  return {
    scannedSessions: sessions.length,
    scannedAppointments: appointments.length,
    findings,
    repaired: findings.filter(f => f.repaired).length,
  };
}

/**
 * The appointment status each session status implies.
 *
 * Kept in step with the mapping in `telehealth-service.syncAppointmentToSessionStatus`
 * — this module detects where that mapping failed to land, so it has to encode
 * the same expectation.
 */
const APPOINTMENT_FOR_SESSION: Partial<Record<TelehealthStatus, AppointmentStatus>> = {
  waiting_room: 'checked_in',
  in_session: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

/**
 * Whether an appointment is a telehealth visit and so should have a session.
 *
 * An in-person appointment having no session is normal, not a divergence —
 * without this check every routine clinic booking would be reported as a
 * missing telehealth session and bury the real findings.
 */
function isTelehealthAppointment(a: AppointmentDoc): boolean {
  return a.appointmentType === 'telehealth';
}
