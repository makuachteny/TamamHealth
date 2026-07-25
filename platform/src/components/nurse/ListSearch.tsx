'use client';

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
    <div className="flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 18px', height: 38, borderRadius: 999,
          border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)',
          fontSize: 13, color: 'var(--text-primary)', outline: 'none',
        }}
      />
    </div>
  );
}
