-- =============================================================================
-- 0002 — Indexes that back the CLINICAL_FINALIZED conflict policy.
-- =============================================================================
-- The CouchDB → PostgreSQL writeback in `src/lib/db/postgres.ts` resolves
-- conflicts on certain clinical tables with a conditional UPSERT:
--
--     INSERT … ON CONFLICT (id) DO UPDATE SET …
--     WHERE <table>.status NOT IN ('closed','resolved','cancelled','finalized')
--       AND incoming.updated_at >= COALESCE(<table>.updated_at, '1970-01-01')
--
-- The WHERE clause is evaluated against the conflicting row's existing
-- (id, status, updated_at). The PRIMARY KEY (id) lookup is already cheap, but
-- the planner reads the full row to check status / updated_at. A composite
-- (id, status, updated_at) covering index lets the guard be answered from the
-- index alone, keeping the per-change writeback latency flat as the tables
-- grow.
--
-- Idempotent: every statement uses `CREATE INDEX IF NOT EXISTS …` so a
-- replay of this migration on an already-migrated database is a no-op. We
-- deliberately do not DROP or ALTER any object — this migration is purely
-- additive.
-- =============================================================================

-- Tables governed by ConflictPolicy.CLINICAL_FINALIZED. Keep in sync with
-- TABLE_CONFLICT_POLICY in src/lib/db/postgres.ts.

CREATE INDEX IF NOT EXISTS idx_medical_records_finalized
  ON medical_records (id, updated_at);

CREATE INDEX IF NOT EXISTS idx_lab_results_finalized
  ON lab_results (id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_prescriptions_finalized
  ON prescriptions (id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_births_finalized
  ON births (id, updated_at);

CREATE INDEX IF NOT EXISTS idx_deaths_finalized
  ON deaths (id, updated_at);

CREATE INDEX IF NOT EXISTS idx_referrals_finalized
  ON referrals (id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_disease_alerts_finalized
  ON disease_alerts (id, status, updated_at);
