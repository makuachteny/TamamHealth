/**
 * Clinical history constants — the structured history-taking model a clinician
 * works through: history of present illness, review of systems, and the
 * past / family / social / drug history. Grounded in the standard H&P/SOAP
 * structure and the CMS 14-system Review of Systems.
 */

/** CMS 14-system Review of Systems. `hint` lists the common symptoms to probe. */
export const ROS_SYSTEMS: { key: string; label: string; hint: string }[] = [
  { key: 'constitutional', label: 'Constitutional', hint: 'fever, weight change, fatigue, appetite' },
  { key: 'eyes', label: 'Eyes', hint: 'vision change, pain, redness, discharge' },
  { key: 'ent', label: 'ENT', hint: 'hearing, sore throat, nasal symptoms' },
  { key: 'cardiovascular', label: 'Cardiovascular', hint: 'chest pain, palpitations, swelling, dyspnea' },
  { key: 'respiratory', label: 'Respiratory', hint: 'cough, shortness of breath, wheeze, sputum' },
  { key: 'gastrointestinal', label: 'Gastrointestinal', hint: 'nausea, vomiting, diarrhea, abdominal pain' },
  { key: 'genitourinary', label: 'Genitourinary', hint: 'frequency, dysuria, urgency, discharge' },
  { key: 'musculoskeletal', label: 'Musculoskeletal', hint: 'joint pain, swelling, stiffness, weakness' },
  { key: 'integumentary', label: 'Skin', hint: 'rash, itching, lesions, wounds' },
  { key: 'neurological', label: 'Neurological', hint: 'headache, dizziness, numbness, seizures' },
  { key: 'psychiatric', label: 'Psychiatric', hint: 'mood, sleep, anxiety, behaviour change' },
  { key: 'endocrine', label: 'Endocrine', hint: 'thirst, polyuria, heat/cold intolerance' },
  { key: 'hematologic', label: 'Hematologic / lymphatic', hint: 'bruising, bleeding, swollen nodes' },
  { key: 'allergic', label: 'Allergic / immunologic', hint: 'allergies, frequent infections' },
];

/** Common chronic conditions to flag in past medical history. */
export const CHRONIC_CONDITIONS = [
  'Diabetes', 'Hypertension', 'Hyperlipidemia', 'Asthma', 'Epilepsy',
  'HIV', 'Tuberculosis', 'Sickle cell disease', 'Chronic kidney disease',
  'Heart disease', 'Peptic ulcer disease', 'Thyroid disease',
];

/** OLDCARTS prompts — the structured way to characterise the present illness. */
export const OLDCARTS = [
  'Onset', 'Location', 'Duration', 'Characteristics',
  'Aggravating / relieving', 'Radiation', 'Timing', 'Severity',
];

export const SMOKING_OPTIONS = ['never', 'former', 'current'] as const;
export const ALCOHOL_OPTIONS = ['never', 'occasional', 'regular'] as const;
export const SES_OPTIONS = ['low', 'middle', 'high'] as const;
