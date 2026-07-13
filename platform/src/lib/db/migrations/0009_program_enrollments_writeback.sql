-- =============================================================================
-- 0009 — Program enrollment writeback: care-program cascade national projection.
-- =============================================================================
-- Enrollment in ART/HIV care, TB (DS/DR), PMTCT, ANC, Nutrition (OTP/SFP),
-- EPI/Immunization, and NCD clinics are core national/DHIS2 care-cascade
-- indicators (e.g. "ART enrollment", "TB notification", "PMTCT coverage").
-- The chart's Programs tab previously had no data model at all — this
-- migration adds the projection table; /api/sync now maps each enrollment
-- into it (see FIELD_MAPPERS.program_enrollments). LAST_WRITE_WINS (see
-- TABLE_CONFLICT_POLICY): a program can be re-opened after being marked
-- lost-to-follow-up, so a fixed terminal-status guard would be wrong here —
-- same reasoning as the `problems` table.
--
-- CREATE ... IF NOT EXISTS keeps the migration purely additive and replay-safe.
-- =============================================================================

CREATE TABLE IF NOT EXISTS program_enrollments (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  program_key TEXT,                             -- art_hiv_care | tb_ds | tb_dr | pmtct | anc | nutrition_otp | nutrition_sfp | epi_immunization | ncd_hypertension_diabetes | other
  program_name TEXT,                            -- display label (curated, or free text when program_key = 'other')
  status TEXT,                                  -- active | completed | transferred_out | lost_to_follow_up | discontinued
  enrollment_date DATE,
  outcome_date DATE,
  -- NB: no free-text `notes` column. Narrative clinical notes are PHI that
  -- must not flow to national analytics (same exclusion as patient_notes /
  -- phone_notes / assessments); the care-cascade projection carries only
  -- status/dates/program keys. /api/sync does not map `notes` either.
  recorded_by TEXT,
  recorded_by_name TEXT,
  hospital_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_enrollments_patient ON program_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program_key ON program_enrollments(program_key);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_status ON program_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_org ON program_enrollments(org_id);
