/**
 * Consultation progress — derived, never hand-maintained.
 *
 * The old tracker asked a human to keep a second state machine in sync by hand
 * (a stage dropdown plus nine tickable milestones). That is unsafe as well as
 * tedious: a hand-ticked "Diagnosis documented" is an assertion nobody checked,
 * sitting next to a real signed note that says otherwise.
 *
 * This module computes every step from the records that already exist, so a
 * step is marked done only because a document proves it, and always carries
 * WHO did it and WHEN. Nothing here writes; nothing here can be ticked.
 *
 * The encounter state machine in `encounter-journey.ts` remains authoritative
 * for *where the patient is*. These steps describe *what has been recorded*,
 * which is a different (and complementary) question.
 */

import type { EncounterStatus } from './encounter-journey';

/* ── Structural inputs ───────────────────────────────────────────────────────
 * Deliberately narrow: this module only needs the fields it reads, so it does
 * not couple to the full document types (and keeps unit tests trivial). */

export interface ProgressEncounterLike {
  _id?: string;
  status?: EncounterStatus | string;
  providerName?: string;
  startedAt?: string;
  createdAt?: string;
}

export interface ProgressAppointmentLike {
  _id?: string;
  patientId?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  status?: string;
  checkedInAt?: string;
  checkedInByName?: string;
  createdAt?: string;
}

export interface ProgressTriageLike {
  _id?: string;
  patientId?: string;
  triagedAt?: string;
  triagedByName?: string;
  priority?: string;
}

export interface ProgressRecordLike {
  _id?: string;
  patientId?: string;
  encounterId?: string;
  recordKind?: string;
  documentStatus?: 'draft' | 'signed' | 'amended' | 'awaiting_cosign';
  diagnosis?: string;
  doctorName?: string;
  signedByName?: string;
  signedAt?: string;
  visitDate?: string;
  createdAt?: string;
}

export interface ProgressOrderLike {
  _id?: string;
  patientId?: string;
  encounterId?: string;
  status?: string;
  prescribedBy?: string;
  orderedByName?: string;
  requestedByName?: string;
  createdAt?: string;
}

export type DerivedStepState = 'done' | 'pending';

export interface DerivedStep {
  key: string;
  label: string;
  state: DerivedStepState;
  /** Display name of whoever performed it — omitted when the record does not say. */
  actor?: string;
  /** ISO timestamp of the underlying record. */
  at?: string;
  /** Shown under a pending step so the reader knows what would satisfy it. */
  hint?: string;
}

/** A non-linear outcome that cannot sit on a progress list — shown as a callout. */
export interface DerivedException {
  status: string;
  label: string;
  detail: string;
}

export interface DerivedProgress {
  steps: DerivedStep[];
  doneCount: number;
  /**
   * Where the patient is now, per the authoritative encounter machine.
   * `undefined` when there is no open encounter — in that case the tracker must
   * NOT claim a position. Saying "currently not started" above four completed
   * steps is the same class of lie this component was rewritten to remove.
   */
  currentLabel?: string;
  exception?: DerivedException;
  /** True when no encounter and no records exist — the visit has not started. */
  notStarted: boolean;
}

/* ── Exception outcomes ─────────────────────────────────────────────────────
 * These are terminal or diverting states from the encounter journey. They are
 * NOT steps: a linear list that renders "Cancelled" as step 8 implies a patient
 * progresses toward being cancelled, which is nonsense. They get a callout. */
const EXCEPTIONS: Record<string, { label: string; detail: string }> = {
  lwbs: { label: 'Left without being seen', detail: 'The patient left before a clinician saw them. Remaining steps will not be completed.' },
  escalated_to_emergency: { label: 'Escalated to emergency', detail: 'Care moved to the emergency pathway; this consultation is no longer the active route.' },
  referred_out: { label: 'Referred out', detail: 'The patient was referred to another facility. Follow-up sits with the receiving team.' },
  admitted: { label: 'Admitted', detail: 'The patient was admitted to a ward. Care continues on the inpatient record.' },
  deceased: { label: 'Deceased', detail: 'Recorded as deceased during this encounter.' },
  transferred_to_other_clinic: { label: 'Transferred to another clinic', detail: 'Care moved to a different clinic within the facility.' },
  dismissed_without_formal_checkout: { label: 'Left without formal checkout', detail: 'The patient departed before facility checkout completed.' },
};

/** Human label for the authoritative encounter status. */
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  registered: 'Registered',
  arrived_at_facility: 'Arrived at facility',
  awaiting_next_station: 'Awaiting next station',
  awaiting_triage: 'Awaiting triage',
  in_triage: 'In triage',
  triaged_awaiting_destination: 'Triaged, awaiting destination',
  routed_to_clinic: 'Routed to clinic',
  arrived_at_clinic_awaiting_rooming: 'Awaiting rooming',
  in_rooming: 'In rooming',
  ready_for_clinician: 'Ready for clinician',
  with_clinician: 'With clinician',
  awaiting_labs: 'Awaiting labs',
  awaiting_imaging: 'Awaiting imaging',
  awaiting_pharmacy: 'Awaiting pharmacy',
  awaiting_procedure: 'Awaiting procedure',
  consultation_paused_draft: 'Consultation paused',
  ready_for_clinic_checkout: 'Ready for clinic checkout',
  in_clinic_checkout: 'In clinic checkout',
  clinic_complete_awaiting_next_station: 'Clinic complete',
  awaiting_facility_checkout: 'Awaiting facility checkout',
  in_facility_checkout: 'In facility checkout',
  discharged: 'Discharged',
  discharged_with_referral: 'Discharged with referral',
  discharged_with_pending_items: 'Discharged with pending items',
};

/** Same calendar day, compared on the ISO date prefix. */
function sameDay(iso: string | undefined, dayKey: string): boolean {
  return Boolean(iso && iso.slice(0, 10) === dayKey);
}

/**
 * Scope a record to this visit: prefer the explicit encounter link, and fall
 * back to same-day only when the record predates encounter stamping. Being
 * strict here matters — attributing yesterday's note to today's visit would
 * show a consultation as signed before it started.
 */
function belongsToVisit(
  doc: { encounterId?: string; createdAt?: string; visitDate?: string },
  encounterId: string | undefined,
  dayKey: string,
): boolean {
  if (encounterId && doc.encounterId) return doc.encounterId === encounterId;
  if (doc.encounterId) return false;
  return sameDay(doc.visitDate || doc.createdAt, dayKey);
}

function newest<T extends { createdAt?: string }>(rows: T[]): T | undefined {
  return rows.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
}

export function deriveConsultationProgress(input: {
  patientId: string;
  encounter?: ProgressEncounterLike | null;
  appointments?: ProgressAppointmentLike[];
  triages?: ProgressTriageLike[];
  records?: ProgressRecordLike[];
  prescriptions?: ProgressOrderLike[];
  labResults?: ProgressOrderLike[];
  /** Local calendar day (YYYY-MM-DD) used for same-day fallback scoping. */
  dayKey: string;
}): DerivedProgress {
  const { patientId, encounter, dayKey } = input;
  const encounterId = encounter?._id;

  const mine = <T extends { patientId?: string }>(rows: T[] | undefined) =>
    (rows || []).filter(r => r.patientId === patientId);

  const appointments = mine(input.appointments);
  const triages = mine(input.triages);
  const records = mine(input.records).filter(
    r => r.recordKind !== 'nursing_vitals' && belongsToVisit(r, encounterId, dayKey),
  );
  const prescriptions = mine(input.prescriptions).filter(p => belongsToVisit(p, encounterId, dayKey));
  const labs = mine(input.labResults).filter(l => belongsToVisit(l, encounterId, dayKey));

  /* 1 — Checked in. Prefer the appointment's own check-in stamp, which carries
   *     the clerk who did it; fall back to the encounter's arrival. */
  const checkedInAppt = appointments.find(a => a.checkedInAt && sameDay(a.checkedInAt, dayKey));
  const arrivalStatuses = new Set(['arrived_at_facility', 'awaiting_next_station']);
  const encounterArrived = Boolean(
    encounter && encounter.status && !['scheduled', 'registered'].includes(String(encounter.status)),
  );
  const checkedIn: DerivedStep = checkedInAppt
    ? { key: 'checked_in', label: 'Checked in', state: 'done', actor: checkedInAppt.checkedInByName, at: checkedInAppt.checkedInAt }
    : encounterArrived
      ? { key: 'checked_in', label: 'Checked in', state: 'done', at: encounter?.startedAt || encounter?.createdAt }
      : { key: 'checked_in', label: 'Checked in', state: 'pending', hint: 'Front desk records arrival' };
  void arrivalStatuses;

  /* 2 — Triage. A triage document is the proof; it carries its own actor. */
  const triage = triages.find(t => sameDay(t.triagedAt, dayKey));
  const triaged: DerivedStep = triage
    ? { key: 'triaged', label: 'Triage completed', state: 'done', actor: triage.triagedByName, at: triage.triagedAt }
    : { key: 'triaged', label: 'Triage completed', state: 'pending', hint: 'Nurse records an ETAT assessment' };

  /* 3 — Seen by a clinician. Either the encounter has reached (or passed) the
   *     consultation, or a consultation record exists for the visit. */
  const preClinician = new Set([
    'scheduled', 'registered', 'arrived_at_facility', 'awaiting_next_station',
    'awaiting_triage', 'in_triage', 'triaged_awaiting_destination',
    'routed_to_clinic', 'arrived_at_clinic_awaiting_rooming', 'in_rooming', 'ready_for_clinician',
  ]);
  const consultRecord = newest(records);
  const seen = Boolean((encounter?.status && !preClinician.has(String(encounter.status))) || consultRecord);
  const seenStep: DerivedStep = seen
    ? { key: 'seen', label: 'Seen by clinician', state: 'done', actor: consultRecord?.doctorName || encounter?.providerName, at: consultRecord?.createdAt || encounter?.startedAt }
    : { key: 'seen', label: 'Seen by clinician', state: 'pending', hint: 'Consultation opens for this patient' };

  /* 4 — Diagnosis documented. Proof is a non-empty diagnosis on the record. */
  const diagnosed = records.find(r => (r.diagnosis || '').trim().length > 0);
  const diagnosis: DerivedStep = diagnosed
    ? { key: 'diagnosis', label: 'Diagnosis documented', state: 'done', actor: diagnosed.doctorName, at: diagnosed.createdAt }
    : { key: 'diagnosis', label: 'Diagnosis documented', state: 'pending', hint: 'Clinician records a diagnosis' };

  /* 5 — Orders placed. Either a prescription or a lab order for this visit. */
  const firstOrder = newest([...prescriptions, ...labs]);
  const orderCount = prescriptions.length + labs.length;
  const orders: DerivedStep = firstOrder
    ? {
        key: 'orders',
        label: orderCount === 1 ? 'Order placed' : `Orders placed (${orderCount})`,
        state: 'done',
        actor: firstOrder.orderedByName || firstOrder.requestedByName || firstOrder.prescribedBy,
        at: firstOrder.createdAt,
      }
    : { key: 'orders', label: 'Orders placed', state: 'pending', hint: 'Labs or medication ordered, if the visit needs them' };

  /* 6 — Follow-up scheduled. A future appointment created during this visit. */
  const followUp = appointments.find(a => (a.appointmentDate || '') > dayKey && a.status !== 'cancelled');
  const follow: DerivedStep = followUp
    ? { key: 'follow_up', label: 'Follow-up scheduled', state: 'done', at: followUp.createdAt, actor: undefined }
    : { key: 'follow_up', label: 'Follow-up scheduled', state: 'pending', hint: 'Booked if the patient needs another visit' };

  /* 7 — Consultation signed. The only step that closes the clinical record. */
  const signed = records.find(r => r.documentStatus === 'signed' || r.documentStatus === 'amended');
  const awaitingCosign = records.find(r => r.documentStatus === 'awaiting_cosign');
  const sign: DerivedStep = signed
    ? { key: 'signed', label: 'Consultation signed', state: 'done', actor: signed.signedByName, at: signed.signedAt }
    : {
        key: 'signed',
        label: 'Consultation signed',
        state: 'pending',
        hint: awaitingCosign ? 'Signed by a trainee — awaiting co-signature' : 'Clinician signs the note to close the visit',
      };

  const steps = [checkedIn, triaged, seenStep, diagnosis, orders, follow, sign];
  const rawStatus = String(encounter?.status || '');
  const exceptionDef = EXCEPTIONS[rawStatus];

  return {
    steps,
    doneCount: steps.filter(s => s.state === 'done').length,
    currentLabel: encounter ? (STATUS_LABELS[rawStatus] || 'In progress') : undefined,
    exception: exceptionDef ? { status: rawStatus, ...exceptionDef } : undefined,
    notStarted: !encounter && records.length === 0 && !checkedInAppt && !triage,
  };
}
