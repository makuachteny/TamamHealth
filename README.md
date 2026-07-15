# TamamHealth — Electronic Health Record System for South Sudan

**TamamHealth** is an offline-first electronic medical record (EMR) system designed for South Sudan's health infrastructure. Built to work across all five levels of the South Sudanese health system — from village Boma health workers to the Ministry of Health — TamamHealth addresses the unique challenges of low-resource, low-connectivity, and low-literacy environments.

> *"Make it so simple a primary school child can do it."* — Health system expert on South Sudan

---

## Why TamamHealth Exists

South Sudan faces critical health data challenges:

- **67% of facilities do not report to DHIS2** — not because they don't want to, but because existing systems are too complex
- **No national ID system** — "National ID is like gold. If they have national ID, they don't need to do census."
- **Civil salaries unpaid for over a year** — sustainability must be built into the design
- **Less than 33% reporting rate** — the system must make data collection effortless
- **Widespread illiteracy** — voice and visual interfaces are essential

TamamHealth solves these problems by being **offline-first**, **icon-driven**, **simple enough for community health workers**, and **compliant with WHO/DHIS2 standards** for government reporting.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0 ([download](https://nodejs.org))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git** ([download](https://git-scm.com))

Works on **Windows**, **macOS**, and **Linux**. No other dependencies required — the app runs fully offline in the browser.

### Install the Platform (EHR Software)

The platform is distributed as a downloadable archive. Contact **[support.tamam@gmail.com](mailto:support.tamam@gmail.com)** to obtain a license and download link.

```bash
# 1. Extract the archive you received
tar -xzf tamamhealth-platform-<version>.tar.gz
cd tamamhealth-platform-<version>

# 2. Run the setup script (asks for your license key, installs everything)
npm run setup

# 3. Start the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with demo credentials (e.g. `dr.wani` / `Dr.Wani@JTH2026`).

### Run with Docker

```bash
docker compose up --build
```

This starts the platform (port 3000), website (port 3001), and CouchDB (port 5984).

See [platform/README.md](platform/README.md) for full documentation including PostgreSQL setup, CouchDB sync, production deployment, and all environment variables.

---

## Architecture

### Five-Level Health System Support

TamamHealth supports the complete South Sudanese health administrative hierarchy:

```
LEVEL 1 — BOMA (Village)
├─ Boma Health Worker app (simplified interface)
├─ Geocode ID system (BOMA-XY-HH1001)
├─ Binary data collection (treated/referred, alive/dead)
├─ Photo-based patient identification
└─ Offline-first with SMS fallback

LEVEL 2 — PAYAM (Sub-county)
├─ Primary Health Care Units (PHCUs)
├─ Clinical diagnosis with ICD-11 coding
├─ Basic lab results and pharmacy
└─ Referral management

LEVEL 3 — COUNTY (County Hospitals)
├─ Medical records for admitted patients
├─ Advanced diagnostics and lab
├─ Surgery records
└─ DHIS2 reporting

LEVEL 4 — STATE (General/Specialist Hospitals)
├─ Specialized care records
├─ Detailed ICD-11 coding
├─ Complication tracking
└─ Aggregate state-level analytics

LEVEL 5 — NATIONAL (Teaching Hospitals + MoH)
├─ All patient records aggregated
├─ National disease surveillance
├─ Ministry of Health dashboard
├─ DHIS2 export (JSON + CSV)
└─ International reporting (WHO)
```

### Repository Structure

```text
tamamhealth/
├── platform/           EHR application (Next.js) — port 3000
├── website/            Marketing site (Next.js) — port 3001
├── mobile/             React Native companion app
├── fingerprint-bridge/ Localhost USB-scanner bridge for the registration desk
│                       (Node service on 127.0.0.1:7345; see its README)
├── sync-worker/        CouchDB → PostgreSQL national-analytics sync worker
├── country-node/       Country-level aggregation node
├── regional-exchange/  Cross-facility / cross-border record exchange
├── infra/              Deployment + infrastructure config
├── docs/               Documentation, specs, research
└── docker-compose.yml
```

> The **fingerprint-bridge** runs on the same machine as the USB scanner (the
> registration-desk PC), not on the server — the platform talks to it over
> loopback HTTP and degrades gracefully when it's unavailable. See
> [fingerprint-bridge/README.md](fingerprint-bridge/README.md).

### Technology Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Platform | Next.js 14 + React 18 + Tailwind CSS | Operational |
| Website | Next.js 14 (static marketing site) | Operational |
| Database | PouchDB (browser IndexedDB) | Client-side offline-first |
| Analytics DB | PostgreSQL 12+ | Server-side national reporting |
| Sync | CouchDB 3+ | Optional multi-facility sync |
| Auth | JWT (jose) + bcryptjs | Functional |
| AI | Rule-based diagnosis engine (15 diseases) | Functional |
| RBAC | 15 roles, middleware + client guard | Fully implemented |

### Geocode Patient Identification

Because most South Sudanese lack national IDs, TamamHealth uses **household geocoding** as the primary patient identifier:

```
Format: BOMA-{bomaCode}-HH{householdNumber}
Example: BOMA-KJ-HH1001

Structure:
  geocodeId:        "BOMA-KJ-HH1001"    ← Primary identifier
  nationalId:       null                  ← Optional (most won't have)
  householdNumber:  1001
  bomaCode:         "KJ"
  boma:             "Kajo-keji"
  payam:            "..."
  county:           "..."
  state:            "Central Equatoria"
```

This system:
- Works like a postcode — tracks patients geographically
- Doesn't require documents most people don't have
- Enables family-based identification (all household members share a prefix)
- Supports mapping and GPS tracking

---

## Roles & Dashboards

TamamHealth implements 8 role-based dashboards:

| # | Role | Dashboard | Key Functions |
|---|------|-----------|---------------|
| 1 | **Doctor** | `/dashboard` | Full clinical workflow: consultation, diagnosis, prescriptions, lab orders, referrals |
| 2 | **Clinical Officer** | `/dashboard` | Same as doctor (task-shifting support) |
| 3 | **Nurse** | `/dashboard/nurse` | Ward patients, vitals, ANC, immunizations, births |
| 4 | **Lab Technician** | `/dashboard/lab` | Lab order queue, result entry, critical flagging |
| 5 | **Pharmacist** | `/dashboard/pharmacy` | Prescription queue, dispensing, stock tracking |
| 6 | **Front Desk** | `/dashboard/front-desk` | Patient registration, referral tracking |
| 7 | **Boma Health Worker** | `/dashboard/boma` | Community visits, follow-up tracking, household management |
| 8 | **Government Admin** | `/government` | National dashboard, DHIS2 export, surveillance, facility assessments |

### Boma Health Worker Dashboard

The BHW interface is designed for community health workers managing **40 households** in a village. Expert-validated data collection flow:

```
Step 1: Identify Location (geocode ID)
Step 2: Identify Patient (name + photo)
Step 3: Identify Condition (dropdown of common conditions)
Step 4: Action Taken (binary: TREATED or REFERRED)
Step 5: Outcome Tracking (recovered / died / follow-up)
```

---

## Features

### Clinical

- **Patient Registration** — Multi-step form with geocode ID, demographics, contact, next of kin, medical history
- **Consultation Workflow** — Vitals, chief complaint, physical exam, AI-assisted diagnosis, prescriptions, lab orders
- **AI Diagnosis Engine** — Rule-based system covering 15 diseases common in South Sudan (malaria, TB, HIV, pneumonia, etc.)
- **Laboratory** — Order → Accept → Result entry → Critical flagging workflow
- **Pharmacy** — Prescription queue → Dispensing workflow
- **Inter-facility Referrals** — Transfer package assembly with full patient history, status tracking (sent → received → seen → completed)

### Public Health

- **Antenatal Care (ANC)** — WHO 8-contact model, risk stratification, IPTp tracking, birth plans
- **Immunizations (EPI)** — Full vaccine schedule tracking (BCG, OPV, Penta, PCV, Rota, Measles, Yellow Fever, Vitamin A), overdue alerts
- **Birth Registration (CRVS)** — WHO-compliant birth certificates, auto-generated certificate numbers
- **Death Registration (CRVS)** — WHO 4-line medical certificate format with ICD-11 coding
- **Disease Surveillance** — Active alerts, outbreak detection, IDSR reporting context
- **Epidemic Intelligence** — Disease trend analysis with South Sudan-specific context

### ICD-11 Integration

TamamHealth includes **70+ ICD-11 codes** curated for South Sudan's disease burden:

- **Multi-level diagnosis**: Suspected (Boma) → Clinical (Payam) → Definitive (County) → Specialist (State)
- **Notifiable diseases** flagged for mandatory DHIS2/IDSR reporting
- **Searchable** by code, title, chapter, or local keyword
- **Level-appropriate**: Codes filtered by facility capability

### Government & Analytics

- **National Dashboard** — Population health overview across all 10 states
- **Vital Statistics** — Birth/death rates, cause-of-death analysis
- **Facility Assessments** — WHO SARA-aligned readiness scoring
- **Data Quality Monitoring** — Completeness, timeliness, DHIS2 adoption rates
- **DHIS2 Export** — JSON and CSV export formats for government reporting
- **MCH Analytics** — Maternal and child health indicators

### Cross-Cutting

- **Offline-First** — PouchDB with IndexedDB; works without internet
- **Dark/Light Theme** — Supports both modes
- **Doctor-Patient Messaging** — In-app + SMS channel support
- **Multi-Language Data** — Patient data supports English, Arabic (Juba), Dinka, Nuer, Shilluk, Murle, and 8+ additional South Sudanese languages
- **Input Validation** — Patient data, vital signs, file uploads
- **Audit Logging** — Login, logout, and data mutation events
- **Security Headers** — CSP, HSTS, X-Frame-Options, CSRF protection via SameSite cookies

---

## Data Model

### Core Collections (PouchDB)

| Collection | Purpose |
|-----------|---------|
| `tamamhealth_users` | Staff accounts with role-based access |
| `tamamhealth_patients` | Patient records with geocode IDs |
| `tamamhealth_hospitals` | Facility registry with 5-level hierarchy |
| `tamamhealth_medical_records` | Clinical visit records |
| `tamamhealth_referrals` | Inter-facility referrals |
| `tamamhealth_lab_results` | Laboratory orders and results |
| `tamamhealth_prescriptions` | Medication prescriptions |
| `tamamhealth_boma_visits` | Community health worker visit records |
| `tamamhealth_follow_ups` | Patient follow-up tracking |
| `tamamhealth_births` | Birth registrations (CRVS) |
| `tamamhealth_deaths` | Death registrations with ICD-11 |
| `tamamhealth_immunizations` | Vaccine records (EPI) |
| `tamamhealth_anc` | Antenatal care visits |
| `tamamhealth_disease_alerts` | Surveillance alerts |
| `tamamhealth_facility_assessments` | WHO SARA assessments |
| `tamamhealth_messages` | Doctor-patient messages |
| `tamamhealth_audit_log` | Security audit trail |

### Patient Schema

```typescript
{
  // Geocode-based identification (primary)
  geocodeId: "BOMA-KJ-HH1001",
  householdNumber: 1001,
  bomaCode: "KJ",
  nationalId: null,           // Optional

  // Demographics
  firstName, middleName, surname, maidenName,
  dateOfBirth, estimatedAge,  // Supports age estimation
  gender, tribe, primaryLanguage,

  // Location (South Sudan hierarchy)
  state, county, payam, boma,
  gpsLatitude, gpsLongitude,

  // Contact
  phone, altPhone, whatsapp,

  // Medical
  bloodType, allergies[], chronicConditions[],

  // Follow-up tracking
  followUpStatus,             // recovered | died | referred | under_treatment
  assignedHealthWorker,       // BHW ID
  nextFollowUp,
}
```

---

## DHIS2 Integration

TamamHealth complements — not competes with — DHIS2. The system generates DHIS2-compatible exports:

- **JSON export** for programmatic integration
- **CSV export** for manual upload
- **Aggregate data**: Total patients, sex disaggregation, disease profiles, notifiable diseases
- **Notifiable disease codes** flagged automatically via ICD-11 integration

> *"Our tool complements DHIS2 to make data transfer quicker, easier, and more efficient with high quality."*

---

## Design Principles

Validated by a South Sudan health system expert:

1. **Appropriate for context** — Low literacy, low connectivity, multiple languages
2. **Fit for purpose** — Actually solves the data collection problem
3. **Value for money** — Cheap to deploy and maintain
4. **Binary choices** — Minimize free-text; use treated/referred, alive/dead/follow-up
5. **Photo-based ID** — Critical for patient identification in illiterate populations
6. **Offline-first** — 100% functionality without internet
7. **Five-level support** — From village health workers to the Ministry of Health

### Data Quality Parameters

| Parameter | Description |
|-----------|-------------|
| **Completeness** | All required fields filled (validation enforced) |
| **Correctness** | Accurate data (range checks, ICD-11 codes) |
| **Consistency** | Same format everywhere (geocode IDs, date formats) |
| **Timeliness** | Real-time or near-real-time data entry |

---

## Roadmap

### Near-Term

- [ ] Voice-to-text data entry for illiterate health workers
- [ ] Photo capture for patient identification (mandatory)
- [ ] WhatsApp Business API integration for reminders
- [ ] SMS gateway integration (Africa's Talking)
- [ ] CouchDB remote sync for server-side persistence

### Medium-Term

- [ ] Mobile app backend API (replace demo data)
- [ ] Pharmacy real inventory tracking
- [ ] Telco partnership integration (Zain/MTN)
- [ ] Offline data encryption
- [ ] Push notifications

### Long-Term

- [ ] Veterinary health tracking module (community engagement gateway)
- [ ] Insurance/billing system foundation
- [ ] Census and population planning data
- [ ] HL7/FHIR interoperability
- [ ] Multi-facility CouchDB replication network

---

## Project Structure

```
tamamhealth/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Authenticated pages
│   │   │   ├── dashboard/        # Role-specific dashboards
│   │   │   │   ├── boma/         # Boma Health Worker
│   │   │   │   ├── nurse/        # Nurse station
│   │   │   │   ├── lab/          # Lab command center
│   │   │   │   ├── pharmacy/     # Pharmacy operations
│   │   │   │   └── front-desk/   # Reception
│   │   │   ├── patients/         # Patient registry + detail
│   │   │   ├── consultation/     # Clinical consultation
│   │   │   ├── lab/              # Lab orders & results
│   │   │   ├── pharmacy/         # Dispensing
│   │   │   ├── referrals/        # Inter-facility referrals
│   │   │   ├── anc/              # Antenatal care
│   │   │   ├── births/           # Birth registration
│   │   │   ├── deaths/           # Death registration
│   │   │   ├── immunizations/    # EPI tracking
│   │   │   ├── surveillance/     # Disease surveillance
│   │   │   ├── government/       # National dashboard
│   │   │   ├── dhis2-export/     # DHIS2 data export
│   │   │   └── ...               # Additional modules
│   │   ├── api/auth/             # Authentication endpoints
│   │   ├── page.tsx              # Login page
│   │   └── globals.css           # Theme system
│   ├── components/               # Shared UI components
│   ├── data/mock.ts              # Demo data + type definitions
│   └── lib/
│       ├── db.ts                 # PouchDB database layer
│       ├── db-types.ts           # TypeScript interfaces
│       ├── db-seed.ts            # Demo data seeding
│       ├── permissions.ts        # RBAC configuration
│       ├── icd11-codes.ts        # ICD-11 code reference
│       ├── context.tsx           # App state management
│       ├── hooks/                # React hooks
│       └── services/             # Data access services
├── mobile/                             # React Native (Expo) companion app
└── package.json
```

---

## Security Notes

**Implemented controls:**

- CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers (`next.config.mjs`)
- bcrypt password hashing; admin-issued credentials force a password change on first use
- Server-issued JWT (HS256, env `JWT_SECRET`, 8h) with role-based middleware; the
  server refuses to start on the default secret in production
- Token revocation enforced at `/api/auth/me` and every `/api/*` route
- Two-layer CSRF: Origin/Host check + HMAC double-submit token (`middleware.ts`)
- Rate limiting on login (shared store via Upstash when configured; in-memory fallback)
- Server-side persistence + sync (CouchDB) with org-scoped replication filters
- Per-tab AES-GCM encryption of in-progress PHI drafts; full local DB wipe on logout
- Demo mode and the demo-credentials endpoint gated by `NEXT_PUBLIC_DEMO_MODE`

**Remaining hardening for a real PHI / in-country deployment** — see
[`docs/operations/production-hardening.md`](docs/operations/production-hardening.md),
enforced by [`scripts/preflight.sh`](scripts/preflight.sh):

- TLS termination for **CouchDB** (not just the app) and encryption-at-rest for the
  CouchDB/Postgres volumes on an in-country / MoH-approved host (data residency)
- Nightly **encrypted, offsite** backups with a tested restore drill
- Secret rotation procedure + a secrets manager (avoid plaintext env files on disk)
- CouchDB per-database `_security` for multi-tenant isolation (defence-in-depth)
- A shared rate-limit store before running more than one app instance

---

## Cultural Considerations

Key insights from expert consultation:

- **Common names**: "This one is Deng. This is Deng. This is Deng." — Geocode IDs solve the name collision problem
- **Hidden populations**: Disability and mental health data will be underreported due to cultural stigma — system uses sensitive data collection methods
- **Livestock engagement**: Community members may engage more readily with animal health tracking — consider veterinary module as gateway
- **Traditional birth attendants**: Many births occur outside facilities — system supports TBA registration
- **Multiple languages**: South Sudan has 60+ languages; TamamHealth supports the major ones: Dinka, Nuer, Shilluk, Murle, Bari, Zande, Arabic (Juba), English

---

## Contributing

This project is designed for South Sudan's Ministry of Health and partner organizations. Contributions should align with:

1. WHO standards (ICD-11, CRVS, SARA)
2. South Sudan DHIS2 requirements
3. Offline-first architecture
4. Low-literacy accessibility
5. The five-level health system hierarchy

---

## License

Proprietary — designed for deployment in South Sudan's public health system.

---

*Built with care for the people of South Sudan.*
