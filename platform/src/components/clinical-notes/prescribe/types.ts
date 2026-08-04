import type { FormularyDrug } from '@/lib/data/formulary';

/** The prescription being written. One draft per Rx; "Add Rx" resets it. */
export interface RxDraft {
  drug: FormularyDrug | null;
  quantity: string;
  refills: string;
  daysSupply: string;
  effectiveOn: string;
  allowSubstitution: boolean;
  serviceLocation: string;
  /** "1A40 · Malaria" — cited from the patient's active problem list. */
  reason: string;
  instructions: string;
  pharmacyNote: string;
}

export function emptyDraft(serviceLocation: string): RxDraft {
  return {
    drug: null,
    quantity: '1',
    refills: '0',
    daysSupply: '',
    effectiveOn: new Date().toISOString().slice(0, 10),
    allowSubstitution: true,
    serviceLocation,
    reason: '',
    instructions: '',
    pharmacyNote: '',
  };
}
