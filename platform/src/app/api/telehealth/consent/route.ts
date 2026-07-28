/**
 * API: POST /api/telehealth/consent
 *
 * The patient records their OWN consent to a telehealth visit.
 *
 * This is the endpoint that makes consent first-party. Until it existed the
 * only path was `provider_attested_verbal` — a clinician ticking a box to say
 * they had asked. That is a legitimate record, but it is the clinician's
 * attestation, not the patient's act. (Before that it was worse: the session
 * was created with `patientConsentGiven: true` and a timestamp for a patient
 * nobody had asked at all.)
 *
 * Authorisation is deliberately narrow:
 *   - patient-portal JWT only. A staff token is refused, because a clinician
 *     recording consent "as the patient" would defeat the point — they already
 *     have the attestation path, which is honest about who is speaking.
 *   - the caller must be the session's patient, checked against the stored
 *     document rather than anything in the request body.
 *   - POST cannot withdraw consent. Withdrawal is a different clinical event
 *     with different record-keeping, so it is a separate verb (DELETE) rather
 *     than a `consented: false` flag on this one — overloading a single
 *     endpoint with both would produce an ambiguous audit trail, where the
 *     same call could mean either act depending on a boolean.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import { serverError, logApiError } from '@/lib/api-auth';
import { currentPolicyVersion } from '@/lib/telehealth-consent-policy';

export async function POST(request: NextRequest) {
  try {
    const patient = await verifyPatientToken(request);
    if (patient instanceof NextResponse) return patient;

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    // Consent must be an affirmative act. A missing or false flag is not a
    // withdrawal, it is a malformed request — treat it as such rather than
    // writing anything.
    if (body.consented !== true) {
      return NextResponse.json(
        { error: 'consented must be true — this endpoint records consent, it cannot withdraw it.' },
        { status: 400 },
      );
    }

    const { getSessionById, recordConsent } = await import('@/lib/services/telehealth-service');
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.patientId !== patient.sub) {
      return NextResponse.json({ error: 'This visit does not belong to you.' }, { status: 403 });
    }

    // The policy version comes from the SERVER's current settings, never from
    // the request — otherwise a client could record consent against any string
    // it liked, and the version would prove nothing.
    const policyVersion = await currentPolicyVersion(session.facilityId);

    // The client tells us which version it displayed. A mismatch means the
    // policy changed between the page loading and the patient accepting, so
    // they would be recorded as consenting to text they never saw. Refuse and
    // make them read the current version.
    const shown = typeof body.policyVersion === 'string' ? body.policyVersion : '';
    if (shown && policyVersion && shown !== policyVersion) {
      return NextResponse.json(
        {
          error: 'The consent policy has been updated. Please review it again before joining.',
          policyVersion,
        },
        { status: 409 },
      );
    }

    // Already consented — return success without rewriting the timestamp, so
    // the record keeps the moment consent was ACTUALLY given rather than the
    // last time the page was refreshed. A withdrawn consent is NOT "already
    // recorded"; it must be given again.
    if (
      session.patientConsentGiven &&
      session.consentMethod === 'patient_portal' &&
      !session.consentWithdrawnAt
    ) {
      return NextResponse.json({
        ok: true,
        alreadyRecorded: true,
        consentTimestamp: session.consentTimestamp,
        policyVersion: session.consentPolicyVersion,
      });
    }

    const updated = await recordConsent(sessionId, {
      method: 'patient_portal',
      consentedBy: patient.sub,
      policyVersion,
    });

    return NextResponse.json({
      ok: true,
      alreadyRecorded: false,
      consentTimestamp: updated?.consentTimestamp,
      policyVersion: updated?.consentPolicyVersion,
    });
  } catch (err) {
    logApiError('telehealth/consent', err);
    return serverError();
  }
}

/**
 * DELETE /api/telehealth/consent — the patient withdraws consent.
 *
 * Same authorisation rules as POST: patient-portal JWT only, and only for
 * their own session. A clinician cannot withdraw consent on a patient's
 * behalf; if the patient tells them in the room, that is a clinical decision
 * to end the visit, recorded as a termination, not as the patient's act.
 *
 * The withdrawal is recorded rather than erasing the prior consent, and
 * admission is blocked until consent is given again (enforced in
 * updateSessionStatus, not here).
 */
export async function DELETE(request: NextRequest) {
  try {
    const patient = await verifyPatientToken(request);
    if (patient instanceof NextResponse) return patient;

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { getSessionById, withdrawConsent } = await import('@/lib/services/telehealth-service');
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.patientId !== patient.sub) {
      return NextResponse.json({ error: 'This visit does not belong to you.' }, { status: 403 });
    }

    // Withdrawal applies before the visit starts. Once it is under way, ending
    // it is a different act with different record-keeping — the patient leaves
    // the room and the session terminates, which is already modelled.
    if (session.status === 'in_session') {
      return NextResponse.json(
        { error: 'This visit has already started. Leave the visit to end it.' },
        { status: 409 },
      );
    }

    const updated = await withdrawConsent(sessionId, {
      withdrawnBy: patient.sub,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    return NextResponse.json({
      ok: true,
      withdrawnAt: updated?.consentWithdrawnAt,
    });
  } catch (err) {
    logApiError('telehealth/consent', err);
    return serverError();
  }
}
