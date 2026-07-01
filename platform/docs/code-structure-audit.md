# TamamHealth Platform — Code Structure Audit

_Structural review of `platform/src` against Next.js / TypeScript best practices: dead code, files to delete, and folder/arrangement recommendations. This is advisory — no code was changed to produce it._

## At a glance

| Area | Files | Notes |
|---|---|---|
| `src/app` | 160 | App Router pages + API routes |
| `src/components` | 95 | Shared + feature components |
| `src/lib` | 231 | Services (78), hooks (54), + 47 loose root files |
| `src/data` | 1 | `mock.ts` (2,618 lines) — mixes types **and** data |
| `src/__tests__` | 91 | Well organized by domain |

Overall the codebase is healthy and well-tested. The main issues are (1) a handful of **orphaned components**, (2) an **overloaded `lib/` root**, (3) **types scattered** across three places, and (4) a few **very large page files** that should be decomposed.

---

## 1. ⚠️ Orphaned components from a reverted UI wiring (action needed)

Five components have **zero importers**. They are not random dead code — they are the UI for features whose host pages (`consultation/page.tsx`, `patients/[id]/page.tsx`) were reverted, dropping the imports. The **services, hooks, DB tables and tests for these features still exist and pass**, so the components are disconnected, not deleted.

| Orphaned component | Feature | Backend still present? |
|---|---|---|
| `components/consultation/FavoritesBar.tsx` | Clinical favorites | `clinical-favorites-service`, `useFavorites` ✅ |
| `components/consultation/SymptomTemplateForm.tsx` | Symptom branching templates | `lib/clinical/symptom-templates` ✅ |
| `components/patients/ScreeningsPanel.tsx` | Preventive screening reminders | `screening-service` ✅ |
| `components/patients/DocumentsPanel.tsx` | Document timeline | `patient-document-service`, `usePatientDocuments` ✅ |
| `components/patients/RemindersPanel.tsx` | Queued patient reminders | `patient-reminder-service`, `usePatientReminders` ✅ |

**Decision required — two clean options:**
- **Re-wire** them back into `consultation/page.tsx` and `patients/[id]/page.tsx` (recovers the features), **or**
- **Delete** the 5 components _and_ their now-unused services/hooks/DB registrations/tests (fully removes the features).

Leaving them as-is is the worst option — dead UI plus live-but-unreachable backend. (`TasksPanel` was **not** affected — it is still wired in `QuickActions.tsx`.)

> Two other zero-importer cards predate this session and are likely genuinely dead: `components/dashboard/NextAppointmentCard.tsx` and `components/dashboards/PatientQueueCard.tsx`. Confirm before deleting.

---

## 2. Files / artifacts to delete or consolidate

- **`deploy-v2.sh`** (Jun 15) is superseded by **`deploy-v4.sh`** (Jun 20). Keep one; delete the stale one (and avoid version-numbered script names — use `deploy.sh` + git history).
- **Jest config sprawl**: `jest.config.ts`, `jest.audit.cjs`, `jest.setup.ts`, `jest.setup.afterenv.ts`. Confirm `jest.audit.cjs` and `jest.setup.afterenv.ts` (36 bytes) are still referenced; fold setups together if not.
- **`tsconfig.tsbuildinfo`** is a build artifact — it should be git-ignored, not committed.
- No `.bak/.old/.tmp/.orig` files were found — good.

_(A full unused-export sweep of `lib/` was not completed here — recommend running `ts-prune` or `knip` in CI to catch unused exports continuously.)_

---

## 3. `src/lib` is overloaded — regroup by domain

`lib/` has **47 loose files at its root** plus large `services/` (78) and `hooks/` (54) folders. The root mixes unrelated concerns: auth (`api-auth`, `auth-token`, `csrf`, `token-blacklist`, `rate-limit`, `secrets`, `patient-portal-auth`), data (`db`, `db-seed`, `db-types*`), domain utils (`patient-utils`, `clinical-*`, `icd11-codes`, `fhir`), and config (`config-validation`, `license`, `branding`).

**Recommended grouping** (move files; keep barrels for back-compat during migration):

```
src/lib/
  auth/        api-auth, auth, auth-token, csrf, token-blacklist,
               rate-limit, secrets, patient-portal-auth, server-users
  db/          db, db-seed, db-query (exists in services), sync/
  types/       db-types + db-types-asset/billing/biometrics/hr/payments/ward
  clinical/    clinical-guidelines, clinical-history, clinical-roles,
               clinical-thresholds, icd11-codes, fhir, patient-utils  (already started)
  config/      config-validation, license, branding, secrets
  services/    (keep — but see §5: consider domain sub-folders)
  hooks/       (keep)
```

---

## 4. Types live in three places — consolidate

Domain types are split across:
- `db-types.ts` (1,588 lines) — the main file,
- `db-types-asset/billing/biometrics/hr/payments/ward.ts` — partial domain splits,
- **`data/mock.ts` — 24 `interface`/`type` declarations** (`Patient`, `AllergyEntry`, `ScreeningEntry`, `CareAlertEntry`, …) mixed in with mock/seed data.

**Recommendation:**
- Move the 24 types out of `data/mock.ts` into the types module (e.g. `lib/types/patient.ts`). `mock.ts` should contain **data only**.
- Promote the `db-types-*` split into a `lib/types/` folder with one file per domain (`patient`, `billing`, `ward`, `hr`, …) and a barrel `index.ts`. This also lets you break up the 1,588-line `db-types.ts`.

---

## 5. Decompose the largest files

Excluding the i18n locale files (11 × ~5k lines — expected for translations), the biggest files are page components doing too much:

| File | Lines | Suggestion |
|---|---|---|
| `consultation/page.tsx` | 2,941 | Extract each wizard step into `components/consultation/steps/*` and lift state into a `useConsultation` hook/reducer |
| `patient-portal/page.tsx` | 2,797 | Split into route segments / sections |
| `data/mock.ts` | 2,618 | Split types out (§4) + group data by domain |
| `db-seed.ts` | 2,430 | Split seed builders per domain under `lib/db/seed/` |
| `patients/[id]/page.tsx` | 2,320 | Extract the tab panels into components (several already exist) |
| `dashboard/page.tsx` | 1,781 | Extract the worklist table + cards into components |
| `db.ts` | (god-file) | All DB accessors + reset list + names in one file — split accessors by domain, generate the reset list |

A practical rule of thumb: page files over ~400 lines should delegate to components/hooks.

---

## 6. Smaller structural notes

- **`components/` root has 36 loose files.** Several could move into existing feature folders (e.g. `FingerprintCapture`, `FingerprintIdentifyModal` → `components/biometrics/`; `LockScreen`, `BootIntegrityGuard`, `ForcePasswordChange` → `components/security/`).
- **SMS gateway already exists** (`lib/sms/` with twilio / africas-talking / noop providers, used by `api/messages/route.ts`). The queued **patient-reminders** feature should be wired to dispatch through this rather than only being marked sent manually — the infrastructure is already there.
- **Dashboard route nesting**: role dashboards live under `app/(dashboard)/dashboard/{role}` while the clinical-officer dashboard is `app/(dashboard)/dashboard/page.tsx`. Consider a `(roles)` group or explicit per-role segments so the default page isn't visually the "CO dashboard by accident."
- **Add tooling to prevent regressions**: `knip` (unused files/exports/deps) and `madge --circular` (circular imports) in CI would catch orphans like §1 automatically.

---

## Suggested order of action

1. **Resolve the §1 orphans** (re-wire or delete the feature stack) — highest priority; it's live code in an ambiguous state.
2. Delete `deploy-v2.sh`; git-ignore `tsconfig.tsbuildinfo`; reconcile jest configs.
3. Move the 24 types out of `mock.ts` into `lib/types/`.
4. Regroup `lib/` root into `auth/`, `db/`, `types/`, `config/` (mechanical, low-risk with barrels).
5. Decompose the 2k+ line pages incrementally as you touch them.
6. Add `knip` + `madge` to CI.
