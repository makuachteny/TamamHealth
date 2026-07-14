'use client';

/**
 * Patient lists workspace panel — OpenMRS-style saved worklists. This app
 * has no saved-list feature, so the two lists shown are derived live from
 * real data already used elsewhere in the app (usePatients / useAppointments)
 * rather than inventing a list-definition data layer: "My patients" (this
 * clinician's hospital) and "Assigned to me" (patients with an appointment
 * where this clinician is the provider).
 */

import { useMemo } from 'react';
import { Users, ChevronRight } from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useAppointments } from '@/lib/hooks/useAppointments';
import type { ChartPanelRouter, ChartPanelUser } from './types';

interface PatientListsPanelProps {
  currentUser: ChartPanelUser | null | undefined;
  router: ChartPanelRouter;
  onClose: () => void;
}

export default function PatientListsPanel({ currentUser, router, onClose }: PatientListsPanelProps) {
  const { patients } = usePatients();
  const { appointments } = useAppointments();

  const myPatientsCount = useMemo(
    () => (patients || []).filter(p => p.registrationHospital === currentUser?.hospitalId).length,
    [patients, currentUser?.hospitalId],
  );

  const assignedToMeCount = useMemo(() => {
    if (!currentUser?._id) return 0;
    const ids = new Set((appointments || []).filter(a => a.providerId === currentUser._id).map(a => a.patientId));
    return ids.size;
  }, [appointments, currentUser?._id]);

  const lists = [
    { id: 'my-patients', name: 'My patients', type: `Hospital · ${currentUser?.hospitalName || '—'}`, count: myPatientsCount },
    { id: 'assigned-to-me', name: 'Assigned to me', type: 'Provider worklist', count: assignedToMeCount },
  ];

  const goToPatients = () => {
    router.push('/patients');
    onClose();
  };

  return (
    <div className="omrs-drawer-body">
      {lists.map(list => (
        <button key={list.id} type="button" className="omrs-panel-list-item" onClick={goToPatients}>
          <Users />
          <div style={{ flex: 1 }}>
            <div className="omrs-panel-row-main">{list.name}</div>
            <div className="omrs-panel-row-sub">{list.type}</div>
          </div>
          <span className="omrs-panel-list-count">{list.count}</span>
          <ChevronRight />
        </button>
      ))}
    </div>
  );
}
