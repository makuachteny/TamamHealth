/**
 * Symptom screening templates — the HealthBridge "pick a visit type, answer the
 * 80–90% of typical questions with a tap" flow. Each template is a short list of
 * questions; a question can reveal follow-ups based on its answer (one or more
 * levels of branching). Answers compile into a clean note appended to the HPI.
 *
 * Pure data + a pure `compileSymptomNote` so the branching logic is unit-tested
 * independently of the consultation UI.
 */

export type SymptomQuestionType = 'yes_no' | 'select';

export interface SymptomQuestion {
  id: string;
  label: string;
  type: SymptomQuestionType;
  /** Options for a `select` question. */
  options?: string[];
  /** Answer value that reveals the follow-up questions (e.g. 'yes', or an option). */
  revealOn?: string;
  followUps?: SymptomQuestion[];
}

export interface SymptomTemplate {
  id: string;
  name: string;
  category: string;
  questions: SymptomQuestion[];
}

/** Answers keyed by question id. yes_no → 'yes' | 'no' | 'na'; select → option. */
export type SymptomAnswers = Record<string, string>;

export const SYMPTOM_TEMPLATES: SymptomTemplate[] = [
  {
    id: 'covid_uri',
    name: 'COVID-19 / URTI',
    category: 'respiratory',
    questions: [
      { id: 'fever', label: 'Fever', type: 'yes_no' },
      {
        id: 'cough', label: 'Cough', type: 'yes_no', revealOn: 'yes',
        followUps: [{ id: 'cough_type', label: 'Cough type', type: 'select', options: ['Dry', 'Productive'] }],
      },
      { id: 'sore_throat', label: 'Sore throat', type: 'yes_no' },
      {
        id: 'sob', label: 'Shortness of breath', type: 'yes_no', revealOn: 'yes',
        followUps: [{ id: 'sob_onset', label: 'Onset', type: 'select', options: ['At rest', 'On exertion'] }],
      },
      { id: 'anosmia', label: 'Loss of smell / taste', type: 'yes_no' },
      { id: 'contact', label: 'Known contact with a confirmed case', type: 'yes_no' },
    ],
  },
  {
    id: 'malaria',
    name: 'Malaria',
    category: 'febrile',
    questions: [
      {
        id: 'fever', label: 'Fever', type: 'yes_no', revealOn: 'yes',
        followUps: [{ id: 'fever_pattern', label: 'Pattern', type: 'select', options: ['Continuous', 'Intermittent', 'With rigors'] }],
      },
      { id: 'chills', label: 'Chills / rigors', type: 'yes_no' },
      { id: 'headache', label: 'Headache', type: 'yes_no' },
      { id: 'vomiting', label: 'Vomiting', type: 'yes_no' },
      {
        id: 'danger', label: 'Danger signs (confusion, convulsions, dark urine)', type: 'yes_no', revealOn: 'yes',
        followUps: [{ id: 'danger_which', label: 'Which', type: 'select', options: ['Confusion', 'Convulsions', 'Dark urine', 'Unable to drink'] }],
      },
      { id: 'net', label: 'Sleeps under a treated bed net', type: 'yes_no' },
    ],
  },
  {
    id: 'hypertension',
    name: 'Hypertension review',
    category: 'chronic',
    questions: [
      { id: 'adherence', label: 'Taking medication as prescribed', type: 'yes_no' },
      { id: 'headache', label: 'Headache', type: 'yes_no' },
      { id: 'chest_pain', label: 'Chest pain', type: 'yes_no' },
      { id: 'vision', label: 'Visual disturbance', type: 'yes_no' },
      { id: 'swelling', label: 'Ankle swelling', type: 'yes_no' },
      { id: 'salt', label: 'High-salt diet', type: 'yes_no' },
    ],
  },
  {
    id: 'diarrhoea',
    name: 'Diarrhoea',
    category: 'gastro',
    questions: [
      { id: 'duration', label: 'Duration', type: 'select', options: ['<24h', '1–3 days', '>3 days'] },
      {
        id: 'blood', label: 'Blood in stool', type: 'yes_no', revealOn: 'yes',
        followUps: [{ id: 'blood_amount', label: 'Amount', type: 'select', options: ['Streaks', 'Frank blood'] }],
      },
      { id: 'vomiting', label: 'Vomiting', type: 'yes_no' },
      { id: 'fever', label: 'Fever', type: 'yes_no' },
      { id: 'dehydration', label: 'Reduced urine / sunken eyes (dehydration)', type: 'yes_no' },
    ],
  },
  {
    id: 'anc',
    name: 'ANC visit',
    category: 'maternal',
    questions: [
      { id: 'fetal_movement', label: 'Fetal movements present', type: 'yes_no' },
      {
        id: 'bleeding', label: 'Vaginal bleeding', type: 'yes_no', revealOn: 'yes',
        followUps: [{ id: 'bleeding_amount', label: 'Amount', type: 'select', options: ['Spotting', 'Heavy'] }],
      },
      { id: 'headache', label: 'Severe headache / visual changes', type: 'yes_no' },
      { id: 'epigastric', label: 'Epigastric pain', type: 'yes_no' },
      { id: 'swelling', label: 'Swelling of face / hands', type: 'yes_no' },
      { id: 'iron', label: 'Taking iron-folate supplements', type: 'yes_no' },
    ],
  },
];

export function getSymptomTemplate(id: string): SymptomTemplate | undefined {
  return SYMPTOM_TEMPLATES.find((t) => t.id === id);
}

function answerLabel(q: SymptomQuestion, value: string): string {
  if (q.type === 'yes_no') return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'N/A';
  return value;
}

/** Whether a question's answer is meaningful (answered and not N/A). */
function isAnswered(value: string | undefined): value is string {
  return value !== undefined && value !== '' && value !== 'na';
}

function compileQuestions(questions: SymptomQuestion[], answers: SymptomAnswers, depth: number, out: string[]): void {
  for (const q of questions) {
    const value = answers[q.id];
    if (!isAnswered(value)) continue;
    out.push(`${'  '.repeat(depth)}- ${q.label}: ${answerLabel(q, value)}`);
    if (q.followUps && q.revealOn !== undefined && value === q.revealOn) {
      compileQuestions(q.followUps, answers, depth + 1, out);
    }
  }
}

/**
 * Compile answered questions into a titled, indented note block. Returns an
 * empty string when nothing meaningful was answered, so callers can skip insert.
 */
export function compileSymptomNote(template: SymptomTemplate, answers: SymptomAnswers): string {
  const lines: string[] = [];
  compileQuestions(template.questions, answers, 0, lines);
  if (lines.length === 0) return '';
  return `${template.name} screen:\n${lines.join('\n')}`;
}
