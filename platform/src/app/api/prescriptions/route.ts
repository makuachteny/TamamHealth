/**
 * API: /api/prescriptions
 * GET  — List prescriptions (supports ?patientId=xxx&status=pending)
 * POST — Create a new prescription
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, validationError, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'pharmacist', 'medical_superintendent',
];
const CREATE_ROLES: UserRole[] = [
  'super_admin', 'doctor', 'clinical_officer', 'medical_superintendent',
];
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    const { getAllPrescriptions, getPrescriptionsByPatient } = await import('@/lib/services/prescription-service');
    const { buildScopeFromAuth } = await import('@/lib/services/data-scope');
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    let prescriptions;
    const scope = buildScopeFromAuth(auth);
    if (patientId) {
      prescriptions = await getPrescriptionsByPatient(patientId, scope);
    } else {
      prescriptions = await getAllPrescriptions(scope);
    }
    return NextResponse.json({ prescriptions, total: prescriptions.length });
  } catch (err) {
    logApiError('[API /prescriptions GET]', err);
    return serverError();
  }
}
async function postHandler(request: NextRequest) {
  try {
    const { checkRateLimit } = await import('@/lib/api-security');
    const rateLimitResponse = checkRateLimit(request, 'prescriptions:write', 30);
    if (rateLimitResponse) return rateLimitResponse;
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
    if (!body.prescribedBy) body.prescribedBy = auth.name;
    if (!body.orgId && auth.orgId) body.orgId = auth.orgId;
    const { createPrescription } = await import('@/lib/services/prescription-service');
    const result = await createPrescription(body as Parameters<typeof createPrescription>[0]);
    return NextResponse.json({
      prescription: result.prescription,
      interactionWarnings: result.interactionWarnings,
    }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ValidationError') {
      const ve = err as Error & { fields: Record<string, string> };
      return validationError(ve.fields);
    }
    logApiError('[API /prescriptions POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'prescription.create' });
