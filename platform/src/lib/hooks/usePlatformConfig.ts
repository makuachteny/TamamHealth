'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PlatformConfigDoc } from '../db-types';

export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfigDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const { getPlatformConfig } = await import('../services/platform-config-service');
      const data = await getPlatformConfig();
      setConfig(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const update = useCallback(async (
    data: Partial<PlatformConfigDoc>,
    actorId?: string, actorUsername?: string
  ) => {
    const { updatePlatformConfig } = await import('../services/platform-config-service');
    const updated = await updatePlatformConfig(data, actorId, actorUsername);
    setConfig(updated);
    return updated;
  }, []);

  return { config, loading, update, reload: loadConfig };
}
