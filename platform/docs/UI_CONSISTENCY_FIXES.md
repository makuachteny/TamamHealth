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

## Not yet done (larger, tracked in the audit's Phase 3)
- Migrating System-B/C dashboards (lab, pharmacy, data-entry, nutrition, radiology, state, superintendent, facility-management) onto `EhrCareDashboard`.
- Category tokens for the appointment/disease/pharmacy color maps.
- Deleting the `__legacy_*` patient-record tabs + dead CSS, consolidating duplicate HR/hospital pages, de-duplicating repeated `globals.css` selector blocks, and routing the superintendent role through `role-routes.ts`.
