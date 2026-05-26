/**
 * Offline Medical Assistant Knowledge Engine
 * Pattern-matches doctor questions against a curated medical knowledge base
 * covering WHO/IMCI guidelines, drug protocols, emergency management,
 * and South Sudan-specific health guidance.
 * Runs entirely in the browser — zero network dependency.
 */

interface KnowledgeEntry {
  keywords: string[];
  topic: string;
  response: string;
}

const knowledgeBase: KnowledgeEntry[] = [
  // ── MALARIA ──────────────────────────────────────────────
  {
    keywords: ['malaria', 'treat malaria', 'malaria treatment', 'malaria dose', 'coartem', 'artemether', 'lumefantrine', 'falciparum', 'antimalarial'],
    topic: 'Malaria Treatment',
    response: `**Malaria Treatment (WHO Guidelines)**

**Uncomplicated P. falciparum:**
- **First-line:** Artemether-Lumefantrine (Coartem) — 80/480mg BD x 3 days (adults >35kg)
- Take with fatty food to improve absorption
- Pediatric dosing by weight: 5-14kg: 20/120mg; 15-24kg: 40/240mg; 25-34kg: 60/360mg

**Severe Malaria (any danger sign):**
- **IV Artesunate** 2.4 mg/kg at 0, 12, 24 hours, then daily until oral tolerated
- If IV not available: **IM Artesunate** or **Rectal Artesunate** (pre-referral)
- Monitor blood glucose (hypoglycemia common)
- Transfuse if Hb <5 g/dL or hemodynamic instability

**Danger signs:** Prostration, impaired consciousness, respiratory distress, multiple convulsions, circulatory collapse, jaundice, hemoglobinuria, severe anemia, hypoglycemia

**In pregnancy:**
- 1st trimester: Quinine + Clindamycin x 7 days
- 2nd/3rd trimester: ACT (Artemether-Lumefantrine)
- IPTp with Sulfadoxine-Pyrimethamine at each ANC visit from 13 weeks`,
  },
  {
    keywords: ['malaria diagnosis', 'rdt', 'malaria test', 'blood smear', 'malaria confirm', 'parasitemia'],
    topic: 'Malaria Diagnosis',
    response: `**Malaria Diagnosis**

**Rapid Diagnostic Test (RDT):**
- Use HRP2-based RDT for P. falciparum (most common in South Sudan)
- Sensitivity >95% for parasitemia >100/μL
- Can remain positive 2-4 weeks after treatment (HRP2 antigen persistence)

**Blood Smear (Gold Standard):**
- Thick smear: detection (more sensitive)
- Thin smear: species identification and parasite count
- Report as parasites/μL or % parasitized RBCs

**When to test:**
- All patients with fever or history of fever in last 48h in endemic areas
- Test before treating — WHO recommends parasitological confirmation

**Severe malaria indicators on smear:**
- Parasitemia >5% (>250,000/μL)
- Schizonts of P. falciparum on peripheral smear
- Pigmented neutrophils >5%`,
  },

  // ── PNEUMONIA ────────────────────────────────────────────
  {
    keywords: ['pneumonia', 'pneumonia treatment', 'chest infection', 'lower respiratory', 'community acquired pneumonia', 'cap'],
    topic: 'Pneumonia Management',
    response: `**Community-Acquired Pneumonia (CAP)**

**Assessment — CURB-65 Score:**
- Confusion, Urea >7 mmol/L, RR ≥30, BP <90/60, Age ≥65
- Score 0-1: outpatient; 2: consider admission; 3-5: severe — ICU

**Outpatient (mild):**
- Amoxicillin 500mg-1g TDS x 5 days
- If penicillin allergy: Doxycycline 200mg then 100mg OD x 5 days

**Inpatient (moderate):**
- Amoxicillin 500mg TDS + Azithromycin 500mg OD
- Or Ceftriaxone 1-2g IV OD + Azithromycin

**Severe / ICU:**
- Ceftriaxone 2g IV OD + Azithromycin 500mg IV OD
- Add Oseltamivir if influenza suspected

**Pediatric (IMCI guidelines):**
- Fast breathing only (no chest indrawing): Amoxicillin 40mg/kg/day BD x 5 days
- Chest indrawing: Amoxicillin 80mg/kg/day BD x 5 days
- Danger signs: Refer urgently + first dose Ampicillin + Gentamicin

**Oxygen therapy:** Target SpO₂ ≥92% (≥95% in pregnancy)`,
  },

  // ── CHOLERA / DIARRHEA ──────────────────────────────────
  {
    keywords: ['cholera', 'diarrhea', 'diarrhoea', 'dehydration', 'ors', 'oral rehydration', 'watery stool', 'rice water stool'],
    topic: 'Cholera & Acute Diarrhea',
    response: `**Cholera / Acute Diarrheal Disease**

**Assessment of dehydration (WHO):**
- **No dehydration:** Plan A — ORS after each stool, continue feeding
- **Some dehydration:** Plan B — ORS 75 mL/kg over 4 hours, reassess
- **Severe dehydration:** Plan C — IV Ringer's Lactate (or NS)

**IV Rehydration (Plan C):**
- Adults: 100 mL/kg over 3 hours (30 mL/kg in first 30 min, then 70 mL/kg over 2.5 hours)
- Children <12mo: 100 mL/kg over 6 hours (30 mL/kg in first hour)

**Antibiotics (cholera suspected):**
- Adults: Doxycycline 300mg single dose (first-line)
- Or Azithromycin 1g single dose
- Children: Azithromycin 20mg/kg single dose
- Pregnant women: Azithromycin 1g single dose

**Zinc supplementation (children):**
- <6 months: 10mg OD x 10-14 days
- ≥6 months: 20mg OD x 10-14 days

**Red flags:** Sunken eyes, absent tears, very thirsty, drinks poorly, skin pinch goes back very slowly, lethargy/unconsciousness`,
  },

  // ── TYPHOID ──────────────────────────────────────────────
  {
    keywords: ['typhoid', 'enteric fever', 'typhoid treatment', 'salmonella typhi', 'widal'],
    topic: 'Typhoid Fever',
    response: `**Typhoid Fever Management**

**Clinical features:**
- Stepladder fever pattern, relative bradycardia
- Coated tongue, hepatosplenomegaly, rose spots (rare)
- Complications: intestinal perforation, hemorrhage, encephalopathy

**Diagnosis:**
- Blood culture (gold standard, sensitivity 40-60%)
- Widal test: rising titers >1:160 suggestive (limited specificity)
- Typhidot IgM: rapid, better sensitivity than Widal

**Treatment:**
- **First-line:** Ciprofloxacin 500mg BD x 7-14 days (if susceptible)
- **Alternative:** Azithromycin 500mg OD x 7 days
- **MDR typhoid:** Ceftriaxone 2g IV OD x 14 days
- **XDR typhoid:** Azithromycin 20mg/kg OD x 7 days + Meropenem (if severe)

**Supportive care:**
- Paracetamol for fever (avoid NSAIDs — bleeding risk)
- Adequate hydration, soft diet
- Strict hand hygiene, safe water

**Complications requiring surgery:**
- Intestinal perforation → urgent laparotomy
- Sustained GI hemorrhage → resuscitation + possible surgery`,
  },

  // ── TUBERCULOSIS ─────────────────────────────────────────
  {
    keywords: ['tb', 'tuberculosis', 'tb treatment', 'rhze', 'anti-tb', 'sputum', 'genexpert', 'dots'],
    topic: 'Tuberculosis',
    response: `**Tuberculosis Management (WHO)**

**Diagnosis:**
- GeneXpert MTB/RIF: rapid, detects rifampicin resistance (preferred first test)
- Sputum smear microscopy: 2 specimens (spot + morning)
- Chest X-ray: upper lobe infiltrates, cavitation, hilar lymphadenopathy

**New TB (drug-susceptible):**
- **Intensive phase (2 months):** RHZE daily
  - Rifampicin 10mg/kg (max 600mg)
  - Isoniazid 5mg/kg (max 300mg)
  - Pyrazinamide 25mg/kg (max 2000mg)
  - Ethambutol 15mg/kg (max 1600mg)
- **Continuation phase (4 months):** RH daily

**TB/HIV co-infection:**
- Start TB treatment first
- Start ART within 2 weeks (if CD4 <50) or within 8 weeks
- Cotrimoxazole prophylaxis throughout TB treatment
- Watch for IRIS (immune reconstitution inflammatory syndrome)

**MDR-TB:** Refer to specialized center for longer regimen (9-20 months)

**Monitoring:**
- Sputum at months 2, 5, and 6 (or end of treatment)
- LFTs if symptomatic (hepatotoxicity)
- Visual acuity if on Ethambutol >2 months`,
  },

  // ── HIV / ART ────────────────────────────────────────────
  {
    keywords: ['hiv', 'art', 'arv', 'antiretroviral', 'cd4', 'viral load', 'hiv treatment', 'dolutegravir', 'tdf', 'prophylaxis', 'prep', 'pep', 'pmtct'],
    topic: 'HIV / ART Management',
    response: `**HIV Management (WHO 2024 Guidelines)**

**First-line ART (adults & adolescents):**
- **Preferred:** TDF/3TC/DTG (Tenofovir/Lamivudine/Dolutegravir) — 1 tablet OD
- Take at same time daily, with or without food
- DTG-based regimens preferred due to high barrier to resistance

**When to start ART:**
- All HIV-positive individuals regardless of CD4 count ("Test and Treat")
- Same-day initiation for those ready

**Monitoring:**
- Viral load at 6 months, 12 months, then annually
- Target: undetectable (<50 copies/mL) by 6 months
- If VL >1000: enhanced adherence counseling → repeat VL in 3 months → switch if still failing

**Opportunistic infection prophylaxis:**
- Cotrimoxazole 960mg OD (all patients until immune recovery)
- TB preventive therapy: Isoniazid 300mg OD x 6 months (if no active TB)

**PEP (Post-Exposure Prophylaxis):**
- Start within 72 hours of exposure
- TDF/3TC + DTG x 28 days

**PMTCT:**
- All HIV+ pregnant women on lifelong ART
- Nevirapine prophylaxis for infant (birth to 6 weeks)`,
  },

  // ── MENINGITIS ───────────────────────────────────────────
  {
    keywords: ['meningitis', 'neck stiffness', 'lumbar puncture', 'csf', 'meningococcal', 'bacterial meningitis'],
    topic: 'Meningitis',
    response: `**Bacterial Meningitis — Emergency Management**

**Clinical triad:** Fever + Headache + Neck stiffness
**Other signs:** Photophobia, altered consciousness, seizures, petechial rash (meningococcal)

**IMMEDIATE treatment (do NOT delay for LP):**
- **Ceftriaxone 2g IV** (adult) or **50mg/kg IV** (child) — give within 30 minutes
- **Dexamethasone 0.15mg/kg IV** before or with first antibiotic dose (reduces mortality)

**CSF analysis (when LP possible):**
| Feature | Bacterial | Viral | TB |
|---------|-----------|-------|----|
| Appearance | Turbid | Clear | Clear/slightly turbid |
| WCC | >1000, neutrophils | <1000, lymphocytes | <500, lymphocytes |
| Protein | High (>1 g/L) | Normal/slightly high | Very high |
| Glucose | Very low (<40% serum) | Normal | Low |

**Meningitis belt context (South Sudan):**
- Common organisms: N. meningitidis (A, W), S. pneumoniae, H. influenzae
- Epidemic meningitis: suspect if ≥2 cases/week in a population of <100,000
- Notify public health authorities immediately

**Duration of antibiotics:**
- N. meningitidis: 5-7 days
- S. pneumoniae: 10-14 days
- Unknown organism: 10-14 days`,
  },

  // ── HYPERTENSION ─────────────────────────────────────────
  {
    keywords: ['hypertension', 'blood pressure', 'high bp', 'antihypertensive', 'bp management', 'amlodipine', 'enalapril'],
    topic: 'Hypertension Management',
    response: `**Hypertension Management**

**Classification (mmHg):**
- Normal: <120/80
- Elevated: 120-129/<80
- Stage 1: 130-139/80-89
- Stage 2: ≥140/≥90
- Crisis: >180/120

**First-line agents (South Sudan context):**
1. **Amlodipine** 5-10mg OD (calcium channel blocker) — preferred for Black African patients
2. **Hydrochlorothiazide** 12.5-25mg OD (thiazide diuretic)
3. **Enalapril** 5-20mg OD-BD (ACE inhibitor) — preferred if diabetes/CKD

**Combination therapy (if monotherapy fails):**
- Amlodipine + HCTZ
- Amlodipine + Enalapril
- Triple: Amlodipine + HCTZ + Enalapril

**Hypertensive Emergency (>180/120 + organ damage):**
- Nifedipine 10mg sublingual (if IV not available)
- Hydralazine 5-10mg IV (repeat q20min, max 20mg)
- Target: reduce BP by 25% in first hour, then gradually to 160/100 over 2-6 hours
- Do NOT reduce too rapidly (risk of stroke/MI)

**Lifestyle modifications:** Reduce salt (<5g/day), regular exercise, limit alcohol, weight management, stop smoking`,
  },

  // ── DIABETES ─────────────────────────────────────────────
  {
    keywords: ['diabetes', 'blood sugar', 'glucose', 'metformin', 'insulin', 'dka', 'diabetic ketoacidosis', 'hyperglycemia', 'hypoglycemia'],
    topic: 'Diabetes Management',
    response: `**Diabetes Mellitus Management**

**Diagnosis:**
- Fasting blood glucose ≥7.0 mmol/L (126 mg/dL)
- Random blood glucose ≥11.1 mmol/L (200 mg/dL) + symptoms
- HbA1c ≥6.5% (if available)

**Type 2 — Stepwise treatment:**
1. **Metformin** 500mg OD → increase to 1000mg BD over 2-4 weeks
2. Add **Glibenclamide** 2.5-5mg OD (or Glipizide)
3. Add **Insulin** (basal: NPH 10 units at bedtime, titrate by 2 units q3 days)

**Target:** Fasting glucose 4-7 mmol/L; HbA1c <7%

**DKA Emergency Protocol:**
1. **IV Normal Saline** 1L in first hour, then 500mL/hr x 4h
2. **Insulin** regular 0.1 units/kg/hr IV infusion (or 0.14 units/kg bolus then 0.1/kg/hr)
3. **Potassium:** Add 20-40 mEq/L to each liter once K+ <5.3 and urine output established
4. Monitor glucose hourly, electrolytes q2h
5. Switch to SC insulin when: glucose <200, pH >7.3, bicarb >15, patient can eat

**Hypoglycemia (<3.9 mmol/L):**
- Conscious: 15-20g fast-acting glucose (3-4 sugar cubes, juice)
- Unconscious: 50mL of 50% Dextrose IV or Glucagon 1mg IM`,
  },

  // ── PRE-ECLAMPSIA / ECLAMPSIA ───────────────────────────
  {
    keywords: ['pre-eclampsia', 'preeclampsia', 'eclampsia', 'pregnancy hypertension', 'hellp', 'magnesium sulfate', 'mgso4'],
    topic: 'Pre-eclampsia / Eclampsia',
    response: `**Pre-eclampsia / Eclampsia Management**

**Diagnosis:**
- Pre-eclampsia: BP ≥140/90 after 20 weeks + proteinuria (≥1+ dipstick)
- Severe features: BP ≥160/110, proteinuria ≥3+, headache, visual changes, epigastric pain, low platelets, elevated LFTs

**Magnesium Sulfate Protocol (Pritchard regimen — preferred in low-resource):**
- **Loading:** 4g IV over 15-20 min + 5g IM in each buttock (total 14g)
- **Maintenance:** 5g IM q4h (alternate buttocks) for 24h after last seizure/delivery
- **Monitor:** Respiratory rate (>16), urine output (>25mL/hr), patellar reflexes
- **Antidote:** Calcium Gluconate 1g IV if toxicity (respiratory depression)

**BP Control:**
- Hydralazine 5mg IV, repeat q20min (max 20mg) — target <160/110
- Or Nifedipine 10mg oral, repeat q30min (max 30mg)
- Or Labetalol 20mg IV, then 40mg, then 80mg q10min

**Delivery decision:**
- Severe pre-eclampsia ≥37 weeks: deliver
- Severe pre-eclampsia <34 weeks: give steroids (Dexamethasone 6mg IM q12h x 4 doses), deliver within 48h
- Eclampsia: stabilize → deliver regardless of gestational age

**HELLP syndrome (Hemolysis, Elevated Liver enzymes, Low Platelets):**
- Urgent delivery, platelet transfusion if <50,000 and bleeding/surgery planned`,
  },

  // ── ANEMIA ───────────────────────────────────────────────
  {
    keywords: ['anemia', 'anaemia', 'low hemoglobin', 'iron deficiency', 'transfusion', 'ferrous sulfate', 'folic acid'],
    topic: 'Anemia',
    response: `**Anemia Management**

**Classification (Hb g/dL):**
- Mild: 10-12 (women) / 10-13 (men)
- Moderate: 7-10
- Severe: <7
- Life-threatening: <5

**Iron Deficiency Anemia (most common):**
- Ferrous Sulfate 200mg (65mg elemental iron) TDS on empty stomach
- Add Folic Acid 5mg OD
- Duration: 3 months after Hb normalizes (replenish stores)
- Causes in South Sudan: malaria, hookworm, poor nutrition, pregnancy

**Deworming:** Mebendazole 500mg single dose or Albendazole 400mg single dose

**Transfusion indications:**
- Hb <5 g/dL (or <7 with cardiac symptoms)
- Active bleeding with hemodynamic instability
- Severe malaria anemia in children (Hb <5 + respiratory distress)

**In pregnancy:**
- Routine: Ferrous Sulfate 60mg + Folic Acid 400mcg daily
- If Hb <7: refer for transfusion
- IPTp for malaria prevention

**Sickle Cell Disease:**
- Folic acid 5mg OD (lifelong)
- Hydroxyurea in recurrent crises (specialist)
- Penicillin V prophylaxis in children
- Avoid dehydration, cold, high altitude`,
  },

  // ── MEASLES ──────────────────────────────────────────────
  {
    keywords: ['measles', 'vitamin a', 'measles treatment', 'koplik spots', 'measles rash', 'measles vaccine'],
    topic: 'Measles',
    response: `**Measles Management**

**Clinical stages:**
1. Prodrome (2-4 days): fever, cough, coryza, conjunctivitis
2. Koplik spots: pathognomonic — white spots on buccal mucosa
3. Rash: maculopapular, starts behind ears → face → trunk → limbs

**Treatment:**
- **Vitamin A** (WHO — give to ALL measles cases):
  - <6 months: 50,000 IU on day 1 and day 2
  - 6-11 months: 100,000 IU on day 1 and day 2
  - ≥12 months: 200,000 IU on day 1 and day 2
- Paracetamol for fever
- Encourage fluids and nutrition
- Treat secondary infections (pneumonia, otitis media) with antibiotics

**Complications:** Pneumonia (most common cause of death), encephalitis, otitis media, diarrhea, malnutrition worsening, keratitis (blindness)

**Prevention:**
- Measles vaccine at 9 months and 15 months (South Sudan EPI)
- Outbreak response: vaccinate 6 months-15 years
- Isolate patient for 4 days after rash onset

**Notify:** Measles is a notifiable disease — report to county/state health authorities immediately`,
  },

  // ── UTI ──────────────────────────────────────────────────
  {
    keywords: ['uti', 'urinary tract infection', 'dysuria', 'urinary', 'cystitis', 'pyelonephritis'],
    topic: 'Urinary Tract Infection',
    response: `**UTI Management**

**Uncomplicated cystitis (women):**
- Ciprofloxacin 500mg BD x 3 days
- Or Nitrofurantoin 100mg BD x 5 days (if available)
- Or Cotrimoxazole 960mg BD x 3 days

**Complicated UTI / Pyelonephritis:**
- Ciprofloxacin 500mg BD x 7-14 days (oral, if mild)
- Ceftriaxone 1-2g IV OD + Gentamicin 5mg/kg IV OD (if severe/sepsis)
- Switch to oral when afebrile 48h, complete 14 days total

**UTI in pregnancy (treat promptly — risk of preterm labor):**
- Amoxicillin 500mg TDS x 7 days
- Or Cephalexin 500mg QDS x 7 days
- Avoid: Ciprofloxacin, Cotrimoxazole (1st trimester), Nitrofurantoin (near term)

**Catheter-associated UTI:**
- Remove/replace catheter
- Treat only if symptomatic
- Ciprofloxacin 500mg BD x 7 days

**Urinalysis interpretation:**
- Leukocyte esterase: suggests pyuria
- Nitrites: suggests gram-negative bacteria (E. coli)
- Both positive: high predictive value for UTI`,
  },

  // ── MALNUTRITION ─────────────────────────────────────────
  {
    keywords: ['malnutrition', 'sam', 'mam', 'muac', 'kwashiorkor', 'marasmus', 'rutf', 'plumpy nut', 'f75', 'f100', 'wasting', 'therapeutic feeding'],
    topic: 'Malnutrition Management',
    response: `**Severe Acute Malnutrition (SAM) — WHO Protocol**

**Diagnosis:**
- MUAC <11.5 cm (6-59 months)
- Weight-for-height <-3 Z-scores
- Bilateral pitting edema (kwashiorkor)

**Inpatient management (with complications):**
1. **Stabilization (days 1-7):** F-75 therapeutic milk
   - 130 mL/kg/day divided into 8 feeds (every 3 hours)
   - Do NOT give high-protein/high-calorie feeds initially
2. **Transition:** Switch to F-100 when appetite returns, edema resolving
3. **Rehabilitation:** F-100 at 150-220 mL/kg/day, RUTF when able

**Systematic treatment on admission:**
- Glucose: 50mL 10% dextrose if hypoglycemia (<3 mmol/L)
- Hypothermia: Kangaroo care, warm room, warm feeds
- Amoxicillin 25mg/kg BD x 7 days (routine antibiotics)
- Vitamin A on day 1
- Folic acid 5mg on day 1, then 1mg daily
- Zinc 2mg/kg/day
- Do NOT give iron until rehabilitation phase

**Outpatient (SAM without complications):**
- RUTF (Plumpy'Nut): ~200 kcal/kg/day
- Weekly follow-up until MUAC >12.5 cm for 2 consecutive visits

**MAM (MUAC 11.5-12.5 cm):**
- Supplementary feeding (CSB++, RUSF)
- Nutrition counseling, monthly follow-up`,
  },

  // ── EMERGENCY / TRIAGE ──────────────────────────────────
  {
    keywords: ['emergency', 'triage', 'resuscitation', 'abcde', 'shock', 'cpr', 'cardiac arrest', 'first aid'],
    topic: 'Emergency & Triage',
    response: `**Emergency Assessment (ABCDE)**

**A — Airway:**
- Look, listen, feel for obstruction
- Head tilt, chin lift (jaw thrust if trauma)
- Suction, remove foreign bodies
- Oropharyngeal airway if unconscious

**B — Breathing:**
- Rate, depth, pattern, SpO₂
- Oxygen: nasal cannula 1-5 L/min or face mask 5-10 L/min
- Bag-valve-mask if apneic/inadequate

**C — Circulation:**
- Pulse, BP, capillary refill, skin color
- IV access x 2 (large bore)
- Fluid bolus: NS or RL 20 mL/kg (adults 500-1000mL rapidly)
- Stop external bleeding: direct pressure

**D — Disability:**
- AVPU: Alert, Voice, Pain, Unresponsive
- Blood glucose (treat if <3.9 mmol/L)
- Pupil size and reactivity

**E — Exposure:**
- Fully undress, examine for injuries
- Prevent hypothermia (cover after exam)

**WHO Triage (ETAT):**
- **Red (Emergency):** Obstructed breathing, severe respiratory distress, shock, coma, convulsions, severe dehydration
- **Yellow (Priority):** Very young, fever (very high), trauma, severe pain, restless/irritable, pallor, respiratory distress, referral
- **Green (Non-urgent):** Walking, no danger signs, stable vitals`,
  },

  // ── DRUG INTERACTIONS / SIDE EFFECTS ────────────────────
  {
    keywords: ['drug interaction', 'side effect', 'adverse reaction', 'drug reaction', 'allergy', 'anaphylaxis'],
    topic: 'Drug Reactions & Interactions',
    response: `**Common Drug Interactions (South Sudan Essential Medicines)**

**Rifampicin interactions (critical):**
- Reduces effect of: ARVs (especially DTG — double DTG dose to BD), oral contraceptives, warfarin, steroids, antifungals
- DTG dosing with Rifampicin: 50mg BD (instead of OD)

**Metformin:**
- Hold before IV contrast (risk of lactic acidosis)
- Avoid with heavy alcohol use
- Reduce dose if eGFR <45

**ACE Inhibitors (Enalapril):**
- Contraindicated in pregnancy (teratogenic)
- Risk of hyperkalemia with potassium-sparing diuretics
- Monitor renal function

**Anaphylaxis management:**
1. **Adrenaline (Epinephrine)** 0.5mg IM (1:1000) into anterolateral thigh — repeat q5min
2. High-flow oxygen
3. IV fluids (NS/RL) 500-1000mL bolus
4. Hydrocortisone 200mg IV
5. Chlorphenamine 10mg IV
6. Salbutamol nebulizer if bronchospasm

**Common ADRs to watch:**
- ACTs: headache, dizziness (usually mild)
- Cotrimoxazole: Stevens-Johnson syndrome (stop immediately if rash)
- Gentamicin: nephrotoxicity, ototoxicity (monitor)
- Chloramphenicol: aplastic anemia (rare but fatal)`,
  },

  // ── PEDIATRICS / IMCI ───────────────────────────────────
  {
    keywords: ['child', 'pediatric', 'paediatric', 'imci', 'infant', 'neonatal', 'newborn', 'vaccination', 'immunization', 'growth', 'milestone'],
    topic: 'Pediatrics / IMCI',
    response: `**Integrated Management of Childhood Illness (IMCI)**

**Danger signs in sick child (refer urgently):**
- Unable to drink/breastfeed
- Vomits everything
- Convulsions
- Lethargic or unconscious

**Fever assessment:**
- Always test for malaria (RDT)
- Check for stiff neck (meningitis)
- Check for measles rash
- Classify: very severe febrile disease → severe malaria → malaria → fever (no focus)

**Cough/difficulty breathing:**
- Count respiratory rate:
  - <2 months: ≥60 = fast breathing
  - 2-12 months: ≥50 = fast breathing
  - 1-5 years: ≥40 = fast breathing
- Chest indrawing = severe pneumonia → refer
- Fast breathing only = pneumonia → Amoxicillin

**Diarrhea in children:**
- Assess dehydration (Plan A/B/C as per WHO)
- Zinc for ALL children with diarrhea
- Continue breastfeeding
- ORS after each loose stool

**South Sudan EPI Schedule:**
- Birth: BCG, OPV-0, Hep B birth dose
- 6 weeks: Penta1, OPV1, PCV1, Rota1
- 10 weeks: Penta2, OPV2, PCV2, Rota2
- 14 weeks: Penta3, OPV3, PCV3, IPV
- 9 months: Measles 1, Yellow Fever
- 15 months: Measles 2`,
  },

  // ── WOUND / SURGICAL ────────────────────────────────────
  {
    keywords: ['wound', 'suture', 'laceration', 'abscess', 'burn', 'snake bite', 'tetanus', 'surgical', 'debridement'],
    topic: 'Wound & Surgical Emergencies',
    response: `**Wound Management**

**Clean wound:**
- Irrigate with NS or clean water
- Primary closure (suture) within 6-8 hours
- Tetanus prophylaxis if not up to date

**Contaminated / bite wound:**
- Irrigate thoroughly, debride devitalized tissue
- Leave open (delayed primary closure at 3-5 days)
- Antibiotics: Amoxicillin-Clavulanate 625mg TDS x 5-7 days

**Abscess:**
- Incision and drainage (I&D) under local anesthesia
- Pack wound loosely, daily dressing changes
- Antibiotics only if surrounding cellulitis: Cloxacillin 500mg QDS or Amoxicillin-Clav

**Burns (Rule of 9s for BSA):**
- <10% BSA (adult) or <5% (child): outpatient
- ≥10% BSA or face/hands/genitals/circumferential: refer
- Fluid resuscitation: Parkland formula = 4 mL x %BSA x weight (kg), half in first 8h
- Pain: Paracetamol ± Tramadol. Silver sulfadiazine cream.

**Snake Bite (South Sudan — vipers, cobras, mambas):**
- Immobilize limb, do NOT tourniquet or cut
- Antivenom if available: reconstitute, give IV over 1 hour
- Monitor for anaphylaxis (have adrenaline ready)
- Tetanus prophylaxis, wound care
- Watch for: coagulopathy (check clotting test q6h), neurotoxicity, renal failure`,
  },

  // ── MENTAL HEALTH ───────────────────────────────────────
  {
    keywords: ['mental health', 'depression', 'anxiety', 'ptsd', 'psychosis', 'suicide', 'mental', 'psychiatric', 'trauma'],
    topic: 'Mental Health',
    response: `**Mental Health in Conflict Settings (South Sudan context)**

**Depression screening (PHQ-2/PHQ-9):**
- Loss of interest/pleasure + depressed mood for >2 weeks
- Mild-moderate: Structured counseling, social support
- Severe: Fluoxetine 20mg OD (if available), refer to mental health officer

**PTSD (common in conflict-affected populations):**
- Intrusive memories, avoidance, hyperarousal, negative cognitions
- Narrative Exposure Therapy (NET) — evidence-based for conflict settings
- Avoid benzodiazepines (risk of dependence)

**Acute psychosis:**
- Haloperidol 2-5mg IM (acute agitation) — may repeat after 30 min
- Chlorpromazine 25-50mg oral TDS (maintenance)
- Rule out: malaria (cerebral), meningitis, substance use, HIV encephalopathy

**Suicide risk assessment:**
- Ask directly: "Are you thinking of harming yourself?"
- High risk: constant supervision, remove means, urgent referral
- Safety planning with patient and family

**WHO mhGAP recommendations:**
- Integrate into primary care
- Train clinical officers in psychological first aid
- Community-based mental health support
- Prioritize: depression, psychosis, epilepsy, substance use, child behavioral disorders`,
  },

  // ── LAB INTERPRETATION ──────────────────────────────────
  {
    keywords: ['lab', 'laboratory', 'blood test', 'cbc', 'fbc', 'full blood count', 'liver function', 'renal function', 'wbc', 'hemoglobin', 'creatinine', 'interpret'],
    topic: 'Lab Result Interpretation',
    response: `**Common Lab Interpretation**

**Full Blood Count (FBC):**
| Test | Normal Range | Clinical Significance |
|------|-------------|----------------------|
| Hb | M: 13-17, F: 12-15 g/dL | Low = anemia |
| WBC | 4-11 x10⁹/L | High = infection; Low = immunosuppression |
| Neutrophils | 2-7.5 x10⁹/L | High = bacterial infection |
| Lymphocytes | 1.5-4 x10⁹/L | High = viral; Low = HIV/immunosuppression |
| Platelets | 150-400 x10⁹/L | Low = DIC, malaria, HELLP; High = infection |

**Renal Function:**
- Creatinine: 60-110 μmol/L (M), 45-90 (F)
- BUN/Urea: 2.5-6.7 mmol/L
- Elevated = dehydration, renal failure, obstruction

**Liver Function:**
- ALT: 7-56 U/L (most specific for liver)
- AST: 10-40 U/L
- ALP: 44-147 U/L (elevated in obstruction, bone disease)
- Bilirubin: 3-21 μmol/L
- Elevated ALT/AST: hepatitis, drug toxicity, malaria

**Blood Glucose:**
- Fasting: 3.9-5.5 mmol/L (70-100 mg/dL)
- Random: <7.8 mmol/L (<140 mg/dL)
- Diabetic: Fasting ≥7.0 or Random ≥11.1

**Urinalysis quick guide:**
- Protein + glucose: consider diabetes with nephropathy
- Leukocytes + nitrites: UTI
- Blood: trauma, stones, infection, malignancy`,
  },

  // ── SOUTH SUDAN SPECIFIC ────────────────────────────────
  {
    keywords: ['south sudan', 'ss', 'endemic', 'tropical', 'outbreak', 'surveillance', 'kala-azar', 'leishmaniasis', 'river blindness', 'onchocerciasis', 'guinea worm'],
    topic: 'South Sudan-Specific Health Issues',
    response: `**South Sudan Health Context**

**Top disease burden:**
1. Malaria (leading cause of morbidity and mortality)
2. Respiratory infections (pneumonia, TB)
3. Diarrheal diseases (cholera endemic in multiple states)
4. Malnutrition (one of the highest rates globally)
5. HIV/AIDS
6. Conflict-related injuries and mental health

**Neglected Tropical Diseases:**
- **Kala-azar (Visceral Leishmaniasis):** Endemic in Eastern Equatoria, Jonglei
  - Signs: Prolonged fever, splenomegaly, weight loss, pancytopenia
  - Treatment: Sodium Stibogluconate (SSG) + Paromomycin x 17 days
  - Refer to kala-azar treatment centers

- **River Blindness (Onchocerciasis):** Endemic along rivers
  - Mass drug administration: Ivermectin annually

- **Guinea Worm:** Near eradication — report ANY suspected case

**Cholera preparedness:**
- Hot season outbreaks common near Nile/Sudd region
- Oral Cholera Vaccine (OCV) campaigns during outbreaks
- Case fatality rate target: <1% with proper rehydration

**Reporting:**
- IDSR (Integrated Disease Surveillance and Response)
- Immediately notifiable: cholera, measles, meningitis, hemorrhagic fever, polio, guinea worm, kala-azar
- Weekly reporting through DHIS2

**Supply chain considerations:**
- Essential medicines frequently stock out — always have backup treatment options
- Cold chain challenges for vaccines and insulin
- WHO Emergency Health Kits (IEHK) as emergency supply`,
  },

  // ── GENERAL CLINICAL QUERIES ────────────────────────────
  {
    keywords: ['dose', 'dosage', 'how much', 'how to give', 'calculate', 'pediatric dose', 'weight based'],
    topic: 'Drug Dosing Principles',
    response: `**Pediatric Dosing Principles**

**Weight-based dosing formula:**
Dose = mg/kg × patient weight (kg)

**Common pediatric doses:**
- Paracetamol: 15mg/kg q4-6h (max 60mg/kg/day)
- Amoxicillin: 25-50mg/kg/day in 2-3 divided doses
- Ibuprofen: 5-10mg/kg q6-8h
- Artemether-Lumefantrine: by weight band (see malaria section)
- Ceftriaxone: 50-100mg/kg/day (max 4g)
- Gentamicin: 5-7.5mg/kg OD

**Renal dose adjustments:**
- Reduce dose or extend interval for renally cleared drugs
- Key drugs: Gentamicin, Metformin, Ciprofloxacin, Cotrimoxazole

**Hepatic dose adjustments:**
- Reduce dose for hepatically metabolized drugs
- Avoid: Paracetamol in severe liver disease, Methotrexate

**IV drip rate calculation:**
- Drops/min = (Volume in mL × Drop factor) ÷ (Time in minutes)
- Standard giving set: 20 drops/mL
- Micro drip (pediatric): 60 drops/mL
- Example: 1000mL over 8h = (1000 × 20) ÷ 480 = 42 drops/min`,
  },
  {
    keywords: ['pregnancy', 'antenatal', 'anc', 'prenatal', 'obstetric', 'delivery', 'labor', 'postpartum', 'pph'],
    topic: 'Obstetric Care',
    response: `**Obstetric Quick Reference**

**Focused ANC (WHO 8-contact model):**
- First visit: <12 weeks (history, exam, labs, dating)
- Subsequent: 20, 26, 30, 34, 36, 38, 40 weeks
- Essential: BP, urine protein, Hb, HIV, syphilis, blood group

**ANC medications (routine):**
- Iron + Folic acid: Ferrous Sulfate 60mg + Folic Acid 400mcg daily
- IPTp-SP: Sulfadoxine-Pyrimethamine from 13 weeks, each ANC visit (min 3 doses)
- Tetanus Toxoid: 2 doses (TT1 at first contact, TT2 ≥4 weeks later)
- Deworming: Mebendazole 500mg (after 1st trimester)

**Danger signs in pregnancy (counsel at every visit):**
Vaginal bleeding, severe headache, blurred vision, convulsions, fever, severe abdominal pain, reduced fetal movement, leaking fluid

**Postpartum Hemorrhage (PPH) — >500mL blood loss:**
1. Call for help, rub the uterus
2. Oxytocin 10 IU IM/IV (if not already given)
3. Misoprostol 800mcg sublingual (if oxytocin not available)
4. IV fluids: 2 large-bore IVs, NS/RL wide open
5. Bimanual uterine compression if uterus atonic
6. If retained placenta: manual removal under anesthesia
7. Transfuse if Hb <7 or hemodynamically unstable

**Active management of third stage (AMTSL):**
- Oxytocin 10 IU IM within 1 minute of delivery
- Controlled cord traction
- Uterine massage after placenta delivery`,
  },
];

// Fallback responses for unmatched queries
const fallbackResponses = [
  `I don't have a specific protocol for that query in my knowledge base. Here are some suggestions:

- Try rephrasing with medical keywords (e.g., "malaria treatment" instead of "what do I give for fever")
- I cover: **Malaria, Pneumonia, Cholera, Typhoid, TB, HIV, Meningitis, Anemia, Hypertension, Diabetes, Measles, UTI, Malnutrition, Pre-eclampsia, Emergency triage, Drug dosing, Pediatrics/IMCI, Wound care, Mental health, Lab interpretation, Obstetric care**, and South Sudan-specific health guidance.
- For clinical emergencies, always follow your institution's protocols and consult senior colleagues.`,
];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  topic?: string;
  timestamp: string;
}

export function getAssistantResponse(question: string): { content: string; topic?: string } {
  const lower = question.toLowerCase();
  const tokens = tokenize(question);

  // Score each knowledge entry
  const scored: { entry: KnowledgeEntry; score: number }[] = [];

  for (const entry of knowledgeBase) {
    let score = 0;

    // Exact keyword matches
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.split(' ').length * 10; // Multi-word keywords score higher
      }
    }

    // Token overlap
    for (const token of tokens) {
      for (const keyword of entry.keywords) {
        if (keyword.includes(token)) {
          score += 3;
        }
      }
    }

    // Topic name match
    if (lower.includes(entry.topic.toLowerCase())) {
      score += 20;
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score >= 8) {
    const best = scored[0].entry;

    // If there's a second relevant result, mention it
    let content = best.response;
    if (scored.length > 1 && scored[1].score >= 15 && scored[1].entry.topic !== best.topic) {
      content += `\n\n---\n*Also relevant: **${scored[1].entry.topic}** — ask me about it for more details.*`;
    }

    return { content, topic: best.topic };
  }

  // Greeting handling
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/i.test(question.trim())) {
    return {
      content: `Hello, doctor! I'm your clinical assistant. I can help with treatment protocols, drug dosing, differential diagnosis, emergency management, and more — all based on WHO/IMCI guidelines relevant to South Sudan.

**Try asking me about:**
- "How to treat severe malaria?"
- "Pneumonia management in children"
- "DKA emergency protocol"
- "Pre-eclampsia magnesium sulfate dose"
- "TB/HIV co-infection management"
- "Lab interpretation CBC"

What can I help you with?`,
      topic: 'Welcome',
    };
  }

  return { content: fallbackResponses[0] };
}
