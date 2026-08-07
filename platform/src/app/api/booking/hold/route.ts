/**
 * POST /api/booking/hold
 *
 * Claims a slot for ten minutes while the patient fills in their details.
 *
 * Without this, two people can complete the same 10:30 form and one of them
 * gets a phone call. The hold is only a courtesy — `/api/booking/request`
 * recomputes availability for real before writing anything — so a lost or
 * expired hold costs a re-pick, never a double booking.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { holdSlot } from '@/lib/services/booking-service';
import { getVisitReasonById, getVisitReasonBySlug } from '@/lib/services/visit-reason-service';
import { resolvePractice, guardPublicRate } from '@/lib/booking/public-context';

export const dynamic = 'force-dynamic';

interface HoldBody {
  practice?: string;
  reason?: string;
  providerId?: string;
  date?: string;
  startTime?: string;
}

export async function POST(request: NextRequest) {
  // Tighter than the reads: a hold consumes a real slot for ten minutes, so a
  // script that fires these in a loop can empty a clinic's public diary.
  const limited = await guardPublicRate(request, 'hold', 12, 10 * 60_000);
  if (limited) return limited;

  let body: HoldBody;
  try {
    body = await request.json() as HoldBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const resolved = await resolvePractice(body.practice || '');
  if ('error' in resolved) return resolved.error;
  const { facilityId, orgId } = resolved.practice;

  const { providerId, date, startTime } = body;
  if (!providerId || !date || !startTime) {
    return NextResponse.json({ error: 'providerId, date and startTime are required' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) {
    return NextResponse.json({ error: 'Malformed date or time' }, { status: 400 });
  }

  const visitReason = await getVisitReasonById(body.reason || '')
    ?? await getVisitReasonBySlug(body.reason || '', orgId);
  if (!visitReason || !visitReason.isActive) {
    return NextResponse.json({ error: 'Visit reason not found' }, { status: 404 });
  }

  const hold = await holdSlot({
    orgId,
    facilityId,
    providerId,
    date,
    startTime,
    durationMinutes: visitReason.durationMinutes,
  });

  return NextResponse.json(hold);
}
