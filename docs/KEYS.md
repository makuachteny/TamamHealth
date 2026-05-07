# SafeguardJunub / TamamHealth — API Keys & Database Credentials

> **NEVER commit real credentials to git.** All secrets go in `.env.local` (gitignored).
> This document describes what each credential is, where it's used, and how to configure it.

---

## Quick Setup

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

---

## Environment Variables Reference

### Client-Side (Public — exposed to browser)

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `NEXT_PUBLIC_SYNC_ENABLED` | Enable PouchDB ↔ CouchDB replication | `false` | No |
| `NEXT_PUBLIC_COUCHDB_URL` | CouchDB server URL (with credentials for auth) | `http://localhost:5984` | Only if sync enabled |

### Server-Side (Private — never sent to browser)

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://tamamhealth:password@localhost:5432/safeguard_junub` | For national analytics |
| `JWT_SECRET` | Secret key for signing session JWTs | Hardcoded fallback (INSECURE) | **Yes for production** |
| `COUCHDB_ADMIN_USER` | CouchDB admin username | `admin` | For setup script |
| `COUCHDB_ADMIN_PASSWORD` | CouchDB admin password | (empty) | For setup script & sync webhook |

---

## Credential Details

### 1. JWT Authentication Secret

- **Variable:** `JWT_SECRET`
- **Used in:** `src/lib/auth-token.ts`
- **Algorithm:** HS256 (HMAC SHA256)
- **Token lifetime:** 24 hours
- **Cookie name:** `tamamhealth-token` (HTTP-only, SameSite=lax)
- **Fallback secret:** `tamamhealth-south-sudan-health-2026-secret-key` (development only — **NEVER use in production**)

**Generate a secure secret:**
```bash
openssl rand -base64 64
```

### 2. PostgreSQL (National Analytics Database)

- **Variable:** `DATABASE_URL`
- **Format:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
- **Used in:** `src/lib/db/postgres.ts` (server-side API routes only)
- **Pool settings:** Max 10 connections, 30s idle timeout, SSL in production

| Parameter | Development | Production |
|-----------|-------------|------------|
| User | `tamamhealth` | Use a dedicated service account |
| Password | `password` | Strong random password |
| Host | `localhost` | Your PostgreSQL server |
| Port | `5432` | `5432` (default) |
| Database | `safeguard_junub` | `safeguard_junub` |
| SSL | Disabled | Enabled |

**Initialize the schema:**
```bash
psql $DATABASE_URL < src/lib/db/schema.sql
```

### 3. CouchDB (Regional Sync Server)

- **Variable:** `NEXT_PUBLIC_COUCHDB_URL`
- **Used in:** `src/lib/db.ts` (getRemoteDB), `src/lib/sync/` (sync layer)
- **Note:** This URL is public (sent to browser). Use CouchDB's built-in auth or a proxy.

| Parameter | Development | Production |
|-----------|-------------|------------|
| URL | `http://localhost:5984` | `https://couchdb.yourdomain.com` |
| Admin user | `admin` | Dedicated admin account |
| Admin password | (your choice) | Strong random password |

**Setup CouchDB:**
```bash
COUCHDB_URL=http://admin:yourpassword@localhost:5984 ./scripts/setup-couchdb.sh
```

### 4. Sync Webhook Authentication

- **Endpoint:** `POST /api/sync`
- **Auth header:** `Authorization: Bearer {COUCHDB_ADMIN_PASSWORD}`
- **Purpose:** CouchDB change notifications → PostgreSQL upserts
- **Used by:** CouchDB `_changes` feed worker or external trigger

### 5. Password Hashing

- **Library:** `bcryptjs` v3.0.3
- **Rounds:** 12
- **Location:** `src/lib/auth.ts`
- **Storage:** User passwords are stored as bcrypt hashes in PouchDB/CouchDB under the `passwordHash` field
- **No additional credentials needed** — bcrypt is self-contained

---

## Security Configuration

### Login Rate Limiting

- **Max attempts:** 5 failed logins
- **Lockout duration:** 15 minutes
- **Protection:** Constant-time password comparison, generic error messages (no username enumeration)

### Route Protection (Middleware)

- **Cookie:** `tamamhealth-token` (JWT)
- **Protected:** All routes except `/`, `/api/auth/*`, static assets
- **RBAC:** Role-based access enforced per route in `src/middleware.ts`

### Content Security Policy

- CouchDB URL is dynamically added to `connect-src` in `next.config.mjs`
- `frame-ancestors: 'none'` prevents clickjacking
- HSTS enabled with 2-year max-age

---

## Database Architecture

```
Browser (each hospital)         Regional Server              National Server
+-------------------+          +------------------+         +------------------+
|                   |          |                  |         |                  |
|   PouchDB         |  sync   |   CouchDB        |  POST   |   PostgreSQL     |
|   (IndexedDB)     | <-----> |   (document DB)  | ------> |   (analytics)    |
|                   |          |                  |  /api/  |                  |
+-------------------+          +------------------+  sync   +------------------+
  No credentials needed         COUCHDB_URL                   DATABASE_URL
                                COUCHDB_ADMIN_*               JWT_SECRET
```

### PouchDB Databases (20 total)

| Database | Sync Direction | Org-Scoped |
|----------|---------------|------------|
| `tamamhealth_patients` | Both | Yes |
| `tamamhealth_medical_records` | Both | Yes |
| `tamamhealth_referrals` | Both | Yes |
| `tamamhealth_lab_results` | Both | Yes |
| `tamamhealth_prescriptions` | Both | Yes |
| `tamamhealth_disease_alerts` | Both | No (national) |
| `tamamhealth_messages` | Both | Yes |
| `tamamhealth_births` | Both | Yes |
| `tamamhealth_deaths` | Both | Yes |
| `tamamhealth_facility_assessments` | Both | Yes |
| `tamamhealth_immunizations` | Both | Yes |
| `tamamhealth_anc` | Both | Yes |
| `tamamhealth_boma_visits` | Both | Yes |
| `tamamhealth_follow_ups` | Both | Yes |
| `tamamhealth_hospitals` | Both | Yes |
| `tamamhealth_users` | Pull only | Yes |
| `tamamhealth_organizations` | Pull only | No |
| `tamamhealth_platform_config` | Pull only | No |
| `tamamhealth_audit_log` | Push only | Yes |
| `tamamhealth_meta` | Local only | N/A |

---

## Production Checklist

- [ ] Generate a strong `JWT_SECRET` (64+ characters)
- [ ] Set up PostgreSQL with a dedicated user and strong password
- [ ] Set up CouchDB with admin credentials and TLS
- [ ] Set `NEXT_PUBLIC_COUCHDB_URL` to the production CouchDB URL (HTTPS)
- [ ] Set `NEXT_PUBLIC_SYNC_ENABLED=true`
- [ ] Run `scripts/setup-couchdb.sh` to create databases and design docs
- [ ] Run `psql $DATABASE_URL < src/lib/db/schema.sql` to initialize PostgreSQL
- [ ] Restrict CORS origins in CouchDB to your domain only
- [ ] Enable PostgreSQL SSL (`ssl: { rejectUnauthorized: true }` with proper certs)
- [ ] Set up the CouchDB → PostgreSQL sync worker (calls `POST /api/sync`)
- [ ] Verify `.env.local` is in `.gitignore` (it is by default)
