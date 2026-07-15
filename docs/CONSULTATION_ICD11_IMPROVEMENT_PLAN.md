# Consultation Workflow — Audit & Structured-Data (ICD‑11) Improvement Plan

_TamamHealth platform · `platform/src/app/(dashboard)/consultation/page.tsx` and supporting clinical libraries._

---

## 1. Executive summary

You are in a strong position. The consultation is already a **7‑step wizard**, the Assessment step already codes diagnoses with **ICD‑11**, and you have real clinical safety logic (drug interactions, allergy checks, duplicate‑drug detection), **order sets** (bundled labs + meds + diagnoses + plan), **branching symptom templates**, and ~11 curated **quick‑pick** lists. Roughly 60% of the workflow is already dropdown/structured.

The goal — _"less typing, more dropdowns, add all the data, use ICD‑11"_ — is best achieved by adopting one authoritative coded terminology per clinical domain and wiring each field to it with a **fast local subset + typeahead + free‑text escape hatch**. The recommended standards:

| Clinical domain | Standard to adopt | Free API / dataset | Offline‑capable |
|---|---|---|---|
| Diagnoses / problems / cause of death | **WHO ICD‑11 (MMS)** | ICD‑API (`id.who.int`) | ✅ Docker container |
| Signs, symptoms, exam findings | ICD‑11 Ch. 21 + curated lists (SNOMED CT if licensed) | ICD‑API / local JSON | ✅ |
| Medications / formulary | **WHO Essential Medicines List (EML)** + RxNorm | eEML dataset + RxNav/RxTerms | ✅ (bundle EML) |
| Drug classes & interactions | WHO **ATC/DDD** | ATC index (download) | ✅ |
| Lab / investigations | **LOINC** | Clinical Tables + LOINC FHIR | ✅ (bundle subset) |
| Procedures / interventions | WHO **ICHI** | ICHI browser/data | ✅ |
| Units of measure | **UCUM** | static | ✅ |

The five highest‑impact moves are in §5. The single most important correctness fix: you store ICD‑11 codes in a field named `icd10Code` — rename it.

---

## 2. What you have today (audit)

**Wizard steps** (`consultation/page.tsx` ~L1904–1924; section map in `lib/consultation-options.ts`):

| # | Step | Sections | Gate to advance |
|---|---|---|---|
| 0 | History | History, ROS, PMH, Drug hx | history OR ROS OR PMH present |
| 1 | Intake | Chief complaint + Vitals | complaint ≥3 chars + vitals OR triage |
| 2 | Examination | Physical exam (5 systems) | ≥1 system has findings |
| 3 | Assessment | Diagnoses | ≥1 diagnosis |
| 4 | Orders | Prescriptions + Labs | — |
| 5 | Plan & checkout | Treatment, attachments, follow‑up, referral, disposition | plan OR follow‑up OR referral OR attachment |
| 6 | Summary | Read‑only review + charges | — |

**Structured vs free‑text today:**

- **Already structured (keep):** PMH chronic conditions (multi‑select, 12 items), smoking/alcohol/SES (selects), ROS (14 systems, status select + findings), chief complaint (typeahead, 10 common), all 12 vitals (numeric, auto‑prefilled from triage), physical exam (quick‑picks per system), **diagnosis code (ICD‑11 typeahead, ~100 codes)**, diagnosis type/certainty/severity (selects), medication (typeahead), route (7 options), frequency (7 options), timing/urgency (buttons), lab tests (checkboxes from facility catalog), referral hospital/urgency (selects), visit disposition (buttons).
- **Still free‑text (improve):** HPI (fine — keep as guided text), PMH surgeries/admissions (datalist only), drug‑history chronic meds & allergies (datalist only — should be true dropdowns), dose, duration, instructions, custom lab, treatment plan / follow‑up reason / referral reason (have quick‑picks but stored as free text).

**Existing reference data (already in repo):** `lib/icd11-codes.ts` (~100 ICD‑11 entries with chapter, `minLevel`, `notifiable`, `causeOfDeath`, keywords), `lib/clinical-history.ts` (ROS 14 systems, 12 chronic conditions, OLDCARTS), `lib/consultation-options.ts` (11 quick‑pick lists), `lib/clinical/symptom-templates.ts` (branching questionnaires: malaria, covid_uri, hypertension, diarrhoea…), `data/mock.ts` medications catalog, `services/drug-interaction-service.ts` (40+ interactions + allergy + duplicate checks), order sets via `useOrderSets()`.

**Correctness issue:** diagnoses are saved as `icd10Code: d.code` (~L1384) although the codes are ICD‑11. `db-types.ts` already has an unused `icd11Code?` on `ProblemDoc` (~L463).

---

## 3. The data sources & APIs to use (the "find all the APIs" answer)

### 3.1 Diagnoses / problems / mortality → WHO ICD‑11 (MMS) — _authoritative, free, offline_
This is the backbone and you're already partly on it.

- **What it is:** ICD‑11 MMS (Mortality & Morbidity Statistics) is the coded linearization for diagnoses, plus a signs/symptoms chapter (Ch. 21) and external causes.
- **API:** ICD‑API, REST/HTTPS. OAuth2 **client‑credentials** — register at `icd.who.int/icdapi`, token endpoint `https://icdaccessmanagement.who.int/connect/token`, base `https://id.who.int/icd`. Search: `GET /icd/release/11/{release}/mms/search?q=malaria`. There's also a prerelease **FHIR** endpoint (`/fhir`) and an **Embedded Coding Tool (ECT)** — a drop‑in JS widget that gives you the exact "type‑ahead → pick a code" UX with zero custom UI work.
- **Offline (critical for South Sudan):** run the official **Docker container** `whoicd/icd-api` — needs internet only to build/first‑run, then serves search + the coding tool (`/ct`) and browser (`/browse`) entirely offline on the LAN. This is the recommended production pattern for low‑connectivity facilities.
- **How to use here:** keep your curated `icd11-codes.ts` as a **fast local "common diagnoses" subset** (offline‑first, instant), and add live ICD‑API search behind it for the long tail. Your existing `minLevel` / `notifiable` / `causeOfDeath` flags are excellent — keep enriching from ICD‑11's own metadata for DHIS2 notifiable‑disease reporting.

### 3.2 Symptoms / examination / findings → ICD‑11 Ch. 21 + curated lists (SNOMED CT optional)
- ICD‑11 Chapter 21 ("Symptoms, signs") covers presenting complaints and exam findings and is free/offline via the same API.
- **SNOMED CT** is the richest terminology for findings, but it **requires a license** (SNOMED International member countries get it free; South Sudan is not a member → paid affiliate license). Recommendation: **don't block on SNOMED** — keep your curated quick‑pick lists + ICD‑11 Ch.21, and design the data model so a SNOMED code can be added later without migration (§7).

### 3.3 Medications / formulary → WHO Essential Medicines List + RxNorm
- **Formulary base:** adopt the **WHO Model List of Essential Medicines (eEML)** — the 24th list (2025) has ~523 medicines, freely downloadable from `list.essentialmeds.org`. This is the right national‑formulary fit for South Sudan and replaces the ad‑hoc `mock.ts` list. (If South Sudan publishes its own EML, layer that on top.)
- **Prescribing typeahead:** **RxNorm / RxTerms** via **RxNav** — completely free, no API key, 20 req/s. `RxTerms` is purpose‑built for prescription writing and returns drug → route → strength/form, which lets you **auto‑populate dose/route** instead of typing. Clinical Tables endpoint: `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search`.
- **Drug classes / interactions:** WHO **ATC/DDD** codes classify each drug; pair with your existing `drug-interaction-service.ts`. Tag each formulary item with its ATC class so interaction rules can be class‑based (e.g., "two NSAIDs") rather than name‑by‑name.
- **Offline:** bundle the EML (a few hundred rows of JSON) locally; RxTerms enrichment only when online.

### 3.4 Allergies → RxNorm ingredient / substance list (or curated)
- Reuse RxNorm **ingredients** for drug allergies (so an allergy links to the same substance as the prescription and the allergy check becomes exact, not string‑matching). Keep `COMMON_ALLERGIES` as the offline quick list. Non‑drug allergens (food, environment) → small curated list.

### 3.5 Labs / investigations → LOINC
- **LOINC** is the universal standard for lab tests/observations. Free to use (requires accepting the LOINC license).
- **APIs:** NLM **Clinical Tables** LOINC API and the official **LOINC FHIR terminology** service; NLM also publishes a "Top LOINC codes for orders/observations" subset — perfect for pre‑loading.
- **How to use here:** attach a LOINC code to every entry in the facility lab catalog, and build **panels** (FBC, malaria work‑up, ANC profile) as bundles. This makes results interoperable and chartable over time.

### 3.6 Procedures / interventions → WHO ICHI
- **ICHI** (International Classification of Health Interventions) is WHO's free companion to ICD‑11 for procedures (wound suturing, incision & drainage, deliveries, etc.). Use it if/when you add a procedures section to the Plan step.

### 3.7 Supporting standards
- **UCUM** for units (°C, mmHg, mmol/L…) so vitals/labs are machine‑comparable and safe for DHIS2 export.
- **Vitals** can carry LOINC codes (e.g., body temperature `8310-5`, systolic BP `8480-6`) for interoperability — keep the numeric inputs, just tag them.
- **Immunizations** you already handle; ICD‑11/CVX can code the vaccine.

**Licensing at a glance:** ICD‑11, ICHI, WHO EML, ATC, UCUM — **free**. RxNorm/RxTerms/Clinical Tables — **free, no key** (US NLM). LOINC — **free with license acceptance**. SNOMED CT — **license required** (not free for South Sudan today).

---

## 4. What each step should contain + best input pattern

Design rule for every field: **coded picklist first** (local common subset → typeahead into the full terminology), with a **free‑text escape hatch** and, where possible, **templates that fill many fields at once**.

**Step 0 — History.** HPI: keep guided free text but drive it from the **symptom template** for the chief complaint (branching questions auto‑compose the HPI → huge typing reduction). PMH conditions: ✅ multi‑select (extend list, ICD‑11‑linked). Surgeries/admissions: make true multi‑select (ICHI for surgeries). Drug hx chronic meds: **RxTerms typeahead** (not datalist). Allergies: **RxNorm substance dropdown** + NKDA checkbox ✅. ROS: ✅ keep; add "mark all negative" one‑click.

**Step 1 — Intake.** Chief complaint: ✅ typeahead; link the picked complaint to a symptom template and to likely ICD‑11 Ch.21 codes. Vitals: ✅ numeric + triage prefill; add auto **flag colors** from your existing vitals ranges and auto‑BMI ✅. Tag each vital with a LOINC code behind the scenes.

**Step 2 — Examination.** ✅ quick‑picks per system; add **"normal exam"** one‑click that fills all systems with normal findings (typing reduction), and per‑system "normal/abnormal" toggle before free text.

**Step 3 — Assessment.** This is the ICD‑11 core. Replace the static 100‑code lookup with: **local common‑diagnosis subset (instant) → ICD‑API search (long tail) →** optionally the **Embedded Coding Tool**. Keep type/certainty/severity selects ✅. **Store `{system, code, display}`** and fix the field name. Surface the ICD‑11 `notifiable`/`causeOfDeath` flags so the clinician sees "this is a reportable disease."

**Step 4 — Orders.** Medication: **RxTerms typeahead** that auto‑fills strength/route; dose/route/frequency as presets **per drug** (order sets already do this — lean on them). Duration: dropdown of common durations (3/5/7/14/30 days) + custom. Labs: ✅ checkboxes; add **LOINC‑coded panels**. Keep the safety checks ✅.

**Step 5 — Plan & checkout.** Treatment plan / follow‑up reason / referral reason: keep quick‑picks but **store the picked option as a coded value**, not just text. Referral: ✅ selects. Add a **procedures** capture (ICHI) if you bill/track procedures. Disposition buttons ✅.

**Step 6 — Summary.** ✅ read‑only; ensure every coded field shows `code — display` and reportable‑disease badges.

---

## 5. Prioritized backlog (with file references)

**P0 — correctness & quick dropdown wins (hours):**
1. Rename diagnosis storage `icd10Code` → `icd11Code` (`consultation/page.tsx` ~L1384) and populate `ProblemDoc.icd11Code`. Store `system: 'ICD-11-MMS'` too.
2. Convert drug‑history **chronic meds** and **allergies** from datalist to real dropdowns using existing `COMMON_CHRONIC_MEDICATIONS` / `COMMON_ALLERGIES` (`consultation-options.ts`).
3. Add **"normal exam"** and **"all ROS negative"** one‑click fills.

**P1 — adopt the terminologies (days):**
4. **ICD‑11 service:** new `lib/services/icd11-service.ts` wrapping ICD‑API search + a local cache; keep `icd11-codes.ts` as the offline common subset. Deploy the `whoicd/icd-api` Docker container for offline facilities.
5. **Medications:** replace `mock.ts` meds with the **WHO EML** dataset (`lib/data/eml.ts`), tag each with ATC class; add **RxTerms typeahead** for the long tail and to auto‑fill dose/route.
6. **Labs:** attach **LOINC** codes to the facility lab catalog; define coded **panels**.

**P2 — depth & interoperability (later):**
7. Procedures via **ICHI**; **UCUM** units on vitals/labs; LOINC codes on vitals; optional **SNOMED CT** for findings if a license is obtained.

---

## 6. Offline / low‑connectivity strategy (South Sudan)

- **ICD‑11:** run `whoicd/icd-api` on a facility/regional server (Docker); the app queries it on the LAN. Bundle the curated common‑diagnosis subset in the app for instant, zero‑network picking; fall back to the local ICD‑API for the long tail; sync releases when a connection is available.
- **Medications/labs:** ship the WHO EML + a "top LOINC" subset as local JSON in the app bundle (small). Online RxTerms/LOINC calls are enrichment only, never required to complete a visit.
- **Principle:** a clinician must be able to finish a fully coded consultation with **no internet**. APIs enrich; local subsets guarantee availability.

---

## 7. Data‑model recommendation (future‑proofing)

Store every coded field as a small triple so you can add/replace terminologies without migrations:

```ts
type CodedConcept = {
  system: 'ICD-11-MMS' | 'LOINC' | 'RxNorm' | 'ATC' | 'ICHI' | 'SNOMED-CT' | 'local';
  code: string;
  display: string;
};
```

Apply to: diagnoses, problems, medications (RxNorm + ATC), lab orders (LOINC), procedures (ICHI), and optionally exam findings/symptoms. This aligns cleanly with FHIR `CodeableConcept` if you ever expose a FHIR API or export to DHIS2.

---

## Sources

- [ICD‑API Authentication (OAuth2)](https://icd.who.int/docs/icd-api/API-Authentication/)
- [ICD‑API Documentation v2](https://icd.who.int/docs/icd-api/APIDoc-Version2/)
- [ICD‑API Docker container (offline)](https://icd.who.int/docs/icd-api/ICDAPI-DockerContainer/)
- [ICD‑API local deployment](https://icd.who.int/docs/icd-api/ICDAPI-LocalDeployment/)
- [ICD‑API Embedded Coding Tool](https://icd.who.int/docs/icd-api/icd11ect-1.3/)
- [whoicd/icd-api Docker image](https://hub.docker.com/r/whoicd/icd-api)
- [RxNorm / RxNav APIs](https://lhncbc.nlm.nih.gov/RxNav/APIs/index.html)
- [RxTerms API (prescribing autocomplete)](https://clinicaltables.nlm.nih.gov/apidoc/rxterms/v3/doc.html)
- [WHO Model List of Essential Medicines](https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists)
- [LOINC Clinical Tables API](https://clinicaltables.nlm.nih.gov/apidoc/loinc/v3/doc.html)
- [LOINC FHIR terminology service](https://loinc.org/fhir/)
- [Top LOINC codes (orders & observations)](https://lhncbc.nlm.nih.gov/CHRB/Projects/top-LOINC-codes.html)
