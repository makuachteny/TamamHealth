/**
 * API: /api/boma-visits
 * GET  — List community health visits (supports ?workerId=xxx&view=review|performance|stats)
 * POST — Create a new boma visit or submit a review
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'medical_superintendent', 'boma_health_worker', 'payam_supervisor',
  'community_health_volunteer',
];
const CREATE_ROLES: UserRole[] = [
  'super_admin', 'boma_health_worker', 'community_health_volunteer',
  'payam_supervisor',
];
const REVIEW_ROLES: UserRole[] = [
  'super_admin', 'doctor', 'clinical_officer', 'payam_supervisor',
  'medical_superintendent',
];
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    const {
      getAllBomaVisits, getVisitsByWorker, getVisitsByPatient,
      getTodaysVisits, getVisitsForReview, getReviewStats,
      getBHWPerformance, getBomaStats,
    } = await import('@/lib/services/boma-visit-service');
    const url = new URL(request.url);
    const workerId = url.searchParams.get('workerId');
    const geocodeId = url.searchParams.get('geocodeId');
    const payam = url.searchParams.get('payam');
    const view = url.searchParams.get('view');
    if (view === 'review') {
      // Build scope so payam_supervisors only see their own payam's visits.
      const { buildScopeFromAuth } = await import('@/lib/services/data-scope');
      const scope = buildScopeFromAuth(auth);
      const pending = await getVisitsForReview(payam || scope);
      return NextResponse.json({ visits: pending, total: pending.length });
    }
    if (view === 'review-stats') {
      const stats = await getReviewStats();
      return NextResponse.json(stats);
    }
    if (view === 'performance') {
      const performance = await getBHWPerformance();
      return NextResponse.json({ workers: performance, total: performance.length });
    }
    if (view === 'stats' && workerId) {
      const stats = await getBomaStats(workerId);
      return NextResponse.json(stats);
    }
    if (view === 'today' && workerId) {
      const visits = await getTodaysVisits(workerId);
      return NextResponse.json({ visits, total: visits.length });
    }
    let visits;
    if (workerId) {
      visits = await getVisitsByWorker(workerId);
    } else if (geocodeId) {
      visits = await getVisitsByPatient(geocodeId);
    } else {
      visits = await getAllBomaVisits();
    }
    return NextResponse.json({ visits, total: visits.length });
  } catch (err) {
    logApiError('[API /boma-visits GET]', err);
    return serverError();
  }
}
async function postHandler(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { sanitizePayload } = await import('@/lib/validation');
    body = sanitizePayload(body);
    // Review action — requires supervisor role
    if (body.action === 'review') {
      if (!hasRole(auth, REVIEW_ROLES)) return forbidden();
      if (!body.visitId || !body.reviewStatus) {
        return NextResponse.json(
          { error: 'visitId and reviewStatus are required' },
          { status: 400 }
        );
      }
      const { reviewVisit } = await import('@/lib/services/boma-visit-service');
      const result = await reviewVisit(
        body.visitId as string,
        auth.sub,
        auth.name,
        body.reviewStatus as 'reviewed' | 'flagged',
        (body.reviewNotes as string) || '',
      );
      if (!result) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
      return NextResponse.json({ visit: result });
    }
    // Create new visit — requires BHW role
    if (!hasRole(auth, CREATE_ROLES)) return forbidden();
    if (!body.chiefComplaint || !body.patientName) {
      return NextResponse.json(
        { error: 'chiefComplaint and patientName are required' },
        { status: 400 }
      );
    }
    body.workerId = body.workerId || auth.sub;
    body.workerName = body.workerName || auth.name;
    if (!body.orgId && auth.orgId) body.orgId = auth.orgId;
    const { createBomaVisit } = await import('@/lib/services/boma-visit-service');
    const visit = await createBomaVisit(body as Parameters<typeof createBomaVisit>[0]);
    return NextResponse.json({ visit }, { status: 201 });
  } catch (err) {
    logApiError('[API /boma-visits POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'boma.visit.create' });
