import type { Metadata } from 'next';
import './booking.css';

/**
 * Public booking shell.
 *
 * No EHR top rail, no settings provider, no sidebar — the reader here is a
 * patient, not a member of staff, and none of the clinical chrome means
 * anything to them. The root layout still wraps this (Next always applies it),
 * but its PouchDB bootstrap is skipped for `/book/*` — see `AppProvider`.
 */
export const metadata: Metadata = {
  title: 'Book an appointment — TamamHealth',
  description: 'Request an appointment with your clinic.',
  // Link-only until the directory ships with real profile content and a
  // moderation owner. Cold search traffic to a half-filled profile page is
  // worse than no profile page — booking plan, §13.
  robots: { index: false, follow: false },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <div className="booking-root">{children}</div>;
}
