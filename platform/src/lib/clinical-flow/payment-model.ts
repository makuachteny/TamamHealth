/**
 * Payment / payor model, medication criticality tiers, and acuity scheme.
 *
 * Faithful encoding of Section 5 (Payment Model), Principle 2.11 (Medication
 * criticality tiers), and Principle 2.9 (Acuity-weighted queues with time-aging).
 *
 * Critical simplification from the document: US-style insurance complexity
 * (copays, deductibles, prior auth, claim/denial cycles) DOES NOT APPLY. The
 * model is per-service payor tagging with exemptions.
 */

// ── Section 5 — Payor types ──────────────────────────────────────────────────

export type PayorType =
  | 'out_of_pocket' // private pay
  | 'government_moh' // Free Health Care policy (maternal, TB, HIV, others)
  | 'ngo_donor' // MSF, IRC, ICRC, UNICEF, etc.
  | 'pepfar' // HIV care
  | 'global_fund' // TB, malaria
  | 'private_insurance' // rare
  | 'community_based_health_insurance' // rare / experimental
  | 'exemption_waiver' // vulnerable populations, IDPs
  | 'sliding_scale'; // partial payment where facility policy allows

export const PAYOR_TYPES: { type: PayorType; label: string }[] = [
  { type: 'out_of_pocket', label: 'Out-of-pocket (private pay)' },
  { type: 'government_moh', label: 'Government / MoH-covered (Free Health Care: maternal, TB, HIV, others)' },
  { type: 'ngo_donor', label: 'NGO / donor-covered (MSF, IRC, ICRC, UNICEF, …)' },
  { type: 'pepfar', label: 'PEPFAR-covered (HIV care)' },
  { type: 'global_fund', label: 'Global Fund-covered (TB, malaria)' },
  { type: 'private_insurance', label: 'Private insurance (rare)' },
  { type: 'community_based_health_insurance', label: 'Community-Based Health Insurance (rare/experimental)' },
  { type: 'exemption_waiver', label: 'Exemption / waiver (vulnerable populations, IDPs)' },
  { type: 'sliding_scale', label: 'Sliding scale / partial payment (where facility policy allows)' },
];

/** Key design decisions (Section 5). Encoded as enforceable flags/notes. */
export const PAYMENT_MODEL_RULES = {
  multiplePayorsPerEncounter: true, // each service tagged with its specific payor
  payorTaggedAtTimeOfService: true,
  facilityMaintainsPayorRegistry: true, // active payors, what each covers, docs, reporting
  patientHasPayorProfile: true, // captured at registration, updated at later visits
  exemptionRequiresAuthorization: true, // typically facility admin
  exemptionTimeLimitedOrPermanent: true,
  exemptionReasonRecorded: true,
  exemptedServicesGenerateNoPatientCharge: true, // Stage 10
  mobileMoneyIntegration: 'future_capability', // M-Pesa, MTN Money — flagged future
  usStyleInsuranceComplexityApplies: false, // no copays/deductibles/prior-auth/claim-denial cycles
} as const;

/** Payment methods accepted at checkout (Stage 10). */
export type PaymentMethod = 'cash' | 'mobile_money' | 'voucher' | 'partial_payment';

// ── Principle 2.11 — Medication criticality tiers ───────────────────────────

export type CriticalityTier = 1 | 2 | 3;

export const MEDICATION_CRITICALITY_TIERS: { tier: CriticalityTier; label: string; examples: string; drives: string }[] = [
  { tier: 1, label: 'Life-sustaining', examples: 'insulin, anti-epileptics, certain cardiac medications', drives: 'pharmacy queue priority; facility-emergency stockout response (list dependent patients + projected exhaustion, activate BHW alerts & referral pathways); checkout safety flag' },
  { tier: 2, label: 'Important, time-sensitive', examples: 'ART, TB medications, antihypertensives, oral hypoglycemics', drives: 'standard priority; normal logistics; adherence monitoring & defaulter tracing' },
  { tier: 3, label: 'Routine', examples: 'vitamins, stable maintenance medications', drives: 'routine logistics' },
];

// ── Principle 2.9 — Acuity-weighted queues with time-aging ──────────────────

/** Acuity scheme is configurable per facility (3–5 levels). Default is 5-level ETAT-style. */
export const ACUITY_SCHEME = {
  configurableLevels: { min: 3, max: 5 },
  defaultLevels: 5,
  timeAging: true, // longer wait raises priority; prevents indefinite waits for low acuity
  targetWaitTimesConfigurablePerFacility: true,
  flagOnExceedingTarget: true, // patients exceeding targets flagged for reassessment
} as const;

/**
 * Acuity-weighted priority score with time-aging (Principle 2.9). Higher score
 * = seen sooner. `acuityWeight` should be larger for higher acuity (e.g. level
 * 1 emergency = 5). `waitMinutes` ages the score so low-acuity patients are not
 * starved. Facilities tune `agingPerMinute` and per-level targets via config.
 */
export function queuePriorityScore(params: {
  acuityWeight: number;
  waitMinutes: number;
  agingPerMinute?: number;
}): number {
  const aging = params.agingPerMinute ?? 0.1;
  return params.acuityWeight * 100 + params.waitMinutes * aging;
}

export function exceedsTargetWait(waitMinutes: number, targetMinutes: number): boolean {
  return waitMinutes > targetMinutes;
}
