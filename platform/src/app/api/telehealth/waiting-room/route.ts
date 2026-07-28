/**
 * API: POST /api/telehealth/waiting-room
 *
 * The patient announces that they have arrived (KAN-128).
 *
 * This is the only path into `waiting_room`, which is what lets the clinician's
 * screen mean something: a patient shown as waiting is a patient who actually
 * arrived. The provider room used to reach that state on a timer, and told the
 * same story whether or not anybody was there.
 *
 * Patient-portal JWT only, and only for their own session — same rules as the
 * consent route. A clinician cannot place a patient in the waiting room on
 * their behalf; that would recreate the fiction from the other direction.
 *
 * Consent is deliberately NOT required to wait. A patient may arrive, read the
 * policy, and decide — being made to consent before they can even be seen to
 * be waiting would turn consent into a toll gate. Admission is where consent
 * is enforced (KAN-125).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { serverError, logApiError } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const patient = await verifyPatientToken(request);
    if (patient instanceof NextResponse) return patient;

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { getSessionById, enterWaitingRoom } = await import('@/lib/services/telehealth-service');
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
    if (session.patientId !== patient.sub) {
      return NextResponse.json({ error: 'This visit does not belong to you.' }, { status: 403 });
    }

    // A finished, cancelled or missed visit has no waiting room to enter.
    // Without this a patient following an old link would reopen a closed
    // session and appear in the clinician's queue for a visit already dealt with.
    if (!['scheduled', 'waiting_room', 'in_session'].includes(session.status)) {
      return NextResponse.json(
        { error: `This visit is ${session.status} and can no longer be joined.`, status: session.status },
        { status: 409 },
      );
    }

    const updated = await enterWaitingRoom(sessionId, { patientId: patient.sub });

    return NextResponse.json({
      ok: true,
      status: updated?.status,
      waitingSince: updated?.waitingSince,
    });
  } catch (err) {
    logApiError('telehealth/waiting-room', err);
    return serverError();
  }
}
