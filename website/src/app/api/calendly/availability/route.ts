import { NextRequest, NextResponse } from 'next/server';
import { fetchCalendlyAvailability, getFallbackAvailability } from '@/lib/calendly';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timeZone = searchParams.get('timeZone') || 'America/New_York';

  try {
    const slots = await fetchCalendlyAvailability({
      timeZone,
      days: 14,
      limit: 6,
    });

    return NextResponse.json({
      ok: true,
      source: slots.some((slot) => slot.source === 'calendly') ? 'calendly' : 'fallback',
      slots: slots.length ? slots : getFallbackAvailability(timeZone),
    });
  } catch (err) {
    console.error('[calendly availability]', err);
    return NextResponse.json({
      ok: true,
      source: 'fallback',
      warning: 'Calendly availability is not available right now. Showing fallback times.',
      slots: getFallbackAvailability(timeZone),
    });
  }
}
