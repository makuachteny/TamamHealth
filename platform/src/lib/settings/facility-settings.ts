/**
 * Facility-level settings: the single typed shape for everything an admin can
 * configure for a hospital/clinic, plus the defaults that mirror the values
 * that used to be hard-coded across the platform.
 *
 * Stored as one `facility_settings` doc per hospital in the (already synced)
 * `tamamhealth_hospitals` database, so a change made by an admin replicates to
 * every device/user at that facility. A singleton store (settings-store.ts)
 * keeps the current merged settings available synchronously to non-React
 * services (currency, hospital-number prefix, SLA timers, …), while the
 * SettingsProvider/useSettings hook makes them reactive in components.
 */

/** A single lab investigation the facility offers. */
export interface LabTestDef {
  name: string;
  tier: 'basic' | 'special';
  specimen: string;
}

/** Accepted payment method keys (kept as stable keys; labels live in the UI). */
export type PaymentMethodKey =
  | 'cash' | 'mobile_money' | 'voucher' | 'partial_payment' | 'bank_transfer' | 'card';

/** Payor / funding-source keys. */
export type PayorKey =
  | 'out_of_pocket' | 'gov_moh' | 'ngo_donor' | 'pepfar' | 'global_fund'
  | 'private_insurance' | 'cbhi' | 'exemption_waiver' | 'sliding_scale';

export interface FacilitySettings {
  // ── General ─────────────────────────────────────────────────────────────
  /** ISO-ish currency code used for all charges/prices (e.g. 'SSP', 'USD'). */
  currency: string;
  /** Prefix for generated patient hospital numbers (e.g. 'TAB' → TAB-000123). */
  hospitalNumberPrefix: string;
  /** Default display language (locale code) for this facility. */
  language: string;

  // ── Clinical ────────────────────────────────────────────────────────────
  /** Hours before an unreviewed result escalates, by criticality. */
  resultReviewSLA: { criticalHours: number; routineHours: number };
  /** Triage queue aging behaviour. */
  acuity: { timeAging: boolean; agingPerMinute: number };
  /** The lab investigations this facility can order. */
  labCatalog: LabTestDef[];

  // ── Operations ──────────────────────────────────────────────────────────
  /** Exam rooms / bays a patient can be placed in. */
  rooms: string[];
  /** Departments / clinics offered (drives routing + reporting buckets). */
  departments: string[];

  // ── Billing ─────────────────────────────────────────────────────────────
  /** Accepted payment methods. */
  paymentMethods: PaymentMethodKey[];
  /** Payor / funding sources offered at this facility. */
  payors: PayorKey[];
  /** Days into an unpaid balance before each collection stage triggers. */
  collectionStageDays: { followUp: number; warning: number; preWriteOff: number };

  // ── Security ────────────────────────────────────────────────────────────
  /** Idle minutes before the screen auto-locks. */
  lockTimeoutMinutes: number;
}

/** Persisted document shape (one per hospital). */
export interface FacilitySettingsDoc extends FacilitySettings {
  _id: string;
  _rev?: string;
  type: 'facility_settings';
  hospitalId: string;
  orgId?: string;
  createdAt: string;
  updatedAt: string;
}

export const facilitySettingsId = (hospitalId: string) => `facility_settings:${hospitalId}`;

/**
 * Defaults that exactly mirror the values previously hard-coded across the
 * platform, so behaviour is identical until an admin changes something:
 *   - currency / prefix:  ledger-service.ts, patient-service.ts
 *   - resultReviewSLA:    clinical-flow/order-lifecycles.ts (RESULT_REVIEW_SLA)
 *   - acuity:             clinical-flow/payment-model.ts
 *   - labCatalog:         clinical-flow/lab-catalog.ts
 *   - rooms:              dashboard/front-desk ROOM_OPTIONS
 *   - paymentMethods/payors: clinical-flow/payment-model.ts
 *   - collectionStageDays: services/payment-service.ts
 *   - lockTimeoutMinutes:  hooks/useAutoLock.ts
 */
export const DEFAULT_FACILITY_SETTINGS: FacilitySettings = {
  currency: 'SSP',
  hospitalNumberPrefix: 'TAB',
  language: 'en',
  resultReviewSLA: { criticalHours: 24, routineHours: 168 },
  acuity: { timeAging: true, agingPerMinute: 0.1 },
  labCatalog: [
    { name: 'Full Blood Count', tier: 'basic', specimen: 'Blood' },
    { name: 'Urinalysis', tier: 'basic', specimen: 'Urine' },
    { name: 'Blood Glucose', tier: 'basic', specimen: 'Blood' },
    { name: 'Malaria RDT', tier: 'basic', specimen: 'Blood' },
    { name: 'HIV Rapid Test', tier: 'special', specimen: 'Blood' },
    { name: 'CD4 Count', tier: 'special', specimen: 'Blood' },
    { name: 'Liver Function', tier: 'special', specimen: 'Blood' },
    { name: 'Renal Function', tier: 'special', specimen: 'Blood' },
    { name: 'Typhoid (Widal)', tier: 'special', specimen: 'Blood' },
    { name: 'Rheumatoid Factor', tier: 'special', specimen: 'Blood' },
    { name: 'ANA (autoimmune screen)', tier: 'special', specimen: 'Blood' },
    { name: 'Uric Acid', tier: 'special', specimen: 'Blood' },
    { name: 'Vitamin D', tier: 'special', specimen: 'Blood' },
    { name: 'Stool Culture', tier: 'special', specimen: 'Stool' },
    { name: 'Blood Culture', tier: 'special', specimen: 'Blood' },
    { name: 'Lipid Profile', tier: 'special', specimen: 'Blood' },
  ],
  rooms: ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Bay A', 'Bay B', 'Bay C', 'Bay D'],
  departments: ['General Medicine', 'Maternity', 'Emergency', 'Pediatrics', 'Ophthalmology', 'Dental', 'Dermatology', 'OPD'],
  paymentMethods: ['cash', 'mobile_money', 'card', 'bank_transfer', 'voucher', 'partial_payment'],
  payors: ['out_of_pocket', 'gov_moh', 'ngo_donor', 'pepfar', 'global_fund', 'private_insurance', 'cbhi', 'exemption_waiver', 'sliding_scale'],
  collectionStageDays: { followUp: 30, warning: 60, preWriteOff: 90 },
  lockTimeoutMinutes: 2,
};

/**
 * Merge a stored (possibly partial / older-schema) settings object over the
 * defaults so missing fields always resolve to a sane value. Nested objects
 * are merged shallowly per key.
 */
export function mergeFacilitySettings(partial?: Partial<FacilitySettings> | null): FacilitySettings {
  const d = DEFAULT_FACILITY_SETTINGS;
  if (!partial) return { ...d, labCatalog: [...d.labCatalog], rooms: [...d.rooms], departments: [...d.departments], paymentMethods: [...d.paymentMethods], payors: [...d.payors] };
  return {
    currency: partial.currency ?? d.currency,
    hospitalNumberPrefix: partial.hospitalNumberPrefix ?? d.hospitalNumberPrefix,
    language: partial.language ?? d.language,
    resultReviewSLA: { ...d.resultReviewSLA, ...(partial.resultReviewSLA ?? {}) },
    acuity: { ...d.acuity, ...(partial.acuity ?? {}) },
    labCatalog: partial.labCatalog?.length ? partial.labCatalog : [...d.labCatalog],
    rooms: partial.rooms?.length ? partial.rooms : [...d.rooms],
    departments: partial.departments?.length ? partial.departments : [...d.departments],
    paymentMethods: partial.paymentMethods?.length ? partial.paymentMethods : [...d.paymentMethods],
    payors: partial.payors?.length ? partial.payors : [...d.payors],
    collectionStageDays: { ...d.collectionStageDays, ...(partial.collectionStageDays ?? {}) },
    lockTimeoutMinutes: partial.lockTimeoutMinutes ?? d.lockTimeoutMinutes,
  };
}

/** Stable display labels for the keyed enums (used by settings UI + billing). */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  voucher: 'Voucher',
  partial_payment: 'Partial Payment',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
};

export const PAYOR_LABELS: Record<PayorKey, string> = {
  out_of_pocket: 'Out of Pocket',
  gov_moh: 'Government (MoH)',
  ngo_donor: 'NGO / Donor',
  pepfar: 'PEPFAR',
  global_fund: 'Global Fund',
  private_insurance: 'Private Insurance',
  cbhi: 'Community-Based Health Insurance',
  exemption_waiver: 'Exemption / Waiver',
  sliding_scale: 'Sliding Scale',
};

export const ALL_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodKey[];
export const ALL_PAYORS = Object.keys(PAYOR_LABELS) as PayorKey[];
