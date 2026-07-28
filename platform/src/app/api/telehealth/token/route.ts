/**
 * API: POST /api/telehealth/token
 *
 * Mints a short-lived LiveKit access token for one participant in one visit.
 *
 * This is the authorisation boundary for telehealth media. LiveKit itself
 * trusts any connection presenting a token signed with our API secret, so
 * every access rule has to be enforced here, before signing:
 *
 *   1. The caller must be authenticated — either as staff (platform JWT) or
 *      as the patient (patient-portal JWT). Both paths are handled below.
 *   2. The caller must be a PARTICIPANT in the requested session. A clinician
 *      cannot mint a token for a colleague's consultation, and a patient
 *      cannot mint one for a session that is not theirs. This is checked
 *      against the stored session document, never against request body claims.
 *   3. The session must be in a joinable state. A cancelled or completed visit
 *      does not hand out media credentials.
 *
 * Tokens are deliberately short-lived and minted per request, which is why the
 * join URLs carry only a session id (see lib/telehealth-room.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getAuthPayload, serverError, logApiError } from '@/lib/api-auth';
import { verifyPatientToken } from '@/lib/patient-portal-auth';
import {
  roomNameForSession,
  providerIdentity,
  patientIdentity,
  isLiveKitConfigured,
} from '@/lib/telehealth-room';
import { jubaNow } from '@/lib/time-juba';
import {
  evaluateJoinWindow,
  DEFAULT_JOIN_WINDOW,
  type JoinWindowConfig,
} from '@/lib/telehealth-join-window';
import type { TelehealthSessionDoc } from '@/lib/db-types';

/** How long a minted token stays valid. Short — clients reconnect by re-minting. */
const TOKEN_TTL_SECONDS = 15 * 60;

/** Session states in which media credentials may be issued. */
const JOINABLE: ReadonlySet<TelehealthSessionDoc['status']> = new Set([
  'scheduled',
  'waiting_room',
  'in_session',
]);

export async function POST(request: NextRequest) {
  try {
    if (!isLiveKitConfigured()) {
      // Explicit 503 rather than a confusing signing failure, so the UI can
      // say "video is not configured" instead of "something went wrong".
      return NextResponse.json(
        { error: 'Telehealth video is not configured on this deployment (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).' },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { getSessionById } = await import('@/lib/services/telehealth-service');
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!JOINABLE.has(session.status)) {
      return NextResponse.json(
        { error: `This visit is ${session.status} and can no longer be joined.` },
        { status: 409 },
      );
    }

    // ── Identify the caller and prove they belong in THIS session ───────────
    let identity: string;
    let displayName: string;
    let isProvider: boolean;

    const staff = await getAuthPayload(request);

    if (staff) {
      // A clinician may only join the session they are assigned to. Being a
      // doctor is not sufficient — otherwise any clinician in the facility
      // could drop into any consultation.
      if (session.providerId !== staff.sub) {
        return NextResponse.json(
          { error: 'You are not the assigned provider for this visit.' },
          { status: 403 },
        );
      }
      identity = providerIdentity(staff.sub);
      displayName = staff.name || staff.username || 'Clinician';
      isProvider = true;
    } else {
      const patient = await verifyPatientToken(request);
      if (patient instanceof NextResponse) {
        // verifyPatientToken returns its own 401 response when unauthenticated.
        return patient;
      }
      if (session.patientId !== patient.sub) {
        return NextResponse.json(
          { error: 'This visit does not belong to you.' },
          { status: 403 },
        );
      }
      identity = patientIdentity(patient.sub);
      displayName = session.patientName || 'Patient';
      isProvider = false;

      // ── Join window ──────────────────────────────────────────────────────
      // Enforced HERE, not only on the join page, because the page is client
      // code — a patient who keeps the tab open past the window, or replays
      // the request, must still be refused.
      //
      // Checked only AFTER ownership is proven. Evaluating it earlier would
      // have told an unauthenticated caller who guessed a session id when
      // somebody else's appointment is scheduled.
      //
      // Clinicians are deliberately exempt: a provider opens the room early to
      // prepare and stays past the slot when the clinic runs late, and they
      // are the ones who decide when a visit is over.
      let window: JoinWindowConfig = DEFAULT_JOIN_WINDOW;
      try {
        const { getFacilitySettings } = await import('@/lib/settings/settings-service');
        const settings = await getFacilitySettings(session.facilityId);
        if (settings?.telehealthJoinWindow) window = settings.telehealthJoinWindow;
      } catch {
        /* fall back to defaults — a settings read failure must not deny care */
      }

      const state = evaluateJoinWindow(session, window, jubaNow());
      if (!state.open) {
        return NextResponse.json(
          {
            error: state.message,
            reason: state.reason,
            opensAt: state.opensAt?.toISOString() ?? null,
            closesAt: state.closesAt?.toISOString() ?? null,
          },
          { status: 403 },
        );
      }
    }

    // ── Mint ───────────────────────────────────────────────────────────────
    const room = roomNameForSession(session._id);
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      { identity, name: displayName, ttl: TOKEN_TTL_SECONDS },
    );

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      // Data channel carries in-visit chat. Both sides need it.
      canPublishData: true,
      // Only the clinician may administer the room (mute a noisy line, remove
      // a participant, end the visit for everyone).
      roomAdmin: isProvider,
    });

    return NextResponse.json({
      token: await at.toJwt(),
      url: process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL,
      room,
      identity,
      expiresIn: TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    logApiError('telehealth/token', err);
    return serverError();
  }
}
