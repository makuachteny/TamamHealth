import { availabilityDB } from '../db';
import type { AvailabilityDoc } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';

export async function getAllAvailability(scope?: DataScope): Promise<AvailabilityDoc[]> {
  const db = availabilityDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as AvailabilityDoc)
    .filter(d => d && d.type === 'availability' && d.status !== 'cancelled')
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  return scope ? filterByScope(all, scope) : all;
}

export async function getAvailabilityByProvider(providerId: string): Promise<AvailabilityDoc[]> {
  const all = await getAllAvailability();
  return all.filter(a => a.providerId === providerId);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export async function createAvailability(
  data: Omit<AvailabilityDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'status'> & { status?: AvailabilityDoc['status'] },
  actorId?: string,
  actorName?: string,
): Promise<AvailabilityDoc> {
  if (!data.providerId || !data.date || !data.startTime || !data.endTime) {
    throw new Error('Provider, date, start time and end time are required');
  }
  if (toMinutes(data.endTime) <= toMinutes(data.startTime)) {
    throw new Error('End time must be after start time');
  }

  const db = availabilityDB();
  const now = new Date().toISOString();

  // Reject windows that overlap an existing window for the same provider/day.
  const existing = await getAvailabilityByProvider(data.providerId);
  const clash = existing.find(a =>
    a.date === data.date &&
    toMinutes(data.startTime) < toMinutes(a.endTime) &&
    toMinutes(a.startTime) < toMinutes(data.endTime)
  );
  if (clash) {
    throw new Error(`Overlaps an existing availability window (${clash.startTime}–${clash.endTime}) on ${clash.date}`);
  }

  const doc: AvailabilityDoc = {
    _id: `avail-${uuidv4().slice(0, 8)}`,
    type: 'availability',
    status: 'open',
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('CREATE_AVAILABILITY', actorId, actorName,
    `Availability ${doc._id}: ${data.providerName} on ${data.date} ${data.startTime}–${data.endTime} (${data.modality})`);
  return doc;
}

export async function cancelAvailability(id: string, actorId?: string, actorName?: string): Promise<void> {
  const db = availabilityDB();
  const existing = await db.get(id) as AvailabilityDoc;
  const updated: AvailabilityDoc = { ...existing, status: 'cancelled', updatedAt: new Date().toISOString() };
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  await logAuditSafe('CANCEL_AVAILABILITY', actorId, actorName, `Cancelled availability ${id}`);
}
