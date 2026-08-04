'use client';

/**
 * State behind a section's shortcut search: the list, the query, and whether
 * the results are showing.
 *
 * It lives in a hook because the two halves render in different places — the
 * search box sits in the section's tool row, the results sit under it in the
 * section body — and they must not be able to disagree about what is open.
 *
 * Shortcuts load on first use, not on mount: a note renders one of these per
 * section, and reading the store a dozen times for boxes nobody has touched is
 * work for nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTextShortcuts, bumpShortcutUse } from '@/lib/clinical-notes/text-shortcut-service';
import type { TextShortcutDoc } from '@/lib/clinical-notes/types';
import type { NoteSectionId } from '@/lib/clinical-notes/note-catalog';

export interface ShortcutSearch {
  query: string;
  setQuery: (value: string) => void;
  open: boolean;
  /** Load (once) and show the list — what clicking the box does. */
  openList: () => void;
  close: () => void;
  loading: boolean;
  /** Everything for this section when the query is empty; matches when not. */
  results: TextShortcutDoc[];
  /** The section has no saved shortcuts at all, vs none matching the query. */
  empty: boolean;
  choose: (shortcut: TextShortcutDoc) => void;
}

export function useShortcutSearch({
  userId, orgId, sectionId, onPick,
}: {
  userId: string;
  orgId?: string;
  sectionId: NoteSectionId;
  onPick: (shortcut: TextShortcutDoc) => void;
}): ShortcutSearch {
  const [all, setAll] = useState<TextShortcutDoc[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadedFor = useRef<string | null>(null);

  // A section that changes type must not keep the previous section's list.
  useEffect(() => {
    loadedFor.current = null;
    setAll([]);
    setQuery('');
    setOpen(false);
  }, [sectionId, userId, orgId]);

  const openList = useCallback(() => {
    setOpen(true);
    const key = `${userId}:${orgId ?? ''}:${sectionId}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setLoading(true);
    void (async () => {
      try {
        let rows = await getTextShortcuts({ userId, orgId, sectionId });
        if (rows.length === 0 && userId) {
          // Lay down the starter set the first time, so the list teaches what
          // it is for instead of opening empty. Seeding is a convenience: if it
          // fails, the clinician still gets a working (empty) search rather
          // than an unhandled rejection.
          try {
            const { seedTextShortcutsFor } = await import('@/lib/clinical-notes/seed');
            await seedTextShortcutsFor(userId, { orgId });
            rows = await getTextShortcuts({ userId, orgId, sectionId });
          } catch {
            /* keep whatever the first query returned */
          }
        }
        setAll(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, orgId, sectionId]);

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter(s => `${s.name} ${s.body}`.toLowerCase().includes(term));
  }, [all, query]);

  const choose = useCallback((shortcut: TextShortcutDoc) => {
    onPick(shortcut);
    void bumpShortcutUse(shortcut._id);   // ranking is best-effort
    setOpen(false);
    setQuery('');
  }, [onPick]);

  return {
    query, setQuery, open, openList, close, loading,
    results, empty: all.length === 0, choose,
  };
}
