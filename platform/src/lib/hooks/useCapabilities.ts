'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasCapabilityMark, markCapability } from '@/lib/capability-storage';

export type CapabilityItem = {
  /** Stable slug, e.g. 'doctor.sign-note'. Namespaced per role so two roles'
   *  identically-labelled capabilities don't share a mark. */
  key: string;
  label: string;
  /** Where the user goes to try this capability. */
  href?: string;
  onClick?: () => void;
  /** Live evidence the user has already exercised the capability (e.g. "a
   *  document I authored exists"). The first render where this is true
   *  latches the mark permanently; it never un-checks when the signal
   *  later goes false. */
  signal?: boolean;
};

/**
 * Per-user "capabilities exercised" state for a dashboard's Capabilities card.
 * Checked = latched in storage OR currently evidenced by `signal` (which is
 * then latched). `mark(key)` is for action handlers to call at the moment the
 * user first completes the flow (more precise than a derived signal).
 */
export function useCapabilities(userId: string | undefined, items: CapabilityItem[]) {
  // Bumping this counter re-reads storage after a mark; storage itself is the
  // source of truth so marks survive reload and never regress.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let latched = false;
    for (const item of items) {
      if (item.signal && !hasCapabilityMark(item.key, userId)) {
        markCapability(item.key, userId);
        latched = true;
      }
    }
    if (latched) setVersion(current => current + 1);
  }, [items, userId]);

  const mark = useCallback((capabilityKey: string) => {
    if (!userId) return;
    markCapability(capabilityKey, userId);
    setVersion(current => current + 1);
  }, [userId]);

  const checklist = useMemo(() => items.map(item => ({
    label: item.label,
    done: Boolean(userId && (hasCapabilityMark(item.key, userId) || item.signal)),
    href: item.href,
    onClick: item.onClick,
  })),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version re-reads storage after latching
  [items, userId, version]);

  return { checklist, mark };
}
