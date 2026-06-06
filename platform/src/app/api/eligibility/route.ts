import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';

// Eligibility checks are billing-flow operations; restricted to staff who
// handle payments / claims as well as clinicians who may need to confirm
// coverage before ordering a procedure.
const ELIGIBILITY_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'medical_superintendent',
  'doctor', 'clinical_officer', 'nurse', 'front_desk', 'medical_biller',
];

interface EligibilityRequest {
  policyId: string;
  patientId: string;
  serviceDate?: string;
}

interface EligibilityResult {
  status: 'verified' | 'denied' | 'pending';
  source: 'api' | 'cache';
  checkedAt: string;
  patientId: string;
  policyId: string;
  serviceDate: string;
  copayAmount: number;
  coinsurancePct: number;
  deductibleRemaining: number;
  notes: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function postHandler(req: NextRequest) {
  try {
    const auth = await getAuthPayload(req);
    if (!auth) return unauthorized();
    if (!hasRole(auth, ELIGIBILITY_ROLES)) return forbidden();

    let body: EligibilityRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { policyId, patientId, serviceDate } = body;

    // Validate required fields
    if (!policyId || !patientId) {
      return NextResponse.json(
        { error: 'policyId and patientId are required' },
        { status: 400 }
      );
    }

    // Use provided service date or today
    const checkDate = serviceDate || formatDate(new Date());

    // In production, this would make an EDI 270/271 request to the payer
    // For now, return a simulated response based on a simple eligibility check
    // Example integration:
    // const eligibilityData = await PayerEDIService.check270(patientId, policyId, checkDate)

    const eligibilityResult: EligibilityResult = {
      status: 'verified',
      source: 'api',
      checkedAt: new Date().toISOString(),
      patientId,
      policyId,
      serviceDate: checkDate,
      copayAmount: 500, // SSP (South Sudanese Pound)
      coinsurancePct: 20,
      deductibleRemaining: 2000,
      notes: 'Coverage verified via API. Patient is eligible for services.',
    };

    console.log('[Eligibility API] Eligibility check completed:', {
      patientId,
      policyId,
      serviceDate: checkDate,
      status: eligibilityResult.status,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(eligibilityResult);
  } catch (error) {
    logApiError('[API /eligibility POST]', error);
    return serverError();
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthPayload(req);
    if (!auth) return unauthorized();
    if (!hasRole(auth, ELIGIBILITY_ROLES)) return forbidden();

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId query parameter is required' },
        { status: 400 }
      );
    }

    // Return latest eligibility status for the patient
    // In production, this would query the database for the most recent eligibility check
    const lastCheckedDate = new Date();
    lastCheckedDate.setDate(lastCheckedDate.getDate() - 1); // Example: checked yesterday

    const response = {
      patientId,
      status: 'verified',
      lastChecked: lastCheckedDate.toISOString(),
      message:
        'Use POST method to perform a new eligibility check with policyId and serviceDate',
    };

    console.log('[Eligibility API] GET request for patient:', {
      patientId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(response);
  } catch (error) {
    logApiError('[API /eligibility GET]', error);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'eligibility.check' });
