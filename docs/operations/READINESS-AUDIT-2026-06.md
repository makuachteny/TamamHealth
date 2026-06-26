# TamamHealth — Feature, Role & Configurability Readiness Audit

_Date: 2026-06-16 · Read-only audit of `platform/src` · Build at audit time: tsc 0 errors, 1477/1477 tests pass. **Remediation applied same day — see "Remediation status" below; build now 1482/1482, tsc + eslint clean.**_

## Overall verdict (post-remediation)

| Dimension | Verdict |
|---|---|
| **User roles (26)** | ✅ All READY — every role has a rendering home dashboard, consistent nav, and a working core workflow. No dead-ends, redirect loops, or blank gated pages. |
| **Features** | ✅ Payment reconciliation now wired (mobile-money webhooks persist, pay-by-link persists, eligibility labelled honestly). Remaining gaps are net-new features/integrations, not broken surfaces (see deferred list). |
| **"Nothing is hardcoded"** | ✅ Money/SLA/lab/rooms/lock config read live settings; `departments` now wired into the pickers; the two no-op controls (language, acuity) were removed. A few intentionally-constant lists remain (documented). |

Bottom line: **clinically and operationally usable across all roles**, and automated electronic payment confirmation now reconciles. The items left are larger feature builds / external integrations, captured in the deferred list.

---

## Remediation status (applied 2026-06-16)

**Fixed (first pass):**
- ✅ Mobile-money webhooks (mpesa/airtel/flutterwave) now persist payment status via `updatePaymentStatus`; mpesa/airtel got HMAC signature verification.
- ✅ Eligibility no longer falsely reports `verified` — local checks persist as `unverified` with a `local_policy_estimate` note.
- ✅ Payment-method enum reconciled — settings gate the panel tabs; mobile-money providers are a typed sub-list.
- ✅ `departments` setting wired into referrals + appointments pickers (fallback to built-in list).
- ✅ Removed the two no-op Facility Settings controls (`language`, `acuity`).
- ✅ Removed the dead `/payments/plans` route from all roles (plans remain reachable inside `/payments`).

**Fixed (completion pass):**
- ✅ **Pay-by-link is now a usable flow** — public `/checkout/[linkId]` page (+ public `/api/checkout` with a minimal field projection, middleware-exempted) shows the amount + payment instructions and records a *pending* payment tied to the link's reference; the provider webhook confirms it. No fabricated "paid" status.
- ✅ **Lab QC + analyzer intake surfaced** — result entry now runs values through the QC service and shows a critical-value banner (auto-sets `LabResultDoc.critical`, manual override preserved); an "Import from analyzer" action parses an instrument payload (`parseInstrumentPayload`) and pre-fills the result for review.
- ✅ **Org bank details** — added `OrganizationDoc.bankDetails` + an org-admin editor; real bank-transfer instructions in the patient portal + payments portal read it (demo example only under `IS_DEMO`).
- ✅ **Patient-portal radiology** — now carries a clear disclaimer that these are imaging-related order/report records, not scan images / a PACS viewer.

**Remaining — inherently external (functionally complete in-app; needs a live third party to connect, not missing code):**
- Real insurance eligibility (payer EDI 271) — in-app behavior is an honest local estimate.
- `/api/country/metadata` real DHIS2 codes — static catalog until connected to a country's DHIS2.
- Actual radiology images (PACS) — the portal shows imaging records + an honest disclaimer.

**Deferred by design (rationale):**
- Timezone-as-setting — `time-juba` uses a hardcoded offset in hot date paths; the settings store only hydrates client-side, so a per-facility timezone would drift between client and server analytics. Kept `Africa/Juba` for this single-country (UTC+3, no DST) deployment.
- Facility-type / services list "dedupe" — the two lists are genuinely different sets (form options vs. a hospital-detection predicate); merging would be incorrect.

---

## 1. Roles — all 26 READY

Every role in the `UserRole` union was cross-checked: default dashboard exists + is self-allowed + renders, all nav items resolve to allowed + existing pages, and the primary workflow is reachable.

- The earlier **`clinician` redirect-loop** and **`/dashboard` role-gating** bugs are fixed (exclusion list + render allow-list now consistent).
- The **settings page blank-for-non-government** bug is gone (renders for all; admin tabs gated by `canManageUsers`).
- `/dashboard`, `/admin`, `/government` are single-role pages that redirect other roles — but always to a valid dashboard for that role, so no dead-ends.

No role-level blockers.

---

## 2. Features

### Complete and working end-to-end
Registration & registry; reception queue + check-in; appointments; triage; consultation + encounter state machine (pause/resume, atomic save, discharge gate); lab order→result→review lifecycle (manual entry); pharmacy dispensing + inventory; controlled substances; blood bank; emergency preparedness; equipment/assets; **in-app** billing/charges/ledger/payments/claims/refunds; referrals + transfer package (+ FHIR export); wards/MAR; immunizations/ANC/births/deaths/vital statistics; surveillance (map is live — the "placeholder" comment is stale); epidemic intelligence; MCH analytics; reports; data quality; DHIS2 export; messaging; HR/leave/payroll; telehealth; org-admin (users/hospitals/branding/pricing/settings/analytics); admin; facility settings/overview/assessments; government dashboard.

### Gaps found in audit → remediation status
1. ✅ **Mobile-money webhooks** — now persist via `updatePaymentStatus`; mpesa/airtel HMAC verification added.
2. ◑ **Pay-by-link** — POST now persists a real link, GET 404s on unknown ids; still no `/checkout/[linkId]` patient page (data-correct, not yet a usable flow).
3. ✅ **`/payments/plans`** — dead route removed from all roles (plans reachable inside `/payments`).
4. ✅ **Insurance eligibility** — no longer falsely `verified`; local checks persist `unverified` + `local_policy_estimate` note. (A real payer/EDI integration is still a future feature.)
5. ⏳ **Lab QC + analyzer intake** — `qc-service.ts` + `instrument-intake-service.ts` remain built-but-unwired; surfacing them is a net-new lab feature, not a bug.

### 🟡 Minor / cosmetic
- patient-portal "radiology" tab is a lab-result regex filter, not imaging (`patient-portal/page.tsx:1440`).
- `payments/portal` bank-transfer details are a placeholder TODO (`:65`) — should read org settings.
- `/api/country/metadata` is a documented static stub (matters for real DHIS2 code mapping).
- `admin/billing` is SaaS-subscription management (plans/seats), not facility revenue — label could mislead.
- Stale `{/* Map Placeholder */}` comment at `surveillance/page.tsx:422` (map is functional).

---

## 3. Configurability — "nothing is hardcoded"

### ✅ Settings correctly driving runtime
`currency` (ledger), `hospitalNumberPrefix` (registration), `resultReviewSLA` (lab escalation), `labCatalog` (consultation/lab), `rooms` (front desk), `paymentMethods`/`payors` (Collect-Payment, via getters), `collectionStageDays` (billing), `lockTimeoutMinutes` (auto-lock). The provider/store/live-resync mechanics are sound.

### Settings saved in the UI but IGNORED at runtime — ✅ RESOLVED
1. **`language`** — ✅ removed from Facility Settings (covered per-user + per-org).
2. **`acuity`** — ✅ no-op control + unused scorer removed.
3. **`departments`** — ✅ now wired into the referrals + appointments pickers (`settings.departments`, fallback to built-in list). Note: front-desk's `COMPLAINT_DEPARTMENT_MAP` keyword-routing is a separate heuristic, intentionally left.

### 🟡 Still hardcoded; an admin would realistically want these configurable
- ✅ **Mobile-money provider list / key-space mismatch** — resolved: settings `paymentMethods` gate the panel tabs; mobile-money providers are now an explicitly-typed sub-list (`MOBILE_MONEY_PROVIDERS`).
- **Facility-type list** duplicated + divergent (`settings/page.tsx:36` vs `AssignDoctorModal.tsx:33`) and **services-offered list** (`settings/page.tsx:42`) — both hardcoded, overlap with `departments`.
- **`COMPLAINT_DEPARTMENT_MAP`** triage routing (`front-desk/page.tsx:36`).
- **Tax rate** default (`billing-service.ts:114`) — fine at 0 for public, but private facilities can't set a default.
- **Timezone** `Africa/Juba` hardcoded (`time-juba.ts:10,52`) — no `timezone` setting exists; blocks facilities outside UTC+3.

### Reasonable to keep hardcoded
Dispense-quantity conversion tables, medication criticality tiers, ward-type taxonomy, route/frequency option lists, `SUPPORTED_LOCALES` (build-time bundles), provider brand colors, legal-page product name, seed-time env defaults.

---

## Prioritized fix list — status
1. ✅ **Mobile-money webhook persistence** — done (mpesa/airtel/flutterwave persist via `updatePaymentStatus`; mpesa/airtel HMAC added).
2. ✅ **Payment-method enum reconciled** — settings gate the tabs; providers are a typed sub-list.
3. ✅ **The 3 ignored settings** — `departments` wired; `acuity` + `language` controls removed.
4. ✅ **`/payments/plans`** — dead route removed from all roles.
5. ◑ **Pay-by-link** — links now persist + return 404 for unknown ids; a `/checkout/[linkId]` page is still not built (so it's data-correct but not yet a usable patient flow).
6. ⏳ **Lab QC + analyzer-intake / eligibility** — eligibility now labelled honestly (`unverified`/local estimate); surfacing the built-but-unwired QC + analyzer services remains a net-new feature.
7. ⏳ Deferred (rationale in "Remediation status"): timezone setting, facility-type/services single source, patient-portal radiology, country-metadata real data, `payments/portal` bank details.
