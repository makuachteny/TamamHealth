/**
 * API: /api/prescriptions/:id
 * PATCH — Update (e.g., dispense) a prescription
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const WRITE_ROLES: UserRole[] = [
  'super_admin', 'doctor', 'clinical_officer', 'pharmacist', 'medical_superintendent',
];
async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, WRITE_ROLES)) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    // Check if this is a dispensing action
    if (body.status === 'dispensed') {
      const { dispensePrescription } = await import('@/lib/services/prescription-service');
      const dispensed = await dispensePrescription(id, auth.name);
      if (!dispensed) {
        return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
      }
      return NextResponse.json({ prescription: dispensed });
    }
    // Generic update
    delete body._id;
    delete body._rev;
    delete body.type;
    delete body.createdAt;
    const { updatePrescription } = await import('@/lib/services/prescription-service');
    const updated = await updatePrescription(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }
    return NextResponse.json({ prescription: updated });
  } catch (err) {
    logApiError('[API /prescriptions/:id PATCH]', err);
    return serverError();
  }
}
export const PATCH = withAuditLog(patchHandler, { action: 'prescription.update' });
