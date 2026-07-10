# Data-Flow & Alignment Audit — July 2026

End-to-end audit of how clinical data flows from capture to national analytics,
and where the pieces don't line up. Traced across four segments: capture/write,
sync/mapping, read/dashboards, and workflow handoffs + tenant scoping.

## The meta-finding

There are **two disconnected national pipelines**:

```
WRITE:  capture → local PouchDB → CouchDB → sync-worker → /api/sync → PostgreSQL   ⟶ (nothing reads it)
READ:   CouchDB → local PouchDB → client-side aggregation → "national" dashboards
```

PostgreSQL is **write-only** — no dashboard, report, or export queries it; every
"national" view re-aggregates the browser's own replicated PouchDB. Meanwhile the
writes *into* Postgres are themselves lossy/broken. The two halves never meet.

**The single biggest decision** (blocks resolving most P2s): pick the national-analytics
architecture — either (a) build the missing Postgres read path so dashboards query
the aggregated store, or (b) formally retire the unused Postgres writeback and accept
"national = client-side over replicated Pouch". Today both are maintained and neither works.

---

## P0 — correctness / safety (bites in the running product now)

- [x] **Physical-exam findings dropped from the medical record.** Consultation required
  exam input to save but never persisted it (survived only on the transient encounter
  snapshot). FIXED 2026-07: added `physicalExamination` to `MedicalRecord`
  (`src/data/mock.ts`), persist it in `consultation/page.tsx`, render in the chart record
  view + print doc (`patients/[id]/page.tsx`).
- [x] **Blank-dose prescription aborted the whole consultation save.** An incomplete Rx row
  threw inside `validatePrescription` mid-commit, after the record/labs were written.
  FIXED 2026-07: pre-flight guard in `handleSubmit` (`consultation/page.tsx`) blocks with a
  clear message before the staged commit.
- [ ] **Cross-org referrals are invisible at the destination (ARCHITECTURAL).** `tamamhealth_referrals`
  is `orgScoped: true` so the doc only replicates within the *sender's* org and never reaches
  the destination org's CouchDB; `inferOrgId` also stamps it with the sender org, so
  `filterByScope`'s orgId gate would drop it regardless. The cross-org accept/re-home logic
  (`referral-service.ts:327-347`) is unreachable dead code. Needs a real cross-org sharing
  mechanism (shared/national referral exchange, or dual-org visibility), not a filter tweak.
  Refs: `sync-config.ts:26`, `referral-service.ts:18-22,58,102`, `data-scope.ts:52-55`.
- [ ] **Facility PHI isolation is UI-only within an org (ARCHITECTURAL / compliance).** Every device
  in an org replicates *all* facilities' PHI; separation is only client-side `filterByScope`,
  bypassable via local storage. Making it a real boundary needs per-facility CouchDB `_security`
  or separate per-facility DBs. Refs: `sync-config.ts`, `data-scope.ts:59-68`.

## P1 — real now, lower blast radius

- [ ] **"National"/sub-national dashboards read local PouchDB and mislabel org-local as regional.**
  A state/county director sees only their org's replicated data presented as the state aggregate;
  no server-side cross-check. Refs: `government/page.tsx`, `dashboard/state/page.tsx`,
  `mch-analytics-service.ts`, `data-scope.ts:43-103`.
- [ ] **Government trends + parts of the DHIS2 export are backed by mock data.** `HospitalDoc.monthlyTrends`
  comes from `mock.ts generateTrends()`; the DHIS2 element/report/sync-log UI is hardcoded literals.
  Figures shown as/pushed to national HMIS can diverge from real records. Refs: `government/page.tsx:587,729`,
  `dhis2-export/page.tsx:18-54`, `src/data/mock.ts:80-90`.
- [ ] **Geographic scoping defined but never enforced.** `county/payam/state` are dropped by both
  `useDataScope` and `filterByScope`; a `county_health_director` with no orgId falls through both
  filters → over-broad PHI access. Refs: `data-scope.ts:42-103`, `useDataScope.ts:20-24`.
- [ ] **ICD-11 codes stored in the `icd10Code` field.** `consultation/page.tsx` writes the ICD-11
  value into a slot named `icd10Code`, with `codeSystem`/`icd11Code` invisible to typed readers →
  coding/interop corruption (affects DHIS2 export). `Diagnosis` type has no `icd11Code`/`codeSystem`.
  Refs: `consultation/page.tsx` diagnoses map, `mock.ts` `Diagnosis`.
- [ ] **Unified patient-flow queue is orphaned.** `patient-queue-service.buildQueueFromTriage` has no
  page consumers; walk-in → clinician routing depends on a manual `AssignDoctorModal` write to
  `patient.assignedDoctor` (triage alone doesn't surface the patient on the worklist). Refs:
  `usePatientQueue.ts:11`, `dashboard/page.tsx:64-66`, `AssignDoctorModal.tsx:89`.

## P2 — latent, blocks national analytics the moment Postgres is read

- [ ] **beds/admissions national writeback is dead on arrival.** Mappers, migration 0006, and
  conflict policy exist, but `ALLOWED_TABLES`/`ALLOWED_COLUMNS` in `postgres.ts` were never updated,
  so `assertSafeTable` throws on every bed/admission upsert. LOS, in-hospital mortality, transfers,
  bed occupancy never reach the store. Fix: add `beds`,`admissions` + their columns to the allowlists.
  Refs: `sync/route.ts:202-208,656-713`, `postgres.ts:61-214`.
- [ ] **`medical_records` mapper reads fields that don't exist** (`doc.diagnosis/icd11Code/severity/recordType`
  — real data is `diagnoses[]`) → national diagnosis/ICD/severity columns always NULL. With `encounters`
  excluded, coded morbidity has no national path at all. Fix: flatten primary diagnosis in the mapper.
  Refs: `sync/route.ts:247-259`.
- [ ] **Sync-worker fails forward.** It advances the CouchDB `seq` even when `/api/sync` reports per-doc
  errors, so any mapping/schema mismatch = permanent, un-retried loss (no dead-letter/replay). This
  amplifies the two items above from "fixable" to "silently gone." Fix: return non-2xx (or park failures)
  and don't advance `seq` past unresolved errors. Refs: `sync-worker/index.mjs` `pollDatabase`/`postSync`.
- [ ] **Nutrition SAM/MAM has no national path and no dashboard.** `nutrition_screenings` is captured but
  has no writeback table/mapper (deferred TODO) and no dashboard reads it — malnutrition, a DHIS2 MCH
  indicator, is invisible nationally. Refs: `sync/route.ts` exclusion TODO.
- [ ] **Field-completeness drops in mappers:** death cause-of-death chain (WHO antecedent/contributing
  causes), immunization AEFI detail, triage vitals, facility IPC/WASH readiness are all dropped before
  Postgres. Refs: `sync/route.ts` mappers vs `db-types.ts` docs.
- [ ] **Orphans/drift:** `patient_feedback` (Postgres table + policy + FALLBACK entry, but no sync-config
  source and no mapper); `FALLBACK_DBS` still lists dropped `boma_visits`. Refs: `sync-worker/index.mjs`.

---

## What genuinely works (not a prototype)

Registration capture (form→validation→service→doc aligned); intra-facility clinical handoffs
(triage→consult→lab/pharmacy→wards→billing) with correct linking IDs and status machines; org-level
tenant isolation (server-enforced via CouchDB `_security` + validate-doc-update); the journaled,
idempotent consultation commit; and ~30 API routes that apply server-side scope (the browser path
just bypasses them).
