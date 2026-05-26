import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyPatientToken(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { getLabResultsByPatient } = await import('@/lib/services/lab-service');
    const results = await getLabResultsByPatient(auth.sub);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[patient-portal/labs]', err);
    return NextResponse.json({ error: 'Failed to fetch lab results' }, { status: 500 });
  }
}
