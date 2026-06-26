-- =============================================================================
-- 0006 — Ward inpatient writeback: beds & admissions national projections.
-- =============================================================================
-- The wards CouchDB database (tamamhealth_wards) co-locates three doc types:
-- ward, bed, and admission. Phase-3 writeback only projected the `ward` type
-- into the `wards` table, so bed-occupancy and admission/discharge data (length
-- of stay, in-hospital mortality, isolation, transfers) never reached the
-- national analytics store — and bed/admission ids were being upserted into the
-- `wards` table as near-empty rows.
--
-- This migration adds the two missing analytics tables. The /api/sync route now
-- routes each wards-DB change to its table by doc `type` (see resolveTable /
-- WARDS_DB_TABLES). Both are LAST_WRITE_WINS (see TABLE_CONFLICT_POLICY).
--
-- All CREATE statements use IF NOT EXISTS so the migration is purely additive
-- and safe to replay.
-- =============================================================================

-- ===== Beds (inpatient bed occupancy / status) =====
CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  bed_number TEXT,
  ward_id TEXT,
  ward_name TEXT,
  facility_id TEXT,
  status TEXT,                                  -- available | occupied | reserved | maintenance | cleaning
  current_patient_id TEXT,
  current_patient_name TEXT,
  current_admission_id TEXT,
  last_cleaned_at TIMESTAMPTZ,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_beds_facility ON beds(facility_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_org ON beds(org_id);

-- ===== Admissions (inpatient episodes — LOS, mortality, transfers) =====
CREATE TABLE IF NOT EXISTS admissions (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  hospital_number TEXT,
  admission_date TIMESTAMPTZ,
  admitting_diagnosis TEXT,
  icd11_code TEXT,
  severity TEXT,                                -- mild | moderate | severe | critical
  admitted_by TEXT,
  admitted_by_name TEXT,
  ward_id TEXT,
  ward_name TEXT,
  bed_id TEXT,
  bed_number TEXT,
  facility_id TEXT,
  facility_name TEXT,
  facility_level TEXT,
  attending_physician TEXT,
  attending_physician_name TEXT,
  nurse_assigned TEXT,
  nurse_assigned_name TEXT,
  isolation_required BOOLEAN,
  isolation_reason TEXT,
  status TEXT,                                  -- admitted | transferred | discharged | deceased | absconded
  discharge_date TIMESTAMPTZ,
  discharge_type TEXT,                          -- normal | against_medical_advice | transfer | death | absconded
  discharge_diagnosis TEXT,
  discharge_icd11 TEXT,
  discharged_by TEXT,
  discharged_by_name TEXT,
  follow_up_required BOOLEAN,
  follow_up_date TIMESTAMPTZ,
  length_of_stay NUMERIC,                       -- days, set on discharge
  transferred_from TEXT,
  transferred_to TEXT,
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_facility ON admissions(facility_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_admission_date ON admissions(admission_date);
CREATE INDEX IF NOT EXISTS idx_admissions_org ON admissions(org_id);
