/**
 * API: GET /api/telehealth/visit/[sessionId]
 *
 * The pre-visit summary a patient sees before joining: who they are seeing,
 * when, what for, whether they have already consented, and whether the join
 * window is open.
 *
 * Why a dedicated route rather than reusing the staff telehealth endpoint:
 *
 *  - **Auth.** This is patient-portal JWT only. A staff token is refused —
 *    not because staff shouldn't see the session (they have their own route)
 *    but because a route that accepts either audience invites the ownership
 *    check to be written for one of them and quietly skipped for the other.
 *
 *  - **Projection.** A `TelehealthSessionDoc` carries clinical notes,
 *    diagnosis, ICD codes, prescriptions and lab orders. None of that belongs
 *    in a pre-visit screen, and result-release gating (KAN-105) is a separate
 *    decision from "may this patient join their call". So this returns an
 *    explicit allow-list of fields rather than the document.
 *
 * The join-window verdict here is ADVISORY — it exists so the page can explain
 * itself. The binding check is in /api/telehealth/token, which refuses to mint
 * media credentials outside the window regardless of what this route said.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { serverError, logApiError } from '@/lib/api-auth';
import { jubaNow } from '@/lib/time-juba';
import {
  evaluateJoinWindow,
  DEFAULT_JOIN_WINDOW,
  type JoinWindowConfig,
} from '@/lib/telehealth-join-window';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const patient = await verifyPatientToken(request);
    if (patient instanceof NextResponse) return patient;

    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { getSessionById } = await import('@/lib/services/telehealth-service');
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
    if (session.patientId !== patient.sub) {
      return NextResponse.json({ error: 'This visit does not belong to you.' }, { status: 403 });
    }

    // Facility-configurable window, defaults when the facility has no settings
    // doc yet. A settings read failure must not deny care, so it falls back to
    // the shipped default rather than refusing the join.
    let window: JoinWindowConfig = DEFAULT_JOIN_WINDOW;
    try {
      const { getFacilitySettings } = await import('@/lib/settings/settings-service');
      const settings = await getFacilitySettings(session.facilityId);
      if (settings?.telehealthJoinWindow) window = settings.telehealthJoinWindow;
    } catch {
      /* defaults */
    }

    const state = evaluateJoinWindow(session, window, jubaNow());

    return NextResponse.json({
      sessionId: session._id,
      status: session.status,
      sessionType: session.sessionType,
      providerName: session.providerName,
      providerRole: session.providerRole,
      facilityName: session.facilityName,
      scheduledDate: session.scheduledDate,
      scheduledTime: session.scheduledTime,
      chiefComplaint: session.chiefComplaint,
      // So the page can skip the consent step for a patient who already
      // consented and is rejoining after a dropped connection, rather than
      // making them affirm twice for one visit.
      // Waiting-room state (KAN-128). The patient page polls this, so it is
      // the authoritative answer to "am I still waiting?" — the patient's own
      // view never decides that for itself.
      waitingSince: session.waitingSince,
      admittedAt: session.admittedAt,
      admittedByName: session.admittedByName,
      rejectedAt: session.rejectedAt,
      // The reason is shown to the patient, so it is one of the few
      // clinician-authored strings that deliberately crosses to this side.
      rejectionReason: session.rejectionReason,
      consentGiven: Boolean(session.patientConsentGiven),
      consentMethod: session.consentMethod,
      consentWithdrawnAt: session.consentWithdrawnAt,
      // The exact text and version the patient must be shown. Served from the
      // server so the recorded version always matches what was rendered — a
      // policy hardcoded in the page could drift from the one consent is
      // recorded against, and then the record would attest to the wrong text.
      consentPolicy: await (async () => {
        const { getConsentPolicy } = await import('@/lib/telehealth-consent-policy');
        return getConsentPolicy(session.facilityId);
      })(),
      joinWindow: {
        open: state.open,
        reason: state.reason,
        message: state.message,
        opensAt: state.opensAt?.toISOString() ?? null,
        closesAt: state.closesAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    logApiError('telehealth/visit', err);
    return serverError();
  }
}
