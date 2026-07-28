/**
 * The versioned telehealth consent policy.
 *
 * Read from facility settings so administrators can update the wording, and
 * versioned so an audit can reproduce exactly what a given patient agreed to.
 * A consent record carrying only "the patient ticked a box" proves an action
 * happened but not what was agreed — which is the entire evidentiary point.
 *
 * One helper, used by both the route that renders the policy and the route
 * that records consent against it, so the two cannot disagree about which
 * version is current.
 */

import { DEFAULT_FACILITY_SETTINGS } from './settings/facility-settings';

export interface ConsentPolicy {
  version: string;
  text: string[];
}

/**
 * Current policy for a facility, falling back to the shipped default.
 *
 * A settings read failure returns the default rather than throwing: a patient
 * must never be blocked from a consultation because a settings document could
 * not be loaded, and the default text is the same one the product ships with.
 */
export async function getConsentPolicy(facilityId: string): Promise<ConsentPolicy> {
  try {
    const { getFacilitySettings } = await import('./settings/settings-service');
    const settings = await getFacilitySettings(facilityId);
    const c = settings?.telehealthConsent;
    if (c?.policyVersion && c.policyText?.length) {
      return { version: c.policyVersion, text: c.policyText };
    }
  } catch {
    /* fall through to the default */
  }
  return {
    version: DEFAULT_FACILITY_SETTINGS.telehealthConsent.policyVersion,
    text: [...DEFAULT_FACILITY_SETTINGS.telehealthConsent.policyText],
  };
}

/** Just the version — what a consent record stores. */
export async function currentPolicyVersion(facilityId: string): Promise<string> {
  return (await getConsentPolicy(facilityId)).version;
}
