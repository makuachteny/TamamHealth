'use client';

/**
 * The Assessment section's structured half: the problems the clinician
 * INCLUDED from the Include Problems popup, rendered as diagnosis lines —
 * "Influenza (J11.1) Flu due to unidentified influenza virus · modified
 * 9 Dec, 2025" — above the free-text narrative.
 *
 * The lines come from the popup, not from an inline search: the reference
 * flow is deliberate — problems live on the chart's problem list, and the
 * assessment cites them rather than forking a second list.
 */

import { X } from '@/components/icons/lucide';
import type { NoteDiagnosis } from '@/lib/clinical-notes/types';

function modifiedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface AssessmentSectionProps {
  diagnoses: NoteDiagnosis[];
  readOnly: boolean;
  onChangeDiagnoses: (next: NoteDiagnosis[]) => void;
}

export default function AssessmentSection({
  diagnoses, readOnly, onChangeDiagnoses,
}: AssessmentSectionProps) {
  if (diagnoses.length === 0) return null;

  return (
    <div className="cn-dx">
      {diagnoses.map(dx => (
        <div key={dx.id} className="cn-dx-line">
          <span className="cn-dx-line-text">
            <strong>{dx.name}</strong>
            {dx.icd11Code && <> ({dx.icd11Code})</>}
            {dx.description && dx.description !== dx.name && <> {dx.description}</>}
            <span className="cn-dx-line-meta"> modified {modifiedDate(dx.addedAt)}</span>
          </span>
          {!readOnly && (
            <button
              type="button"
              className="cn-dx-remove"
              onClick={() => onChangeDiagnoses(diagnoses.filter(d => d.id !== dx.id))}
              aria-label={`Remove ${dx.name} from the assessment`}
              title={`Remove ${dx.name} from the assessment`}
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
