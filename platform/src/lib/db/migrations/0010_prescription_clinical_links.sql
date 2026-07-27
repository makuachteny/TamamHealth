-- 0010 — Link prescriptions to the encounter and medical record that ordered them.
--
-- Why: `prescriptions` carried only patient_id and hospital_id, so at the
-- analytics tier a dispensed drug could not be traced back to the diagnosis
-- that justified it. Billing audits could not verify a charged drug matched a
-- clinical order, and a corrected lab result could not be associated with the
-- prescription that followed it.
--
-- The CouchDB PrescriptionDoc already carries both fields; this adds the
-- matching columns and teaches the sync mapper to project them.
--
-- Nullable by design: prescriptions written before this migration have no
-- encounter or record link, and back-filling them is not possible from data we
-- hold. NULL honestly means "unknown", not "none".

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS encounter_id TEXT,
  ADD COLUMN IF NOT EXISTS medical_record_id TEXT;

-- Trace every drug ordered during one visit.
CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter
  ON prescriptions (encounter_id)
  WHERE encounter_id IS NOT NULL;

-- Trace every drug documented by one clinical note.
CREATE INDEX IF NOT EXISTS idx_prescriptions_medical_record
  ON prescriptions (medical_record_id)
  WHERE medical_record_id IS NOT NULL;

-- Deliberately NOT foreign keys. The analytics database is populated by an
-- eventually-consistent projection from CouchDB, and a prescription can arrive
-- before the encounter that owns it. A hard FK would reject the row outright
-- and lose it; these are trace links, not integrity constraints.
