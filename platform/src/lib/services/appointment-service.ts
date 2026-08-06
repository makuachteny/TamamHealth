import { appointmentsDB } from '../db';
import { findByType } from './db-query';
import type { AppointmentDoc, AppointmentStatus, UserRole } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { jubaDate } from '../time-juba';
import { withPendingOfflineSync } from '../sync/offline-metadata';
import { APPOINTMENT_PENDING_STATUSES, APPOINTMENT_SLOT_RELEASED_STATUSES } from '../appointment-status';
import { isTimeOverlap } from '../appointment-time';

export type AppointmentStatusUpdateExtra = {
  cancelledReason?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
  note?: string;
};

const APPOINTMENT_CONFIRM_ROLES: UserRole[] = [
  'central_registration_clerk',
  'clinic_clerk',
  'front_desk',
  'medical_superintendent',
  'org_admin',
  'super_admin',
];

/**
 * Same roster, for the exits: only reception/scheduling can take a visit off
 * the board without it being seen (cancel, no-show). Mirrors
 * canManageAppointmentSchedule in usePermissions.ts — a triage nurse or
 * clinician can advance a visit but has no business closing the book on it.
 */
const APPOINTMENT_EXIT_ROLES: UserRole[] = APPOINTMENT_CONFIRM_ROLES;

/**
 * Who may check a visit out as completed: reception (the front-desk checkout
 * path, which completes a walk-in's appointment) plus every clinical role
 * that can carry a visit to its end. Mirrors canManageAppointmentSchedule ||
 * canAdvanceAppointments in usePermissions.ts.
 */
const APPOINTMENT_COMPLETE_ROLES: UserRole[] = [
  ...APPOINTMENT_CONFIRM_ROLES,
  'doctor',
  'clinical_officer',
  'nurse',
  'midwife',
  'clinician',
  'triage_nurse',
  'rooming_nurse',
];

export async function getAllAppointments(scope?: DataScope): Promise<AppointmentDoc[]> {
  const db = appointmentsDB();
  const all = (await findByType<AppointmentDoc>(db, 'appointment'))
    .sort((a, b) => {
      const dateA = `${a.appointmentDate}T${a.appointmentTime}`;
      const dateB = `${b.appointmentDate}T${b.appointmentTime}`;
      return dateA.localeCompare(dateB);
    });
  return scope ? filterByScope(all, scope) : all;
}

export async function getAppointmentsByDate(date: string, scope?: DataScope): Promise<AppointmentDoc[]> {
  const all = await getAllAppointments(scope);
  return all.filter(a => a.appointmentDate === date);
}

export async function getAppointmentsByPatient(patientId: string): Promise<AppointmentDoc[]> {
  return findByType<AppointmentDoc>(appointmentsDB(), 'appointment', { patientId }, { indexFields: ['type', 'patientId'] });
}

export async function getAppointmentsByProvider(providerId: string): Promise<AppointmentDoc[]> {
  const all = await getAllAppointments();
  return all.filter(a => a.providerId === providerId);
}

export async function getAppointmentsByFacility(facilityId: string): Promise<AppointmentDoc[]> {
  const all = await getAllAppointments();
  return all.filter(a => a.facilityId === facilityId);
}

export async function getUpcomingAppointments(scope?: DataScope): Promise<AppointmentDoc[]> {
  const today = jubaDate();
  const all = await getAllAppointments(scope);
  return all.filter(a =>
    a.appointmentDate >= today &&
    a.status !== 'cancelled' &&
    a.status !== 'completed' &&
    a.status !== 'no_show'
  );
}

export async function getTodaysAppointments(scope?: DataScope): Promise<AppointmentDoc[]> {
  const today = jubaDate();
  return getAppointmentsByDate(today, scope);
}

/** The fields a booking must expose for the conflict guard to judge it. */
interface BookingSlot {
  providerId?: string;
  providerName?: string;
  patientId?: string;
  patientName?: string;
  orgId?: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
}

/** A booking whose status released its slot never counts as a clash. */
function holdsSlot(a: AppointmentDoc): boolean {
  return !APPOINTMENT_SLOT_RELEASED_STATUSES.includes(a.status);
}

/**
 * Thrown by the conflict guard. Its own class so the update/reschedule paths —
 * which swallow infrastructure failures into a null return — can rethrow the
 * one error the desk must actually read.
 */
export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingConflictError';
  }
}

/**
 * The single conflict rule every write path runs through — create, reschedule,
 * field edits that move the slot, and approving a portal request. Throws with
 * a human-readable message the booking surfaces show as-is.
 *
 * Two checks:
 *  - PROVIDER: the doctor cannot be in two visits at once. An empty
 *    providerId (walk-ins booked with no clinician chosen yet) is not a real
 *    provider to collide on. Scoped to the booking's own org so one tenant's
 *    schedule can never block another's — getAppointmentsByProvider() is
 *    unscoped and would match every org.
 *  - PATIENT: the same patient cannot hold two overlapping live bookings —
 *    this is where duplicate appointments were slipping in. Non-overlapping
 *    same-day bookings (a morning lab, an afternoon review) stay legal.
 */
export async function assertNoBookingConflicts(
  data: BookingSlot,
  excludeAppointmentId?: string,
): Promise<void> {
  const overlaps = (a: AppointmentDoc) =>
    a._id !== excludeAppointmentId &&
    a.appointmentDate === data.appointmentDate &&
    holdsSlot(a) &&
    isTimeOverlap(a.appointmentTime, a.duration, data.appointmentTime, data.duration);

  if (data.providerId) {
    const existing = (await getAppointmentsByProvider(data.providerId))
      .filter(a => a.orgId === data.orgId);
    const conflict = existing.find(overlaps);
    if (conflict) {
      throw new BookingConflictError(`Scheduling conflict: ${data.providerName || 'this provider'} already has ${conflict.patientName} at ${conflict.appointmentTime} on ${conflict.appointmentDate}`);
    }
  }

  if (data.patientId) {
    const existing = (await getAppointmentsByPatient(data.patientId))
      .filter(a => a.orgId === data.orgId);
    const duplicate = existing.find(overlaps);
    if (duplicate) {
      throw new BookingConflictError(`Duplicate booking: ${data.patientName || 'this patient'} already has an appointment at ${duplicate.appointmentTime} on ${duplicate.appointmentDate}${duplicate.providerName ? ` with ${duplicate.providerName}` : ''}`);
    }
  }
}

export async function createAppointment(
  data: Omit<AppointmentDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<AppointmentDoc> {
  const db = appointmentsDB();
  const now = new Date().toISOString();

  await assertNoBookingConflicts(data);

  const doc: AppointmentDoc = withPendingOfflineSync({
    _id: `apt-${uuidv4().slice(0, 8)}`,
    type: 'appointment',
    ...data,
    createdAt: now,
    updatedAt: now,
  }, now);
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_APPOINTMENT', data.bookedBy, data.bookedByName,
    `Appointment ${doc._id}: ${data.patientName} with ${data.providerName} on ${data.appointmentDate} at ${data.appointmentTime}`
  );
  emitSyncEvent({
    resourceType: 'appointment',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    orgId: doc.orgId,
    hospitalId: doc.facilityId,
  });
  return doc;
}

/**
 * Fetch one appointment by id, or null when it does not exist.
 *
 * Returns null rather than throwing so callers can branch on absence — the
 * telehealth status sync needs to ask "is this appointment cancelled?" without
 * a missing appointment aborting a completed consultation.
 */
export async function getAppointmentById(id: string): Promise<AppointmentDoc | null> {
  const db = appointmentsDB();
  try {
    return await db.get(id) as AppointmentDoc;
  } catch {
    return null;
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  extra?: AppointmentStatusUpdateExtra
): Promise<AppointmentDoc | null> {
  const db = appointmentsDB();
  try {
    const existing = await db.get(id) as AppointmentDoc;
    const now = new Date().toISOString();
    const actorId = extra?.actorId;
    const actorName = extra?.actorName || extra?.cancelledByName || extra?.cancelledBy;
    if (status === 'confirmed' && extra?.actorRole && !APPOINTMENT_CONFIRM_ROLES.includes(extra.actorRole)) {
      throw new Error('Only reception, scheduling, or administrator roles can confirm appointments');
    }
    // A UI picker gate is not enough on its own — a client that skips it (or a
    // surface that forgot to apply it) could still write these. Cancel/no-show
    // drop the patient off the day's board without being seen, so only
    // reception/scheduling may set them; completing a visit is open to
    // reception's checkout too, plus whichever clinical role actually carried
    // the visit. Both stay silent (fall through to the generic null return
    // below) rather than surfacing the reason, matching the 'confirmed' assert
    // above — callers already treat a null result as "the write didn't happen".
    if ((status === 'cancelled' || status === 'no_show') && extra?.actorRole && !APPOINTMENT_EXIT_ROLES.includes(extra.actorRole)) {
      throw new Error('Only reception, scheduling, or administrator roles can cancel or mark an appointment no-show');
    }
    if (status === 'completed' && extra?.actorRole && !APPOINTMENT_COMPLETE_ROLES.includes(extra.actorRole)) {
      throw new Error('Only reception or the clinical care team can complete an appointment');
    }
    // Approving a portal request turns it into a live booking — and the portal
    // write path deliberately skips the conflict guard (a patient can ask for
    // any slot). The check therefore runs HERE, at the moment reception makes
    // it real, so a request over an occupied slot cannot be waved through.
    if (existing.status === 'requested' && (status === 'scheduled' || status === 'confirmed')) {
      await assertNoBookingConflicts(existing, id);
    }
    const actorPatch = {
      ...(actorId ? { by: actorId } : {}),
      ...(actorName ? { byName: actorName } : {}),
    };
    const statusPatch: Partial<AppointmentDoc> = {};
    const automationNotes: string[] = [];

    if ((status === 'checked_in' || status === 'in_progress' || status === 'completed') && !existing.confirmedAt) {
      statusPatch.confirmedAt = now;
      if (actorId) statusPatch.confirmedBy = actorId;
      if (actorName) statusPatch.confirmedByName = actorName;
      if (existing.status !== 'confirmed') automationNotes.push('Auto-confirmed before arrival workflow');
    }

    if ((status === 'checked_in' || status === 'in_progress' || status === 'completed') && !existing.checkedInAt) {
      statusPatch.checkedInAt = now;
      if (actorId) statusPatch.checkedInBy = actorId;
      if (actorName) statusPatch.checkedInByName = actorName;
      if (status !== 'checked_in') automationNotes.push('Auto-checked in before clinical workflow');
    }

    if ((status === 'in_progress' || status === 'completed') && !existing.startedAt) {
      statusPatch.startedAt = now;
      if (actorId) statusPatch.startedBy = actorId;
      if (actorName) statusPatch.startedByName = actorName;
      if (status !== 'in_progress') automationNotes.push('Auto-started before completion');
    }

    if (status === 'confirmed') {
      statusPatch.confirmedAt = existing.confirmedAt || now;
      if (actorId && !existing.confirmedBy) statusPatch.confirmedBy = actorId;
      if (actorName && !existing.confirmedByName) statusPatch.confirmedByName = actorName;
    }

    if (status === 'cancelled') {
      statusPatch.cancelledAt = now;
      if (actorId) statusPatch.cancelledBy = actorId;
      if (actorName) statusPatch.cancelledByName = actorName;
    }

    if (status === 'completed') {
      statusPatch.completedAt = now;
      if (actorId) statusPatch.completedBy = actorId;
      if (actorName) statusPatch.completedByName = actorName;
    }

    if (status === 'no_show') {
      statusPatch.noShowAt = now;
      if (actorId) statusPatch.noShowBy = actorId;
      if (actorName) statusPatch.noShowByName = actorName;
    }

    const updated: AppointmentDoc = withPendingOfflineSync({
      ...existing,
      status,
      updatedAt: now,
      ...statusPatch,
      ...(extra?.cancelledReason ? { cancelledReason: extra.cancelledReason } : {}),
      ...(extra?.cancelledBy ? { cancelledBy: extra.cancelledBy } : {}),
      ...(extra?.cancelledByName ? { cancelledByName: extra.cancelledByName } : {}),
      statusHistory: [
        ...(existing.statusHistory || []),
        {
          from: existing.status,
          to: status,
          at: now,
          ...actorPatch,
          ...(extra?.note ? { note: extra.note } : {}),
        },
        ...automationNotes.map(note => ({
          from: existing.status,
          to: status,
          at: now,
          ...actorPatch,
          note,
          automated: true,
        })),
      ].slice(-30),
    }, now);
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_APPOINTMENT', actorId, actorName, `Appointment ${id} status changed from ${existing.status} to ${status}`);
    emitSyncEvent({
      resourceType: 'appointment',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.facilityId,
    });
    return updated;
  } catch (err) {
    if (err instanceof BookingConflictError) throw err;
    return null;
  }
}

export async function updateAppointment(
  id: string,
  updates: Partial<AppointmentDoc>
): Promise<AppointmentDoc | null> {
  const db = appointmentsDB();
  try {
    const existing = await db.get(id) as AppointmentDoc;
    // An edit that moves the slot or changes whose it is re-runs the same
    // guard a fresh booking gets — the edit modal was the open back door
    // through which a doctor could be double-booked.
    const movesSlot = ['appointmentDate', 'appointmentTime', 'duration', 'providerId', 'providerName']
      .some(key => key in updates && updates[key as keyof AppointmentDoc] !== existing[key as keyof AppointmentDoc]);
    if (movesSlot) {
      await assertNoBookingConflicts({ ...existing, ...updates }, id);
    }
    const updated = withPendingOfflineSync({ ...existing, ...updates, updatedAt: new Date().toISOString() });
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_APPOINTMENT', undefined, undefined, `Appointment ${id} updated`);
    emitSyncEvent({
      resourceType: 'appointment',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.facilityId,
    });
    return updated;
  } catch (err) {
    if (err instanceof BookingConflictError) throw err;
    return null;
  }
}

export async function rescheduleAppointment(
  id: string,
  newDate: string,
  newTime: string
): Promise<AppointmentDoc | null> {
  const db = appointmentsDB();
  try {
    const existing = await db.get(id) as AppointmentDoc;
    // Moving a booking must clear the same bar as making one — the target
    // slot may already hold this doctor or this patient.
    await assertNoBookingConflicts(
      { ...existing, appointmentDate: newDate, appointmentTime: newTime },
      id,
    );
    const updated = withPendingOfflineSync({
      ...existing,
      appointmentDate: newDate,
      appointmentTime: newTime,
      status: 'scheduled' as const,
      updatedAt: new Date().toISOString(),
    });
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('RESCHEDULE_APPOINTMENT', undefined, undefined,
      `Appointment ${id} rescheduled to ${newDate} at ${newTime}`
    );
    emitSyncEvent({
      resourceType: 'appointment',
      resourceId: updated._id,
      operation: 'update',
      resourceVersion: updated._rev,
      orgId: updated.orgId,
      hospitalId: updated.facilityId,
    });
    return updated;
  } catch (err) {
    if (err instanceof BookingConflictError) throw err;
    return null;
  }
}

// Appointment statistics for dashboards
export async function getAppointmentStats(scope?: DataScope) {
  const all = await getAllAppointments(scope);
  const today = jubaDate();
  const todayAppts = all.filter(a => a.appointmentDate === today);
  const upcoming = all.filter(a => a.appointmentDate > today && a.status !== 'cancelled');
  const completed = all.filter(a => a.status === 'completed');
  const noShows = all.filter(a => a.status === 'no_show');
  const cancelled = all.filter(a => a.status === 'cancelled');

  return {
    total: all.length,
    todayTotal: todayAppts.length,
    todayCompleted: todayAppts.filter(a => a.status === 'completed').length,
    // Pending = the patient is still expected: booked, reminded, confirmed, or
    // arrived but not yet checked in.
    todayPending: todayAppts.filter(a => APPOINTMENT_PENDING_STATUSES.includes(a.status)).length,
    todayInProgress: todayAppts.filter(a => a.status === 'in_progress' || a.status === 'checked_in').length,
    upcoming: upcoming.length,
    completedTotal: completed.length,
    noShowTotal: noShows.length,
    cancelledTotal: cancelled.length,
    completionRate: all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0,
    noShowRate: all.length > 0 ? Math.round((noShows.length / all.length) * 100) : 0,
    byType: groupBy(all, 'appointmentType'),
    byDepartment: groupBy(all, 'department'),
  };
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = String(item[key] || 'unknown');
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}
