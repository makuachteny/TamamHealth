import { messagesDB } from '../db';
import type { MessageDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';
import { emitSyncEvent } from './sync-event-service';

export async function getAllMessages(scope?: DataScope): Promise<MessageDoc[]> {
  const db = messagesDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as MessageDoc)
    .filter(d => d && d.type === 'message')
    .sort((a, b) => new Date(b.sentAt || '').getTime() - new Date(a.sentAt || '').getTime());
  return scope ? filterByScope(all, scope) : all;
}

export async function getMessagesByPatient(patientId: string): Promise<MessageDoc[]> {
  const all = await getAllMessages();
  return all.filter(m => m.patientId === patientId);
}

export async function getMessagesByDoctor(doctorId: string): Promise<MessageDoc[]> {
  const all = await getAllMessages();
  return all.filter(m => m.fromDoctorId === doctorId);
}

/**
 * Inbound messages authored by patients via the patient-portal. The
 * patient-portal Chat tab writes these with `direction === 'patient_to_staff'`
 * (and the legacy fallback of `fromDoctorId === 'patient'` for messages saved
 * before the direction field existed).
 */
export async function getInboundPatientMessages(scope?: DataScope): Promise<MessageDoc[]> {
  const all = await getAllMessages(scope);
  return all.filter(m =>
    m.direction === 'patient_to_staff' || m.fromDoctorId === 'patient'
  );
}

/**
 * All messages addressed to (or originating from) a given facility — useful
 * for the staff inbox at a specific hospital. Matches both patient-originated
 * messages targeting this facility and staff-authored messages from/to it.
 */
export async function getMessagesForFacility(hospitalId: string, scope?: DataScope): Promise<MessageDoc[]> {
  const all = await getAllMessages(scope);
  return all.filter(m =>
    m.recipientHospitalId === hospitalId ||
    m.fromHospitalId === hospitalId
  );
}

export async function updateMessage(id: string, data: Partial<MessageDoc>): Promise<MessageDoc | null> {
  const db = messagesDB();
  try {
    const existing = await db.get(id) as MessageDoc;
    const updated = {
      ...existing,
      ...data,
      _id: existing._id,
      _rev: existing._rev,
      updatedAt: new Date().toISOString(),
    };
    const resp = await db.put(updated);
    updated._rev = resp.rev;
    return updated;
  } catch {
    return null;
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  const db = messagesDB();
  try {
    const doc = await db.get(id);
    await db.remove(doc);
    return true;
  } catch {
    return false;
  }
}

export async function createMessage(data: Omit<MessageDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'status'>): Promise<MessageDoc> {
  const db = messagesDB();
  const now = new Date().toISOString();
  const id = `msg-${uuidv4().slice(0, 8)}`;
  const doc: MessageDoc = {
    _id: id,
    type: 'message',
    ...data,
    status: 'sent',
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  // Audit trail: every message write is patient-related communication, so
  // it belongs in the audit log alongside other PHI-touching mutations.
  // Previously createMessage wrote silently — the admin audit-log page
  // showed Rx and lab activity but nothing for patient↔staff chats.
  await logAuditSafe(
    'CREATE_MESSAGE', undefined, doc.fromDoctorName,
    `Message ${doc._id}: ${doc.direction || 'staff_to_patient'} — ${doc.subject || '(no subject)'}`
  );
  // Sync event so the Postgres `messages` analytics table receives the row.
  // The /api/sync route already has a field mapper for it (DB_TABLE_MAP +
  // FIELD_MAPPERS.messages), so the missing piece was just emitting the event.
  emitSyncEvent({
    resourceType: 'message',
    resourceId: doc._id,
    operation: 'create',
    resourceVersion: doc._rev,
    hospitalId: doc.fromHospitalId || doc.recipientHospitalId,
    orgId: doc.orgId,
  });
  return doc;
}
