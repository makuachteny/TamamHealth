import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import crypto from 'crypto';
import type { UserRole } from '@/lib/db-types';

// Payment-link creation is a billing-side mutation; restricted to staff
// who handle billing/cashiering. Clinical roles can create them as well so
// a doctor can hand a patient a quick pay-now link at the bedside.
const PAYMENT_LINK_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'medical_superintendent',
  'front_desk', 'doctor', 'clinical_officer', 'nurse',
];

interface PaymentLinkRequest {
  patientId: string;
  amount: number;
  description: string;
  expiresInHours?: number;
}

interface PaymentLinkResponse {
  linkId: string;
  url: string;
  amount: number;
  currency: string;
  description: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'used';
  createdAt: string;
  patientId: string;
}

function generateLinkId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Default currency for payment links. Defaults to South Sudanese Pound (SSP)
 * for the demo deployment; override via `NEXT_PUBLIC_DEFAULT_CURRENCY` for
 * other countries.
 */
const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'SSP';

function generatePaymentUrl(linkId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tamamhealth.org';
  return `${baseUrl}/checkout/${linkId}`;
}

async function postHandler(req: NextRequest) {
  try {
    const auth = await getAuthPayload(req);
    if (!auth) return unauthorized();
    if (!hasRole(auth, PAYMENT_LINK_ROLES)) return forbidden();

    let body: PaymentLinkRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { patientId, amount, description, expiresInHours = 72 } = body;

    // Validate required fields
    if (!patientId || !amount || !description) {
      return NextResponse.json(
        {
          error:
            'patientId, amount, and description are required',
        },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate expiresInHours
    if (expiresInHours < 1 || expiresInHours > 720) {
      return NextResponse.json(
        { error: 'expiresInHours must be between 1 and 720' },
        { status: 400 }
      );
    }

    // Generate unique link ID
    const linkId = generateLinkId();

    // Calculate expiration time
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + expiresInHours * 60 * 60 * 1000);

    // Generate payment URL
    const paymentUrl = generatePaymentUrl(linkId);

    const response: PaymentLinkResponse = {
      linkId,
      url: paymentUrl,
      amount,
      currency: DEFAULT_CURRENCY,
      description,
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      createdAt: createdAt.toISOString(),
      patientId,
    };

    // In production, this would save the payment link to the database
    // Example: await PaymentLinkService.create({ linkId, patientId, amount, description, expiresAt })

    console.log('[Payment Link API] Payment link created:', {
      linkId,
      patientId,
      amount,
      expiresAt: expiresAt.toISOString(),
      timestamp: createdAt.toISOString(),
    });

    return NextResponse.json(response);
  } catch (error) {
    logApiError('[API /payment-link POST]', error);
    return serverError();
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthPayload(req);
    if (!auth) return unauthorized();
    if (!hasRole(auth, PAYMENT_LINK_ROLES)) return forbidden();

    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) {
      return NextResponse.json(
        { error: 'linkId query parameter is required' },
        { status: 400 }
      );
    }

    // In production, this would fetch the payment link from the database
    // and check its status (active, expired, or used)
    // Example: const link = await PaymentLinkService.getById(linkId)

    // Return a simulated response
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000);

    const response = {
      linkId,
      status: 'active',
      amount: 5000,
      currency: DEFAULT_CURRENCY,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      message: 'Use POST method to create a new payment link',
    };

    console.log('[Payment Link API] GET request for link:', {
      linkId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(response);
  } catch (error) {
    logApiError('[API /payment-link GET]', error);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'payment.link.create' });
