/**
 * Sync context — orchestrates the sync engine with network awareness.
 *
 * Automatically syncs when:
 *   - The app comes online after being offline
 *   - On a periodic interval while online (every 5 minutes)
 *   - Manually triggered via syncNow()
 *
 * Exposes sync state, pending count, and last-sync time to the UI.
 */

import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetwork } from './network';
import {
  syncNow as engineSync,
  addSyncListener,
  getSyncQueueCount,
  getLastSyncTime,
  type SyncState,
  type SyncResult,
} from './sync-engine';

type SyncContextValue = {
  /** Current sync state */
  state: SyncState;
  /** Number of pending items in the sync queue */
  pendingCount: number;
  /** ISO timestamp of last successful sync */
  lastSyncTime: string | null;
  /** Latest sync result */
  lastResult: SyncResult | null;
  /** Trigger a sync immediately */
  syncNow: () => Promise<void>;
  /** Whether the device is online */
  isOnline: boolean;
};

const SyncContext = createContext<SyncContextValue>({
  state: 'idle',
  pendingCount: 0,
  lastSyncTime: null,
  lastResult: null,
  syncNow: async () => {},
  isOnline: false,
});

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useNetwork();
  const isOnline = status.isConnected && status.isInternetReachable !== false;

  const [state, setState] = useState<SyncState>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const wasOffline = useRef(!isOnline);
  const isOnlineRef = useRef(isOnline);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync with state
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  // Listen to engine state changes
  useEffect(() => {
    const unsub = addSyncListener((s, result) => {
      setState(s);
      if (result) {
        setLastResult(result);
        setLastSyncTime(result.timestamp);
      }
      getSyncQueueCount().then(setPendingCount).catch(() => {});
    });
    return unsub;
  }, []);

  // Load initial pending count + last sync time
  useEffect(() => {
    getSyncQueueCount().then(setPendingCount).catch(() => {});
    getLastSyncTime().then(setLastSyncTime).catch(() => {});
  }, []);

  // Stable sync function that reads online state from ref
  const doSync = useCallback(async () => {
    try {
      await engineSync(isOnlineRef.current);
      const count = await getSyncQueueCount();
      setPendingCount(count);
    } catch {
      // Error already handled in engine
    }
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline.current) {
      doSync();
    }
    wasOffline.current = !isOnline;
  }, [isOnline, doSync]);

  // Periodic sync while online (interval stable because doSync is stable)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (isOnline) {
      intervalRef.current = setInterval(doSync, SYNC_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, doSync]);

  // Sync when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && isOnlineRef.current) {
        doSync();
      }
    });
    return () => subscription.remove();
  }, [doSync]);

  // Refresh pending count when user creates new items (poll lightly)
  useEffect(() => {
    const timer = setInterval(() => {
      getSyncQueueCount().then(setPendingCount).catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SyncContext.Provider value={{
      state,
      pendingCount,
      lastSyncTime,
      lastResult,
      syncNow: doSync,
      isOnline,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
