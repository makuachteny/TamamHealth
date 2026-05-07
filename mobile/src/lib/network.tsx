/**
 * Network connectivity monitor.
 *
 * Provides a React context that tracks online/offline state via
 * @react-native-community/netinfo. Components subscribe via useNetwork().
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
};

type NetworkContextValue = {
  status: NetworkStatus;
  /** Force-check connectivity right now */
  refresh: () => Promise<NetworkStatus>;
};

const defaultStatus: NetworkStatus = {
  isConnected: false,
  isInternetReachable: null,
  type: 'unknown',
};

const NetworkContext = createContext<NetworkContextValue>({
  status: defaultStatus,
  refresh: async () => defaultStatus,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>(defaultStatus);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Initial fetch
    NetInfo.fetch().then((state) => {
      if (mounted.current) setStatus(toNetworkStatus(state));
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (mounted.current) setStatus(toNetworkStatus(state));
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async (): Promise<NetworkStatus> => {
    const state = await NetInfo.fetch();
    const s = toNetworkStatus(state);
    if (mounted.current) setStatus(s);
    return s;
  }, []);

  return (
    <NetworkContext.Provider value={{ status, refresh }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}

function toNetworkStatus(state: NetInfoState): NetworkStatus {
  return {
    isConnected: !!state.isConnected,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
  };
}
