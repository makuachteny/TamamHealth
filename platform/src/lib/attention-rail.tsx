'use client';

/**
 * Which side of the app owns the "Needs your attention" rail.
 *
 * The shell renders the rail for every module, so the panel is in the same
 * place everywhere. A screen that already builds its own right rail — the
 * doctor and care dashboards, which pair it with their own "Outstanding items"
 * card — opts out with `useOwnsAttentionRail()` rather than the shell trying to
 * guess from the route, which varies per role and would drift the moment a
 * dashboard moves.
 *
 * Opting out is scoped to the mounted screen: unmounting hands the rail back,
 * so navigating from a dashboard to any other module restores it.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';

interface AttentionRailValue {
  /** True while a screen is rendering its own rail. */
  ownedByPage: boolean;
  claim: () => void;
  release: () => void;
}

const AttentionRailContext = createContext<AttentionRailValue | null>(null);

export function AttentionRailProvider({ children }: { children: ReactNode }) {
  // A count, not a boolean: two screens can briefly overlap during a route
  // transition, and the outgoing one's cleanup must not release a rail the
  // incoming one has already claimed.
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => setClaims(n => n + 1), []);
  const release = useCallback(() => setClaims(n => Math.max(0, n - 1)), []);
  const value = useMemo(
    () => ({ ownedByPage: claims > 0, claim, release }),
    [claims, claim, release],
  );
  return <AttentionRailContext.Provider value={value}>{children}</AttentionRailContext.Provider>;
}

/** Read by the shell to decide whether to render the shared rail. */
export function useAttentionRailOwnedByPage(): boolean {
  return useContext(AttentionRailContext)?.ownedByPage ?? false;
}

/** Called by a screen that renders its own right rail. */
export function useOwnsAttentionRail(active = true) {
  const ctx = useContext(AttentionRailContext);
  const claim = ctx?.claim;
  const release = ctx?.release;
  useEffect(() => {
    if (!active || !claim || !release) return;
    claim();
    return () => release();
  }, [active, claim, release]);
}
