'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Auto-lock hook for shared device security.
 *
 * Behavior:
 *   - Locks IMMEDIATELY when screen turns off / tab hidden (visibilitychange)
 *   - Locks after configurable inactivity timeout (default 1 min)
 *   - Timeout is read from org config (lockTimeoutMinutes) or localStorage
 *   - PIN stored as SHA-256 hash on UserDoc.pinHash
 */

const LOCK_TIMEOUT_KEY = 'tamamhealth-lock-timeout';
const PIN_HASH_KEY = 'tamamhealth-pin-hash';
/** Default idle timeout before auto-lock. 2 minutes balances clinical
 *  workflow (providers don't get locked mid-consult) against shared-device
 *  risk (shift change in a ward). Override via org config or localStorage. */
const DEFAULT_TIMEOUT_MS = 120_000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

async function hashPin(pin: string): Promise<string> {
  const salted = pin + 'tamamhealth-salt-2026';
  // Use crypto.subtle when available (HTTPS / localhost)
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salted);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for non-secure contexts (HTTP on LAN) — simple hash
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return 'fb-' + Math.abs(hash).toString(16).padStart(8, '0');
}

export function useAutoLock(isAuthenticated: boolean, orgLockTimeoutMinutes?: number) {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLockedRef = useRef(false);
  const isAuthRef = useRef(isAuthenticated);

  // Keep refs in sync for use in event handlers (avoids stale closures)
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);
  useEffect(() => { isAuthRef.current = isAuthenticated; }, [isAuthenticated]);

  // Check if user has a PIN set
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasPin(!!localStorage.getItem(PIN_HASH_KEY));
    }
  }, []);

  const getTimeout = useCallback((): number => {
    // Priority: org config > localStorage > default
    if (orgLockTimeoutMinutes && orgLockTimeoutMinutes > 0) {
      return orgLockTimeoutMinutes * 60_000;
    }
    if (typeof window === 'undefined') return DEFAULT_TIMEOUT_MS;
    const saved = localStorage.getItem(LOCK_TIMEOUT_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_TIMEOUT_MS;
  }, [orgLockTimeoutMinutes]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthenticated) return;

    timerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, getTimeout());
  }, [isAuthenticated, getTimeout]);

  const lock = useCallback(() => {
    setIsLocked(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    resetTimer();
  }, [resetTimer]);

  /** Verify a PIN against the stored hash. Returns true if valid. */
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash) return true; // No PIN set = accept any input
    const inputHash = await hashPin(pin);
    return inputHash === storedHash;
  }, []);

  /** Set (or update) the user's PIN */
  const setPin = useCallback(async (pin: string) => {
    const hashed = await hashPin(pin);
    localStorage.setItem(PIN_HASH_KEY, hashed);
    setHasPin(true);
  }, []);

  /** Clear the stored PIN */
  const clearPin = useCallback(() => {
    localStorage.removeItem(PIN_HASH_KEY);
    setHasPin(false);
  }, []);

  /** Update the inactivity timeout (in ms) */
  const setTimeoutMs = useCallback((ms: number) => {
    localStorage.setItem(LOCK_TIMEOUT_KEY, String(ms));
    resetTimer();
  }, [resetTimer]);

  // Activity listeners + visibility change
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLocked(false);
      return;
    }

    resetTimer();

    const handleActivity = () => {
      if (!isLockedRef.current) resetTimer();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Lock IMMEDIATELY when screen goes off or tab is hidden
    const handleVisibility = () => {
      if (document.hidden && isAuthRef.current) {
        lock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, lock, resetTimer]);

  return {
    isLocked,
    hasPin,
    lock,
    unlock,
    verifyPin,
    setPin,
    clearPin,
    setTimeoutMs,
    timeoutMs: getTimeout(),
  };
}
