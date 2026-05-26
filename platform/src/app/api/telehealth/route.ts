/**
 * API: /api/telehealth
 * GET  — List telehealth sessions (all, by patient, by provider, today's, upcoming, stats)
 * POST — Create session, update status, add clinical notes, or rate session
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'medical_superintendent',
];
const WRITE_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
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
    const { buildScopeFromAuth } = await import('@/lib/services/data-scope');
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
      sessions = await getSessionsByPatient(patientId);
    } else if (providerId) {
      sessions = await getSessionsByProvider(providerId);
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
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { sanitizePayload } = await import('@/lib/validation');
    body = sanitizePayload(body);
    const action = body.action as string;
    // Update session status
    if (action === 'update_status' && body.sessionId) {
      const { updateSessionStatus } = await import('@/lib/services/telehealth-service');
      const updated = await updateSessionStatus(
        body.sessionId as string,
        body.status as Parameters<typeof updateSessionStatus>[1],
        body.extra as Parameters<typeof updateSessionStatus>[2]
      );
      if (!updated) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json({ session: updated });
    }
    // Add clinical notes
    if (action === 'add_clinical_notes' && body.sessionId) {
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
    const { createSession } = await import('@/lib/services/telehealth-service');
    const session = await createSession({
      patientId: body.patientId as string,
      patientName: (body.patientName as string) || '',
      providerId: body.providerId as string,
      providerName: (body.providerName as string) || '',
      providerRole: (body.providerRole as string) || 'doctor',
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
      patientConsentGiven: Boolean(body.patientConsentGiven),
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
