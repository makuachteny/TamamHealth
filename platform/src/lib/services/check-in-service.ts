/**
 * Patient check-in (front desk arrival).
 *
 * Records a patient's arrival at the facility as a triage queue entry (status
 * 'pending') so they appear on the reception / nurse-triage worklist, and — if
 * they have a scheduled appointment today — marks that appointment as
 * checked_in in the same action. Full ETAT ABCC assessment is left to the nurse
 * triage station; the front desk captures arrival context + an acuity flag.
 */
import type { TriageDoc, TriagePriority } from '../db-types';
import { createTriage, getTriageByPatient } from './triage-service';
import { getAppointmentsByPatient, updateAppointmentStatus } from './appointment-service';
import { jubaDate } from '../time-juba';

export type CheckInAcuity = 'routine' | 'priority' | 'emergency';

const ACUITY_TO_PRIORITY: Record<CheckInAcuity, TriagePriority> = {
  routine: 'GREEN',
  priority: 'YELLOW',
  emergency: 'RED',
};

export interface CheckInVitals {
  temperature?: string;
  pulse?: string;
  respiratoryRate?: string;
  systolic?: string;
  diastolic?: string;
  oxygenSaturation?: string;
  weight?: string;
  painScore?: string;
}

export interface CheckInInput {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  facilityId?: string;
  facilityName?: string;
  orgId?: string;
  /** How the patient arrived. */
  modeOfArrival?: TriageDoc['modeOfArrival'];
  chiefComplaint?: string;
  symptomDuration?: string;
  knownAllergies?: string;
  /** Front-desk acuity flag → triage priority (nurse confirms full ETAT). */
  acuity?: CheckInAcuity;
  vitals?: CheckInVitals;
  notes?: string;
  /** Acting front-desk user. */
  checkedInById: string;
  checkedInByName: string;
}

export interface CheckInResult {
  triage: TriageDoc;
  /** True when a scheduled appointment for today was also marked checked_in. */
  appointmentCheckedIn: boolean;
  appointmentId?: string;
}

async function linkSameDayAppointment(input: CheckInInput): Promise<Pick<CheckInResult, 'appointmentCheckedIn' | 'appointmentId'>> {
  try {
    const today = jubaDate();
    const appts = await getAppointmentsByPatient(input.patientId);
    const match = appts.find(
      (a) => a.appointmentDate === today && (a.status === 'scheduled' || a.status === 'confirmed'),
    );
    if (match) {
      await updateAppointmentStatus(match._id, 'checked_in');
      return { appointmentCheckedIn: true, appointmentId: match._id };
    }
  } catch {
    // appointment linkage is best-effort; the check-in itself still succeeded
  }
  return { appointmentCheckedIn: false };
}

/**
 * Check a patient in. Always creates the triage/queue entry; additionally marks
 * a same-day scheduled/confirmed appointment as checked_in when one exists.
 */
export async function checkInPatient(input: CheckInInput): Promise<CheckInResult> {
  if (!input.patientId || !input.patientName) {
    throw new Error('A patient is required to check in.');
  }
  const acuity = input.acuity ?? 'routine';
  const v = input.vitals ?? {};
  const today = jubaDate();

  const activeToday = (await getTriageByPatient(input.patientId)).find((triage) => {
    const sameDay = triage.triagedAt ? jubaDate(triage.triagedAt) === today : false;
    const active = triage.status === 'pending' || triage.status === 'seen';
    const sameFacility = !input.facilityId || !triage.facilityId || triage.facilityId === input.facilityId;
    return sameDay && active && sameFacility;
  });

  if (activeToday) {
    const linked = await linkSameDayAppointment(input);
    return { triage: activeToday, ...linked };
  }

  const triage = await createTriage({
    patientId: input.patientId,
    patientName: input.patientName,
    hospitalNumber: input.hospitalNumber,
    // ABCC not assessed at the front desk — recorded as stable defaults; the
    // nurse re-triages with the full ETAT decision tree.
    airway: 'clear',
    breathing: 'normal',
    circulation: 'normal',
    consciousness: 'alert',
    priority: ACUITY_TO_PRIORITY[acuity],
    temperature: v.temperature,
    pulse: v.pulse,
    respiratoryRate: v.respiratoryRate,
    systolic: v.systolic,
    diastolic: v.diastolic,
    oxygenSaturation: v.oxygenSaturation,
    weight: v.weight,
    painScore: v.painScore,
    chiefComplaint: input.chiefComplaint,
    symptomDuration: input.symptomDuration,
    knownAllergies: input.knownAllergies,
    modeOfArrival: input.modeOfArrival ?? 'walk-in',
    notes: input.notes,
    triagedBy: input.checkedInById,
    triagedByName: input.checkedInByName,
    triagedAt: new Date().toISOString(),
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    orgId: input.orgId,
    status: 'pending',
  } as Omit<TriageDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>);

  const linked = await linkSameDayAppointment(input);
  return { triage, ...linked };
}
