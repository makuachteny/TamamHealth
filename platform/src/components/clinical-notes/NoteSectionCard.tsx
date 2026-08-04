'use client';

/**
 * One section of a clinical note: its heading, its tool row, and its body.
 *
 * Narrative sections get a textarea plus Text Shortcut and Template. Derived
 * sections (vitals, medications, allergies) render a snapshot of the chart as
 * it stood when the note was written, with a refresh control — a note records
 * what the clinician saw, so it must not silently change when the chart later
 * does.
 *
 * The Plan section additionally carries the ordering actions (medications,
 * labs/studies, vaccines, patient education), because that is where a clinician
 * decides what happens next and the order should be raised from the sentence
 * that justifies it rather than a separate screen.
 */

import { useRef, useState } from 'react';
import {
  Zap, FileText, Pill, FlaskConical, Syringe, Heart, RefreshCw, X,
} from '@/components/icons/lucide';
import TextShortcutPicker from './TextShortcutPicker';
import TemplatePicker from './TemplatePicker';
import { getSectionDef, type NoteSectionId } from '@/lib/clinical-notes/note-catalog';
import {
  templateForSection, composeNarrative, composeTemplateText, stripTemplateMarkers,
  type TemplateSelection,
} from '@/lib/clinical-notes/section-templates';
import { applyShortcut } from '@/lib/clinical-notes/text-shortcut-service';
import type { NoteSectionContent, NotePlanAction } from '@/lib/clinical-notes/types';

export interface PlanActionRequest {
  kind: NotePlanAction['kind'];
}

interface NoteSectionCardProps {
  sectionId: NoteSectionId;
  content: NoteSectionContent | undefined;
  readOnly: boolean;
  userId: string;
  orgId?: string;
  active: boolean;
  onFocus: () => void;
  onChange: (patch: Partial<NoteSectionContent>) => void;
  /** Re-read the chart for a derived section. */
  onRefreshDerived?: (sectionId: NoteSectionId) => void;
  /** Raise an order from the Plan section. */
  onPlanAction?: (request: PlanActionRequest) => void;
  /** Remove an optional section the clinician added. */
  onRemove?: () => void;
  removable?: boolean;
}

export default function NoteSectionCard({
  sectionId, content, readOnly, userId, orgId, active,
  onFocus, onChange, onRefreshDerived, onPlanAction, onRemove, removable,
}: NoteSectionCardProps) {
  const def = getSectionDef(sectionId);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!def) return null;

  const text = content?.text ?? '';
  const selection = content?.templateSelection ?? {};
  const isPlan = sectionId === 'plan';
  const template = templateForSection(sectionId);

  const applyTemplateSelection = (next: TemplateSelection) => {
    const generated = composeTemplateText(template, next);
    onChange({
      templateSelection: next,
      text: composeNarrative(text, generated),
    });
  };

  // Derived sections render the snapshot rather than an editable body.
  if (def.kind === 'derived') {
    return (
      <section
        className={`cn-section${active ? ' is-active' : ''}`}
        id={`cn-section-${sectionId}`}
        onFocus={onFocus}
      >
        <div className="cn-section-head">
          <h3 className="cn-section-name">{def.label}</h3>
          {!readOnly && onRefreshDerived && (
            <div className="cn-section-tools">
              <button
                type="button"
                className="cn-tool"
                onClick={() => onRefreshDerived(sectionId)}
                title={`Re-read ${def.label.toLowerCase()} from the chart`}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          )}
        </div>
        <div className={`cn-derived${content?.snapshot ? '' : ' cn-derived-empty'}`}>
          {content?.snapshot || `No ${def.label.toLowerCase()} recorded for this patient.`}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`cn-section${active ? ' is-active' : ''}`}
      id={`cn-section-${sectionId}`}
    >
      <div className="cn-section-head">
        <h3 className="cn-section-name">{def.label}</h3>

        {!readOnly && (
          <div className="cn-section-tools">
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="cn-tool"
                onClick={() => { setShowShortcuts(v => !v); setShowTemplate(false); }}
                aria-expanded={showShortcuts}
              >
                <Zap size={13} /> Text Shortcut
              </button>
              {showShortcuts && (
                <TextShortcutPicker
                  userId={userId}
                  orgId={orgId}
                  sectionId={sectionId}
                  onPick={s => onChange({ text: applyShortcut(text, s.body) })}
                  onClose={() => setShowShortcuts(false)}
                />
              )}
            </div>

            {isPlan && onPlanAction && (
              <>
                <button type="button" className="cn-tool" onClick={() => onPlanAction({ kind: 'patient_education' })}>
                  <Heart size={13} /> Patient Education
                </button>
              </>
            )}

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="cn-tool"
                onClick={() => { setShowTemplate(v => !v); setShowShortcuts(false); }}
                aria-expanded={showTemplate}
              >
                <FileText size={13} /> Template
              </button>
              {showTemplate && (
                <TemplatePicker
                  template={template}
                  selection={selection}
                  onChange={applyTemplateSelection}
                  onClose={() => setShowTemplate(false)}
                />
              )}
            </div>

            {isPlan && onPlanAction && (
              <>
                <button type="button" className="cn-tool" onClick={() => onPlanAction({ kind: 'medication' })}>
                  <Pill size={13} /> Medications
                </button>
                <button type="button" className="cn-tool" onClick={() => onPlanAction({ kind: 'vaccine' })}>
                  <Syringe size={13} /> Vaccines
                </button>
                <button type="button" className="cn-tool" onClick={() => onPlanAction({ kind: 'lab' })}>
                  <FlaskConical size={13} /> Labs/Studies
                </button>
              </>
            )}

            {removable && onRemove && (
              <button
                type="button"
                className="cn-tool"
                onClick={onRemove}
                title={`Remove the ${def.label} section`}
                aria-label={`Remove the ${def.label} section`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {readOnly ? (
        <div className="cn-derived">
          {stripTemplateMarkers(text).trim() || (
            <span className="cn-derived-empty">Not documented.</span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="cn-textarea"
          value={text}
          placeholder={def.placeholder}
          onFocus={onFocus}
          onChange={e => onChange({ text: e.target.value })}
          aria-label={def.label}
        />
      )}
    </section>
  );
}
