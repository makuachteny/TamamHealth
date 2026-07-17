import type { PrescriptionStatus } from './clinical-flow/order-lifecycles';
import type { PrescriptionDoc } from './db-types';

export function pharmacyStage(rx: Pick<PrescriptionDoc, 'orderStatus' | 'status'>): PrescriptionStatus {
  if (rx.orderStatus) return rx.orderStatus;
  if (rx.status === 'dispensed') return 'dispensed';
  if (rx.status === 'discontinued') return 'held_awaiting_clarification';
  return 'received_in_pharmacy_queue';
}

export function pharmacyStageLabel(stage: PrescriptionStatus): string {
  switch (stage) {
    case 'prescribed':
      return 'Prescribed';
    case 'received_in_pharmacy_queue':
      return 'Received';
    case 'under_review':
      return 'Under review';
    case 'clinician_consultation_in_progress':
      return 'Clarifying';
    case 'cleared_for_dispensing':
      return 'Cleared';
    case 'dispensed':
      return 'Dispensed';
    case 'counseled':
      return 'Counseled';
    case 'complete':
      return 'Complete';
    case 'stockout_partial_referred':
      return 'Stockout / referred';
    case 'held_awaiting_clarification':
      return 'Held';
    case 'dispensing_error_recalled':
      return 'Recalled';
  }
}

export function pharmacyStageTone(stage: PrescriptionStatus): 'scheduled' | 'ready' | 'active' | 'done' | 'warning' | 'danger' {
  switch (stage) {
    case 'prescribed':
    case 'received_in_pharmacy_queue':
      return 'scheduled';
    case 'under_review':
    case 'clinician_consultation_in_progress':
      return 'active';
    case 'cleared_for_dispensing':
      return 'ready';
    case 'dispensed':
    case 'counseled':
    case 'complete':
      return 'done';
    case 'stockout_partial_referred':
    case 'held_awaiting_clarification':
      return 'warning';
    case 'dispensing_error_recalled':
      return 'danger';
  }
}

export function isFinanciallyCleared(balance?: number): boolean {
  return (balance ?? 0) <= 0;
}

export function isActivePharmacyStage(stage: PrescriptionStatus): boolean {
  return stage !== 'complete' && stage !== 'dispensing_error_recalled';
}
