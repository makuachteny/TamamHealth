'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 639px)';

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Mirrors the `max-width: 639px` breakpoint used throughout globals.css.
 * Server and first-client snapshot are both `false`, so there's no
 * hydration mismatch; resizes/rotations update via the native `change`
 * event, no polling.
 */
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
