# TamamHealth — Platform UI Consistency Audit

**Scope:** Whole platform UI (`platform/src`) — shared shell, all role dashboards, and the main feature pages.
**Reference design:** the Clinical Officer dashboard, `components/ehr/EhrClinicalDashboard.tsx` (route `/dashboard`, shared by clinical_officer, doctor, clinician).
**Date:** 2 July 2026

---

## TL;DR

The platform actually has a good, mature design system already — a documented token palette and ~175 semantic `ehr-*` CSS classes in `globals.css`. The problem is **adoption**: the Clinical Officer dashboard uses that system cleanly (0 hardcoded colors, 0 inline styles), but most other role dashboards and feature pages were built with a competing, older `page-container` / `dash-card` pattern plus large amounts of inline styling and hardcoded hex colors. The result is two-and-a-half design languages living side by side, plus a lot of copy-pasted helper code.

There is nothing to invent here. The fix is to migrate the divergent screens onto the system the Clinical Officer dashboard already demonstrates, and to delete the duplicates.

---

## 1. The core problem: two competing design systems

| System | Shell markup | Colors | Used by |
|---|---|---|---|
| **A — Reference (`ehr-*`)** | `ehr-schedule-shell` → `ehr-schedule-header` + `ehr-workspace-grid` + `ehr-side-card` | 100% CSS tokens; **0 hex, 0 inline styles** | `EhrClinicalDashboard` (reference), `EhrCareDashboard`, and the shared shell |
| **B — "Faux-EHR"** | `TopBar` + `page-container` + `DashboardHero`/`SpotlightCard`/`dash-card` | tokens via inline `style={{}}` **plus** many hardcoded hex | lab, pharmacy, data-entry, nutrition, radiology, state, hr, superintendent, facility-management |
| **C — Bespoke one-offs** | fully custom | heavy hardcoded hex | government, facility-overview, payments |

System B was deliberately built to *look* like the reference (its own comments say "matching the `ehr-schedule-header` visual language") but reimplements it with `dash-card` + inline styles. Because it doesn't use the semantic classes, it can't inherit token/theme changes and it drifts.

**The good news:** the shared shell (`layout.tsx`, `EhrTopRail`, `EhrModuleMenu`, `EhrTopActions`, `EhrMiniCalendar`, `RoleGuard`) is already clean and token-based. All divergence is in page bodies, not the frame.

---

## 2. Role dashboards, ranked by divergence from the reference

Measured by hardcoded hex colors and inline `style={{}}` count (lower = closer to the reference).

| Dashboard | File | Hex | Inline | `ehr-*` | Verdict |
|---|---|---:|---:|---:|---|
| **Clinical Officer (REF)** | `components/ehr/EhrClinicalDashboard.tsx` | **0** | **0** | 54 | ✅ gold standard |
| **Care shell** | `components/ehr/EhrCareDashboard.tsx` | **0** | **0** | 53 | ✅ correct shared shell |
| Nurse / Midwife | `dashboard/nurse/…` → `NurseDashboard.tsx` | 0 | 1 | via shell | ✅ renders `EhrCareDashboard` |
| Front-desk | `dashboard/front-desk/page.tsx` | 4 | 50 | 23 | ⚠️ uses shell but 1,246 lines of hand-rolled modals |
| State (county director) | `dashboard/state/page.tsx` | 2 | 19 | 0 | ❌ System B |
| Facility management | `components/dashboards/FacilityManagementDashboard.tsx` | 4 | 64 | 0 | ❌ System B |
| Superintendent | `components/dashboards/SuperintendentDashboard.tsx` | 8 | 21 | 0 | ❌ System B; also routed oddly (see §5) |
| Nutrition | `dashboard/nutrition/page.tsx` | 4 | 42 | 0 | ❌ raw-hex `ACCENT='#EA580C'`, baked-in demo data |
| Radiology | `dashboard/radiology/page.tsx` | 2 | 58 | 0 | ❌ baked-in `SAMPLE_STUDIES` |
| Data-entry | `dashboard/data-entry/page.tsx` | 8 | 80 | 0 | ❌ raw-hex `ACCENT='#0891B2'` |
| Payments | `payments/page.tsx` | 0 | 112 | 0 | ❌ one-off `DataTile`, no shell |
| Pharmacy (ops) | `dashboard/pharmacy/page.tsx` | 23 | 97 | 0 | ❌ hardcoded event palette |
| Lab (ops) | `dashboard/lab/page.tsx` | 16 | **160** | 0 | ❌ most inline styles of any dashboard |
| Government | `government/page.tsx` | **42** | 109 | 0 | ❌ most hardcoded colors; 1,574 lines |
| Facility-overview | `facility-overview/page.tsx` | 16 | 29 | 0 | ❌ admits it "mirrors the Ministry dashboard" |

**Worst offenders (fix first):** government, lab, pharmacy, payments, data-entry, nutrition.

Notable "misarrangements":
- Several dashboards define a module-level accent as a **raw hex string that isn't even a token** — `data-entry` (`#0891B2`), `nutrition` (`#EA580C`) — so they can never theme correctly.
- `pharmacy` and `state` mix tokens and raw hex **inside the same color array** (e.g. `var(--color-success)` next to `'#EC4899'`).
- `government` color maps interleave tokens and arbitrary hex (`['var(--color-success)', '#2563EB', '#A855F7', …]`).
- `nutrition` and `radiology` ship hardcoded sample/demo data arrays inside the page component.

---

## 3. Feature pages: same divergence, larger surface

None of the main feature pages use the reference shell classes; they wrap in the legacy `page-container` + `dash-card` pattern with heavy inline styling. Two (consultation, patient detail) additionally sprinkle in `ehr-*` classes, creating a *mixed* third style.

| Page | File | Hex | Inline | Notes |
|---|---|---:|---:|---|
| Patient detail | `patients/[id]/page.tsx` | **41** | **260** | worst file overall; one-off print palette (`#1a1a1a`, `#015697`, `#c5d8e8`…) |
| Consultation | `consultation/page.tsx` | 5 | 265 | mixes `ehr-*` classes with 265 inline styles |
| Appointments | `appointments/page.tsx` | 22 | 102 | categorical color map hardcoded |
| Referrals | `referrals/page.tsx` | 12 | 153 | `dash-card` shell |
| Pharmacy | `pharmacy/page.tsx` | 14 | 97 | `#3B82F6` icon color ×8 |
| Messages | `messages/page.tsx` | 1 | 108 | avatar colors computed inline |
| Patients list | `patients/page.tsx` | 6 | 69 | raw Tailwind + inline `var()` |
| Wards | `wards/page.tsx` | 8 | 39 | `dash-card` shell |

Three different "card" idioms are used for the same visual object: `ehr-side-card` (reference), `dash-card` (referrals/wards/patients), and ad-hoc `<div style={{ border:'1px solid var(--border-light)', borderRadius }}>` (pharmacy/lab/messages). There is also **no shared page-header component** — every feature page rolls its own header, so title size/weight/spacing drifts page to page.

---

## 4. Duplication (redundant code to delete)

1. **`initials()` re-implemented in 8 places** even though `patientInitials()` exists in `lib/patient-utils.ts` and `getInitials()` in `PatientAvatar.tsx`. Duplicated in `EhrClinicalDashboard`, `WardWorkflow`, `MessagingDock`, `messages/page`, `front-desk/page`, and inline in `hr/page`, `dashboard/hr/page`, `hospitals/[id]/manage/page`.
2. **Six date helpers duplicated** (`toIsoDate`, `parseIsoDate`, `startOfMonth`, `addMonths`, `addDays`, `formatDateTitle`) — defined locally in `EhrClinicalDashboard.tsx` but already **exported** from `EhrMiniCalendar.tsx` (and already imported that way by `EhrCareDashboard`).
3. **Local date/age/currency formatters** bypassing `lib/format-utils.ts` / `lib/patient-utils.ts`: `VitalsTrends`, `api/eligibility/route`, `data/mock.ts` (`getAge`), plus `statusLabel`/`typeLabel` title-casing re-implemented in 3+ files and an `SSP` currency fallback repeated in 3 services.
4. **Config drift between `role-routes.ts` and `permissions.ts`:** `/dashboard/hr` is in five roles' allow-lists but **no nav item links to it** — every HR nav points to `/hr`. `/dashboard/hr/page.tsx` is reachable-but-unlinked dead weight.
5. **Overlapping / dead pages:** two HR pages (`hr/page.tsx` vs `dashboard/hr/page.tsx`); three unreachable legacy tab branches in `patients/[id]/page.tsx` (`__legacy_overview`, `__legacy_overview_admin`, `__legacy_demographics`, ~200 lines); two hospital-admin routes (`hospitals/[id]/manage` vs `org-admin/hospitals`).
6. **Duplicated CSS in `globals.css` (12,434 lines):** the same selectors are redefined as standalone blocks many times — `.ehr-worklist-row` ×7, `.ehr-right-rail` ×7, `.ehr-side-card` ×6, `.tebra-panel` ×7 — accumulating `!important` override chains instead of editing the original. Includes `.ehr-chart-content` dead code behind the removed `__legacy_overview` tab.

---

## 5. Routing / structural misarrangements

- **Superintendent** dashboard branches *inside* the 1,989-line `dashboard/page.tsx` rather than through the `role-routes.ts` map like every other role.
- **`/dashboard/hr` phantom route** (see §4.4).
- **`appointments/_AppointmentsCalendar.tsx`** loading placeholder is a bare empty `<div>` — no skeleton/spinner, unlike other pages.

---

## 6. Recommended fix plan (prioritized)

**Phase 1 — mechanical, zero-visual-risk (safe to do now)**
1. Deduplicate the six date helpers: import them from `EhrMiniCalendar` in `EhrClinicalDashboard.tsx`, delete the local copies.
2. Export a single `initials()` from `lib/patient-utils.ts` and replace the 8 copies with an import.
3. Remove the phantom `/dashboard/hr` entries from `role-routes.ts` (or wire a nav item to it — pick one).
4. Delete the three `__legacy_*` branches in `patients/[id]/page.tsx` and the matching dead `.ehr-chart-content` CSS.

**Phase 2 — token hygiene (medium risk, mostly find-and-replace)**
5. Replace raw-hex `ACCENT` constants (`data-entry` `#0891B2`, `nutrition` `#EA580C`) with `var(--accent-primary)` or a proper token.
6. Introduce a small set of **category tokens** (e.g. `--cat-appointment-*`, `--cat-disease-*`) for the legitimately-categorical color maps in `appointments`, `government`, `pharmacy`, and swap the hardcoded arrays onto them. (Don't flatten distinct categories onto semantic tokens — give them named category tokens instead.)
7. Swap unambiguous semantic hex (`#2191D0`→`--accent-primary`, `#DC2626`→`--color-danger`, `#059669`→`--color-success-600`) where the hex literally equals the token value.

**Phase 3 — structural convergence (larger, do incrementally)**
8. Migrate System-B/C dashboards (lab, pharmacy, data-entry, nutrition, radiology, state, superintendent, facility-management) onto `EhrCareDashboard` and retire `DashboardHero`/`SpotlightCard`/`dash-card`.
9. Extract a shared `DashboardPageHeader` + one canonical card class; standardize feature pages on `ehr-*` (or `dash-card`) — not both.
10. Route the superintendent role through `role-routes.ts`; consolidate the duplicate HR and hospital-admin pages.
11. Consolidate the repeated `globals.css` selector blocks into single authoritative rules and drop the `!important` chains.

---

*Phase 1 (and parts of Phase 2) were applied in this pass — see `UI_CONSISTENCY_FIXES.md` for exactly what changed.*
