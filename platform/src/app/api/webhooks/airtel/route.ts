import { NextRequest, NextResponse } from 'next/server';
import { withAuditLog } from '@/lib/audit/with-audit';

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
    const body: AirtelWebhookBody = await req.json();

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

      // In production, this would match the transaction ID to a pending payment
      // and update the payment status via the payment service
      // Example: await PaymentService.updatePaymentStatus(id, 'completed', { amount: transaction_amount, receipt: airtel_money_id })

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

      // In production, update payment status to failed
      // Example: await PaymentService.updatePaymentStatus(id, 'failed', { reason: message })

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
