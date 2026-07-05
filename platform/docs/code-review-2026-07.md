# TamamHealth Platform — Code Review (July 2026)

_Dead code, modularization opportunities, structure and documentation improvements for `platform/src`. Advisory — no runtime code was changed to produce this. Complements the earlier `docs/code-structure-audit.md`._

## Snapshot

- **609** `.ts/.tsx` files; ~203k lines (≈57k of that is the 11 i18n locale files, which are data, not logic).
- **76** services in `lib/services`, **54** hooks in `lib/hooks`, ~95 components.
- **No real tech-debt markers**: zero `TODO`/`FIXME`/`HACK` comments and zero `{false && …}` dead JSX blocks. The 211 `eslint-disable` lines are almost all legitimate (`no-require-imports` for dynamic `import()`, `no-img-element` for intentional `<img>`, `exhaustive-deps` on stable callbacks).
- **No circular imports** and clean layering (data → services → hooks → components).

The codebase is healthy at the macro level. The biggest wins are **not** deleting dead code (there's little) — they are **collapsing two pervasive duplication patterns** and **splitting three oversized page files**.

---

## A. Dead / unused code

There is very little. Concretely:

- **No unreachable/commented-out blocks, no orphaned files.** All hooks and components are imported somewhere.
- **Backward-compat re-export shims** exist and are intentional bridges — keep, but mark for eventual removal:
  - `lib/auth.ts` — "re-export token functions so existing imports still work".
  - `data/mock.ts` (top) — type re-exports from `lib/types/patient-clinical.ts`.
- **`atcForMedication()`** in the new `lib/data/formulary.ts` is exported but not yet consumed — wire it into the drug-interaction/class logic or drop it.

**Action:** nothing urgent. Add a short `@deprecated — remove after <date>` note to the shim files so they don't live forever.

---

## B. Modularization (highest payoff)

### B.1 — Collapse the 54 data hooks into one factory ⭐ biggest win

**34 of 54 hooks** repeat the identical template: `useState` for `{data, loading, error}`, `useDataScope()`, a `load` callback that calls a `getAll*(scope)` service, a `useEffect` that runs it, and a **second `useEffect` that opens a live PouchDB `.changes()` subscription through `makeCoalescer`** and re-loads on change. Only the DB handle, the service call, and 2–4 domain mutations differ per hook (`useAppointments`, `usePrescriptions`, `useReferrals`, `useWards`, `useLabResults`, `useTriage`, `useTelehealth`, …).

**Build:** `lib/hooks/createLiveCollection.ts`

```ts
export function createLiveCollection<TDoc>(cfg: {
  db: () => PouchDB.Database;                       // e.g. appointmentsDB
  getAll: (scope?: DataScope) => Promise<TDoc[]>;   // the service list fn
  mutations?: (reload: () => Promise<void>) => Record<string, (...a: any[]) => Promise<any>>;
  derive?: (docs: TDoc[]) => Record<string, unknown>; // e.g. activeAdmissions
}) {
  return function useCollection() { /* state + scope + load + coalesced subscription + mutations + derive */ };
}
```

Then each hook becomes ~10 lines:

```ts
export const useAppointments = createLiveCollection({
  db: appointmentsDB,
  getAll: getAllAppointments,
  mutations: (reload) => ({ create: (d) => createAppointment(d).then(reload), updateStatus: … }),
});
```

**Impact:** ~4,500 lines → ~800 (factory) + ~1,500 (thin configs). One place to fix subscription bugs, error handling, and loading semantics.

### B.2 — Route services through the existing `crud-service` factory ⭐

`lib/services/crud-service.ts` already implements the `createCrudService<TDoc>()` pattern (build doc → `db.put` → audit log → sync event, plus update/get/list/remove). **Only 2 of 76 services use it.** The other ~74 hand-roll `getAllX / getXById / createX / updateX` — the same 30–40 lines each.

**Do:** migrate the plain CRUD services (appointment, referral, ward, assessment, asset, announcement, …) onto `crud-service`. **Keep hand-rolled** the ones with real domain logic (lab — field encryption; prescription — interaction checks + MAR void; payment — ledger; patient — dedupe + hospital-number generation), but extend `crud-service` with optional `transform`/`encrypt` hooks so even those can share the list/get plumbing.

**Impact:** ~8,000 lines → ~2,500; uniform audit-log + sync-event guarantees (today it's easy to forget one).

### B.3 — Split the three oversized page files

| File | Lines | Natural extractions |
|---|---:|---|
| `consultation/page.tsx` | 3,629 | 7–9 section sub-components (History, Intake/Vitals, Exam, Diagnosis, Prescriptions, Labs, Plan, Summary) ~150–250 lines each; plus `useConsultationDraft`, `useSuperbillPreview`, `usePrescribingSafety` hooks. Target ~900 lines. |
| `patients/[id]/page.tsx` | 3,034 | One component per chart tab (Overview, Timeline, History, Labs, Prescriptions, Vitals, Immunizations, Referrals). Target ~800. |
| `patient-portal/page.tsx` | 2,483 | 6–8 tab sub-components. Target ~700. |

These are pure structural extractions (move JSX + local state into co-located files under e.g. `consultation/_sections/`), so they're low-risk and make the flow testable. Do them **after** B.1/B.2 or in an isolated worktree — they're big diffs.

### B.4 — Enforce the shared UI primitives that already exist

`ChartCard`, `SearchInput`, `FilterTabs`, and a `Badge` exist but pages still re-inline the card/header/search/status-pill markup (5+ copies each). Adopt them; add a `statusTone(status)` helper so status→color logic isn't re-written in 15 places.

---

## C. Structure / organization

- **Add barrel `index.ts`** to high-traffic folders that lack one: `lib/hooks`, `lib/services`, `components/patients`, `components/nurse`, `components/dashboard`. Turns `import … from '@/lib/hooks/useX'` (54 paths) into `from '@/lib/hooks'` and aids discovery.
- **Unify the data layer:** `data/mock.ts` (2.6k lines, mixes types + seed) sits apart from `lib/data/` (formulary, presets). Move it to `lib/data/mock.ts` and split its **types** out into `lib/types/`. Seed data (`lib/db-seed.ts`) can stay separate.
- **Consolidate clinical modules:** `lib/clinical/`, `lib/clinical-flow/`, and the loose `lib/clinical-guidelines.ts` should live under one `lib/clinical/` tree with a barrel, so the domain has one home.
- **~47 loose files at `lib/` root** — group them (auth, time, format, db) into subfolders.

## D. Documentation

- **House style already exists** — `crud-service.ts` and `clinical-flow/index.ts` have excellent file-level block comments. Use them as the template.
- **Gap:** the ~74 plain services and ~34 hooks have no file-level comment. Add a 3–4 line header to each stating what it owns and its audit/sync guarantees (a batch task; ~1–2 days).
- **The three big pages** have no top-of-file comment explaining their section/tab architecture — add one to each (especially `consultation/page.tsx`).
- **Add a `docs/CODE-ORGANIZATION.md`** describing the layering (data → services → hooks → components), the two factories (`createLiveCollection`, `createCrudService`), and the folder conventions, so new patterns don't regress.

---

## Prioritized roadmap

| # | Change | Effort | Payoff | Risk |
|---|---|---|---|---|
| 1 | `createLiveCollection` hook factory → migrate 34 hooks | High | Very high | Low (behavior-preserving, verify per hook) |
| 2 | Move ~74 services onto `crud-service` (extend it with transform/encrypt hooks) | High | Very high | Low–Med |
| 3 | Barrels + file-level doc headers on services/hooks | Low | Medium | Very low |
| 4 | Split `consultation` / `patients/[id]` / `patient-portal` into sections/tabs | Medium | High | Med (do in a worktree) |
| 5 | Unify `data/`↔`lib/data/`, consolidate `lib/clinical*` | Low | Medium | Low |
| 6 | Adopt `ChartCard`/`Badge`/`statusTone`; add `docs/CODE-ORGANIZATION.md` | Low | Medium | Very low |

**Suggested order:** 3 → 1 → 2 → 6 → 5 → 4. Start with barrels + docs (safe, immediate clarity), then the two factories (the real structural win), then the page splits.

Each item is behavior-preserving and can be verified with `npx tsc --noEmit`. I'd take them one at a time, tsc-green between each — happy to start on #1 (the hook factory, migrating the five biggest hooks first as a proof) whenever you want.
