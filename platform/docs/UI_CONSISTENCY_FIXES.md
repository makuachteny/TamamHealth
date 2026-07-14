# UI Consistency — Fixes Applied (Pass 1)

Companion to `UI_CONSISTENCY_AUDIT.md`. These are the safe, verifiable fixes applied in this pass. `npx tsc --noEmit` passes with **0 errors** after all changes.

## Deduplication (Phase 1)

1. **Shared `initials(name)` helper** added to `lib/patient-utils.ts` (alongside the existing `patientInitials`).
2. Removed **5 duplicate `initials()` copies** and pointed them at the shared helper:
   - `components/ehr/EhrClinicalDashboard.tsx`
   - `components/nurse/WardWorkflow.tsx`
   - `components/MessagingDock.tsx`
   - `app/(dashboard)/messages/page.tsx`
   - `app/(dashboard)/dashboard/front-desk/page.tsx`
3. Removed **7 duplicate date helpers** from `EhrClinicalDashboard.tsx` (`toIsoDate`, `parseIsoDate`, `startOfMonth`, `addMonths`, `addDays`, `formatDateTitle`, `formatMonthTitle`) — now imported from `components/ehr/EhrMiniCalendar.tsx`, which already exports them and is already the source for `EhrCareDashboard`.

## Token hygiene (Phase 2)

4. Replaced raw-hex per-page accent constants with the platform token so these dashboards match the reference Clinical Officer accent color:
   - `dashboard/data-entry/page.tsx`: `ACCENT = '#0891B2'` → `var(--accent-primary)`
   - `dashboard/nutrition/page.tsx`: `ACCENT = '#EA580C'` → `var(--accent-primary)`

   > Note: this changes those two dashboards' accent from cyan/orange to the brand blue used everywhere else. That is intentional (unify on the reference design). If you deliberately want a per-department accent, add a named token (e.g. `--accent-data-entry`) rather than reverting to a raw hex.

## Verified
- `npx tsc --noEmit` → exit 0 (no type errors).
- No remaining local `function initials` in the five edited files.

---

# Pass 2 — Align care dashboards to the Clinical Officer reference

Decisions taken with you: keep role data but present it in the reference's slots; restyle the biller (don't restructure it); align the care dashboards first (keep two components for now, unify next pass). `npx tsc --noEmit` passes with **0 errors**.

## Shared care shell (`components/ehr/EhrCareDashboard.tsx`)
- Added an explicit **`actionStrip`** prop rendered in the same `ehr-clinical-strip` slot the Clinical Officer uses (the row of quick-nav buttons under the work list). It is kept separate from the header `actions` so nothing is duplicated between the header and the strip.

## Nurse / Triage / Rooming (`components/nurse/NurseDashboard.tsx`)
- **Mission card now shown** (`showMissionCard` was `false`) — the right rail now has all three cards like the reference (stats + checklist + mission).
- Added a route-safe **action strip**: Patient search, Wards, Immunizations, Appointments.
- Role data unchanged — "Nursing station" stats and "Nursing checklist" stay in the reference's metrics/checklist slots.

## Reception / Clinic Clerk (`app/(dashboard)/dashboard/front-desk/page.tsx`)
- **Mission card now shown** (was `false`).
- Added a **route-guarded action strip** (Patient registry, Appointments, Referrals, Check-in queue) — each item respects `canUseRoute`, so a clinic clerk never sees a shortcut they can't open.
- "Reception today" stats and "Front desk checklist" stay in the reference's slots.

## Biller / Payments (`app/(dashboard)/payments/page.tsx`) — restyle only
- Layout kept (it already uses the shared `TopBar` + `dash-card` + tokens).
- Replaced two hardcoded tint backgrounds with tokens: error banner → `var(--color-danger-bg)`, accent chip → `var(--overlay-light)`.

## Result
All appointment/queue dashboards (Clinical Officer, Doctor, Clinician, Nurse, Triage, Rooming, Midwife, Reception, Clinic Clerk) now share the **same three-region structure**: header (segmented Dashboard/Calendar + greeting + actions) → left rail (Go to today + calendar + filters) → center (daybar + list + **clinical strip**) → right rail (**stats + checklist + mission**, three cards).

## Still divergent (Phase 3 — bigger, next pass)
- The System-B/C dashboards that don't use the shared shell at all: lab, pharmacy, data-entry, nutrition, radiology, state, government, superintendent, facility-management. These need migrating onto the shared shell.
- Merging `EhrClinicalDashboard` + `EhrCareDashboard` into one component (agreed for a later pass) to remove the remaining structural duplication.

---

# Pass 3 — Duplicate payments search + dark mode

## Removed the duplicate in-page search on the biller/cashier payments screen
The payments page rendered the shared `GlobalSearchBar` (which also carries the Filters + Collect Payment buttons) even though the platform header already has a search.
- Added a `hideInput` option to `GlobalSearchBar` and a `hideSearchInput` pass-through on `TopBar` (reusable by any page).
- Set `hideSearchInput` on the payments page (both the main and loading states). The search box is gone; **Filters and Collect Payment stay.**
- Note: the header search is a patient quick-jump (it opens a patient record), whereas the removed box text-filtered the bills list. Filters still narrows by balance status. If you'd rather keep list text-filtering, I can wire the header search to narrow the current page instead.

## Fixed dark mode
Root cause: the `--ehr-*` design tokens that drive every clinical dashboard (shell, side cards, worklists, calendar, care rows) were defined **only** in `:root` (light) and never in the `[data-theme="dark"]` block — so the entire dashboard body stayed light even though the theme toggle worked and the older `dash-card` components did darken.
- Added a full set of **dark `--ehr-*` token overrides** in `globals.css` (mapped to the existing dark palette).
- Re-pointed the dashboard shell surfaces that hardcoded `#fff`/`white` (appointment rows, worklist rows, care detail, search wrapper, check-in section, left-rail filter pills, empty-state button) at the tokens **in dark mode only** — kept off `.active`/`.primary`/tonal states so they keep their colours; inputs/selects were already handled by the existing global dark rule.
- Added a scoped dark override for the patient chart (`.ehr-chart-page`), which re-declares the same tokens, so it doesn't render blinding-white.
- All changes are additive `[data-theme="dark"]` rules, so **light mode is untouched**. Verified: PostCSS parses `globals.css` cleanly; `tsc --noEmit` passes.

Remaining dark-mode polish (smaller, next pass if you want): the patient-chart sub-components and a handful of feature pages still contain hardcoded light colours in their component markup (per the audit's hex inventory) that need converting to tokens for a fully polished dark theme.

---

# Pass 4 — Bills/Claims headers + dark-mode contrast correction

## Bills (payments) header
- Removed the **Filters** control; the **Bills** title and **Collect Payment** button now sit on the **same line** (added a reusable `titleActions` slot to `TopBar`, used with `hideSearch`).

## Claims header
- Removed **both** the in-page search and the Filters control (`<TopBar hideSearch />`).
- Cleaned up the now-unused `FilterMenu` imports and `activeFilterCount`/`clearFilters` in both pages.

## Dark-mode contrast fix (the washed-out / invisible-text look)
Root cause of the faint text: the dashboard shell **surfaces hardcoded `background: #FFFFFF`** (`.ehr-side-card`, `.ehr-worklist-panel`, `.ehr-worklist-table`, the left-rail `today`/calendar/filter groups, appointment/worklist rows, etc.) instead of using `--ehr-panel`. Pass 3 correctly made the **text** light, so the result was near-white text on still-white cards.
- Broadened the `[data-theme="dark"]` surface override to re-point **all** those hardcoded-white shell surfaces at `var(--ehr-panel)` with `--ehr-border`/`--ehr-text`.
- Excluded the blue **mission card** (`.ehr-side-card:not(.ehr-mission-card)`) so it keeps its brand background.
- Pinned card headings/labels to the light text tokens, and darkened the calendar day-cell hover.
- Still additive `[data-theme="dark"]` only → light mode untouched. Verified: PostCSS parses, `tsc --noEmit` passes.

---

# Pass 5 — Care rows now mirror the reference appointment row

The queue/appointment rows in `EhrCareDashboard` (nurse, triage, reception, clerk) didn't match the reference Clinical Officer row. Two changes:

1. **Avatar** — replaced the generic `<User>` outline icon with the patient's **initials** (shared `initials()` helper), matching the reference rows and the "Recently registered" table.
2. **Row layout** — restructured the row to the reference's four-part shape: **avatar → time + priority → bold name + subtitle → action(s) on the right.** Dropped the old inline status badge and verbose meta line. Added a `.ehr-appointment-time` column (bold mono time + small priority/status) and made the name/subtitle a clean flex stack (no indent). New CSS is scoped to `@media (min-width: 640px)` so the existing ≤639px compact/mobile treatment is untouched.

Verified: PostCSS parses `globals.css`; `tsc --noEmit` passes.

---

# Pass 6 — Appointment detail drawer + clean care rows

## Detail drawer (`.appointment-detail-sidebar`)
- Narrowed from `460px` to **`min(300px, 100vw)`** (calendar-rail width).
- Restyled for the narrower width: header status chips wrap onto their own row under the title, smaller title, and the detail rows now **stack label-over-value** (uppercase micro-label + bold value) instead of a cramped two-column grid.

## Care rows — actions moved into a click-to-open slider
- Removed the inline **Check in / Record / Assign / Records** buttons from the rows. Rows are now clean: **avatar · time/priority · name + subtitle**, with the name left-aligned right after the time.
- Clicking a row (or its name) now opens a **right-side detail slider** (same styled `.appointment-detail-sidebar`) showing the visit details and the action buttons (primary action, secondary action, and "Open record") — so the user decides there.
- Realigned the tablet/phone breakpoints to the new avatar|time|name structure (they previously depended on removed elements).

Verified: PostCSS parses; `tsc --noEmit` passes.

## Not yet done (larger, tracked in the audit's Phase 3)
- Migrating System-B/C dashboards (lab, pharmacy, data-entry, nutrition, radiology, state, superintendent, facility-management) onto `EhrCareDashboard`.
- Category tokens for the appointment/disease/pharmacy color maps.
- Deleting the `__legacy_*` patient-record tabs + dead CSS, consolidating duplicate HR/hospital pages, de-duplicating repeated `globals.css` selector blocks, and routing the superintendent role through `role-routes.ts`.
