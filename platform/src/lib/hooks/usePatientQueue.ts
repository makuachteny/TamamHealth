'use client';

import { useMemo } from 'react';
import { useTriage } from './useTriage';
import { buildQueueFromTriage, type QueueEntry } from '@/lib/services/patient-queue-service';

export function usePatientQueue(): { queue: QueueEntry[]; loading: boolean } {
  const { triages, loading } = useTriage();

  const queue = useMemo(
    () => buildQueueFromTriage(triages),
    [triages],
  );

  return { queue, loading };
}
