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

  /**
   * Selected type first, then the rest alphabetically.
   *
   * The type in play sits at the top so the list opens on what is already
   * chosen and a mis-click reverts in one move; everything below is
   * alphabetical because with thirteen entries and no frequency data,
   * alphabetical is the only order a clinician can predict.
   */
  function menuOrder(selected: NoteTypeId): NoteTypeId[] {
    const rest = NOTE_TYPE_ORDER
      .filter(id => id !== selected)
      .sort((a, b) => NOTE_TYPES[a].label.localeCompare(NOTE_TYPES[b].label));
    return [selected, ...rest];
  }

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
        <div className="cn-type-menu" role="menu">
          {menuOrder(defaultType).map((id) => {
            const def = NOTE_TYPES[id];
            const selected = id === defaultType;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`cn-type-item${selected ? ' is-selected' : ''}`}
                title={def.description}
                onClick={(e) => { e.stopPropagation(); choose(id); }}
              >
                <span className="cn-type-tick" aria-hidden>{selected ? '✓' : ''}</span>
                {def.label}
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
