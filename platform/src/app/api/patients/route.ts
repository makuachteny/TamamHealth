/**
 * API: /api/patients
 * GET  — List patients (supports ?q=search&hospitalId=xxx)
 * POST — Create a new patient
 *
 * Access: doctor, clinical_officer, nurse, front_desk, boma_health_worker,
 *         medical_superintendent, hrio, super_admin, org_admin
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, validationError, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
// Roles that may read patient lists
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'front_desk', 'boma_health_worker', 'medical_superintendent', 'hrio',
  'payam_supervisor', 'data_entry_clerk', 'community_health_volunteer',
  'nutritionist', 'radiologist', 'government',
];
// Roles that may create patients
const CREATE_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'front_desk', 'boma_health_worker', 'medical_superintendent', 'hrio',
  'data_entry_clerk',
];
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    // Dynamic import to avoid PouchDB SSR crash — these services use PouchDB
    // on the client, but the API layer will forward to PostgreSQL when available.
    const { getAllPatients, searchPatients } = await import('@/lib/services/patient-service');
    const { buildScopeFromAuth } = await import('@/lib/services/data-scope');
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const scope = buildScopeFromAuth(auth);
    let patients;
    if (query && query.trim().length > 0) {
      patients = await searchPatients(query.trim(), scope);
    } else {
      patients = await getAllPatients(scope);
    }
    return NextResponse.json({ patients, total: patients.length });
  } catch (err) {
    logApiError('[API /patients GET]', err);
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
    const { createPatient } = await import('@/lib/services/patient-service');
    const { sanitizePayload } = await import('@/lib/validation');
    // Sanitize text fields to prevent stored XSS
    const sanitized = sanitizePayload(body);
    // Attach the creating user's orgId if not specified
    if (!sanitized.orgId && auth.orgId) sanitized.orgId = auth.orgId;
    sanitized.createdBy = auth.sub;
    const patient = await createPatient(sanitized as Parameters<typeof createPatient>[0]);
    return NextResponse.json({ patient }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ValidationError') {
      const ve = err as Error & { fields: Record<string, string> };
      return validationError(ve.fields);
    }
    logApiError('[API /patients POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'patient.create' });
