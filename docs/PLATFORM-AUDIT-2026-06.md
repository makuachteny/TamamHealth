# TamamHealth — Platform Audit & Improvement Plan

_Date: 2026-06-16 · Scope: `platform/` (Next.js 14 offline-first EHR)_

## Health check (verified this pass)
- **TypeScript:** `tsc --noEmit` → 0 errors.
- **Lint:** eslint → 0 errors.
- **Tests:** `jest` → **1465/1465 passing** (after fixes below; the route-reachability suite was catching a real bug).
- **Sync coverage:** every written PouchDB database is in the sync config and `resetAllDatabases` (only `tamamhealth_meta` and the append-only controlled-substance log are intentionally excluded).

The platform is in good shape structurally — validated state machines, atomic consultation save, FK guards on payments, full sync coverage, strong server-side security (2-layer CSRF, token revocation, draft encryption, logout wipe). The items below are the gaps worth closing.

---

## Fixed during this audit (already applied, build green)
1. **Settings was blank for everyone except `government`.** A render guard `if (currentUser.role !== 'government') return null` blanked the page for all other roles — the root cause of "settings don't work per user." Removed; the page now renders for any user, with User/Hospital management still gated by `canManageUsers`. (`settings/page.tsx`)
2. **`clinician` role hit a `/dashboard` redirect loop / blank page.** Added `clinician` to the dashboard render + redirect exclusions so it gets the clinical view. (`dashboard/page.tsx`)
3. **`clinician` "Blood Bank" nav item bounced to "Access Restricted."** Added `/blood-bank` to `clinician`'s allowed routes; the failing route-reachability test now passes. (`role-routes.ts`)

---

## P0 — Correctness bugs to fix next

### 1. Two competing billing models don't reconcile (highest impact)
There are two financial systems: **Billing/Invoice** (`tamamhealth_billing`, written by `chargeForServices`/`createBill`) and **Ledger/Charges/Payments** (`tamamhealth_ledger`, read for all balances). Auto-charges (consultation fee, labs, drugs) write to Billing; **balances, the checkout gate, and Collect-Payment all read the Ledger** — which auto-charges never touch.
- Effect: the front-desk checkout shows "Balance settled" with unpaid charges; Collect-Payment shows nothing due; payments push the ledger **negative**.
- Fix: have `chargeForServices`/`createBill` also post a `createLedgerEntry({entryType:'charge', …, encounterId})`, **or** route consultation auto-charges through `payment-service.createCharge`. (`billing-service.ts`, `consultation/page.tsx:1084`, `payment-service.ts`)

### 2. Encounter balance chip uses the wrong id
`patients/[id]/page.tsx:~119` calls `getEncounterBalance(records[0]._id)` (a `mr-…` id), but the function filters the ledger by `encounterId` (`enc-…`) → always returns 0. Pass `records[0].encounterId`.

### 3. Facility checkout never advances the encounter / gate is dead code
Front-desk checkout only flips triage/appointment status; the `EncounterDoc` is left at `ready_for_clinic_checkout` and `FACILITY_CHECKOUT_GATE` / `unmetCriticalGateItems` (`encounter-journey.ts:218-262`) is never invoked. Wire the gate into `handleCompleteCheckout` and transition the encounter to a terminal state. (`front-desk/page.tsx:259`)

### 4. Context values not memoized — app-wide re-render cost
`AppProvider` (`context.tsx:630`) and `SettingsProvider` (`SettingsProvider.tsx:80`) pass fresh object literals as `value={{…}}`, so every `useApp()`/`useSettings()` consumer (TopBar, Sidebar, most pages) re-renders on any state tick (search keystroke, sync status, theme). Wrap both in `useMemo`. Biggest single perf win.

---

## P1 — Security / deployment (before a real PHI go-live)
1. **Demo mode + plaintext secrets in the working tree.** `.env.production` ships `NEXT_PUBLIC_DEMO_MODE=true` (seeds full staff roster + exposes `/api/demo-credentials`), and `.env.production.real.bak` holds live-looking secrets. They're gitignored (not committed) but must not ship: set `NEXT_PUBLIC_DEMO_MODE=false`, delete the `.bak`, rotate all secrets, move to a secrets manager.
2. **`NEXT_PUBLIC_JWT_SECRET` reuses the server `JWT_SECRET`.** Baking the HS256 signing key into the browser bundle lets a client forge tokens. Use a distinct value (or remove the public mirror).
3. **No production / in-country deployment runbook.** `docs/` lacks TLS termination for CouchDB, at-rest volume encryption (PHI residency), backup/restore + retention, secret rotation, and CouchDB per-DB `_security`. Add `docs/operations/deployment.md`. Also fix the stale "Known gaps" section in `README.md:401-419` (lists already-implemented items).
4. **Patient-portal PHI surface** (CSRF-exempt, own JWT) scopes by `auth.sub` only — review that every per-record read enforces patient ownership.

---

## P1 — Flow gaps (data created but not used, or lifecycle tails unreachable)
- **Ledger syncs `push`-only** (`sync-config.ts:87`) — a device never pulls ledger entries from other stations, so balances differ per device. If the ledger is the authoritative balance, make it `both`.
- **Lab/pharmacy lifecycle tails are defined but unreachable:** `acted_upon`/`communicated_to_patient` (lab) and `under_review`/`cleared_for_dispensing`/`counseled`/`complete` (pharmacy) have transitions but no UI action sets them. Either add the actions or trim the enums to the real two-state model.
- **Standalone lab orders** (lab-desk initiated, `lab/page.tsx:106`) get no `encounterId` and aren't charged — financially invisible. Attach an encounter and bill, mirroring the consultation path.
- **Write-only links:** `medicalRecord.labOrderIds`/`prescriptionIds`, triage `handoffTo/handoffAt` are persisted but never read in the UI. Render them on the visit/worklist or drop them.
- **Drug charges** pass `serviceCode: rx.medication` but no `referenceId` = prescription `_id`, so a charge can't be traced to the script. Pass the id.
- **Dead allow-list entry:** `/payments/plans` is allowed for 8 roles but has no page. Remove it or build the route.

---

## P2 — UX, performance, polish
- **Live list hooks refetch the whole collection on every change** (`usePatients` et al.) and large tables aren't virtualized. Apply change deltas / paginate / `react-window` for big facilities.
- **Charts & calendar imported statically** in ~7 pages (recharts, react-big-calendar). Move to `next/dynamic({ ssr:false })` to shrink initial route JS.
- **`generateHospitalNumber` does a full `allDocs()` scan** per registration just to count (`patient-service.ts:128`) and isn't monotonic after deletes. Use a counter doc / `db.info().doc_count`.
- **~5 pages use bespoke headers** instead of `PageHeader` (government, telehealth, payments/portal, settings, role dashboards) — minor visual drift; migrate for consistency.
- **Mobile search uses `window.prompt()`** (`TopBar.tsx:193`) — replace with the styled search sheet.
- **No shared Skeleton component** — loading states are ad-hoc text; some pages flash empty. Add `Skeleton`/`TableSkeleton`.
- **A few hardcoded hexes ignore org branding** (`EmptyState.tsx:41` `#3b82f6`) — swap to `var(--accent-primary)`.
- **Consultation toasts are hardcoded English** (`consultation/page.tsx` lines ~675, 758, 760, 777, 821) while the rest uses `t()`. Move into the i18n catalog.
- **Minor stubs to confirm/finish:** surveillance outbreak map is a placeholder (`surveillance/page.tsx:422`); payments/portal bank details are TODO-hardcoded; patient-portal login rate-limit is in-memory (not multi-instance safe).

---

## Suggested order of work
1. P0 #1 billing reconciliation (unblocks correct balances/checkout/collections) + P0 #2 encounter-balance id.
2. P0 #4 memoize context values (perf) + P0 #3 wire facility checkout/gate.
3. P1 security pack (demo flag, secrets, public JWT, deployment runbook) — gating for any real PHI deployment.
4. P1 flow gaps (ledger sync direction, lifecycle tails, standalone lab billing).
5. P2 UX/perf polish.
