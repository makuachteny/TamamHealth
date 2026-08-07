import { headers } from 'next/headers';
import { longWhen } from '@/lib/booking/public-client';

export const dynamic = 'force-dynamic';

interface Confirmation {
  reference: string;
  status: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  providerName: string;
  facilityName: string;
  visitReasonName: string;
  firstName?: string;
}

async function load(ref: string): Promise<Confirmation | null> {
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/booking/reference/${encodeURIComponent(ref)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json() as Confirmation;
  } catch {
    return null;
  }
}

/**
 * Status page for a booking reference.
 *
 * Reachable by anyone holding the reference, which is why the endpoint behind
 * it returns so little. A wrong code gets the same neutral message as an
 * expired one — there is nothing here to tell a guesser they are close.
 */
export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const data = await load(reference);

  if (!data) {
    return (
      <div className="booking-page booking-confirm">
        <section className="booking-card">
          <div className="booking-card-body">
            <h1 className="booking-h1" style={{ fontSize: 22 }}>We couldn&rsquo;t find that booking</h1>
            <p className="booking-hint">
              Check the reference from your confirmation message, or call the practice.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const confirmed = data.status === 'scheduled' || data.status === 'confirmed';

  return (
    <div className="booking-page booking-confirm">
      <section className="booking-card">
        <header className="booking-card-head">
          {confirmed ? 'Appointment confirmed' : 'Appointment requested'}
        </header>
        <div className="booking-card-body">
          {data.firstName && <p className="booking-hint" style={{ fontSize: 15 }}>Hello {data.firstName},</p>}
          <p className="booking-hint" style={{ fontSize: 15 }}>
            {confirmed
              ? 'Your appointment is booked. Please arrive a few minutes early.'
              : 'Your request has been sent to the practice. They will confirm it shortly.'}
          </p>
          <div className="booking-reference">{data.reference}</div>
          <div className="booking-divider" />
          <b style={{ fontSize: 18 }}>{longWhen(data.date, data.startTime)}</b>
          <span className="booking-hint">
            {data.visitReasonName} · {data.durationMinutes} min
          </span>
          <span className="booking-hint">
            {data.providerName} · {data.facilityName}
          </span>
          <div className="booking-divider" />
          <p className="booking-hint">
            To change or cancel, call the practice and quote your reference.
          </p>
        </div>
      </section>
    </div>
  );
}
