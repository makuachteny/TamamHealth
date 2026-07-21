import { appointmentsDB } from '../db';
import { findByType } from './db-query';
import type { AppointmentDoc, AppointmentStatus, UserRole } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';
import { jubaDate } from '../time-juba';

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
  'facility_administrator',
  'org_admin',
  'super_admin',
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

export async function createAppointment(
  data: Omit<AppointmentDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>
): Promise<AppointmentDoc> {
  const db = appointmentsDB();
  const now = new Date().toISOString();

  // Check for scheduling conflicts
  const existing = await getAppointmentsByProvider(data.providerId);
  const conflict = existing.find(a =>
    a.appointmentDate === data.appointmentDate &&
    a.status !== 'cancelled' &&
    a.status !== 'no_show' &&
    isTimeOverlap(a.appointmentTime, a.duration, data.appointmentTime, data.duration)
  );
  if (conflict) {
    throw new Error(`Scheduling conflict: ${data.providerName} already has an appointment at ${conflict.appointmentTime} on ${conflict.appointmentDate}`);
  }

  const doc: AppointmentDoc = {
    _id: `apt-${uuidv4().slice(0, 8)}`,
    type: 'appointment',
    ...data,
    createdAt: now,
    updatedAt: now,
  };
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

    const updated: AppointmentDoc = {
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
    };
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
  } catch {
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
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
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
  } catch {
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
    const updated = {
      ...existing,
      appointmentDate: newDate,
      appointmentTime: newTime,
      status: 'scheduled' as const,
      updatedAt: new Date().toISOString(),
    };
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
  } catch {
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
    todayPending: todayAppts.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length,
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

// Helper: check time overlap
function isTimeOverlap(startA: string, durationA: number, startB: string, durationB: number): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const a1 = toMinutes(startA);
  const a2 = a1 + durationA;
  const b1 = toMinutes(startB);
  const b2 = b1 + durationB;
  return a1 < b2 && b1 < a2;
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = String(item[key] || 'unknown');
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}
