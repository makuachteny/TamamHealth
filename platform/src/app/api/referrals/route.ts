/**
 * API: /api/referrals
 * GET  — List referrals (supports ?patientId=xxx&hospitalId=xxx)
 * POST — Create a new referral, accept a referral, or update status
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'midwife', 'medical_superintendent', 'front_desk',
];
const CREATE_ROLES: UserRole[] = [
  'super_admin', 'doctor', 'clinical_officer', 'nurse', 'midwife', 'medical_superintendent',
];
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    const {
      getAllReferrals, getReferralsByPatient, getReferralsByHospital,
    } = await import('@/lib/services/referral-service');
    const { buildScopeFromAuth, filterByScope } = await import('@/lib/services/data-scope');
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    const hospitalId = url.searchParams.get('hospitalId');
    let referrals;
    if (patientId) {
      const rows = await getReferralsByPatient(patientId);
      referrals = filterByScope(rows, buildScopeFromAuth(auth));
    } else if (hospitalId) {
      const rows = await getReferralsByHospital(hospitalId);
      referrals = filterByScope(rows, buildScopeFromAuth(auth));
    } else {
      const scope = buildScopeFromAuth(auth);
      referrals = await getAllReferrals(scope);
    }
    return NextResponse.json({ referrals, total: referrals.length });
  } catch (err) {
    logApiError('[API /referrals GET]', err);
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
    const action = body.action as string;
    // Accept a referral (transfers patient to receiving hospital)
    if (action === 'accept') {
      if (!body.referralId) {
        return NextResponse.json({ error: 'referralId is required' }, { status: 400 });
      }
      const { acceptReferral } = await import('@/lib/services/referral-service');
      const result = await acceptReferral(body.referralId as string);
      if (!result) return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
      return NextResponse.json({ referral: result });
    }
    // Update status
    if (action === 'update_status') {
      if (!body.referralId || !body.status) {
        return NextResponse.json(
          { error: 'referralId and status are required' },
          { status: 400 }
        );
      }
      const { updateReferralStatus } = await import('@/lib/services/referral-service');
      const result = await updateReferralStatus(
        body.referralId as string,
        body.status as Parameters<typeof updateReferralStatus>[1],
      );
      if (!result) return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
      return NextResponse.json({ referral: result });
    }
    // Create new referral
    if (!body.patientId || !body.toHospitalId || !body.reason) {
      return NextResponse.json(
        { error: 'patientId, toHospitalId, and reason are required' },
        { status: 400 }
      );
    }
    body.referredBy = body.referredBy || auth.sub;
    body.referredByName = body.referredByName || auth.name;
    if (!body.fromHospitalId && auth.hospitalId) body.fromHospitalId = auth.hospitalId;
    if (!body.orgId && auth.orgId) body.orgId = auth.orgId;
    const { createReferral } = await import('@/lib/services/referral-service');
    const referral = await createReferral(body as Parameters<typeof createReferral>[0]);
    return NextResponse.json({ referral }, { status: 201 });
  } catch (err) {
    logApiError('[API /referrals POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'referral.create' });
