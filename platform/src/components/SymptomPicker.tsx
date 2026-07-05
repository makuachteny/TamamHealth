'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { Check, ChevronLeft, ChevronRight, Plus, Search, X } from '@/components/icons/lucide';

/**
 * Multi-select popup for the chief-complaint field. Two-step navigation
 * (system group → symptoms) with search across the whole catalogue, and an
 * "Add …" row so anything not in the list can still be recorded. Picks
 * append into the complaint text box (which stays freely editable) — the
 * popup stays open for multi-adding until Done.
 */
export default function SymptomPicker({
  groups,
  selected,
  onPick,
  onClose,
  title = 'Signs & symptoms',
  categoryHint = 'Choose a system',
}: {
  groups: { label: string; options: string[] }[];
  /** Current complaint text — used to check off already-recorded symptoms. */
  selected: string;
  onPick: (symptom: string) => void;
  onClose: () => void;
  /** Popup heading — e.g. "Cardiovascular findings" for the exam pickers. */
  title?: string;
  categoryHint?: string;
}) {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<{ label: string; options: string[] } | null>(null);

  const q = query.trim().toLowerCase();
  // Compare against whole comma/newline-separated entries so "Vomiting"
  // doesn't read as picked when only "Vomiting everything" was added.
  const selectedItems = selected.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const isPicked = (symptom: string) => selectedItems.includes(symptom.toLowerCase());

  // Searching cuts across every group; otherwise show the active group's
  // symptoms, or the group list (step 1).
  const searchResults = q
    ? groups.flatMap(g => g.options).filter(o => o.toLowerCase().includes(q))
    : null;
  const rows = searchResults ?? activeGroup?.options ?? null;
  const visibleGroups = rows === null ? groups : [];
  const exactMatch = searchResults?.some(o => o.toLowerCase() === q);
  const stepIndex = activeGroup || searchResults ? 2 : 1;

  return (
    <Modal onClose={onClose} width={460}>
      <div className="modal-content card-elevated popup-select-panel" style={{ width: '100%' }}>
        <div className="popup-select-head">
          {activeGroup && !q ? (
            <button type="button" className="popup-select-back" onClick={() => setActiveGroup(null)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <span />}
          <div className="popup-select-title">
            <strong>{activeGroup && !q ? activeGroup.label : title}</strong>
            <span>Step {stepIndex} of 2 · {stepIndex === 1 ? categoryHint : 'Tap to add — multiple allowed'}</span>
          </div>
          <button type="button" className="popup-select-close" onClick={onClose} aria-label="Done">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="popup-select-search">
          <Search className="w-4 h-4" aria-hidden />
          <input
            autoFocus
            type="search"
            value={query}
            placeholder={`Search ${title.toLowerCase()}…`}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="popup-select-list" role="listbox" aria-label={title}>
          {visibleGroups.map(g => (
            <button key={g.label} type="button" className="popup-select-row" onClick={() => setActiveGroup(g)}>
              <span className="popup-select-row-label">{g.label}</span>
              <span className="popup-select-row-meta">{g.options.length}</span>
              <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          ))}
          {(rows ?? []).map(symptom => (
            <button
              key={symptom}
              type="button"
              role="option"
              aria-selected={isPicked(symptom)}
              className={`popup-select-row${isPicked(symptom) ? ' is-selected' : ''}`}
              onClick={() => onPick(symptom)}
            >
              <span className="popup-select-row-label">{symptom}</span>
              {isPicked(symptom) && <Check className="w-4 h-4" aria-hidden />}
            </button>
          ))}
          {/* Not in the catalogue? Record it anyway. */}
          {q && !exactMatch && (
            <button type="button" className="popup-select-row popup-select-row--add" onClick={() => { onPick(query.trim()); setQuery(''); }}>
              <Plus className="w-4 h-4" aria-hidden />
              <span className="popup-select-row-label">Add &ldquo;{query.trim()}&rdquo;</span>
            </button>
          )}
          {rows !== null && rows.length === 0 && !q && (
            <p className="popup-select-empty">No symptoms in this group.</p>
          )}
        </div>

        <div className="popup-select-foot">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}
