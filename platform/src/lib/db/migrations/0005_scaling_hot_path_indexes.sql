-- =============================================================================
-- 0005 — Scaling hot-path indexes.
-- =============================================================================
-- The earlier migrations were sized for the demo data set (~50 patients across
-- 6 hospitals). Production targets — 10k patients / 1M records / 50 hospitals —
-- expose three classes of unindexed reads that are fine on 50 rows and ruinous
-- on a million:
--
--   1. audit_log: every CLINICAL_FINALIZED writeback inserts a row, every
--      compliance UI query reads a window of recent rows for one user. Without
--      a composite (user_id, created_at DESC) index, the dashboard scans the
--      full append-only table and sorts in memory.
--   2. patients: the offline-first hooks watch `updated_at` to decide which
--      rows to re-render after a sync flush. A solo b-tree on `updated_at`
--      makes the planner happy for "rows changed since X". The sort key for
--      cursor pagination ("show me the next 100 patients in registration
--      order") needs the same column too.
--   3. controlled_substance_log / ledger_entries: append-only regulatory
--      tables that are queried by (created_at DESC, facility_id). At a
--      million entries the existing single-column indexes still trigger a
--      sort step; an explicit composite avoids it.
--
-- The migration is purely additive (CREATE INDEX IF NOT EXISTS) and safe to
-- replay. No DROP/ALTER, no online rewrite — Postgres builds these
-- concurrently in production via `CREATE INDEX CONCURRENTLY` if you wrap the
-- DDL with that flag at deploy time. This file uses the standard form so the
-- migration runner stays inside its single transaction.
-- =============================================================================

-- ===== audit_log ============================================================
-- Compliance UI: "show me the last 50 actions for user X". Without the
-- composite the planner picks idx_audit_user, fetches every match, then
-- in-memory sorts on created_at — at scale that's hundreds of MB of sort
-- buffer per page render.
CREATE INDEX IF NOT EXISTS idx_audit_user_created_at
  ON audit_log (user_id, created_at DESC);

-- Time-series queries (e.g. "audit events in the last 24h" for the security
-- dashboard) skip the user predicate and just need created_at on its own.
CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_log (created_at DESC);

-- Per-org compliance roll-ups need (org_id, created_at) — the existing
-- idx_audit_action does not help here.
CREATE INDEX IF NOT EXISTS idx_audit_org_created_at
  ON audit_log (org_id, created_at DESC);

-- ===== patients =============================================================
-- "What's changed since last sync?" — backs the analytics writeback's
-- cursor-based reads.
CREATE INDEX IF NOT EXISTS idx_patients_updated_at
  ON patients (updated_at DESC);

-- The CLINICAL_FINALIZED guard for tables governed by that policy already has
-- (id, status, updated_at) covering indexes from migration 0002. patients is
-- LAST_WRITE_WINS so a single-column updated_at suffices.

-- ===== medical_records ======================================================
-- The patient timeline page filters by patient_id and orders by visit_date.
-- The existing idx_medical_records_patient is a single column; adding the
-- visit_date trailer avoids the sort.
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_visit
  ON medical_records (patient_id, visit_date DESC);

-- Hospital-scope dashboards filter by hospital_id but the original schema only
-- has org-scoped indexes. Adding a single-column idx unblocks per-facility
-- queries (e.g. "today's records at JTH").
CREATE INDEX IF NOT EXISTS idx_medical_records_hospital
  ON medical_records (hospital_id);

-- ===== lab_results ==========================================================
-- Lab queue page: "show me pending results at this hospital, oldest first".
-- The hospital_id column was previously unindexed.
CREATE INDEX IF NOT EXISTS idx_lab_results_hospital
  ON lab_results (hospital_id);

CREATE INDEX IF NOT EXISTS idx_lab_results_ordered_at
  ON lab_results (ordered_at DESC);

-- ===== prescriptions ========================================================
-- Pharmacy work queue groups by hospital + status; org_id covers analytics.
CREATE INDEX IF NOT EXISTS idx_prescriptions_hospital
  ON prescriptions (hospital_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_status
  ON prescriptions (status);

CREATE INDEX IF NOT EXISTS idx_prescriptions_org
  ON prescriptions (org_id);

-- ===== referrals ============================================================
-- Inbound / outbound work queues per facility — no FK index existed before.
CREATE INDEX IF NOT EXISTS idx_referrals_to_hospital
  ON referrals (to_hospital_id);

CREATE INDEX IF NOT EXISTS idx_referrals_from_hospital
  ON referrals (from_hospital_id);

-- ===== controlled_substance_log =============================================
-- DEA / SSDFCA chain-of-custody read patterns: "all movements at this facility
-- in the last 30 days". Append-only so an index on (facility_id, created_at)
-- is the natural choice; no UPDATE penalty.
CREATE INDEX IF NOT EXISTS idx_controlled_log_facility_created_at
  ON controlled_substance_log (facility_id, created_at DESC);

-- ===== ledger_entries =======================================================
-- Patient financial chain ("show me ledger for patient X, newest first").
CREATE INDEX IF NOT EXISTS idx_ledger_patient_created_at
  ON ledger_entries (patient_id, created_at DESC);

-- ===== messages =============================================================
-- Patient inbox / outbox queries: scan by recipient and time.
CREATE INDEX IF NOT EXISTS idx_messages_patient_sent_at
  ON messages (patient_id, sent_at DESC);

-- ===== triage_events ========================================================
-- "Active RED queue at this facility" — the existing idx_triage_events_facility
-- works for the facility predicate; this composite avoids the sort step.
CREATE INDEX IF NOT EXISTS idx_triage_events_facility_triaged_at
  ON triage_events (facility_id, triaged_at DESC);

-- ===== appointments =========================================================
-- Provider day-view: appointments for one provider on one date. The pre-existing
-- single-column indexes force a hash join + sort.
CREATE INDEX IF NOT EXISTS idx_appointments_provider_date
  ON appointments (provider_id, appointment_date);

-- ===== payments / invoices ==================================================
-- Revenue-cycle dashboards filter by status + processed_at / due_date.
CREATE INDEX IF NOT EXISTS idx_payments_status_processed_at
  ON payments (status, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status_due
  ON invoices (status, due_date);
