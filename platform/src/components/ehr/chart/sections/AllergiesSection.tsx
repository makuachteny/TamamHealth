'use client';

/**
 * Allergies tab content — OpenMRS-style table (Allergen / Severity /
 * Reaction / Comments). Reuses the SAME data derivation AllergyList uses
 * (`patient.structuredAllergies`, falling back to the legacy
 * `patient.allergies` string list) and the SAME add flow (AddAllergyModal +
 * `allergy-service.addAllergy`) — no new data layer. The full AllergyList
 * widget (with inline edit/remove) still lives on the Conditions/Facesheet
 * views; this tab is the OpenMRS-shaped read+add view.
 */

import { useEffect, useMemo, useState } from 'react';
import ChartSection, { OmrsEmptyState } from '../ChartSection';
import AddAllergyModal from '@/components/patients/AddAllergyModal';
import { isNoAllergySentinel } from '@/lib/clinical-roles';
import { useApp } from '@/lib/context';
import type { PatientDoc } from '@/lib/db-types';
import type { AllergyEntry } from '@/data/mock';

const SEVERITY_LABEL: Record<string, string> = {
  severe: 'Severe', moderate: 'Moderate', mild: 'Mild', unknown: 'Unknown',
};

interface AllergiesSectionProps {
  patient: PatientDoc;
  /** One-shot request from the chart (e.g. the Facesheet Allergies card's
   *  "Add") to open the add-allergy modal as soon as this tab mounts. */
  autoOpenAdd?: boolean;
  onAutoOpenHandled?: () => void;
}

export default function AllergiesSection({ patient, autoOpenAdd, onAutoOpenHandled }: AllergiesSectionProps) {
  const { currentUser } = useApp();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (autoOpenAdd) {
      setAdding(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpenAdd, onAutoOpenHandled]);

  const entries = useMemo<AllergyEntry[]>(() => {
    if (patient.structuredAllergies !== undefined) return patient.structuredAllergies;
    return (patient.allergies || [])
      .filter(a => a && !isNoAllergySentinel(a))
      .map(substance => ({ id: substance, substance, criticality: 'unknown' as const, status: 'active' as const, recordedAt: '' }));
  }, [patient.structuredAllergies, patient.allergies]);

  const active = entries.filter(e => e.status === 'active');
  const author = { recordedBy: currentUser?._id, recordedByName: currentUser?.name || currentUser?.username };

  return (
    <>
      <ChartSection title="Allergies" addLabel="Add" onAdd={() => setAdding(true)}>
        {active.length === 0 ? (
          <OmrsEmptyState itemLabel="allergies" actionLabel="Record allergies" onAction={() => setAdding(true)} />
        ) : (
          <table className="omrs-table">
            <thead>
              <tr>
                <th>Allergen</th>
                <th>Severity</th>
                <th>Reaction</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {active.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.substance}</td>
                  <td>{SEVERITY_LABEL[a.criticality || 'unknown']}</td>
                  <td>{a.reaction || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{a.classification || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartSection>

      {adding && (
        <AddAllergyModal
          onClose={() => setAdding(false)}
          onSave={async input => {
            const svc = await import('@/lib/services/allergy-service');
            await svc.addAllergy(patient._id, { ...input, ...author });
          }}
        />
      )}
    </>
  );
}
