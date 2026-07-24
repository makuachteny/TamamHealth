# EMR Data-Flow & Field Audit — Reception to Ministry of Health

**Date:** 2026-07-22
**Method:** four parallel code audits (registration/appointments, triage/consultation, lab/pharmacy/billing/ward, DHIS2 reporting path), every claim verified against source with file:line. Builds on `WORKFLOW-GAP-AUDIT-2026-07.md` (journey gaps) and `DATA-FLOW-AUDIT-2026-07.md` (pipeline architecture) — those findings are referenced, not repeated.
**Context assumed:** South Sudan public facility; national HMIS = DHIS2; IDSR-style weekly surveillance; ICD-11 coding.

---

## 1 · The as-is data flow, and where it breaks

### What actually happens to a patient's data

```
REGISTRATION            PatientDoc (pat-{uuid}, hospitalNumber, geocodeId)
   │                       · no DB-enforced unique identifier
   │                       · geocodeId built WITHOUT patient suffix → household-level, collides
   ▼
APPOINTMENT / CHECK-IN  AppointmentDoc / TriageDoc
   │                       · check-in computes the matching appointmentId and DISCARDS it
   │                       · front desk fabricates all-normal ABCC next to a RED priority
   ▼
TRIAGE                  TriageDoc (vitals as strings)
   │                       · no link forward except patientId
   ▼
CONSULTATION            EncounterDoc + MedicalRecord
   │                       · encounter is the ONLY place with real start/end timestamps
   │                       · visitType hardcoded 'outpatient', department hardcoded 'Outpatient'
   │                       · ICD-11 code written into BOTH icd11Code and icd10Code
   ▼
ORDERS                  LabResultDoc / PrescriptionDoc
   │                       · imaging = LabResultDoc with specimen:'Imaging' (no accession/modality/report)
   │                       · lab completedAt = toLocaleTimeString() — a bare "02:45 PM", no date
   ▼
PHARMACY                dispense flips status; quantityDispensed and dispenser identity not stored
   │                       · single stockLevel per drug; restock overwrites batch/expiry; no FEFO
   ▼
CHECKOUT / DISCHARGE    Billing (free-text discount instead of exemption categories)
   │                       · ward death (status='deceased') and DeathRegistrationDoc are TWO
   │                         unlinked death paths → invisible or double-counted deaths
   ▼
"REPORTING"             generateDHIS2Export()
                            · ignores `period` — every value is ALL-TIME cumulative
                            · ignores `scope` — facility export contains all-tenant totals
                            · no PatientDoc join — no age/sex disaggregation (category:'default')
                            · zero morbidity elements — coded diagnoses never leave the facility
                            · surveillance numbers come from SEEDED DiseaseAlertDocs (mock)
```

### The five structural breaks

1. **No visit/encounter identifier threads the journey.** Registration, appointment, check-in and triage join only on `patientId` (+ timestamp proximity). `check-in-service.ts` even computes the matching `appointmentId` and returns it unused. `EncounterDoc.triageId`/`MedicalRecordDoc.encounterId` chain the *clinical* half only. Consequence: per-visit tallies (OPD attendance, new vs revisit, visit-level costing) cannot be reconstructed reliably.
2. **Aggregation is cumulative, unscoped, and partly fictional.** The DHIS2 export labels all-time, all-tenant totals with the requested month and facility; each push re-sends inflated cumulative counts. Surveillance and TB/malaria "cases" trace to seeded mock alerts, not case-level records.
3. **Coded clinical data dies at the facility.** ICD-11 diagnoses, cause-of-death rankings, positive/negative lab findings — all captured, none exported. The only diagnosis consumer is the write-only Postgres mirror (see DATA-FLOW-AUDIT meta-finding: two pipelines that never meet).
4. **Twice-entered / fabricated data.** Deaths are entered on the ward AND in the registry with no link (double-count or miss). Front-desk check-in fabricates a normal ETAT assessment. HPI is a copy of the chief complaint. Triage vitals are re-entered (and re-stringified) at consultation.
5. **Unclear ownership at handoffs.** Rooming lives on a triage field; provider assignment doesn't advance the encounter; checkout self-satisfies its gate (see WORKFLOW-GAP-AUDIT). Where the journey has no owner, the data has no capturer.

---

## 2 · Field audit by module (verdict summary)

Full tables with file:line live in the four audit transcripts; the decisions are:

### Reception / registration (PatientDoc)
| Field | Verdict | Action |
|---|---|---|
| `hospitalNumber` | broken guarantee | Enforce uniqueness at data layer (design-doc/unique index), keep human-readable format |
| `geocodeId` | wrong construction | Append the patient suffix (`-P{n}`) so it matches `patient-identity.ts` and stops colliding per household |
| `dateOfBirth` | optional | Mandatory, with explicit `dobEstimated: boolean` (keep `estimatedAge` entry as the input aid that computes a DOB) |
| `gender` | no unknown option | Add `'Unknown'` for unidentified/emergency patients |
| `payam`, `boma` | free text, optional | Mandatory, picked from the org-unit hierarchy (they are DHIS2 org-unit levels) |
| `tribe`, `primaryLanguage` | inverted priority | Make both optional; stop requiring language while DOB is skippable |
| `occupation` | missing | Add (optional string; standard registration + surveillance field) |
| Next of kin | OK | Keep mandatory (already right) |

### Appointments (AppointmentDoc)
| Field | Verdict | Action |
|---|---|---|
| `encounterId` | missing | Stamp when the visit materializes (see §3 to-be flow) |
| `department` | free string | Constrain to the facility's configured department list |
| everything else | OK | Provider ID, split date/time, status history are all sound |

### Triage (TriageDoc)
| Field | Verdict | Action |
|---|---|---|
| vitals (11 fields) | strings | Retype numeric (one shared `VitalSigns` shape with `MedicalRecord`) |
| ABCC at check-in | fabricated | Leave unset until a nurse assesses; add `assessmentSource: 'front_desk_stub' \| 'nurse_etat'` so stubs are distinguishable |
| `encounterId` | missing | Add — the check-in service already has the appointment in hand |
| `attendanceType` | missing | New case vs re-attendance, captured once at arrival |

### Consultation (MedicalRecord / EncounterDoc)
| Field | Verdict | Action |
|---|---|---|
| `visitType` | hardcoded 'outpatient' | Capture real encounter class (outpatient/inpatient/emergency/referral) |
| `department` | hardcoded 'Outpatient' | Capture the actual clinic/service point (the encounter knows its station) |
| `diagnoses[].icd10Code` | contains ICD-11 | Stop double-writing; keep `icd11Code` + `codeSystem` as the source of truth; keep `icd10Code` only for genuinely mapped ICD-10 |
| `historyOfPresentIllness` | alias of complaint | Real HPI capture (already on the History & ROS backlog in WORKFLOW-GAP-AUDIT) |
| encounter end | missing on record | Derive from `EncounterDoc.closedAt`; expose vitals via FHIR Observation |
| notifiable flag | dead | Wire `icd11-codes.notifiable` → auto-create surveillance alert on save (§4) |

### Lab / imaging (LabResultDoc)
| Field | Verdict | Action |
|---|---|---|
| `result` | one free-text string | Split: `valueNumeric` + `unit` + `referenceRange` for quantitative tests; `valueCoded` (positive/negative/reactive…) for RDTs/serology; keep free text for micro/notes |
| `completedAt` | bare local time | Full ISO timestamps: `collectedAt`, `receivedAt`, `resultedAt` (enables TAT + valid FHIR) |
| performer | missing | `resultedBy` (user id + name) |
| test coding | name only | Add LOINC (or interim national code) alongside `testName` |
| imaging | shoehorned | Separate `ImagingStudyDoc`: accession, modality, bodySite, report text, radiologist — or at minimum those fields gated on the imaging branch |

### Pharmacy (PrescriptionDoc / PharmacyInventoryDoc)
| Field | Verdict | Action |
|---|---|---|
| `quantityDispensed`, `dispensedBy` | missing / audit-string only | Store both on the doc (partial fills, pharmacovigilance) |
| drug coding | name only | Add ATC code (the national EML maps to ATC) |
| dose/route/frequency | free text | Keep text but add structured `doseValue`/`doseUnit`/`routeCoded`/`frequencyPerDay` for the common case |
| stock model | single level, batch overwritten | Batch-level rows (`batches[]: {batchNumber, expiryDate, quantity}`), FEFO decrement, and a `StockEventDoc` (receipt/issue/adjustment/stock-out-start/stock-out-end) to make stock-out-days computable |

### Billing / discharge
| Field | Verdict | Action |
|---|---|---|
| exemptions | free-text discount | Enumerated `exemptionCategory` (under-5, pregnancy, indigent, staff, …) — a policy-critical field in public facilities |
| `dischargeDiagnosis` | optional | Mandatory on discharge, ICD-coded |
| ward death ↔ death registry | unlinked | Ward death auto-creates/links the `DeathRegistrationDoc` (one death, one record, two views) |

---

## 3 · The to-be data flow

The single change that unlocks the rest: **make the visit a first-class object from the front door.**

```
ARRIVAL (any door: appointment, walk-in, referral)
  └─ create/lookup ENCOUNTER (enc-{uuid})     ← the visit ID, stamped on EVERYTHING below
       ├─ attendanceType: new | repeat        ← asked once, at arrival
       ├─ arrivalChannel: appointment | walk_in | referral
       ├─ appointmentId? (check-in already computes it — keep it)
       ▼
TRIAGE        TriageDoc{encounterId}          nurse-entered ETAT only; numeric vitals
       ▼
CONSULTATION  MedicalRecord{encounterId}      real visitType + department from the station;
       │                                       diagnoses ICD-11 (+notifiable auto-alert)
       ▼
ORDERS        LabResultDoc{encounterId}       coded results, 3 timestamps, resulter
       │      ImagingStudy{encounterId}       accession/modality/report
       ▼
PHARMACY      Prescription{encounterId}       ATC, qty prescribed vs dispensed, dispenser
       │                                       FEFO decrement → StockEvent log
       ▼
CHECKOUT      Bill{encounterId}               exemptionCategory; gate reads open orders by encounterId
       │      Discharge/outcome ON the encounter: discharged | referred | admitted | died | LWBS
       ▼
NIGHTLY FACILITY AGGREGATION (server-side job, per facility, per period)
       │      counts BY encounter (not by patient, not cumulative):
       │      attendances (new/repeat), morbidity by ICD-11 (top-N + notifiable),
       │      lab positives by test, dispenses, deliveries, imm doses by antigen,
       │      ANC visit numbers, deaths by cause, referrals out, stock-out days
       │      each WITH age-band + sex from the PatientDoc join, period-bounded
       ▼
DHIS2 PUSH    period-scoped, orgUnit-scoped dataValueSets with category combos
              (age/sex) — pushed from the aggregation store, not the browser
```

Design rules encoded above:
- **Capture once, at the point of care that owns it.** Attendance type at arrival; vitals at triage; visit class at the station; outcome at checkout. Nothing re-asked, nothing fabricated as a placeholder.
- **The encounter is the reporting unit.** Every HMIS count is "encounters in period P at facility F where X" — a query, not an inference.
- **Aggregate server-side, on a period.** The current client-side, all-time aggregation cannot produce a monthly return. This is decision (a) from DATA-FLOW-AUDIT: build the read path on the aggregated store.
- **Events for things that happen over time.** Stock-outs, status transitions, callbacks — logged as events so day-counts and TATs are computable.

---

## 4 · Ministry-of-Health reporting readiness

### What the push sends today
Real transport (auth, retry, offline queue) carrying flawed payloads: ~40 data elements, all-time cumulative, unscoped, `category:'default'` everywhere except birth-sex, with surveillance elements sourced from seeded mocks. See the reporting audit table for element-by-element trust levels.

### Indicator computability (standard monthly HMIS set)

| Indicator | Today | Blocker → fix |
|---|---|---|
| OPD attendance (new/repeat) | ✗ | No attendanceType, no encounter unit → §3 |
| Top-10 morbidity (ICD) | ◐ captured, never exported | Add morbidity data elements from `diagnoses[]` |
| Malaria confirmed / treated | ✗ | Free-text lab result; no ATC on drugs → coded results + ATC |
| ANC 1st / 4th visit | ◐ | `visitNumber` exists; export ANC1, add period filter |
| Facility deliveries | ◐ | Exported cumulative → period-bound |
| Immunization doses by antigen | ◐ | Only 3 antigens exported; denominators wrong → all antigens, census denominator from org-unit config |
| TB / HIV markers | ✗ / ◐ | TB reads seeded alerts; HIV regex-derived → programme fields or coded lab results |
| Facility deaths by cause | ◐ | `topCauses` computed, not pushed; two death paths → link + export |
| Referrals out | ◐ | Count only; no direction/destination (cross-org referrals architecturally broken — DATA-FLOW-AUDIT P0) |
| Stock-out days (tracer drugs) | ✗ | No stock event history → StockEventDoc |
| IDSR weekly notifiable counts | ✗ | Mock alerts; dead `notifiable` flag → auto-alert from coded diagnosis, weekly period type |

### Minimal viable national dataset (what to fix first)
A facility of this type can credibly report, in order of implementation cost:
1. **OPD attendances** (new/repeat × age-band × sex) — needs encounter + attendanceType only
2. **Top-10 morbidity + IDSR weekly notifiables** — needs the diagnosis→export path + auto-alert
3. **Deliveries, immunization doses by antigen, ANC1/ANC4** — data exists; needs period logic + full antigen list
4. **Facility deaths by cause** (linked, deduplicated) — needs the ward↔registry link
5. **Confirmed malaria** — needs coded RDT results
6. **Tracer stock-out days** — needs the stock event log

Everything else (referral loop, TB/HIV programme registers, coverage with census denominators) layers on after these six.

---

## 5 · Recommended data elements by module

Legend: **M** mandatory · O optional · A auto. Only new/changed fields listed; existing sound fields (names, NOK, provider IDs, status histories) are kept as-is.

### Reception
| Field | Type | Req | Definition |
|---|---|---|---|
| `hospitalNumber` | string, unique-enforced | A | Facility MRN; uniqueness guaranteed at data layer |
| `geocodeId` | string `BOMA-x-HHn-Pk` | A | Per-PATIENT geocode (household prefix + person suffix) |
| `dateOfBirth` | ISO date | **M** | With `dobEstimated: boolean`; estimated-age input computes it |
| `sex` | enum M/F/Unknown | **M** | 'Unknown' for unidentified patients only |
| `payam` / `boma` | org-unit ref | **M** | Selected from hierarchy, not typed |
| `occupation` | string | O | Registration + surveillance standard |
| `attendanceType` | enum new/repeat | **M** | At arrival, on the encounter |
| `encounterId` | string | A | Created at arrival; stamped on every downstream doc |

### Triage
| Field | Type | Req | Definition |
|---|---|---|---|
| `encounterId` | ref | A | Visit link |
| vitals | numeric (shared `VitalSigns`) | O per protocol | One type across triage and consultation |
| ABCC | enums | **M for nurse**, absent for clerk | Never defaulted; `assessmentSource` distinguishes stub from ETAT |
| `priority` | RED/YELLOW/GREEN | **M** | Derived from ETAT when nurse-assessed |

### Consultation
| Field | Type | Req | Definition |
|---|---|---|---|
| `visitType` | enum | **M** | Real encounter class, not hardcoded |
| `department` | facility dept ref | **M** | Actual service point |
| `diagnoses[]` | ICD-11 coded, typed primary/secondary | **M ≥1** | `codeSystem` explicit; no ICD-11 in the ICD-10 slot |
| `notifiable` handling | auto | A | Coded notifiable dx → surveillance alert |
| `encounterEnd` | ISO datetime | A | From encounter close |

### Lab / imaging
| Field | Type | Req | Definition |
|---|---|---|---|
| `testCode` | LOINC/national | **M** | Alongside display name |
| `valueNumeric`+`unit`+`referenceRange` / `valueCoded` | typed | **M per test type** | Structured results; coded pos/neg for RDT/serology |
| `collectedAt`/`receivedAt`/`resultedAt` | ISO datetime | A | TAT + valid FHIR |
| `resultedBy` | user ref | **M** | Performer |
| ImagingStudy: `accession`, `modality`, `report`, `radiologist` | own doc | **M for imaging** | Stop overloading LabResultDoc |

### Pharmacy
| Field | Type | Req | Definition |
|---|---|---|---|
| `atcCode` | string | **M** | From EML mapping |
| `quantityPrescribed` / `quantityDispensed` | number | **M** | Partial-fill reconciliation |
| `dispensedBy` | user ref | **M** | On the doc, not just audit log |
| `batches[]` | {batch, expiry, qty} | **M** | FEFO decrement; expiry-aware |
| `StockEventDoc` | receipt/issue/adjust/stockout-start/-end | A | Stock-out days + consumption |

### Billing / discharge
| Field | Type | Req | Definition |
|---|---|---|---|
| `exemptionCategory` | enum | **M when waived** | under-5 / pregnancy / indigent / staff / other |
| `dischargeDiagnosis` | ICD-11 | **M on discharge** | Outcome coding |
| `outcome` | enum discharged/referred/admitted/died/LWBS | **M** | On the encounter at close |
| death link | ref | A | Ward death ⇄ DeathRegistrationDoc, single source |

### Reporting
| Field | Type | Req | Definition |
|---|---|---|---|
| `FacilityPeriodAggregate` | doc per facility+period | A | Server-side nightly rollup; the ONLY DHIS2 source |
| age-band × sex combos | category combos | A | From PatientDoc join at aggregation time |
| period | ISO month / ISO week (IDSR) | **M** | Hard filter, not a label |
