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
    // Tenant guard: only dispense/update a prescription the caller's
    // org/facility owns. Without this, a pharmacist could mark another tenant's
    // prescription dispensed (diversion) or rewrite dose/medication by id.
    const { getPrescriptionById } = await import('@/lib/services/prescription-service');
    const { buildScopeFromAuth, filterByScope } = await import('@/lib/services/data-scope');
    const existingRx = await getPrescriptionById(id);
    if (!existingRx) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }
    if (filterByScope([existingRx], buildScopeFromAuth(auth)).length === 0) {
      return forbidden('Access denied to this prescription.');
    }
    // ── Dispense: one server-side transaction ──
    // Stock gate, FEFO decrement, controlled-substance register and the
    // prescription update all happen inside dispenseMedication(), which rolls
    // back anything already applied if a later step fails. The client can no
    // longer perform these as separate writes, so a half-finished dispense is
    // not reachable from the UI.
    if (body.status === 'dispensed' || body.action === 'dispense') {
      const { dispenseMedication, DispenseError } = await import('@/lib/services/dispensing-service');
      try {
        const result = await dispenseMedication({
          prescription: existingRx,
          quantity: Number(body.quantity) || existingRx.quantityToDispense || 1,
          dispenserId: auth.sub,
          dispenserName: auth.name,
          facilityId: existingRx.hospitalId || auth.hospitalId || '',
          facilityName: existingRx.hospitalName,
          orgId: existingRx.orgId ?? auth.orgId,
          witnessId: typeof body.witnessId === 'string' ? body.witnessId : undefined,
          witnessName: typeof body.witnessName === 'string' ? body.witnessName : undefined,
          // A short fill has to be asked for explicitly — see PARTIAL_NOT_ALLOWED.
          allowPartial: body.allowPartial === true,
          note: typeof body.note === 'string' ? body.note : undefined,
        });
        return NextResponse.json({
          prescription: result.prescription,
          allocations: result.allocations,
          quantityDispensed: result.quantityDispensed,
          outcome: result.outcome,
          controlledLogId: result.controlledLogId,
          controlledLogIds: result.controlledLogIds,
        });
      } catch (err) {
        if (err instanceof DispenseError) {
          // 409 for "the shelf says no" (stock/clearance/ambiguity — state the
          // caller must resolve before retrying), 400 for a bad request
          // (missing or unverifiable witness, nonsense quantity, unconfirmed
          // partial). The client shows the message either way, but the codes
          // stay meaningful.
          const status = err.code === 'STOCK_OUT' || err.code === 'INSUFFICIENT_STOCK'
            || err.code === 'NOT_CLEARED' || err.code === 'AMBIGUOUS_MEDICATION' ? 409 : 400;
          return NextResponse.json(
            { error: err.message, code: err.code, available: err.available },
            { status },
          );
        }
        throw err;
      }
    }

    // ── Unfilled outcomes: stock-out referral, or held for prescriber
    // clarification. Both keep the order active. ──
    if (body.action === 'stock_out' || body.action === 'request_clarification') {
      const { recordUnfilled } = await import('@/lib/services/dispensing-service');
      const updated = await recordUnfilled(
        existingRx,
        body.action === 'stock_out' ? 'stock_out' : 'clarification_requested',
        typeof body.note === 'string' ? body.note : '',
        { id: auth.sub, name: auth.name },
      );
      if (!updated) {
        return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
      }
      return NextResponse.json({ prescription: updated });
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
