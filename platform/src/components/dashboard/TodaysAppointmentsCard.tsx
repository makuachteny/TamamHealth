'use client';

import { useRouter } from 'next/navigation';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { ArrowUpRight } from '@/components/icons/lucide';

/**
 * Today's Appointments — gradient feature card for front-desk / facility roles
 * who manage the day's schedule (rather than a single "next" appointment).
 * Shows today's total plus a checked-in / waiting breakdown.
 */
export default function TodaysAppointmentsCard({ className = '' }: { className?: string }) {
  const router = useRouter();
  const { appointments } = useAppointments();
  const today = new Date().toISOString().slice(0, 10);

  const todays = (appointments || []).filter(a => a.appointmentDate === today && a.status !== 'cancelled');
  const arrived = todays.filter(a => a.status === 'checked_in' || a.status === 'in_progress' || a.status === 'completed').length;
  const waiting = todays.length - arrived;

  return (
    <div className={`hero-banner flex flex-col justify-between ${className}`} style={{ minHeight: 188, padding: 22 }}>
      <div className="relative z-[1] flex items-start justify-between">
        <span style={{ fontFamily: "var(--font-platform)", fontWeight: 600, fontSize: 17, color: '#fff' }}>Today&apos;s Appointments</span>
        <button
          onClick={() => router.push('/appointments')}
          className="flex items-center justify-center flex-shrink-0 transition-transform"
          style={{ width: 37, height: 37, borderRadius: 10, background: '#fff' }}
          aria-label="View all appointments"
          title="View all appointments"
        >
          <ArrowUpRight className="w-[18px] h-[18px]" style={{ color: 'var(--accent-primary)' }} />
        </button>
      </div>
      {todays.length > 0 ? (
        <>
          <div className="relative z-[1] flex items-end gap-2">
            <span style={{ fontFamily: "var(--font-platform)", fontWeight: 700, fontSize: 56, lineHeight: 1 }}>{todays.length}</span>
            <span className="mb-2" style={{ fontFamily: "var(--font-platform)", fontWeight: 300, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>scheduled</span>
          </div>
          <div className="relative z-[1] flex items-center gap-4" style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full" style={{ width: 10, height: 10, background: 'var(--color-success)' }} /> {arrived} checked in
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full" style={{ width: 10, height: 10, background: 'rgba(255,255,255,0.7)' }} /> {waiting} waiting
            </span>
          </div>
        </>
      ) : (
        <div className="relative z-[1] flex-1 flex items-center" style={{ fontFamily: "var(--font-platform)", fontWeight: 300, fontSize: 14, color: 'rgba(255,255,255,0.88)' }}>
          No appointments scheduled for today.
        </div>
      )}
    </div>
  );
}
