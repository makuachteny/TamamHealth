/**
 * API: /api/lab
 * GET  — List lab results (supports ?status=pending&patientId=xxx)
 * POST — Create a new lab order
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'midwife', 'lab_tech', 'medical_superintendent', 'radiologist',
];
const CREATE_ROLES: UserRole[] = [
  'super_admin', 'doctor', 'clinical_officer', 'nurse', 'lab_tech',
  'medical_superintendent',
];
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    const { getAllLabResults, getLabResultsByPatient, getPendingLabResults } = await import('@/lib/services/lab-service');
    const { buildScopeFromAuth, filterByScope } = await import('@/lib/services/data-scope');
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    const status = url.searchParams.get('status');
    let results;
    if (patientId) {
      const rows = await getLabResultsByPatient(patientId);
      results = filterByScope(rows, buildScopeFromAuth(auth));
    } else if (status === 'pending') {
      results = await getPendingLabResults();
    } else {
      const scope = buildScopeFromAuth(auth);
      results = await getAllLabResults(scope);
    }
    return NextResponse.json({ labResults: results, total: results.length });
  } catch (err) {
    logApiError('[API /lab GET]', err);
    return serverError();
  }
}
async function postHandler(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, CREATE_ROLES)) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { sanitizePayload } = await import('@/lib/validation');
    body = sanitizePayload(body);
    // Validate required fields
    if (!body.patientId || !body.testName) {
      return NextResponse.json(
        { error: 'patientId and testName are required' },
        { status: 400 }
      );
    }
    if (!body.orderedBy) body.orderedBy = auth.name;
    if (!body.orgId && auth.orgId) body.orgId = auth.orgId;
    const { createLabResult } = await import('@/lib/services/lab-service');
    const result = await createLabResult(body as Parameters<typeof createLabResult>[0]);
    return NextResponse.json({ labResult: result }, { status: 201 });
  } catch (err) {
    logApiError('[API /lab POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'lab.create' });
