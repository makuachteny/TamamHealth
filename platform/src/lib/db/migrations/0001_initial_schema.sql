-- =============================================================================
-- SafeguardJunub / TamamHealth — PostgreSQL National Analytics Schema
-- =============================================================================
-- This schema mirrors the CouchDB document types for national-level reporting,
-- government dashboards, and cross-facility analytics.
--
-- Data flows: CouchDB → /api/sync webhook → PostgreSQL
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== Organizations =====
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'public',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  subscription_plan TEXT NOT NULL DEFAULT 'basic',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  contact_email TEXT,
  country TEXT DEFAULT 'South Sudan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Hospitals / Facilities =====
CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  facility_level TEXT, -- boma | payam | county | state | national
  state TEXT,
  county TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  total_beds INTEGER DEFAULT 0,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_state ON hospitals(state);
CREATE INDEX IF NOT EXISTS idx_hospitals_org ON hospitals(org_id);

-- ===== Patients =====
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  hospital_number TEXT,
  name TEXT NOT NULL,
  gender TEXT,
  date_of_birth TEXT,
  age INTEGER,
  state TEXT,
  county TEXT,
  hospital_id TEXT REFERENCES hospitals(id),
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_hospital ON patients(hospital_id);
CREATE INDEX IF NOT EXISTS idx_patients_org ON patients(org_id);
CREATE INDEX IF NOT EXISTS idx_patients_state ON patients(state);

-- ===== Medical Records =====
CREATE TABLE IF NOT EXISTS medical_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  hospital_id TEXT,
  record_type TEXT,
  diagnosis TEXT,
  icd11_code TEXT,
  severity TEXT,
  visit_date TIMESTAMPTZ,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_diagnosis ON medical_records(icd11_code);

-- ===== Lab Results =====
CREATE TABLE IF NOT EXISTS lab_results (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  test_name TEXT NOT NULL,
  specimen TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  abnormal BOOLEAN DEFAULT FALSE,
  critical BOOLEAN DEFAULT FALSE,
  hospital_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  ordered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_status ON lab_results(status);

-- ===== Referrals =====
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  from_hospital_id TEXT,
  to_hospital_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  urgency TEXT,
  reason TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- ===== Disease Alerts =====
CREATE TABLE IF NOT EXISTS disease_alerts (
  id TEXT PRIMARY KEY,
  disease TEXT NOT NULL,
  icd11_code TEXT,
  severity TEXT NOT NULL,
  state TEXT,
  county TEXT,
  cases INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  reported_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disease_alerts_disease ON disease_alerts(disease);
CREATE INDEX IF NOT EXISTS idx_disease_alerts_state ON disease_alerts(state);
CREATE INDEX IF NOT EXISTS idx_disease_alerts_status ON disease_alerts(status);

-- ===== Prescriptions =====
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id),
  medication TEXT NOT NULL,
  dose TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  hospital_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Birth Registration (CRVS) =====
CREATE TABLE IF NOT EXISTS births (
  id TEXT PRIMARY KEY,
  child_first_name TEXT NOT NULL,
  child_surname TEXT NOT NULL,
  child_gender TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  place_of_birth TEXT,
  facility_id TEXT,
  facility_name TEXT,
  mother_name TEXT,
  mother_age INTEGER,
  birth_weight INTEGER, -- grams
  birth_type TEXT,
  delivery_type TEXT,
  attended_by TEXT,
  state TEXT,
  county TEXT,
  certificate_number TEXT UNIQUE,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_births_state ON births(state);
CREATE INDEX IF NOT EXISTS idx_births_date ON births(date_of_birth);

-- ===== Death Registration (CRVS) =====
CREATE TABLE IF NOT EXISTS deaths (
  id TEXT PRIMARY KEY,
  deceased_first_name TEXT NOT NULL,
  deceased_surname TEXT NOT NULL,
  deceased_gender TEXT NOT NULL,
  date_of_birth DATE,
  date_of_death DATE NOT NULL,
  age_at_death INTEGER,
  place_of_death TEXT,
  facility_id TEXT,
  immediate_cause TEXT,
  immediate_icd11 TEXT,
  underlying_cause TEXT,
  underlying_icd11 TEXT,
  manner_of_death TEXT,
  maternal_death BOOLEAN DEFAULT FALSE,
  state TEXT,
  county TEXT,
  certificate_number TEXT UNIQUE,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deaths_state ON deaths(state);
CREATE INDEX IF NOT EXISTS idx_deaths_date ON deaths(date_of_death);
CREATE INDEX IF NOT EXISTS idx_deaths_cause ON deaths(underlying_icd11);

-- ===== Immunizations =====
CREATE TABLE IF NOT EXISTS immunizations (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  vaccine TEXT NOT NULL,
  dose_number INTEGER,
  date_given DATE,
  next_due_date DATE,
  facility_id TEXT,
  state TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  adverse_reaction BOOLEAN DEFAULT FALSE,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_immunizations_vaccine ON immunizations(vaccine);
CREATE INDEX IF NOT EXISTS idx_immunizations_state ON immunizations(state);

-- ===== ANC (Antenatal Care) Visits =====
CREATE TABLE IF NOT EXISTS anc_visits (
  id TEXT PRIMARY KEY,
  mother_id TEXT,
  mother_name TEXT,
  visit_number INTEGER,
  visit_date DATE,
  gestational_age INTEGER,
  risk_level TEXT,
  facility_id TEXT,
  state TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anc_state ON anc_visits(state);

-- ===== Boma Health Worker Visits =====
CREATE TABLE IF NOT EXISTS boma_visits (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  worker_name TEXT,
  patient_name TEXT,
  geocode_id TEXT,
  chief_complaint TEXT,
  suspected_condition TEXT,
  icd11_code TEXT,
  action TEXT NOT NULL, -- treated | referred
  outcome TEXT,
  state TEXT,
  county TEXT,
  payam TEXT,
  boma TEXT,
  visit_date DATE,
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boma_visits_state ON boma_visits(state);
CREATE INDEX IF NOT EXISTS idx_boma_visits_worker ON boma_visits(worker_id);
CREATE INDEX IF NOT EXISTS idx_boma_visits_condition ON boma_visits(suspected_condition);

-- ===== Facility Assessments =====
CREATE TABLE IF NOT EXISTS facility_assessments (
  id TEXT PRIMARY KEY,
  facility_id TEXT REFERENCES hospitals(id),
  facility_name TEXT,
  assessment_date DATE,
  overall_score INTEGER,
  general_equipment_score INTEGER,
  diagnostic_capacity_score INTEGER,
  essential_medicines_score INTEGER,
  staffing_score INTEGER,
  data_quality_score INTEGER,
  state TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_assessments_facility ON facility_assessments(facility_id);

-- ===== Audit Log =====
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT,
  username TEXT,
  details TEXT,
  success BOOLEAN DEFAULT TRUE,
  org_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

-- ===== Sync Metadata (tracks last processed CouchDB sequence) =====
CREATE TABLE IF NOT EXISTS sync_metadata (
  db_name TEXT PRIMARY KEY,
  last_seq TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Materialized Views for Government Dashboard =====

-- National patient count by state
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_patients_by_state AS
SELECT
  state,
  COUNT(*) as patient_count,
  COUNT(DISTINCT hospital_id) as facility_count
FROM patients
WHERE state IS NOT NULL
GROUP BY state;

-- Disease surveillance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_disease_surveillance AS
SELECT
  disease,
  state,
  SUM(cases) as total_cases,
  SUM(deaths) as total_deaths,
  MAX(updated_at) as last_updated
FROM disease_alerts
WHERE status = 'active'
GROUP BY disease, state;

-- Birth registration by state and month
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_births_by_state_month AS
SELECT
  state,
  DATE_TRUNC('month', date_of_birth) as month,
  COUNT(*) as birth_count,
  COUNT(CASE WHEN delivery_type = 'caesarean' THEN 1 END) as caesarean_count,
  AVG(birth_weight) as avg_birth_weight
FROM births
WHERE state IS NOT NULL
GROUP BY state, DATE_TRUNC('month', date_of_birth);

-- Refresh function (call periodically or after sync batch)
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_patients_by_state;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_disease_surveillance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_births_by_state_month;
END;
$$ LANGUAGE plpgsql;
