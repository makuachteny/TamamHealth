'use client';

import { useMemo } from 'react';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { usePharmacyInventory } from '@/lib/hooks/usePharmacyInventory';
import type { PrescriptionDoc } from '@/lib/db-types';
import type { MobileDashboardData, MobileLane, MobileOutstandingItem } from './dashboard-strategy';

const SCHEDULED = new Set(['prescribed', 'received_in_pharmacy_queue']);
const IN_OFFICE = new Set([
  'under_review',
  'clinician_consultation_in_progress',
  'cleared_for_dispensing',
  'held_awaiting_clarification',
  'stockout_partial_referred',
  'dispensing_error_recalled',
]);
const FINISHED = new Set(['dispensed', 'counseled', 'complete']);

/**
 * Pharmacy-archetype dashboard (pharmacist): lanes grouped by the granular
 * `orderStatus` lifecycle (order-lifecycles.ts PRESCRIPTION_TRANSITIONS),
 * falling back to the coarse `status` field for older records that predate
 * orderStatus. "Finished" means actually dispensed/counseled/complete, not
 * merely cleared-for-dispensing — the medication hasn't left the pharmacy
 * until then.
 */
export function usePharmacyDashboardData(): MobileDashboardData {
  const { prescriptions, loading: rxLoading } = usePrescriptions();
  const { items: inventory, loading: invLoading } = usePharmacyInventory();

  const lanes = useMemo<MobileLane<PrescriptionDoc>[]>(() => {
    const bucket = (rx: PrescriptionDoc) => rx.orderStatus || (rx.status === 'dispensed' ? 'dispensed' : 'prescribed');
    const scheduled = prescriptions.filter((rx) => SCHEDULED.has(bucket(rx)));
    const inOffice = prescriptions.filter((rx) => IN_OFFICE.has(bucket(rx)));
    const finished = prescriptions.filter((rx) => FINISHED.has(bucket(rx)));
    return [
      { key: 'scheduled', label: `${scheduled.length} Scheduled`, tone: 'info', items: scheduled },
      { key: 'in_office', label: `${inOffice.length} In Office`, tone: 'warning', items: inOffice },
      { key: 'finished', label: `${finished.length} Finished`, tone: 'success', items: finished },
    ];
  }, [prescriptions]);

  const outstanding = useMemo<MobileOutstandingItem[]>(() => {
    const lowStock = inventory.filter((i) => i.stockLevel <= i.reorderLevel).length;
    return [{ key: 'low_stock', label: 'Low stock / reorder', count: lowStock, href: '/pharmacy' }];
  }, [inventory]);

  return { lanes, outstanding, loading: rxLoading || invLoading };
}
