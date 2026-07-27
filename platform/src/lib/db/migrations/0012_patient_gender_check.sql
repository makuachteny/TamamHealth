-- Enforce the canonical gender enum at the database tier (KAN-17).
--
-- Three layers disagreed: the TypeScript type declares 'Male' | 'Female', the
-- validator accepted ['male','female','unknown'] after .toLowerCase(), and this
-- column was a bare TEXT with no constraint. It worked only by coincidence —
-- 'Male'.toLowerCase() matches — while 'unknown' was accepted by the API and is
-- unrepresentable in the type, so any row storing it violated its own contract.
--
-- Canonical form is the capitalised pair: it is what the type declares, what
-- every document holds, and what ~228 call sites compare against. Re-casing to
-- lowercase would have meant refactoring all of them plus backfilling every
-- patient record, for no behavioural gain.

-- Backfill first: normalise any casing already in the table so the constraint
-- below cannot fail on existing rows. Runs before the ALTER on purpose.
UPDATE patients SET gender = 'Male'   WHERE lower(gender) = 'male'   AND gender <> 'Male';
UPDATE patients SET gender = 'Female' WHERE lower(gender) = 'female' AND gender <> 'Female';

-- Anything else ('unknown', stray imports, empty strings) becomes NULL rather
-- than blocking the migration. NULL is honest — "we do not have this" — whereas
-- guessing a value would fabricate clinical data, and failing the migration
-- would take the analytics tier down over a handful of malformed rows.
UPDATE patients SET gender = NULL
  WHERE gender IS NOT NULL AND gender NOT IN ('Male', 'Female');

-- NULL is permitted: the analytics projection must be able to land a row whose
-- source document predates the constraint. Rejecting it here would make the
-- sync webhook fail permanently on that document instead of recording what is
-- known about the patient.
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_gender_check;
ALTER TABLE patients ADD CONSTRAINT patients_gender_check
  CHECK (gender IS NULL OR gender IN ('Male', 'Female'));
