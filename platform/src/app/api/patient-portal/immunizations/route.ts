import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyPatientToken(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { getByPatient } = await import('@/lib/services/immunization-service');
    const immunizations = await getByPatient(auth.sub);
    return NextResponse.json({ immunizations });
  } catch (err) {
    console.error('[patient-portal/immunizations]', err);
    return NextResponse.json({ error: 'Failed to fetch immunizations' }, { status: 500 });
  }
}
