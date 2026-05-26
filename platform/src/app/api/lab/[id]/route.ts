/**
 * API: /api/lab/:id
 * PATCH — Update a lab result (enter results, mark complete, flag critical)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const WRITE_ROLES: UserRole[] = [
  'super_admin', 'doctor', 'clinical_officer', 'lab_tech', 'medical_superintendent',
];
async function patchHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    // Prevent overwriting immutable fields
    delete body._id;
    delete body._rev;
    delete body.type;
    delete body.createdAt;
    const { sanitizePayload } = await import('@/lib/validation');
    const sanitized = sanitizePayload(body);
    const { updateLabResult } = await import('@/lib/services/lab-service');
    const updated = await updateLabResult(params.id, sanitized);
    if (!updated) {
      return NextResponse.json({ error: 'Lab result not found' }, { status: 404 });
    }
    return NextResponse.json({ labResult: updated });
  } catch (err) {
    logApiError('[API /lab/:id PATCH]', err);
    return serverError();
  }
}
export const PATCH = withAuditLog(patchHandler, { action: 'lab.update' });
