import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyPatientToken(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { getPrescriptionsByPatient } = await import('@/lib/services/prescription-service');
    const prescriptions = await getPrescriptionsByPatient(auth.sub);
    return NextResponse.json({ prescriptions });
  } catch (err) {
    console.error('[patient-portal/prescriptions]', err);
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 });
  }
}
