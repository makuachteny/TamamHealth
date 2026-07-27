/**
 * Patient identification — geocode-based scheme.
 *
 * Faithful encoding of Principle 2.7 (and 2.7.1 working assumptions). Patients
 * are identified by a geocode-based identifier tied to geography + household
 * rather than to documents many patients don't possess.
 *
 *   Primary form:   BOMA-{bomaCode}-HH{householdNumber}-{patientSuffix}
 *   Supplemented by:
 *     - a facility-scoped hospital number issued at first registration
 *     - South Sudan national ID where available (optional)
 *     - an internal UUID as the system-wide primary key
 *
 * IMPORTANT working assumptions (2.7.1, held loosely — subject to field
 * validation): household numbers are system-assigned by default; patients need
 * not know their boma/household at registration (clerk captures geolocation and
 * the system assigns the ID afterward); the ID is STABLE across moves (assigned
 * once, never changes; address/catchment changes are stored as current-location
 * attributes); each household member gets a distinct suffix sharing the
 * household prefix.
 */

/** Administrative hierarchy used to establish the geocode (state → county → payam → boma). */
export interface GeoLocation {
  state: string;
  county: string;
  payam: string;
  boma: string;
  /** Resolved boma code used in the identifier. */
  bomaCode: string;
  /** Optional GPS where captured. */
  gps?: { lat: number; lng: number };
  /** Free-text residence description (landmarks, head-of-household, neighbors). */
  residenceDescription?: string;
}

export interface PatientIdentity {
  /** System-wide primary key. */
  uuid: string;
  /** Geocode-based permanent identifier (stable across moves). */
  geocodeId: string; // BOMA-{bomaCode}-HH{householdNumber}-{patientSuffix}
  /** Facility-scoped hospital number issued at first registration. */
  hospitalNumber?: string;
  /** South Sudan national ID where available (optional). */
  nationalId?: string;
  /** Temporary/unidentified pathway flags. */
  isUnidentified?: boolean;
  registrationComplete?: boolean;
  /** Patient without a geocode yet (displaced/transient) — upgradable later. */
  transient?: boolean;
}

export const PATIENT_ID_ASSUMPTIONS = {
  householdNumberAssignment: 'system_assigned_default', // alternatives evaluated after field engagement
  patientNeedNotKnowIdAtRegistration: true, // clerk captures geolocation; system assigns ID after
  idStableAcrossMoves: true, // assigned once; current-location stored as attributes, not in the ID
  eachHouseholdMemberDistinctSuffix: true, // siblings/parents share household prefix, individually identifiable
  householdIsLightweightEntity: true, // Principle 2.8 — enriched later as additive change
} as const;

/**
 * Build the geocode-based identifier.
 *
 * The `patientSuffix` scheme is finalised as `P{n}` — see `buildPatientSuffix`.
 * Callers that already hold a suffix (imports, migrations, tests) may pass any
 * string; callers registering a new person should use `buildPatientSuffix`.
 */
export function buildGeocodeId(params: { bomaCode: string; householdNumber: number | string; patientSuffix: string }): string {
  return `BOMA-${params.bomaCode}-HH${params.householdNumber}-${params.patientSuffix}`;
}

/**
 * The finalised patient-suffix scheme: `P{n}`, 1-based, in registration order
 * within a household.
 *
 * Chosen over the alternatives because:
 *   - It keeps the household prefix intact, so `householdPrefix()` still
 *     groups co-residents for BHW household operations (assumption 2.7.1).
 *   - It is stable: a member's suffix is assigned once and never renumbers
 *     when a sibling is added or a record is deactivated. Renumbering would
 *     break `idStableAcrossMoves`.
 *   - It is human-sayable over a radio or phone ("BOMA KJ, household 1001,
 *     person 2"), which matters for BHWs working without connectivity.
 *
 * NOTE: this is intentionally NOT derived from name, age or sex — those change
 * or are unknown at registration, and encoding them would leak PHI into an
 * identifier that gets written on paper referral slips.
 */
export function buildPatientSuffix(memberIndex: number): string {
  if (!Number.isInteger(memberIndex) || memberIndex < 1) {
    throw new RangeError(`patient suffix index must be a positive integer, got ${memberIndex}`);
  }
  return `P${memberIndex}`;
}

/** Parse `P{n}` back to its index. Returns 0 for anything that isn't our scheme. */
export function parsePatientSuffix(suffix: string): number {
  const m = /^P(\d+)$/.exec(suffix.trim());
  return m ? Number(m[1]) : 0;
}

/**
 * Next free member index for a household, given the geocode IDs already issued
 * in it. Takes the highest existing index + 1 rather than `count + 1`, so a
 * deleted or merged record never causes a collision with a live one.
 */
export function nextPatientSuffix(existingGeocodeIds: readonly string[]): string {
  let highest = 0;
  for (const id of existingGeocodeIds) {
    const suffix = id.slice(id.lastIndexOf('-') + 1);
    highest = Math.max(highest, parsePatientSuffix(suffix));
  }
  return buildPatientSuffix(highest + 1);
}

/** Household-level prefix shared by co-residing family members (BHW/household ops). */
export function householdPrefix(params: { bomaCode: string; householdNumber: number | string }): string {
  return `BOMA-${params.bomaCode}-HH${params.householdNumber}`;
}

/** Temporary identifier for unconscious / unidentified patients (Stage 2 special case). */
export function buildUnknownId(params: { facility: string; date: string; seq: number | string }): string {
  return `UNKNOWN-${params.facility}-${params.date}-${params.seq}`;
}

const GEOCODE_RE = /^BOMA-[A-Za-z0-9]+-HH[0-9A-Za-z]+-.+$/;
const UNKNOWN_RE = /^UNKNOWN-.+-.+-.+$/;

export function isGeocodeId(id: string): boolean {
  return GEOCODE_RE.test(id);
}

export function isTemporaryId(id: string): boolean {
  return UNKNOWN_RE.test(id);
}
