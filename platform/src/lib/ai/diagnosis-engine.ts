/**
 * Offline AI Clinical Decision Support Engine
 * Rule-based, WHO/IMCI guideline-aligned diagnosis engine for South Sudan context.
 * Runs entirely in the browser — zero network dependency.
 */

import type { AIEvaluation, AIDiagnosisSuggestion } from '@/lib/db-types';

export interface PatientInput {
  chiefComplaint: string;
  vitals: {
    temperature: number;
    systolic: number;
    diastolic: number;
    pulse: number;
    respiratoryRate: number;
    oxygenSaturation: number;
    weight: number;
    height: number;
    muac?: number;
  };
  age: number;           // in years
  gender: 'Male' | 'Female';
  physicalExam: {
    general: string;
    cardiovascular: string;
    respiratory: string;
    abdominal: string;
    neurological: string;
  };
  chronicConditions: string[];
  allergies: string[];
}

interface DiseaseRule {
  icd10Code: string;
  name: string;
  keywords: string[];
  vitalChecks: ((v: PatientInput['vitals']) => number)[];
  examChecks: ((exam: PatientInput['physicalExam']) => number)[];
  ageGenderWeight: (age: number, gender: string) => number;
  chronicBoost: (conditions: string[]) => number;
  severity: (score: number, v: PatientInput['vitals']) => 'mild' | 'moderate' | 'severe';
  treatment: string;
  tests: string[];
}

function kw(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const k of keywords) {
    if (lower.includes(k)) hits++;
  }
  return hits;
}

function examKw(exam: PatientInput['physicalExam'], keywords: string[]): number {
  const all = `${exam.general} ${exam.cardiovascular} ${exam.respiratory} ${exam.abdominal} ${exam.neurological}`.toLowerCase();
  let hits = 0;
  for (const k of keywords) {
    if (all.includes(k)) hits++;
  }
  return hits;
}

const diseaseRules: DiseaseRule[] = [
  // 1. Malaria
  {
    icd10Code: 'B50',
    name: 'Plasmodium falciparum malaria',
    keywords: ['fever', 'headache', 'chills', 'rigors', 'sweating', 'malaria', 'body ache', 'joint pain', 'vomiting', 'nausea'],
    vitalChecks: [
      v => v.temperature >= 38.0 ? 20 : v.temperature >= 37.5 ? 10 : 0,
      v => v.pulse >= 100 ? 5 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['splenomegaly', 'jaundice', 'pallor', 'hepatomegaly', 'pale']) * 8,
    ],
    ageGenderWeight: () => 5, // Endemic region — baseline risk for everyone
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('sickle')) ? 10 : 0,
    severity: (score, v) => v.temperature >= 39.5 || score >= 60 ? 'severe' : v.temperature >= 38.5 ? 'moderate' : 'mild',
    treatment: 'Artemether-Lumefantrine (Coartem) 80/480mg BD x 3 days. If severe: IV Artesunate 2.4mg/kg at 0, 12, 24h then daily. Paracetamol for fever.',
    tests: ['Malaria RDT', 'Full Blood Count'],
  },
  // 2. Pneumonia
  {
    icd10Code: 'J18',
    name: 'Community-acquired pneumonia',
    keywords: ['cough', 'fever', 'chest pain', 'difficulty breathing', 'shortness of breath', 'sputum', 'phlegm', 'pneumonia', 'breathing'],
    vitalChecks: [
      v => v.temperature >= 38.0 ? 15 : 0,
      v => v.respiratoryRate >= 25 ? 15 : v.respiratoryRate >= 20 ? 8 : 0,
      v => v.oxygenSaturation < 92 ? 20 : v.oxygenSaturation < 95 ? 10 : 0,
      v => v.pulse >= 100 ? 5 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['crackles', 'crepitations', 'bronchial', 'dullness', 'consolidation', 'reduced breath sounds', 'rhonchi']) * 10,
    ],
    ageGenderWeight: (age) => age > 65 || age < 5 ? 10 : 0,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hiv') || x.toLowerCase().includes('asthma') || x.toLowerCase().includes('copd')) ? 10 : 0,
    severity: (score, v) => v.oxygenSaturation < 92 || score >= 65 ? 'severe' : v.oxygenSaturation < 95 ? 'moderate' : 'mild',
    treatment: 'Amoxicillin 500mg-1g TDS x 5-7 days. If severe: Ceftriaxone 1-2g IV daily + Azithromycin 500mg OD. Oxygen if SpO2 <92%.',
    tests: ['Full Blood Count', 'Blood Glucose'],
  },
  // 3. Cholera / Acute Diarrhea
  {
    icd10Code: 'A00',
    name: 'Cholera / Acute diarrheal disease',
    keywords: ['diarrhea', 'diarrhoea', 'watery stool', 'vomiting', 'dehydration', 'cholera', 'loose stool', 'rice water'],
    vitalChecks: [
      v => v.pulse >= 110 ? 15 : v.pulse >= 100 ? 8 : 0,
      v => v.systolic < 90 ? 15 : v.systolic < 100 ? 8 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['dehydrated', 'dry mucosa', 'sunken eyes', 'poor skin turgor', 'dry mouth', 'lethargic', 'absent tears']) * 10,
    ],
    ageGenderWeight: (age) => age < 5 || age > 65 ? 10 : 0,
    chronicBoost: () => 0,
    severity: (score, v) => v.systolic < 90 || score >= 60 ? 'severe' : v.pulse >= 100 ? 'moderate' : 'mild',
    treatment: 'ORS after each loose stool. If severe: IV Ringer\'s Lactate 100ml/kg over 3h (adults). Zinc 20mg OD x 10-14 days (children). Doxycycline 300mg single dose if cholera suspected.',
    tests: ['Full Blood Count', 'Renal Function'],
  },
  // 4. Typhoid
  {
    icd10Code: 'A01',
    name: 'Typhoid fever',
    keywords: ['fever', 'headache', 'abdominal pain', 'constipation', 'diarrhea', 'typhoid', 'stepladder fever', 'malaise', 'anorexia'],
    vitalChecks: [
      v => v.temperature >= 38.5 ? 15 : v.temperature >= 38.0 ? 8 : 0,
      v => v.pulse < 90 && v.temperature >= 38.5 ? 10 : 0, // Relative bradycardia
    ],
    examChecks: [
      exam => examKw(exam, ['rose spots', 'hepatomegaly', 'splenomegaly', 'tender abdomen', 'coated tongue', 'abdominal tenderness']) * 8,
    ],
    ageGenderWeight: () => 3,
    chronicBoost: () => 0,
    severity: (score, v) => v.temperature >= 40 || score >= 55 ? 'severe' : v.temperature >= 39 ? 'moderate' : 'mild',
    treatment: 'Ciprofloxacin 500mg BD x 7-14 days or Azithromycin 500mg OD x 7 days. If severe: Ceftriaxone 2g IV OD x 14 days. Paracetamol for fever.',
    tests: ['Full Blood Count', 'Blood Glucose', 'Liver Function'],
  },
  // 5. Tuberculosis
  {
    icd10Code: 'A15',
    name: 'Pulmonary tuberculosis',
    keywords: ['cough', 'weight loss', 'night sweats', 'hemoptysis', 'blood in sputum', 'tuberculosis', 'tb', 'chronic cough', 'fever', 'weeks'],
    vitalChecks: [
      v => v.temperature >= 37.5 && v.temperature < 39 ? 10 : 0, // Low-grade fever
    ],
    examChecks: [
      exam => examKw(exam, ['cachexia', 'wasting', 'lymphadenopathy', 'crackles', 'apical', 'reduced breath sounds', 'weight loss', 'thin', 'malnourished']) * 8,
    ],
    ageGenderWeight: () => 5,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hiv')) ? 20 : 0,
    severity: (score) => score >= 55 ? 'severe' : score >= 35 ? 'moderate' : 'mild',
    treatment: 'RHZE (Rifampicin/Isoniazid/Pyrazinamide/Ethambutol) fixed-dose daily x 2 months, then RH x 4 months. Refer for sputum microscopy/GeneXpert.',
    tests: ['Full Blood Count', 'HIV Rapid Test'],
  },
  // 6. HIV-related illness
  {
    icd10Code: 'B20',
    name: 'HIV disease',
    keywords: ['weight loss', 'chronic diarrhea', 'persistent fever', 'oral thrush', 'skin rash', 'hiv', 'aids', 'opportunistic', 'recurrent infections'],
    vitalChecks: [
      v => v.temperature >= 37.5 ? 5 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['oral thrush', 'candidiasis', 'lymphadenopathy', 'wasting', 'kaposi', 'herpes zoster', 'dermatitis', 'cachexia']) * 10,
    ],
    ageGenderWeight: () => 3,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hiv')) ? 30 : 0,
    severity: (score) => score >= 55 ? 'severe' : score >= 35 ? 'moderate' : 'mild',
    treatment: 'Initiate ART: TDF/3TC/DTG (300/300/50mg) OD. Cotrimoxazole prophylaxis 960mg OD. Refer for CD4 count and viral load.',
    tests: ['HIV Rapid Test', 'CD4 Count', 'Full Blood Count'],
  },
  // 7. Meningitis
  {
    icd10Code: 'G03',
    name: 'Bacterial meningitis',
    keywords: ['headache', 'fever', 'stiff neck', 'neck stiffness', 'photophobia', 'confusion', 'vomiting', 'meningitis', 'altered consciousness', 'seizure'],
    vitalChecks: [
      v => v.temperature >= 38.5 ? 15 : 0,
      v => v.pulse >= 100 ? 5 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['neck stiffness', 'kernig', 'brudzinski', 'photophobia', 'altered consciousness', 'confusion', 'petechiae', 'purpura', 'bulging fontanelle']) * 12,
    ],
    ageGenderWeight: (age) => age < 5 ? 10 : 0,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hiv')) ? 10 : 0,
    severity: (score, v) => score >= 50 ? 'severe' : v.temperature >= 39 ? 'moderate' : 'mild',
    treatment: 'EMERGENCY: Ceftriaxone 2g IV BD (adult) or 50mg/kg IV (child) immediately. Dexamethasone 0.15mg/kg IV before/with first antibiotic dose. Urgent referral.',
    tests: ['Full Blood Count', 'Blood Glucose'],
  },
  // 8. Anemia
  {
    icd10Code: 'D64',
    name: 'Anemia',
    keywords: ['fatigue', 'tiredness', 'pale', 'pallor', 'weakness', 'dizzy', 'dizziness', 'shortness of breath', 'palpitations', 'anemia'],
    vitalChecks: [
      v => v.pulse >= 100 ? 10 : 0,
      v => v.oxygenSaturation < 95 ? 5 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['pallor', 'pale', 'conjunctival pallor', 'koilonychia', 'glossitis', 'tachycardia', 'flow murmur']) * 10,
    ],
    ageGenderWeight: (age, gender) => (gender === 'Female' ? 5 : 0) + (age < 5 ? 5 : 0),
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('sickle') || x.toLowerCase().includes('hiv')) ? 10 : 0,
    severity: (score, v) => v.pulse >= 120 || score >= 55 ? 'severe' : score >= 35 ? 'moderate' : 'mild',
    treatment: 'Ferrous Sulfate 200mg TDS + Folic Acid 5mg OD x 3 months. If severe: consider blood transfusion. Treat underlying cause (malaria, hookworm). Mebendazole 500mg stat.',
    tests: ['Full Blood Count'],
  },
  // 9. Hypertensive crisis
  {
    icd10Code: 'I10',
    name: 'Hypertensive crisis',
    keywords: ['headache', 'dizziness', 'chest pain', 'blurred vision', 'high blood pressure', 'hypertension', 'nosebleed', 'epistaxis'],
    vitalChecks: [
      v => v.systolic >= 180 ? 25 : v.systolic >= 160 ? 15 : v.systolic >= 140 ? 8 : 0,
      v => v.diastolic >= 120 ? 20 : v.diastolic >= 100 ? 10 : v.diastolic >= 90 ? 5 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['papilledema', 'retinal hemorrhage', 'pedal edema', 'gallop', 'displaced apex', 'elevated jvp']) * 10,
    ],
    ageGenderWeight: (age) => age > 40 ? 5 : 0,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hypertension') || x.toLowerCase().includes('diabetes') || x.toLowerCase().includes('renal')) ? 15 : 0,
    severity: (score, v) => v.systolic >= 180 || v.diastolic >= 120 ? 'severe' : v.systolic >= 160 || v.diastolic >= 100 ? 'moderate' : 'mild',
    treatment: 'If severe (>180/120): Nifedipine 10mg sublingual or Hydralazine 5-10mg IV. Target: reduce BP by 25% in first hour. Maintenance: Amlodipine 5-10mg OD + Enalapril 5-20mg OD.',
    tests: ['Renal Function', 'Blood Glucose', 'Urinalysis'],
  },
  // 10. Diabetic emergency
  {
    icd10Code: 'E11',
    name: 'Diabetic emergency (hyperglycemia/DKA)',
    keywords: ['thirst', 'polyuria', 'frequent urination', 'weight loss', 'blurred vision', 'diabetes', 'sugar', 'glucose', 'diabetic', 'fruity breath'],
    vitalChecks: [
      v => v.respiratoryRate >= 25 ? 10 : 0, // Kussmaul breathing
      v => v.pulse >= 100 ? 5 : 0,
      v => v.systolic < 100 ? 10 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['kussmaul', 'fruity breath', 'acetone', 'dehydrated', 'dry mucosa', 'altered consciousness', 'lethargic']) * 10,
    ],
    ageGenderWeight: (age) => age > 40 ? 5 : 0,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('diabetes')) ? 25 : 0,
    severity: (score, v) => score >= 55 || v.systolic < 90 ? 'severe' : score >= 35 ? 'moderate' : 'mild',
    treatment: 'Check blood glucose urgently. If DKA: IV Normal Saline 1L/hr, Insulin regular 0.1 units/kg/hr IV infusion, monitor K+. If mild hyperglycemia: adjust oral medications, Metformin 500-1000mg BD.',
    tests: ['Blood Glucose', 'Renal Function', 'Urinalysis'],
  },
  // 11. Measles
  {
    icd10Code: 'B05',
    name: 'Measles',
    keywords: ['rash', 'fever', 'cough', 'red eyes', 'conjunctivitis', 'measles', 'koplik spots', 'runny nose', 'maculopapular'],
    vitalChecks: [
      v => v.temperature >= 38.5 ? 15 : v.temperature >= 38.0 ? 8 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['maculopapular rash', 'koplik spots', 'conjunctivitis', 'red eyes', 'coryza', 'rash', 'desquamation']) * 12,
    ],
    ageGenderWeight: (age) => age < 5 ? 15 : age < 15 ? 10 : 0,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hiv') || x.toLowerCase().includes('malnutrition')) ? 10 : 0,
    severity: (score, v) => score >= 55 ? 'severe' : v.temperature >= 39 ? 'moderate' : 'mild',
    treatment: 'Vitamin A: 200,000 IU (>12mo), 100,000 IU (6-12mo), 50,000 IU (<6mo) x 2 doses. Paracetamol for fever. Watch for complications: pneumonia, encephalitis. Isolate patient.',
    tests: ['Full Blood Count'],
  },
  // 12. Upper RTI
  {
    icd10Code: 'J06',
    name: 'Upper respiratory tract infection',
    keywords: ['sore throat', 'runny nose', 'nasal congestion', 'sneezing', 'cough', 'cold', 'throat pain', 'mild fever'],
    vitalChecks: [
      v => v.temperature >= 37.5 && v.temperature < 38.5 ? 8 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['pharyngeal erythema', 'tonsillar', 'rhinorrhea', 'nasal congestion', 'clear chest', 'no adventitious sounds']) * 6,
    ],
    ageGenderWeight: () => 3,
    chronicBoost: () => 0,
    severity: () => 'mild',
    treatment: 'Symptomatic: Paracetamol 1g QDS PRN, warm fluids, rest. Antibiotics NOT indicated unless bacterial pharyngitis (Amoxicillin 500mg TDS x 5 days).',
    tests: [],
  },
  // 13. UTI
  {
    icd10Code: 'N39',
    name: 'Urinary tract infection',
    keywords: ['dysuria', 'burning urination', 'frequency', 'urgency', 'suprapubic pain', 'uti', 'cloudy urine', 'hematuria', 'flank pain'],
    vitalChecks: [
      v => v.temperature >= 38.5 ? 10 : 0, // Suggests pyelonephritis
      v => v.pulse >= 100 ? 5 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['suprapubic tenderness', 'costovertebral angle tenderness', 'flank tenderness', 'lower abdominal tenderness']) * 10,
    ],
    ageGenderWeight: (age, gender) => gender === 'Female' ? 10 : 0,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('diabetes')) ? 5 : 0,
    severity: (score, v) => v.temperature >= 38.5 || score >= 50 ? 'moderate' : 'mild',
    treatment: 'Ciprofloxacin 500mg BD x 3 days (uncomplicated) or 7-14 days (complicated/pyelonephritis). If pregnant: Amoxicillin 500mg TDS x 7 days. Increase fluid intake.',
    tests: ['Urinalysis', 'Full Blood Count'],
  },
  // 14. Malnutrition
  {
    icd10Code: 'E43',
    name: 'Severe acute malnutrition',
    keywords: ['weight loss', 'malnutrition', 'wasting', 'edema', 'swelling', 'failure to thrive', 'not eating', 'poor appetite', 'kwashiorkor'],
    vitalChecks: [
      v => {
        if (!v.weight || !v.height) return 0;
        const bmi = v.weight / ((v.height / 100) ** 2);
        return bmi < 16 ? 20 : bmi < 18.5 ? 10 : 0;
      },
      v => (v.muac && v.muac < 11.5) ? 25 : (v.muac && v.muac < 12.5) ? 15 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['wasting', 'muscle wasting', 'edema', 'pitting edema', 'hair changes', 'skin changes', 'kwashiorkor', 'marasmus', 'visible ribs', 'thin']) * 10,
    ],
    ageGenderWeight: (age) => age < 5 ? 15 : 0,
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hiv') || x.toLowerCase().includes('tb')) ? 10 : 0,
    severity: (score, v) => (v.muac && v.muac < 11.5) || score >= 55 ? 'severe' : score >= 35 ? 'moderate' : 'mild',
    treatment: 'Severe: F-75 therapeutic milk, then F-100. RUTF (Plumpy\'nut) when appetite returns. Treat infections, deworming (Mebendazole). Vitamin A, Folic acid, Zinc. Monitor feeding 2-hourly.',
    tests: ['Full Blood Count', 'Blood Glucose', 'HIV Rapid Test'],
  },
  // 15. Pre-eclampsia
  {
    icd10Code: 'O14',
    name: 'Pre-eclampsia',
    keywords: ['pregnant', 'pregnancy', 'headache', 'swelling', 'edema', 'blurred vision', 'epigastric pain', 'pre-eclampsia', 'eclampsia', 'proteinuria'],
    vitalChecks: [
      v => v.systolic >= 160 ? 25 : v.systolic >= 140 ? 15 : 0,
      v => v.diastolic >= 110 ? 20 : v.diastolic >= 90 ? 10 : 0,
    ],
    examChecks: [
      exam => examKw(exam, ['edema', 'pedal edema', 'facial edema', 'brisk reflexes', 'hyperreflexia', 'clonus', 'epigastric tenderness', 'proteinuria']) * 10,
    ],
    ageGenderWeight: (_age, gender) => gender === 'Female' ? 5 : -100, // Only females
    chronicBoost: (c) => c.some(x => x.toLowerCase().includes('hypertension')) ? 10 : 0,
    severity: (score, v) => v.systolic >= 160 || v.diastolic >= 110 || score >= 55 ? 'severe' : 'moderate',
    treatment: 'URGENT: Magnesium Sulfate 4g IV loading + 1g/hr maintenance (prevent seizures). Hydralazine 5-10mg IV for BP. Deliver if >=37 weeks or worsening. Urgent referral to obstetric unit.',
    tests: ['Urinalysis', 'Full Blood Count', 'Renal Function', 'Liver Function'],
  },
];

function evaluateVitalAlerts(vitals: PatientInput['vitals']): string[] {
  const alerts: string[] = [];
  if (vitals.temperature >= 39.0) alerts.push(`High fever (${vitals.temperature}°C) — suggests significant infection, consider malaria/sepsis.`);
  else if (vitals.temperature >= 38.0) alerts.push(`Fever (${vitals.temperature}°C) — indicates active infection or inflammatory process.`);
  else if (vitals.temperature < 35.5 && vitals.temperature > 0) alerts.push(`Hypothermia (${vitals.temperature}°C) — concerning for sepsis, exposure, or neonatal emergency.`);

  if (vitals.systolic >= 180 || vitals.diastolic >= 120) alerts.push(`Hypertensive emergency (${vitals.systolic}/${vitals.diastolic} mmHg) — immediate treatment needed.`);
  else if (vitals.systolic >= 140 || vitals.diastolic >= 90) alerts.push(`Elevated blood pressure (${vitals.systolic}/${vitals.diastolic} mmHg) — assess for hypertension.`);
  else if (vitals.systolic < 90 && vitals.systolic > 0) alerts.push(`Hypotension (${vitals.systolic}/${vitals.diastolic} mmHg) — assess for shock/dehydration.`);

  if (vitals.pulse >= 120) alerts.push(`Significant tachycardia (${vitals.pulse} bpm) — consider dehydration, infection, anemia, or cardiac cause.`);
  else if (vitals.pulse >= 100) alerts.push(`Tachycardia (${vitals.pulse} bpm) — may indicate fever, pain, dehydration, or anxiety.`);
  else if (vitals.pulse < 50 && vitals.pulse > 0) alerts.push(`Bradycardia (${vitals.pulse} bpm) — evaluate cardiac function.`);

  if (vitals.respiratoryRate >= 30) alerts.push(`Severe tachypnea (${vitals.respiratoryRate}/min) — respiratory distress, assess airway immediately.`);
  else if (vitals.respiratoryRate >= 24) alerts.push(`Tachypnea (${vitals.respiratoryRate}/min) — suggests respiratory or metabolic disorder.`);

  if (vitals.oxygenSaturation < 90 && vitals.oxygenSaturation > 0) alerts.push(`Critical hypoxia (SpO₂ ${vitals.oxygenSaturation}%) — oxygen therapy urgently needed.`);
  else if (vitals.oxygenSaturation < 95 && vitals.oxygenSaturation > 0) alerts.push(`Low oxygen saturation (SpO₂ ${vitals.oxygenSaturation}%) — monitor closely, consider supplemental O₂.`);

  if (vitals.weight && vitals.height) {
    const bmi = vitals.weight / ((vitals.height / 100) ** 2);
    if (bmi < 16) alerts.push(`Severe underweight (BMI ${bmi.toFixed(1)}) — evaluate for malnutrition.`);
    else if (bmi < 18.5) alerts.push(`Underweight (BMI ${bmi.toFixed(1)}) — nutritional assessment recommended.`);
  }

  if (vitals.muac && vitals.muac < 11.5) alerts.push(`MUAC ${vitals.muac} cm — severe acute malnutrition (SAM). Immediate nutritional intervention needed.`);
  else if (vitals.muac && vitals.muac < 12.5) alerts.push(`MUAC ${vitals.muac} cm — moderate acute malnutrition (MAM). Nutritional support recommended.`);

  return alerts;
}

function assessOverallSeverity(diagnoses: AIDiagnosisSuggestion[], alerts: string[]): string {
  const hasSevere = diagnoses.some(d => d.severity === 'severe' && d.confidence >= 40);
  const hasModerate = diagnoses.some(d => d.severity === 'moderate' && d.confidence >= 40);
  const criticalAlerts = alerts.filter(a =>
    a.includes('emergency') || a.includes('Critical') || a.includes('urgently') || a.includes('Severe') || a.includes('Hypothermia')
  ).length;

  if (hasSevere || criticalAlerts >= 2) return 'HIGH ACUITY — Urgent evaluation and treatment needed. Consider emergency protocols.';
  if (hasModerate || criticalAlerts >= 1) return 'MODERATE ACUITY — Prompt attention required. Monitor closely for deterioration.';
  return 'LOW ACUITY — Stable presentation. Standard outpatient management appropriate.';
}

function buildClinicalNotes(input: PatientInput, diagnoses: AIDiagnosisSuggestion[], alerts: string[]): string {
  const parts: string[] = [];
  parts.push(`AI evaluation performed on patient data: ${input.gender}, ~${input.age} years.`);

  if (input.chiefComplaint) {
    parts.push(`Chief complaint: "${input.chiefComplaint}".`);
  }

  if (diagnoses.length > 0) {
    const top = diagnoses.slice(0, 3).map(d => `${d.name} (${d.confidence}%)`).join(', ');
    parts.push(`Top differential diagnoses: ${top}.`);
  }

  if (alerts.length > 0) {
    parts.push(`${alerts.length} vital sign alert(s) identified.`);
  }

  if (input.chronicConditions.length > 0 && input.chronicConditions[0] !== 'None') {
    parts.push(`Chronic conditions noted: ${input.chronicConditions.join(', ')} — factored into assessment.`);
  }

  parts.push('This is an AI-assisted evaluation based on WHO/IMCI guidelines. Clinical judgment should always take precedence.');
  return parts.join(' ');
}

export function evaluatePatient(input: PatientInput): AIEvaluation {
  const scored: { rule: DiseaseRule; score: number }[] = [];

  for (const rule of diseaseRules) {
    let score = 0;

    // Keyword matching in chief complaint (primary signal)
    const keywordHits = kw(input.chiefComplaint, rule.keywords);
    score += keywordHits * 8;

    // Vital sign checks
    for (const check of rule.vitalChecks) {
      score += check(input.vitals);
    }

    // Physical exam checks
    for (const check of rule.examChecks) {
      score += check(input.physicalExam);
    }

    // Age/gender weighting
    score += rule.ageGenderWeight(input.age, input.gender);

    // Chronic condition boost
    score += rule.chronicBoost(input.chronicConditions);

    if (score > 10) {
      scored.push({ rule, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Convert to suggestions — cap confidence at 95
  const suggestedDiagnoses: AIDiagnosisSuggestion[] = scored.slice(0, 6).map(({ rule, score }) => {
    const confidence = Math.min(95, Math.round(score * 1.1));
    return {
      icd10Code: rule.icd10Code,
      name: rule.name,
      confidence,
      reasoning: buildReasoning(rule, input, score),
      severity: rule.severity(score, input.vitals),
      suggestedTreatment: rule.treatment,
    };
  });

  const vitalSignAlerts = evaluateVitalAlerts(input.vitals);

  // Collect recommended tests from top diagnoses (deduplicated)
  const testSet = new Set<string>();
  for (const { rule } of scored.slice(0, 4)) {
    for (const t of rule.tests) testSet.add(t);
  }
  const recommendedTests = Array.from(testSet);

  const severityAssessment = assessOverallSeverity(suggestedDiagnoses, vitalSignAlerts);
  const clinicalNotes = buildClinicalNotes(input, suggestedDiagnoses, vitalSignAlerts);

  return {
    suggestedDiagnoses,
    vitalSignAlerts,
    recommendedTests,
    severityAssessment,
    clinicalNotes,
    evaluatedAt: new Date().toISOString(),
  };
}

function buildReasoning(rule: DiseaseRule, input: PatientInput, score: number): string {
  const factors: string[] = [];

  const keywordHits = kw(input.chiefComplaint, rule.keywords);
  if (keywordHits > 0) {
    const matched = rule.keywords.filter(k => input.chiefComplaint.toLowerCase().includes(k));
    factors.push(`Keyword match in chief complaint: ${matched.slice(0, 4).join(', ')}`);
  }

  // Vital sign factors
  for (const check of rule.vitalChecks) {
    if (check(input.vitals) > 0) {
      factors.push('Vital sign abnormality supports this diagnosis');
      break;
    }
  }

  for (const check of rule.examChecks) {
    if (check(input.physicalExam) > 0) {
      factors.push('Physical exam findings consistent');
      break;
    }
  }

  if (rule.ageGenderWeight(input.age, input.gender) > 0) {
    factors.push(`Age/gender risk factor (${input.age}y ${input.gender})`);
  }

  if (rule.chronicBoost(input.chronicConditions) > 0) {
    factors.push('Pre-existing condition increases risk');
  }

  if (factors.length === 0) {
    factors.push('Low-level pattern match');
  }

  return factors.join('. ') + `. (Score: ${score})`;
}
