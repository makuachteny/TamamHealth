'use client';

import CareAlertsBanner from '@/components/patients/CareAlertsBanner';
import AllergyList from '@/components/patients/AllergyList';
import { patientAgeLabel } from '@/lib/patient-utils';
import type { PatientDoc } from '@/lib/db-types';

export default function MobileFacesheetTab({ patient }: { patient: PatientDoc }) {
  return (
    <div className="mobile-chart-tab-body">
      <CareAlertsBanner patient={patient} hideAddButton />
      <div className="mobile-chart-card">
        <h3>Demographics</h3>
        <div className="mobile-chart-kv-row"><span>Age</span><b>{patientAgeLabel(patient)}</b></div>
        <div className="mobile-chart-kv-row"><span>Gender</span><b>{patient.gender || '—'}</b></div>
        <div className="mobile-chart-kv-row"><span>Phone</span><b>{patient.phone || '—'}</b></div>
        <div className="mobile-chart-kv-row"><span>Location</span><b>{[patient.payam, patient.county, patient.state].filter(Boolean).join(', ') || '—'}</b></div>
      </div>
      <AllergyList patient={patient} hideAddButton />
    </div>
  );
}
