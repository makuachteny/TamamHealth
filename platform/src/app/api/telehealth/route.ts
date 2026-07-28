/**
 * API: /api/telehealth
 * GET  — List telehealth sessions (all, by patient, by provider, today's, upcoming, stats)
 * POST — Create session, update status, add clinical notes, or rate session
 *
 * ## Authorization model (KAN-138)
 *
 * Role membership plus org/facility scope is NOT sufficient to act on a
 * consultation. Scope answers "may this user see this facility's data"; it
 * does not answer "is this user a participant in this visit". Without the
 * second question, any nurse in the facility could write clinical notes into
 * any clinician's consultation, or end it.
 *
 * So every action resolves the session server-side and checks participation:
 *
 *  - **Clinical acts** (notes, ratings) — the assigned provider only. Nobody
 *    else writes into someone else's consultation record.
 *  - **Administrative acts** (status changes) — the assigned provider, or an
 *    org/facility administrator, who legitimately needs to cancel a visit the
 *    clinician cannot attend to.
 *
 * Identity and consent fields in the request body are ignored in favour of
 * server-resolved values. See `createSession` below for why consent in
 * particular is refused rather than merely ignored.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole, TelehealthSessionDoc } from '@/lib/db-types';

/**
 * Roles that may administer a visit they are not assigned to — cancelling a
 * consultation whose clinician is off sick, for instance. Deliberately does
 * NOT extend to clinical acts: an administrator may close a visit, never write
 * a note in it.
 */
const ADMIN_ROLES: UserRole[] = ['super_admin', 'org_admin', 'medical_superintendent'];
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'clinician', 'nurse',
  'medical_superintendent',
];
const WRITE_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'clinician', 'nurse',
];
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    const {
      getAllSessions,
      getSessionsByPatient,
      getSessionsByProvider,
      getTodaysSessions,
      getUpcomingSessions,
      getTelehealthStats,
    } = await import('@/lib/services/telehealth-service');
    const { buildScopeFromAuth, filterByScope } = await import('@/lib/services/data-scope');
    const scope = buildScopeFromAuth(auth);
    const filter = request.nextUrl.searchParams.get('filter');
    const patientId = request.nextUrl.searchParams.get('patientId');
    const providerId = request.nextUrl.searchParams.get('providerId');
    let sessions;
    if (filter === 'today') {
      sessions = await getTodaysSessions(scope);
    } else if (filter === 'upcoming') {
      sessions = await getUpcomingSessions(scope);
    } else if (filter === 'stats') {
      const stats = await getTelehealthStats(scope);
      return NextResponse.json({ stats });
    } else if (patientId) {
      sessions = filterByScope(await getSessionsByPatient(patientId), scope);
    } else if (providerId) {
      sessions = filterByScope(await getSessionsByProvider(providerId), scope);
    } else {
      sessions = await getAllSessions(scope);
    }
    return NextResponse.json({ sessions });
  } catch (err) {
    logApiError('[API /telehealth GET]', err);
    return serverError();
  }
}
async function postHandler(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, WRITE_ROLES)) return forbidden();
    const checkedAuth = auth;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { sanitizePayload } = await import('@/lib/validation');
    body = sanitizePayload(body);
    const action = body.action as string;
    /**
     * Resolve the session and prove the caller may act on it.
     *
     * Two gates, in order. Scope first (is this facility's data visible to
     * them at all), then participation (are they in THIS visit). Scope alone
     * was the whole check before, which made "works at the facility" and
     * "is the treating clinician" the same permission.
     *
     * A denial is logged, not just returned — a cross-provider attempt is a
     * signal worth keeping, and a 403 nobody records is invisible.
     */
    async function resolveSession(
      sessionId: string,
      kind: 'clinical' | 'administrative',
    ): Promise<{ session: TelehealthSessionDoc } | NextResponse> {
      const { telehealthDB } = await import('@/lib/db');
      const { buildScopeFromAuth, filterByScope } = await import('@/lib/services/data-scope');
      const { logAuditSafe } = await import('@/lib/services/audit-service');

      let existing: TelehealthSessionDoc;
      try {
        existing = await telehealthDB().get(sessionId) as TelehealthSessionDoc;
      } catch {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (filterByScope([existing as unknown as Record<string, unknown>], buildScopeFromAuth(checkedAuth)).length === 0) {
        await logAuditSafe(
          'TELEHEALTH_ACCESS_DENIED', checkedAuth.sub, checkedAuth.username,
          `Out-of-scope telehealth access attempt on session ${sessionId}`,
        );
        // Deliberately the same message and status as the participation
        // failure below: distinguishing them would tell a caller whether a
        // session they cannot touch exists in their facility.
        return forbidden('Access denied to this telehealth session');
      }

      const isProvider = existing.providerId === checkedAuth.sub;
      const isAdministrator = hasRole(checkedAuth, ADMIN_ROLES);
      const allowed = kind === 'clinical' ? isProvider : (isProvider || isAdministrator);

      if (!allowed) {
        await logAuditSafe(
          'TELEHEALTH_ACCESS_DENIED', checkedAuth.sub, checkedAuth.username,
          `Non-participant ${kind} action attempted on telehealth session ${sessionId} ` +
          `(assigned provider ${existing.providerId})`,
        );
        return forbidden('Access denied to this telehealth session');
      }

      return { session: existing };
    }
    // Update session status
    if (action === 'update_status' && body.sessionId) {
      const resolved = await resolveSession(body.sessionId as string, 'administrative');
      if (resolved instanceof NextResponse) return resolved;

      // `extra` is a caller-supplied patch spread straight onto the document.
      // Consent and admission fields are stripped: they carry their own
      // provenance rules and their own endpoints, and letting a status update
      // set them would route around every one of those checks.
      const extra = { ...(body.extra as Record<string, unknown> | undefined) };
      for (const guarded of [
        'patientConsentGiven', 'consentMethod', 'consentTimestamp', 'consentedBy',
        'consentAttestedBy', 'consentAttestedByName', 'consentPolicyVersion',
        'consentWithdrawnAt', 'consentWithdrawnReason',
        'admittedBy', 'admittedByName', 'rejectedBy', 'rejectedByName',
      ]) {
        delete extra[guarded];
      }

      const { updateSessionStatus, ConsentRequiredError } = await import('@/lib/services/telehealth-service');
      try {
        const updated = await updateSessionStatus(
          body.sessionId as string,
          body.status as Parameters<typeof updateSessionStatus>[1],
          extra as Parameters<typeof updateSessionStatus>[2]
        );
        if (!updated) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        return NextResponse.json({ session: updated });
      } catch (err) {
        // The consent gate must surface as a refusal the caller can act on,
        // not as a 500 that reads like a bug in the server.
        if (err instanceof ConsentRequiredError) {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
        throw err;
      }
    }
    // Add clinical notes
    if (action === 'add_clinical_notes' && body.sessionId) {
      // Clinical: the assigned provider only. A note in a consultation record
      // is attributed to the clinician who held it.
      const resolved = await resolveSession(body.sessionId as string, 'clinical');
      if (resolved instanceof NextResponse) return resolved;
      if (!body.notes) {
        return NextResponse.json(
          { error: 'notes are required' },
          { status: 400 }
        );
      }
      const { addClinicalNotes } = await import('@/lib/services/telehealth-service');
      const updated = await addClinicalNotes(
        body.sessionId as string,
        body.notes as string,
        body.diagnosis as string | undefined,
        body.icd10Code as string | undefined
      );
      if (!updated) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json({ session: updated });
    }
    // Rate session
    if (action === 'rate_session' && body.sessionId) {
      const resolved = await resolveSession(body.sessionId as string, 'clinical');
      if (resolved instanceof NextResponse) return resolved;
      if (body.rating === undefined) {
        return NextResponse.json(
          { error: 'rating is required' },
          { status: 400 }
        );
      }
      const { rateSession } = await import('@/lib/services/telehealth-service');
      const updated = await rateSession(
        body.sessionId as string,
        Number(body.rating),
        body.feedback as string | undefined
      );
      if (!updated) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json({ session: updated });
    }
    // Create new session
    if (!body.patientId || !body.providerId || !body.scheduledDate || !body.scheduledTime) {
      return NextResponse.json(
        { error: 'patientId, providerId, scheduledDate, and scheduledTime are required' },
        { status: 400 }
      );
    }

    // Consent is REFUSED, not ignored. `patientConsentGiven` was read straight
    // from the request body, so this endpoint could mint a session that
    // already claimed the patient had consented — reintroducing, through the
    // API, exactly the fabricated-consent record KAN-125 removed from the UI.
    //
    // A 400 rather than a silent drop: a caller sending this believes they are
    // recording consent, and quietly discarding it would leave them thinking
    // they had. Consent is recorded only via /api/telehealth/consent (patient)
    // or an attributed clinician attestation.
    //
    // Sits with the other body-shape checks, before the record lookups — the
    // request is malformed regardless of whether the patient exists.
    if (body.patientConsentGiven !== undefined) {
      return NextResponse.json(
        {
          error: 'patientConsentGiven cannot be set when creating a session. ' +
            'Record consent via POST /api/telehealth/consent (patient) or a provider attestation.',
        },
        { status: 400 },
      );
    }
    const { getPatientById } = await import('@/lib/services/patient-service');
    const { buildScopeFromAuth, filterByScope } = await import('@/lib/services/data-scope');
    const patient = await getPatientById(body.patientId as string);
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    if (filterByScope([patient], buildScopeFromAuth(auth)).length === 0) {
      return forbidden('Access denied to this patient record');
    }
    // The named provider must be a real user in the caller's scope. Previously
    // any string was accepted, so a session could be booked against a provider
    // id belonging to another organisation — or to nobody at all, which then
    // fails every later ownership check with no way to repair it.
    const { getUserById } = await import('@/lib/services/user-service');
    const provider = await getUserById(body.providerId as string);
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    if (filterByScope([provider], buildScopeFromAuth(auth)).length === 0) {
      return forbidden('Access denied to this provider');
    }

    const { createSession } = await import('@/lib/services/telehealth-service');
    const session = await createSession({
      patientId: body.patientId as string,
      // Names are denormalised from the resolved records, not taken from the
      // body — a caller-supplied name could label the session with a different
      // patient than the one it points at.
      patientName: [patient.firstName, patient.surname].filter(Boolean).join(' '),
      providerId: provider._id,
      providerName: provider.name || provider.username || '',
      providerRole: provider.role,
      facilityId: auth.hospitalId || '',
      facilityName: (body.facilityName as string) || '',
      scheduledDate: body.scheduledDate as string,
      scheduledTime: body.scheduledTime as string,
      sessionType: (body.sessionType as 'video' | 'audio' | 'chat') || 'video',
      status: (body.status as Parameters<typeof createSession>[0]['status']) || 'scheduled',
      chiefComplaint: (body.chiefComplaint as string) || '',
      clinicalNotes: body.clinicalNotes as string | undefined,
      diagnosis: body.diagnosis as string | undefined,
      icd10Code: body.icd10Code as string | undefined,
      followUpRequired: Boolean(body.followUpRequired),
      referralRequired: Boolean(body.referralRequired),
      connectionDrops: 0,
      // Always false at creation. Consent is an act with provenance, recorded
      // through its own path — never a flag set at booking time.
      patientConsentGiven: false,
      sessionRecorded: Boolean(body.sessionRecorded),
      state: (body.state as string) || '',
      orgId: auth.orgId,
      duration: 0,
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    logApiError('[API /telehealth POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'telehealth.create' });
