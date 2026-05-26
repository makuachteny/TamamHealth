-- =============================================================================
-- 0003 — Phase 2 analytics writeback: clinical workflow tables.
-- =============================================================================
-- Adds PostgreSQL projections for four CouchDB databases that already sync
-- via the platform but did not previously have a writeback path:
--
--   tamamhealth_problems     -> problems
--   tamamhealth_triage       -> triage_events
--   tamamhealth_appointments -> appointments
--   tamamhealth_follow_ups   -> follow_ups
--
-- Field lists mirror the FIELD_MAPPERS entries in
--   src/app/api/sync/route.ts
-- and the column allowlist in
--   src/lib/db/postgres.ts (ALLOWED_COLUMNS).
--
-- The migration is purely additive and uses `CREATE TABLE IF NOT EXISTS` /
-- `CREATE INDEX IF NOT EXISTS` so a replay is a no-op.
-- =============================================================================

-- ===== Problem List =====
-- Active and historical clinical problems per patient (ICD-11/ICD-10 coded).
-- Drives chronic-disease prevalence dashboards.
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  patient_name TEXT,
  name TEXT NOT NULL,
  icd11_code TEXT,
  icd10_code TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | resolved | chronic | inactive
  onset_date DATE,
  resolved_date DATE,
  severity TEXT,
  hospital_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_patient ON problems(patient_id);
CREATE INDEX IF NOT EXISTS idx_problems_icd11 ON problems(icd11_code);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_org ON problems(org_id);

-- ===== Triage Events (ETAT — Emergency Triage Assessment & Treatment) =====
-- One row per triage encounter; feeds emergency-response analytics
-- (RED/YELLOW/GREEN distribution by facility, time-to-handoff).
CREATE TABLE IF NOT EXISTS triage_events (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  patient_name TEXT,
  priority TEXT NOT NULL,                     -- RED | YELLOW | GREEN
  airway TEXT,
  breathing TEXT,
  circulation TEXT,
  consciousness TEXT,
  chief_complaint TEXT,
  facility_id TEXT,
  triaged_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | seen | admitted | discharged | referred
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triage_events_priority ON triage_events(priority);
CREATE INDEX IF NOT EXISTS idx_triage_events_facility ON triage_events(facility_id);
CREATE INDEX IF NOT EXISTS idx_triage_events_org ON triage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_triage_events_triaged_at ON triage_events(triaged_at);
-- Backs the CLINICAL_FINALIZED guard's monotonicity check.
CREATE INDEX IF NOT EXISTS idx_triage_events_finalized
  ON triage_events (id, status, updated_at);

-- ===== Appointments =====
-- Booking ledger for payam-level and above. Drives utilization, no-show, and
-- provider-load dashboards.
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  patient_name TEXT,
  provider_id TEXT,
  provider_name TEXT,
  facility_id TEXT,
  appointment_date DATE,
  appointment_time TEXT,                       -- HH:MM (24h) — keep as text to round-trip with CouchDB
  duration INTEGER,                            -- minutes
  appointment_type TEXT,
  priority TEXT,                               -- routine | urgent | emergency
  department TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_facility ON appointments(facility_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(org_id);
-- Backs the CLINICAL_FINALIZED guard's monotonicity check.
CREATE INDEX IF NOT EXISTS idx_appointments_finalized
  ON appointments (id, status, updated_at);

-- ===== Follow-Ups =====
-- Community follow-up plans for boma/payam-level patients. Drives
-- outreach-coverage dashboards.
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  patient_name TEXT,
  assigned_worker TEXT,
  assigned_worker_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',       -- active | completed | missed | lost_to_followup
  outcome TEXT,
  condition TEXT,
  facility_level TEXT,
  scheduled_date DATE,
  completed_date DATE,
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_worker ON follow_ups(assigned_worker);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_state ON follow_ups(state);
CREATE INDEX IF NOT EXISTS idx_follow_ups_org ON follow_ups(org_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_date);
