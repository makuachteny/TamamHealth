'use client';

import { Search } from '@/components/icons/lucide';

/**
 * Inline free-text search for a nurse station list. Lives in the list's own
 * header (ward, MAR, triage, handoff) rather than the platform-wide top search
 * bar, so each station filters its own list in place.
 */
export default function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-0">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full !pl-9 !pr-3 !py-2 text-[13px]"
        style={{ background: 'var(--overlay-subtle)' }}
      />
    </div>
  );
}
