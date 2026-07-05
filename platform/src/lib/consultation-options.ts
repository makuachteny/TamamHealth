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

/** Signs & symptoms catalogue for the chief-complaint picker — organised by
 *  system and weighted toward South Sudan's recorded disease burden (malaria,
 *  typhoid, cholera/AWD, measles, meningitis, visceral leishmaniasis, TB/HIV,
 *  hepatitis E, schistosomiasis, malnutrition, snakebite, obstetric
 *  emergencies). Clinicians can add anything not listed from the picker. */
export const SYMPTOM_CATALOG: { label: string; options: string[] }[] = [
  { label: 'General & febrile', options: [
    'Fever', 'Chills and rigors', 'Night sweats', 'Fatigue / weakness', 'Weight loss',
    'Loss of appetite', 'Generalised body pain', 'Swollen lymph nodes', 'Excessive thirst',
    'Recurrent fevers', 'Failure to thrive (child)', 'Lethargy', 'Convulsions with fever',
  ]},
  { label: 'Respiratory', options: [
    'Cough', 'Cough with blood (haemoptysis)', 'Cough over 2 weeks', 'Shortness of breath',
    'Fast breathing', 'Chest pain on breathing', 'Wheezing', 'Noisy breathing (stridor)',
    'Sore throat', 'Runny / blocked nose', 'Chest in-drawing (child)',
  ]},
  { label: 'Gastrointestinal', options: [
    'Abdominal pain', 'Watery diarrhoea', 'Bloody diarrhoea (dysentery)', 'Rice-water stools',
    'Vomiting', 'Vomiting everything', 'Nausea', 'Constipation', 'Yellow eyes / jaundice',
    'Abdominal swelling / distension', 'Blood in vomit', 'Difficulty swallowing',
    'Worms in stool', 'Peri-anal itching',
  ]},
  { label: 'Neurological', options: [
    'Headache', 'Severe headache with neck stiffness', 'Convulsions / seizures',
    'Loss of consciousness', 'Confusion', 'Dizziness', 'Weakness of one side',
    'Numbness / tingling', 'Tremors', 'Poor vision', 'Neck stiffness',
    'Bulging fontanelle (infant)',
  ]},
  { label: 'Cardiovascular', options: [
    'Chest pain', 'Palpitations', 'Leg swelling (oedema)', 'Fainting / collapse',
    'Breathlessness lying flat', 'Cold extremities',
  ]},
  { label: 'Genitourinary', options: [
    'Painful urination (dysuria)', 'Blood in urine (haematuria)', 'Frequent urination',
    'Poor urine output', 'Urethral / vaginal discharge', 'Genital ulcer', 'Flank pain',
    'Scrotal swelling',
  ]},
  { label: 'Obstetric & gynaecological', options: [
    'Antenatal review', 'Missed period', 'Vaginal bleeding in pregnancy', 'Labour pains',
    'Reduced foetal movements', 'Heavy menstrual bleeding', 'Lower abdominal pain (female)',
    'Breast lump / pain', 'Post-partum bleeding', 'Post-partum fever',
  ]},
  { label: 'Musculoskeletal', options: [
    'Joint pain', 'Joint swelling', 'Back pain', 'Bone pain', 'Muscle aches',
    'Inability to walk', 'Limb deformity after injury',
  ]},
  { label: 'Skin', options: [
    'Skin rash', 'Measles-like rash', 'Itching', 'Skin ulcer / sore', 'Abscess / boil',
    'Burns', 'Darkening of skin (kala-azar)', 'Nodules on skin', 'Wound that will not heal',
  ]},
  { label: 'ENT & eye', options: [
    'Ear pain', 'Ear discharge', 'Hearing loss', 'Red eye', 'Eye discharge',
    'Painful eye', 'Nose bleeding (epistaxis)', 'Toothache', 'Mouth sores',
  ]},
  { label: 'Nutrition & child health', options: [
    'Malnutrition / visible wasting', 'Swelling of both feet (kwashiorkor)',
    'Not feeding well (infant)', 'Immunization visit', 'Growth monitoring visit',
    'Child not playing / unusually quiet',
  ]},
  { label: 'Injury & envenomation', options: [
    'Snake bite', 'Scorpion sting', 'Dog / animal bite', 'Road traffic injury',
    'Assault injury', 'Fall from height', 'Gunshot wound', 'Drowning / near-drowning',
  ]},
  { label: 'Mental health', options: [
    'Low mood / depression', 'Anxiety', 'Sleep problems', 'Aggressive behaviour',
    'Alcohol / substance problem', 'Self-harm thoughts',
  ]},
  { label: 'Administrative', options: [
    'Follow-up visit', 'Wound review', 'Medication refill', 'Medical certificate',
    'Referral letter review',
  ]},
];

/** Physical-examination findings catalogue — one grouped list per exam system
 *  for the centred findings popup. Mixes normal and abnormal findings and
 *  keeps South Sudan-relevant signs prominent (severe dehydration for
 *  cholera/AWD, hepatosplenomegaly for kala-azar, kwashiorkor oedema,
 *  meningeal signs). Anything not listed can be added from the popup. */
export const EXAM_FINDINGS_CATALOG: Record<
  'general' | 'cardiovascular' | 'respiratory' | 'abdominal' | 'neurological',
  { label: string; options: string[] }[]
> = {
  general: [
    { label: 'Overall appearance', options: [
      'Well appearing', 'Ill looking', 'Acute distress', 'Chronically ill appearance',
      'Alert and oriented', 'Lethargic', 'Confused', 'Agitated', 'Cachectic / wasted', 'Obese',
    ]},
    { label: 'Hydration & perfusion', options: [
      'Well hydrated', 'Mild dehydration', 'Severe dehydration (sunken eyes, slow skin pinch)',
      'Dry mucous membranes', 'Capillary refill over 3 seconds', 'Cold extremities',
    ]},
    { label: 'Skin & colour', options: [
      'Pallor', 'Jaundice', 'Central cyanosis', 'Peripheral cyanosis', 'Skin rash',
      'Petechiae / purpura', 'Hyperpigmented patches', 'Skin ulcer / sore', 'Poor skin turgor',
    ]},
    { label: 'Nutrition', options: [
      'Visible severe wasting', 'Bilateral pitting oedema (kwashiorkor)', 'MUAC in red zone',
      'Angular stomatitis', 'Hair colour changes (flag sign)',
    ]},
    { label: 'Lymph nodes & other', options: [
      'No lymphadenopathy', 'Cervical lymphadenopathy', 'Generalised lymphadenopathy',
      'Febrile to touch', 'Finger clubbing', 'Oral thrush', 'Goitre',
    ]},
  ],
  cardiovascular: [
    { label: 'Pulses & inspection', options: [
      'Regular pulse', 'Irregular pulse', 'Tachycardic', 'Bradycardic', 'Weak / thready pulse',
      'Bounding pulse', 'Raised JVP', 'Displaced apex beat', 'Absent peripheral pulses',
    ]},
    { label: 'Auscultation', options: [
      'Normal S1/S2', 'No added sounds', 'Systolic murmur', 'Diastolic murmur',
      'Gallop rhythm (S3)', 'Muffled heart sounds', 'Pericardial rub',
    ]},
    { label: 'Peripheral & pressure', options: [
      'No peripheral oedema', 'Peripheral oedema', 'Bilateral leg swelling', 'Cold peripheries',
      'Hypertensive reading', 'Hypotensive reading', 'Postural blood-pressure drop',
    ]},
  ],
  respiratory: [
    { label: 'Inspection', options: [
      'Normal respiratory effort', 'Respiratory distress', 'Fast breathing (tachypnoea)',
      'Chest in-drawing', 'Use of accessory muscles', 'Nasal flaring',
      'Asymmetrical chest movement', 'Cyanosis',
    ]},
    { label: 'Palpation & percussion', options: [
      'Trachea central', 'Tracheal deviation', 'Normal chest expansion', 'Reduced chest expansion',
      'Resonant percussion', 'Dull percussion', 'Stony dull percussion (effusion)', 'Hyper-resonant percussion',
    ]},
    { label: 'Auscultation', options: [
      'Clear breath sounds', 'Wheeze', 'Crackles / crepitations', 'Reduced air entry',
      'Bronchial breathing', 'Pleural rub', 'Stridor', 'Absent breath sounds one side',
    ]},
  ],
  abdominal: [
    { label: 'Inspection', options: [
      'Abdomen flat, moves with respiration', 'Distended abdomen', 'Visible peristalsis',
      'Surgical scars', 'Umbilical hernia', 'Everted umbilicus',
    ]},
    { label: 'Palpation', options: [
      'Soft, non-tender', 'Tender abdomen', 'Guarding', 'Rebound tenderness', 'Rigid abdomen',
      'Hepatomegaly', 'Splenomegaly', 'Hepatosplenomegaly (consider kala-azar)',
      'Palpable mass', 'Suprapubic tenderness', 'Renal angle tenderness', 'Inguinal hernia',
    ]},
    { label: 'Percussion & auscultation', options: [
      'Bowel sounds present', 'Hyperactive bowel sounds', 'Absent bowel sounds',
      'Shifting dullness (ascites)', 'Fluid thrill', 'Tympanic percussion',
    ]},
  ],
  neurological: [
    { label: 'Consciousness', options: [
      'Alert, GCS 15/15', 'Drowsy', 'Reduced GCS', 'Confused', 'Unresponsive', 'Post-ictal state',
    ]},
    { label: 'Meningeal signs', options: [
      'No neck stiffness', 'Neck stiffness', "Kernig's sign positive", "Brudzinski's sign positive",
      'Bulging fontanelle (infant)', 'Photophobia',
    ]},
    { label: 'Motor & reflexes', options: [
      'Normal power all limbs', 'Reduced power one side', 'Hemiplegia', 'Paraplegia',
      'Hypertonia', 'Hypotonia (floppy child)', 'Brisk reflexes', 'Absent reflexes', 'Positive Babinski',
    ]},
    { label: 'Sensory & coordination', options: [
      'Normal sensation', 'Sensory loss', 'Tremor', 'Ataxic gait', 'Cranial nerve deficit',
      'No focal deficit', 'Convulsing',
    ]},
  ],
};
