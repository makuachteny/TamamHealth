/**
 * Clinical thresholds — WHO/MoH reference values used in analytics, alerting,
 * and triage. Each value cites its source so the next clinician who edits it
 * knows what they're changing.
 *
 * To override per-tenant: add a `clinicalThresholds` block to the org's
 * platform_config doc; services should resolve via `getClinicalThresholds(orgId)`
 * which falls back to these defaults. (Per-tenant override is queued for a
 * follow-up — for now everyone uses these defaults.)
 */

export const CLINICAL_THRESHOLDS = {
  /** Low birth weight cutoff in grams. Source: WHO, ICD-11 KA20.3. */
  lowBirthWeightGrams: 2500,

  /** Very low birth weight cutoff in grams. Source: WHO. */
  veryLowBirthWeightGrams: 1500,

  /** Days overdue before an immunization defaulter is marked "high urgency". */
  defaulterHighUrgencyDays: 14,

  /** Days overdue before an immunization defaulter is marked "critical". */
  defaulterCriticalDays: 30,

  /** Neonatal age cutoff in days (deaths within this window are neonatal). */
  neonatalAgeDays: 28,

  /** Under-5 mortality cutoff in years. Source: WHO U5M definition. */
  under5MortalityYears: 5,

  /** Immunization coverage target (%). Source: WHO Reaching Every District. */
  immunizationCoverageTarget: 95,

  /** Maternal mortality ratio target per 100k live births. Source: WHO SDG 3.1. */
  maternalMortalityTargetPer100k: 70,
} as const;

export type ClinicalThresholdKey = keyof typeof CLINICAL_THRESHOLDS;
