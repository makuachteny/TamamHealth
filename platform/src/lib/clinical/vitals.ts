/**
 * Shared vital-signs ranges, validation and abnormal-flagging.
 *
 * Consolidates the thresholds that were previously duplicated between
 * `components/nurse/shared.tsx` (getVitalFlags) and the inline range table in
 * TriageWorkflow's submit guard. One source of truth for "what counts as
 * abnormal / out-of-range".
 *
 * Also carries `mergeVitalsTimeline` — the merge/normalize logic for a
 * patient's vitals history across the two places they get captured
 * (MedicalRecordDoc.vitalSigns and TriageDoc's own vitals fields). Pure and
 * DB-free so both `chart-snapshot.ts` (picks the single newest entry for a
 * note) and the patient chart (needs the whole history for the vitals band/
 * table/trends) share one implementation instead of drifting.
 */

import type { MedicalRecordDoc, TriageDoc } from '../db-types';

/** Free-text (string) vitals as captured by the nurse/triage forms. */
export interface VitalsInput {
  systolic?: string;
  diastolic?: string;
  temperature?: string;
  pulse?: string;
  spo2?: string;
  weight?: string;
  respiratoryRate?: string;
  /** Pain score, 0–10 numeric rating scale. */
  painScore?: string;
  /** Capillary blood glucose, mmol/L. */
  bloodGlucose?: string;
  /** Glasgow Coma Scale, 3–15. */
  gcs?: string;
  /** Mid-upper arm circumference, cm (nutrition screening). */
  muac?: string;
  notes?: string;
}

/**
 * Physiologically plausible [min, max] bounds, used to reject garbage input
 * ("abc", "999") before persisting. Keys match VitalsInput numeric fields.
 */
export const VITAL_RANGES: Record<'temperature' | 'pulse' | 'respiratoryRate' | 'systolic' | 'diastolic' | 'spo2' | 'weight' | 'painScore' | 'bloodGlucose' | 'gcs' | 'muac', [number, number]> = {
  temperature: [25, 45],
  pulse: [20, 250],
  respiratoryRate: [4, 80],
  systolic: [40, 300],
  diastolic: [20, 200],
  spo2: [30, 100],
  weight: [0.5, 400],
  painScore: [0, 10],
  bloodGlucose: [1, 40],
  gcs: [3, 15],
  muac: [5, 50],
};

/**
 * Flag which vitals are abnormal (outside normal clinical range). Returns a
 * map of fieldName → true for each abnormal value. Mirrors the long-standing
 * thresholds used on the ward board.
 */
export function getVitalFlags(data: VitalsInput): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  const temp = parseFloat(data.temperature ?? '');
  const sys = parseInt(data.systolic ?? '');
  const dia = parseInt(data.diastolic ?? '');
  const spo2 = parseInt(data.spo2 ?? '');
  const pulse = parseInt(data.pulse ?? '');
  const rr = parseInt(data.respiratoryRate ?? '');
  const pain = parseInt(data.painScore ?? '');
  const glucose = parseFloat(data.bloodGlucose ?? '');
  const gcs = parseInt(data.gcs ?? '');
  const muac = parseFloat(data.muac ?? '');

  if (!isNaN(temp) && temp > 38.5) flags.temperature = true;
  if (!isNaN(sys) && (sys > 140 || sys < 90)) flags.systolic = true;
  if (!isNaN(dia) && (dia > 90 || dia < 60)) flags.diastolic = true;
  if (!isNaN(spo2) && spo2 < 95) flags.spo2 = true;
  if (!isNaN(pulse) && (pulse > 100 || pulse < 50)) flags.pulse = true;
  if (!isNaN(rr) && (rr > 24 || rr < 12)) flags.respiratoryRate = true;
  if (!isNaN(pain) && pain >= 7) flags.painScore = true;
  if (!isNaN(glucose) && (glucose < 3.9 || glucose > 11.1)) flags.bloodGlucose = true;
  if (!isNaN(gcs) && gcs < 15) flags.gcs = true;
  if (!isNaN(muac) && muac < 12.5) flags.muac = true; // < 12.5cm = acute malnutrition

  return flags;
}

/**
 * Validate a single entered vital is numeric and within plausible bounds.
 * Returns true when empty (optional) or valid; false for garbage/out-of-range.
 */
export function isVitalInRange(field: keyof typeof VITAL_RANGES, raw?: string): boolean {
  if (!raw) return true;
  const n = parseFloat(raw);
  const [min, max] = VITAL_RANGES[field];
  return !isNaN(n) && n >= min && n <= max;
}

/**
 * One row in a patient's merged vitals timeline — either a MedicalRecordDoc
 * observation (a consultation's vitals, or a standalone nursing check) or a
 * TriageDoc's captured vitals, normalized to the same numeric shape and
 * tagged with where it came from so the UI can label it.
 */
export interface VitalsTimelineEntry {
  /** The source document's `_id` — stable React key and deep-link target. */
  id: string;
  /** ISO-ish timestamp used to sort and to display "when". */
  at: string;
  source: 'Triage' | 'Consult' | 'Nursing';
  temperature?: number;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  muac?: number;
  bloodGlucose?: number;
  facility?: string;
}

/** Parses to a finite number, or `undefined` for empty/garbage input — never
 *  `0`, which the rest of the app treats as a real (if implausible) reading
 *  rather than "not taken". */
function numOrUndef(raw?: string | number): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** True once at least one measurement is present — filters out a record or
 *  triage stop that carries the vitals *shape* but no actual observation. */
function hasAnyVital(e: Pick<VitalsTimelineEntry,
  'temperature' | 'systolic' | 'diastolic' | 'pulse' | 'respiratoryRate' | 'oxygenSaturation' | 'weight' | 'muac' | 'bloodGlucose'
>): boolean {
  return [e.temperature, e.systolic, e.diastolic, e.pulse, e.respiratoryRate, e.oxygenSaturation, e.weight, e.muac, e.bloodGlucose]
    .some(v => v !== undefined);
}

/**
 * Merge a patient's medical-record vitals and triage vitals into one
 * normalized, newest-first timeline.
 *
 * `MedicalRecordDoc.vitalSigns` is already numeric; `TriageDoc`'s vitals
 * fields are free-text strings captured at triage and are parsed here.
 * Ties (same timestamp) keep record-sourced entries ahead of triage-sourced
 * ones, matching the long-standing tie-break in `chart-snapshot.ts`'s note
 * vitals lookup: a real record wins over a triage stop from the same moment.
 */
export function mergeVitalsTimeline(records: MedicalRecordDoc[], triages: TriageDoc[] = []): VitalsTimelineEntry[] {
  const fromRecords: VitalsTimelineEntry[] = records
    .filter(r => r.vitalSigns)
    .map((r): VitalsTimelineEntry => {
      const v = r.vitalSigns;
      return {
        id: r._id,
        at: r.consultedAt || r.visitDate || r.createdAt || '',
        source: r.recordKind === 'nursing_vitals' ? 'Nursing' : 'Consult',
        temperature: numOrUndef(v.temperature),
        systolic: numOrUndef(v.systolic),
        diastolic: numOrUndef(v.diastolic),
        pulse: numOrUndef(v.pulse),
        respiratoryRate: numOrUndef(v.respiratoryRate),
        oxygenSaturation: numOrUndef(v.oxygenSaturation),
        weight: numOrUndef(v.weight),
        height: numOrUndef(v.height),
        bmi: numOrUndef(v.bmi),
        muac: numOrUndef(v.muac),
        bloodGlucose: numOrUndef(v.bloodGlucose),
        facility: r.hospitalName,
      };
    })
    .filter(hasAnyVital);

  const fromTriage: VitalsTimelineEntry[] = triages
    .map((t): VitalsTimelineEntry => ({
      id: t._id,
      at: t.triagedAt || t.createdAt || '',
      source: 'Triage',
      temperature: numOrUndef(t.temperature),
      systolic: numOrUndef(t.systolic),
      diastolic: numOrUndef(t.diastolic),
      pulse: numOrUndef(t.pulse),
      respiratoryRate: numOrUndef(t.respiratoryRate),
      oxygenSaturation: numOrUndef(t.oxygenSaturation),
      weight: numOrUndef(t.weight),
      muac: numOrUndef(t.muac),
      bloodGlucose: numOrUndef(t.bloodGlucose),
      facility: t.facilityName,
    }))
    // Same completeness test the record side uses — filtering on a hand-listed
    // subset dropped triage stops whose ONLY observation was MUAC (nutrition
    // screening) or blood glucose.
    .filter(hasAnyVital);

  // Array#sort is stable (guaranteed since ES2019), so entries with an equal
  // `at` keep their relative order — records were concatenated first, so a
  // same-instant tie resolves to the record, not the triage stop.
  return [...fromRecords, ...fromTriage].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
