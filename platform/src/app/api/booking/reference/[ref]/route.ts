/**
 * GET /api/booking/reference/[ref]
 *
 * Status lookup for the confirmation screen and for a patient returning to a
 * link days later.
 *
 * The reference is the only credential — so it is treated as one. It is minted
 * from `crypto.getRandomValues` over a 32-glyph alphabet (see
 * `generateBookingReference`), the lookup is rate limited to make guessing
 * expensive, and the response is deliberately thin: the visit's own details,
 * and nothing that would turn a lucky guess into a window on someone's chart.
 * No patient id, no phone, no notes, no other appointments.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { appointmentsDB } from '@/lib/db';
import { findByType } from '@/lib/services/db-query';
import type { AppointmentDoc } from '@/lib/db-types';
import { guardPublicRate } from '@/lib/booking/public-context';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  // Tight: this is the one endpoint where a correct guess returns something
  // about a real person, however little.
  const limited = await guardPublicRate(request, 'reference', 20, 10 * 60_000);
  if (limited) return limited;

  const { ref } = await params;
  if (!/^TMH-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(ref)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rows = await findByType<AppointmentDoc>(appointmentsDB(), 'appointment');
  const appointment = rows.find(a => a.bookingReference === ref);
  if (!appointment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    reference: ref,
    status: appointment.status,
    date: appointment.appointmentDate,
    startTime: appointment.appointmentTime,
    durationMinutes: appointment.duration,
    providerName: appointment.providerName,
    facilityName: appointment.facilityName,
    visitReasonName: appointment.visitReasonName || appointment.reason,
    // The requester's own first name, so the page can greet them and they can
    // tell at a glance that this is their booking and not a mistyped code.
    firstName: appointment.requester?.firstName,
  });
}
