import { telehealthDB } from '../db';
import type { AppointmentStatus, TelehealthSessionDoc, TelehealthStatus } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { findByType } from './db-query';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { jubaDate } from '../time-juba';

export async function getAllSessions(scope?: DataScope): Promise<TelehealthSessionDoc[]> {
  const db = telehealthDB();
  const all = (await findByType<TelehealthSessionDoc>(db, 'telehealth_session'))
    .sort((a, b) => {
      const dateA = `${a.scheduledDate}T${a.scheduledTime}`;
      const dateB = `${b.scheduledDate}T${b.scheduledTime}`;
      return dateB.localeCompare(dateA); // Most recent first
    });
  return scope ? filterByScope(all, scope) : all;
}

export async function getSessionsByPatient(patientId: string): Promise<TelehealthSessionDoc[]> {
  const all = await getAllSessions();
  return all.filter(s => s.patientId === patientId);
}

export async function getSessionsByProvider(providerId: string): Promise<TelehealthSessionDoc[]> {
  const all = await getAllSessions();
  return all.filter(s => s.providerId === providerId);
}

export async function getUpcomingSessions(scope?: DataScope): Promise<TelehealthSessionDoc[]> {
  const today = jubaDate();
  const all = await getAllSessions(scope);
  return all
    .filter(s =>
      s.scheduledDate >= today &&
      s.status !== 'cancelled' &&
      s.status !== 'completed' &&
      s.status !== 'failed'
    )
    .sort((a, b) => {
      const dateA = `${a.scheduledDate}T${a.scheduledTime}`;
      const dateB = `${b.scheduledDate}T${b.scheduledTime}`;
      return dateA.localeCompare(dateB);
    });
}

export async function getTodaysSessions(scope?: DataScope): Promise<TelehealthSessionDoc[]> {
  const today = jubaDate();
  const all = await getAllSessions(scope);
  return all.filter(s => s.scheduledDate === today);
}

export async function createSession(
  data: Omit<TelehealthSessionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'roomId'>
): Promise<TelehealthSessionDoc> {
  const db = telehealthDB();
  const now = new Date().toISOString();
  const roomId = `tamamhealth-${uuidv4().slice(0, 12)}`;

  const doc: TelehealthSessionDoc = {
    _id: `tele-${uuidv4().slice(0, 8)}`,
    type: 'telehealth_session',
    roomId,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_TELEHEALTH', data.providerId, data.providerName,
    `Telehealth session ${doc._id}: ${data.patientName} with ${data.providerName} on ${data.scheduledDate} at ${data.scheduledTime}`
  );
  emitSyncEvent({
    resourceType: 'telehealth_session',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });
  return doc;
}

export async function updateSessionStatus(
  id: string,
  status: TelehealthStatus,
  extra?: Partial<TelehealthSessionDoc>
): Promise<TelehealthSessionDoc | null> {
  const db = telehealthDB();
  try {
    const existing = await db.get(id) as TelehealthSessionDoc;
    const now = new Date().toISOString();
    const updated: TelehealthSessionDoc = {
      ...existing,
      status,
      updatedAt: now,
      ...(status === 'in_session' ? { actualStartTime: now } : {}),
      ...(status === 'completed' ? { actualEndTime: now } : {}),
      ...(extra || {}),
    };

    // Calculate duration if completing
    if (status === 'completed' && updated.actualStartTime) {
      const start = new Date(updated.actualStartTime).getTime();
      const end = new Date(now).getTime();
      updated.duration = Math.round((end - start) / 60000);
    }

    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_TELEHEALTH', undefined, undefined, `Telehealth session ${id} status changed to ${status}`);
    emitSyncEvent({
      resourceType: 'telehealth_session',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.facilityId,
    });

    // Keep the originating appointment in step. Without this a telehealth
    // visit could run to completion while its appointment still read
    // "scheduled" — the front desk would show the patient as never seen, and
    // the appointment would eventually age into a false no-show.
    await syncAppointmentToSessionStatus(updated, status);

    return updated;
  } catch {
    return null;
  }
}

/**
 * Mirror a telehealth session's lifecycle onto its linked appointment.
 *
 * Only the transitions that have an unambiguous appointment meaning are
 * mapped. `waiting_room` deliberately maps to `checked_in`: the patient has
 * presented for their appointment but the clinician has not started, which is
 * exactly what checked-in means at a physical front desk.
 *
 * Best-effort and non-fatal — the session record is the source of truth for
 * the visit itself, and failing to update the appointment must not roll back a
 * completed consultation.
 */
async function syncAppointmentToSessionStatus(
  session: TelehealthSessionDoc,
  status: TelehealthStatus,
): Promise<void> {
  if (!session.appointmentId) return;

  const mapped: Partial<Record<TelehealthStatus, AppointmentStatus>> = {
    waiting_room: 'checked_in',
    in_session: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled',
    no_show: 'no_show',
  };
  const next = mapped[status];
  if (!next) return;

  try {
    const { updateAppointmentStatus } = await import('./appointment-service');
    await updateAppointmentStatus(session.appointmentId, next);
  } catch (err) {
    console.warn(
      `[telehealth] could not sync appointment ${session.appointmentId} to ${next}`,
      err,
    );
  }
}

export async function updateSession(
  id: string,
  updates: Partial<TelehealthSessionDoc>
): Promise<TelehealthSessionDoc | null> {
  const db = telehealthDB();
  try {
    const existing = await db.get(id) as TelehealthSessionDoc;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_TELEHEALTH', undefined, undefined, `Telehealth session ${id} updated`);
    emitSyncEvent({
      resourceType: 'telehealth_session',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.facilityId,
    });
    return updated;
  } catch {
    return null;
  }
}

/**
 * Record that consent to the telehealth encounter was obtained, and on what basis.
 *
 * Consent is deliberately NOT a plain boolean setter. `patientConsentGiven`
 * alone says a patient agreed but not who recorded it or how, which is not a
 * defensible record — and the provider room previously set it to `true`
 * automatically at session creation, fabricating an affirmative consent
 * record, complete with timestamp, for a patient nobody had asked.
 *
 * Every consent write therefore carries its provenance:
 *   - `patient_portal`           the patient themselves affirmed it
 *   - `provider_attested_verbal` a named clinician is attesting they asked
 *   - `written`                  a signed form exists on file
 *
 * The audit line names the attesting user, because the point of an attestation
 * is that it is attributable to a person.
 */
export async function recordConsent(
  id: string,
  consent: {
    method: NonNullable<TelehealthSessionDoc['consentMethod']>;
    attestedBy?: string;
    attestedByName?: string;
  },
): Promise<TelehealthSessionDoc | null> {
  if (consent.method === 'provider_attested_verbal' && !consent.attestedBy) {
    // Refuse rather than silently store an unattributable attestation — an
    // attestation with no attester is exactly the record we are removing.
    throw new Error('provider_attested_verbal consent requires attestedBy (the clinician\'s user id)');
  }

  const updated = await updateSession(id, {
    patientConsentGiven: true,
    consentTimestamp: new Date().toISOString(),
    consentMethod: consent.method,
    consentAttestedBy: consent.attestedBy,
    consentAttestedByName: consent.attestedByName,
  });

  if (updated) {
    await logAuditSafe(
      'TELEHEALTH_CONSENT_RECORDED',
      undefined,
      consent.attestedByName,
      `Telehealth consent recorded for session ${id} — method: ${consent.method}` +
      (consent.attestedByName ? `, attested by ${consent.attestedByName}` : ''),
    );
  }
  return updated;
}

export async function addClinicalNotes(
  id: string,
  notes: string,
  diagnosis?: string,
  icd10Code?: string
): Promise<TelehealthSessionDoc | null> {
  return updateSession(id, { clinicalNotes: notes, diagnosis, icd10Code });
}

export async function rateSession(
  id: string,
  rating: number,
  feedback?: string
): Promise<TelehealthSessionDoc | null> {
  return updateSession(id, { patientRating: rating, patientFeedback: feedback });
}

// Statistics for dashboards
export async function getTelehealthStats(scope?: DataScope) {
  const all = await getAllSessions(scope);
  const today = jubaDate();
  const todaySessions = all.filter(s => s.scheduledDate === today);
  const completed = all.filter(s => s.status === 'completed');
  const ratings = completed.filter(s => s.patientRating).map(s => s.patientRating!);

  return {
    total: all.length,
    todayTotal: todaySessions.length,
    todayActive: todaySessions.filter(s => s.status === 'in_session' || s.status === 'waiting_room').length,
    todayCompleted: todaySessions.filter(s => s.status === 'completed').length,
    completedTotal: completed.length,
    cancelledTotal: all.filter(s => s.status === 'cancelled').length,
    failedTotal: all.filter(s => s.status === 'failed').length,
    avgDuration: completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + (s.duration || 0), 0) / completed.length)
      : 0,
    avgRating: ratings.length > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
      : 0,
    avgConnectionDrops: completed.length > 0
      ? Math.round((completed.reduce((sum, s) => sum + s.connectionDrops, 0) / completed.length) * 10) / 10
      : 0,
    byType: { video: 0, audio: 0, chat: 0 },
    followUpRate: completed.length > 0
      ? Math.round((completed.filter(s => s.followUpRequired).length / completed.length) * 100)
      : 0,
  };
}
