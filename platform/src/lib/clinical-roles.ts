import type { UserRole } from './db-types';

/**
 * Single source of truth for the clinical-document authorship roles used by both
 * the service layer (authorization) and the UI (action gating). Keeping these
 * here avoids the drift the audit flagged between RecordSignatureBar and
 * PhoneNotes.
 */

/** Roles that may sign a clinical note as final and co-sign a trainee's note. */
export const PROVIDER_ROLES: UserRole[] = ['doctor', 'medical_superintendent', 'clinician'];

/** Clinical authors who sign but route to a supervising provider for co-signature. */
export const TRAINEE_AUTHOR_ROLES: UserRole[] = ['clinical_officer', 'nurse', 'midwife', 'nutritionist'];

/** Can sign as final / co-sign / respond to a routed clinical communication. */
export function isProviderRole(role?: UserRole | string): boolean {
  return !!role && (PROVIDER_ROLES as string[]).includes(role);
}

/** May author (sign) a clinical document — provider or supervised trainee. */
export function isClinicalAuthorRole(role?: UserRole | string): boolean {
  return !!role && ((PROVIDER_ROLES as string[]).includes(role) || (TRAINEE_AUTHOR_ROLES as string[]).includes(role));
}

/** Shared "no known allergy" sentinels — centralized so every check agrees. */
export const NO_ALLERGY_SENTINELS = ['none', 'none known', 'nkda', 'no known', 'nil', 'n/a', 'na', 'unknown'];

/** True when an allergy substance string is really a "no known allergies" marker. */
export function isNoAllergySentinel(substance?: string): boolean {
  const n = (substance || '').trim().toLowerCase();
  return n.length === 0 || NO_ALLERGY_SENTINELS.some((s) => n === s || n.startsWith(s));
}
