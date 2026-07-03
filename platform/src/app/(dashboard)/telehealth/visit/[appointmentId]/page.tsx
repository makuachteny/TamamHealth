'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useAppointments } from '@/lib/hooks/useAppointments';
import TelehealthVisitRoom from '@/components/telehealth/TelehealthVisitRoom';

export default function TelehealthVisitPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = use(params);
  const router = useRouter();
  const { currentUser } = useApp();
  const { appointments, loading } = useAppointments();

  const appointment = appointments.find(a => a._id === decodeURIComponent(appointmentId));
  const leave = () => router.push('/telehealth');

  if (loading && !appointment) {
    return (
      <main className="page-container page-enter">
        <div className="th-room th-room--loading"><p>Connecting to the telehealth visit…</p></div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main className="page-container page-enter">
        <div className="th-room th-room--loading">
          <p>That visit could not be found.</p>
          <button type="button" className="btn btn-secondary" onClick={() => router.push('/telehealth')}>Back to Telehealth</button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container page-enter">
      <TelehealthVisitRoom
        appointmentId={appointment._id}
        patientId={appointment.patientId}
        patientName={appointment.patientName}
        providerName={appointment.providerName || currentUser?.name || 'Provider'}
        chiefComplaint={appointment.reason || appointment.appointmentType}
        onLeave={leave}
      />
    </main>
  );
}
