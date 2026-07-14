-- =============================================================================
-- 0008 — Nutrition screening writeback: SAM/MAM national projection.
-- =============================================================================
-- Acute malnutrition (SAM/MAM by MUAC, edema, and WHZ) is a core national /
-- DHIS2 MCH indicator. Screenings were captured at the facility
-- (tamamhealth_nutrition_screenings) but had no writeback table or mapper, so
-- malnutrition was invisible at the national level. This migration adds the
-- projection table; /api/sync now maps each screening into it (see
-- FIELD_MAPPERS.nutrition_screenings). LAST_WRITE_WINS (see TABLE_CONFLICT_POLICY).
--
-- CREATE ... IF NOT EXISTS keeps the migration purely additive and replay-safe.
-- =============================================================================

CREATE TABLE IF NOT EXISTS nutrition_screenings (
  id TEXT PRIMARY KEY,
  patient_id TEXT,                              -- optional: screenings may precede registration
  patient_name TEXT,
  age TEXT,                                     -- display age, e.g. '2y', '18m', '28w ANC'
  sex TEXT,
  muac NUMERIC,                                 -- mid-upper-arm circumference, cm
  weight_kg NUMERIC,
  height_cm NUMERIC,
  edema BOOLEAN,                                -- bilateral pitting edema (any grade => SAM)
  is_anc BOOLEAN,                              -- pregnant/lactating; uses the adult MUAC threshold
  status TEXT,                                  -- SAM | MAM | At Risk | Underweight | Normal
  screening_date DATE,
  screened_by_id TEXT,
  screened_by_name TEXT,
  hospital_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_screenings_patient ON nutrition_screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_screenings_status ON nutrition_screenings(status);
CREATE INDEX IF NOT EXISTS idx_nutrition_screenings_date ON nutrition_screenings(screening_date);
CREATE INDEX IF NOT EXISTS idx_nutrition_screenings_org ON nutrition_screenings(org_id);
