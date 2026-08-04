/**
 * Clinical note catalog — the note types a practice can document with, and the
 * sections each one is made of.
 *
 * Pure data and pure functions only. No database, no React, no icons: the
 * catalog is imported by the editor, by the services, by seed data and by
 * tests, and one of those (route gating) runs on the Edge runtime. Keeping it
 * dependency-free means every layer agrees on what a "SOAP note" contains
 * without importing the layer above it.
 *
 * A note is a list of sections rather than a fixed set of columns. That is what
 * lets one editor render a Procedure note and a Phone note without branching:
 * the type decides which sections appear and in what order, the note document
 * stores content per section id, and anything not in the type's list simply is
 * not rendered.
 */

/** Every section that can appear in a note, across all note types. */
export type NoteSectionId =
  | 'cc'
  | 'subjective'
  | 'hpi'
  | 'ros'
  | 'medications'
  | 'allergies'
  | 'mental_functional'
  | 'vitals'
  | 'objective'
  | 'physical_exam'
  | 'assessment'
  | 'plan'
  | 'procedure'
  | 'findings'
  | 'indications'
  | 'anesthesia'
  | 'specimens'
  | 'complications'
  | 'disposition'
  | 'hospital_course'
  | 'discharge_medications'
  | 'discharge_instructions'
  | 'follow_up'
  | 'past_medical_history'
  | 'family_history'
  | 'social_history'
  | 'caller'
  | 'call_reason'
  | 'advice_given'
  | 'memo'
  | 'addendum_reason'
  | 'patient_education'
  | 'goals'
  | 'interventions';

export interface NoteSectionDef {
  id: NoteSectionId;
  label: string;
  /**
   * How the section's body is produced.
   *  - 'narrative' : free text the clinician writes (shortcuts/templates apply)
   *  - 'derived'   : pulled from the chart (vitals, medication list, allergies)
   *                  and rendered read-only with a refresh control
   */
  kind: 'narrative' | 'derived';
  /** Placeholder shown when the section is empty and editable. */
  placeholder?: string;
  /**
   * Derived sections name the chart data they render, so the editor can fetch
   * the right thing without a switch statement per section.
   */
  source?: 'vitals' | 'medications' | 'allergies' | 'problems';
}

/**
 * One definition per section id. Labels are the clinician-facing names used in
 * both the note body and the "Note Sections" sidebar.
 */
export const NOTE_SECTIONS: Readonly<Record<NoteSectionId, NoteSectionDef>> = {
  cc: { id: 'cc', label: 'CC', kind: 'narrative', placeholder: 'Chief complaint in the patient’s own words…' },
  subjective: { id: 'subjective', label: 'Subjective', kind: 'narrative', placeholder: 'History as reported by the patient…' },
  hpi: { id: 'hpi', label: 'HPI', kind: 'narrative', placeholder: 'History of present illness…' },
  ros: { id: 'ros', label: 'Review of Systems', kind: 'narrative', placeholder: 'Systems reviewed…' },
  medications: { id: 'medications', label: 'Medications', kind: 'derived', source: 'medications' },
  allergies: { id: 'allergies', label: 'Allergies', kind: 'derived', source: 'allergies' },
  mental_functional: { id: 'mental_functional', label: 'Mental/Functional', kind: 'narrative', placeholder: 'Mental status and functional assessment…' },
  vitals: { id: 'vitals', label: 'Vitals', kind: 'derived', source: 'vitals' },
  objective: { id: 'objective', label: 'Objective', kind: 'narrative', placeholder: 'Examination findings…' },
  physical_exam: { id: 'physical_exam', label: 'Physical Exam', kind: 'narrative', placeholder: 'Physical examination…' },
  assessment: { id: 'assessment', label: 'Assessment', kind: 'narrative', placeholder: 'Assessment and diagnoses…' },
  plan: { id: 'plan', label: 'Plan', kind: 'narrative', placeholder: 'Plan of care…' },
  procedure: { id: 'procedure', label: 'Procedure', kind: 'narrative', placeholder: 'Procedure performed…' },
  findings: { id: 'findings', label: 'Findings', kind: 'narrative', placeholder: 'Findings…' },
  indications: { id: 'indications', label: 'Indications', kind: 'narrative', placeholder: 'Indication for the procedure…' },
  anesthesia: { id: 'anesthesia', label: 'Anesthesia', kind: 'narrative', placeholder: 'Anesthesia used…' },
  specimens: { id: 'specimens', label: 'Specimens', kind: 'narrative', placeholder: 'Specimens taken…' },
  complications: { id: 'complications', label: 'Complications', kind: 'narrative', placeholder: 'Complications, or “none”…' },
  disposition: { id: 'disposition', label: 'Disposition', kind: 'narrative', placeholder: 'Where the patient went next…' },
  hospital_course: { id: 'hospital_course', label: 'Hospital Course', kind: 'narrative', placeholder: 'Course of the admission…' },
  discharge_medications: { id: 'discharge_medications', label: 'Discharge Medications', kind: 'narrative', placeholder: 'Medications on discharge…' },
  discharge_instructions: { id: 'discharge_instructions', label: 'Discharge Instructions', kind: 'narrative', placeholder: 'Instructions given to the patient…' },
  follow_up: { id: 'follow_up', label: 'Follow-up', kind: 'narrative', placeholder: 'Follow-up arrangements…' },
  past_medical_history: { id: 'past_medical_history', label: 'Past Medical History', kind: 'narrative', placeholder: 'Past medical and surgical history…' },
  family_history: { id: 'family_history', label: 'Family History', kind: 'narrative', placeholder: 'Relevant family history…' },
  social_history: { id: 'social_history', label: 'Social History', kind: 'narrative', placeholder: 'Social history…' },
  caller: { id: 'caller', label: 'Caller', kind: 'narrative', placeholder: 'Who called and their relationship to the patient…' },
  call_reason: { id: 'call_reason', label: 'Reason for Call', kind: 'narrative', placeholder: 'Why they called…' },
  advice_given: { id: 'advice_given', label: 'Advice Given', kind: 'narrative', placeholder: 'Advice given on the call…' },
  memo: { id: 'memo', label: 'Memo', kind: 'narrative', placeholder: 'Memo to the record…' },
  addendum_reason: { id: 'addendum_reason', label: 'Reason for Amendment', kind: 'narrative', placeholder: 'Why the record is being amended…' },
  patient_education: { id: 'patient_education', label: 'Patient Education', kind: 'narrative', placeholder: 'Education provided…' },
  goals: { id: 'goals', label: 'Goals', kind: 'narrative', placeholder: 'Treatment goals…' },
  interventions: { id: 'interventions', label: 'Interventions', kind: 'narrative', placeholder: 'Interventions…' },
};

export type NoteTypeId =
  | 'soap'
  | 'telehealth_soap'
  | 'hp'
  | 'telehealth_hp'
  | 'consultation'
  | 'procedure'
  | 'discharge_summary'
  | 'nurse_visit'
  | 'phone'
  | 'memo_to_record'
  | 'office_form'
  | 'amendment';

export interface NoteTypeDef {
  id: NoteTypeId;
  label: string;
  /** Sections rendered by default, in order. */
  sections: readonly NoteSectionId[];
  /** Sections a clinician can add from "Add Optional". */
  optionalSections: readonly NoteSectionId[];
  /** Shown in the type picker to explain when to reach for it. */
  description: string;
  /** Telehealth types prefill the note's encounter mode. */
  telehealth?: boolean;
}

/** Sections almost every clinical note carries, in their conventional order. */
const CORE_SOAP: readonly NoteSectionId[] = [
  'cc', 'subjective', 'medications', 'allergies', 'mental_functional',
  'vitals', 'objective', 'assessment', 'plan',
];

const COMMON_OPTIONAL: readonly NoteSectionId[] = [
  'hpi', 'ros', 'past_medical_history', 'family_history', 'social_history',
  'physical_exam', 'patient_education', 'follow_up',
];

export const NOTE_TYPES: Readonly<Record<NoteTypeId, NoteTypeDef>> = {
  soap: {
    id: 'soap',
    label: 'SOAP',
    description: 'Standard subjective/objective/assessment/plan encounter note.',
    sections: CORE_SOAP,
    optionalSections: COMMON_OPTIONAL,
  },
  telehealth_soap: {
    id: 'telehealth_soap',
    label: 'Telehealth SOAP',
    description: 'SOAP note for a video or phone visit; records the telehealth modality.',
    sections: CORE_SOAP,
    optionalSections: COMMON_OPTIONAL,
    telehealth: true,
  },
  hp: {
    id: 'hp',
    label: 'H&P',
    description: 'History and physical for an admission or a new patient work-up.',
    sections: [
      'cc', 'hpi', 'past_medical_history', 'family_history', 'social_history',
      'medications', 'allergies', 'ros', 'vitals', 'physical_exam',
      'assessment', 'plan',
    ],
    optionalSections: ['subjective', 'objective', 'mental_functional', 'patient_education', 'follow_up'],
  },
  telehealth_hp: {
    id: 'telehealth_hp',
    label: 'Telehealth H&P',
    description: 'History and physical conducted over a telehealth connection.',
    sections: [
      'cc', 'hpi', 'past_medical_history', 'family_history', 'social_history',
      'medications', 'allergies', 'ros', 'vitals', 'assessment', 'plan',
    ],
    optionalSections: ['subjective', 'objective', 'physical_exam', 'mental_functional', 'follow_up'],
    telehealth: true,
  },
  consultation: {
    id: 'consultation',
    label: 'Consultation',
    description: 'Specialist opinion requested by another provider.',
    sections: [
      'cc', 'indications', 'hpi', 'medications', 'allergies', 'vitals',
      'physical_exam', 'assessment', 'plan',
    ],
    optionalSections: ['ros', 'past_medical_history', 'family_history', 'social_history', 'follow_up'],
  },
  procedure: {
    id: 'procedure',
    label: 'Procedure',
    description: 'Operative or bedside procedure record.',
    sections: [
      'indications', 'procedure', 'anesthesia', 'findings', 'specimens',
      'complications', 'disposition', 'plan',
    ],
    optionalSections: ['cc', 'medications', 'allergies', 'vitals', 'follow_up', 'patient_education'],
  },
  discharge_summary: {
    id: 'discharge_summary',
    label: 'Discharge Summary',
    description: 'Summary of an admission, its course, and what happens next.',
    sections: [
      'cc', 'hospital_course', 'assessment', 'discharge_medications',
      'discharge_instructions', 'follow_up',
    ],
    optionalSections: ['allergies', 'vitals', 'procedure', 'patient_education', 'social_history'],
  },
  nurse_visit: {
    id: 'nurse_visit',
    label: 'Nurse Visit',
    description: 'Nurse-led visit: observations, care given, escalation.',
    sections: ['cc', 'subjective', 'vitals', 'objective', 'interventions', 'plan'],
    optionalSections: ['medications', 'allergies', 'mental_functional', 'patient_education', 'follow_up'],
  },
  phone: {
    id: 'phone',
    label: 'Phone',
    description: 'Telephone encounter logged to the record.',
    sections: ['caller', 'call_reason', 'advice_given', 'plan'],
    optionalSections: ['medications', 'allergies', 'follow_up'],
  },
  memo_to_record: {
    id: 'memo_to_record',
    label: 'Memo to Record',
    description: 'Free-standing note filed to the chart with no encounter.',
    sections: ['memo'],
    optionalSections: ['follow_up'],
  },
  office_form: {
    id: 'office_form',
    label: 'Office Form',
    description: 'Administrative form captured against the chart.',
    sections: ['memo'],
    optionalSections: ['patient_education', 'follow_up'],
  },
  amendment: {
    id: 'amendment',
    label: 'Amendment',
    description: 'Correction or clarification appended to an existing signed note.',
    sections: ['addendum_reason', 'memo'],
    optionalSections: [],
  },
};

/**
 * Clinical rank used to position an *added* section among a type's defaults.
 *
 * This is not a global render order — a Procedure note opens with Indications,
 * which any global ordering would push below CC and Subjective. A type's own
 * `sections` order is authoritative for what it declares; this table only
 * answers "where does an added section slot in?", so that adding HPI to a SOAP
 * note puts it near the history rather than after the Plan.
 */
const SECTION_RANK: Readonly<Record<NoteSectionId, number>> = {
  cc: 0,
  call_reason: 1,
  caller: 2,
  subjective: 3,
  hpi: 4,
  ros: 5,
  past_medical_history: 6,
  family_history: 7,
  social_history: 8,
  medications: 9,
  allergies: 10,
  mental_functional: 11,
  vitals: 12,
  objective: 13,
  physical_exam: 14,
  indications: 15,
  procedure: 16,
  anesthesia: 17,
  findings: 18,
  specimens: 19,
  complications: 20,
  hospital_course: 21,
  assessment: 22,
  plan: 23,
  interventions: 24,
  advice_given: 25,
  discharge_medications: 26,
  discharge_instructions: 27,
  patient_education: 28,
  goals: 29,
  // The memo body is primary content for the memo/office-form/amendment types,
  // so it ranks ahead of the trailing sections a clinician may add to it.
  memo: 30,
  addendum_reason: 31,
  follow_up: 32,
  disposition: 33,
};

/** Stable display order for the note type picker. */
export const NOTE_TYPE_ORDER: readonly NoteTypeId[] = [
  'soap', 'telehealth_soap', 'hp', 'telehealth_hp', 'consultation',
  'procedure', 'discharge_summary', 'nurse_visit', 'phone',
  'memo_to_record', 'office_form', 'amendment',
];

export function isNoteTypeId(value: unknown): value is NoteTypeId {
  return typeof value === 'string' && value in NOTE_TYPES;
}

export function isNoteSectionId(value: unknown): value is NoteSectionId {
  return typeof value === 'string' && value in NOTE_SECTIONS;
}

export function getNoteType(id: NoteTypeId | string): NoteTypeDef {
  return NOTE_TYPES[id as NoteTypeId] ?? NOTE_TYPES.soap;
}

export function getSectionDef(id: NoteSectionId | string): NoteSectionDef | undefined {
  return NOTE_SECTIONS[id as NoteSectionId];
}

export function getSectionLabel(id: NoteSectionId | string): string {
  return NOTE_SECTIONS[id as NoteSectionId]?.label ?? String(id);
}

/**
 * Sections to render for a note: the type's defaults plus any optional ones the
 * clinician added, in catalog order so adding an optional section drops it into
 * its clinical position rather than at the end.
 *
 * Unknown ids (a note written under a type that has since been edited) are kept
 * at the end rather than dropped — losing documented text because a template
 * changed would be a records-integrity problem, not a display one.
 */
export function resolveSections(
  typeId: NoteTypeId | string,
  addedSections: readonly string[] = [],
): NoteSectionId[] {
  const type = getNoteType(typeId);
  const defaults = new Set<NoteSectionId>(type.sections);

  // The type's declared order is authoritative for its own sections.
  const ordered: NoteSectionId[] = [...type.sections];

  // De-duplicate added ids and drop any that the type already renders.
  const added: NoteSectionId[] = [];
  for (const id of addedSections) {
    if (!isNoteSectionId(id)) continue;
    if (defaults.has(id) || added.includes(id)) continue;
    added.push(id);
  }

  // Insert each added section before the first one that ranks after it, so it
  // lands in its clinical position rather than at the end. Sections with no
  // rank (off-catalog) sort last.
  const rankOf = (id: NoteSectionId) => SECTION_RANK[id] ?? Number.MAX_SAFE_INTEGER;
  for (const id of added) {
    const rank = rankOf(id);
    const at = ordered.findIndex(existing => rankOf(existing) > rank);
    if (at === -1) ordered.push(id);
    else ordered.splice(at, 0, id);
  }
  return ordered;
}

/** Optional sections still available to add for a note. */
export function availableOptionalSections(
  typeId: NoteTypeId | string,
  addedSections: readonly string[] = [],
): NoteSectionDef[] {
  const type = getNoteType(typeId);
  const already = new Set<string>([...type.sections, ...addedSections]);
  return type.optionalSections
    .filter(id => !already.has(id))
    .map(id => NOTE_SECTIONS[id]);
}
