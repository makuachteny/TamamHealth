'use client';

/**
 * CodedSearchField — the "label above a search input, dropdown of code +
 * name rows below" pattern used for picking from a coded reference list
 * (ICD-11 diagnoses, problems, allergens, screenings, …). One shared
 * implementation so every "Add X" flow that's genuinely a lookup against a
 * known list looks and behaves the same way, instead of each call site
 * hand-rolling its own filter/dropdown/blur logic.
 */

import { useState } from 'react';
import { Search } from '@/components/icons/lucide';

export interface CodedOption {
  code: string;
  name: string;
  /** Optional subtitle shown under the name (e.g. ICD-11 chapter). */
  meta?: string;
  /** Extra search terms matched but never displayed (e.g. "fever, chills" for Malaria). */
  keywords?: string[];
}

export default function CodedSearchField({
  label,
  placeholder,
  options,
  value,
  onChange,
  onSelect,
  minChars = 1,
  maxResults = 8,
  autoFocus = false,
  excludeCodes,
  showCodeBadge = true,
}: {
  label: string;
  placeholder: string;
  options: CodedOption[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: CodedOption) => void;
  minChars?: number;
  maxResults?: number;
  autoFocus?: boolean;
  excludeCodes?: string[];
  /** Hide the mono code badge for option lists with no real coding system
   *  behind them (e.g. free-text screening names) — same input/dropdown,
   *  just a plain name row instead of implying a code that doesn't exist. */
  showCodeBadge?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const query = value.trim().toLowerCase();
  const excluded = excludeCodes ? new Set(excludeCodes) : null;
  const matches = query.length >= minChars
    ? options
        .filter(o => !excluded?.has(o.code) && (
          o.code.toLowerCase().includes(query) ||
          o.name.toLowerCase().includes(query) ||
          (o.keywords || []).some(k => k.toLowerCase().includes(query))
        ))
        .slice(0, maxResults)
    : [];

  return (
    <div className="relative">
      <label>{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="pl-9 search-icon-input w-full"
          style={{ background: 'var(--overlay-subtle)' }}
          autoFocus={autoFocus}
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden max-h-72 overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', boxShadow: 'var(--card-shadow-lg)' }}>
          {matches.map(option => (
            <button
              key={`${option.code}-${option.name}`}
              type="button"
              onClick={() => { onSelect(option); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
              style={{ borderBottom: '1px solid var(--border-light)' }}
            >
              {showCodeBadge && (
                <span className="font-mono text-xs px-2 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{option.code}</span>
              )}
              <span className="min-w-0">
                <span className="text-sm font-bold block truncate" style={{ color: 'var(--text-primary)' }}>{option.name}</span>
                {option.meta && <span className="text-[11px] block truncate" style={{ color: 'var(--text-muted)' }}>{option.meta}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
