# TamamHealth — Production Readiness Audit

_Audit date: June 2026. Scope: platform (Next.js EMR), website, mobile, sync pipeline.
Method: static review with the file tools. The workspace shell was unavailable this
session, so `npm run build` / `npm test` could not be executed here — see P0-1._

## Executive summary

The codebase is **mature and production-conscious**, not a prototype. It already has:
error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`), no silent
`catch {}` swallowing, HMAC-signed CouchDB→Postgres sync, JWT auth with httpOnly cookies
and a token revocation list, RBAC enforced at four layers, an offline-first PouchDB↔CouchDB
design, a real Jest suite, and CI/CD (`ci.yml` runs lint + `tsc` + tests + build for
platform/website/mobile; plus staging/production deploy and nightly backup workflows).

The remaining work to be "deployment ready" is mostly **verification and operational
configuration**, plus a short list of hardening items below — not large feature gaps.

## Verified solid (no action needed)

- **Error handling**: 0 empty catch blocks across `src`. Global + route error boundaries present.
- **Sync coverage**: every facility database reaches national Postgres or is a documented
  exclusion (guarded by `__tests__/integration/national-sync-coverage.test.ts`).
- **Security**: sync webhook uses HMAC-SHA256 (timing-safe compare); auth uses httpOnly
  JWT + CSRF cookies + revocation list; XSS sanitization is unit-tested.
- **RBAC**: route table, nav, capability hook, and per-endpoint `READ/WRITE/CREATE_ROLES`
  arrays are consistent (136 permission/middleware tests).
- **Ops**: CI gates on build+tests; deploy-staging / deploy-production / backups workflows exist.

## Findings & backlog (by priority)

### P0 — must clear before deploy

- **P0-1 Run the full verification gate.** This session changed RBAC, branding, the green
  theme, the login rewrite, and added tests, but could not run `tsc`/tests/build locally.
  Action: push to a branch and let `ci.yml` run, or run locally:
  `cd platform && npm run lint && npx tsc --noEmit && npm run test:ci && npm run build`
  (repeat for `website`; `lint` + `tsc` for `mobile`). Do not deploy on a red pipeline.
- **P0-2 Confirm required runtime secrets/env are set** in staging & prod:
  platform — `JWT_SECRET`, `DATABASE_URL`, `COUCHDB_WEBHOOK_SECRET` (≥32 chars),
  `NEXT_PUBLIC_SYNC_ENABLED=true`, `NEXT_PUBLIC_COUCHDB_URL`;
  sync-worker — `COUCHDB_URL`, `COUCHDB_WEBHOOK_SECRET`, `PLATFORM_SYNC_URL`.
  Without these, facility data collects locally but never reaches the national level.
- **P0-3 Apply database migrations** before first traffic (`platform/src/lib/db/migrate.ts`
  + `*.sql`). The sync route returns 503 on `undefined_table` — a sign migrations lag.

### P1 — strongly recommended

- **P1-1 Smoke-test the new surfaces end-to-end** once built: login (new green adaptive
  page + per-role personalization + demo accounts incl. midwife/cashier/county), the three
  new roles' dashboards and permissions, and the green theme in light & dark mode.
- **P1-2 Patient-portal login rate limiting is process-local** (`api/patient-portal/login/route.ts`
  TODO). On multi-instance deployments this lets attackers spread attempts across pods.
  Action: back it with CouchDB/Redis (shared store) before exposing the portal publicly.
- **P1-3 National sync health visibility.** `GET /api/sync` already returns last-seq per DB.
  Add a superintendent/admin view so a facility can confirm its data reached national.
  (Offered; not yet built — would touch nav + a new page + RBAC route entry.)
- **P1-4 `/api/health` probe** — ADDED this session (`api/health/route.ts`). Wire it into
  the orchestrator's liveness/readiness probes and the deploy smoke check.

### P2 — hardening / polish

- **P2-1 i18n completeness.** Locale files exist for en, ar, fr, pt, am, so, sw, ha, din,
  nus, apd. Verify non-English locales aren't English fallbacks for key clinical flows
  (consult, prescribe, vital events) before claiming multi-language support.
- **P2-2 Payments/portal bank-transfer details are hardcoded** (`payments/portal/page.tsx`
  TODO) — source from the org settings doc so each org shows its own account.
- **P2-3 Mobile native `icon.png`** is still the old raster; regenerate from the new dot
  mark (the in-app `TamamHealthLogo` component and splash colors are already updated).
- **P2-4 Login casing affordance** — the new login derives a default landing per role; if a
  user is created with a role lacking a dashboard page, confirm `getDefaultDashboard`
  fallback (`/dashboard`) renders for them.

### P3 — nice to have

- **P3-1 Remove/relevel stray `console.log`** in client paths (most are legitimate
  server/infra logging; audit `lib/services/receipt-service.ts` for client reachability).
- **P3-2 Add an `/offline` route** for a friendlier offline shell (PWA already offline-first).

## Changes made this session

- Removed a raw `alert()` + `window.__lastLoginError` leak from the login error path in
  `lib/context.tsx` (diagnostics now go only to console + Sentry; the form shows a friendly message).
- Added `GET /api/health` readiness/liveness probe (`api/health/route.ts`).
- Added the national-sync coverage guard test (prior task).

## Deploy checklist (condensed)

1. Green CI (lint + tsc + tests + build) on platform, website, mobile. [P0-1]
2. Secrets/env present in target environment. [P0-2]
3. Migrations applied; `GET /api/health` returns `database: "ok"`. [P0-3, P1-4]
4. sync-worker running; `GET /api/sync` shows recent `last_synced_at` per DB.
5. Manual smoke test of auth, one clinical flow, one vital-event, and a national dashboard.
6. Rollback plan confirmed (deploy-production workflow + nightly backups).
