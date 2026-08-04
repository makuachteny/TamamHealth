'use client';

/**
 * Text shortcut picker — the popover behind a section's "Text Shortcut" button.
 *
 * Ranked by use, so the phrases a clinician actually reaches for surface at the
 * top instead of an alphabetical list they have to read every time. Search
 * matches name and body, because people remember "the one about chest pain"
 * more reliably than what they named it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from '@/components/icons/lucide';
import { getTextShortcuts, bumpShortcutUse } from '@/lib/clinical-notes/text-shortcut-service';
import type { TextShortcutDoc } from '@/lib/clinical-notes/types';
import type { NoteSectionId } from '@/lib/clinical-notes/note-catalog';

interface TextShortcutPickerProps {
  userId: string;
  orgId?: string;
  sectionId: NoteSectionId;
  onPick: (shortcut: TextShortcutDoc) => void;
  onClose: () => void;
}

export default function TextShortcutPicker({
  userId, orgId, sectionId, onPick, onClose,
}: TextShortcutPickerProps) {
  const [all, setAll] = useState<TextShortcutDoc[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Section-scoped first; if this clinician has nothing at all yet, lay
        // down the starter set so the picker teaches what it is for instead of
        // opening empty. Seeding is idempotent and never overwrites edits.
        let rows = await getTextShortcuts({ userId, orgId, sectionId });
        if (rows.length === 0 && userId) {
          const anywhere = await getTextShortcuts({ userId, orgId });
          if (anywhere.length === 0) {
            const { seedTextShortcutsFor } = await import('@/lib/clinical-notes/seed');
            await seedTextShortcutsFor(userId, { orgId });
            rows = await getTextShortcuts({ userId, orgId, sectionId });
          }
        }
        if (!cancelled) setAll(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, orgId, sectionId]);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Close on outside click / Escape so the popover behaves like every other
  // transient surface in the app.
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

  // Filter in memory: the list is per-clinician and small, and typing should
  // not wait on a round trip.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(s => `${s.name} ${s.body}`.toLowerCase().includes(term));
  }, [all, search]);

  const choose = (shortcut: TextShortcutDoc) => {
    onPick(shortcut);
    void bumpShortcutUse(shortcut._id);   // ranking is best-effort
    onClose();
  };

  return (
    <div className="cn-popover" ref={boxRef} role="dialog" aria-label="Insert text shortcut">
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{ position: 'absolute', left: 9, top: 10, opacity: 0.5, pointerEvents: 'none' }}
        />
        <input
          ref={searchRef}
          className="cn-popover-search"
          style={{ paddingLeft: 28 }}
          placeholder="Search for a shortcut…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && visible.length > 0) { e.preventDefault(); choose(visible[0]); }
          }}
        />
      </div>

      {loading && <p className="cn-popover-empty">Loading…</p>}

      {!loading && visible.length === 0 && (
        <p className="cn-popover-empty">
          {all.length === 0
            ? 'No shortcuts yet. Save one from a section to reuse it here.'
            : 'No shortcut matches that search.'}
        </p>
      )}

      {!loading && visible.map(shortcut => (
        <button
          key={shortcut._id}
          type="button"
          className="cn-popover-item"
          onClick={() => choose(shortcut)}
        >
          {shortcut.name}
          <span className="cn-popover-item-body">{shortcut.body}</span>
        </button>
      ))}

      <button
        type="button"
        className="cn-popover-item"
        onClick={onClose}
        style={{ marginTop: 4, color: 'var(--color-text-muted, #94a3b8)' }}
      >
        <X size={12} style={{ marginRight: 6, verticalAlign: -1 }} />
        Close
      </button>
    </div>
  );
}
