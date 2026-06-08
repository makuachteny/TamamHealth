/**
 * Boma Health Worker (BHW) community workflow.
 *
 * Faithful encoding of Section 10. The BHW workflow is structurally different
 * from the facility flow: offline-by-default, household-centric, mobile, and
 * catchment-scoped. This module defines the BHI structural context, visit
 * types, the three BHW status machines (10.11), the multi-channel referral
 * model (10.6.1), and the supervision chain (10.8).
 */

/** BHI structural context (Section 10.1) — drives engineering assumptions. */
export const BHI_CONTEXT = {
  continuumOfCare: ['BHW', 'PHCU', 'PHCC', 'county_hospital', 'state_referral_hospital', 'national'] as const,
  bhwsPerPhcu: { min: 12, max: 16 },
  householdsPerBhw: 40, // BHW devices must hold full offline records for ~40 households
  // The system must NOT assume a fixed service catalog per facility tier; some
  // PHCUs offer maternal/delivery services. Facility config is granular.
  fixedServiceCatalogPerTier: false,
  supervisionCadres: ['boma_health_worker', 'boma_supervisor', 'county_focal_point'] as const,
} as const;

/** Visit types the system ships templates for (Section 10.5). */
export type BhwVisitType =
  | 'routine_household'
  | 'postnatal_pnc'
  | 'newborn_young_infant'
  | 'under5_growth_monitoring'
  | 'immunization_followup'
  | 'anc_reminder_home_support'
  | 'art_adherence_support'
  | 'tb_dot'
  | 'ncd_home_support'
  | 'defaulter_tracing'
  | 'contact_tracing'
  | 'result_delivery'
  | 'population_health_outreach'
  | 'outbreak_surveillance_case_reporting'
  | 'referral_followthrough_verification'
  | 'death_notification';

export const BHW_VISIT_TYPES: { type: BhwVisitType; label: string; note: string }[] = [
  { type: 'routine_household', label: 'Routine household visit', note: 'Periodic per catchment rotation; general wellness check across members' },
  { type: 'postnatal_pnc', label: 'Postnatal visit (PNC)', note: 'WHO protocol at 24–48h, 7 days, 6 weeks; maternal + newborn assessment' },
  { type: 'newborn_young_infant', label: 'Newborn / young infant visit', note: 'Continuing PNC through under-5 monitoring' },
  { type: 'under5_growth_monitoring', label: 'Under-5 growth monitoring', note: 'MUAC, weight, growth trajectory, feeding, immunization status, IMCI danger signs' },
  { type: 'immunization_followup', label: 'Immunization follow-up', note: 'Due/overdue children; EPI coordination; occasional outreach doses' },
  { type: 'anc_reminder_home_support', label: 'ANC reminder & home support', note: 'Encourage facility ANC; danger signs; birth preparedness' },
  { type: 'art_adherence_support', label: 'ART adherence support', note: 'Monthly per protocol; adherence, side effects, disclosure, partner testing' },
  { type: 'tb_dot', label: 'TB DOT', note: 'Daily intensive / weekly continuation; observed medication; contact tracing' },
  { type: 'ncd_home_support', label: 'NCD home support', note: 'BP, glucose where equipped; adherence; complication screening' },
  { type: 'defaulter_tracing', label: 'Defaulter tracing', note: 'Locate, understand reason, support re-engagement; program-specific protocols' },
  { type: 'contact_tracing', label: 'Contact tracing', note: 'Index case triggers household screening per case definition (TB, cholera, COVID, VHF)' },
  { type: 'result_delivery', label: 'Result delivery', note: 'Non-urgent lab results at home; privacy-protective for sensitive results' },
  { type: 'population_health_outreach', label: 'Population health outreach', note: 'Catch-up immunizations, cervical screening, FP, WASH, malaria prevention, nutrition' },
  { type: 'outbreak_surveillance_case_reporting', label: 'Outbreak surveillance & case reporting', note: 'Case-based per surveillance definitions (AFP, measles, cholera, VHF, maternal/neonatal death); urgent sync priority' },
  { type: 'referral_followthrough_verification', label: 'Referral follow-through verification', note: 'Close the loop on previously-issued referrals' },
  { type: 'death_notification', label: 'Death notification', note: 'Date/time/location, cause if known, verbal autopsy; vital statistics; bereavement support' },
];

// ── 10.11 Status transitions ────────────────────────────────────────────────

/** BHW task lifecycle. */
export type BhwTaskStatus =
  | 'task_created'
  | 'assigned_to_bhw'
  | 'acknowledged_by_bhw'
  | 'in_progress'
  | 'completed'
  | 'deferred'
  | 'escalated_to_supervisor'
  | 'referred_to_facility'
  | 'cancelled';

export const BHW_TASK_TRANSITIONS: Readonly<Record<BhwTaskStatus, readonly BhwTaskStatus[]>> = {
  task_created: ['assigned_to_bhw', 'cancelled'],
  assigned_to_bhw: ['acknowledged_by_bhw', 'cancelled'],
  acknowledged_by_bhw: ['in_progress', 'deferred', 'escalated_to_supervisor', 'referred_to_facility', 'cancelled'],
  in_progress: ['completed', 'deferred', 'escalated_to_supervisor', 'referred_to_facility'],
  completed: [],
  deferred: ['in_progress'], // deferred to [date]
  escalated_to_supervisor: [],
  referred_to_facility: [],
  cancelled: [],
};

/** BHW visit lifecycle. */
export type BhwVisitStatus =
  | 'scheduled'
  | 'attempted'
  | 'completed'
  | 'household_not_home_rescheduled'
  | 'household_moved_out'
  | 'member_unavailable_rescheduled';

export const BHW_VISIT_TRANSITIONS: Readonly<Record<BhwVisitStatus, readonly BhwVisitStatus[]>> = {
  scheduled: ['attempted'],
  attempted: ['completed', 'household_not_home_rescheduled', 'household_moved_out', 'member_unavailable_rescheduled'],
  completed: [],
  household_not_home_rescheduled: ['scheduled'],
  household_moved_out: [],
  member_unavailable_rescheduled: ['scheduled'],
};

/** Surveillance report lifecycle. */
export type SurveillanceReportStatus =
  | 'captured'
  | 'synced'
  | 'acknowledged'
  | 'actioned';

export const SURVEILLANCE_TRANSITIONS: Readonly<Record<SurveillanceReportStatus, readonly SurveillanceReportStatus[]>> = {
  captured: ['synced'],
  synced: ['acknowledged'], // by supervisor / facility / county
  acknowledged: ['actioned'],
  actioned: [],
};

// ── 10.6.1 Multi-channel referral (offline-referral fallback) ───────────────
//
// Three channels; the patient is referred safely regardless of which one works.
// When the BHW eventually syncs, a channel-preserving merge produces one
// canonical referral that preserves both channels' provenance.

export type ReferralChannel = 'direct_sync' | 'phone_to_clerk' | 'paper';

export const REFERRAL_CHANNELS: { channel: ReferralChannel; label: string; note: string }[] = [
  { channel: 'direct_sync', label: 'Direct sync', note: 'Default. BHW creates referral on device; uploads when connectivity returns.' },
  { channel: 'phone_to_clerk', label: 'Phone-to-clerk (proxy capture)', note: 'Voice 2G has wider coverage than data. BHW calls front desk; clerk captures via "capture phoned-in referral from BHW" interface; BHW identity verified via BHW ID code (fallback: supervisor attestation / known-number callback). Referral attributed to the BHW, noting clerk acted as proxy with call time.' },
  { channel: 'paper', label: 'Paper carried by patient', note: 'Universal fallback. Patient arrives with the BHW handwritten slip; clerk enters it on arrival.' },
];

/**
 * Channel-preserving merge rule (10.6.1): when the BHW's on-device record syncs
 * and a phone-in record already exists for the same referral (same patient +
 * same BHW + similar timeframe), merge into ONE canonical referral that
 * preserves both channels' provenance. The BHW's content is authoritative.
 */
export const REFERRAL_MERGE_RULE = {
  matchOn: ['patient_id', 'bhw_id', 'time_window'] as const,
  canonicalContentSource: 'bhw_on_device' as const,
  preserveProvenanceOf: ['direct_sync', 'phone_to_clerk', 'paper'] as ReferralChannel[],
};

// ── 10.8 Supervision model ───────────────────────────────────────────────────

export type SupervisionCadre = 'boma_health_worker' | 'boma_supervisor' | 'county_focal_point';

export const SUPERVISION_CHAIN: { cadre: SupervisionCadre; oversees: SupervisionCadre | 'households' }[] = [
  { cadre: 'boma_health_worker', oversees: 'households' },
  { cadre: 'boma_supervisor', oversees: 'boma_health_worker' },
  { cadre: 'county_focal_point', oversees: 'boma_supervisor' },
];

/** Partial-sync priority (10.3 End of day): urgent items upload even without a full sync. */
export const PARTIAL_SYNC_PRIORITY = ['urgent_surveillance_reports', 'emergency_referrals'] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function nextBhwTask(s: BhwTaskStatus): readonly BhwTaskStatus[] { return BHW_TASK_TRANSITIONS[s] ?? []; }
export function nextBhwVisit(s: BhwVisitStatus): readonly BhwVisitStatus[] { return BHW_VISIT_TRANSITIONS[s] ?? []; }
export function nextSurveillance(s: SurveillanceReportStatus): readonly SurveillanceReportStatus[] { return SURVEILLANCE_TRANSITIONS[s] ?? []; }
