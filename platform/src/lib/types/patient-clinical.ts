/**
 * Patient-chart clinical list types — the embedded records stored ON the patient
 * document (allergies, directives/consent, care alerts, preventive screenings).
 *
 * Extracted out of `data/mock.ts` so types live with types and `mock.ts` holds
 * data. Re-exported from `data/mock.ts` for backward compatibility, so existing
 * `from '@/data/mock'` imports keep working.
 */

/**
 * Structured allergy / adverse-reaction record (P0.3) stored on the patient
 * document. The denormalised `Patient.allergies: string[]` mirror holds the
 * active substance names; this is the source of truth for reaction, criticality
 * and status.
 */
export interface AllergyEntry {
  /** Stable id for keys + removal (uuid). */
  id: string;
  substance: string;
  classification?: 'drug' | 'food' | 'environmental' | 'biologic' | 'other';
  /** Clinical criticality — drives prescribing-time escalation. */
  criticality?: 'mild' | 'moderate' | 'severe' | 'unknown';
  /** Free-text description of the reaction (e.g. "anaphylaxis", "rash"). */
  reaction?: string;
  /** YYYY-MM-DD when the reaction was first noted, if known. */
  onsetDate?: string;
  status: 'active' | 'inactive' | 'resolved' | 'entered_in_error';
  /** Required when status moves away from active — preserves the audit trail. */
  removalReason?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
}

/**
 * Patient directive / consent record (P2.1). Holds informed consent, ABN /
 * non-covered-service acknowledgement, privacy preferences and advance
 * directives ON the patient chart so they aren't re-collected every visit.
 */
export type DirectiveType =
  | 'informed_consent'
  | 'abn_noncovered'
  | 'privacy_consent'
  | 'advance_directive'
  | 'release_of_information'
  | 'other';

export interface DirectiveEntry {
  id: string;
  type: DirectiveType;
  /** Human-readable description (free text or a picked predefined option). */
  description: string;
  /** YYYY-MM-DD the directive takes effect. */
  startDate?: string;
  status: 'active' | 'inactive' | 'expired' | 'revoked';
  /** Required when the directive is removed/revoked — preserves the audit trail. */
  removalReason?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
}

/**
 * Care alert (P1.2) — chart-permanent patient-safety information that should be
 * visible on every visit (e.g. "High fall risk", "Difficult IV access").
 */
export type CareAlertCategory =
  | 'clinical_risk'
  | 'safety'
  | 'infection_control'
  | 'administrative'
  | 'other';

export interface CareAlertEntry {
  id: string;
  category: CareAlertCategory;
  message: string;
  priority: 'high' | 'normal';
  status: 'active' | 'resolved';
  /** Required when resolving — preserves the audit trail. */
  resolutionReason?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
}

/**
 * A preventive-care / health-maintenance screening tracked on the chart —
 * e.g. blood-pressure check, cervical-cancer (VIA) screen, HIV test, well-child
 * visit. Each carries a due date and a recommended recall interval; "due"
 * entries with a past due date render as overdue.
 */
export interface ScreeningEntry {
  id: string;
  /** What is due, e.g. "Blood pressure", "Cervical cancer (VIA)", "HIV test". */
  type: string;
  status: 'due' | 'completed' | 'declined';
  /** When the screening is/was next due (yyyy-mm-dd). */
  dueDate?: string;
  /** When it was last performed (yyyy-mm-dd). */
  lastDoneDate?: string;
  /** Recommended recall interval in months (drives the next due date). */
  intervalMonths?: number;
  notes?: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt: string;
}
