-- Drop the boma_visits analytics table. The community-health (boma/payam/BHW)
-- tier was removed from the platform, so this table is never populated. We add
-- a new migration instead of editing 0001 because the runner hash-verifies
-- already-applied migrations. Idempotent: safe whether or not the table exists.
DROP TABLE IF EXISTS boma_visits CASCADE;
