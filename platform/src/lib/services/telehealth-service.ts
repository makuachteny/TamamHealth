import { telehealthDB } from '../db';
import type { TelehealthSessionDoc, TelehealthStatus } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { jubaDate } from '../time-juba';

export async function getAllSessions(scope?: DataScope): Promise<TelehealthSessionDoc[]> {
  const db = telehealthDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as TelehealthSessionDoc)
    .filter(d => d && d.type === 'telehealth_session')
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
    return updated;
  } catch {
    return null;
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
    return updated;
  } catch {
    return null;
  }
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
