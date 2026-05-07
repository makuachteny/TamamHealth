# TamamHealth — Live Demo Runbook

A one-page guide for walking a stakeholder through the running stack. Covers startup, the clinician flow, the patient flow, and the architecture talking points.

---

## 1. Start the stack

```bash
cd /Users/makuachtenygatluak/TamamHealth

# Optional: free the ports first
lsof -ti:3000 -ti:3001 -ti:5984 2>/dev/null | xargs kill -9 2>/dev/null
docker compose down 2>/dev/null

# Start everything
docker compose up -d

# Wait ~15 seconds, then verify
docker compose ps
#   Expect 4 services healthy: platform, website, couchdb, couchdb-backup
```

Then open three browser tabs:

| Tab | URL | What it is |
|---|---|---|
| 1 | http://localhost:3001 | Marketing site |
| 2 | http://localhost:3000/login | Clinician login |
| 3 | http://localhost:3000/patient-portal | Patient portal |

---

## 2. Clinician demo (Tab 2)

**Talking point**: *"This is how a nurse or doctor signs in on a shared tablet in a ward."*

1. On `/login`, click any **Demo Account** row below the form. The username, password, and hospital prefill automatically.
2. Click **Staff Sign In**.
3. First-time browser visit: the platform seeds 40 patients + 18 users + sample labs/prescriptions into local PouchDB (takes ~2 seconds). Watch the sync status indicator in the top-right.

### Recommended demo personas

| Show this for… | Click the demo row | Role |
|---|---|---|
| Front-line clinical workflow | **Doctor** (`dr.wani`) | doctor |
| Nursing workflow | **Nurse** (`nurse.stella`) | nurse |
| Pharmacy dispensing | **Pharmacist** (`pharma.rose`) | pharmacist |
| Lab order management | **Lab Tech** (`lab.gatluak`) | lab_tech |
| Community / outreach | **Boma Health Worker** (`bhw.akol`) | boma_health_worker |
| Hospital administration | **Med. Superintendent** (`supt.lado`) | medical_superintendent |
| Platform admin | **Super Admin** (`superadmin`) | super_admin |
| National oversight | **Government** (`admin`) | government |

### 3-minute clinician tour

1. **Patient list** (`/patients`) — 40 seeded patients, live search
2. Click any patient — **detail page** with vitals, allergies, history, timeline
3. **New consultation** (`/consultation`) — write a note, prescribe, order a lab
4. **Offline demo** — in DevTools → Network → Offline. Click around, add a note. Everything still works.
5. Flip back online — **sync indicator** turns green; edits replicate to CouchDB.
6. **Reports** (`/reports`) — facility KPIs, national rollup

### Admin tour (as `superadmin`)

- `/admin` — org overview
- `/admin/users` — user management
- `/admin/system` — platform config
- `/admin/conflicts` — sync-conflict reconciliation queue (Phase 1 deliverable)

---

## 3. Patient portal demo (Tab 3)

**Talking point**: *"This is what a patient sees on their phone."*

1. On `/patient-portal`, wait ~2 seconds for the demo panel to populate (reads the seed data).
2. Click any demo patient row — prefills Hospital ID and phone.
3. Click **Patient Sign In**.
4. Patient dashboard loads with their visits, labs, meds, messages.

### Seeded demo patient you can talk through

- **Deng Mabior Garang** — `JTH-000001` / `+211912345001`
- Has a medical record (routine follow-up), a lab result (FBC — normal), and an active prescription (Paracetamol)
- Patient sees them all in their portal

---

## 4. Architecture talking points (for the Q&A)

While clicking around, these are the one-liners:

- **Offline-first**: every write commits to PouchDB locally before any remote call. Clinic can work through a 6-hour power + network outage; syncs when connectivity returns.
- **Federated, not centralized**: facility runs locally. Country node aggregates. Regional exchange only handles cross-border continuity. Matches ministry sovereignty expectations.
- **Standards-based**:
  - `GET https://localhost:3000/api/fhir/metadata` — FHIR R4 CapabilityStatement (public, no auth)
  - `GET /api/fhir/Patient/:id` — FHIR Patient resource
  - `GET /api/fhir/Bundle/referral/:id` — cross-facility referral packet
  - DHIS2 adapter: `POST /api/admin/dhis2-push` aggregates facility data and posts to the national DHIS2 server.
- **Audit + reconciliation**:
  - Every clinical mutation emits a `sync_event` with the facility, operation, and version
  - `GET /api/admin/sync-health` shows outbox backlog + per-facility last-contact
  - Conflicts on high-risk fields (allergies, referrals) land in a human reconciliation queue rather than silent-merging
- **Security**: JWT with boot-time secret validation, RBAC on every route, CSRF Origin check, HSTS, strict CSP, nightly CouchDB backups in a sidecar.

### Live curl demos (copy-paste)

```bash
# Unauthenticated FHIR capability discovery
curl -s http://localhost:3000/api/fhir/metadata | jq '.fhirVersion, .rest[0].resource[].type'

# Country profile (mocked catalog: SS / KE / UG)
curl -s "http://localhost:3000/api/country/metadata?country=SS" | jq '{name, dhis2, facilityLevels: [.facilityLevels[].code]}'

# Authenticated: sign in + list patients
curl -sc /tmp/jar.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -d '{"username":"superadmin","password":"Super@TamamHealth2026!"}'
curl -sb /tmp/jar.txt http://localhost:3000/api/patients | jq '{total, first: .patients[0] | {name: (.firstName + " " + .surname), hospitalNumber}}'

# MPI patient matcher (fuzzy search)
curl -sb /tmp/jar.txt -X POST http://localhost:3000/api/mpi/match \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -d '{"firstName":"Deng","surname":"Garan","dateOfBirth":"1985-03-12"}' \
  | jq '.candidates[0] | {score, method, name: (.patient.firstName + " " + .patient.surname)}'

# Admin: sync health + conflict queue
curl -sb /tmp/jar.txt http://localhost:3000/api/admin/sync-health | jq '.outbox, .perFacilityLast24h'
curl -sb /tmp/jar.txt http://localhost:3000/api/admin/conflicts | jq '.total'
```

---

## 5. If something goes wrong during the demo

| Symptom | Fix |
|---|---|
| Dashboard empty after sign-in | Hard-refresh (Cmd+Shift+R). The `SEED_VERSION=25` bump triggers a one-time re-seed. |
| Platform container unhealthy | `docker compose logs platform \| tail -40` — look for a startup error (usually env config) |
| CouchDB not responding | `docker compose restart couchdb` then wait 15s |
| Ports already in use on 3000/3001/5984 | `lsof -ti:3000 -ti:3001 -ti:5984 \| xargs kill -9`; `docker compose up -d` |
| Demo accounts panel not visible | `NEXT_PUBLIC_DEMO_MODE` must be `true` in `platform/.env.production`. Currently it is. |
| Fresh slate / reset demo | `docker compose down -v && docker compose up -d` (deletes CouchDB volume — seed content will need to be recreated) |

---

## 6. Production deploy (when it's time)

Everything is in [`deploy.sh`](deploy.sh). On a fresh Ubuntu 22.04 VPS:

```bash
# Point DNS at your VPS IP first:
#   tamamhealth.org         → VPS
#   app.tamamhealth.org     → VPS
#   couch.tamamhealth.org   → VPS

# Copy your env files up:
scp .env root@VPS:/opt/tamamhealth/
scp platform/.env.production root@VPS:/opt/tamamhealth/platform/
scp website/.env.production root@VPS:/opt/tamamhealth/website/
scp deploy.sh root@VPS:/root/

ssh root@VPS
bash /root/deploy.sh
```

The script installs Docker + Caddy, configures auto-TLS, builds, starts, and prints the live URLs. ~10 minutes end-to-end once DNS has propagated.

Before go-live: **rotate the placeholder secrets** in the three env files (they were generated in this session and should be treated as compromised). `openssl rand -base64 48` for JWT, `openssl rand -base64 24 | tr -d '\n/+='` for passwords.
