'use client';

import type { PatientDoc, ProblemDoc, PrescriptionDoc } from '@/lib/db-types';
import { ClipboardList, Pill } from '@/components/icons/lucide';
import AllergyList from './AllergyList';
import DirectiveList from './DirectiveList';

/**
 * Unified patient chart summary (P1.3) — the at-a-glance "chart desktop" view
 * modelled on Centricity's five summary windows: Problems, Medications,
 * Allergies and Directives shown together, each with inline add/remove. It sits
 * at the top of the patient overview so a clinician sees the same active lists
 * everywhere, every visit.
 */
export default function ChartSummaryPanel({
  patient,
  problems,
  prescriptions,
  onOpenProblems,
  hideListAddButtons = false,
}: {
  patient: PatientDoc;
  problems: ProblemDoc[];
  prescriptions: PrescriptionDoc[];
  onOpenProblems?: () => void;
  /** Suppress the inline Allergy/Directive "Add" buttons when the add controls
   * are hosted in a shared toolbar (ChartSafetyActions). */
  hideListAddButtons?: boolean;
}) {
  const activeProblems = problems.filter((p) => p.status === 'active' || p.status === 'chronic');
  // Current medications: not yet dispensed/complete, newest first.
  const currentMeds = prescriptions
    .filter((rx) => rx.status !== 'dispensed')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 8);

  const windowBox = 'rounded-xl p-3.5';
  const windowStyle = { background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' } as const;
  const headStyle = 'text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5';

  return (
    <div className="card-elevated lg:col-span-3 lg:order-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm" style={{ letterSpacing: -0.1 }}>Chart summary</h3>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Active problems, medications, allergies &amp; directives</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Problems */}
        <div className={windowBox} style={windowStyle}>
          <p className={headStyle} style={{ color: 'var(--text-muted)' }}>
            <ClipboardList className="w-3 h-3" style={{ color: 'var(--tamamhealth-blue)' }} /> Problems
            {onOpenProblems && (
              <button onClick={onOpenProblems} className="ml-auto text-[10px] font-semibold" style={{ color: 'var(--tamamhealth-blue)' }}>Manage</button>
            )}
          </p>
          {activeProblems.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No active problems.</p>
          ) : (
            <ul className="space-y-1" style={{ maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
              {activeProblems.map((p) => (
                <li key={p._id} className="text-xs flex items-center gap-2">
                  {(p.icd11Code || p.icd10Code) && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)' }}>
                      {p.icd11Code || p.icd10Code}
                    </span>
                  )}
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  {p.status === 'chronic' && <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>chronic</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Medications */}
        <div className={windowBox} style={windowStyle}>
          <p className={headStyle} style={{ color: 'var(--text-muted)' }}>
            <Pill className="w-3 h-3" style={{ color: '#3B82F6' }} /> Current medications
          </p>
          {currentMeds.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None active.</p>
          ) : (
            <ul className="space-y-1" style={{ maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
              {currentMeds.map((rx) => (
                <li key={rx._id} className="text-xs">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{rx.medication}</span>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>· {rx.dose} · {rx.frequency}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Allergies (interactive) */}
        <div className={windowBox} style={windowStyle}>
          <AllergyList patient={patient} hideAddButton={hideListAddButtons} />
        </div>

        {/* Directives (interactive) */}
        <div className={windowBox} style={windowStyle}>
          <DirectiveList patient={patient} hideAddButton={hideListAddButtons} />
        </div>
      </div>
    </div>
  );
}
