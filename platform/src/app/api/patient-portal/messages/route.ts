import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { messagesDB } from '@/lib/db';
import { logAuditSafe } from '@/lib/services/audit-service';
import type { MessageDoc } from '@/lib/db-types';

export async function GET(req: NextRequest) {
  const auth = await verifyPatientToken(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { getMessagesByPatient } = await import('@/lib/services/message-service');
    const messages = await getMessagesByPatient(auth.sub);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[patient-portal/messages]', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyPatientToken(req);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Patient → staff message. Direction + sender are forced server-side so a
  // patient cannot impersonate a clinician via the mobile push.
  try {
    const db = messagesDB();
    const now = new Date().toISOString();
    const id = (typeof body._id === 'string' && body._id) || `msg-${uuidv4().slice(0, 8)}`;

    const doc: MessageDoc = {
      _id: id,
      type: 'message',
      recipientType: 'staff',
      direction: 'patient_to_staff',
      patientId: auth.sub,
      patientName: auth.name,
      patientPhone: typeof body.patientPhone === 'string' ? body.patientPhone : '',
      recipientHospitalId: typeof body.recipientHospitalId === 'string' ? body.recipientHospitalId : undefined,
      recipientHospitalName: typeof body.recipientHospitalName === 'string' ? body.recipientHospitalName
        : (typeof body.fromHospitalName === 'string' ? body.fromHospitalName : undefined),
      fromDoctorId: 'patient',
      fromDoctorName: auth.name,
      fromHospitalName: typeof body.fromHospitalName === 'string' ? body.fromHospitalName : '',
      fromHospitalId: typeof body.fromHospitalId === 'string' ? body.fromHospitalId : undefined,
      subject: typeof body.subject === 'string' ? body.subject : '(no subject)',
      body: typeof body.body === 'string' ? body.body : '',
      channel: 'app',
      status: 'sent',
      sentAt: typeof body.sentAt === 'string' ? body.sentAt : now,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.sub,
    };

    const resp = await db.put(doc);
    doc._rev = resp.rev;

    await logAuditSafe(
      'PATIENT_SEND_MESSAGE', auth.sub, auth.name,
      `Patient ${auth.sub} sent message ${doc._id} — ${doc.subject}`
    );

    return NextResponse.json({ ok: true, id: doc._id, message: doc }, { status: 201 });
  } catch (err) {
    console.error('[patient-portal/messages POST]', err);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
