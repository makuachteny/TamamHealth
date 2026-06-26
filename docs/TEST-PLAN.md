# TamamHealth Health Information System - Comprehensive Test Plan

**Version:** 1.0
**Date:** 2026-02-21
**Application:** TamamHealth (SafeguardJunub)
**URL:** https://tamamhealth-tau.vercel.app
**Repository:** github.com/makuachteny/safeguard-junub-tamamhealth

---

## 1. Executive Summary

This test plan covers end-to-end testing of the TamamHealth Health Information System, an offline-first Electronic Health Record (EHR) for South Sudan. Testing covers all clinical workflows, data integrity, security controls, and performance across all 11 user roles.

---

## 2. Test Accounts

Passwords are generated per installation. Read them from the one-time seed output
or the gitignored `platform/.seed-credentials.json` file; never record them in
this test plan.

| Role | Username | Hospital |
|------|----------|----------|
| Super Admin | superadmin | N/A |
| Government | admin | N/A |
| Doctor | dr.wani | Juba Teaching Hospital |
| Clinical Officer | co.deng | Wau State Hospital |
| Nurse | nurse.stella | Malakal Teaching Hospital |
| Lab Tech | lab.gatluak | Bentiu State Hospital |
| Pharmacist | pharma.rose | Juba Teaching Hospital |
| Front Desk | desk.amira | Juba Teaching Hospital |
| Boma Health Worker | bhw.akol | Kajo-keji Boma PHCU |
| Payam Supervisor | sup.mary | Kajo-keji PHCC |
| Org Admin | org.admin | N/A |

---

## 3. Functional Testing

### 3.1 Authentication & Authorization

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-AUTH-01 | Login with valid credentials | Enter `dr.wani` and its generated seed password | Redirects to doctor dashboard | Critical |
| F-AUTH-02 | Login with invalid password | Enter dr.wani / wrong | Shows error, no redirect | Critical |
| F-AUTH-03 | Login with non-existent user | Enter nobody / test | Shows error | Critical |
| F-AUTH-04 | Session persistence | Login, close tab, reopen | Still logged in | High |
| F-AUTH-05 | Logout | Click logout button | Returns to login page, cookie cleared | High |
| F-AUTH-06 | Role-based routing | Login as each role | Each redirects to correct dashboard | Critical |
| F-AUTH-07 | Route protection | Access /consultation without login | Redirects to /login | Critical |
| F-AUTH-08 | Role guard | Access /consultation as pharmacist | Shows "Access Restricted" | High |
| F-AUTH-09 | Disabled account | Attempt login with disabled user | Shows error, login blocked | High |
| F-AUTH-10 | Token expiry | Wait 24h+ with stale token | Redirects to login on next navigation | Medium |

### 3.2 Patient Registration (Front Desk)

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-REG-01 | Register new patient | Fill all required fields, save | Patient created with hospital number | Critical |
| F-REG-02 | Hospital number format | Register patient at JTH | Number starts with JTH- prefix | High |
| F-REG-03 | Duplicate prevention | Register two patients with same name | Both created with unique IDs | Medium |
| F-REG-04 | Required field validation | Submit with empty first name | Shows validation error | High |
| F-REG-05 | Patient search | Search by name or hospital number | Correct results returned | Critical |
| F-REG-06 | Patient details view | Click patient in list | Full details displayed | High |
| F-REG-07 | Edit patient info | Update patient phone number | Change persists after reload | High |
| F-REG-08 | Gender validation | Register with Male/Female/Unknown | All accepted | Medium |

### 3.3 Doctor Consultation

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-CON-01 | Create consultation | Select patient, fill complaint, save | Medical record created | Critical |
| F-CON-02 | Patient search in consultation | Type patient name in search | Dropdown shows matching patients | High |
| F-CON-03 | Vital signs entry | Enter all vital signs | BMI auto-calculated, values saved | High |
| F-CON-04 | ICD-10 diagnosis search | Search "malaria" | Shows B50.x codes | High |
| F-CON-05 | Add multiple diagnoses | Add primary + secondary | Both saved with correct type | High |
| F-CON-06 | Diagnosis severity | Set severity to mild/moderate/severe | Severity saved correctly per diagnosis | High |
| F-CON-07 | Prescription entry | Add medication with dose/route/frequency | Prescription created in DB | Critical |
| F-CON-08 | Prescription instructions | Enter "Take with food" | Instructions saved with prescription | Medium |
| F-CON-09 | Lab order creation | Check "Malaria RDT" and "FBC" | Lab orders appear in Lab module | Critical |
| F-CON-10 | Prescription to pharmacy | Add Coartem prescription, save | Appears in Pharmacy prescription queue | Critical |
| F-CON-11 | AI Clinical Evaluation | Enter complaint + vitals, run AI | Suggestions shown with confidence % | Medium |
| F-CON-12 | Accept AI diagnosis | Click "Add" on AI suggestion | Added to diagnosis list with AI severity | Medium |
| F-CON-13 | Accept AI lab test | Click lab test recommendation | Test checkbox becomes checked | Medium |
| F-CON-14 | Clinical Scribe | Open AI Scribe, enter notes | Fields auto-populated | Low |
| F-CON-15 | File attachments | Upload scan/X-ray image | Attachment saved with consultation | Medium |
| F-CON-16 | Follow-up scheduling | Set follow-up date + reason | Follow-up saved in record | Medium |
| F-CON-17 | Referral from consultation | Check referral, select hospital | Referral data saved | High |
| F-CON-18 | Post-save navigation | Save consultation | Redirects to /patients | Medium |

### 3.4 Laboratory

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-LAB-01 | View pending orders | Login as lab tech | See all pending lab orders | Critical |
| F-LAB-02 | Accept lab order | Click "Accept" on pending order | Status changes to "In Progress" | High |
| F-LAB-03 | Enter lab result | Click "Enter Result", type value | Result saved, status = completed | Critical |
| F-LAB-04 | Consultation-generated orders | Doctor orders Malaria RDT | Appears in lab tech queue | Critical |
| F-LAB-05 | Filter by status | Click "Pending" filter | Only pending orders shown | Medium |
| F-LAB-06 | Search lab orders | Search by patient name | Correct orders filtered | Medium |
| F-LAB-07 | Stats accuracy | Check stat counts | Match actual data in table | Medium |

### 3.5 Pharmacy

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-PH-01 | View prescription queue | Login as pharmacist | See all prescriptions from DB | Critical |
| F-PH-02 | Dispense medication | Click "Dispense" on pending Rx | Status changes to "dispensed", timestamp set | Critical |
| F-PH-03 | Consultation prescriptions appear | Doctor saves consultation with Rx | New Rx appears in pharmacy queue | Critical |
| F-PH-04 | Non-pharmacist access | Login as nurse, view pharmacy | "Pharmacist only" shown on actions | High |
| F-PH-05 | Search prescriptions | Search by patient or medication | Correct results | Medium |
| F-PH-06 | Inventory view | Switch to Inventory tab | Medication stock levels shown | Medium |
| F-PH-07 | Dispensed count | Dispense 2 prescriptions | "Dispensed Today" stat updates | Medium |

### 3.6 Referrals & Transfers

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-REF-01 | Create referral | Fill referral form, submit | Referral created with status "pending" | High |
| F-REF-02 | Accept referral | Click "Accept" on incoming referral | Status = "seen", patient transferred | Critical |
| F-REF-03 | Patient transfer on accept | Accept referral to Hospital B | Patient's registrationHospital updated to B | Critical |
| F-REF-04 | Reject referral | Click "Decline" | Status = "rejected" | Medium |
| F-REF-05 | Emergency referral | Create emergency referral | Emergency badge + warning shown | Medium |

### 3.7 Boma Health Worker

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-BHW-01 | Record community visit | Fill visit form, save | Boma visit document created | High |
| F-BHW-02 | New patient creation | Select "Enter new patient manually" | Patient document also created | High |
| F-BHW-03 | Existing patient search | Search by geocode/name | Patient found and linked | Medium |
| F-BHW-04 | Visit dashboard stats | View dashboard after visits | Stats reflect visit data | Medium |

### 3.8 Government Dashboard

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-GOV-01 | National statistics | Login as gov.minister | Total patients from actual DB count | High |
| F-GOV-02 | Hospital performance | View hospital table | Correct counts per hospital | Medium |
| F-GOV-03 | Disease surveillance | View epidemic intelligence | Disease alerts and trends shown | Medium |

### 3.9 Navigation & UI Completeness

| # | Test Case | Steps | Expected Result | Priority |
|---|-----------|-------|-----------------|----------|
| F-NAV-01 | All sidebar links work | Click each sidebar item | Page loads without error | High |
| F-NAV-02 | Sidebar collapse | Click collapse button | Sidebar collapses, content expands | Medium |
| F-NAV-03 | Mobile sidebar | Open on mobile device | Hamburger menu works | Medium |
| F-NAV-04 | Global search | Type in top bar search | Relevant results in current page | Medium |
| F-NAV-05 | Theme toggle | Click dark/light toggle | Theme switches, persists on reload | Medium |
| F-NAV-06 | Breadcrumb navigation | Navigate deep, click back | Returns to correct page | Low |

---

## 4. Non-Functional Testing

### 4.1 Performance

| # | Test Case | Expected Result | Priority |
|---|-----------|-----------------|----------|
| NF-PERF-01 | Initial page load | Login page loads in < 3s on 3G | High |
| NF-PERF-02 | Dashboard render | Dashboard renders in < 2s with 50+ patients | High |
| NF-PERF-03 | Patient search latency | Results appear in < 500ms for 500 patients | Medium |
| NF-PERF-04 | Consultation save time | Full consultation saves in < 2s | High |
| NF-PERF-05 | Offline mode | App continues to work without network | Critical |
| NF-PERF-06 | Service worker caching | Pages load from cache when offline | High |

### 4.2 Security & Compliance

| # | Test Case | Expected Result | Priority |
|---|-----------|-----------------|----------|
| NF-SEC-01 | JWT token validation | Invalid tokens rejected by middleware | Critical |
| NF-SEC-02 | Route protection | Unauthenticated access blocked | Critical |
| NF-SEC-03 | Role-based access control | Users can only access role-permitted pages | Critical |
| NF-SEC-04 | Password storage | Passwords hashed with bcrypt | Critical |
| NF-SEC-05 | Audit logging | Login, logout, CRUD actions logged | High |
| NF-SEC-06 | Session timeout | Token expires after 24 hours | Medium |
| NF-SEC-07 | Data scoping (org) | Users only see their organization's data | High |
| NF-SEC-08 | Data scoping (hospital) | Hospital staff only see their hospital data | High |
| NF-SEC-09 | HTTPS enforcement | Production uses HTTPS (Vercel default) | Critical |
| NF-SEC-10 | XSS prevention | User input is sanitized/escaped in React | High |

### 4.3 HIPAA-Relevant Controls

| # | Control | Status | Notes |
|---|---------|--------|-------|
| HIPAA-01 | Access controls | Implemented | 11-role RBAC with middleware |
| HIPAA-02 | Audit trail | Implemented | All actions logged in tamamhealth_audit_log |
| HIPAA-03 | Unique user identification | Implemented | Per-user accounts with JWT |
| HIPAA-04 | Automatic session timeout | Partial | 24h token expiry, no idle timeout |
| HIPAA-05 | Encryption in transit | Implemented | HTTPS via Vercel |
| HIPAA-06 | Encryption at rest | Not implemented | PouchDB data unencrypted in IndexedDB |
| HIPAA-07 | Data integrity | Implemented | PouchDB revision tracking |
| HIPAA-08 | Minimum necessary access | Implemented | Role-based data scoping |

---

## 5. Usability Testing

| # | Test Case | Expected Result | Priority |
|---|-----------|-----------------|----------|
| U-01 | First-time user onboarding | Demo accounts visible on login page | High |
| U-02 | Mobile responsiveness | All pages usable on 375px width | High |
| U-03 | Error messages clarity | Errors describe what went wrong | Medium |
| U-04 | Form field labels | All inputs have clear labels | Medium |
| U-05 | Loading states | Spinners shown during async operations | Medium |
| U-06 | Empty states | Meaningful messages when no data | Medium |
| U-07 | Color contrast | Text readable in dark and light mode | Medium |
| U-08 | Touch targets | Buttons at least 44x44px on mobile | Low |

---

## 6. Regression Testing

After each fix, verify these critical paths still work:

| # | Regression Test | Covers |
|---|----------------|--------|
| R-01 | Login → Dashboard → Logout | Auth flow |
| R-02 | Register patient → View in list | Patient CRUD |
| R-03 | Consultation → Lab order appears | Data flow |
| R-04 | Consultation → Prescription appears in pharmacy | Data flow |
| R-05 | Create referral → Accept → Patient transferred | Referral flow |
| R-06 | Theme toggle persists | Settings |
| R-07 | Offline functionality | PWA/Service Worker |

---

## 7. Test Results Summary

### Data Flow Fixes Applied (2026-02-21)

| Issue | Before | After | Status |
|-------|--------|-------|--------|
| Consultation -> Lab orders | `labResults: []` always empty | Lab orders created in `tamamhealth_lab_results` DB | FIXED |
| Consultation -> Pharmacy | Prescriptions only in MedicalRecord | Prescriptions created in `tamamhealth_prescriptions` DB | FIXED |
| Pharmacy mock data | Hardcoded 6 prescriptions | Reads from PouchDB `tamamhealth_prescriptions` | FIXED |
| Diagnosis severity | Hardcoded `'moderate'` | Per-diagnosis severity selector (mild/moderate/severe) | FIXED |
| Prescription instructions | Always empty `''` | Instructions input field added | FIXED |
| Pharmacy dispense | Only updated local state | Persists to DB via `dispensePrescription()` | FIXED |
| Government patient count | Used `h.patientCount` (static) | Uses actual PouchDB patient count | FIXED (prior) |
| Referral patient transfer | Only status changed | Patient `registrationHospital` updated | FIXED (prior) |
| Boma visit patient creation | No patient record created | PatientDoc created for new patients | FIXED (prior) |

### Known Limitations

1. **Inventory management** - Still uses mock data (no inventory DB). Acceptable for MVP.
2. **Lab result → Medical record linking** - Lab results not back-linked to patient record when completed. Lab tech enters results but they don't auto-update the consultation's medical record.
3. **No idle session timeout** - Only 24h token expiry, no inactivity logout.
4. **PouchDB data not encrypted at rest** - IndexedDB contents visible in browser dev tools.
5. **Demo credentials visible** - Login page shows all demo accounts with passwords.

---

## 8. Risk-Based Test Priority

**Critical Path (Must Pass):**
1. Login works across all roles
2. Patient registration creates valid records
3. Doctor consultation saves to all 3 DBs (medical records, lab, prescriptions)
4. Lab tech can view and process orders from consultations
5. Pharmacist can view and dispense prescriptions from consultations
6. Referral acceptance transfers patient ownership

**High Priority:**
7. All sidebar navigation links work
8. Role-based access control blocks unauthorized pages
9. Dark/light theme toggle works
10. Data scoping filters by organization and hospital

**Medium Priority:**
11. AI clinical evaluation produces reasonable suggestions
12. Boma health worker visit recording
13. Government dashboard statistics accuracy
14. Search and filter functionality across all modules

---

## 9. Recommendations

1. **Add idle session timeout** (15-30 min) for HIPAA compliance
2. **Encrypt PouchDB at rest** using `crypto-pouch` plugin
3. **Remove demo credentials** from production login page or gate behind a flag
4. **Add CSRF tokens** for state-changing operations
5. **Link lab results back** to medical records when completed
6. **Build real inventory management** module with stock tracking
7. **Add unit tests** for critical services (auth, patient, lab, prescription)
8. **Add E2E tests** with Playwright or Cypress for the critical paths above
