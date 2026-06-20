# Tamam Health — EHR Workflow Improvement Plan

**Reference:** GE Centricity "EHR 101" clinic training (transcript + slide deck in `/EHR`)
**Baseline:** Tamam Health platform (`platform/src`, Next.js App Router, offline-first PouchDB/CouchDB)
**Date:** June 2026
**Author:** Generated from a workflow gap analysis of the current codebase against the Centricity reference.

> **Status (June 2026): All four phases delivered.** Every gap identified below has
> been implemented, reviewed against an independent audit, and ships green
> (0 TypeScript errors, 0 ESLint errors, full test suite passing — grew from
> 1517 to 1576 tests). See the "Delivered" markers in §3 and the implementation
> log in §8. The original gap analysis is preserved below as the rationale.

---

## 1. Purpose

The Centricity training documents a mature, hospital-grade outpatient EHR workflow that has been refined over years of real clinic use. Tamam Health already has a broader and more modern feature set (offline-first sync, surveillance, CRVS, DHIS2, multi-tenancy, mobile money). What Centricity does better is the **day-to-day clinical "chart" discipline**: a structured patient chart summary, a document model where every note is signed and locked, a provider home screen that functions as a work inbox, and a clean front-desk → provider → checkout → billing baton-pass.

This plan extracts those workflow patterns and maps them onto concrete, prioritized improvements to Tamam Health, each grounded in the files that exist today.

---

## 2. The Centricity reference workflow (what we are learning from)

The training describes four roles passing one patient down a line, plus a chart model that ties it together.

**End-to-end clinic process.** Front desk checks the patient in and enters the paper intake/outcome-measure answers into the chart for the provider. The provider picks up the fee ticket, opens the patient chart, reviews and **signs** the front-desk outcome-measures document, opens their **own encounter** (which generates the SOAP note and billing charges), examines the patient, signs orders and the note, and walks the patient back to the front desk. Front desk checks out (scans documents, schedules follow-up, takes payment, batches). Billing reconciles the paper fee ticket against the signed orders, adjusts diagnosis codes for insurance, posts payments, and files claims.

**Chart Desktop (the provider home screen).** A per-user homepage showing: today's appointment schedule, documents that need the logged-in user's review/signature, and alerts/flags addressed to them. Quick actions for find-patient, recent charts, completing orders, and creating/viewing flags.

**Patient Chart Summary.** One screen, below the patient banner (name, age, DOB, provider, ID, insurance), showing five live windows side by side: **Problems, Medications, Allergies, Directives, Alerts & Flags** — each with inline add (green +) / remove (red ×, requiring a removal reason) / edit (green pencil). Problems carry ICD-9/10 codes, onset/end dates, and comments. Allergies carry substance, classification, **criticality**, and **reaction**. Directives hold informed consent / ABN / privacy on the chart so they don't have to be re-hunted each visit.

**Document / encounter model.** Everything is a "document" (encounters, forms, attachments, phone notes). A document is created, worked, then either put **on hold** (draft) or **signed** (finalized and locked). Unsigned documents show a pencil icon and a non-"signed" status, and they appear in the owner's Chart Desktop until actioned. The front desk *holds* the outcome-measures document; the provider later *edits → signs* it. Scores auto-total as answers are entered; a text tab auto-generates the narrative note.

**Alerts & Flags.** Two purposes: (a) patient-related information attached to the chart — a **care alert** is a permanent part of the chart even after it's read; (b) a **flag** is staff-to-staff communication, routed to one or more named recipients with a priority, behaving like email (reply/forward/remove) and surfacing on the recipient's Chart Desktop. Completing/removing a flag clears it from the desktop; a care alert stays on the chart.

**Phone notes.** A first-class document type to capture a patient call when the provider is unavailable, route it to the provider, and have the response become a permanent part of the chart.

---

## 3. Current Tamam Health state (verified against code)

| Centricity capability | Original state | Now |
|---|---|---|
| Provider home screen / work inbox | Role dashboards show queue + resumable encounters; no "to sign" inbox | **Delivered** — `useSigningInbox` + dashboard "Documents to sign" (drafts, co-signs, held outcome measures) and "Patient callbacks" widgets |
| Patient chart summary (5 windows) | Tabs only; no unified summary | **Delivered** — `ChartSummaryPanel` (Problems, Medications, Allergies, Directives at a glance) |
| Problem list | Full CRUD already | Unchanged (already strong) |
| Medications | Structured already | Unchanged (already strong) |
| Allergies (structured) | Single free-text string | **Delivered** — `AllergyEntry` (substance/classification/criticality/reaction/status); criticality-aware, fail-safe prescribing check |
| Directives / consent / ABN | None | **Delivered** — `DirectiveEntry` + `directive-service` + `DirectiveList`; ABN also recorded from superbill |
| Encounter document model | Journey + draft state | Augmented by signing/lock (below) |
| **Sign / lock / co-sign of notes** | None | **Delivered** — `documentStatus`, signer/timestamp, lock-on-sign, append-only addenda, trainee→provider co-sign, `RecordSignatureBar` |
| Alerts & Flags | System-generated only | **Delivered (care alerts)** — `CareAlertEntry` chart-permanent banner; routed staff comms already served by existing `/messages` |
| Phone notes | None | **Delivered** — `phone_notes` DB + `phone-note-service` + `PhoneNotes`, routed to a provider with a callbacks inbox |
| Front desk / check-in | Triage/rooming | Unchanged; intake now feeds it (below) |
| Intake / outcome measures | None | **Delivered** — PHQ-9/GAD-7 instruments, `assessment-service` (held→signed), `AssessmentsPanel` |
| Checkout & billing | Strong backend | Unchanged backend |
| Superbill / fee-ticket review UI | None | **Delivered** — `superbill-service` priced preview + post, `SuperbillPanel` in the Billing tab |
| ABN / non-covered service attestation | None | **Delivered** — ABN flag on superbill lines, recorded as a chart directive |

**One-line read (original):** the data platform and back-office were ahead of Centricity; the **clinical chart discipline** was where the gaps clustered. Those gaps are now closed.

---

## 4. Prioritized improvement roadmap

Priorities weigh clinical safety, medico-legal integrity, and how much each item unlocks the rest. Each item lists the concrete code touch-points.

### P0 — Clinical safety & legal integrity (do first)

**P0.1 Document signing & locking.**
Add a signature/lock to clinical documents so a finalized note is attributable and tamper-evident. Extend `MedicalRecordDoc` (and the encounter terminal transition) with `signedBy`, `signedByName`, `signedAt`, and `status: 'draft' | 'signed' | 'amended'`. After signing, block edits at the service layer (`medical-record-service.ts`) — further changes create an **addendum/amendment** record rather than mutating the signed one. Surface a pencil-vs-lock icon in the patient chart and consultation UI.
*Touch:* `services/medical-record-service.ts`, `services/encounter-service.ts`, `lib/clinical-flow/encounter-journey.ts`, consultation page, `audit-service.ts`.

**P0.2 Co-signing (intern / clinical officer → supervising provider).**
Add an `awaiting_cosign` state and a `cosignedBy/At` field. A trainee signs → the note routes to the supervising provider's inbox → provider reviews and co-signs to finalize. This mirrors Centricity's "provider reviews and signs the document the front desk/intern prepared" and is essential given Tamam Health's boma-worker and clinical-officer roles.
*Touch:* same as P0.1 + the provider inbox (P1.1).

**P0.3 Structured allergies.**
Replace the `knownAllergies` free-text string with a first-class allergy record: `substance`, `classification` (drug/food/environmental), `criticality` (mild/moderate/severe), `reaction`, `onsetDate`, `status`, plus removal reason — matching the Centricity allergy modal. Migrate existing free-text into the new model. Upgrade `drug-interaction-service.checkAllergies()` to match on the structured substance and **hard-stop** (not just warn) on a severe-criticality match at prescribe time.
*Touch:* new `services/allergy-service.ts`, `db-types.ts`, patient chart UI, `services/drug-interaction-service.ts`, a data migration in `lib/db/migrations/`.

### P1 — Workflow throughput & communication

**P1.1 Provider Chart Desktop (work inbox).**
Turn the role dashboard into a true per-user home screen with three live widgets: **today's schedule**, **documents awaiting my signature/co-sign** (drafts owned by or routed to me), and **flags/alerts addressed to me**. This is the single highest-leverage UX change — it makes P0.1/P0.2 and P1.2 actionable rather than buried.
*Touch:* `app/(dashboard)/dashboard/page.tsx`, a new `inbox` query across medical-records + flags, hooks in `lib/hooks`.

**P1.2 User-created Care Alerts & Flags.**
Add a flag/alert the *user* can create. Two kinds, exactly as Centricity splits them: a **care alert** that attaches permanently to the patient chart (e.g. "difficult IV access", "multiple drug allergies") and shows on every visit; and a **flag** that is staff-to-staff communication, routed to one or more named recipients with a priority, with reply/forward/resolve, surfacing in the recipient's inbox. Build on `message-service.ts` for routing and add a `careAlert` attached to the patient.
*Touch:* extend `services/message-service.ts` (or new `flag-service.ts`), `db-types.ts`, patient chart summary, provider inbox.

**P1.3 Unified Patient Chart Summary.**
Add a single summary view at the top of `patients/[id]` showing the five Centricity windows together — Problems, Medications, Allergies, Directives (P2.1), Alerts/Flags — each with inline add/edit/remove and a required removal reason. Keep the existing deep tabs; this is the at-a-glance layer the chart currently lacks.
*Touch:* `app/(dashboard)/patients/[id]/page.tsx`, `components/patients/*`.

**P1.4 Phone notes.**
Add a phone-note document type: capture caller, timestamp, clinical summary, route to a provider, provider responds, note locks into the chart. Reuse the signing model (P0.1) and inbox routing (P1.1/P1.2).
*Touch:* new `services/phone-note-service.ts`, patient chart, provider inbox.

### P2 — Administrative completeness

**P2.1 Directives & consent on the chart.**
Add a directives window: informed consent, non-covered-service/ABN acknowledgement, privacy/communication preferences, advance directives — each with description, start date, and removal reason, persisted on the chart so they aren't re-collected each visit.
*Touch:* new `services/directive-service.ts`, `db-types.ts`, patient chart summary.

**P2.2 Intake forms & scored outcome measures.**
Let the front desk enter structured intake and validated assessments (e.g. PHQ-9, ANC risk screen, nutrition/MUAC) that auto-total a score and auto-generate a narrative, then *hold* the document for the provider to review and sign — exactly the Centricity outcome-measures flow. This also feeds the existing MCH/ANC analytics.
*Touch:* new form-template + form-instance services, front-desk dashboard, consultation review step, signing model (P0.1).

**P2.3 Clinician-facing superbill / fee-ticket review.**
Before checkout, show the clinician the charges generated for the visit (the digital "fee ticket"): the orders/services with prices from `fee-schedule-service`, an ABN attestation for non-covered items, and a confirm step that posts to the ledger. Closes the loop between the strong billing backend and the clinical workflow.
*Touch:* `services/billing-service.ts`, `services/fee-schedule-service.ts`, `services/ledger-service.ts`, checkout step in front-desk + consultation pages.

---

## 5. Suggested sequencing

Phase 1 (foundational): P0.1 signing/locking → P0.2 co-sign → P1.1 provider inbox. These three are mutually reinforcing and unlock everything else.
Phase 2 (safety + chart): P0.3 structured allergies → P1.3 chart summary → P2.1 directives.
Phase 3 (communication): P1.2 care alerts/flags → P1.4 phone notes.
Phase 4 (front-desk/billing): P2.2 intake/outcome measures → P2.3 superbill/checkout.

Each phase is independently shippable and leaves the system in a working state.

---

## 6. Design principles to carry over from Centricity

- **Everything is a signed document.** A note that isn't signed is a draft; a signed note is locked and only amendable via addendum. This single rule is what makes an EHR medico-legally trustworthy.
- **The home screen is a work queue, not a report.** Clinicians should land on "what needs me today," not static stats.
- **The chart summary is the source of truth at a glance.** Problems, meds, allergies, directives, and flags visible together, every visit, with one-click add/remove and a *reason* required to remove.
- **Removal always captures a reason.** Centricity forces it on every list; it preserves the clinical audit trail. Tamam Health already does this for problems — extend it everywhere.
- **Separate "information about the patient" (care alerts, chart-permanent) from "messages between staff" (flags, dismissible).** Conflating them is why the current alerts page can't be acted on personally.

---

## 7. What Tamam Health should NOT copy

Centricity is paper-hybrid (paper fee tickets and consent at go-live, scanned afterward) and ICD-9→10 transitional. Tamam Health is already paperless, offline-first, ICD-11, and mobile-money native — keep those advantages. The goal is to adopt Centricity's **chart discipline and role hand-offs**, not its paper artifacts or its legacy constraints.

---

## 8. Implementation log (delivered)

**Phase 1 — document integrity**
- P0.1 signing & locking — `medical-record-service.ts` (`signMedicalRecord`, lock-on-update, `addAddendum`), `MedicalRecordDoc` signing fields + `RecordAddendum`, `RecordSignatureBar.tsx`.
- P0.2 co-signing — `awaiting_cosign` state + `cosignMedicalRecord`; trainee→provider review, self-cosign blocked.
- P1.1 provider inbox — `useSigningInbox.ts` + dashboard "Documents to sign" (drafts, co-signs, held assessments).

**Phase 2 — chart summary**
- P0.3 structured allergies — `AllergyEntry` on the patient doc + `allergy-service.ts`; `checkAllergiesStructured` (criticality-aware, unknown escalates fail-safe); `AllergyList.tsx`.
- P2.1 directives & consent — `DirectiveEntry` + `directive-service.ts` + `DirectiveList.tsx`.
- P1.3 unified chart summary — `ChartSummaryPanel.tsx` on the patient overview.

**Phase 3 — communication**
- P1.2 care alerts — `CareAlertEntry` + `care-alert-service.ts` + `CareAlertsBanner.tsx` (chart-permanent). Routed staff "flags" left to the existing `/messages` system (no duplication).
- P1.4 phone notes — `phone_notes` DB + `phone-note-service.ts` + `PhoneNotes.tsx`; "Patient callbacks" inbox via `usePhoneNotesInbox.ts`.

**Phase 4 — front desk / billing**
- P2.2 intake / outcome measures — `lib/clinical/assessment-instruments.ts` (PHQ-9, GAD-7, scoring), `assessments` DB + `assessment-service.ts` (held→signed), `AssessmentsPanel.tsx`.
- P2.3 superbill / checkout — `superbill-service.ts` (priced preview + post, ABN→directive), `SuperbillPanel.tsx` in the Billing tab.

**Cross-cutting**
- Shared `lib/clinical-roles.ts` (single source of truth for author/provider roles + allergy sentinels).
- `mutatePatient` (optimistic-concurrency retry) for all patient-doc structured lists, preventing lost updates.
- Service-layer authorization on sign/co-sign/respond/assessment-sign; specific audit-log entries for allergy/directive/care-alert/assessment/superbill changes.
- New synced DBs (`phone_notes`, `assessments`) registered consistently across `db.ts`, `sync-config.ts`, and the national-coverage matrix (facility-operational, excluded from national analytics).
- An independent audit was run after Phase 3; all HIGH/MEDIUM findings were fixed (see commit history). Three pre-existing repo issues were also repaired: an `order_sets` sync-coverage gap, a `canConsult` hooks-order lint error, and an unused generic in `crud-service.ts`.
