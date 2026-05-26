import { NextRequest, NextResponse } from 'next/server';
import { verifyPatientToken } from '@/lib/patient-portal-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyPatientToken(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { getRecordsByPatient } = await import('@/lib/services/medical-record-service');
    const records = await getRecordsByPatient(auth.sub);
    return NextResponse.json({ records });
  } catch (err) {
    console.error('[patient-portal/records]', err);
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
  }
}
