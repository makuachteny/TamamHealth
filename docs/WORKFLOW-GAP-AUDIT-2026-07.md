# Workflow Gap Audit — start to finish

**Date:** 2026-07-21
**Method:** every stage of the 11-stage patient journey traced UI → API route → data layer, against
`docs/CLINICAL-WORKFLOW-SPEC-2026-06.md`, `docs/CLINICAL-FLOW-IMPLEMENTATION.md`, `docs/RBAC-MATRIX.md`
and the spec layer in `platform/src/lib/clinical-flow/`.

## The headline

The spec layer is faithful and complete; the system that is supposed to be *restricted* by it largely
isn't wired to it. `CLINICAL-FLOW-IMPLEMENTATION.md` declares Phases 2–6 outstanding, and that is
what the code shows: **the encounter state machine has almost no producer**. The only non-test caller
of `createEncounter` is the consultation page, which creates the encounter already at
`with_clinician` — so Stages 1–4 (`scheduled`, `registered`, `arrived_at_facility`, `awaiting_triage`,
`in_triage`, `triaged_awaiting_destination`, `routed_to_clinic`, `in_rooming`, `ready_for_clinician`)
are never written by anything. `canTransition()` therefore never guards arrival, triage or rooming.

There is no marker-based backlog to work from: a sweep for TODO/FIXME, `alert()`, no-op handlers and
dead nav links across all 81 routes came back at **zero**. The gaps below are all spec-vs-code drift.

---

## Blockers

### Journey spine
- **Stages 1–4 have no encounter producer.** `consultation/page.tsx:962` is the only `createEncounter`
  caller and starts at `with_clinician`; `check-in-service.ts` writes only a `TriageDoc`.
- **No rooming station.** `encounter-journey.ts:108-113` defines the rooming chain; no service, API or
  component transitions into it. `rooming_nurse` is routed to `/patient-intake`
  (`ehr-navigation.ts:18`), a pre-visit form queue with no vitals capture or room assignment.
- **No destination routing out of triage.** `TriageDoc` has no destination clinic field
  (`db-types.ts:1215-1260`); `TriageWorkflow.tsx:122-127` only moves a parallel, unvalidated status.
- **`escalated_to_emergency` and `lwbs` are unreachable** — a patient who deteriorates in the waiting
  area or leaves without being seen cannot be recorded.
- **No Stage-7 procedures station.** `PROCEDURE_TRANSITIONS` (`order-lifecycles.ts:72-95`) has zero
  consumers; `ProcedureDoc` (`db-types.ts:531-551`) has no status, consent, observation, abort-reason
  or complication fields, so adverse-event reporting is unrepresentable. The only UI is retrospective
  free-text charting.

### Consultation
- **The whole History & ROS step is missing.** The wizard starts at Chief complaint
  (`consultation/page.tsx:1889-1898`); `lib/clinical-history.ts` — referenced by both the workflow spec
  and the ICD-11 plan — **does not exist**. The model fields (`reviewOfSystems`, `pastMedicalHistory`,
  `familyHistory`, `socialHistory`, `drugHistory`) have no writer and no reader, HPI is aliased to the
  chief complaint (`:1356`), and scribe-extracted history is silently dropped (`:1677-1815`).

### Checkout & payment
- **The facility-checkout gate self-satisfies 5 of its 7 items**, including `payment_status_determined`
  (`front-desk/page.tsx:452-462`). Only prescriptions and critical labs are really evaluated.
- **No unpaid-balance check anywhere in checkout** — billing/ledger services are never imported.
- **The gate never blocks, and there is no override capture** — unmet critical items produce a toast;
  the spec's "reason + authorization, logged" (`encounter-journey.ts:254-258`) is unimplemented. The
  whole block is wrapped in `try { } catch { console.warn }` and then reports success.
- **`TIER1_CHECKOUT_SAFETY_RULE` has zero consumers** — a patient can leave without a life-sustaining
  medication with no flag.
- **Pay-by-link can never confirm.** `api/checkout/route.ts:114` mints a `PBL-…` reference while
  `webhooks/mpesa/route.ts:117` matches on a Daraja `CheckoutRequestID`, and nothing ever initiates an
  STK push. Links and portal payments stay `pending` forever.

### Pharmacy & controlled substances
- **The server dispense path bypasses stock decrement and the controlled-substance register.**
  `prescription-service.ts:170-183` only flips status; the register/witness/inventory logic lives
  *only* in the client page. Any API caller dispenses a controlled drug with no register row.
- **`decrementStock` falls back to another facility's row** — `pharmacy-inventory-service.ts:98`
  (`items.find(i => i.hospitalId === hospitalId) || items[0]`), and a missing item is a silent no-op.
- **The stock-in modal cannot flag a drug as controlled** — any morphine added through the UI
  dispenses with no witness and no register entry.
- **The controlled-substance register is client-only and unscoped** — no API route, `getAllMovements()`
  called with no `DataScope`, so every facility's register is visible; the witness is free text.

### Safety, privacy & tenancy
- **Cross-tenant writes are not blocked on the sync path.** `validate-doc-update.ts:29` tests for an
  `org:` role prefix while `couch-auth.ts:106` provisions `org-<id>` — the check never matches.
- **No server-side privilege enforcement on the offline write path.** Every role in an org gets
  read/write to prescriptions, lab results, dispensing, payments and audit_log via replication; the
  `hasRole()` gates on 51 API routes are bypassed because clinical writes go to local Pouch.
- **PHI *read* logging covers 2 of 74 routes.** GET is deliberately skipped in `with-audit.ts:60`, and
  `logDataAccess` is called only from medical-records and reports. "Who viewed this chart" is
  unanswerable for patients, labs, prescriptions, pharmacy, triage and referrals.
- **Critical-value callback has no evidence trail** — `lab/page.tsx:344-370` fires a fire-and-forget
  message; no read-back, acknowledgement, retry or callback log.
- **No results-release gating in the patient portal** — `patient-portal/labs/route.ts:11-12` returns
  results unfiltered, so unreviewed critical results are visible to the patient.
- **Patient reminders never dispatch** — the cron-documented endpoint has no caller anywhere.

---

## Important

**Stage 1–3.** Portal appointment requests are written without `orgId` and are therefore filtered out
of every staff view (`patient-portal/appointments/route.ts:45-71`) — they persist but no front desk can
see them. The "pending approval" queue filters on `scheduled` and so excludes `requested`. Portal
bookings bypass the double-booking guard by writing via `db.put`. Recurrence patterns are stored but
no series is generated. The appointment-reminder service is complete but has no trigger. MPI dedupe is
complete but no client ever calls it. The geocode ID omits the patient suffix, so a household shares
one ID. Front-desk check-in **fabricates a full ETAT assessment** (`check-in-service.ts:75-83`) that
nurses cannot distinguish from a real one. `queuePriorityScore` is dead code — queues sort by static
RED/YELLOW/GREEN, so waiting time never ages a patient up.

**Stage 4–5.** Provider assignment doesn't advance the journey. `transferred_to_other_clinic` has no
trigger. There is no "pause consultation" control despite `consultation_paused_draft` being resumable.
`awaiting_imaging` / `awaiting_procedure` are unreachable. `moveEncounter()` catches a rejected
transition and force-hops through `with_clinician`, defeating the guard. Disposition can't record a
death or an emergency escalation. ICD-11 is a 93-entry hardcoded array with no ICD-API integration.
Continuity (last chief complaint, prior history, next-of-kin, trends) is not surfaced at consultation
open even though the chart already has the data.

**Stage 6–8.** The lab lifecycle dead-ends at `resulted` — `acted_upon` and `communicated_to_patient`
are never written, so the review loop can't close; and "review" is auto-stamped as a side effect of
saving a note rather than an explicit acknowledgement. SLA escalation is a client-side banner with no
job behind it. The lab page orders from a hardcoded 13-test array instead of the settings-backed
catalogue, so `tier` is never persisted. Radiology is half demo data with in-memory-only edits, never
enters the diagnostics lifecycle, and has no study/report/PACS model. `dispensing_error_recalled` and
`clinician_consultation_in_progress` are unreachable. `dailyReconciliation` has no caller. There is no
requisition/receipt/transfer workflow, and no batch-level stock or FEFO — expired stock is reportable
but still dispensable.

**Stage 9–11.** No clinic-checkout station: `dischargeEncounter` fast-forwards the entire discharge
chain in one call. Ward admission and discharge never touch the encounter state machine, so admitting
from `/wards` leaves the encounter open forever. A ward death doesn't register a death. There is no
inter-ward or bed transfer. `completeReferral` (loop closure) isn't exposed through the API, and there
is no back-referral notification. Insurance eligibility is a hardcoded stub; portal payment is
record-only.

**Cross-cutting.** The system-admin registry is entirely hardcoded — statuses and current values are
literals never read from facility settings, and the privilege list is a display-only table with no
consumer. The IT page's backup card reads a localStorage key that nothing writes, so it is permanently
"unknown"; its audit card is hardcoded healthy. Device registration settings are inert. There is no
audit-log viewer and `auditRetentionDays` has no purge job. FHIR is read-only (no POST/PUT anywhere)
so inbound referrals are impossible. DHIS2 push has no scheduler — monthly HMIS submission is manual,
and the allowed-role list contradicts the RBAC matrix. SMS silently no-ops without credentials. M-Pesa
and Airtel webhooks skip signature verification when the secret is unset.

---

## Suggested sequence

1. **Close the safety and tenancy holes first** — the Couch role-prefix mismatch, the server dispense
   path, `decrementStock`'s cross-facility fallback, and portal results-release gating. These are
   live correctness/privacy defects, not missing features.
2. **Give Stages 1–4 an encounter producer** (Phase 3): registration, triage and rooming write real
   transitions through one `transitionEncounter()` service. Almost everything else in this report
   depends on the encounter actually existing before Stage 5.
3. **Make the checkout gate real** — evaluate open orders and balances, block, and capture overrides.
4. **Close the order loops** — lab review/act/communicate as explicit actions, procedures station,
   controlled-substance register on the server.
5. **Then the additive features** — History & ROS, continuity view, imaging model, requisitions,
   reminder/DHIS2 schedulers, audit-log viewer.
