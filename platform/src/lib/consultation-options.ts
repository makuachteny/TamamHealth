import { medications } from '@/data/mock';

export const CONSULT_SECTION = {
  chiefComplaint: 0,
  vitals: 1,
  exam: 2,
  history: 3,
  diagnosis: 4,
  prescriptions: 5,
  labs: 6,
  treatment: 7,
  attachments: 8,
  followUp: 9,
  referral: 10,
} as const;

export const HISTORY_PROMPTS = [
  'Onset',
  'Location',
  'Duration',
  'Character',
  'Aggravating / relieving factors',
  'Radiation',
  'Timing',
  'Severity',
  'Associated symptoms',
  'Red flags',
  'Previous treatment',
  'Traditional medicine use',
];

export const COMMON_SURGERIES = [
  'Appendectomy',
  'Caesarean section',
  'Hernia repair',
  'Laparotomy',
  'Tonsillectomy',
  'Fracture fixation',
  'Cholecystectomy',
];

export const COMMON_ADMISSIONS = [
  'Severe malaria admission',
  'Pneumonia admission',
  'Asthma exacerbation admission',
  'Diabetic complication admission',
  'Obstetric admission',
  'Surgical admission',
];

export const COMMON_FAMILY = [
  'Hypertension',
  'Diabetes',
  'Heart disease',
  'Asthma',
  'Epilepsy',
  'Tuberculosis',
  'Sickle cell disease',
];

export const COMMON_OCCUPATIONS = [
  'Farmer',
  'Trader',
  'Teacher',
  'Student',
  'Driver',
  'Healthcare worker',
  'Housewife',
  'Unemployed',
];

export const COMMON_SUBSTANCE_USE = [
  'None',
  'Alcohol only',
  'Tobacco only',
  'Khat',
  'Cannabis',
  'Mixed substances',
];

export const COMMON_INSURANCE = [
  'Private insurance',
  'Employer scheme',
  'Community program',
  'NGO coverage',
  'Self-pay',
  'Unknown',
];

export const COMMON_ALLERGIES = [
  'Penicillin',
  'Sulfonamides',
  'Aspirin',
  'Ibuprofen',
  'Codeine',
  'Seafood',
  'Peanuts',
  'No known drug allergies',
];

export const COMMON_CHIEF_COMPLAINTS = [
  'Fever',
  'Cough',
  'Abdominal pain',
  'Headache',
  'Chest pain',
  'Shortness of breath',
  'Dysuria',
  'Antenatal review',
  'Follow-up visit',
  'Wound review',
];

export const PHYS_EXAM_QUICK_PICKS: Record<'general' | 'cardiovascular' | 'respiratory' | 'abdominal' | 'neurological', string[]> = {
  general: ['Well appearing', 'Acute distress', 'Ill looking', 'Dehydrated', 'Cachectic', 'Alert and oriented'],
  cardiovascular: ['Normal S1/S2', 'Tachycardic', 'Murmur present', 'No added sounds', 'Peripheral edema'],
  respiratory: ['Clear breath sounds', 'Wheeze', 'Crackles', 'Reduced air entry', 'Respiratory distress'],
  abdominal: ['Soft, non-tender', 'Tender abdomen', 'Guarding', 'Distended', 'Bowel sounds present'],
  neurological: ['Alert, no focal deficit', 'GCS 15/15', 'Reduced power', 'Confused', 'Meningeal signs present'],
};

export const COMMON_TREATMENT_PLANS = [
  'Symptomatic treatment and review',
  'Start antibiotic therapy',
  'Oral rehydration and rest',
  'Chronic disease counselling',
  'Refer for higher level care',
  'Follow up after investigations',
];

export const COMMON_FOLLOWUP_REASONS = [
  'Review symptoms',
  'Review lab results',
  'Review blood pressure',
  'Review wound healing',
  'Antenatal follow-up',
  'Medication adherence review',
];

export const COMMON_REFERRAL_REASONS = [
  'Needs specialist review',
  'Requires imaging / advanced investigations',
  'Needs surgical opinion',
  'Needs inpatient care',
  'Needs emergency stabilization',
];

export const COMMON_CHRONIC_MEDICATIONS = medications.slice(0, 24).map(m => m.name);

// Prescribing controlled vocabularies (kept out of the consultation component
// so nothing clinical is hardcoded inline). Route strings align with UCUM/EML
// administration routes; frequency strings drive the MAR schedule expansion.
export const ROUTE_OPTIONS = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Rectal', 'Inhaled'];
export const FREQUENCY_OPTIONS = [
  'OD (Once daily)', 'BD (Twice daily)', 'TDS (Three times daily)', 'QDS (Four times daily)',
  'PRN (As needed)', 'STAT (Immediately)', 'Nocte (At night)',
];

// Lab order sets — one-tap bundles of the tests commonly ordered together for a
// presentation, so the clinician selects a panel instead of ticking each box.
// Test names are matched (case-insensitive) against the facility lab catalog;
// any not in the catalog are added as custom investigations.
export const LAB_PANELS: { name: string; tests: string[] }[] = [
  { name: 'Fever work-up', tests: ['Malaria RDT', 'Full Blood Count', 'Blood Film', 'Widal Test', 'Urinalysis'] },
  { name: 'Malaria', tests: ['Malaria RDT', 'Blood Film', 'Full Blood Count'] },
  { name: 'ANC profile', tests: ['Full Blood Count', 'Blood Group & Rh', 'HIV Test', 'Hepatitis B', 'Syphilis (VDRL)', 'Urinalysis', 'Blood Glucose'] },
  { name: 'Diabetes review', tests: ['Blood Glucose (Fasting)', 'HbA1c', 'Renal Function', 'Urinalysis'] },
  { name: 'Renal / hypertension', tests: ['Renal Function', 'Electrolytes', 'Urinalysis', 'Full Blood Count'] },
  { name: 'Liver panel', tests: ['Liver Function Test', 'Hepatitis B', 'Hepatitis C', 'Full Blood Count'] },
  { name: 'HIV baseline', tests: ['HIV Test', 'CD4 Count', 'Full Blood Count', 'Liver Function Test', 'Renal Function'] },
  { name: 'Anaemia work-up', tests: ['Full Blood Count', 'Blood Film', 'Sickling Test', 'Renal Function'] },
];
