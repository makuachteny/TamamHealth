'use client';

import { useRouter } from 'next/navigation';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { ArrowUpRight } from '@/components/icons/lucide';

/**
 * Today's Appointments — flat feature card (dash-card treatment) for
 * front-desk / facility roles who manage the day's schedule (rather than a
 * single "next" appointment). Shows today's total plus a checked-in /
 * waiting breakdown.
 *
 * Renders nothing when there are no appointments today — an empty card is
 * dashboard noise (design cleanup); /appointments remains reachable from the
 * sidebar and quick actions.
 */
export default function TodaysAppointmentsCard({ className = '' }: { className?: string }) {
  const router = useRouter();
  const { appointments } = useAppointments();
  const today = new Date().toISOString().slice(0, 10);

  const todays = (appointments || []).filter(a => a.appointmentDate === today && a.status !== 'cancelled');
  const arrived = todays.filter(a => a.status === 'checked_in' || a.status === 'in_progress' || a.status === 'completed').length;
  const waiting = todays.length - arrived;

  if (todays.length === 0) return null;

  return (
    <div className={`dash-card flex flex-col justify-between ${className}`} style={{ minHeight: 188, padding: 22 }}>
      <div className="flex items-start justify-between">
        <span style={{ fontFamily: "var(--font-platform)", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Today&apos;s Appointments</span>
        <button
          onClick={() => router.push('/appointments')}
          className="flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
          style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--overlay-subtle)' }}
          aria-label="View all appointments"
          title="View all appointments"
        >
          <ArrowUpRight className="w-[16px] h-[16px]" style={{ color: 'var(--accent-primary)' }} />
        </button>
      </div>
      <div className="flex items-end gap-2">
        <span className="dash-stat__value tabular-nums" style={{ fontSize: 44 }}>{todays.length}</span>
        <span className="dash-stat__label mb-1.5">scheduled</span>
      </div>
      <div className="flex items-center gap-4" style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-full" style={{ width: 8, height: 8, background: 'var(--color-success)' }} /> {arrived} checked in
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-full" style={{ width: 8, height: 8, background: 'var(--text-muted)' }} /> {waiting} waiting
        </span>
      </div>
    </div>
  );
}
