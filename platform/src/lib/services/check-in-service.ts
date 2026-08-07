/**
 * Patient check-in (front desk arrival).
 *
 * Records a patient's arrival at the facility as a triage queue entry (status
 * 'pending') so they appear on the reception / nurse-triage worklist, and — if
 * they have a scheduled appointment today — marks that appointment as
 * checked_in in the same action. Full ETAT ABCC assessment is left to the nurse
 * triage station; the front desk captures arrival context + an acuity flag.
 */
import type { AppointmentDoc, TriageDoc, TriagePriority, EncounterDoc } from '../db-types';
import { createTriage } from './triage-service';
import { createAppointment, getAppointmentsByPatient, updateAppointmentStatus } from './appointment-service';
import { jubaDate, jubaTime } from '../time-juba';
import { APPOINTMENT_PENDING_STATUSES } from '../appointment-status';
import { createArrivalEncounter, findOpenEncounterForPatient, hasClosedEncounterForPatient, PRE_CLINICIAN_STATUSES } from './encounter-service';
import { getRecordsByPatient } from './medical-record-service';

export type AttendanceType = 'new' | 'repeat';

/**
 * New case vs re-attendance, auto-derived once at arrival: a patient with any
 * prior medical record or any previously closed encounter is a repeat
 * attendance; otherwise it's a new case. Callers may override it — the front
 * desk's arrival dialog asks when it matters.
 */
export async function deriveAttendanceType(patientId: string): Promise<AttendanceType> {
  try {
    const records = await getRecordsByPatient(patientId);
    if (records.length > 0) return 'repeat';
  } catch {
    // best-effort — fall through to the encounter check
  }
  try {
    if (await hasClosedEncounterForPatient(patientId)) return 'repeat';
  } catch {
    // best-effort — default to 'new' below
  }
  return 'new';
}

/**
 * Check a BOOKED patient in from the appointment itself — the only check-in
 * path now that the standalone Check-In module is gone.
 *
 * Flipping the appointment status is not a check-in on its own: the visit
 * thread every downstream station joins (triage, rooming, the clinician's
 * note, the checkout gate) hangs off the arrival encounter. The appointments
 * page used to write the status and nothing else, so a patient checked in from
 * there had no visit; this is why the two callers share one function.
 *
 * The encounter is best-effort — an appointment marked checked-in with no
 * encounter is recoverable, but refusing the check-in leaves the patient
 * standing at the desk.
 */
export async function checkInAppointment(input: {
  appointmentId: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  facilityId?: string;
  facilityName?: string;
  orgId?: string;
  /** New case vs re-attendance; auto-derived when omitted. */
  attendanceType?: AttendanceType;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}): Promise<void> {
  const { updateAppointmentStatus } = await import('./appointment-service');
  await updateAppointmentStatus(input.appointmentId, 'checked_in', {
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole as never,
  });

  try {
    const existing = await findOpenEncounterForPatient(input.patientId, input.facilityId || '');
    if (existing) return; // already threaded onto a live visit
    const attendanceType = input.attendanceType ?? await deriveAttendanceType(input.patientId);
    await createArrivalEncounter({
      patientId: input.patientId,
      patientName: input.patientName,
      hospitalNumber: input.hospitalNumber,
      hospitalId: input.facilityId || '',
      hospitalName: input.facilityName,
      orgId: input.orgId,
      arrivalChannel: 'appointment',
      appointmentId: input.appointmentId,
      attendanceType,
      actorId: input.actorId,
    });
  } catch {
    // The appointment is checked in either way; the visit thread can be
    // repaired, a patient left un-checked-in at the desk cannot.
  }
}

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
  /**
   * New case vs re-attendance. When omitted, auto-derived via
   * `deriveAttendanceType` from the patient's history.
   */
  attendanceType?: AttendanceType;
  /** Acting front-desk user. */
  checkedInById: string;
  checkedInByName: string;
}

export interface CheckInResult {
  triage: TriageDoc;
  /** The visit (encounter) this check-in joined or created. */
  encounter: EncounterDoc;
  /** True when a scheduled appointment for today was also marked checked_in. */
  appointmentCheckedIn: boolean;
  /** The appointment now linked to this visit — matched-existing or the walk-in's own new one. */
  appointmentId?: string;
  /** True when this check-in wrote a brand-new walk-in booking (no scheduled appointment matched). */
  walkInAppointmentCreated: boolean;
  attendanceType: AttendanceType;
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

  // Resolve a same-day scheduled/confirmed appointment up front so the match
  // is threaded onto the encounter instead of being computed and discarded
  // (docs/EMR-FIELD-AUDIT-2026-07.md §1, structural break #1) — non-fatal.
  let appointmentId: string | undefined;
  try {
    const today = jubaDate();
    // getAppointmentsByPatient is unscoped (matches across every org/facility
    // the patient has ever visited), so the match below must apply its own
    // org + facility filter — otherwise a booking at a different tenant's
    // facility for the same patient gets treated as today's visit here: it
    // is marked checked_in on THEIR board, this walk-in is silently linked to
    // it, and the walk-in booking branch below never fires.
    const appts = await getAppointmentsByPatient(input.patientId);
    // Any rung that still expects the patient: booked, reminded, confirmed, or
    // marked arrived but not yet checked in at the desk.
    const match = appts.find(
      (a) =>
        a.appointmentDate === today &&
        APPOINTMENT_PENDING_STATUSES.includes(a.status) &&
        a.orgId === input.orgId &&
        a.facilityId === input.facilityId,
    );
    if (match) appointmentId = match._id;
  } catch {
    // appointment lookup is best-effort; a walk-in check-in still proceeds
  }

  const arrivalChannel: 'appointment' | 'walk_in' | 'referral' = appointmentId
    ? 'appointment'
    : input.modeOfArrival === 'referral'
      ? 'referral'
      : 'walk_in';

  // Join the patient's already-open visit (e.g. re-checked-in after a lapse)
  // instead of spawning a duplicate encounter for the same episode of care —
  // scoped to THIS facility, so another facility's open encounter in the
  // shared org DB is never absorbed. Checked BEFORE the walk-in booking below
  // is written: a rejected check-in must not leave a stray appointment on
  // today's schedule.
  let encounter = await findOpenEncounterForPatient(input.patientId, input.facilityId || '');
  if (encounter && !PRE_CLINICIAN_STATUSES.includes(encounter.status)) {
    // The visit is already with a clinician (or in a downstream loop such as
    // labs/checkout). A duplicate check-in here would attach a fresh pending
    // triage to a mid-flight encounter and re-queue a patient who is already
    // being seen — reject it with a message the front-desk toast can show.
    throw new Error('This patient already has a visit in progress — no new check-in was recorded.');
  }

  // A walk-in gets a booking of its own, created at the moment they are
  // checked in. Without one, half the patients in the building had no
  // appointment record, so every surface that reasons about a visit — the
  // front desk's status ladder, its detail panel, the day's schedule — had two
  // kinds of patient to special-case, and the walk-in always got the poorer
  // half. The triage record is untouched: that is where the ETAT assessment
  // lives, and this is a slot, not an assessment.
  let walkInAppointmentId: string | undefined;
  if (!appointmentId) {
    try {
      const created = await createAppointment({
        patientId: input.patientId,
        patientName: input.patientName,
        // The desk does not choose a clinician at check-in; the queue assigns
        // one. Left unassigned rather than guessed.
        providerId: '',
        providerName: '',
        facilityId: input.facilityId ?? '',
        facilityName: input.facilityName ?? '',
        facilityLevel: 'county',
        appointmentDate: jubaDate(),
        // Same clock as the date above — reading the hour off the browser's
        // own timezone paired a Juba calendar date with a non-Juba wall-clock
        // time for anyone outside Africa/Juba.
        appointmentTime: jubaTime(),
        duration: 15,
        // Recorded as what it is. The status is already `checked_in`: the
        // patient is at the desk, not expected later.
        appointmentType: 'walk_in',
        status: 'checked_in',
        priority: acuity === 'emergency' ? 'emergency' : 'routine',
        department: 'OPD',
        reason: input.chiefComplaint || 'Walk-in visit',
        orgId: input.orgId,
        createdBy: input.checkedInById,
      } as Omit<AppointmentDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>);
      walkInAppointmentId = created._id;
    } catch {
      // Non-fatal: a walk-in must still be able to check in if the booking
      // cannot be written. Their row falls back to the queue's own stage.
    }
  }

  // The appointment now linked to this visit: the matched scheduled booking,
  // or the walk-in's own new one. The two branches above are mutually
  // exclusive, so this never merges two different bookings.
  const linkedAppointmentId = appointmentId ?? walkInAppointmentId;

  const attendanceType = input.attendanceType ?? await deriveAttendanceType(input.patientId);

  if (!encounter) {
    encounter = await createArrivalEncounter({
      patientId: input.patientId,
      patientName: input.patientName,
      hospitalNumber: input.hospitalNumber,
      hospitalId: input.facilityId || '',
      hospitalName: input.facilityName,
      orgId: input.orgId,
      arrivalChannel,
      appointmentId: linkedAppointmentId,
      attendanceType,
      actorId: input.checkedInById,
    });
  }

  const triage = await createTriage({
    patientId: input.patientId,
    patientName: input.patientName,
    hospitalNumber: input.hospitalNumber,
    // ABCC is NOT assessed at the front desk, and the record must say so
    // (KAN-100): writing normal-looking defaults here fabricated clinical
    // findings no clinician made. The clerk-selected acuity is real user
    // input and is kept; the nurse re-triages with the full ETAT tree.
    airway: 'not_assessed',
    breathing: 'not_assessed',
    circulation: 'not_assessed',
    consciousness: 'not_assessed',
    assessmentSource: 'clerical_checkin',
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
    encounterId: encounter._id,
  } as Omit<TriageDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>);

  // Mark the matched EXISTING appointment checked_in — non-fatal. A
  // newly-created walk-in booking is already written with status
  // 'checked_in' above, so this only ever fires for the matched-appointment
  // branch: `appointmentCheckedIn` means "an existing scheduled appointment
  // was marked checked_in", not "this visit now has an appointment".
  let appointmentCheckedIn = false;
  if (appointmentId) {
    try {
      await updateAppointmentStatus(appointmentId, 'checked_in');
      appointmentCheckedIn = true;
    } catch {
      // appointment linkage is best-effort; the check-in itself still succeeded
    }
  }

  return {
    triage,
    encounter,
    appointmentCheckedIn,
    appointmentId: linkedAppointmentId,
    walkInAppointmentCreated: Boolean(walkInAppointmentId),
    attendanceType,
  };
}
