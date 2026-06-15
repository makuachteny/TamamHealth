# Tamam Health — Clinical Workflow Spec & Build Plan

**Date:** 2026-06-10
**Basis:** a recorded interview with a practising doctor + clinical-documentation research (H&P / SOAP standard, CMS 14-system Review of Systems). This is the source of truth for rebuilding the consultation around how doctors actually work.

---

## 1. The doctor's workflow (what they described)

A consultation follows a fixed order. The system should mirror it:

1. **Chief complaint(s)** — the 1–3 problems that brought the patient in (the doctor was explicit: *not more than three*). Short, in the patient's words.
2. **History of present illness (HPI)** — the story of each complaint from when the patient was last well: onset, progression, and detail per symptom. (Standard tool: OLDCARTS — onset, location, duration, character, aggravating/relieving, radiation, timing, severity.)
3. **Review of systems (ROS)** — go system by system (cardiovascular, respiratory, neurological, urinary, …) asking the symptoms of each, to correlate with the present complaint. If a system is clear, mark it *"no symptoms"* rather than leaving it blank. (CMS recognises **14 systems**.)
4. **Past medical history** — similar episodes before; prior hospital admissions; chronic illness (diabetes, hypertension, hyperlipidemia…); past operations; previous blood transfusions.
5. **Family history.**
6. **Social history** — smoking, alcohol, substance use; **health insurance yes/no** (critical here); **socioeconomic class (low/middle/high)** — because it determines whether the patient can afford chronic medication, which changes what the doctor prescribes.
7. **Drug history** — current chronic medications; **drug allergies / hypersensitivity** (or "no known allergies").
8. **Vitals** — temperature, BP, pulse, etc. (here, taken as part of the doctor's consultation; nurses also exist).
9. **Laboratory** — split into **basic** (ordered broadly: CBC, urinalysis) and **special / specific** investigations the doctor selects per case (malaria/typhoid screen, ANA, rheumatoid factor, vitamin D, uric acid, cultures). Don't run everything on everyone.
10. **Pharmacy** — two distinct moments:
    - **Immediate / emergency meds** given *before* results return (IV fluids for hypotension, antipyretic infusion for fever, anticonvulsants for a convulsing child).
    - **Definitive meds** started *after* a diagnosis.
11. **Continuity** — at the next visit the doctor should *see the last chief complaint, past history, family/next-of-kin, and trends (e.g. weight loss/gain)* without re-asking. The patient shouldn't have to re-explain; the record speaks for them. This matters most for patients who can't easily articulate their problem.

Registration already captures **next of kin**; the doctor should see it (and the family/relationship picture) on opening the patient.

---

## 2. AI scope (decided)

- **Keep:** the **AI Clinical Scribe** only — it listens/takes notes and fills the consultation fields. This is the one AI the project wants.
- **Remove:** every other AI — the floating assistant (done), the symptom checker, the rule-based **diagnosis engine**, and the **AI clinical evaluation** panel in the consultation (suggested diagnoses / recommended tests / severity).

---

## 3. What was implemented in this pass (verified: tsc + ESLint clean)

- **Removed the floating AI assistant** (`AssistantChat`) from the dashboard layout.
- **Extended the clinical data model** (`data/mock.ts` → `MedicalRecord`) with optional, additive fields so the history workflow has a home and nothing breaks:
  - `chiefComplaints?: string[]`, `reviewOfSystems?: Record<system, {status, findings}>`
  - `pastMedicalHistory`, `familyHistory`, `socialHistory` (incl. `hasHealthInsurance`, `socioeconomicStatus`), `drugHistory` (incl. `allergies`, `noKnownAllergies`)
  - `Prescription.urgency?: 'immediate' | 'definitive'`
  - `LabResult.tier?: 'basic' | 'special'`
- **Added a clinical-history content module** (`lib/clinical-history.ts`): the CMS 14-system ROS (with symptom hints), the common chronic-conditions list, OLDCARTS prompts, and smoking/alcohol/SES option sets.

---

## 4. Build plan for the rest (sequenced, mechanical now that the model exists)

Each step is independently shippable and should be verified against a running `npm run dev` before the next (the consultation page is ~1,800 lines and uses **index-addressed sections**, so visual QA matters).

### Step A — Remove the AI evaluation from the consultation (keep the scribe)
Files: `app/(dashboard)/consultation/page.tsx`, `dashboard/boma/page.tsx`, delete `lib/ai/diagnosis-engine.ts`, `components/SymptomChecker.tsx`.
- Remove imports `evaluatePatient`, `AIEvaluation`; state `aiEvaluation`, `aiLoading`, `acceptedDiagnoses`, `acceptedTests`; the `runAIEvaluation` function; the `aiEvaluation` field in `createMedicalRecord`.
- Replace the **section-3 body** (currently "AI Clinical Evaluation", lines ~1246–1430) with the **Patient History** UI (below). This reuses the existing section slot, so the other sections keep their indices — no renumbering.
- Update `sectionHeaders[3]` label → "History & review"; update the progress check `i === 3` from `aiEvaluation !== null` to history-completeness.
- Boma: remove the `SymptomChecker` toggle/panel and its `diagnosis-engine` use.

### Step B — Chief complaint as up to 3 entries
Replace the single free-text with up to 3 add/remove rows; block the 4th with a hint ("Keep to the 3 problems that brought the patient in").

### Step C — Patient History section (the slot from Step A)
Render from `lib/clinical-history.ts`:
- **HPI** textarea with OLDCARTS chips as guidance.
- **Review of systems**: one row per system — toggle Not reviewed / Negative / Positive; a findings input appears on Positive. A "mark remaining negative" shortcut.
- **Past medical history**: chronic-condition chips + surgeries + prior admissions + blood-transfusion toggle.
- **Family history**: textarea.
- **Social history**: smoking/alcohol selects, occupation, **insurance toggle + provider**, **socioeconomic select**.
- **Drug history**: chronic meds + allergies + "no known allergies" toggle.
- Persist all of it into the new `MedicalRecord` fields on save.

### Step D — Lab: basic vs special
Group the lab-order picker into "Basic panel" (preselected set) and "Special investigations" (searchable, doctor-selected). Persist `tier` on each order; the lab queue can show the split.

### Step E — Pharmacy: immediate vs definitive
Tag each prescription `immediate` or `definitive`; surface immediate/emergency meds at the top of the pharmacy queue so they're dispensed before results.

### Step F — Patient continuity view
On the patient record / consultation open, show: last chief complaint, past medical/family/social history, next of kin, and a small **trends** strip (weight, BP over visits). Pull next-of-kin from the existing registration field.

### Step G — Visual redesign pass
Apply the polished modal/field system (already built for payments) across the clinical screens; consistent section cards, inputs with focus rings, spacing.

---

## 5. Notes / decisions still open
- ROS depth per visit: a *complete* ROS is 10+ systems; in practice the doctor documents the complaint-relevant systems and marks the rest negative. The UI supports both.
- Socioeconomic status is sensitive — it's used only to guide affordable prescribing, shown to clinicians, not to patients.

---

## Sources
- SOAP / H&P structure — [StatPearls (NIH): SOAP Notes](https://www.ncbi.nlm.nih.gov/books/NBK482263/)
- HPI / OLDCARTS — [HPI meaning & OLDCARTS](https://patientnotes.ai/resources/hpi-meaning-medical)
- Review of Systems (14 systems) — [American College of Cardiology: Review of Systems](https://www.acc.org/Tools-and-Practice-Support/Practice-Solutions/Coding-and-Reimbursement/Documentation/Evaluation-and-Management/Review-of-Systems), [14-point ROS template](https://www.carepatron.com/templates/14-point-review-of-systems-template)
