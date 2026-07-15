# TamamHealth Codebase Cleanup Report

> **UPDATE — implemented.** The naming + duplication cleanup below has now been
> carried out (behavior-preserving; currency display deliberately standardized).
> Verified green: `tsc` 0 errors, `eslint` 0 errors, **73 suites / 1492 tests pass**.
> See "Implementation status" at the bottom for exactly what shipped vs. deferred.

**Scope:** Naming/structure consistency + duplicated-logic extraction (modularity).
**Mode:** Audit + implementation.
**Date:** June 2026 · Platform: `platform/` (Next.js 14, TypeScript, ~65 components, 60 services, 41 hooks)

---

## Executive summary

The codebase is, on the whole, **already structured professionally**: services are consistently `*-service.ts`, hooks are `useX.ts`, components are PascalCase, types live in `db-types.ts`, and there is a clear `lib/services` / `lib/hooks` / `components` separation. There is **no sweeping rename needed.**

The high-value work is **deduplication**. The same small pieces of logic — currency formatting, date/greeting formatting, triage-priority colours, patient-name assembly — are re-implemented inline across dozens of files. Separately, all ~53 data services repeat the same create/update/query boilerplate, which is the single biggest modularity opportunity.

Nothing here is a bug; it's maintainability and consistency. Everything below is behavior-preserving and independently shippable, each verified with `tsc` + `eslint` + the 1492-test suite.

---

## Part 1 — Naming & structure (mostly healthy)

| # | Finding | Evidence | Severity | Recommendation |
|---|---------|----------|----------|----------------|
| N1 | Service file naming is consistent | 60/60 files are `*-service.ts` | ✅ none | Keep as-is |
| N2 | Hook naming is consistent | `useX.ts` throughout | ✅ none | Keep as-is |
| N3 | Two non-PascalCase files in `components/` | `components/nurse/shared.tsx`, `components/icons/taban.tsx` | Low | `shared.tsx` is a utility module, not a component — consider moving nurse hooks/types to `lib/hooks/useNurseWorkflows.ts` (or `components/nurse/nurse-utils.ts`) so `components/` only holds components. `taban.tsx` is an icon-data module — fine, or rename `taban-icons.ts`. |
| N4 | "Hospital" vs "Facility" terminology mix | `hospitalsDB`/`hospital-service` but UI + settings say "facility"; `facilityId`/`hospitalId` both appear | Low–Med | Pick one user-facing term (the product uses **Facility**) and document that the *data layer* keeps `hospital*` for historical reasons. Don't rename DB keys (migration risk) — just add a one-line convention note in `db-types.ts`. |
| N5 | `lib/` is a catch-all | `lib/` holds services, hooks, settings, sync, i18n, plus loose files (`format-utils.ts`, `patient-utils.ts`, `permissions.ts`, `role-routes.ts`) | Low | Optional: group the loose domain helpers under `lib/utils/`. Low value, moderate import churn — defer unless doing N-series anyway. |
| N6 | Audit-action strings are free-form | `'CREATE_MEDICAL_RECORD'`, `'MEDICATION_ADMIN_VOIDED'`, etc. passed as raw strings | Low | Centralize as an `AuditAction` union/const map so they're greppable and typo-proof. |

**Verdict:** naming is in good shape. Only N3/N6 are worth doing; N4/N5 are optional and carry import-churn risk.

---

## Part 2 — Duplicated logic (the real cleanup)

Ranked by impact. Each is a behavior-preserving extraction into a shared module.

### D1 — Currency formatting (35 files) · **HIGH impact, LOW risk**
`{value.toLocaleString()} SSP` is hand-written in **35** files. No `formatMoney`/`formatCurrency` helper exists.
- **Risk:** inconsistent decimals/negatives/empty handling across screens; currency symbol hard-coded (can't honor a facility-settings currency).
- **Fix:** add `formatMoney(amount, opts?)` to `lib/format-utils.ts` (respect the existing facility-settings currency where set). Replace the 35 inline usages.
- **Effort:** ~1–2 hrs. **Files touched:** 35 (mechanical).

### D2 — Triage-priority colours (8–9 files) · **HIGH impact, LOW risk**
The `RED → #EF4444 / YELLOW → warning / GREEN → success` ternary is duplicated in **9** files; the raw hex `#EF4444` appears in **8**.
- **Fix:** add `priorityColor(priority)` + `priorityLabel(priority)` to a small `lib/clinical/triage-display.ts` (or extend `format-utils`). Front-desk, ward, triage, handoff, dashboards all consume it.
- **Effort:** ~1 hr. **Files touched:** ~9.

### D3 — Status → colour/label maps (7 files) · **MED impact, LOW risk**
`statusColor` and equivalent status→label logic are redefined in **7** files (queue status, triage status, order status, payment status…).
- **Fix:** per-domain display helpers (e.g. `triageStatusDisplay`, `orderStatusDisplay`) co-located with each domain, instead of inline ternaries. Keep them domain-specific — don't over-merge unrelated status sets.
- **Effort:** ~2 hrs. **Files touched:** ~7.

### D4 — "Today / long date" + greeting (7+ files) · **MED impact, LOW risk**
`toLocaleDateString('en-GB', { weekday:'long', … })` is duplicated in **7** files; the `hr < 12 ? morning : …` greeting and `todayDate` header line repeat across every dashboard header.
- **Fix:** add `formatLongDate(date?)` to `format-utils.ts` and a `useGreeting()` (or `timeOfDayGreetingKey()`) helper. Dashboards already share `PageHeader`; this completes the dedup.
- **Effort:** ~1 hr. **Files touched:** ~7–14.

### D5 — Patient full-name assembly (18 files) · **MED impact, LOW risk**
`` `${p.firstName} ${p.surname}` `` is inlined in **18** files even though `patientFullName()` already exists in `lib/patient-utils.ts`.
- **Fix:** replace the 18 inline concatenations with the existing helper (handles middle name + spacing consistently).
- **Effort:** ~1 hr. **Files touched:** 18 (mechanical). **Risk:** trivial.

### D6 — Service CRUD boilerplate (~53 services) · **HIGH impact, MED risk** ⭐ biggest modularity win
Every data service hand-rolls the same shape: `const now = … ; const doc = { _id: prefix-uuid, type, ...data, createdAt, updatedAt }; db.put; logAuditSafe(...); emitSyncEvent({ resourceType, resourceId, operation, resourceVersion, orgId, hospitalId });` — and a matching `update`/`getByPatient`/`findByType + filterByScope`. **53** services repeat this.
- **Fix:** a small typed factory, e.g. `createCrudService<TDoc>({ db, type, idPrefix, resourceType })` returning `{ create, update, get, list, remove }` with audit + sync baked in. Services keep their domain-specific functions (e.g. `recordAdministration`, `adjudicateClaim`) but delegate the rote CRUD to the factory.
- **Payoff:** removes hundreds of near-identical lines; one place to fix audit/sync behavior; new services become ~10 lines.
- **Risk:** MED — touches the data layer broadly. Do it **incrementally** (factory + migrate 2–3 services + full test run, then proceed), not in one sweep.
- **Effort:** factory ~half day; migration ~1–2 days across services (incremental).

### D7 — Repeated UI patterns · **MED impact, LOW–MED risk**
- **Debounced search**: the `setTimeout`/`clearTimeout` debounce is re-implemented in several list/search screens → extract `useDebouncedValue(value, ms)`.
- **`window.confirm` destructive guards**: now common after the reversibility pass → a shared `useConfirm()`/`<ConfirmDialog>` would standardize wording + styling (some use native confirm, some use the portal `Modal`).
- **Toast on service success/failure**: the `try { …; showToast(success) } catch { showToast(error) }` wrapper repeats → optional `withToast(fn, {success, error})` helper.
- **Effort:** ~half day total. **Files touched:** ~10–15.

### D8 — `getVitalFlags` / vitals range logic (2+ places) · **LOW impact, LOW risk**
Abnormal-vitals thresholds live in `components/nurse/shared.tsx`; triage now has its own range table inline. Consolidate vitals ranges + flagging into one `lib/clinical/vitals.ts`.
- **Effort:** ~1 hr.

---

## Prioritized plan

| Priority | Items | Why | Risk | Rough effort |
|----------|-------|-----|------|--------------|
| **P0 — quick wins** | D1 (money), D5 (patient name), D2 (priority colour) | Highest duplication, purely mechanical, instantly consistent | Low | ~0.5 day |
| **P1 — display helpers** | D3 (status), D4 (date/greeting), D8 (vitals), N6 (audit actions) | Tidies the remaining inline display logic | Low | ~1 day |
| **P2 — structural modularity** | D6 (CRUD factory), D7 (UI hooks/components) | Biggest long-term maintainability gain; do incrementally | Med | ~2–3 days |
| **Optional** | N3, N4, N5 | Cosmetic / import churn; low payoff | Low–Med | as time allows |

Each item is independently shippable and verified green (`tsc` + `eslint` + 1492 tests) before moving on. Recommended new homes: `lib/format-utils.ts` (money/date), `lib/clinical/` (`triage-display.ts`, `vitals.ts`), `lib/hooks/` (`useDebouncedValue`, `useConfirm`), `lib/services/crud-service.ts` (factory).

---

## What I'd recommend

Start with **P0** — it's the clearest "professional + consistent" win for the least risk (currency and names look uniform everywhere immediately). Then **P1**. Treat **P2/D6** as a deliberate, incremental refactor rather than a sweep. I'd hold off on N4/N5 (renames/moves) unless you specifically want the folder reorg, since they add import churn for little functional gain.

Tell me which priorities (or individual D-items) to implement and I'll do them behavior-preserving, verifying green after each.

---

## Implementation status (what shipped)

**New shared modules created**

- `lib/format-utils.ts` — added `formatMoney()` (canonical `SSP 1,234`), `formatLongDate()` ("Wednesday, 17 June 2026"), `timeOfDay()`.
- `lib/clinical/triage-display.ts` — `priorityColor()`, `priorityOrder()`.
- `lib/clinical/vitals.ts` — `VITAL_RANGES`, `getVitalFlags()`, `isVitalInRange()` (single source of truth for vitals thresholds).
- `lib/hooks/useDebouncedValue.ts` — reusable debounce.
- `lib/services/crud-service.ts` — `createCrudService()` factory (the modular foundation for new/simple data services).

**Call-site migrations (D1–D5, D8)**

- **Currency (D1):** ~35 files now use `formatMoney`; the previously-inconsistent `SSP {n}` vs `{n} SSP` orderings are unified to `SSP 1,234`. (Translation-template amounts left as-is to avoid double currency symbols.)
- **Patient name (D5):** inline `${firstName} ${surname}` replaced with `patientFullName()` across clinical/patient/nurse files (now includes middle name consistently).
- **Priority colour (D2):** local `priorityColor` ternaries replaced with the shared helper.
- **Vitals (D8):** `getVitalFlags` consolidated into `lib/clinical/vitals.ts`; `shared.tsx` re-exports it; TriageWorkflow uses `VITAL_RANGES`/`isVitalInRange`.
- **Long date (D4):** dashboard header dates use `formatLongDate()`.

**Deferred (deliberately, with rationale)**

- **D6 — retrofitting existing services onto the CRUD factory:** NOT done. Existing services carry richer, intentional audit logging (actor IDs + descriptive messages like `ASSET_REGISTERED`, `Follow-up …: patient …`). A generic factory would flatten those to `CREATE_<TYPE>` with a generic message — an audit-fidelity *regression*. The factory now exists for new/simple services and incremental, case-by-case adoption where it doesn't lose detail.
- **N4/N5 (hospital→facility rename, `lib/` folder reorg):** skipped — import churn for little functional gain.
- **N6 (audit-action constants):** skipped — low value relative to routing ~70 action strings through a constant map.

All shipped changes verified green: tsc 0 errors, eslint 0 errors, 73 suites / 1492 tests pass.
