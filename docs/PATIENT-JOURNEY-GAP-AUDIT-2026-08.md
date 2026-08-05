# Patient Journey Gap Audit — arrival to dispense

**Date:** 2026-08-05
**Method:** the patient journey traced UI → service → data layer, station by station, against
`platform/src/lib/clinical-flow/` (the authoritative spec layer), `docs/CLINICAL-WORKFLOW-SPEC-2026-06.md`
and `docs/CLINICAL-FLOW-IMPLEMENTATION.md`. Every finding below was confirmed by reading the call
site, not inferred from the spec.

**Relationship to `WORKFLOW-GAP-AUDIT-2026-07.md`:** that audit's headline was "the encounter state
machine has almost no producer." Since then check-in has been given a real producer, the checkout gate
has been made to evaluate live data, LWBS/escalation became reachable, and dispensing became a
transactional FEFO path with a controlled-substance register. Those are genuinely fixed and are not
repeated here. What remains — and what the retirement of the consultation wizard made worse — is that
the *middle* of the journey still has no producer.

---

## The headline

The visit spine is broken in one place and everything downstream inherits it.

`checkInPatient` creates an encounter and walks it correctly to `awaiting_triage`. **Nothing ever moves
it again.** Triage, rooming, consultation, pharmacy and checkout all drive their own parallel status
fields and never call `transitionEncounter`. Because every worklist, queue and gate in `clinical-flow/`
reads `EncounterDoc.status`, the practical result is:

- the rooming worklist is permanently empty
- the front-desk checkout queue is permanently empty
- `dischargeEncounter` silently no-ops, so no visit is ever closed
- an abandoned encounter can absorb the same patient's next visit within 24h

There are now **three** overlapping progress models — `EncounterDoc.status` (canonical, barely
written), `TriageDoc.status` (drives the nurse UI), and `ConsultationProgressDoc.currentStage`
(drives the doctor board). The one the gates read is not one of the two the UI drives.

---

## A. Journey spine

### A1 — Triage never advances the encounter *(root cause)*

`TriageWorkflow.tsx:158` writes `updateTriageRecord(id, { status })` and nothing else. A tree-wide
grep finds **no writer at all** for `in_triage`, `triaged_awaiting_destination`, or
`routed_to_clinic`. Only LWBS and escalate-to-emergency (`:171-183`) touch the encounter.

The triage form also has no destination-clinic field, so even with a transition there is nothing to
route *to*.

**Fix.** On triage save/handoff, transition the encounter `in_triage → triaged_awaiting_destination →
routed_to_clinic`, hop by hop through `transitionEncounter` so each move is validated and audited.
Add a destination-clinic select to the triage form and write it to `encounter.destinationClinic`
(the field already exists and `setDestinationClinic` already maintains it). This is the single
highest-leverage change in this document — A2, A3, A4 and A5 are all downstream of it.

### A2 — The rooming station has no input

`ROOMING_WORKLIST_STATUSES` (`rooming-service.ts:51`) is
`['routed_to_clinic', 'arrived_at_clinic_awaiting_rooming', 'in_rooming']`. Since A1 produces none of
them, `RoomingWorkflow` (a mounted tab on the nurse dashboard) shows an empty list for every real
patient.

The service itself is complete and correct — arrival acknowledgement, room assignment, vitals via the
shared `recordNursingVitals` writer, clinic transfer, ready-for-clinician with a room guard.

**Fix.** None needed in rooming. Fixing A1 turns it on.

### A3 — Consultation never reaches `with_clinician`

`advanceEncounterToClinician` (`encounter-service.ts:368`) and `createDirectConsultationEncounter`
(`:425`) are both fully implemented and have **zero callers**. `callPatient`
(`EhrClinicalDashboard.tsx:884`) pushes `/consultation?patientId=…` with no encounter, and the
`/consultation` redirect (`consultation/page.tsx:68-83`) creates a note without one.

**Fix.** `callPatient` resolves the patient's open encounter and passes it through:
`/consultation?patientId=X&encounterId=Y`. The redirect calls `advanceEncounterToClinician(encounterId)`
before opening the note. See B1 for the note side.

### A4 — The checkout queue has no input

`front-desk/page.tsx:298-304` lists only encounters at `ready_for_clinic_checkout`,
`in_clinic_checkout`, `clinic_complete_awaiting_next_station`, `awaiting_facility_checkout` or
`in_facility_checkout`. Nothing in the app writes any of them.

**Fix.** Transition to `ready_for_clinic_checkout` when the clinical note is signed (see B1).

### A5 — `dischargeEncounter` silently no-ops

`encounter-service.ts:474` returns the encounter untouched when its status isn't on
`FACILITY_DISCHARGE_CHAIN`. An encounter stranded at `awaiting_triage` isn't, so the checkout handler
(`front-desk/page.tsx:587`) closes nothing — only `TriageDoc.status` flips to `discharged`.

Two consequences: no visit is ever closed, and because `findOpenEncounterForPatient` reuses any
non-terminal encounter within 24h, an abandoned visit can absorb a genuine re-attendance later the
same day and write the second visit's activity onto the first visit's record.

**Fix.** Fixing A1–A4 makes the chain reachable. Additionally, have `dischargeEncounter` return an
explicit outcome (`{ closed: false, reason }`) rather than a silent pass-through, so the caller can
surface "this visit was never opened at a clinic" instead of reporting a successful checkout.

### A6 — Three parallel progress trackers

| Tracker | Written by | Read by |
|---|---|---|
| `EncounterDoc.status` | check-in only | every gate, queue and worklist in `clinical-flow/` |
| `TriageDoc.status` | `TriageWorkflow` | front-desk board, `buildQueueFromTriage` |
| `ConsultationProgressDoc.currentStage` | `callPatient`, rooming | the progress tracker widget |

`deriveConsultationProgress` (`consultation-progress-derive.ts:180`) already derives progress
correctly from encounter + appointment + triage + records + orders — the right pattern is written and
running *alongside* a stored duplicate.

**Fix.** Make `EncounterDoc.status` the single source of truth. Demote `TriageDoc.status` to
describing the triage act itself (or mirror it from the encounter). Replace
`ConsultationProgressDoc.currentStage` reads with `deriveConsultationProgress`, and stop writing the
stored stage.

### A7 — The lab order desk spawns a duplicate encounter

`useLabOrderDraft.ts:145-159` calls `createEncounter({ status: 'awaiting_labs' })` rather than joining
the patient's open visit. The patient ends up with two concurrent open encounters, and because
`getOpenEncounterForPatient` sorts by `createdAt`, the lab stub can be the one checkout picks up.

**Fix.** Resolve the open encounter first via `findOpenEncounterForPatient(patientId, hospitalId)` and
transition it to `awaiting_labs`; only create a standalone encounter when there is genuinely no open
visit (a direct walk-in to the lab), and in that case create it at a legal Stage-1 entry status and
walk it.

### A8 — `createEncounter` accepts any status as an entry point

`encounter-service.ts:112` takes `status` as a free parameter and calls `stageOf(status)` without
checking that the status is a legal *creation* state. That is how A7 is able to materialise an
encounter directly at `awaiting_labs`, bypassing the machine that `transitionEncounter` otherwise
enforces rigorously.

**Fix.** Restrict `createEncounter` to a whitelist of entry statuses (`scheduled`, `registered`,
`arrived_at_facility`) and require everything else to arrive via `transitionEncounter`.

### A9 — Ward admission never touches the encounter

`ward-service.ts:158` (`admitPatient`) writes an `AdmissionDoc`, updates the bed and ward occupancy,
and audits — but never transitions the encounter to `admitted`. Admitting from `/wards` leaves the OPD
encounter open indefinitely. `dischargePatient` (`:202`) has the same gap in reverse.

**Fix.** `admitPatient` transitions the open encounter to `admitted` (a terminal OPD status that hands
off to the inpatient flow); `dischargePatient` closes the admission's own encounter.

### A10 — Checkout resolves the encounter unscoped

`front-desk/page.tsx:566` falls back to `getOpenEncounterForPatient(target.patientId)` — which is
neither facility-scoped nor time-bounded — rather than the deliberately-scoped
`findOpenEncounterForPatient(patientId, hospitalId)`. Within an org every facility replicates the same
encounter DB, so one facility's front desk can discharge a visit belonging to another.

**Fix.** Use `findOpenEncounterForPatient(patientId, currentUser.hospitalId)`.

---

## B. Clinical documentation

### B1 — The clinical note is not linked to the visit

`consultation/page.tsx:68-83` creates the note with no `encounterId`. The field already exists on the
doc type and on `useCreateNote.ts:30` — it is simply never populated. Notes are therefore
patient-scoped only, with no way to ask "what was documented during this visit."

**Fix.** Thread `encounterId` from `callPatient` → route → `createClinicalNote`. On note open, call
`advanceEncounterToClinician`; on sign, transition to `ready_for_clinic_checkout`.

### B2 — The documentation gate can never be satisfied

`checkout-gate-service.ts:151-165` requires a `medical_record` carrying `signedAt`. Clinicians now
write `ClinicalNoteDoc` into a separate database (`tamamhealth_clinical_notes`). **Nothing writes a
consultation `medical_record` anymore** — the only remaining writer is `recordNursingVitals`, and
nursing vitals are never signed.

Every discharge therefore fails this critical condition and needs an override, which trains clerks to
override the gate as a matter of routine and defeats the other six checks.

**Fix.** Point the condition at signed `clinical_note` documents for the encounter, keeping
`medical_record` as an accepted alternative for legacy visits.

### B3 — Triage vitals never reach the chart or the note

`TriageWorkflow.tsx:243-253` writes vitals as flat string fields on the `TriageDoc`. The note's
derived Vitals section reads `medical_record.vitalSigns / triageVitals`
(`chart-snapshot.ts:143`). Nothing bridges the two, so `MedicalRecordDoc.triageVitals` has **no
writer anywhere in the codebase**. The clinician opens the note and the vitals taken minutes earlier
are blank; the chart's vitals trend omits triage entirely.

**Fix.** Have `createTriage` additionally call `recordNursingVitals({ encounterId, … })` — the writer
already exists, already produces the numeric `VitalSigns` shape, and is already the path rooming uses.

### B4 — The note carries no triage context

The note editor surfaces no chief complaint, acuity, mode of arrival or symptom duration. All of it is
already on the `TriageDoc`, and none of it reaches the clinician.

**Fix.** With B1 in place, fetch the encounter's triage and render an acuity chip + chief complaint +
arrival mode in the note header.

---

## C. The facility checkout gate

### C1 — `all_clinic_visits_closed` false-passes

`checkout-gate-service.ts:93` treats a visit as open only when its status is one of
`['with_clinician', 'in_rooming', 'in_triage', 'awaiting_labs']`. An encounter at `awaiting_triage`,
`ready_for_clinician`, `awaiting_pharmacy` or `awaiting_procedure` reports **closed**. Combined with
A1, a patient who was never seen by anyone passes this critical condition.

**Fix.** Invert the test — satisfied only when the status is terminal or at/after
`ready_for_clinic_checkout`. A whitelist of closed states fails safe; a blacklist of open ones does not.

### C2 — The prescription condition is lifetime-scoped

`checkout-gate-service.ts:100-108` calls `getPrescriptionsByPatient(patientId)` with no visit filter,
because prescriptions carry no `encounterId` (see D1). Any chronic or repeat prescription left in
`pending` blocks that patient's every future discharge, permanently.

**Fix.** Scope to the encounter once D1 lands; fall back to a recency window (e.g. same-day) for
legacy prescriptions with no encounter link.

### C3 — The critical-labs condition is lifetime-scoped

Same defect: `getLabResultsByPatient(patientId)` with no visit filter. Lab results *do* carry
`encounterId`, so this one can be fixed immediately.

**Fix.** Filter to `l.encounterId === encounter._id`.

### C4 — `in_clinic_procedures_complete` self-satisfies

`checkout-gate-service.ts:147` reports satisfied and documents honestly that `ProcedureDoc` has no
in-flight state to evaluate. The reasoning in the comment is sound — blocking on an unrepresentable
condition would be worse. Recorded here because the gate is nominally 5-critical and is really
4-critical. Resolved by D2.

### C5 — The safe discharge helper is never called

`attemptFacilityCheckout` (`checkout-gate-service.ts:220`) exists specifically to compose gate
evaluation with the transition so callers cannot hand-assert satisfied keys. It has zero callers; the
front desk calls `evaluateCheckoutGate` and `dischargeEncounter` separately.

**Fix.** Route the front-desk checkout through `attemptFacilityCheckout`, or delete it. Two ways to
discharge, one of which is the documented-safe one and unused, is worse than one.

---

## D. Orders

### D1 — Prescriptions are not linked to the visit

`PrescribeModal.tsx:207-226` omits `encounterId`, though `PrescriptionDoc.encounterId` exists
(`db-types.ts:458`). This is the direct cause of C2.

**Fix.** Pass the note's `encounterId` into `PrescribeModal` and stamp it on creation.

### D2 — Procedures have no lifecycle

`PROCEDURE_TRANSITIONS` (`order-lifecycles.ts:74`) is fully specified and has zero consumers.
`ProcedureDoc` records only completed procedures — no status, consent, observation, abort reason or
complication fields — so an in-flight procedure, an aborted one, and an adverse event are all
unrepresentable. `awaiting_procedure` is unreachable.

**Fix.** Add `status` + consent/abort-reason/complication fields to `ProcedureDoc`, wire the existing
transition table, then make C4 a real check.

### D3 — Imaging has no distinct order path

`awaiting_imaging` is a defined encounter status with no writer. Radiology reads through the lab
module rather than having its own study/report model.

**Fix.** Lower priority than the spine. Either route imaging orders through the diagnostics lifecycle
explicitly (setting `awaiting_imaging`), or remove the status until there is a model behind it.

---

## E. Pharmacy

The dispensing transaction itself is the strongest module in the journey: FEFO allocation across
batches, full rollback on any failure, verified two-signature witness for controlled drugs (checked
against the user directory, same-facility, same-org), per-lot register entries with append-only
reversal, and partial fills that must be explicitly confirmed. The queue walks the full lifecycle
`prescribed → received → under review → cleared → dispensed → counseled → complete`, with hold,
stockout and recall branches. Nothing below is a criticism of that code.

### E1 — Completing the pharmacy workflow is a dead end

`pharmacy/page.tsx:213-216` advances the prescription to `counseled` then `complete` and stops. The
encounter is never touched, and there is no transition anywhere from `awaiting_pharmacy` back toward
checkout.

**Fix.** On the last outstanding prescription for an encounter reaching `complete`, transition the
encounter `awaiting_pharmacy → ready_for_clinic_checkout`.

### E2 — Dispensing creates no charge

`dispenseMedication` moves stock and writes the register but never bills. See F2.

### E3 — The pharmacy payment gate is vacuous

`pharmacy/page.tsx:286` blocks dispensing on `isFinanciallyCleared(balance)`, which is
`(balance ?? 0) <= 0` (`pharmacy-workflow.ts:80`). Because almost nothing generates charges (F1–F3),
the balance is nearly always 0 and the payment step passes automatically. The control looks enforced
and is not.

**Fix.** Resolved by F1–F3. Until then the step should say "no charges posted" rather than
"payment clear", so the pharmacist is not told a payment was confirmed that never existed.

---

## F. Charge capture

`chargeForServices` (`fee-schedule-service.ts:169`) is complete and correct — catalogue pricing,
quantity, tax from facility settings, insurance payer stamping with coinsurance/copay split, and it
returns `null` rather than creating empty bills. It has exactly **two** callers.

### F1 — No registration or consultation fee

Neither check-in nor the clinical note posts a charge.

**Fix.** Post a registration charge from `checkInPatient` and a consultation charge on note sign,
both with `referenceType: 'encounter'`.

### F2 — No medication charge

`dispenseMedication` posts nothing. The dispensed quantity, the batch and the unit are all in hand at
the point of the transaction.

**Fix.** Post a `medication` charge line inside the dispense transaction, referencing the prescription.
Note the Tier-1 safety rule (`TIER1_CHECKOUT_SAFETY_RULE`, also unconsumed): a life-sustaining
medication must dispense regardless of balance and raise an admin flag instead of blocking.

### F3 — No procedure or imaging charge

Follows from D2/D3.

### F4 — Net effect

Only lab orders (`useLabOrderDraft.ts:222`) and the manual superbill panel generate revenue. The
ledger, patient balance, payment plans, insurance split and the checkout `payment_status_determined`
condition are all built on a number that is almost always zero.

---

## G. Queues

### G1 — The queue never reports the second half of the journey

`buildQueueFromTriage` accepts optional consultation-status, pending-pharmacy and pending-lab
arguments. All three call sites pass triage documents only:
`front-desk/page.tsx:331`, `WardWorkflow.tsx:66`, `EhrClinicalDashboard.tsx:670`. The front-desk call
site documents this ("no lab/pharmacy args since this page doesn't load prescriptions or lab
results").

`awaiting_lab`, `awaiting_pharmacy` and `awaiting_checkout` therefore never appear on any board — the
queue can only ever show awaiting-triage, awaiting-rooming and awaiting-consultation.

**Fix.** Once the encounter is driven properly (A1–A4), derive the queue from `EncounterDoc.status`
directly rather than reconstructing it from triage documents plus optional side-channel sets.

---

## H. Post-visit

### H1 — Follow-ups have no UI

`follow-up-service.ts` and `/api/follow-ups` are complete. No component anywhere imports either, and
there is no `/follow-ups` route. Nothing schedules the post-visit loop.

**Fix.** Surface follow-up creation at clinic checkout and on the discharge note, and add a worklist.

### H2 — `referred_out` is never set

Referrals are created from the note editor (`ClinicalNoteEditor.tsx:379`) but the encounter is never
transitioned to `referred_out`, so a referred patient's visit does not close through the referral
path and `discharged_with_referral` is unreachable.

**Fix.** Transition the encounter on referral creation.

---

## Dead or unreachable code

Everything here is implemented and correct; none of it has a caller.

| Symbol | Location | Blocked by |
|---|---|---|
| `advanceEncounterToClinician` | `encounter-service.ts:368` | A3 |
| `createDirectConsultationEncounter` | `encounter-service.ts:425` | A3 |
| `attemptFacilityCheckout` | `checkout-gate-service.ts:220` | C5 |
| `PROCEDURE_TRANSITIONS` | `order-lifecycles.ts:74` | D2 |
| `TIER1_CHECKOUT_SAFETY_RULE` | `encounter-journey.ts:233` | F2 |
| `follow-up-service` (all) | `follow-up-service.ts` | H1 |
| `transferred_to_other_clinic` | via `setDestinationClinic` | A2 |
| `consultation_paused_draft` | `encounter-journey.ts:73` | no pause control in the note editor |
| `awaiting_imaging`, `awaiting_procedure` | `encounter-journey.ts:66-68` | D2, D3 |
| `discharged_with_referral` | `encounter-journey.ts:81` | H2 |

---

## Suggested sequence

**1. Reconnect the spine (A1 → A3 → A4 → A5).** Triage writes transitions; `callPatient` threads
`encounterId`; the note advances and closes the encounter. This is one coherent change and it turns on
rooming, the checkout queue, real discharge, and most of the gate. Everything else is smaller.

**2. Make the gate honest (B2, C1, C2, C3).** Point documentation at `clinical_note`, invert the
open-visit test to fail safe, scope prescriptions and labs to the encounter. Without this, step 1
produces a gate that blocks every discharge for the wrong reasons.

**3. Close the visit-scoping gaps (D1, B3, A7, A10).** Prescriptions carry `encounterId`; triage
vitals land as observations; the lab desk joins the open visit; checkout resolves the encounter
facility-scoped.

**4. Turn on charge capture (F1, F2).** Registration, consultation and medication charges. This makes
E3 and the gate's `payment_status_determined` condition mean something.

**5. Collapse the duplicate trackers (A6, G1).** Derive progress and queues from the encounter; retire
the stored consultation stage and the triage-reconstructed queue.

**6. Then the additive work** — procedures lifecycle (D2), ward/encounter integration (A9), follow-ups
(H1), referral closure (H2), imaging model (D3).

Steps 1 and 2 together are what separate "a set of well-built stations" from "a patient journey."
