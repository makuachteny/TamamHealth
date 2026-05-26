import { NextRequest, NextResponse } from 'next/server';
import { withAuditLog } from '@/lib/audit/with-audit';

interface CallbackMetadataItem {
  Name: string;
  Value: string | number;
}

interface STKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item: CallbackMetadataItem[];
  };
}

interface MPesaWebhookBody {
  Body?: {
    stkCallback: STKCallback;
  };
}

async function postHandler(req: NextRequest) {
  try {
    const body: MPesaWebhookBody = await req.json();

    // Validate M-Pesa STK Push callback structure
    if (!body?.Body?.stkCallback) {
      return NextResponse.json(
        { error: 'Invalid callback format' },
        { status: 400 }
      );
    }

    const callback = body.Body.stkCallback;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;
    const checkoutRequestId = callback.CheckoutRequestID;
    const merchantRequestId = callback.MerchantRequestID;

    if (resultCode === 0) {
      // Successful payment — extract metadata
      const items = callback.CallbackMetadata?.Item || [];
      const amount = items.find((i) => i.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = items.find(
        (i) => i.Name === 'MpesaReceiptNumber'
      )?.Value;
      const phoneNumber = items.find((i) => i.Name === 'PhoneNumber')?.Value;
      const transactionDate = items.find(
        (i) => i.Name === 'TransactionDate'
      )?.Value;

      // Log the successful payment for processing
      console.log('[M-Pesa Webhook] Payment received:', {
        checkoutRequestId,
        merchantRequestId,
        amount,
        mpesaReceiptNumber,
        phoneNumber,
        transactionDate,
        timestamp: new Date().toISOString(),
      });

      // In production, this would match the checkoutRequestId to a pending payment
      // and update the payment status via the payment service
      // Example: await PaymentService.updatePaymentStatus(checkoutRequestId, 'completed', { amount, receipt: mpesaReceiptNumber })

      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });
    } else {
      // Payment failed or cancelled
      console.log('[M-Pesa Webhook] Payment failed:', {
        resultCode,
        resultDesc,
        checkoutRequestId,
        merchantRequestId,
        timestamp: new Date().toISOString(),
      });

      // In production, update payment status to failed
      // Example: await PaymentService.updatePaymentStatus(checkoutRequestId, 'failed', { reason: resultDesc })

      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });
    }
  } catch (error) {
    console.error('[M-Pesa Webhook] Error processing callback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
export const POST = withAuditLog(postHandler, { action: 'webhook.mpesa.receive' });
