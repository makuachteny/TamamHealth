# TAMAMHEALTH - Digital Health Records System for South Sudan

A comprehensive, offline-first healthcare information system built for South Sudan's health sector. TAMAMHEALTH provides electronic medical records, clinical decision support, disease surveillance, vital registration, and government health oversight across all levels of the health system — from community boma health workers to the national Ministry of Health.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Authentication & Roles](#authentication--roles)
- [Modules & Features](#modules--features)
- [AI & Clinical Decision Support](#ai--clinical-decision-support)
- [Data Architecture](#data-architecture)
- [Offline-First Design](#offline-first-design)
- [Multi-Tenancy & Organizations](#multi-tenancy--organizations)
- [Security](#security)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Demo Credentials](#demo-credentials)

---

## Overview

TAMAMHEALTH is purpose-built for the South Sudanese health system, addressing the unique challenges of delivering healthcare across 10 states with limited connectivity, infrastructure, and resources. The system supports:

- **Hospital networks** — Patient registration, consultations, referrals, lab, pharmacy
- **Community health** — Boma health worker household visits, payam supervisor oversight
- **Maternal & child health** — 8-contact ANC protocol (WHO), birth registration, immunization tracking
- **Disease surveillance** — Real-time outbreak alerts, epidemic intelligence
- **Vital registration** — Birth and death CRVS with ICD-11 cause coding
- **Government oversight** — National health statistics, facility assessments, DHIS2 export

The system works entirely offline and syncs when connectivity is available.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| UI | React 18, Tailwind CSS 3.4, Lucide Icons |
| Charts | Recharts 3.7 |
| Mapping | Leaflet + React Leaflet |
| Client Database | PouchDB 9 (browser-side) |
| Server Database | CouchDB (sync), PostgreSQL (analytics) |
| Authentication | JWT (jose), bcryptjs |
| Testing | Jest 30, Testing Library |
| Linting | ESLint, Next.js config |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0 ([download](https://nodejs.org))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git** ([download](https://git-scm.com))
- **PostgreSQL** 12+ (optional, for national analytics)
- **CouchDB** 3+ (optional, for multi-facility sync)

Works on **Windows**, **macOS**, and **Linux**.

### Installation

The platform is distributed as a downloadable archive (`.tar.gz` or `.zip`). Contact [support.tamam@gmail.com](mailto:support.tamam@gmail.com) to obtain a license key and download link.

```bash
# 1. Extract the archive
tar -xzf tamamhealth-platform-<version>.tar.gz    # Linux/macOS
# Or unzip tamamhealth-platform-<version>.zip      # Windows

# 2. Navigate into the folder
cd tamamhealth-platform-<version>

# 3. Run the setup script (verifies license, installs deps, configures env)
npm run setup
```

The setup script will:

- Ask for your **license key** (issued by TamamHealth Health Technologies)
- Install all dependencies
- Generate a secure JWT secret
- Create your `.env.local` configuration file

Then start the server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The app seeds demo data automatically on first load — sample patients, hospitals, users, and health records are created in your browser's local database.

### Demo Credentials

When running in demo mode (default), a random 24-character password is
generated for each seeded user on first server boot and written to
`platform/.seed-credentials.json` (mode `0600`, gitignored). Hardcoded
passwords in this README would have meant every install shipped the same
secrets — the random-per-install design avoids that.

Read the passwords once after the first boot:

```bash
cat platform/.seed-credentials.json
```

Or fetch them at runtime via:

```bash
curl http://localhost:3000/api/demo-credentials
```

Or click any role chip on the login page — it auto-fills the form.

| Username | Role |
|----------|------|
| `superadmin` | Platform Super Admin |
| `admin` | Government Admin (Ministry of Health) |
| `dr.wani` / `dr.achol` | Doctor |
| `co.deng` | Clinical Officer |
| `nurse.stella` | Nurse |
| `lab.gatluak` | Lab Technician |
| `pharma.rose` | Pharmacist |
| `desk.amira` | Front Desk |
| `bhw.akol` | Boma Health Worker |
| `sup.mary` | Payam Supervisor |
| `org.admin` / `dr.mercy` | Private-org accounts (Mercy Hospital) |

The `/api/demo-credentials` endpoint is gated on
`NEXT_PUBLIC_DEMO_MODE !== 'false'` — in production it returns 404.

### Docker Installation

Run the entire stack with Docker Compose:

```bash
docker compose up --build
```

This starts:

- **Platform** on port 3000
- **Website** on port 3001
- **CouchDB** on port 5984

### Optional: PostgreSQL (National Analytics)

PostgreSQL is only needed for government dashboards and cross-facility analytics. The app works fully without it using browser-local PouchDB.

```bash
# 1. Create the database
createdb safeguard_junub

# 2. Set the connection string in .env.local
#    DATABASE_URL=postgresql://user:password@localhost:5432/safeguard_junub

# 3. Apply schema migrations
npm run db:migrate
```

Migrations also run automatically at server boot via Next.js
[`instrumentation.ts`](src/instrumentation.ts), so `npm run db:migrate` is
only needed for ad-hoc operator use (e.g. before swapping container images).
Each `*.sql` file under [`src/lib/db/migrations/`](src/lib/db/migrations/)
runs once and its hash is recorded in the `_migrations` tracking table; edit
an applied migration and the runner refuses to start.

### Data Architecture

The platform uses a **single PouchDB API with two runtime backings** so the same code paths work client-side and server-side:

| Runtime | Package | Backing store | Used for |
|---|---|---|---|
| Browser | `pouchdb-browser` | IndexedDB | Clinician dashboard — offline-first writes, background replication to CouchDB |
| Server (Node) | `pouchdb-core` + `pouchdb-adapter-http` | CouchDB over HTTP | `/api/*` REST routes — mobile apps, integrations, cron jobs |

Both share the same service functions (`patientsDB()`, `medicalRecordsDB()`, etc.), so route handlers don't care which runtime they run in. See [`src/lib/db.ts`](src/lib/db.ts).

**Databases auto-create**: PouchDB's http adapter issues `PUT /<db>` on first access when the admin credentials permit it (they do on a fresh CouchDB install). No manual bootstrap is required — the 40+ `tamamhealth_*` databases appear the first time a service touches them.

### Server-side CouchDB env (required for `/api/*` in production)

```bash
COUCHDB_URL=http://couchdb:5984              # internal network URL
COUCHDB_ADMIN_USER=admin
COUCHDB_ADMIN_PASSWORD=<strong-random>
```

In `docker-compose.yml` these are wired automatically from the root `./.env`; the platform container reaches CouchDB over the internal docker network. This is separate from `NEXT_PUBLIC_COUCHDB_URL`, which is the public HTTPS endpoint the **browser** hits during replication.

### Optional: CouchDB Sync

CouchDB enables multi-device sync across facilities. Without it, the app runs fully offline in the browser.

```bash
# 1. Start CouchDB (via Docker or native install)
docker run -d -p 5984:5984 -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=tamamhealth2026 couchdb:3

# 2. Run the setup script to create databases and configure CORS
COUCHDB_URL=http://admin:tamamhealth2026@localhost:5984 bash scripts/setup-couchdb.sh

# 3. Enable sync in .env.local
#    NEXT_PUBLIC_SYNC_ENABLED=true
#    NEXT_PUBLIC_COUCHDB_URL=http://admin:tamamhealth2026@localhost:5984
```

> **Windows users**: The CouchDB setup script requires bash. Use WSL2, Git Bash, or run CouchDB via Docker.

#### Server-side org-scoping enforcement (validate_doc_update)

`scripts/setup-couchdb.sh` installs a `_design/tamamhealth-org-scope` design doc on every `orgScoped: true` database (or run it standalone with `npm run setup:couchdb:validators`). It is a **one-way migration** — once installed, any client writing a document without a string `orgId` will be rejected and the write won't replicate. Existing docs that are missing `orgId` keep their current state but become unupdateable until backfilled. A syntax error in the `validate_doc_update` function **blocks ALL writes** to the affected database, so always test on staging before running against production.

### Production Deployment

```bash
# Build the production bundle
npm run build

# Start the production server
npm start
```

**Production checklist:**

- [ ] Set `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] Set `JWT_SECRET` to a random 48+ character string
- [ ] Set `DATABASE_URL` to your PostgreSQL instance
- [ ] Set `NEXT_PUBLIC_ADMIN_NAME` (display name; safe to expose)
- [ ] Set `ADMIN_INITIAL_PASSWORD` (server-only) — or leave it unset and
      grab the auto-generated value from `platform/.seed-credentials.json`
- [ ] Configure HTTPS (required for secure cookies and CSP headers)
- [ ] Set `COUCHDB_WEBHOOK_SECRET` if using sync

---

## Project Structure

```text
src/
├── app/
│   ├── (dashboard)/           # Protected dashboard routes (26+ pages)
│   │   ├── page.tsx           # Doctor/clinical officer dashboard
│   │   ├── patients/          # Patient registry & records
│   │   ├── consultation/      # Clinical documentation
│   │   ├── referrals/         # Referral management
│   │   ├── lab/               # Laboratory orders & results
│   │   ├── pharmacy/          # Medication dispensing & inventory
│   │   ├── anc/               # Antenatal care (WHO 8-contact)
│   │   ├── births/            # Birth registration (CRVS)
│   │   ├── deaths/            # Death registration (ICD-11)
│   │   ├── immunizations/     # Vaccination tracking
│   │   ├── surveillance/      # Disease surveillance & alerts
│   │   ├── epidemic-intelligence/  # Outbreak analysis
│   │   ├── hospitals/         # Facility network & mapping
│   │   ├── mch-analytics/     # Maternal & child health analytics
│   │   ├── facility-assessments/   # Facility readiness
│   │   ├── data-quality/      # Data quality monitoring
│   │   ├── vital-statistics/  # Population health metrics
│   │   ├── dhis2-export/      # DHIS2 interoperability
│   │   ├── reports/           # Health system reporting
│   │   ├── messages/          # Doctor-patient messaging
│   │   ├── settings/          # User preferences
│   │   ├── government/        # National health surveillance
│   │   ├── admin/             # Super admin (orgs, users, billing, system)
│   │   ├── org-admin/         # Organization management
│   │   ├── nurse/             # Nurse station dashboard
│   │   ├── lab-dashboard/     # Lab command center
│   │   ├── pharmacy-dashboard/# Pharmacy operations
│   │   ├── front-desk/        # Patient reception
│   │   ├── boma/              # Community health worker dashboard
│   │   └── payam/             # Payam supervisor dashboard
│   ├── api/
│   │   ├── auth/              # Login, logout, session endpoints
│   │   └── sync/              # CouchDB sync API
│   ├── login/                 # Login page
│   └── public-stats/          # Public-facing health statistics
├── components/
│   ├── Sidebar.tsx            # Collapsible navigation sidebar
│   ├── TopBar.tsx             # Page header
│   ├── AssistantChat.tsx      # AI medical assistant chat widget
│   ├── ClinicalScribe.tsx     # AI voice/text clinical note parser
│   ├── SymptomChecker.tsx     # Patient intake symptom form
│   ├── HospitalMap.tsx        # Leaflet facility map
│   └── ...                    # Additional UI components
├── lib/
│   ├── context.tsx            # AppContext & useApp hook
│   ├── db.ts                  # PouchDB database factory
│   ├── db-types.ts            # TypeScript interfaces for all documents
│   ├── db-seed.ts             # Demo data seeding
│   ├── permissions.ts         # Role-based access control
│   ├── auth-token.ts          # JWT token management
│   ├── branding.ts            # Organization branding system
│   ├── hooks/                 # 24 custom React hooks
│   ├── services/              # 25 business logic services
│   ├── sync/                  # PouchDB-CouchDB sync manager
│   └── ai/                    # AI diagnosis engine & assistant
└── data/
    └── mock.ts                # Mock data (hospitals, patients, diseases)
```

---

## Authentication & Roles

### Authentication Flow

1. User submits credentials at `/login`
2. Server validates against bcrypt-hashed password in PouchDB
3. JWT token (24-hour expiry) set as HTTP-only cookie
4. Middleware enforces route-level access per role
5. Rate limiting: 5 failed attempts triggers a 15-minute lockout

### RBAC — 11 User Roles

| Role | Access Level | Primary Dashboard |
|------|-------------|-------------------|
| `super_admin` | Platform-wide administration | `/admin` |
| `org_admin` | Organization management | `/org-admin` |
| `doctor` | Full clinical access | `/dashboard` |
| `clinical_officer` | Clinical provider (paramedical) | `/dashboard` |
| `nurse` | Nursing station | `/dashboard/nurse` |
| `lab_tech` | Laboratory operations | `/dashboard/lab` |
| `pharmacist` | Pharmacy operations | `/dashboard/pharmacy` |
| `front_desk` | Patient reception & registry | `/dashboard/front-desk` |
| `government` | Ministry of Health oversight | `/government` |
| `boma_health_worker` | Community household visits | `/dashboard/boma` |
| `payam_supervisor` | Administrative health unit | `/dashboard/payam`  |

Each role has granular permissions controlling access to modules, data scope, and available actions. Unauthorized routes redirect to the user's default dashboard.

---

## Modules & Features

### Clinical

- **Patient Registry** — Registration, search, filtering by demographics and location. Detailed patient profiles with full medical history.
- **Consultation** — Chief complaint capture, vital signs entry (temperature, BP, O2 saturation, pulse, respiratory rate), physical examination (HEENT, cardiac, respiratory, abdominal, neurological), AI-powered diagnosis suggestions, lab ordering, and prescription writing.
- **Referrals** — Inter-facility patient referral with urgency levels, status tracking (sent, received, accepted, declined, completed), and clinical reason documentation.
- **Laboratory** — Test ordering, sample tracking, result entry with status workflow (ordered, collected, processing, completed). Lab command center dashboard for technicians.
- **Pharmacy** — Prescription queue management, medication dispensing, inventory tracking. Pharmacist operations dashboard.

### Maternal & Child Health

- **Antenatal Care (ANC)** — Full WHO 8-contact protocol. Tracks gravida/parity, vital signs, fetal assessment (heart rate, fundal height), risk stratification, and birth planning.
- **Birth Registration** — CRVS-compliant birth registration with child and parent details, birth weight, delivery method, attendant type, and certificate number.
- **Immunizations** — Vaccination schedule tracking, coverage monitoring, and campaign management.
- **MCH Analytics** — Cascade analysis, mortality tracking, outcomes visualization.

### Public Health

- **Disease Surveillance** — Real-time disease alert system with severity classification, geographic distribution, and trend analysis.
- **Epidemic Intelligence** — Outbreak tracking, cluster detection, and response coordination.
- **Death Registration** — CRVS-compliant death registration with ICD-11 cause of death coding (immediate, antecedent, underlying causes), manner of death classification, and maternal death linkage.
- **Vital Statistics** — Population health metrics and demographic analysis.

### Administration & Reporting

- **Hospital Network** — Facility management with interactive Leaflet map, sync status indicators, performance metrics overlay.
- **Facility Assessments** — Health facility readiness evaluations (infrastructure, staffing, services, equipment).
- **Data Quality** — Completeness and quality monitoring for submitted health data.
- **DHIS2 Export** — Interoperability with the national DHIS2 health information system.
- **Reports** — Configurable health system reporting.
- **Public Statistics** — Public-facing health dashboard (no login required).

### Communication

- **Doctor-Patient Messaging** — In-app messaging between providers and patients with SMS notification support.

### Platform Administration

- **Organization Management** — Create and manage organizations with custom branding.
- **User Management** — Platform-wide user CRUD with role assignment.
- **Billing** — Subscription plan management (basic, professional, enterprise).
- **System Configuration** — Platform-wide settings and feature flags.
- **Audit Logging** — Complete audit trail of login/logout, data access, and modifications.

---

## AI & Clinical Decision Support

### Offline Diagnosis Engine

A rule-based clinical decision support engine (`lib/ai/diagnosis-engine.ts`) that runs entirely in the browser with zero network dependency:

- Disease rules for malaria, respiratory infections, diarrheal disease, maternal complications, and more
- Evaluates vital signs, physical exam findings, patient demographics, chronic conditions, and allergies
- Outputs diagnosis suggestions with confidence scores, severity assessment, recommended tests, and treatment plans
- Integrated ICD-10 coding
- Based on WHO/IMCI clinical guidelines

### Clinical Scribe

AI-powered clinical note parser (`components/ClinicalScribe.tsx`):

- Voice-to-text transcription of clinical encounters
- Natural language processing to extract structured medical data
- Auto-extraction of chief complaint, vital signs, exam findings, and assessment
- Suggestion system for diagnoses and lab tests

### Medical Assistant

Context-aware floating chat widget (`components/AssistantChat.tsx`):

- Medical knowledge base queries
- WHO guideline references (IMCI, ANC protocols)
- Medication and procedure information
- Symptom-based differential guidance

---

## Data Architecture

### PouchDB Collections (Client-Side)

| Database | Purpose |
|----------|---------|
| `tamamhealth_patients` | Patient demographics & registration |
| `tamamhealth_users` | User accounts |
| `tamamhealth_hospitals` | Health facility records |
| `tamamhealth_medical_records` | Consultations & diagnoses |
| `tamamhealth_referrals` | Patient referral network |
| `tamamhealth_lab_results` | Laboratory orders & results |
| `tamamhealth_prescriptions` | Medication orders |
| `tamamhealth_messages` | Doctor-patient communication |
| `tamamhealth_births` | Birth registration (CRVS) |
| `tamamhealth_deaths` | Death registration (ICD-11) |
| `tamamhealth_facility_assessments` | Facility readiness checks |
| `tamamhealth_immunizations` | Vaccination records |
| `tamamhealth_anc` | Antenatal care visits |
| `tamamhealth_boma_visits` | Community health worker visits |
| `tamamhealth_follow_ups` | Patient follow-up tracking |
| `tamamhealth_organizations` | Organization records |
| `tamamhealth_audit_log` | Audit trail |

### Server-Side

- **CouchDB** — Optional bidirectional sync with PouchDB for multi-device/multi-site access
- **PostgreSQL** — Aggregated analytics and reporting (server-only, never exposed to browser)

### Business Logic

25 service files under `lib/services/` encapsulate all database operations, validation, and business rules. Each service is paired with a corresponding React hook in `lib/hooks/` (24 hooks total) for seamless UI integration.

---

## Offline-First Design

TAMAMHEALTH is built for environments with limited or intermittent connectivity:

- **All data stored locally** in PouchDB — the app is fully functional without internet
- **Service Worker** registered for offline page access and asset caching
- **Sync queue** — Changes are queued when offline and automatically synced when connectivity returns
- **Online/offline detection** with visual indicators in the UI
- **Background sync** — Service worker triggers sync on reconnection
- **Sync Manager** (`lib/sync/sync-manager.ts`) coordinates per-database replication with status tracking

---

## Multi-Tenancy & Organizations

- **Public organizations** — Ministry of Health, government departments (see all national data)
- **Private organizations** — Hospital groups, NGOs (scoped to their own data)
- **Custom branding** — Each organization can configure colors, logo, and name
- **Feature flags** — Org admins enable/disable modules (epidemic intelligence, MCH analytics, DHIS2 export, etc.)
- **Subscription plans** — Basic, professional, and enterprise tiers with different feature access
- **Data scoping** — Users see only their organization's data; government roles see national data

---

## Security

- **HTTPS-only cookies** in production with `HttpOnly` and `SameSite=Lax` flags
- **Content Security Policy** headers (X-Frame-Options, HSTS, referrer policy)
- **Rate limiting** — 5 failed login attempts trigger a 15-minute lockout
- **Timing-attack resistance** — Constant-time password comparison with dummy hash on user-not-found
- **Password hashing** — bcryptjs with salt rounds
- **JWT tokens** — HS256 signing with 24-hour expiry via jose
- **Input validation** — Username and password sanitization
- **Audit logging** — All authentication events and data modifications logged

---

## Testing

```bash
# Run all tests
npm test

# Run tests in CI mode with coverage
npm run test:ci
```

Tests use Jest 30 with ts-jest for TypeScript support and JSDOM for browser environment simulation. Test files are located in `src/__tests__/`.

---

## Environment Variables

Run `npm run setup` to configure automatically, or copy `.env.example` to `.env.local` and edit manually. See `.env.example` for all available variables with documentation.

**Required for production:**

| Variable | Purpose | How to generate |
|----------|---------|-----------------|
| `JWT_SECRET` | Session token signing (also used for the CSRF HMAC) | `openssl rand -base64 48` |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `false` for production | |
| `NEXT_PUBLIC_ADMIN_NAME` | Initial admin display name (browser-visible) | |
| `ADMIN_INITIAL_PASSWORD` | Initial admin password — **server-only**. Leave unset to auto-generate; see `platform/.seed-credentials.json`. | `openssl rand -base64 24` |

**Optional:**

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | _(none, app uses PouchDB)_ |
| `NEXT_PUBLIC_SYNC_ENABLED` | Enable CouchDB sync | `false` |
| `NEXT_PUBLIC_COUCHDB_URL` | CouchDB server URL | `http://localhost:5984` |
| `COUCHDB_WEBHOOK_SECRET` | Sync webhook HMAC secret | |
| `RESEND_API_KEY` | Email via Resend | |
| `SENDGRID_API_KEY` | Email via SendGrid | |
| `FLUTTERWAVE_SECRET_HASH` | Payment webhook secret | |
| `NEXT_PUBLIC_APP_URL` | Base URL for payment links | |

**Optional integrations — SMS gateway:**

The messaging UI supports `channel: 'sms' | 'app' | 'both'`. Without an SMS
provider configured, sms-channel sends are written to the audit log but no
real text leaves the server (the `noop` provider). To enable real SMS, set
`SMS_PROVIDER` and the corresponding credentials below.

```bash
# SMS (optional). Set SMS_PROVIDER=africastalking or twilio to enable.
SMS_PROVIDER=noop
AFRICAS_TALKING_USERNAME=
AFRICAS_TALKING_API_KEY=
AFRICAS_TALKING_SENDER_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
APPOINTMENT_REMINDER_SMS_ENABLED=false
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | First-time setup (license, deps, env config) |
| `npm run dev` | Start development server on `localhost:3000` |
| `npm run build` | Create production build |
| `npm start` | Run production server |
| `npm run lint` | Run ESLint checks |
| `npm test` | Run Jest test suite (1,390 tests) |
| `npm run test:ci` | Run tests with coverage reporting |
| `npm run db:migrate` | Apply pending PostgreSQL migrations (requires DATABASE_URL; also runs at server boot) |
| `npm run license:generate` | Generate a license key (admin only) |
| `npm run license:verify` | Verify a license key |
| `npm run release` | Package a distributable release archive |

---

## South Sudan Health System Context

TAMAMHEALTH is designed around South Sudan's administrative and health system structure:

- **Facility levels** — National referral hospitals, state hospitals, county health departments, PHCCs (Primary Health Care Centers), PHCUs (Primary Health Care Units)
- **Administrative divisions** — 10 states, counties, payams, bomas
- **Disease priorities** — Malaria-endemic protocols, maternal mortality reduction, immunization coverage expansion
- **Community health** — Boma health workers conduct household visits; payam supervisors provide oversight
- **Vital registration** — CRVS (Civil Registration and Vital Statistics) integration for births and deaths
- **National reporting** — DHIS2 export for Ministry of Health data aggregation

---

## License

This project is proprietary software developed for SafeguardJunub.
