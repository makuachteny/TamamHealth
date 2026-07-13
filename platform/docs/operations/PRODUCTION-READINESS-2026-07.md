# TamamHealth — Production Readiness Audit & Remediation (2026‑07‑10)

Whole‑codebase audit for production launch: all ~26 user roles, 74 API routes, 81 services.
Method: automated gates (build/typecheck/lint/tests) + four parallel audits — security/PHI,
API‑authorization sweep, production‑hygiene sweep, and a live per‑role smoke test of the running app.

## Verdict

**Launch‑blocking defects found and fixed: 2 CRITICAL, 5 HIGH, plus PHI‑in‑logs and a fabricated‑data
bug.** After the fixes, all gates are green and the app drives cleanly for every role. A short
operational checklist (below) must be completed at deploy time — none of it is a code change.

## Gates (all green after fixes)

| Gate | Result |
|---|---|
| `npm run build` (NODE_ENV=production, JWT_SECRET set) | ✅ pass |
| `tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors (warnings only, pre‑existing react‑compiler notices) |
| `npm test` | ✅ 93 suites / 1767 tests pass |
| Live per‑role smoke test (22 roles) | ✅ every role lands on its dashboard; **0 broken pages, 0 console/page errors** |

Note: the production build **correctly refuses to start without `JWT_SECRET`** — this is a security
guardrail, not a defect. Build with the env var set.

## CRITICAL — fixed

**C1. `/api/demo-credentials` disclosed a working admin password in production → unauthenticated PHI breach.**
The route is public and CSRF‑exempt (the browser demo‑seed needs it on first boot). Even with
`NEXT_PUBLIC_DEMO_MODE=false` it returned `{username:'admin', password:<plaintext>}`, and that
password logs in as a `government`/`super_admin`‑class account with nationwide read access.
Anyone on the internet could `GET /api/demo-credentials` → `POST /api/auth/login` → read every
patient record. **Fix:** in production the route now discloses **no** passwords (`{profiles: []}`);
the operator reads the bootstrap password from `.seed-credentials.json` (mode 0600) or the console.
`src/app/api/demo-credentials/route.ts`

**C2. `/api/users` privilege escalation — an org_admin could mint a `super_admin`.**
The create/update handlers constrained an org_admin to their own `orgId` but never constrained the
**role** they could assign. A tenant admin could create (or self‑promote to) `super_admin` /
`government`, which bypasses org scoping → full cross‑tenant PHI breach. **Fix:** added
`assignableRoleError()` — only a `super_admin` may grant platform/national roles
(`super_admin`, `government`, `county_health_director`); enforced on both create and update.
`src/app/api/users/route.ts`

## HIGH — cross‑tenant IDORs, fixed

All four broke the otherwise‑consistent `filterByScope` tenant‑isolation model used by every healthy
list route. Each now loads the record and runs `filterByScope([doc], buildScopeFromAuth(auth))`
(super_admin/government exempt) before returning or mutating.

- **H1. `/api/triage` GET** returned every tenant's triage records (names, complaints, vitals) — no scope filter. `src/app/api/triage/route.ts`
- **H2. `/api/transfers?patientId=` GET** assembled a patient's **entire chart** (demographics + all records + labs + attachments) for any `patientId` with no scope check — the highest‑yield read IDOR. Now 404/403 before assembling. `src/app/api/transfers/route.ts`
- **H3. `/api/lab/[id]` PATCH** let any tenant edit another org's lab result by id and read back its **decrypted** value + clinical notes. Added `getLabResultById` + scope guard. `src/app/api/lab/[id]/route.ts`, `src/lib/services/lab-service.ts`
- **H4. `/api/prescriptions/[id]` PATCH** let any tenant dispense/rewrite another org's prescription (diversion risk). Added `getPrescriptionById` + scope guard. `src/app/api/prescriptions/[id]/route.ts`, `src/lib/services/prescription-service.ts`
- **H5. `/api/medical-records/[id]` PATCH/DELETE** guard was org‑only and skipped when `orgId` was absent (legacy records) — replaced with `filterByScope` (matches the read path; also enforces facility scope). `src/app/api/medical-records/[id]/route.ts`

## Other correctness / safety fixes

- **Eligibility endpoint fabricated "verified" coverage.** `/api/eligibility` ignored its inputs and
  returned a hardcoded `status:'verified'` with invented copay/coinsurance figures on a live,
  RBAC‑gated path — a clinician/biller would treat fake data as confirmed payer coverage. Now returns
  an honest `pending` ("automated payer verification not configured — confirm manually") with no
  fabricated financials, until a real payer EDI connector exists. `src/app/api/eligibility/route.ts`
- **PHI/PII removed from server logs.** Payment webhooks (M‑Pesa, Airtel, Flutterwave), eligibility,
  and payment‑link routes were `console.log`‑ing phone numbers, customer emails, amounts, and
  patient IDs to stdout. Logs now carry only opaque transaction correlators.
- **Receipt email reported false success.** With no `EMAIL_PROVIDER` configured, the route printed to
  stdout (including recipient email) and returned `delivered:true`. Now: production reports honest
  non‑delivery; dev keeps a PII‑free preview.
- **JWT‑secret footgun hardened.** `NEXT_PUBLIC_JWT_SECRET` is inlined into client JS; if used as the
  signing secret it would let anyone forge tokens. The app now **refuses to start in production if
  `NEXT_PUBLIC_JWT_SECRET` is set**, and `.env.example` was corrected to use the server‑only
  `JWT_SECRET`. `src/lib/auth-token.ts`, `.env.example`

## What is already strong (verified, no change needed)

- Auth model: JWT verification, bcrypt‑12, live deactivation check, tenant kill‑switch, Origin+HMAC
  CSRF gate, `getAuthPayload` fails closed in production.
- Security headers: CSP, HSTS (2y, preload), `X-Frame-Options: DENY`, `nosniff`, Referrer/Permissions
  policies. No `ignoreBuildErrors`/`ignoreDuringBuilds` — the passing build is meaningful.
- Secret hygiene: `.env.local` gitignored; only `.example` templates committed (no real secrets).
- The large majority of list/read routes correctly use `filterByScope`; patient‑portal routes scope
  every query to the authenticated patient.
- No `eval`, no user‑input `dangerouslySetInnerHTML`, security‑relevant randomness uses
  `crypto`/uuid.

## Launch checklist — operational (must do at deploy; not code)

1. **Set `JWT_SECRET`** (≥32 bytes, `openssl rand -hex 32`). Do **not** set `NEXT_PUBLIC_JWT_SECRET`.
2. **Set `NEXT_PUBLIC_DEMO_MODE=false`** and `NEXT_PUBLIC_SYNC_ENABLED=false` (per `.env.production.example`).
   This also fails‑closes the patient‑portal demo fallback (which otherwise serves fabricated PHI on a DB error).
3. **Set `ADMIN_INITIAL_PASSWORD`** to a strong value and force a change on first admin login; retrieve
   it from the server, never over HTTP.
4. **Set webhook HMAC secrets** (`MPESA_WEBHOOK_SECRET`, `AIRTEL_WEBHOOK_SECRET`, Flutterwave) —
   signature verification is **skipped when `NODE_ENV !== 'production'`**, so ensure no internet‑facing
   staging runs in non‑production mode.
5. **Set `EMAIL_PROVIDER`** (sendgrid/resend/smtp) or accept that emailed receipts will report
   non‑delivery.
6. **Serverless caveat:** login rate‑limiting and token revocation are process‑local
   (`src/app/api/auth/login/route.ts`, `src/lib/token-blacklist.ts`). On multi‑instance/serverless
   hosting move both to a shared store (Redis) or a logout/rate‑limit won't hold across instances.

## Recommended follow‑ups (not launch‑blocking)

- **Write‑side tenant stamping (13 routes).** POST handlers use `if (!body.orgId && auth.orgId)
  body.orgId = auth.orgId` — this only stamps when the client omits `orgId` and does not reject a
  client‑supplied **foreign** `orgId`, letting an authenticated user inject a doc into another tenant.
  Make the auth‑derived tenant authoritative (overwrite, not default) for non‑super_admin across
  anc/appointments/billing/births/facility‑assessments/follow‑ups/hospitals/immunizations/lab/
  medical‑records/patients/prescriptions/referrals.
- **`/api/mpi/match`** returns full patient docs across organizations. If cross‑org MPI is intended,
  return only match metadata (id + confidence), not the full PHI record, and gate to a higher‑trust role.
- **Backfill `orgId`** on legacy patient/lab/record/prescription documents so tenant scoping is exact
  (today, `orgId`‑less docs are consistently *excluded* by scoped routes — safe, but they become
  invisible to the API surface).
- **CSP** keeps `'unsafe-inline'` in `script-src` in production (Next.js inline bootstrap). Consider
  nonce‑based CSP to close the residual XSS surface.
- **Receipt‑email catch block** still returns `success:true` ("queued for retry") on a real provider
  error though no retry queue exists — make honest or build the queue.
