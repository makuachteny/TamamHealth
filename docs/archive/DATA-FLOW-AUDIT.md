# TamamHealth — Data-Flow Audit

_Goal: confirm every data type has (1) an **entry point** (a way to be created), (2) a **store/read** path, (3) a **display** surface, and (4) **sync** coverage._

## Scope

- **52 databases / ~55 document types** enumerated from `lib/db.ts` + `lib/db-types*.ts`.
- **Sync coverage: complete** — all 52 databases are present in `lib/sync/sync-config.ts`. No data type is excluded from replication.
- Each finding below was **verified against actual call sites** (the four parallel sweeps produced several false positives that were corrected by direct grep).

## Verdict

The data layer is **largely healthy**: the great majority of types flow end-to-end (entry → service write → display → sync). The only genuine gaps are a **handful of operational modules whose backend exists (service + API route + sync) but which have no in-app dashboard UI yet.**

---

## ✅ Healthy, complete flows (entry → store → display → sync)

**Clinical:** patient, medical_record (consultation), prescription, lab_result, problem, triage, immunization, anc_visit, referral, appointment, availability, telehealth_session.

**Vital events / community / comms:** birth, death, follow_up (created from the CHV/Boma dashboard), disease_alert (surveillance), facility_assessment, patient_note (created via the patient **Communication** tab, shown on the Overview), message + conversation (staff chat), announcement (rendered via the TopBar `AnnouncementsPanel`).

**Finance:** charge (auto-created on **consultation save** via `chargeForServices`), payment, ledger_entry (auto side-effect of payments/charges/claims), insurance_policy, eligibility_check, claim (submit **and** adjudicate are implemented), payment_plan, fee_schedule (org-admin pricing).

**Operations / admin / HR:** ward, admission, pharmacy_inventory, asset (equipment page), staff_schedule, leave_request, payroll_entry, hospital, organization, user, platform_config (singleton), fee_schedule.

**System-generated (no UI entry expected — correct by design):** audit_log (`logAudit`), sync_event (`emitSyncEvent`), conflict_queue (`enqueueConflict`).

---

## ⚠️ Gaps — backend exists, no in-app entry point

These have a working service (and most have an API route + sync) but **no dashboard page to create/manage them from inside the app**:

| Type | Backend present | Missing | Severity |
|------|-----------------|---------|----------|
| **blood_bank** | `blood-bank-service.ts` (`addUnit`), `app/api/blood-bank` route, sync | No dashboard page to add/cross-match units | High (clinical safety) |
| **emergency_plan** | `emergency-preparedness-service.ts` (`createPlan`), `app/api/emergency-plans` route, sync | No dashboard page to create/view plans | Medium |
| **controlled_substance_log** | `controlled-substance-service.ts` (`recordMovement`, operator/witness signing), sync | No UI **and** no API route — service only | High (regulatory/compliance) |
| **boma_visit** | `boma-visit-service.ts`, `app/api/boma-visits` route, sync | No web create form (the Boma dashboard records **follow-ups**, not visits) — created via API / CHV path only | Low (CHV/mobile concept) |

## ✅ Minor / polish gaps — resolved

- **refund** & **adjustment** — ✅ now have billing-admin actions on the Billing tab.
- **saved_payment_method** — ✅ manage section (list/add/remove) on the Billing tab.
- **eligibility_check** — ✅ a **"Verify"** button added to `InsuranceSnapshot` triggers `checkEligibility` and refreshes the badge.
- **encounter balance** — ✅ `getEncounterBalance` now surfaced as a "SSP X due / Visit settled" chip on the patient's Most Recent Record hero.
- **bed** — **N/A by design**: the admission flow uses a free-text `bedNumber`; the `BedDoc` type isn't created/consumed by the current workflow, so a "create bed" form would be dead UI. Left as-is.

## 🏗️ Architecture note

- **Two billing models coexist**: `BillingDoc` (`billing-service.ts`, used by `chargeForServices` / consultation auto-charge) and `InvoiceDoc` (`payment-service.ts`). Both are wired and synced. Not a data-loss risk, but worth consolidating or clearly documenting which is authoritative to avoid drift.

---

## ✅ Resolution status (implemented)

All flagged gaps now have an in-app entry point:

| Gap | Resolution |
|-----|------------|
| controlled_substance_log | **New page** `/controlled-substances` — record movements with operator + witness two-signature audit. Nav: Pharmacist, Med. Superintendent. |
| blood_bank | **New page** `/blood-bank` — register units, availability by group, expiry tracking. Nav: Doctor, Clinical Officer, Lab Tech, Med. Superintendent. |
| emergency_plan | **New page** `/emergency-preparedness` — create/track surge plans, activate/deactivate. Nav: Med. Superintendent, Org Admin. |
| boma_visit | **Entry form added** to the CHW/Boma dashboard ("Record visit") + a recent-visits list. |
| refund | **"Issue refund"** action added to the patient **Billing** tab (role-gated to cashier/biller/admin), picks a payment, posts to the ledger. |
| adjustment / write-off | **"Adjustment / write-off"** action added to the **Billing** tab (same gate). |
| saved_payment_method | **"Saved payment methods"** section on the **Billing** tab — list / add / remove (added a `deletePaymentMethod` service fn). |

All new routes are gated in both `role-routes.ts` (allow list) and `permissions.ts` (nav), and English labels were added to the locale file so nothing renders raw keys.

### Billing model duality — decision
`BillingDoc` (`billing-service.ts`) is the **authoritative patient bill/statement** — it's what `chargeForServices` writes on consultation save and what the Billing page/tab read. `InvoiceDoc` (`payment-service.ts`) is the narrower **insurance-claim invoice**. They are not in conflict (different purposes) and both sync, so they are **kept separate with this documented boundary** rather than merged — a merge would touch the billing + payment services and every billing surface, which isn't worth the regression risk for no functional gain. Revisit only if an insurance-billing overhaul is undertaken.

## Recommended next steps (in priority order)

1. **Controlled-substance log UI** (compliance) — add a pharmacy tab to record movements with operator + witness signatures.
2. **Blood bank UI** — a `/blood-bank` page to register units, stock levels, and cross-match.
3. **Emergency preparedness UI** — a `/emergency-preparedness` page to create/track plans.
4. **Billing actions** — surface Refund and Adjustment/Write-off buttons in the billing/payments admin area (if staff need them).
5. **Consolidate billing models** (`BillingDoc` vs `InvoiceDoc`) or document the boundary.

Everything else is wired end-to-end with full sync coverage.
