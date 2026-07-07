# Tamam Health — Production Security & Operations Runbook

**Deployment model:** centrally hosted SaaS (the operator runs the servers; facilities connect over the internet).
**Audience:** the platform operator / SRE team.
**Goal:** launch securely, keep operational control after launch, and protect patient data (PHI).

This runbook is the single source of truth for going from "code is ready" to
"running in production safely." It complements the security notes in
`docs/security/*` (CSRF, rate-limiting, token revocation, audit logging) and the
monitoring guide in `docs/operations/monitoring.md`.

---

## 1. Pre-launch security checklist

Boot is **refused** in production (`NODE_ENV=production`) when any of these are
missing or weak — the rules live in `src/lib/config-validation.ts` and run from
`src/instrumentation.ts`. Set every one before deploying:

- [ ] `NEXT_PUBLIC_DEMO_MODE=false` — disables seed data + the demo-credentials endpoint.
- [ ] `JWT_SECRET` — `openssl rand -base64 48` (≥32 chars, no placeholder).
- [ ] `ADMIN_INITIAL_PASSWORD` — set, or read the auto-generated value from `platform/.seed-credentials.json` after first boot. No placeholder.
- [ ] `NEXT_PUBLIC_ADMIN_PASSWORD` — **must be unset** (it would bundle into client JS).
- [ ] `DATABASE_URL` — Postgres for national analytics (migrations run at boot).
- [ ] HTTPS terminated in front of the app (required for `Secure` cookies + HSTS/CSP).
- [ ] `COUCHDB_WEBHOOK_SECRET` + `NEXT_PUBLIC_COUCHDB_URL` if `NEXT_PUBLIC_SYNC_ENABLED=true`.
- [ ] `SENTRY_DSN` (recommended) for 5xx triage — PHI is scrubbed before transport.
- [ ] `PHI_ENCRYPTION_KEY` (`openssl rand -base64 32`) if `PHI_ENCRYPTION_ENABLED=true`.

Secrets live in your secrets manager (Doppler is wired via `DOPPLER_TOKEN`; AWS
Secrets Manager / SSM also work). Never commit them; `.env*` files are gitignored.

---

## 2. Keeping control after launch

### 2.1 Tenant kill-switch (suspend / revoke a deployment)

Each tenant is an **organization** (`OrganizationDoc`). Its access state is
enforced on **every authenticated API request** by `getAuthPayload`
(`src/lib/api-auth.ts`) via `tenant-control-service.ts`. To revoke access after
launch, set any of these on the org — it takes effect on the org's **next
request**, no redeploy:

| Field | Effect |
|---|---|
| `subscriptionStatus = 'suspended'` | Immediate denial (reversible). |
| `subscriptionStatus = 'cancelled'` | Immediate denial (terminal). |
| `isActive = false` | Immediate denial. |
| `accessExpiresAt = <past ISO date>` | Hard expiry — denies after the date. |

Set these from the **Admin → Organizations** screen (super-admin). Platform
operators (`super_admin`) are exempt from the check, so you can always lift a
suspension. The control **fails open** on a transient DB read error (a live
clinic is never bricked by an outage) and **fails closed** only on an explicit
operator action.

### 2.2 Token revocation (per user / per session)

`docs/security/token-revocation.md` — logout and admin deactivation revoke a
user's JWT. Deactivating a user (`isActive=false`) is enforced on every request
in the same gate as the tenant check.

### 2.3 Usage telemetry / monitoring

- **Errors / performance:** Sentry (`SENTRY_DSN`), PHI-scrubbed. Thresholds and
  PagerDuty wiring in `docs/operations/monitoring.md`.
- **Liveness:** `GET /api/health`.
- **Per-tenant usage:** Admin → Organizations + `getOrganizationStats(orgId)`
  (user counts, hospitals, activity); national analytics dashboards aggregate
  cross-org once `DATABASE_URL` is set.

### 2.4 Controlled updates / patches

- Ship only signed, tagged releases; pin the container image by digest, not a
  floating tag.
- Postgres migrations are applied at boot under an advisory lock
  (`src/lib/db/migrate.ts`) so rolling replicas can't race; an out-of-order or
  edited migration refuses to start.
- Set `SENTRY_RELEASE=$(git rev-parse --short HEAD)` so errors group by build and
  you can confirm exactly what each tenant is running.
- Roll back by redeploying the previous image digest; migrations are
  forward-only, so test schema changes on staging first.

---

## 3. Protecting the data

### 3.1 Encryption in transit
- HTTPS everywhere (HSTS + secure cookies + CSP are set in `next.config.mjs`).
- CouchDB replication uses the public HTTPS endpoint (`NEXT_PUBLIC_COUCHDB_URL`);
  the server reaches CouchDB over the internal network only.

### 3.2 Encryption at rest
1. **Infrastructure (baseline, required):** enable disk/volume encryption on
   every node that stores data — Postgres volume, CouchDB volume, and backups
   (e.g. LUKS, or your cloud's encrypted EBS/PD + encrypted snapshots).
2. **Field-level (defence-in-depth, optional):** set `PHI_ENCRYPTION_ENABLED=true`
   + `PHI_ENCRYPTION_KEY` to encrypt the most sensitive fields with AES-256-GCM
   (`src/lib/field-encryption.ts`). Ciphertext is self-describing
   (`enc:v1:…`), idempotent, and reads tolerate not-yet-migrated plaintext, so
   you can roll it out gradually. Keep the key in the secrets manager — losing it
   means losing the encrypted data.

### 3.3 Access control & isolation (already enforced)
- **Org scoping:** every record carries `orgId`; reads/writes are scoped
  (`data-scope.ts`) and CouchDB enforces it server-side via a
  `validate_doc_update` design doc (`scripts/setup-couchdb.sh`).
- **Role-based routing & API authz:** `role-routes.ts` + per-route role checks.
- **Audit trail:** `audit-service.ts` logs auth, PHI access, signing, allergy /
  directive / consent / billing changes (`docs/security/audit-logging.md`).
- **CSRF + rate limiting:** `docs/security/csrf.md`, `docs/security/rate-limiting.md`.

### 3.4 Backups & recovery
Automate and **test restores quarterly** — an untested backup is not a backup.

- **Postgres (analytics):**
  `pg_dump "$DATABASE_URL" | gzip > backup-$(date +%F).sql.gz`, encrypted and
  shipped off-site daily; verify with a periodic restore into a scratch DB.
- **CouchDB (clinical sync store):** snapshot the data volume, or replicate to a
  backup CouchDB; CouchDB databases are append-friendly. Encrypt snapshots.
- **Retention:** keep ≥30 daily + ≥12 monthly; store in a separate
  account/region from production.
- **Restore drill:** stand up the latest backups on a staging stack, boot the
  app, confirm login + a patient chart loads. Document the wall-clock RTO.

### 3.5 Data residency / deletion
- All clinical data stays within the org's tenant scope; cross-org reads are
  impossible through the API (org scope) and the CouchDB validator.
- For a tenant offboard: suspend (§2.1), export their data (org-scoped), then
  purge their `orgId` records and snapshots per your data-retention agreement.

---

## 4. Incident response (summary)
1. **Contain:** suspend the affected tenant (§2.1) and/or revoke compromised
   user tokens. Rotate `JWT_SECRET` to invalidate all sessions if needed.
2. **Assess:** pull the audit log + Sentry timeline for the window.
3. **Eradicate / recover:** patch, redeploy a signed image, restore from backup
   if data integrity is in doubt.
4. **Postmortem:** blameless write-up; feed fixes back into this runbook.

---

## 5. Quick reference — required production env

```bash
NODE_ENV=production
NEXT_PUBLIC_DEMO_MODE=false
JWT_SECRET=$(openssl rand -base64 48)
DATABASE_URL=postgresql://…
# HTTPS terminated upstream; secure cookies + CSP on
# Optional but recommended:
SENTRY_DSN=…
# Optional field encryption at rest:
# PHI_ENCRYPTION_ENABLED=true
# PHI_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

Boot will refuse to start until the required values are present and non-placeholder.
