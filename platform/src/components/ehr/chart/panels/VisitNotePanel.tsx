'use client';

/**
 * Visit note workspace panel — OpenMRS-style: primary/secondary diagnosis
 * search + a free-text note. Diagnosis search reuses the same
 * CodedSearchField + COMMON_ICD11_CODES pairing as ProblemList's "Add
 * problem" flow. Persists via the existing patient-note-service
 * (createPatientNote / getNotesByPatient — the same pattern page.tsx already
 * uses for `patientNotes`) rather than standing up a new data layer.
 */

import { useMemo, useState } from 'react';
import { Image as ImageIcon } from '@/components/icons/lucide';
import CodedSearchField from '@/components/CodedSearchField';
import { useToast } from '@/components/Toast';
import { COMMON_ICD11_CODES } from '@/lib/icd11-codes';
import { patientFullName } from '@/lib/patient-utils';
import type { PatientDoc } from '@/lib/db-types';
import type { ChartPanelUser } from './types';

interface PickedDx { code: string; title: string; chapter: string }

interface VisitNotePanelProps {
  patient: PatientDoc;
  currentUser: ChartPanelUser | null | undefined;
  canConsult: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function VisitNotePanel({ patient, currentUser, canConsult, onClose, onSaved }: VisitNotePanelProps) {
  const { showToast } = useToast();
  const icdOptions = useMemo(() => COMMON_ICD11_CODES.map(c => ({ code: c.code, name: c.title, meta: c.chapter, keywords: c.keywords })), []);

  const [primarySearch, setPrimarySearch] = useState('');
  const [primaryDx, setPrimaryDx] = useState<PickedDx | null>(null);
  const [secondarySearch, setSecondarySearch] = useState('');
  const [secondaryDx, setSecondaryDx] = useState<PickedDx | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!canConsult) {
    return (
      <div className="omrs-drawer-body">
        <div className="omrs-panel-permission-note">
          <p>You don&apos;t have permission to add visit notes for this patient.</p>
        </div>
      </div>
    );
  }

  const canSave = !!primaryDx || note.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setSubmitting(true);
      const lines: string[] = [];
      if (primaryDx) lines.push(`Primary diagnosis: ${primaryDx.title} (ICD-11 ${primaryDx.code})`);
      if (secondaryDx) lines.push(`Secondary diagnosis: ${secondaryDx.title} (ICD-11 ${secondaryDx.code})`);
      if (note.trim()) lines.push(note.trim());
      const { createPatientNote } = await import('@/lib/services/patient-note-service');
      await createPatientNote({
        patientId: patient._id,
        body: lines.join('\n\n'),
        authorId: currentUser?._id || currentUser?.username || 'unknown',
        authorName: currentUser?.name || 'Care team',
        authorRole: currentUser?.role,
        orgId: currentUser?.orgId,
        hospitalId: currentUser?.hospitalId,
      });
      showToast('Visit note saved', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Could not save this note. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="omrs-drawer-body">
        <p className="omrs-panel-row-sub" style={{ marginBottom: 12 }}>
          For {patientFullName(patient)}
        </p>

        <div className="omrs-panel-field">
          <label className="omrs-panel-label">Primary diagnosis</label>
          {primaryDx ? (
            <div className="omrs-panel-picked-chip">
              <span>{primaryDx.title} <span style={{ opacity: 0.7 }}>· {primaryDx.code}</span></span>
              <button type="button" onClick={() => setPrimaryDx(null)}>Change</button>
            </div>
          ) : (
            <CodedSearchField
              label=""
              placeholder="Search ICD-11 diagnoses…"
              options={icdOptions}
              value={primarySearch}
              onChange={setPrimarySearch}
              onSelect={c => { setPrimaryDx({ code: c.code, title: c.name, chapter: c.meta || '' }); setPrimarySearch(''); }}
            />
          )}
        </div>

        <div className="omrs-panel-field">
          <label className="omrs-panel-label">Secondary diagnosis</label>
          {secondaryDx ? (
            <div className="omrs-panel-picked-chip">
              <span>{secondaryDx.title} <span style={{ opacity: 0.7 }}>· {secondaryDx.code}</span></span>
              <button type="button" onClick={() => setSecondaryDx(null)}>Change</button>
            </div>
          ) : (
            <CodedSearchField
              label=""
              placeholder="Search ICD-11 diagnoses… (optional)"
              options={icdOptions}
              value={secondarySearch}
              onChange={setSecondarySearch}
              onSelect={c => { setSecondaryDx({ code: c.code, title: c.name, chapter: c.meta || '' }); setSecondarySearch(''); }}
              excludeCodes={primaryDx ? [primaryDx.code] : undefined}
            />
          )}
        </div>

        <div className="omrs-panel-field">
          <label className="omrs-panel-label">Note</label>
          <textarea
            className="omrs-panel-textarea"
            placeholder="Assessment, plan, follow-up instructions…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <button type="button" className="omrs-panel-add-btn" disabled title="Image attachments aren't supported yet">
          <ImageIcon /> Add image
        </button>
      </div>
      <div className="omrs-drawer-footer">
        <button type="button" className="omrs-btn-ghost" onClick={onClose} disabled={submitting}>Discard</button>
        <button type="button" className="omrs-btn-primary" onClick={handleSave} disabled={!canSave || submitting}>
          {submitting ? 'Saving…' : 'Save and close'}
        </button>
      </div>
    </>
  );
}
