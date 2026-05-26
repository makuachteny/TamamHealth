-- =============================================================================
-- 0004 — Phase 3 analytics writeback: messaging, financial revenue cycle,
--        regulatory append-only logs, operations, HR, facility infrastructure.
-- =============================================================================
-- Adds PostgreSQL projections for the remaining CouchDB databases that
-- participated in sync but had no analytics writeback. Each table is the
-- analytics-bound mirror of its CouchDB counterpart in DATABASE_SYNC_CONFIGS.
--
-- Mapping (CouchDB → SQL table) added to DB_TABLE_MAP in
--   src/app/api/sync/route.ts
-- and the corresponding FIELD_MAPPERS entries land alongside.
--
-- Conflict policies live in src/lib/db/postgres.ts:TABLE_CONFLICT_POLICY.
-- Append-only tables (audit_log was Phase 1; ledger_entries and
-- controlled_substance_log are added here) carry APPEND_ONLY semantics.
-- Mutable lookup data (insurance_policies, fee_schedule, pharmacy_inventory,
-- wards, blood_bank, assets, staff_schedules, leave_requests, payroll_entries,
-- patient_feedback, emergency_plans, messages, telehealth_sessions, billing,
-- charges, eligibility_checks, claims, adjustments, payments, refunds,
-- payment_plans, invoices) defaults to LAST_WRITE_WINS unless a finalized
-- workflow demands otherwise.
--
-- All CREATE statements use IF NOT EXISTS so the migration is purely
-- additive and safe to replay.
-- =============================================================================

-- ===== Messages (clinician ↔ patient ↔ clinician) =====
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  recipient_type TEXT,                          -- patient | staff
  direction TEXT,                               -- staff_to_patient | patient_to_staff | staff_to_staff
  patient_id TEXT,
  patient_name TEXT,
  patient_phone TEXT,
  from_doctor_id TEXT,
  from_doctor_name TEXT,
  from_hospital_id TEXT,
  from_hospital_name TEXT,
  subject TEXT,
  body TEXT,
  channel TEXT,                                 -- app | sms | both
  status TEXT,                                  -- sent | delivered | failed
  sent_at TIMESTAMPTZ,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_patient ON messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);

-- ===== Controlled Substance Log (APPEND_ONLY — DEA / SSDFCA chain of custody) =====
CREATE TABLE IF NOT EXISTS controlled_substance_log (
  id TEXT PRIMARY KEY,
  inventory_id TEXT,
  medication_name TEXT,
  schedule TEXT,
  movement TEXT,                                -- intake | dispense | waste | reconciliation | transfer
  quantity NUMERIC,
  unit TEXT,
  before_balance NUMERIC,
  after_balance NUMERIC,
  patient_id TEXT,
  patient_name TEXT,
  prescription_id TEXT,
  operator_id TEXT,
  operator_name TEXT,
  witness_id TEXT,
  witness_name TEXT,
  reason TEXT,
  facility_id TEXT,
  facility_name TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controlled_log_med ON controlled_substance_log(medication_name);
CREATE INDEX IF NOT EXISTS idx_controlled_log_facility ON controlled_substance_log(facility_id);
CREATE INDEX IF NOT EXISTS idx_controlled_log_inventory ON controlled_substance_log(inventory_id);

-- ===== Pharmacy Inventory =====
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id TEXT PRIMARY KEY,
  hospital_id TEXT,
  hospital_name TEXT,
  medication_name TEXT,
  category TEXT,
  stock_level NUMERIC,
  unit TEXT,
  reorder_level NUMERIC,
  batch_number TEXT,
  expiry_date DATE,
  last_received TIMESTAMPTZ,
  last_dispensed TIMESTAMPTZ,
  dispensed_today NUMERIC,
  controlled_schedule TEXT,
  requires_witness BOOLEAN,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_hospital ON pharmacy_inventory(hospital_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_med ON pharmacy_inventory(medication_name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_expiry ON pharmacy_inventory(expiry_date);

-- ===== Telehealth Sessions =====
CREATE TABLE IF NOT EXISTS telehealth_sessions (
  id TEXT PRIMARY KEY,
  appointment_id TEXT,
  patient_id TEXT,
  patient_name TEXT,
  provider_id TEXT,
  provider_name TEXT,
  facility_id TEXT,
  facility_name TEXT,
  session_type TEXT,                            -- video | audio | chat
  scheduled_date DATE,
  scheduled_time TEXT,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  chief_complaint TEXT,
  diagnosis TEXT,
  icd10_code TEXT,
  follow_up_required BOOLEAN,
  referral_required BOOLEAN,
  session_quality TEXT,
  connection_drops INTEGER,
  patient_consent_given BOOLEAN,
  session_recorded BOOLEAN,
  patient_rating INTEGER,
  consultation_fee NUMERIC,
  currency TEXT,
  payment_status TEXT,
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telehealth_provider ON telehealth_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_telehealth_facility ON telehealth_sessions(facility_id);
CREATE INDEX IF NOT EXISTS idx_telehealth_status ON telehealth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_telehealth_finalized
  ON telehealth_sessions (id, status, updated_at);

-- ===== Wards =====
CREATE TABLE IF NOT EXISTS wards (
  id TEXT PRIMARY KEY,
  name TEXT,
  ward_type TEXT,
  facility_id TEXT,
  facility_name TEXT,
  facility_level TEXT,
  floor TEXT,
  total_beds INTEGER,
  occupied_beds INTEGER,
  available_beds INTEGER,
  nurse_in_charge TEXT,
  is_active BOOLEAN,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wards_facility ON wards(facility_id);

-- ===== Blood Bank =====
CREATE TABLE IF NOT EXISTS blood_bank (
  id TEXT PRIMARY KEY,
  unit_id TEXT,
  blood_group TEXT,
  component TEXT,
  volume INTEGER,
  collection_date DATE,
  expiry_date DATE,
  donor_id TEXT,
  donor_name TEXT,
  status TEXT,
  facility_id TEXT,
  facility_name TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_bank_facility ON blood_bank(facility_id);
CREATE INDEX IF NOT EXISTS idx_blood_bank_group ON blood_bank(blood_group);
CREATE INDEX IF NOT EXISTS idx_blood_bank_expiry ON blood_bank(expiry_date);

-- ===== Emergency Plans =====
CREATE TABLE IF NOT EXISTS emergency_plans (
  id TEXT PRIMARY KEY,
  plan_name TEXT,
  emergency_type TEXT,
  phase TEXT,
  severity TEXT,
  description TEXT,
  facility_id TEXT,
  facility_name TEXT,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  estimated_capacity INTEGER,
  current_load INTEGER,
  total_cases_managed INTEGER,
  total_deaths INTEGER,
  total_referrals_out INTEGER,
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_plans_facility ON emergency_plans(facility_id);
CREATE INDEX IF NOT EXISTS idx_emergency_plans_phase ON emergency_plans(phase);
CREATE INDEX IF NOT EXISTS idx_emergency_plans_state ON emergency_plans(state);

-- ===== Assets =====
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT,
  serial_number TEXT,
  asset_tag TEXT,
  category TEXT,
  manufacturer TEXT,
  model TEXT,
  facility_id TEXT,
  facility_name TEXT,
  facility_level TEXT,
  department TEXT,
  location TEXT,
  status TEXT,
  condition TEXT,
  acquired_date DATE,
  cost_currency TEXT,
  cost NUMERIC,
  donor TEXT,
  warranty_expires_at DATE,
  last_serviced_at TIMESTAMPTZ,
  next_service_due_at TIMESTAMPTZ,
  service_interval_months INTEGER,
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_facility ON assets(facility_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);

-- ===== Staff Schedules =====
CREATE TABLE IF NOT EXISTS staff_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  role TEXT,
  facility_id TEXT,
  facility_name TEXT,
  shift_type TEXT,
  shift_date DATE,
  start_time TEXT,
  end_time TEXT,
  department TEXT,
  is_on_call BOOLEAN,
  status TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_user ON staff_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date ON staff_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_facility ON staff_schedules(facility_id);

-- ===== Leave Requests =====
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  role TEXT,
  facility_id TEXT,
  facility_name TEXT,
  leave_type TEXT,
  start_date DATE,
  end_date DATE,
  days INTEGER,
  reason TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_facility ON leave_requests(facility_id);

-- ===== Payroll Entries =====
CREATE TABLE IF NOT EXISTS payroll_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  role TEXT,
  facility_id TEXT,
  facility_name TEXT,
  period TEXT,
  base_salary NUMERIC,
  allowances NUMERIC,
  deductions NUMERIC,
  net_pay NUMERIC,
  currency TEXT,
  status TEXT,
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_user ON payroll_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_entries(period);
CREATE INDEX IF NOT EXISTS idx_payroll_facility ON payroll_entries(facility_id);

-- ===== Patient Feedback =====
CREATE TABLE IF NOT EXISTS patient_feedback (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  facility_id TEXT,
  facility_name TEXT,
  department TEXT,
  visit_date DATE,
  rating INTEGER,
  nps_score INTEGER,
  sentiment TEXT,
  category TEXT,
  comment TEXT,
  channel TEXT,
  follow_up_required BOOLEAN,
  follow_up_status TEXT,
  resolved_at TIMESTAMPTZ,
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_facility ON patient_feedback(facility_id);
CREATE INDEX IF NOT EXISTS idx_patient_feedback_sentiment ON patient_feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_patient_feedback_category ON patient_feedback(category);

-- ===== Billing (legacy bill ledger; superseded by claims/charges/invoices) =====
CREATE TABLE IF NOT EXISTS billing (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  facility_id TEXT,
  facility_name TEXT,
  facility_level TEXT,
  encounter_date DATE,
  encounter_id TEXT,
  appointment_id TEXT,
  subtotal NUMERIC,
  discount NUMERIC,
  tax_rate NUMERIC,
  tax_amount NUMERIC,
  total_amount NUMERIC,
  amount_paid NUMERIC,
  balance_due NUMERIC,
  currency TEXT,
  status TEXT,
  invoice_number TEXT,
  insurance_provider TEXT,
  insurance_claim_status TEXT,
  insurance_approved_amount NUMERIC,
  state TEXT,
  county TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_patient ON billing(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_facility ON billing(facility_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing(status);
CREATE INDEX IF NOT EXISTS idx_billing_finalized
  ON billing (id, status, updated_at);

-- ===== Fee Schedule =====
CREATE TABLE IF NOT EXISTS fee_schedule (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  facility_name TEXT,
  category TEXT,
  service_code TEXT,
  service_name TEXT,
  unit_price NUMERIC,
  currency TEXT,
  is_active BOOLEAN,
  effective_from DATE,
  effective_to DATE,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_schedule_facility ON fee_schedule(facility_id);
CREATE INDEX IF NOT EXISTS idx_fee_schedule_service ON fee_schedule(service_code);

-- ===== Insurance Policies =====
CREATE TABLE IF NOT EXISTS insurance_policies (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  payer_type TEXT,
  payer_name TEXT,
  payer_code TEXT,
  member_id TEXT,
  group_number TEXT,
  policy_number TEXT,
  subscriber_name TEXT,
  subscriber_relationship TEXT,
  effective_date DATE,
  termination_date DATE,
  is_primary BOOLEAN,
  copay_amount NUMERIC,
  coinsurance_pct NUMERIC,
  deductible_amount NUMERIC,
  deductible_remaining NUMERIC,
  oop_max NUMERIC,
  oop_used NUMERIC,
  is_active BOOLEAN,
  donor_program_id TEXT,
  donor_coverage_type TEXT,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_patient ON insurance_policies(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_payer ON insurance_policies(payer_name);
CREATE INDEX IF NOT EXISTS idx_insurance_facility ON insurance_policies(facility_id);

-- ===== Eligibility Checks =====
CREATE TABLE IF NOT EXISTS eligibility_checks (
  id TEXT PRIMARY KEY,
  policy_id TEXT,
  patient_id TEXT,
  check_date DATE,
  status TEXT,
  deductible_remaining NUMERIC,
  copay_amount NUMERIC,
  coinsurance_pct NUMERIC,
  oop_used NUMERIC,
  oop_max NUMERIC,
  estimated_patient_responsibility NUMERIC,
  source TEXT,
  expires_at TIMESTAMPTZ,
  checked_by TEXT,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eligibility_policy ON eligibility_checks(policy_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_patient ON eligibility_checks(patient_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_status ON eligibility_checks(status);

-- ===== Charges =====
CREATE TABLE IF NOT EXISTS charges (
  id TEXT PRIMARY KEY,
  encounter_id TEXT,
  patient_id TEXT,
  cpt_code TEXT,
  modifier TEXT,
  description TEXT,
  category TEXT,
  units NUMERIC,
  billed_amount NUMERIC,
  allowed_amount NUMERIC,
  status TEXT,
  claim_id TEXT,
  denial_reason_code TEXT,
  service_date DATE,
  provider_id TEXT,
  provider_name TEXT,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charges_encounter ON charges(encounter_id);
CREATE INDEX IF NOT EXISTS idx_charges_patient ON charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
CREATE INDEX IF NOT EXISTS idx_charges_finalized
  ON charges (id, status, updated_at);

-- ===== Claims =====
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  encounter_id TEXT,
  patient_id TEXT,
  patient_name TEXT,
  policy_id TEXT,
  payer_name TEXT,
  payer_type TEXT,
  claim_number TEXT,
  total_billed NUMERIC,
  total_allowed NUMERIC,
  total_approved NUMERIC,
  total_denied NUMERIC,
  total_write_off NUMERIC,
  patient_responsibility NUMERIC,
  submitted_date DATE,
  adjudicated_date DATE,
  status TEXT,
  era_reference TEXT,
  donor_reporting_period TEXT,
  submitted_by TEXT,
  facility_id TEXT,
  facility_name TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_payer ON claims(payer_name);
CREATE INDEX IF NOT EXISTS idx_claims_finalized
  ON claims (id, status, updated_at);

-- ===== Adjustments =====
CREATE TABLE IF NOT EXISTS adjustments (
  id TEXT PRIMARY KEY,
  encounter_id TEXT,
  patient_id TEXT,
  charge_id TEXT,
  claim_id TEXT,
  adjustment_type TEXT,
  amount NUMERIC,
  reason TEXT,
  reason_code TEXT,
  approved_by TEXT,
  approved_date DATE,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_patient ON adjustments(patient_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_claim ON adjustments(claim_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_type ON adjustments(adjustment_type);

-- ===== Payments =====
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  encounter_id TEXT,
  invoice_id TEXT,
  payment_plan_id TEXT,
  method TEXT,
  amount NUMERIC,
  currency TEXT,
  reference TEXT,
  mobile_money_phone TEXT,
  card_last4 TEXT,
  status TEXT,
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  reversed_at TIMESTAMPTZ,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_processed_at ON payments(processed_at);

-- ===== Refunds =====
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  patient_id TEXT,
  patient_name TEXT,
  amount NUMERIC,
  currency TEXT,
  method TEXT,
  reference TEXT,
  reason TEXT,
  status TEXT,
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_patient ON refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- ===== Payment Plans =====
CREATE TABLE IF NOT EXISTS payment_plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  patient_name TEXT,
  total_balance NUMERIC,
  term_months INTEGER,
  monthly_amount NUMERIC,
  apr NUMERIC,
  start_date DATE,
  end_date DATE,
  status TEXT,
  next_due_date DATE,
  paid_to_date NUMERIC,
  remaining_balance NUMERIC,
  missed_payments INTEGER,
  last_payment_date DATE,
  auto_pay_enabled BOOLEAN,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_patient ON payment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON payment_plans(status);

-- ===== Invoices =====
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT,
  patient_id TEXT,
  patient_name TEXT,
  encounter_id TEXT,
  subtotal NUMERIC,
  insurance_payments NUMERIC,
  adjustments NUMERIC,
  prior_payments NUMERIC,
  total_due NUMERIC,
  currency TEXT,
  issued_date DATE,
  due_date DATE,
  status TEXT,
  sent_via TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  facility_id TEXT,
  facility_name TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_finalized
  ON invoices (id, status, updated_at);

-- ===== Ledger Entries (APPEND_ONLY — patient financial chain) =====
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  encounter_id TEXT,
  entry_type TEXT,
  amount NUMERIC,
  running_balance NUMERIC,
  description TEXT,
  reference_id TEXT,
  reference_type TEXT,
  method TEXT,
  currency TEXT,
  facility_id TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_patient ON ledger_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_ledger_encounter ON ledger_entries(encounter_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_entries(entry_type);
