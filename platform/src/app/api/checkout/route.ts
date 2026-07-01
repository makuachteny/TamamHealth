import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuditLog } from '@/lib/audit/with-audit';
import { logApiError, serverError } from '@/lib/api-auth';
import type { PaymentDoc, PaymentStatus, PaymentMethodType } from '@/lib/db-types-payments';

/**
 * Public checkout helper for the pay-by-link flow.
 *
 * This route is intentionally UNAUTHENTICATED (see proxy.ts) — a patient
 * or payer opens a link we handed them, so there is no staff session. To avoid
 * leaking PHI it exposes only what a payer needs to pay:
 *
 *   GET  ?linkId=…  → { amount, currency, description, status, expiresAt }
 *                     (NO patientId, NO facility/org ids, NO created-by, NO _id)
 *   POST            → records a *pending* payment tied to the link's reference
 *                     and returns that reference.
 *
 * The actual confirmation is done out-of-band by the payment-gateway webhook
 * (M-Pesa / Airtel / Flutterwave), which matches on `reference` and flips the
 * payment to `posted`. This route never fabricates a completed/posted status.
 */

// Mirror the patient-portal UI method keys onto the canonical PaymentMethodType
// union so the recorded payment is reconcilable with the rest of the system.
const METHOD_MAP: Record<string, PaymentMethodType> = {
  mpesa: 'mpesa',
  mtn: 'mtn_momo',
  airtel: 'airtel',
  m_gurush: 'm_gurush',
  card: 'card',
  bank: 'bank_transfer',
  cash: 'cash',
};

function isExpired(expiresAt?: string): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() < Date.now();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId') || searchParams.get('id');

    if (!linkId) {
      return NextResponse.json(
        { error: 'linkId query parameter is required' },
        { status: 400 }
      );
    }

    const { getPaymentLink } = await import('@/lib/services/payment-service');
    const link = await getPaymentLink(linkId);

    if (!link) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Minimal, payer-facing projection only. Deliberately omit patientId,
    // facilityId, orgId, createdBy, url and the raw doc id so a public link
    // can never be used to enumerate or harvest patient/facility identifiers.
    return NextResponse.json({
      linkId: link.linkId,
      status: link.status,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      expiresAt: link.expiresAt,
    });
  } catch (error) {
    logApiError('[API /checkout GET]', error);
    return serverError();
  }
}

async function postHandler(req: NextRequest) {
  try {
    let body: { linkId?: string; method?: string; payerPhone?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { linkId, method, payerPhone } = body;
    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    const { getPaymentLink } = await import('@/lib/services/payment-service');
    const link = await getPaymentLink(linkId);

    if (!link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    // Refuse to record intent against a link that can't take a payment.
    if (link.status === 'used') {
      return NextResponse.json({ error: 'This payment link has already been paid', status: 'used' }, { status: 409 });
    }
    if (link.status === 'expired' || isExpired(link.expiresAt)) {
      return NextResponse.json({ error: 'This payment link has expired', status: 'expired' }, { status: 409 });
    }

    const paymentMethod: PaymentMethodType =
      (method && METHOD_MAP[method]) || 'mobile_money' as PaymentMethodType;

    // The reference is what the gateway webhook will match on to confirm the
    // payment. We derive it from the link id so reconciliation is traceable
    // back to this specific pay-by-link.
    const reference = `PBL-${link.linkId.slice(0, 8).toUpperCase()}-${uuidv4().slice(0, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    // Write a PENDING payment directly (we deliberately do NOT call
    // collectPayment, which would post it to the ledger as completed). The
    // payment carries the link's patientId server-side for staff reconciliation,
    // but that id is never returned to the public caller.
    const { paymentsDB } = await import('@/lib/db');
    const db = paymentsDB();
    const doc: PaymentDoc = {
      _id: `pmt-${uuidv4().slice(0, 10)}`,
      type: 'payment',
      patientId: link.patientId,
      patientName: '',
      method: paymentMethod,
      amount: link.amount,
      currency: link.currency,
      reference,
      mobileMoneyPhone: typeof payerPhone === 'string' && payerPhone ? payerPhone : undefined,
      status: 'pending' as PaymentStatus,
      processedAt: now,
      processedBy: 'pay-by-link',
      processedByName: 'Pay-by-link (payer self-service)',
      notes: `[PAY_BY_LINK] pending_verification — awaiting payment-gateway confirmation. Link ${link.linkId}: ${link.description}`,
      facilityId: link.facilityId,
      orgId: link.orgId,
      createdAt: now,
      updatedAt: now,
      createdBy: 'pay-by-link',
    };

    const resp = await db.put(doc);
    doc._rev = resp.rev;

    const { logAuditSafe } = await import('@/lib/services/audit-service');
    await logAuditSafe(
      'PAY_BY_LINK_SUBMITTED', 'pay-by-link', 'Pay-by-link',
      `Pending payment ${doc._id} (ref ${reference}) recorded for link ${link.linkId}: ${link.amount} ${link.currency}`
    );

    const { emitSyncEvent } = await import('@/lib/services/sync-event-service');
    emitSyncEvent({
      resourceType: 'payment',
      resourceId: doc._id,
      operation: 'create',
      resourceVersion: doc._rev,
      orgId: doc.orgId,
      hospitalId: doc.facilityId,
    });

    return NextResponse.json(
      { ok: true, reference, status: 'pending' },
      { status: 201 }
    );
  } catch (error) {
    logApiError('[API /checkout POST]', error);
    return serverError();
  }
}

export const POST = withAuditLog(postHandler, { action: 'checkout.payment.submit' });
