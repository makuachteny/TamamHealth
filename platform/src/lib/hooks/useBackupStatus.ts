'use client';

import { useEffect, useState } from 'react';
import type { BackupStatus } from '../services/backup-status-service';

/**
 * Backup status for the admin surfaces (KAN-117).
 *
 * Returns `null` while loading — distinct from a loaded `state: 'unknown'`,
 * which is a real answer meaning "nothing has reported a backup". Collapsing
 * those two is how the screens this replaces ended up disagreeing with each
 * other about identical data.
 */
export function useBackupStatus(rpoHoursOverride?: number): BackupStatus | null {
  const [status, setStatus] = useState<BackupStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getBackupStatus } = await import('../services/backup-status-service');
        const s = await getBackupStatus(rpoHoursOverride);
        if (!cancelled) setStatus(s);
      } catch {
        // A failure to READ the status is itself unknown, not a failure of the
        // backup. Reporting it as overdue would raise a false alarm.
        if (!cancelled) {
          setStatus({
            state: 'unknown',
            lastBackupAt: null,
            ageHours: null,
            rpoHours: rpoHoursOverride ?? 24,
            detail: 'Backup status could not be read.',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [rpoHoursOverride]);

  return status;
}
