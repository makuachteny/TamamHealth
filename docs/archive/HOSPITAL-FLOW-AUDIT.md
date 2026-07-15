# Hospital & Data Flow Audit — Registration → Dispense

_Audit date: 2026-06-15. Scope: the end-to-end patient journey (registration → triage → consultation → orders → lab → pharmacy → billing) and the data integrity / sync layer underneath it. Every "Flaw" below was confirmed against the source, with file:line evidence._

---

## The journey, as built today

1. **Registration** — `patients/new` wizard → `createPatient()` writes a `PatientDoc` (org/hospital stamped, hospital number generated, duplicate check runs server-side, audited + sync-emitted).
2. **Triage** — `createTriage()` writes a `TriageDoc` with an ETAT priority. Optional; nothing forces it.
3. **Consultation** — clinician selects a patient, fills the 5-step wizard. On finalize, `handleSubmit` writes lab orders, prescriptions, a `MedicalRecordDoc`, optional referral, and charges. The triage row is stamped `seen` as a side effect.
4. **Send to lab (pause)** — the one place an `EncounterDoc` is created (`status: awaiting_labs`). Lab tech drives the order through its lifecycle; clinician resumes from the dashboard.
5. **Pharmacy** — prescriptions land in a queue with `status: pending`; a pharmacist dispenses (stock decremented), flipping to `dispensed`.
6. **Billing** — charges accrue into `BillingDoc`s; a separate insurance-grade `ChargeDoc`/ledger model also exists.

This works on the happy path. The problems are at the seams.

---

## Strengths worth keeping

- **No double-charging.** The send-to-lab / send-to-pharmacy / finalize paths dedupe correctly (`newLabTests`, `sentRxSignatures`), so services bill once.
- **Billing is consistently audited.** Every billing/payment mutation calls `logAuditSafe` + `emitSyncEvent`, and every charge/payment writes a paired `LedgerEntryDoc` — no orphan financial mutations.
- **Lab order lifecycle is now properly staged** (`LAB_ORDER_TRANSITIONS` wired on the lab page, checkout gate on resume).

---

## Flaws (verified) — prioritized

### 1. The encounter state machine only covers the "send to lab" path  — **HIGH**
`createEncounter()` is called in exactly one place: `consultation/page.tsx:604` (the Send-to-Lab pause). A clinician who completes a normal visit — no labs — never creates an `EncounterDoc`; only a `MedicalRecordDoc` is written. So the encounter, which the architecture treats as the canonical per-visit record, exists for a minority of visits.

**Consequence:** you cannot ask "how many encounters at this facility today / in what stage"; the "Awaiting results" worklist can never include a visit that was interrupted before labs; checkout/discharge state is unrepresented for most visits.

**Fix:** create the `EncounterDoc` when a consultation *starts* (status `with_clinician`), persist the working snapshot to it, and on finalize transition it to `ready_for_clinic_checkout` whether or not labs were ordered. This makes the encounter the spine of every visit and unifies the resume/worklist logic you already built.

### 2. Pharmacy dispensing is under-built and not regulation-safe — **CRITICAL (controlled drugs) / HIGH**
- `PrescriptionDoc.status` is only `'pending' | 'dispensed'` (`db-types.ts:143`); the rich `PRESCRIPTION_TRANSITIONS` machine (`order-lifecycles.ts:95`, queue → under review → cleared → dispensed → counseled → complete, plus stockout/held/recalled) is defined but **never used** in any service or page.
- Dispense decrements stock by a **hardcoded `1`** (`pharmacy/page.tsx:66`) regardless of the prescribed quantity/course (e.g. a 24-tablet ACT course decrements 1).
- Dispense does **not** check `controlledSchedule`/`requiresWitness` and never calls `recordMovement()` — the two-signatory controlled-substance log is only reachable from the standalone log page, not from the act of dispensing. That's a compliance gap for scheduled drugs.
- No stock gate (the Dispense button shows even at zero stock), and the `stockout_partial_referred`/`held` states are unreachable from the UI.

**Fix:** widen `PrescriptionDoc.status` to `PrescriptionStatus` and validate moves with the `prescription.can()` guard; dispense the prescribed quantity (add `quantityToDispense`); gate the button on available stock with explicit stockout/partial/hold actions; when `controlledSchedule` is set, require a witness and call `recordMovement()` in the same action.

### 3. Consultation save is non-atomic with no rollback — **HIGH**
`handleSubmit` writes labs → prescriptions → medical record → patient update → charges → referral → triage → encounter sequentially. PouchDB has no cross-document transaction, and there's no compensating rollback. A failure midway (offline, conflict) leaves a partial visit — e.g. record saved but charges or referral never written, with no retry surfaced to the user.

**Fix:** order writes by dependency, capture per-step success, and on failure surface a "save incomplete — retry" state instead of routing away on the catch. Persisting the encounter first (Flaw 1) gives a natural anchor to resume/repair from.

### 4. Weak referential links between visit documents — **MEDIUM-HIGH**
The `MedicalRecordDoc` stores a *denormalized snapshot* of labs/prescriptions, not id references; `PrescriptionDoc` has no `medicalRecordId`/`encounterId`/`consultationId`. So you can't reliably trace a dispensed drug back to the diagnosis/visit that ordered it, and a corrected lab result won't reflect in the record snapshot.

**Fix:** add `labOrderIds` + `prescriptionIds` (and `triageId`, `encounterId`) to `MedicalRecordDoc`, and `medicalRecordId`/`encounterId` to `PrescriptionDoc`; set them at create time. (The `EncounterDoc` already carries `labOrderIds` — extend the same pattern.)

### 5. `resetAllDatabases()` omits 7 live databases — **MEDIUM**
These factories exist and sync, but are missing from the reset list in `db.ts`: `availability`, `announcements`, `emergency_plans`, `assets`, `leave_requests`, `payroll_entries`, `controlled_substance_log`. A re-seed/reset leaves stale data in them, which causes confusing state and test pollution. (Note: the controlled-substance log is an append-only audit trail — clear it only in dev/demo resets, never in production.)

**Fix:** add the 6 operational DBs to the dbNames list; treat the controlled-substance log per environment policy.

### 6. No payment gate, and insurance eligibility is never applied — **MEDIUM (policy-dependent)**
No step (lab, pharmacy, checkout) consults a balance, and `ready_for_clinic_checkout` is a label, not an enforced gate. The insurance infra (`InsurancePolicyDoc`, `checkEligibility`, `estimatePatientResponsibility`) exists but `chargeForServices` never calls it — insured patients are billed gross with no copay/coverage split.

**Fix:** decide the model (cash-up-front vs. pay-at-discharge) and implement either a hard gate or a visible running-balance indicator; wire eligibility into charge generation so copay/coverage is computed at the time of charge.

### 7. Triage is optional, retroactive, and not surfaced as a worklist — **MEDIUM**
A consultation can start with no triage record; the handoff (`status: seen`, `handoffTo`) is stamped only *during* the consultation save (`consultation/page.tsx`), and there's no clinician-facing "my queue sorted by RED/YELLOW/GREEN." Triage vitals aren't carried into the consultation, so they're re-keyed.

**Fix:** stamp the handoff when the patient is *selected*, add a priority-sorted assigned-patient worklist, prefill consultation vitals from today's triage, and (configurably) warn/require triage before a non-emergency consultation.

### 8. Lab result-review SLA defined but not enforced — **MEDIUM**
`RESULT_REVIEW_SLA` (`order-lifecycles.ts`: 7 days routine, 24h critical) is specified but nothing queries it — an unreviewed critical result can sit indefinitely with no escalation.

**Fix:** a scheduled check (or dashboard query) that flags `resulted` orders past their SLA, especially `critical`, and routes them to the ordering clinician.

### 9. Charges/bills aren't linked to the encounter — **MEDIUM**
`chargeForServices` is called without an `encounterId`, so billing can't be scoped to a visit ("what did this encounter cost?") and disputes can't be traced atomically. Resolving Flaw 1 makes this a one-field addition.

---

## Improvements (lower priority)

- **Duplicate detection at the point of entry.** The check runs in `createPatient()` (good), but only fires at submit — surface a soft "possible match" warning on step 1 of the wizard so staff don't fill the whole form first.
- **Show the assigned hospital number** in the registration success state so reception can read it back to the patient.
- **Denormalized name drift.** Bills/claims/invoices copy `patientName`/`facilityName`; correct at creation but stale after a rename. Acceptable for an audit trail; if live accuracy matters, resolve names on read.
- **Consolidate the two billing models.** `BillingDoc` (clinic) and `ChargeDoc`+ledger (insurance) run in parallel with no bridge; pick one as canonical and document the migration (extends the existing `docs/archive/DATA-FLOW-AUDIT.md` decision).
- **FK existence checks** on `encounterId`/`invoiceId`/`chargeIds` at create time to prevent orphaned references.
- **Pharmacy niceties:** counseling gate before `complete`, FEFO batch selection by expiry, surfacing the drug-interaction warnings the service already computes, and the acuity/criticality queue priority that `order-lifecycles.ts` describes.

---

## Suggested sequencing

1. **Encounter-per-visit (Flaw 1)** — unlocks atomic save, encounter-linked charges, and a complete worklist.
2. **Pharmacy lifecycle + controlled-substance log + quantity/stock (Flaw 2)** — highest clinical/compliance risk.
3. **Referential links (Flaw 4)** and **reset list (Flaw 5)** — small, high-leverage data-integrity fixes.
4. **Atomicity/retry (Flaw 3)**, then **triage worklist (Flaw 7)** and **SLA escalation (Flaw 8)**.
5. **Payment/eligibility (Flaw 6)** and **billing consolidation** — once the clinic's payment policy is decided.

---

## Fixes applied (2026-06-15)

All changes verified with `tsc --noEmit` + `eslint` (clean). New constants/maps live in
config modules — nothing was hard-coded inline.

- **Flaw 1 + 9 — encounter per visit + encounter-linked charges.** Added an
  `ensureEncounter()` helper to the consultation: every visit now lazily creates
  one `EncounterDoc` (`with_clinician`) on the first order/finalise action, keeps
  its snapshot fresh, and transitions to `ready_for_clinic_checkout` on completion
  — regardless of whether labs were ordered. Charges (consultation, send-to-lab)
  now carry the `encounterId`.
- **Flaw 4 — referential links.** `MedicalRecordDoc` now stores
  `encounterId`, `triageId`, `labOrderIds`, `prescriptionIds`; `PrescriptionDoc`
  stores `encounterId`, `orderStatus`, `quantityToDispense`. The consultation sets
  them at create time (capturing real lab/prescription ids).
- **Flaw 2 — pharmacy lifecycle + controlled log + quantity/stock.** Added the
  granular `orderStatus` (PRESCRIPTION_TRANSITIONS) with a guarded
  `advancePrescription()`; dispense now decrements the **estimated course
  quantity** (new `dispense-quantity` helper) behind a **stock gate** (blocks if
  the full course isn't on the shelf); controlled drugs now require a **witness**
  and write a `recordMovement()` controlled-substance log entry before stock moves.
- **Flaw 3 — safer save.** A failed Complete keeps all entries and tracks
  already-written labs/prescriptions, so pressing Complete again finishes the
  save without duplicating orders; the toast says so.
- **Flaw 5 — reset list.** The 6 operational DBs were added to
  `resetAllDatabases`; the controlled-substance log is deliberately excluded
  (append-only regulatory trail; reset runs on prod seed bumps).
- **Flaw 7 — triage.** Consultation now links today's triage, prefills vitals
  from it, and shows a priority chip (or a non-blocking "not triaged today" warning).
- **Flaw 8 — result-review SLA.** New `getOverdueUnreviewedResults()` +
  `RESULT_REVIEW_SLA`; the lab page banners resulted-but-unreviewed orders past
  SLA, flagging criticals.
- **Flaw 6 — payment awareness.** Charges stamp the patient's insurance payer
  when a policy exists; the consultation shows a non-blocking outstanding-balance
  card. (A hard payment gate + copay/coverage split remains a policy decision.)
- **Lab catalogue centralised** (`lab-catalog.ts`) — specimen map + tiers now
  shared instead of duplicated inline; registration confirms the assigned
  hospital number in its success toast.

## Follow-up items now also done (2026-06-15)

- **Copay/coverage math.** `chargeForServices` now applies the patient's active
  policy: insurance pays `100 − coinsurancePct` of the subtotal minus the fixed
  copay, and the patient is billed the remainder (using the existing
  `coinsurancePct`/`copayAmount` policy fields — no fabricated numbers).
- **FK existence checks.** `collectPayment` and `createCharge` now refuse to
  create a record pointing at a non-existent encounter/invoice
  (`assertRefExists`), preventing orphaned financial references.
- **Priority-sorted clinician worklist.** "Patients assigned to you" now
  defaults to an **Acuity (urgent first)** sort and shows a RED/YELLOW/GREEN
  triage chip per patient (from today's triage).
- **Recoverable save.** Non-critical post-steps (charges, referral, triage
  hand-off, encounter close) are collected and reported together — the visit
  still saves and the clinician is told exactly what to follow up — on top of
  the earlier retry-safety (no duplicate orders on a re-attempt).

### Billing model — consolidation decision

`BillingDoc` (written by the single entry point `chargeForServices`) remains the
**canonical clinic bill**; it now carries `encounterId` and the insurance payer.
The `ChargeDoc` + `LedgerEntryDoc` model stays as the **insurance-claims /
ledger** path. They are intentionally **not** force-merged: there is no
automatic data migration (which would be risky on live records). All clinical
workflows charge through `chargeForServices`, so there is one write path in
practice; a future migration can fold legacy `BillingDoc`s into the ledger if
the org adopts full insurance billing.

**Genuinely still open:** a full ACID-style transaction wrapper (PouchDB has no
cross-document transactions — mitigated here by retry-safety + per-step
isolation rather than true rollback), and the physical BillingDoc→ledger data
migration described above.
