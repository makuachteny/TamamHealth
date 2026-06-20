/**
 * Validated outcome-measure / intake instruments (P2.2).
 *
 * These are the scored questionnaires the front desk enters at check-in and the
 * provider reviews and signs — the Centricity "outcome measures" workflow. Each
 * instrument carries its questions, a shared response scale, the maximum score
 * and the interpretation bands. Scoring is pure and unit-tested; only ANSWERED
 * questions contribute to the total (an unanswered item is left blank, matching
 * the paper-form behaviour).
 */

export type AssessmentSeverity = 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';

export interface AssessmentOption {
  label: string;
  value: number;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
}

export interface AssessmentBand {
  min: number;
  max: number;
  label: string;
  severity: AssessmentSeverity;
}

export interface AssessmentInstrument {
  id: string;
  name: string;
  description: string;
  /** Shared response scale applied to every question. */
  options: AssessmentOption[];
  questions: AssessmentQuestion[];
  /** Maximum achievable score (all questions answered at top option). */
  maxScore: number;
  bands: AssessmentBand[];
}

const FREQ_OPTIONS: AssessmentOption[] = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

/** PHQ-9 depression screen (validated, WHO/primary-care standard). */
export const PHQ9: AssessmentInstrument = {
  id: 'phq9',
  name: 'PHQ-9 (Depression)',
  description: 'Patient Health Questionnaire — depression severity over the last 2 weeks.',
  options: FREQ_OPTIONS,
  questions: [
    { id: 'q1', text: 'Little interest or pleasure in doing things' },
    { id: 'q2', text: 'Feeling down, depressed, or hopeless' },
    { id: 'q3', text: 'Trouble falling or staying asleep, or sleeping too much' },
    { id: 'q4', text: 'Feeling tired or having little energy' },
    { id: 'q5', text: 'Poor appetite or overeating' },
    { id: 'q6', text: 'Feeling bad about yourself, or that you are a failure' },
    { id: 'q7', text: 'Trouble concentrating on things' },
    { id: 'q8', text: 'Moving or speaking slowly, or being fidgety/restless' },
    { id: 'q9', text: 'Thoughts that you would be better off dead, or of hurting yourself' },
  ],
  maxScore: 27,
  bands: [
    { min: 0, max: 4, label: 'Minimal depression', severity: 'minimal' },
    { min: 5, max: 9, label: 'Mild depression', severity: 'mild' },
    { min: 10, max: 14, label: 'Moderate depression', severity: 'moderate' },
    { min: 15, max: 19, label: 'Moderately severe depression', severity: 'moderately_severe' },
    { min: 20, max: 27, label: 'Severe depression', severity: 'severe' },
  ],
};

/** GAD-7 generalized-anxiety screen (validated). */
export const GAD7: AssessmentInstrument = {
  id: 'gad7',
  name: 'GAD-7 (Anxiety)',
  description: 'Generalized Anxiety Disorder scale over the last 2 weeks.',
  options: FREQ_OPTIONS,
  questions: [
    { id: 'q1', text: 'Feeling nervous, anxious, or on edge' },
    { id: 'q2', text: 'Not being able to stop or control worrying' },
    { id: 'q3', text: 'Worrying too much about different things' },
    { id: 'q4', text: 'Trouble relaxing' },
    { id: 'q5', text: 'Being so restless that it is hard to sit still' },
    { id: 'q6', text: 'Becoming easily annoyed or irritable' },
    { id: 'q7', text: 'Feeling afraid as if something awful might happen' },
  ],
  maxScore: 21,
  bands: [
    { min: 0, max: 4, label: 'Minimal anxiety', severity: 'minimal' },
    { min: 5, max: 9, label: 'Mild anxiety', severity: 'mild' },
    { min: 10, max: 14, label: 'Moderate anxiety', severity: 'moderate' },
    { min: 15, max: 21, label: 'Severe anxiety', severity: 'severe' },
  ],
};

const YES_NO: AssessmentOption[] = [
  { label: 'No', value: 0 },
  { label: 'Yes', value: 1 },
];

/**
 * ANC danger-sign screen (WHO). A count-based screen: any positive sign means
 * the pregnant woman needs urgent assessment/referral, so the bands are
 * none-vs-present rather than graded severity.
 */
export const ANC_DANGER: AssessmentInstrument = {
  id: 'anc_danger',
  name: 'ANC danger signs',
  description: 'WHO antenatal danger-sign screen — any positive sign warrants urgent referral.',
  options: YES_NO,
  questions: [
    { id: 'q1', text: 'Vaginal bleeding' },
    { id: 'q2', text: 'Severe headache or blurred vision' },
    { id: 'q3', text: 'Convulsions or loss of consciousness' },
    { id: 'q4', text: 'Severe abdominal pain' },
    { id: 'q5', text: 'Reduced or absent fetal movement' },
    { id: 'q6', text: 'Fever / feeling very unwell' },
    { id: 'q7', text: 'Swelling of face or hands' },
    { id: 'q8', text: 'Difficulty breathing' },
  ],
  maxScore: 8,
  bands: [
    { min: 0, max: 0, label: 'No danger signs — routine ANC', severity: 'minimal' },
    { min: 1, max: 8, label: 'Danger sign present — urgent referral', severity: 'severe' },
  ],
};

/**
 * IMCI general danger signs in a sick child (under 5). Any positive sign is a
 * medical emergency requiring urgent referral.
 */
export const IMCI_DANGER: AssessmentInstrument = {
  id: 'imci_danger',
  name: 'IMCI danger signs (under-5)',
  description: 'IMCI general danger signs in a sick child — any positive sign is an emergency.',
  options: YES_NO,
  questions: [
    { id: 'q1', text: 'Unable to drink or breastfeed' },
    { id: 'q2', text: 'Vomits everything' },
    { id: 'q3', text: 'Convulsions / history of convulsions this illness' },
    { id: 'q4', text: 'Lethargic or unconscious' },
  ],
  maxScore: 4,
  bands: [
    { min: 0, max: 0, label: 'No general danger signs', severity: 'minimal' },
    { min: 1, max: 4, label: 'General danger sign — urgent referral', severity: 'severe' },
  ],
};

export const ASSESSMENT_INSTRUMENTS: AssessmentInstrument[] = [PHQ9, GAD7, ANC_DANGER, IMCI_DANGER];

export function getInstrument(id: string): AssessmentInstrument | undefined {
  return ASSESSMENT_INSTRUMENTS.find((i) => i.id === id);
}

export interface AssessmentScore {
  total: number;
  /** Number of questions answered (used to flag incomplete forms). */
  answered: number;
  /** Total number of questions in the instrument. */
  questionCount: number;
  band: AssessmentBand | null;
}

/**
 * Score a set of answers against an instrument. Only answered questions count,
 * so an in-progress form still produces a meaningful partial total. The band is
 * resolved from the (partial) total.
 */
export function scoreAssessment(
  instrument: AssessmentInstrument,
  answers: Record<string, number | undefined | null>,
): AssessmentScore {
  let total = 0;
  let answered = 0;
  for (const q of instrument.questions) {
    const v = answers[q.id];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      total += v;
      answered += 1;
    }
  }
  const band = instrument.bands.find((b) => total >= b.min && total <= b.max) ?? null;
  return { total, answered, questionCount: instrument.questions.length, band };
}
