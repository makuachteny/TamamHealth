import type { BaseDoc } from './db-types';

/**
 * Biometric (fingerprint) document types.
 *
 * Privacy/design notes:
 *   - Only minutiae TEMPLATES are stored, never raw fingerprint images.
 *     A template cannot be reversed into a usable fingerprint picture.
 *   - Templates live in their own database (`tamamhealth_biometric_templates`)
 *     so facilities can opt out of syncing biometrics independently of
 *     clinical data, and so revocation is a single-database concern.
 *   - Enrollment is consent-gated: the consent fields below are required at
 *     create time and recorded with the staff member who witnessed it.
 *   - Like all clinical data this is CouchDB/PouchDB-backed and offline-first;
 *     identification matches against the local replica.
 */

/** Fingers supported for enrollment, in scanner-prompt order. */
export type FingerPosition =
  | 'right_thumb' | 'right_index' | 'right_middle' | 'right_ring' | 'right_little'
  | 'left_thumb' | 'left_index' | 'left_middle' | 'left_ring' | 'left_little';

/**
 * Template encoding produced by the bridge driver. ISO/ANSI formats are
 * portable across scanner vendors; MOCK is the dev/demo driver.
 */
export type BiometricTemplateFormat = 'ISO_19794_2' | 'ANSI_378' | 'PROPRIETARY' | 'MOCK';

export interface BiometricTemplateDoc extends BaseDoc {
  type: 'biometric_template';
  patientId: string;
  /** Denormalized for identify-result display without a patients lookup. */
  patientName: string;
  finger: FingerPosition;
  /** Base64-encoded minutiae template as returned by the bridge. */
  template: string;
  format: BiometricTemplateFormat;
  /** Capture quality score 0-100 reported by the scanner driver. */
  quality: number;
  /** Bridge driver that produced the template (e.g. "mantra-mfs100", "mock"). */
  driver: string;
  /** Consent — required at enrollment. */
  consentGiven: true;
  /** Staff member (name/username) who recorded the patient's consent. */
  consentRecordedBy: string;
  consentRecordedAt: string;
  enrolledBy?: string;
  hospitalId?: string;
  orgId?: string;
  /** False once revoked; revoked templates are excluded from identification. */
  isActive: boolean;
  revokedAt?: string;
  revokedBy?: string;
}
