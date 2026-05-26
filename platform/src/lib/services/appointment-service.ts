import { appointmentsDB } from '../db';
import type { AppointmentDoc, AppointmentStatus } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { jubaDate } from '../time-juba';

export async function getAllAppointments(scope?: DataScope): Promise<AppointmentDoc[]> {
  const db = appointmentsDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as AppointmentDoc)
    .filter(d => d && d.type === 'appointment')
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
  const all = await getAllAppointments();
  return all.filter(a => a.patientId === patientId);
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
  return doc;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  extra?: { cancelledReason?: string; cancelledBy?: string }
): Promise<AppointmentDoc | null> {
  const db = appointmentsDB();
  try {
    const existing = await db.get(id) as AppointmentDoc;
    const now = new Date().toISOString();
    const updated: AppointmentDoc = {
      ...existing,
      status,
      updatedAt: now,
      ...(status === 'checked_in' ? { checkedInAt: now } : {}),
      ...(status === 'completed' ? { completedAt: now } : {}),
      ...(extra || {}),
    };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    await logAuditSafe('UPDATE_APPOINTMENT', undefined, undefined, `Appointment ${id} status changed to ${status}`);
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
