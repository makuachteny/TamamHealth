'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type MobileShellTab = 'dashboard' | 'patients' | 'calendar' | 'inbox' | null;
export type MobileShellOverlay = 'create' | 'modules' | null;
export type MobileShellLane = 'scheduled' | 'in_office' | 'finished';

function tabForPathname(pathname: string): MobileShellTab {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/patients')) return 'patients';
  if (pathname.startsWith('/appointments')) return 'calendar';
  if (pathname.startsWith('/messages')) return 'inbox';
  return null;
}

function todayIso(): string {
  // Local calendar date, not UTC — toISOString() shifts to the next day
  // once local time crosses midnight UTC, which would desync this from the
  // dashboard's own (locale-based) "today" heading.
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Route-driven state for the mobile shell, mirroring the design mockup's
 * flat `{tab, lane, overlay, chartId, day}` shape while backing it with the
 * real Next.js router so deep links, bookmarks, and the hardware/gesture
 * back button all behave correctly (closing a sheet or drill-in pops
 * history instead of doing nothing).
 *
 * Free-text search is intentionally NOT part of this hook — it has no
 * deep-link use case and lives as local component state in whichever view
 * needs it, to avoid a URL update on every keystroke.
 */
export function useMobileShellState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = useMemo(() => tabForPathname(pathname), [pathname]);
  const overlay = (searchParams.get('sheet') as MobileShellOverlay) || null;
  const chartId = searchParams.get('chart');
  const lane = (searchParams.get('lane') as MobileShellLane) || 'scheduled';
  const day = searchParams.get('day') || todayIso();

  const withParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) params.delete(key);
      else params.set(key, value);
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const openChart = useCallback((patientId: string) => router.push(withParam('chart', patientId)), [router, withParam]);
  const closeChart = useCallback(() => router.push(withParam('chart', null)), [router, withParam]);
  const openSheet = useCallback((sheet: 'create' | 'modules') => router.push(withParam('sheet', sheet)), [router, withParam]);
  const closeSheet = useCallback(() => router.push(withParam('sheet', null)), [router, withParam]);
  const setLane = useCallback((next: MobileShellLane) => router.replace(withParam('lane', next)), [router, withParam]);
  const setDay = useCallback((next: string) => router.replace(withParam('day', next)), [router, withParam]);

  return { tab, lane, overlay, chartId, day, setLane, openChart, closeChart, openSheet, closeSheet, setDay };
}
