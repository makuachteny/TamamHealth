'use client';

/**
 * Clinical forms workspace panel — a searchable list of this app's real
 * clinical entry points (OpenMRS calls these "form templates"; this app
 * doesn't have a form-template registry, so the list below points at the
 * actual pages/flows that create each kind of record). "Last completed" is
 * derived from the same hooks the rest of the chart already uses for this
 * patient — no invented data, and destinations that don't support a
 * `?patientId=` deep-link are still linked to (routing to the existing
 * full-page flow) rather than fabricating a pre-filled form.
 */

import { useMemo, useState } from 'react';
import { Search, ChevronRight, FileText } from '@/components/icons/lucide';
import { useMedicalRecords } from '@/lib/hooks/useMedicalRecords';
import { useTriage } from '@/lib/hooks/useTriage';
import { useANC } from '@/lib/hooks/useANC';
import { useNutritionScreenings } from '@/lib/hooks/useNutritionScreenings';
import { useWards } from '@/lib/hooks/useWards';
import { formatDate } from '@/lib/format-utils';
import type { PatientDoc } from '@/lib/db-types';
import type { ChartPanelRouter } from './types';

interface ClinicalFormsPanelProps {
  patient: PatientDoc;
  router: ChartPanelRouter;
  canConsult: boolean;
  onClose: () => void;
}

export default function ClinicalFormsPanel({ patient, router, canConsult, onClose }: ClinicalFormsPanelProps) {
  const [search, setSearch] = useState('');
  const { records } = useMedicalRecords(patient._id);
  const { triages } = useTriage(patient._id);
  const { visits: ancVisits } = useANC();
  const { screenings } = useNutritionScreenings();
  const { admissions } = useWards();

  const patientANC = (ancVisits || []).filter(a => a.patientId === patient._id);
  const patientScreenings = (screenings || []).filter(s => s.patientId === patient._id);
  const patientAdmissions = (admissions || []).filter(a => a.patientId === patient._id);

  const forms = useMemo(() => {
    const lastRecord = records[0];
    const lastTriage = triages[0];
    const lastANC = [...patientANC].sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''))[0];
    const lastScreening = [...patientScreenings].sort((a, b) => (b.screeningDate || '').localeCompare(a.screeningDate || ''))[0];
    const lastAdmission = [...patientAdmissions].sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''))[0];

    return [
      {
        id: 'consultation',
        name: 'Consultation / SOAP Note',
        lastCompleted: lastRecord ? formatDate(lastRecord.consultedAt || lastRecord.visitDate) : 'Never',
        href: `/consultation?patientId=${patient._id}`,
        enabled: canConsult,
      },
      {
        id: 'triage',
        name: 'Triage / ETAT Assessment',
        lastCompleted: lastTriage ? formatDate(lastTriage.triagedAt) : 'Never',
        href: `/check-in?patientId=${patient._id}`,
        enabled: true,
      },
      {
        id: 'anc',
        name: 'ANC Visit',
        lastCompleted: lastANC ? formatDate(lastANC.visitDate) : 'Never',
        href: `/anc?patientId=${patient._id}`,
        enabled: true,
      },
      {
        id: 'nutrition',
        name: 'Nutrition Screening',
        lastCompleted: lastScreening ? formatDate(lastScreening.screeningDate) : 'Never',
        href: `/dashboard/nutrition?patientId=${patient._id}`,
        enabled: true,
      },
      {
        id: 'ward-admission',
        name: 'Ward Admission',
        lastCompleted: lastAdmission ? formatDate(lastAdmission.admissionDate) : 'Never',
        href: `/wards?patientId=${patient._id}`,
        enabled: true,
      },
    ];
  }, [records, triages, patientANC, patientScreenings, patientAdmissions, patient._id, canConsult]);

  const filtered = forms.filter(f => f.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="omrs-drawer-body">
      <div className="omrs-panel-search-wrap">
        <Search />
        <input
          type="text"
          className="omrs-panel-search"
          placeholder="Search clinical forms…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <p className="omrs-panel-empty">No forms match &quot;{search}&quot;.</p>
      )}

      {filtered.map(f => (
        <button
          key={f.id}
          type="button"
          className="omrs-panel-list-item"
          disabled={!f.enabled}
          title={f.enabled ? undefined : 'Requires consultation permission'}
          style={f.enabled ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
          onClick={() => { if (f.enabled) { router.push(f.href); onClose(); } }}
        >
          <FileText />
          <div style={{ flex: 1 }}>
            <div className="omrs-panel-row-main">{f.name}</div>
            <div className="omrs-panel-row-sub">Last completed: {f.lastCompleted}</div>
          </div>
          <ChevronRight />
        </button>
      ))}
    </div>
  );
}
