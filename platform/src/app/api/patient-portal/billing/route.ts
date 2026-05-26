import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyPatientToken(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const paymentMod = await import('@/lib/services/payment-service');
    const ledgerMod = await import('@/lib/services/ledger-service');

    const [payments, charges, plans, claims, policies, summary, balance, ledger] = await Promise.all([
      paymentMod.getPaymentsByPatient(auth.sub),
      paymentMod.getChargesByPatient(auth.sub),
      paymentMod.getPaymentPlansByPatient(auth.sub),
      paymentMod.getClaimsByPatient(auth.sub),
      paymentMod.getPatientInsurancePolicies(auth.sub),
      paymentMod.getPatientFinancialSummary(auth.sub),
      ledgerMod.getPatientBalance(auth.sub),
      ledgerMod.getPatientLedger(auth.sub, 30),
    ]);

    return NextResponse.json({ payments, charges, plans, claims, policies, summary, balance, ledger });
  } catch (err) {
    console.error('[patient-portal/billing]', err);
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 });
  }
}
