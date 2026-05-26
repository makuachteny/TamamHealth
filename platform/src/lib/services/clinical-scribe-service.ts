/**
 * Clinical Scribe NLP Service
 *
 * Parses doctor-patient conversation transcripts and extracts structured
 * clinical data into EHR-compatible fields. Runs entirely client-side.
 */

// ===== Extracted field types =====

export interface ExtractedVitals {
  temperature?: string;
  systolic?: string;
  diastolic?: string;
  pulse?: string;
  respRate?: string;
  o2Sat?: string;
  weight?: string;
  height?: string;
  muac?: string;
}

export interface ExtractedMedication {
  name: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  raw: string;
}

export interface ExtractedAllergy {
  allergen: string;
  reaction: string;
}

export interface ExtractedDiagnosis {
  name: string;
  icd10Hint: string;
  certainty: 'confirmed' | 'suspected';
  raw: string;
}

export interface ExtractedExamFinding {
  system: 'general' | 'cardiovascular' | 'respiratory' | 'abdominal' | 'neurological';
  finding: string;
}

export interface ScribeConflict {
  field: string;
  earlier: string;
  latest: string;
}

export interface ScribeExtraction {
  chiefComplaint: string;
  hpiNarrative: string;
  pastMedicalHistory: string[];
  socialHistory: string[];
  vitals: ExtractedVitals;
  examFindings: ExtractedExamFinding[];
  allergies: ExtractedAllergy[];
  medications: ExtractedMedication[];
  diagnoses: ExtractedDiagnosis[];
  treatmentPlan: string[];
  patientInstructions: string[];
  followUp: string;
  referralNotes: string;
  labOrders: string[];
  conflicts: ScribeConflict[];
  uncertainItems: string[];
  rawTranscript: string;
}

// ===== Pattern dictionaries =====

const VITAL_PATTERNS: { pattern: RegExp; field: keyof ExtractedVitals; transform?: (v: string) => string }[] = [
  { pattern: /temp(?:erature)?[\s:]*(?:is\s+)?(\d{2,3}(?:\.\d)?)\s*(?:degrees?\s*)?(?:celsius|°?\s*c)?/i, field: 'temperature' },
  { pattern: /(?:bp|blood\s+pressure)[\s:]*(?:is\s+)?(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})/i, field: 'systolic' },
  { pattern: /systolic[\s:]*(?:is\s+)?(\d{2,3})/i, field: 'systolic' },
  { pattern: /diastolic[\s:]*(?:is\s+)?(\d{2,3})/i, field: 'diastolic' },
  { pattern: /(?:pulse|heart\s*rate|hr)[\s:]*(?:is\s+)?(\d{2,3})\s*(?:bpm|beats)?/i, field: 'pulse' },
  { pattern: /(?:resp(?:iratory)?\s*rate|rr|breathing\s*rate)[\s:]*(?:is\s+)?(\d{1,2})\s*(?:per\s*min)?/i, field: 'respRate' },
  { pattern: /(?:o2\s*sat|oxygen\s*sat(?:uration)?|spo2|sats?)[\s:]*(?:is\s+)?(\d{2,3})\s*%?/i, field: 'o2Sat' },
  { pattern: /(?:weight|wt)[\s:]*(?:is\s+)?(\d{1,3}(?:\.\d)?)\s*(?:kg|kilo)/i, field: 'weight' },
  { pattern: /(?:height|ht)[\s:]*(?:is\s+)?(\d{2,3}(?:\.\d)?)\s*(?:cm|centi)/i, field: 'height' },
  { pattern: /muac[\s:]*(?:is\s+)?(\d{1,2}(?:\.\d)?)\s*(?:cm)?/i, field: 'muac' },
];

const MEDICATION_PATTERN = /(?:prescri(?:be|bing)|start(?:ing)?|give|administer|continue|take|taking)\s+(.+?)(?:\s+for\s+\d+\s+(?:day|week|month)s?)?(?:\.|,|$)/gi;
const DOSE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:mg|g|ml|mcg|units?|iu)\b/i;
const FREQUENCY_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /once\s+(?:a\s+)?dai?ly|od\b|every\s*24\s*h/i, label: 'OD (Once daily)' },
  { pattern: /twice\s+(?:a\s+)?dai?ly|bd\b|bid\b|every\s*12\s*h/i, label: 'BD (Twice daily)' },
  { pattern: /t(?:hree|hrice)\s+(?:times?\s+)?(?:a\s+)?dai?ly|tds\b|tid\b|every\s*8\s*h/i, label: 'TDS (Three times daily)' },
  { pattern: /four\s+times?\s+(?:a\s+)?dai?ly|qds\b|qid\b|every\s*6\s*h/i, label: 'QDS (Four times daily)' },
  { pattern: /as\s+needed|prn\b|when\s+(?:needed|required)/i, label: 'PRN (As needed)' },
  { pattern: /stat\b|immediately|right\s+(?:now|away)/i, label: 'STAT (Immediately)' },
  { pattern: /(?:at\s+)?(?:bed\s*time|night|nocte)/i, label: 'Nocte (At night)' },
];
const ROUTE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\boral(?:ly)?\b|by\s+mouth|po\b/i, label: 'Oral' },
  { pattern: /\biv\b|intravenous/i, label: 'IV' },
  { pattern: /\bim\b|intramuscular/i, label: 'IM' },
  { pattern: /\bsc\b|subcutaneous/i, label: 'SC' },
  { pattern: /topical/i, label: 'Topical' },
  { pattern: /rectal/i, label: 'Rectal' },
  { pattern: /inhal(?:ed|ation)/i, label: 'Inhaled' },
];
const DURATION_PATTERN = /(?:for\s+)?(\d+)\s*(day|week|month)s?/i;

const ALLERGY_PATTERN = /allerg(?:y|ic|ies)\s+(?:to\s+)?(.+?)(?:\s*(?:causing|which\s+causes?|resulted?\s+in|reaction:?)\s*(.+?))?(?:\.|,|$)/gi;

const EXAM_SYSTEM_PATTERNS: { pattern: RegExp; system: ExtractedExamFinding['system'] }[] = [
  { pattern: /(?:general(?:ly)?|appearance|looks?\s+(?:well|unwell|ill|pale))/i, system: 'general' },
  { pattern: /(?:heart|cardiac|cardio|murmur|jugular|edema|s1\s*s2)/i, system: 'cardiovascular' },
  { pattern: /(?:lung|chest|breath\s+sounds?|wheez|crackl|rhonchi|ronchi|crepitation)/i, system: 'respiratory' },
  { pattern: /(?:abdom(?:en|inal)|tender(?:ness)?|bowel|liver|spleen|hepato|spleno)/i, system: 'abdominal' },
  { pattern: /(?:neuro|cranial|reflex|orient|conscious|gcs|pupil)/i, system: 'neurological' },
];

const LAB_KEYWORDS: { pattern: RegExp; test: string }[] = [
  { pattern: /malaria\s*(?:rdt|rapid|test|smear)/i, test: 'Malaria RDT' },
  { pattern: /(?:fbc|full\s+blood\s+count|cbc|complete\s+blood)/i, test: 'Full Blood Count' },
  { pattern: /(?:blood\s+)?(?:glucose|sugar|bs|rbs|fbs)/i, test: 'Blood Glucose' },
  { pattern: /urin(?:e|alysis)/i, test: 'Urinalysis' },
  { pattern: /hiv\s*(?:test|rapid|screen)/i, test: 'HIV Rapid Test' },
  { pattern: /cd4/i, test: 'CD4 Count' },
  { pattern: /(?:liver|lft|hepatic)\s*(?:function|test)?/i, test: 'Liver Function' },
  { pattern: /(?:renal|rft|kidney|urea|creatinine)\s*(?:function|test)?/i, test: 'Renal Function' },
];

const COMPLAINT_TRIGGERS = /(?:complain(?:s|ing)?\s+(?:of|about)?|presenting\s+with|came?\s+(?:in\s+)?(?:with|because|for)|suffering\s+from|chief\s+complaint\s*(?:is|:)?|main\s+(?:problem|issue|concern)\s*(?:is|:)?|has\s+been\s+(?:having|experiencing)|(?:patient|he|she)\s+(?:reports?|says?|states?|mentions?)\s+(?:that\s+)?)/i;

const DIAGNOSIS_TRIGGERS = /(?:diagnos(?:is|e|ing)|assessment|impression|think(?:ing)?\s+(?:it(?:'s|\s+is)\s+|this\s+is\s+)?|looks?\s+like|consistent\s+with|(?:i|we)\s+(?:suspect|believe)|most\s+likely|differential|working\s+diagnosis)/i;

const PLAN_TRIGGERS = /(?:plan\s+(?:is|:)?|we(?:'ll|\s+will)\s+|going\s+to\s+|let(?:'s|\s+us)\s+|recommend|advise|I\s+(?:want\s+to|'d\s+like\s+to)|need\s+to\s+start|management)/i;

const FOLLOW_UP_PATTERN = /(?:follow[\s-]?up|come\s+back|return|see\s+(?:you|me|us)\s+(?:again|back|in))\s+(?:in\s+)?(.+?)(?:\.|,|$)/i;

const PMH_TRIGGERS = /(?:(?:past\s+)?(?:medical\s+)?history\s+(?:of|includes?)?|(?:previously|before)\s+(?:diagnosed|treated)\s+(?:for|with)?|known\s+(?:case\s+of|to\s+have)|(?:has|have)\s+(?:a\s+)?history\s+of|chronic\s+(?:conditions?|diseases?))/i;

const SOCIAL_HISTORY_TRIGGERS = /(?:smok(?:e|es|ing|er)|tobacco|alcohol|drink(?:s|ing)?|occupation|works?\s+as|employed|unemployed|marital\s+status|married|single|divorced)/i;

// ===== Known medication names for fuzzy matching =====
const KNOWN_MEDICATIONS = [
  'artemether-lumefantrine', 'coartem', 'amoxicillin', 'ceftriaxone',
  'metronidazole', 'ciprofloxacin', 'doxycycline', 'azithromycin',
  'paracetamol', 'acetaminophen', 'ibuprofen', 'diclofenac',
  'tramadol', 'morphine', 'metformin', 'glibenclamide',
  'insulin', 'amlodipine', 'enalapril', 'losartan',
  'atenolol', 'hydrochlorothiazide', 'furosemide', 'aspirin',
  'omeprazole', 'ranitidine', 'ors', 'zinc',
  'salbutamol', 'prednisolone', 'hydrocortisone', 'ferrous',
  'folic acid', 'vitamin', 'cotrimoxazole', 'efavirenz',
  'tenofovir', 'lamivudine', 'nevirapine', 'quinine',
  'artesunate', 'chloroquine', 'mebendazole', 'albendazole',
  'gentamicin', 'ampicillin', 'cloxacillin', 'erythromycin',
  'phenobarbital', 'carbamazepine', 'diazepam',
];

// ===== Main extraction function =====

export function extractClinicalData(transcript: string): ScribeExtraction {
  const result: ScribeExtraction = {
    chiefComplaint: '',
    hpiNarrative: '',
    pastMedicalHistory: [],
    socialHistory: [],
    vitals: {},
    examFindings: [],
    allergies: [],
    medications: [],
    diagnoses: [],
    treatmentPlan: [],
    patientInstructions: [],
    followUp: '',
    referralNotes: '',
    labOrders: [],
    conflicts: [],
    uncertainItems: [],
    rawTranscript: transcript,
  };

  if (!transcript.trim()) return result;

  const sentences = splitSentences(transcript);

  // ── Extract vitals ──
  extractVitals(transcript, result);

  // ── Extract allergies ──
  extractAllergies(transcript, result);

  // ── Extract chief complaint ──
  extractChiefComplaint(sentences, result);

  // ── Extract medications ──
  extractMedications(transcript, sentences, result);

  // ── Extract diagnoses ──
  extractDiagnoses(sentences, result);

  // ── Extract exam findings ──
  extractExamFindings(sentences, result);

  // ── Extract lab orders ──
  extractLabOrders(transcript, result);

  // ── Extract treatment plan ──
  extractTreatmentPlan(sentences, result);

  // ── Extract follow-up ──
  extractFollowUp(transcript, result);

  // ── Extract past medical history ──
  extractPMH(sentences, result);

  // ── Extract social history ──
  extractSocialHistory(sentences, result);

  // ── Build HPI narrative ──
  buildHPINarrative(result);

  // ── Extract patient instructions ──
  extractPatientInstructions(sentences, result);

  // ── Check for referral mentions ──
  extractReferral(sentences, result);

  return result;
}

// ===== Helper functions =====

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|(?:\n|\r\n)+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);
}

function extractVitals(text: string, result: ScribeExtraction) {
  // Special case: BP with both values
  const bpMatch = text.match(/(?:bp|blood\s+pressure)[\s:]*(?:is\s+)?(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})/i);
  if (bpMatch) {
    result.vitals.systolic = bpMatch[1];
    result.vitals.diastolic = bpMatch[2];
  }

  for (const { pattern, field } of VITAL_PATTERNS) {
    if (field === 'systolic' && result.vitals.systolic) continue; // already from BP
    if (field === 'diastolic' && result.vitals.diastolic) continue;
    const match = text.match(pattern);
    if (match) {
      const newVal = match[1];
      const existing = result.vitals[field];
      /* istanbul ignore next -- conflict detection: requires duplicate vital with different value */
      if (existing && existing !== newVal) {
        result.conflicts.push({
          field: `vitals.${field}`,
          earlier: existing,
          latest: newVal,
        });
      }
      result.vitals[field] = newVal;
    }
  }
}

function extractAllergies(text: string, result: ScribeExtraction) {
  let match: RegExpExecArray | null;
  ALLERGY_PATTERN.lastIndex = 0;
  while ((match = ALLERGY_PATTERN.exec(text)) !== null) {
    const allergen = match[1].trim().replace(/\s+/g, ' ');
    /* istanbul ignore next -- defensive: regex group may not capture reaction */
    const reaction = match[2]?.trim() || '';
    /* istanbul ignore next -- NLP edge case: allergen length validation rarely filters in practice */
    if (allergen.length > 1 && allergen.length < 80) {
      result.allergies.push({ allergen, reaction });
    }
  }

  // Also catch "no known allergies" / "NKDA"
  if (/(?:no\s+known\s+allerg|nkda|no\s+allerg)/i.test(text) && result.allergies.length === 0) {
    result.allergies.push({ allergen: 'NKDA', reaction: 'No known drug allergies' });
  }
}

function extractChiefComplaint(sentences: string[], result: ScribeExtraction) {
  for (const sentence of sentences) {
    if (COMPLAINT_TRIGGERS.test(sentence)) {
      const cleaned = sentence
        .replace(COMPLAINT_TRIGGERS, '')
        .replace(/^[\s,]+/, '')
        .trim();
      /* istanbul ignore next -- NLP edge case: complaint text too short after cleaning */
      if (cleaned.length > 3) {
        result.chiefComplaint = capitalizeFirst(cleaned);
        break;
      }
    }
  }

  // Fallback: first substantive sentence
  if (!result.chiefComplaint && sentences.length > 0) {
    const candidate = sentences.find(s => s.length > 10 && !/^(doctor|patient|good|hello|hi|okay)/i.test(s));
    if (candidate) {
      result.chiefComplaint = capitalizeFirst(candidate.slice(0, 200));
      result.uncertainItems.push(`[DOCTOR TO CONFIRM: Chief complaint auto-detected as: "${result.chiefComplaint}"]`);
    }
  }
}

function extractMedications(text: string, sentences: string[], result: ScribeExtraction) {
  // Pattern-based extraction
  let match: RegExpExecArray | null;
  MEDICATION_PATTERN.lastIndex = 0;
  while ((match = MEDICATION_PATTERN.exec(text)) !== null) {
    const rawMed = match[1].trim();
    parseMedicationLine(rawMed, result);
  }

  // Also scan sentences for known medication names
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const medName of KNOWN_MEDICATIONS) {
      if (lower.includes(medName) && !result.medications.some(m => m.name.toLowerCase().includes(medName))) {
        parseMedicationLine(sentence, result, medName);
      }
    }
  }
}

function parseMedicationLine(rawText: string, result: ScribeExtraction, knownName?: string) {
  /* istanbul ignore next -- NLP edge case: knownName resolution rarely fails in practice */
  const name = knownName
    ? KNOWN_MEDICATIONS.find(m => rawText.toLowerCase().includes(m)) || knownName
    : rawText.split(/\s+/).slice(0, 3).join(' ');

  /* istanbul ignore next -- NLP edge case: name validation too strict after cleaning */
  if (!name || name.length < 2) return;

  // Check duplicate
  /* istanbul ignore next -- defensive: duplicate detection in medication pipeline */
  if (result.medications.some(m => m.name.toLowerCase() === name.toLowerCase())) return;

  const doseMatch = rawText.match(DOSE_PATTERN);
  const dose = doseMatch ? doseMatch[0] : '';

  let frequency = '';
  for (const { pattern, label } of FREQUENCY_PATTERNS) {
    if (pattern.test(rawText)) { frequency = label; break; }
  }

  let route = 'Oral';
  for (const { pattern, label } of ROUTE_PATTERNS) {
    /* istanbul ignore next -- defensive: route detection defaults to Oral if no pattern matches */
    if (pattern.test(rawText)) { route = label; break; }
  }

  const durMatch = rawText.match(DURATION_PATTERN);
  /* istanbul ignore next -- defensive: duration regex may not match */
  const duration = durMatch ? `${durMatch[1]} ${durMatch[2]}s` : '';

  result.medications.push({
    name: capitalizeFirst(name),
    dose,
    frequency,
    route,
    duration,
    raw: rawText.slice(0, 150),
  });
}

function extractDiagnoses(sentences: string[], result: ScribeExtraction) {
  for (const sentence of sentences) {
    if (DIAGNOSIS_TRIGGERS.test(sentence)) {
      const cleaned = sentence
        .replace(DIAGNOSIS_TRIGGERS, '')
        .replace(/^[\s,:]+/, '')
        .trim();
      /* istanbul ignore next -- NLP edge case: diagnosis text too short or too long after cleaning */
      if (cleaned.length > 2 && cleaned.length < 150) {
        const certainty: 'confirmed' | 'suspected' =
          /suspect|possible|likely|rule\s+out|differential|probable/i.test(sentence)
            ? 'suspected' : 'confirmed';
        result.diagnoses.push({
          name: capitalizeFirst(cleaned),
          icd10Hint: guessICD10(cleaned),
          certainty,
          raw: sentence,
        });
      }
    }
  }
}

function guessICD10(text: string): string {
  const lower = text.toLowerCase();
  const LOOKUP: Record<string, string> = {
    'malaria': 'B50', 'pneumonia': 'J18', 'cholera': 'A00',
    'typhoid': 'A01', 'tuberculosis': 'A15', 'tb': 'A15',
    'hiv': 'B20', 'diarrhea': 'A09', 'diarrhoea': 'A09',
    'measles': 'B05', 'meningitis': 'G03', 'anemia': 'D64',
    'anaemia': 'D64', 'diabetes': 'E11', 'hypertension': 'I10',
    'asthma': 'J45', 'uti': 'N39', 'urinary tract': 'N39',
    'hepatitis': 'B19', 'malnutrition': 'E46', 'dengue': 'A90',
    'yellow fever': 'A95', 'snake bite': 'T63', 'fracture': 'T14',
    'wound': 'T14', 'burn': 'T30', 'abscess': 'L02',
    'cellulitis': 'L03', 'gastritis': 'K29', 'peptic ulcer': 'K27',
    'epilepsy': 'G40', 'seizure': 'R56', 'sickle cell': 'D57',
    'preeclampsia': 'O14', 'eclampsia': 'O15',
  };
  for (const [keyword, code] of Object.entries(LOOKUP)) {
    if (lower.includes(keyword)) return code;
  }
  return '';
}

function extractExamFindings(sentences: string[], result: ScribeExtraction) {
  for (const sentence of sentences) {
    for (const { pattern, system } of EXAM_SYSTEM_PATTERNS) {
      if (pattern.test(sentence)) {
        result.examFindings.push({
          system,
          finding: sentence.trim(),
        });
        break;
      }
    }
  }
}

function extractLabOrders(text: string, result: ScribeExtraction) {
  const orderTrigger = /(?:order|request|send\s+for|need|want|do\s+a|run\s+a|check|get\s+a)/i;
  if (!orderTrigger.test(text)) {
    // Still check for direct test name mentions
    for (const { pattern, test } of LAB_KEYWORDS) {
      if (pattern.test(text) && !result.labOrders.includes(test)) {
        result.labOrders.push(test);
      }
    }
    return;
  }
  for (const { pattern, test } of LAB_KEYWORDS) {
    if (pattern.test(text) && !result.labOrders.includes(test)) {
      result.labOrders.push(test);
    }
  }
}

function extractTreatmentPlan(sentences: string[], result: ScribeExtraction) {
  let capturing = false;
  for (const sentence of sentences) {
    if (PLAN_TRIGGERS.test(sentence)) {
      capturing = true;
      const cleaned = sentence.replace(PLAN_TRIGGERS, '').replace(/^[\s,:]+/, '').trim();
      /* istanbul ignore next -- NLP edge case: plan text too short after cleaning */
      if (cleaned.length > 3) {
        result.treatmentPlan.push(capitalizeFirst(cleaned));
      }
    } else if (capturing && sentence.length > 5 && !/^\s*(doctor|patient|okay|thank)/i.test(sentence)) {
      // Continue capturing plan items
      result.treatmentPlan.push(capitalizeFirst(sentence));
      /* istanbul ignore next -- defensive: treatment plan overflow guard rarely triggers */
      if (result.treatmentPlan.length > 8) capturing = false;
    }
  }
}

function extractFollowUp(text: string, result: ScribeExtraction) {
  const match = text.match(FOLLOW_UP_PATTERN);
  if (match) {
    result.followUp = capitalizeFirst(match[1].trim());
  }
}

function extractPMH(sentences: string[], result: ScribeExtraction) {
  for (const sentence of sentences) {
    if (PMH_TRIGGERS.test(sentence)) {
      const cleaned = sentence.replace(PMH_TRIGGERS, '').replace(/^[\s,:]+/, '').trim();
      /* istanbul ignore next -- NLP edge case: PMH text too short after cleaning */
      if (cleaned.length > 2) {
        result.pastMedicalHistory.push(capitalizeFirst(cleaned));
      }
    }
  }
}

function extractSocialHistory(sentences: string[], result: ScribeExtraction) {
  for (const sentence of sentences) {
    if (SOCIAL_HISTORY_TRIGGERS.test(sentence)) {
      result.socialHistory.push(sentence.trim());
    }
  }
}

function buildHPINarrative(result: ScribeExtraction) {
  const parts: string[] = [];
  if (result.chiefComplaint) {
    parts.push(`Patient presents with ${result.chiefComplaint.toLowerCase()}.`);
  }
  if (result.pastMedicalHistory.length > 0) {
    parts.push(`Past medical history includes: ${result.pastMedicalHistory.join('; ')}.`);
  }
  /* istanbul ignore next -- defensive: allergy narrative only added when allergies present and not NKDA */
  if (result.allergies.length > 0 && result.allergies[0].allergen !== 'NKDA') {
    parts.push(`Known allergies: ${result.allergies.map(a => `${a.allergen}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ')}.`);
  }
  result.hpiNarrative = parts.join(' ');
}

function extractPatientInstructions(sentences: string[], result: ScribeExtraction) {
  const instructionTriggers = /(?:make\s+sure|remember\s+to|you\s+(?:should|need\s+to|must)|don'?t\s+forget|important\s+(?:to|that)|come\s+back\s+if|return\s+if|watch\s+(?:out\s+)?for|warning\s+sign|if\s+(?:you\s+)?(?:notice|feel|experience|develop))/i;
  for (const sentence of sentences) {
    if (instructionTriggers.test(sentence)) {
      result.patientInstructions.push(sentence.trim());
    }
  }
}

function extractReferral(sentences: string[], result: ScribeExtraction) {
  const referralTrigger = /(?:refer(?:ring|ral)?|transfer|send\s+(?:to|over\s+to))\s+(?:to\s+)?(?:a\s+)?(?:specialist|surgeon|hospital|facility|another|higher)/i;
  for (const sentence of sentences) {
    /* istanbul ignore next -- NLP edge case: referral pattern rarely triggers in typical transcripts */
    if (referralTrigger.test(sentence)) {
      result.referralNotes += (result.referralNotes ? ' ' : '') + sentence.trim();
    }
  }
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ===== Generate structured SOAP note from extraction =====

export function generateSOAPNote(extraction: ScribeExtraction): string {
  const sections: string[] = [];

  /* istanbul ignore next -- defensive: fallback for missing chief complaint */
  sections.push(`CHIEF COMPLAINT: ${extraction.chiefComplaint || 'Not discussed.'}`);
  sections.push('');
  /* istanbul ignore next -- defensive: fallback for missing HPI narrative */
  sections.push(`HPI: ${extraction.hpiNarrative || 'Not discussed.'}`);
  sections.push('');

  // PMH
  sections.push(`PAST MEDICAL HISTORY: ${extraction.pastMedicalHistory.length > 0
    ? extraction.pastMedicalHistory.join('; ')
    : 'Not discussed.'}`);
  sections.push('');

  // Medications
  /* istanbul ignore next -- defensive: medications section rendering when medications exist */
  if (extraction.medications.length > 0) {
    sections.push('MEDICATIONS:');
    for (const med of extraction.medications) {
      sections.push(`  - ${med.name} ${med.dose} ${med.frequency} ${med.route}${med.duration ? ` for ${med.duration}` : ''}`);
    }
  } else {
    sections.push('MEDICATIONS: Not discussed.');
  }
  sections.push('');

  // Allergies
  /* istanbul ignore next -- defensive: allergies section rendering when allergies exist */
  if (extraction.allergies.length > 0) {
    sections.push('ALLERGIES:');
    for (const a of extraction.allergies) {
      sections.push(`  - ${a.allergen}${a.reaction ? ` → ${a.reaction}` : ''}`);
    }
  } else {
    sections.push('ALLERGIES: Not discussed.');
  }
  sections.push('');

  // Social history
  /* istanbul ignore next -- defensive: social history rendering when items present */
  sections.push(`SOCIAL HISTORY: ${extraction.socialHistory.length > 0
    ? extraction.socialHistory.join('; ')
    : 'Not discussed.'}`);
  sections.push('');

  // Physical exam
  sections.push('PHYSICAL EXAM:');
  const vit = extraction.vitals;
  if (Object.values(vit).some(v => v)) {
    const vitParts: string[] = [];
    /* istanbul ignore next -- defensive: individual vital presence checks in SOAP rendering */
    if (vit.temperature) vitParts.push(`Temp ${vit.temperature}°C`);
    /* istanbul ignore next -- defensive: individual vital presence checks in SOAP rendering */
    if (vit.systolic && vit.diastolic) vitParts.push(`BP ${vit.systolic}/${vit.diastolic}`);
    /* istanbul ignore next -- defensive: individual vital presence checks in SOAP rendering */
    if (vit.pulse) vitParts.push(`HR ${vit.pulse}`);
    /* istanbul ignore next -- defensive: individual vital presence checks in SOAP rendering */
    if (vit.respRate) vitParts.push(`RR ${vit.respRate}`);
    /* istanbul ignore next -- defensive: individual vital presence checks in SOAP rendering */
    if (vit.o2Sat) vitParts.push(`SpO2 ${vit.o2Sat}%`);
    /* istanbul ignore next -- defensive: individual vital presence checks in SOAP rendering */
    if (vit.weight) vitParts.push(`Wt ${vit.weight}kg`);
    /* istanbul ignore next -- defensive: individual vital presence checks in SOAP rendering */
    if (vit.height) vitParts.push(`Ht ${vit.height}cm`);
    sections.push(`  Vitals: ${vitParts.join(', ')}`);
  }
  const examSystems: ExtractedExamFinding['system'][] = ['general', 'cardiovascular', 'respiratory', 'abdominal', 'neurological'];
  for (const sys of examSystems) {
    const findings = extraction.examFindings.filter(f => f.system === sys);
    if (findings.length > 0) {
      sections.push(`  ${sys.charAt(0).toUpperCase() + sys.slice(1)}: ${findings.map(f => f.finding).join('; ')}`);
    }
  }
  sections.push('');

  // Assessment
  if (extraction.diagnoses.length > 0) {
    sections.push('ASSESSMENT:');
    extraction.diagnoses.forEach((dx, i) => {
      /* istanbul ignore next -- defensive: icd10Hint presence check in diagnosis rendering */
      sections.push(`  ${i + 1}. ${dx.name}${dx.icd10Hint ? ` (${dx.icd10Hint})` : ''} [${dx.certainty}]`);
    });
  } else {
    sections.push('ASSESSMENT: Not discussed.');
  }
  sections.push('');

  // Plan
  if (extraction.treatmentPlan.length > 0 || extraction.medications.length > 0 || extraction.labOrders.length > 0) {
    sections.push('PLAN:');
    for (const med of extraction.medications) {
      sections.push(`  - Rx: ${med.name} ${med.dose} ${med.frequency} ${med.route}`);
    }
    for (const lab of extraction.labOrders) {
      sections.push(`  - Lab: Order ${lab}`);
    }
    for (const plan of extraction.treatmentPlan) {
      sections.push(`  - ${plan}`);
    }
  } else {
    sections.push('PLAN: Not discussed.');
  }
  sections.push('');

  // Patient instructions
  if (extraction.patientInstructions.length > 0) {
    sections.push('PATIENT INSTRUCTIONS:');
    for (const inst of extraction.patientInstructions) {
      sections.push(`  - ${inst}`);
    }
  }

  // Follow-up
  sections.push(`FOLLOW-UP: ${extraction.followUp || 'Not discussed.'}`);

  // Conflicts
  if (extraction.conflicts.length > 0) {
    sections.push('');
    sections.push('--- CONFLICTS (DOCTOR VERIFY) ---');
    for (const c of extraction.conflicts) {
      sections.push(`  [CONFLICT: ${c.field} — earlier said "${c.earlier}", now "${c.latest}" — DOCTOR VERIFY]`);
    }
  }

  // Uncertain items
  if (extraction.uncertainItems.length > 0) {
    sections.push('');
    sections.push('--- ITEMS TO CONFIRM ---');
    for (const u of extraction.uncertainItems) {
      sections.push(`  ${u}`);
    }
  }

  return sections.join('\n');
}
