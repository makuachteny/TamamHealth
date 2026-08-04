'use client';

/**
 * Section template picker — the checkbox tree behind a section's "Template"
 * button.
 *
 * The clinician ticks what applies and the section fills itself in. A live
 * preview sits at the bottom so the effect of a tick is visible before the
 * popover closes: documenting by recognition only helps if you can see what
 * you are about to assert.
 *
 * Selection state is owned by the caller (and persisted on the note), so
 * reopening the tree restores exactly what was ticked last time rather than
 * making the clinician reconstruct it.
 */

import { useMemo, useRef, useEffect } from 'react';
import { X } from '@/components/icons/lucide';
import {
  composeTemplateText,
  type SectionTemplate,
  type TemplateSelection,
  type TemplateOption,
} from '@/lib/clinical-notes/section-templates';

interface TemplatePickerProps {
  template: SectionTemplate;
  selection: TemplateSelection;
  onChange: (next: TemplateSelection) => void;
  onClose: () => void;
}

function isTicked(selection: TemplateSelection, id: string): boolean {
  const v = selection[id];
  return v === true || (typeof v === 'string' && v.length > 0);
}

export default function TemplatePicker({
  template, selection, onChange, onClose,
}: TemplatePickerProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const preview = useMemo(
    () => composeTemplateText(template, selection),
    [template, selection],
  );

  const toggle = (groupId: string, option: TemplateOption, on: boolean) => {
    const next: TemplateSelection = { ...selection };
    const group = template.groups.find(g => g.id === groupId);

    // A single-select group is a scale, not a list: ticking one value clears
    // the rest so the note can never read "mild and severe".
    if (on && group?.single) {
      for (const o of group.options) {
        delete next[o.id];
        for (const c of o.children ?? []) delete next[c.id];
      }
    }

    if (on) {
      next[option.id] = option.freeText ? (typeof selection[option.id] === 'string' ? selection[option.id] : '') : true;
    } else {
      delete next[option.id];
      for (const c of option.children ?? []) delete next[c.id];
    }
    onChange(next);
  };

  const setFreeText = (id: string, value: string) => {
    onChange({ ...selection, [id]: value });
  };

  const renderOption = (groupId: string, option: TemplateOption, single: boolean) => {
    const ticked = isTicked(selection, option.id);
    const value = typeof selection[option.id] === 'string' ? selection[option.id] as string : '';

    return (
      <div key={option.id}>
        <label className="cn-tree-option">
          <input
            type={single ? 'radio' : 'checkbox'}
            name={single ? `${template.id}-${groupId}` : undefined}
            checked={ticked}
            onChange={e => toggle(groupId, option, e.target.checked)}
          />
          <span>{option.label}</span>
        </label>

        {ticked && option.freeText && (
          <input
            className="cn-tree-freetext"
            placeholder="Describe…"
            value={value}
            onChange={e => setFreeText(option.id, e.target.value)}
            aria-label={`${option.label} detail`}
          />
        )}

        {ticked && (option.children ?? []).map(child => (
          <div key={child.id} style={{ marginLeft: 22 }}>
            {renderOption(groupId, child, false)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="cn-popover"
      ref={boxRef}
      role="dialog"
      aria-label={`${template.label} template`}
      style={{ minWidth: 300, maxWidth: 420 }}
    >
      {template.groups.map(group => (
        <div className="cn-tree-group" key={group.id}>
          <p className="cn-tree-group-label">{group.label}</p>
          {group.options.map(option => renderOption(group.id, option, !!group.single))}
        </div>
      ))}

      {preview && (
        <div className="cn-tree-preview">
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 11.5 }}>Preview</strong>
          {preview}
        </div>
      )}

      <button
        type="button"
        className="cn-btn cn-btn-primary"
        onClick={onClose}
        style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
      >
        <X size={14} /> Close
      </button>
    </div>
  );
}
