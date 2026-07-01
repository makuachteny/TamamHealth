/**
 * Shared vital-signs ranges, validation and abnormal-flagging.
 *
 * Consolidates the thresholds that were previously duplicated between
 * `components/nurse/shared.tsx` (getVitalFlags) and the inline range table in
 * TriageWorkflow's submit guard. One source of truth for "what counts as
 * abnormal / out-of-range".
 */

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
