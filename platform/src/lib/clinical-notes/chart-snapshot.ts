/**
 * Snapshots of chart data for a note's derived sections.
 *
 * A note is a record of what the clinician saw at the time of the encounter, so
 * vitals, medications and allergies are captured as text at the moment they are
 * pulled in rather than rendered live. If the chart later changes, last month's
 * note must still say what it said — a note whose contents drift is not a
 * record, and re-reading it later would misrepresent what the decision was
 * based on.
 *
 * The formatters are pure and exported separately from the fetchers so they can
 * be unit-tested without a database.
 */

import type { AllergyEntry } from '../types/patient-clinical';
import type { PrescriptionDoc, ProblemDoc, MedicalRecordDoc, TriageDoc } from '../db-types';
import type { NoteSectionId } from './note-catalog';
import type { DataScope } from '../services/data-scope';

/** "38.1 °C · 150/90 · HR 92" — the line a clinician scans, not a table. */
export function formatVitals(record: Partial<Pick<MedicalRecordDoc, 'vitalSigns' | 'triageVitals'>> | null): string {
  if (!record) return '';
  const v = record.vitalSigns;
  const t = record.triageVitals;
  const parts: string[] = [];

  const temperature = v?.temperature ?? (t?.temperature ? Number(t.temperature) : undefined);
  const systolic = v?.systolic ?? (t?.systolic ? Number(t.systolic) : undefined);
  const diastolic = v?.diastolic ?? (t?.diastolic ? Number(t.diastolic) : undefined);
  const pulse = v?.pulse ?? (t?.pulse ? Number(t.pulse) : undefined);
  const resp = v?.respiratoryRate ?? (t?.respiratoryRate ? Number(t.respiratoryRate) : undefined);
  const spo2 = v?.oxygenSaturation ?? (t?.oxygenSaturation ? Number(t.oxygenSaturation) : undefined);
  const weight = v?.weight ?? (t?.weight ? Number(t.weight) : undefined);

  if (isNum(temperature)) parts.push(`Temp: ${temperature} °C`);
  if (isNum(systolic) && isNum(diastolic)) parts.push(`BP: ${systolic}/${diastolic} mmHg`);
  if (isNum(pulse)) parts.push(`HR: ${pulse} bpm`);
  if (isNum(resp)) parts.push(`RR: ${resp}/min`);
  if (isNum(spo2)) parts.push(`SpO₂: ${spo2}%`);
  if (isNum(weight)) parts.push(`Wt: ${weight} kg`);
  if (isNum(v?.height)) parts.push(`Ht: ${v!.height} cm`);
  if (isNum(v?.bmi)) parts.push(`BMI: ${v!.bmi}`);

  return parts.join('\n');
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v !== 0;
}

/** Active medications, one per line, dose and frequency included. */
export function formatMedications(prescriptions: PrescriptionDoc[]): string {
  const active = prescriptions.filter(p => p.status !== 'discontinued');
  if (active.length === 0) return '';
  return active
    .map((p) => {
      const bits = [p.medication, p.dose, p.route, p.frequency].filter(Boolean);
      const line = bits.join(' · ');
      return p.duration ? `${line} — ${p.duration}` : line;
    })
    .join('\n');
}

/**
 * Active allergies. Returns the explicit "no allergy history" sentence when the
 * list is empty, because "nothing documented" and "no known allergies" are
 * clinically different statements and the note must not blur them.
 */
export function formatAllergies(allergies: AllergyEntry[]): string {
  const active = allergies.filter(a => a.status === 'active');
  if (active.length === 0) return '';
  return active
    .map((a) => {
      const bits = [a.substance];
      if (a.reaction) bits.push(a.reaction);
      if (a.criticality && a.criticality !== 'unknown') bits.push(`${a.criticality} criticality`);
      return `• ${bits.join(' — ')}`;
    })
    .join('\n');
}

export function formatProblems(problems: ProblemDoc[]): string {
  const active = problems.filter(p => p.status === 'active');
  if (active.length === 0) return '';
  return active
    .map(p => `• ${p.name}${p.icd11Code ? ` [${p.icd11Code}]` : ''}`)
    .join('\n');
}

export interface ChartSnapshotInput {
  vitalsRecord?: Partial<Pick<MedicalRecordDoc, 'vitalSigns' | 'triageVitals'>> | null;
  prescriptions?: PrescriptionDoc[];
  allergies?: AllergyEntry[];
  problems?: ProblemDoc[];
}

/**
 * Text for one derived section. Returns an empty string when there is nothing
 * to show, so the caller can render its own "not documented" wording rather
 * than this module inventing a sentence for every section.
 */
export function snapshotForSection(
  sectionId: NoteSectionId,
  input: ChartSnapshotInput,
): string {
  switch (sectionId) {
    case 'vitals':
      return formatVitals(input.vitalsRecord ?? null);
    case 'medications':
      return formatMedications(input.prescriptions ?? []);
    case 'allergies': {
      const text = formatAllergies(input.allergies ?? []);
      return text || 'No allergy history has been documented for this patient.';
    }
    default:
      return '';
  }
}

/**
 * Fetch everything the derived sections need, in one pass.
 *
 * Each source is independently guarded: a chart with no problem list must still
 * produce vitals, and one failing read should not blank the whole note.
 *
 * `scope` is threaded into the tenant-boundary-sensitive reads (prescriptions,
 * vitals) the same way the chart itself scopes them — a note's derived
 * sections must not surface another facility's or org's data that the chart
 * would hide, especially once that text is frozen into a signed note.
 */
export async function loadChartSnapshot(patientId: string, scope?: DataScope): Promise<ChartSnapshotInput> {
  const [prescriptions, allergies, problems, vitalsRecord] = await Promise.all([
    safely(async () => {
      const { getPrescriptionsByPatient } = await import('../services/prescription-service');
      return getPrescriptionsByPatient(patientId, scope);
    }, [] as PrescriptionDoc[]),
    safely(async () => {
      const { getActiveAllergies } = await import('../services/allergy-service');
      return getActiveAllergies(patientId);
    }, [] as AllergyEntry[]),
    safely(async () => {
      const { getProblemsByPatient } = await import('../services/problem-service');
      return getProblemsByPatient(patientId);
    }, [] as ProblemDoc[]),
    newestVitals(patientId, scope),
  ]);

  return { prescriptions, allergies, problems, vitalsRecord };
}

/**
 * The patient's most recent vitals, from whichever source actually has them.
 *
 * TriageWorkflow writes vitals onto the TriageDoc itself, never onto a
 * medical_record's `triageVitals` — nothing in the app writes that field. A
 * note opened right after triage and before any consult record exists must
 * still pick up what triage just took, so this compares the newest
 * vitals-bearing medical record against the newest vitals-bearing triage stop
 * and returns whichever is more recent, rather than only ever looking at
 * medical records and showing stale (or no) vitals.
 */
async function newestVitals(
  patientId: string,
  scope?: DataScope,
): Promise<Partial<Pick<MedicalRecordDoc, 'vitalSigns' | 'triageVitals'>> | null> {
  const [fromRecord, fromTriage] = await Promise.all([
    safely(async () => {
      const { getRecordsByPatient } = await import('../services/medical-record-service');
      const rows = await getRecordsByPatient(patientId, scope);
      // Newest record that actually carries observations.
      const record = rows.find(r => r.vitalSigns || r.triageVitals) ?? null;
      return record ? { at: record.consultedAt || record.visitDate || record.createdAt || '', record } : null;
    }, null as { at: string; record: MedicalRecordDoc } | null),
    safely(async () => {
      const { getTriageByPatient } = await import('../services/triage-service');
      const rows = await getTriageByPatient(patientId, scope);
      const withVitals = rows
        .filter(t => t.temperature || t.pulse || t.respiratoryRate || t.systolic || t.diastolic || t.oxygenSaturation || t.weight)
        .sort((a, b) => (b.triagedAt || '').localeCompare(a.triagedAt || ''));
      return withVitals[0] ? { at: withVitals[0].triagedAt || '', triage: withVitals[0] } : null;
    }, null as { at: string; triage: TriageDoc } | null),
  ]);

  if (fromTriage && (!fromRecord || fromTriage.at.localeCompare(fromRecord.at) > 0)) {
    const t = fromTriage.triage;
    return {
      triageVitals: {
        temperature: t.temperature, systolic: t.systolic, diastolic: t.diastolic,
        pulse: t.pulse, respiratoryRate: t.respiratoryRate, oxygenSaturation: t.oxygenSaturation,
        weight: t.weight, muac: t.muac, bloodGlucose: t.bloodGlucose, capturedAt: t.triagedAt,
      },
    };
  }
  return fromRecord?.record ?? null;
}

async function safely<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
