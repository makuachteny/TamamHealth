'use client';

/**
 * "Create Clinical Note" — a split button: the main half starts the note the
 * clinician most likely wants, the caret opens the full type list.
 *
 * The split matters because the common case and the complete case pull in
 * opposite directions. Making everyone choose from twelve types before they can
 * start documenting taxes every visit for the sake of the rare one; hiding the
 * list entirely means an OB evaluation or a phone note has to be started wrong
 * and retyped. The default is derived from context (telehealth appointment →
 * Telehealth SOAP, maternity → OB Evaluation), so the fast path is usually
 * right and the list is one click away when it is not.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from '@/components/icons/lucide';
import {
  NOTE_TYPE_ORDER, NOTE_TYPES, type NoteTypeId,
} from '@/lib/clinical-notes/note-catalog';
import './clinical-notes.css';

interface CreateNoteButtonProps {
  onCreate: (noteType: NoteTypeId) => void;
  /** Type the main half uses. Defaults to SOAP. */
  defaultType?: NoteTypeId;
  disabled?: boolean;
  label?: string;
  /** Render compactly (icon + caret) for dense toolbars. */
  compact?: boolean;
  className?: string;
}

export default function CreateNoteButton({
  onCreate, defaultType = 'soap', disabled, label = 'Create Clinical Note',
  compact = false, className = '',
}: CreateNoteButtonProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (type: NoteTypeId) => { setOpen(false); onCreate(type); };

  return (
    <div className={`cn-split ${className}`} ref={boxRef}>
      <button
        type="button"
        className="cn-btn cn-btn-primary cn-split-main"
        onClick={(e) => { e.stopPropagation(); choose(defaultType); }}
        disabled={disabled}
        title={`New ${NOTE_TYPES[defaultType].label} note`}
      >
        <Plus size={14} />
        {!compact && label}
      </button>

      <button
        type="button"
        className="cn-btn cn-btn-primary cn-split-caret"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose note type"
      >
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="cn-popover cn-split-menu" role="menu">
          {NOTE_TYPE_ORDER.map((id) => {
            const def = NOTE_TYPES[id];
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="cn-popover-item"
                onClick={(e) => { e.stopPropagation(); choose(id); }}
              >
                {def.label}
                <span className="cn-popover-item-body">{def.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Pick the type a visit most likely needs, so the split button's fast half is
 * usually correct. Telehealth is decided by the appointment; maternity by the
 * reason for visit, which is how an ANC booking reaches the clinic.
 */
export function defaultNoteTypeFor(input: {
  telehealth?: boolean;
  reason?: string;
  role?: string;
}): NoteTypeId {
  const reason = (input.reason || '').toLowerCase();
  if (/\banc\b|antenatal|obstetric|pregnan|maternity/.test(reason)) return 'ob_evaluation';
  if (input.telehealth) return 'telehealth_soap';
  if (input.role === 'nurse' || input.role === 'triage_nurse' || input.role === 'rooming_nurse') {
    return 'nurse_visit';
  }
  if (input.role === 'midwife') return 'ob_evaluation';
  return 'soap';
}
