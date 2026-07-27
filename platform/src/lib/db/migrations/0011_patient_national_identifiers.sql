-- Carry South Sudan's patient identifiers into the national projection (KAN-14).
--
-- The `patients` analytics table held only hospital_number, name, gender, DOB,
-- age, state, county, hospital_id, org_id. The source document also stores
-- geocode_id, national_id, payam, boma and household_number — none of which had
-- columns, so the mapper silently dropped them.
--
-- geocode_id is the PRIMARY patient identifier in the South Sudan scheme
-- (BOMA-{bomaCode}-HH{household}-{suffix}, see clinical-flow/patient-identity.ts).
-- Losing it at the analytics tier means national de-duplication has nothing
-- stable to match on: two facilities registering the same person produce two
-- national rows with no way to tell they are one patient. Household linkage —
-- which is how outbreak contact tracing works here — is lost with it.
--
-- Deliberately NOT carried: `address` (free-text, no analytics consumer, and
-- the geographic hierarchy below supersedes it for every current query) and
-- phone/next-of-kin contact details (direct-contact PHI with no national
-- indicator depending on them; keeping them inside the facility perimeter is
-- the safer default). Revisit if a national callback workflow ever needs them.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS geocode_id TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS payam TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS boma TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS household_number TEXT;

-- Non-unique on purpose. These are the columns de-duplication reads, so they
-- must be fast to look up — but a UNIQUE constraint here would make the sync
-- webhook reject a legitimate duplicate-registration row instead of landing it
-- for a human to merge. Detection belongs upstream (patient-service duplicate
-- check, mpi-service); this tier's job is to record what happened, including
-- the duplicates. Partial indexes so the very common NULLs cost nothing.
CREATE INDEX IF NOT EXISTS idx_patients_geocode_id
  ON patients(geocode_id) WHERE geocode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_national_id
  ON patients(national_id) WHERE national_id IS NOT NULL;

-- Payam/boma complete the state → county → payam → boma hierarchy the
-- surveillance and equity dashboards aggregate over; county alone stops two
-- levels short of where an outbreak is actually located.
CREATE INDEX IF NOT EXISTS idx_patients_payam ON patients(payam) WHERE payam IS NOT NULL;
