'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context';
import type { PatientDoc } from '@/lib/db-types';
import type { AllergyEntry, DirectiveType, CareAlertCategory } from '@/data/mock';
import { AlertTriangle, ShieldCheck, Bell, Plus, X } from '@/components/icons/lucide';
import Modal from '@/components/Modal';

const CLASSIFICATIONS: AllergyEntry['classification'][] = ['drug', 'food', 'environmental', 'biologic', 'other'];
const CRITICALITIES: NonNullable<AllergyEntry['criticality']>[] = ['mild', 'moderate', 'severe', 'unknown'];

const DIRECTIVE_LABELS: Record<DirectiveType, string> = {
  informed_consent: 'Informed consent',
  abn_noncovered: 'Non-covered service (ABN)',
  privacy_consent: 'Privacy / communication consent',
  advance_directive: 'Advance directive',
  release_of_information: 'Release of information',
  other: 'Other',
};
const DIRECTIVE_OPTIONS = Object.keys(DIRECTIVE_LABELS) as DirectiveType[];

const ALERT_LABELS: Record<CareAlertCategory, string> = {
  clinical_risk: 'Clinical risk',
  safety: 'Safety',
  infection_control: 'Infection control',
  administrative: 'Administrative',
  other: 'Other',
};
const ALERT_OPTIONS = Object.keys(ALERT_LABELS) as CareAlertCategory[];

type Which = 'allergy' | 'directive' | 'alert' | null;

const inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' } as const;

// Match the patient-header action buttons (Order Lab / Prescribe / Refer).
const triggerClass = 'inline-flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition-colors';
const triggerStyle = { height: 40, background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' } as const;

/**
 * Grouped chart-safety actions (P1.x). Surfaces the three "add to chart"
 * affordances — allergy, directive/consent and care alert — as a single row of
 * buttons. Each opens its add form in a popup ({@link Modal}) so the chart
 * stays uncluttered. Writes reuse the existing per-domain services, so the
 * patient lists/banners refresh reactively exactly as the inline forms did.
 */
export default function ChartSafetyActions({ patient }: { patient: PatientDoc }) {
  const { currentUser } = useApp();
  const [open, setOpen] = useState<Which>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const author = { recordedBy: currentUser?._id, recordedByName: currentUser?.name || currentUser?.username };

  const [allergy, setAllergy] = useState<{ substance: string; classification: AllergyEntry['classification']; criticality: NonNullable<AllergyEntry['criticality']>; reaction: string; onsetDate: string }>(
    { substance: '', classification: 'drug', criticality: 'unknown', reaction: '', onsetDate: '' },
  );
  const [directive, setDirective] = useState<{ type: DirectiveType; description: string; startDate: string }>(
    { type: 'informed_consent', description: '', startDate: '' },
  );
  const [alert, setAlert] = useState<{ category: CareAlertCategory; message: string; priority: 'high' | 'normal' }>(
    { category: 'clinical_risk', message: '', priority: 'high' },
  );

  function close() {
    setOpen(null);
    setError(null);
    setAllergy({ substance: '', classification: 'drug', criticality: 'unknown', reaction: '', onsetDate: '' });
    setDirective({ type: 'informed_consent', description: '', startDate: '' });
    setAlert({ category: 'clinical_risk', message: '', priority: 'high' });
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveAllergy() {
    const svc = await import('@/lib/services/allergy-service');
    await svc.addAllergy(patient._id, { ...allergy, ...author });
  }
  async function saveDirective() {
    const svc = await import('@/lib/services/directive-service');
    await svc.addDirective(patient._id, { ...directive, ...author });
  }
  async function saveAlert() {
    const svc = await import('@/lib/services/care-alert-service');
    await svc.addCareAlert(patient._id, { ...alert, ...author });
  }

  const titleId = 'chart-safety-action-title';

  return (
    <>
      <div className="inline-flex items-center gap-2 flex-wrap">
        <button onClick={() => setOpen('allergy')} className={triggerClass} style={triggerStyle}>
          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /> Add allergy
        </button>
        <button onClick={() => setOpen('directive')} className={triggerClass} style={triggerStyle}>
          <ShieldCheck className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /> Add directive
        </button>
        <button onClick={() => setOpen('alert')} className={triggerClass} style={triggerStyle}>
          <Bell className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /> Add alert
        </button>
      </div>

      {open && (
        <Modal onClose={busy ? () => {} : close} width={460} labelledBy={titleId}>
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 id={titleId} className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                {open === 'allergy' && (<><AlertTriangle className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Add allergy</>)}
                {open === 'directive' && (<><ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Add directive / consent</>)}
                {open === 'alert' && (<><Bell className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Add care alert</>)}
              </h3>
              <button className="btn btn-xs btn-secondary" disabled={busy} onClick={close} aria-label="Close">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {open === 'allergy' && (
              <div className="space-y-2">
                <input
                  value={allergy.substance}
                  onChange={(e) => setAllergy({ ...allergy, substance: e.target.value })}
                  placeholder="Substance (e.g. Penicillin)"
                  className="w-full p-2 rounded-md text-[13px]" style={inputStyle} autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <select value={allergy.classification} onChange={(e) => setAllergy({ ...allergy, classification: e.target.value as AllergyEntry['classification'] })}
                    className="p-2 rounded-md text-[12px]" style={inputStyle}>
                    {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={allergy.criticality} onChange={(e) => setAllergy({ ...allergy, criticality: e.target.value as NonNullable<AllergyEntry['criticality']> })}
                    className="p-2 rounded-md text-[12px]" style={inputStyle}>
                    {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input
                  value={allergy.reaction}
                  onChange={(e) => setAllergy({ ...allergy, reaction: e.target.value })}
                  placeholder="Reaction (e.g. anaphylaxis, rash)"
                  className="w-full p-2 rounded-md text-[13px]" style={inputStyle}
                />
                <div className="flex items-center gap-2 pt-1">
                  <button className="btn btn-sm btn-primary" disabled={busy || allergy.substance.trim().length === 0} onClick={() => run(saveAllergy)}>
                    <Plus className="w-3 h-3" /> Save allergy
                  </button>
                  <button className="btn btn-sm btn-secondary" disabled={busy} onClick={close}>Cancel</button>
                </div>
              </div>
            )}

            {open === 'directive' && (
              <div className="space-y-2">
                <select value={directive.type} onChange={(e) => setDirective({ ...directive, type: e.target.value as DirectiveType })}
                  className="w-full p-2 rounded-md text-[12px]" style={inputStyle}>
                  {DIRECTIVE_OPTIONS.map((t) => <option key={t} value={t}>{DIRECTIVE_LABELS[t]}</option>)}
                </select>
                <input
                  value={directive.description}
                  onChange={(e) => setDirective({ ...directive, description: e.target.value })}
                  placeholder="Description (e.g. Consent to treat signed)"
                  className="w-full p-2 rounded-md text-[13px]" style={inputStyle} autoFocus
                />
                <div className="flex items-center gap-2 pt-1">
                  <button className="btn btn-sm btn-primary" disabled={busy || directive.description.trim().length === 0} onClick={() => run(saveDirective)}>
                    <Plus className="w-3 h-3" /> Save directive
                  </button>
                  <button className="btn btn-sm btn-secondary" disabled={busy} onClick={close}>Cancel</button>
                </div>
              </div>
            )}

            {open === 'alert' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={alert.category} onChange={(e) => setAlert({ ...alert, category: e.target.value as CareAlertCategory })}
                    className="p-2 rounded-md text-[12px]" style={inputStyle}>
                    {ALERT_OPTIONS.map((c) => <option key={c} value={c}>{ALERT_LABELS[c]}</option>)}
                  </select>
                  <select value={alert.priority} onChange={(e) => setAlert({ ...alert, priority: e.target.value as 'high' | 'normal' })}
                    className="p-2 rounded-md text-[12px]" style={inputStyle}>
                    <option value="high">High priority</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>
                <input
                  value={alert.message}
                  onChange={(e) => setAlert({ ...alert, message: e.target.value })}
                  placeholder="Alert (e.g. High fall risk; do not use right arm for BP)"
                  className="w-full p-2 rounded-md text-[13px]" style={inputStyle} autoFocus
                />
                <div className="flex items-center gap-2 pt-1">
                  <button className="btn btn-sm btn-primary" disabled={busy || alert.message.trim().length === 0} onClick={() => run(saveAlert)}>
                    <Plus className="w-3 h-3" /> Save alert
                  </button>
                  <button className="btn btn-sm btn-secondary" disabled={busy} onClick={close}>Cancel</button>
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-[11px]" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
