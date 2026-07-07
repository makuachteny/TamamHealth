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
