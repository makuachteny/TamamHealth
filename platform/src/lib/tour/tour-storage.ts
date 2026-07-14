const STORAGE_PREFIX = 'tamamhealth.tour.';

function key(tourKey: string, userId: string): string {
  return `${STORAGE_PREFIX}${tourKey}.${userId}`;
}

export function hasSeenTour(tourKey: string, userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(key(tourKey, userId)) !== null;
  } catch {
    return true;
  }
}

export function markTourSeen(tourKey: string, userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(tourKey, userId), new Date().toISOString());
  } catch {
    // Storage unavailable (private browsing, quota) — the tour will simply
    // offer itself again next session, which is an acceptable fallback.
  }
}

export function resetTour(tourKey: string, userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(tourKey, userId));
  } catch {
    // Ignore.
  }
}
