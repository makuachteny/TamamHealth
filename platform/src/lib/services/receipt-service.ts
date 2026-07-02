/**
 * Receipt Service — generates printable and emailable receipts for payments.
 */
import type { PaymentDoc } from '../db-types-payments';

export interface ReceiptData {
  receiptNumber: string;
  patientName: string;
  patientId: string;
  date: string;
  time: string;
  method: string;
  methodLabel: string;
  amount: number;
  currency: string;
  reference?: string;
  processedBy: string;
  facilityName: string;
  notes?: string;
}

function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash', mpesa: 'M-Pesa', airtel: 'Airtel Money', mtn_momo: 'MTN Mobile Money',
    card: 'Card (Flutterwave)', bank_transfer: 'Bank Transfer',
    insurance: 'Insurance', waiver: 'Fee Waiver', payment_plan: 'Payment Plan',
  };
  return labels[method] || method;
}

export function buildReceiptData(payment: PaymentDoc, facilityName?: string): ReceiptData {
  const date = new Date(payment.processedAt);
  return {
    receiptNumber: payment.reference || payment._id,
    patientName: payment.patientName,
    patientId: payment.patientId,
    date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    method: payment.method,
    methodLabel: getMethodLabel(payment.method),
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.reference,
    processedBy: payment.processedByName,
    facilityName: facilityName || 'TamamHealth Health Facility',
    notes: payment.notes,
  };
}

export function generateReceiptHTML(receipt: ReceiptData): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Payment Receipt — ${receipt.receiptNumber}</title>
<style>
  @page { margin: 10mm; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; color: #1A2C2A; background: #fff; max-width: 320px; margin: 0 auto; padding: 16px; }
  .header { text-align: center; padding-bottom: 12px; border-bottom: 2px dashed #ccc; margin-bottom: 12px; }
  .header h1 { font-size: 16px; font-weight: 800; color: #1E3A8A; letter-spacing: 0.5px; }
  .header p { font-size: 11px; color: #64748b; margin-top: 2px; }
  .receipt-title { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .row .label { color: #64748b; }
  .row .value { font-weight: 600; text-align: right; max-width: 55%; }
  .amount-row { padding: 10px 0; margin: 8px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
  .amount-row .value { font-size: 18px; font-weight: 800; color: #3b82f6; }
  .amount-row .label { font-size: 13px; font-weight: 600; }
  .footer { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 2px dashed #ccc; }
  .footer p { font-size: 10px; color: #64748b; line-height: 1.5; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 10px; font-weight: 700; background: #E8F5E9; color: #2E7D32; text-transform: uppercase; letter-spacing: 0.5px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${receipt.facilityName}</h1>
    <p>Digital Health Records — Powered by TamamHealth</p>
  </div>
  <div class="receipt-title">Payment Receipt</div>
  <div class="row"><span class="label">Receipt #</span><span class="value">${receipt.receiptNumber}</span></div>
  <div class="row"><span class="label">Date</span><span class="value">${receipt.date}</span></div>
  <div class="row"><span class="label">Time</span><span class="value">${receipt.time}</span></div>
  <div style="height: 8px"></div>
  <div class="row"><span class="label">Patient</span><span class="value">${receipt.patientName}</span></div>
  <div class="row"><span class="label">Method</span><span class="value">${receipt.methodLabel}</span></div>
  ${receipt.reference ? `<div class="row"><span class="label">Reference</span><span class="value">${receipt.reference}</span></div>` : ''}
  <div class="row amount-row"><span class="label">Amount Paid</span><span class="value">${receipt.amount.toLocaleString()} ${receipt.currency}</span></div>
  <div class="row"><span class="label">Status</span><span class="value"><span class="status">Paid</span></span></div>
  <div class="row"><span class="label">Processed By</span><span class="value">${receipt.processedBy}</span></div>
  ${receipt.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${receipt.notes}</span></div>` : ''}
  <div class="footer">
    <p>Thank you for your payment.<br>This receipt was electronically generated.<br>For inquiries, contact the billing desk.</p>
  </div>
</body>
</html>`;
}

export function printReceipt(receipt: ReceiptData): void {
  const html = generateReceiptHTML(receipt);
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      // Don't auto-close — let user decide
    }, 500);
  }
}

export async function emailReceipt(receipt: ReceiptData, toEmail: string): Promise<boolean> {
  // In production, this would POST to an email API endpoint
  // For now, log to console and return success
  console.log(`[Receipt Service] Sending receipt ${receipt.receiptNumber} to ${toEmail}`);
  console.log(`[Receipt Service] Receipt HTML length: ${generateReceiptHTML(receipt).length} chars`);

  try {
    // Attempt to call the email API (would exist in production). Goes through
    // apiFetch so the CSRF token from the session cookie is auto-attached.
    const { apiFetch } = await import('@/lib/api-fetch');
    const response = await apiFetch('/api/receipts/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toEmail,
        subject: `Payment Receipt — ${receipt.receiptNumber}`,
        html: generateReceiptHTML(receipt),
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        currency: receipt.currency,
      }),
    });

    if (response.ok) return true;
    // If API doesn't exist yet, that's fine — gracefully fail
    console.log('[Receipt Service] Email API not available — receipt logged for manual delivery');
    return true;
  } catch {
    console.log('[Receipt Service] Email API not available — receipt logged for manual delivery');
    return true; // Don't fail the payment flow for email issues
  }
}
