import { NextRequest, NextResponse } from 'next/server';
import { withAuditLog } from '@/lib/audit/with-audit';
import { updatePaymentStatus } from '@/lib/services/payment-service';
import crypto from 'crypto';

/**
 * Optional HMAC verification, mirroring Flutterwave's pattern. Airtel Money's
 * callback signing varies by integration, so we accept an `x-auth-signature`
 * HMAC. If `AIRTEL_WEBHOOK_SECRET` is set we reject mismatches; if it isn't we
 * log a warning and proceed (preserving current dev behaviour).
 */
function verifyAirtelSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.AIRTEL_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Airtel Webhook] AIRTEL_WEBHOOK_SECRET not configured — skipping signature verification');
    return true;
  }
  if (!signature) {
    console.warn('[Airtel Webhook] Missing signature header while AIRTEL_WEBHOOK_SECRET is set');
    return false;
  }
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return computed === signature;
}

interface AirtelTransaction {
  id: string;
  status_code: string;
  message: string;
  airtel_money_id?: string;
  transaction_amount: number;
  transaction_currency_code: string;
  payment_date: string;
}

interface AirtelWebhookBody {
  transaction?: AirtelTransaction;
}

async function postHandler(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const signature = req.headers.get('x-auth-signature');
    if (!verifyAirtelSignature(rawBody, signature)) {
      console.warn('[Airtel Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body: AirtelWebhookBody;
    try {
      body = JSON.parse(rawBody) as AirtelWebhookBody;
    } catch {
      return NextResponse.json(
        { error: 'Invalid callback format' },
        { status: 400 }
      );
    }

    // Validate Airtel Money callback structure
    if (!body?.transaction) {
      return NextResponse.json(
        { error: 'Invalid callback format' },
        { status: 400 }
      );
    }

    const transaction = body.transaction;
    const {
      id,
      status_code,
      message,
      airtel_money_id,
      transaction_amount,
      transaction_currency_code,
      payment_date,
    } = transaction;

    // Airtel Money success status codes
    const successCodes = ['00', 'SUCCESS', 'success'];
    const isSuccessful = successCodes.includes(status_code);

    if (isSuccessful) {
      // Successful payment
      console.log('[Airtel Webhook] Payment received:', {
        transactionId: id,
        airtelMoneyId: airtel_money_id,
        amount: transaction_amount,
        currency: transaction_currency_code,
        paymentDate: payment_date,
        timestamp: new Date().toISOString(),
      });

      // Match the transaction id to the pending payment (stored as the
      // payment's `reference`) and mark it posted. Unknown match is logged but
      // still acked — never throw back at the gateway.
      try {
        const updated = await updatePaymentStatus(id, 'posted', { providerReference: airtel_money_id });
        if (!updated) {
          console.warn('[Airtel Webhook] No matching payment for reference:', id);
        }
      } catch (persistErr) {
        console.error('[Airtel Webhook] Failed to persist payment status:', persistErr);
      }

      return NextResponse.json({
        resultCode: 0,
        resultDesc: 'Accepted',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Payment failed or cancelled
      console.log('[Airtel Webhook] Payment failed:', {
        transactionId: id,
        statusCode: status_code,
        message,
        timestamp: new Date().toISOString(),
      });

      // Mark the matching payment failed; ack the gateway regardless.
      try {
        const updated = await updatePaymentStatus(id, 'failed', { reason: message });
        if (!updated) {
          console.warn('[Airtel Webhook] No matching payment for reference:', id);
        }
      } catch (persistErr) {
        console.error('[Airtel Webhook] Failed to persist payment status:', persistErr);
      }

      return NextResponse.json({
        resultCode: 0,
        resultDesc: 'Accepted',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[Airtel Webhook] Error processing callback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
export const POST = withAuditLog(postHandler, { action: 'webhook.airtel.receive' });
