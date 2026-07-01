import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
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
    const now = new Date().toISOString();
    const { createMessage } = await import('@/lib/services/message-service');

    const doc = await createMessage({
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
      sentAt: typeof body.sentAt === 'string' ? body.sentAt : now,
      createdBy: auth.sub,
    } as Omit<MessageDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'status'>);

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
