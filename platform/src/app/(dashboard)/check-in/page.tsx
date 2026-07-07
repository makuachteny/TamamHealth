'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import PatientCheckInForm from '@/components/check-in/PatientCheckInForm';
import { useApp } from '@/lib/context';

/**
 * Dedicated check-in route.
 *
 * Mounts the shared form in a modal shell so direct links and dashboard
 * actions use the same UI and submit flow.
 */
export default function CheckInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { currentUser } = useApp();

  if (!currentUser) return null;

  return (
    <Modal onClose={() => router.push('/dashboard/front-desk')} width={900} align="top">
      <div className="modal-content card-elevated" style={{ width: '100%' }}>
        <PatientCheckInForm
          mode="modal"
          preselectedPatientId={params?.get('patientId')}
          onCancel={() => router.push('/dashboard/front-desk')}
          onComplete={() => router.push('/dashboard/front-desk')}
          onRegisterPatient={() => router.push('/patients/new')}
        />
      </div>
    </Modal>
  );
}
