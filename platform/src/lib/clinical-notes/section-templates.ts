/**
 * Section templates — the checkbox tree behind a note section's "Template"
 * button, and the composer that turns a set of ticks into prose.
 *
 * The clinical value is that a clinician documents by recognition rather than
 * recall: tick "Onset ▸ Sudden" and "Severity ▸ Moderate" and the section fills
 * itself in, instead of typing the same sentence for the thousandth time. The
 * generated text is a starting point and stays fully editable — see
 * `composeNarrative`, which never overwrites what the clinician has already
 * typed by hand.
 *
 * Pure data and pure functions, same rule as note-catalog: no database, no
 * React. That is what lets the composer be unit-tested directly and lets seed
 * data reference the same trees the editor renders.
 */

export interface TemplateOption {
  id: string;
  label: string;
  /**
   * Prose fragment contributed when ticked. Omitted means "use the label",
   * lower-cased — which is right for symptom lists ("reports nausea") but wrong
   * for anything needing a verb, hence the override.
   */
  text?: string;
  /** Nested refinements, e.g. Symptoms ▸ Other sx (describe). */
  children?: readonly TemplateOption[];
  /**
   * Marks an option whose value the clinician supplies. The editor renders a
   * short input; the typed value replaces `{}` in `text`, or is appended.
   */
  freeText?: boolean;
}

export interface TemplateGroup {
  id: string;
  label: string;
  /** How this group's ticked options join into a sentence. */
  lead?: string;
  options: readonly TemplateOption[];
  /** Only one option may be ticked (Severity is a scale, not a list). */
  single?: boolean;
}

export interface SectionTemplate {
  id: string;
  label: string;
  groups: readonly TemplateGroup[];
}

/**
 * The default history template — the tree shown in the screenshots (Reason for
 * visit, Duration, Onset, Severity/Course, Symptoms, Pertinent
 * positives/negatives, Exacerbating/Alleviating factors, Tx response/Side
 * effects, plus history and immunisation prompts).
 */
export const HISTORY_TEMPLATE: SectionTemplate = {
  id: 'default_history',
  label: 'Default',
  groups: [
    {
      id: 'reason_for_visit',
      label: 'Reason for visit',
      lead: 'Patient presents with',
      options: [
        { id: 'new_problem', label: 'New problem', text: 'a new problem' },
        { id: 'follow_up', label: 'Follow-up', text: 'follow-up of an existing problem' },
        { id: 'routine', label: 'Routine review', text: 'a routine review' },
        { id: 'medication_review', label: 'Medication review', text: 'a medication review' },
        { id: 'results_review', label: 'Results review', text: 'a review of results' },
        { id: 'other_reason', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'duration',
      label: 'Duration',
      lead: 'Symptoms have been present for',
      single: true,
      options: [
        { id: 'hours', label: 'Hours', text: 'several hours' },
        { id: 'days', label: 'Days', text: 'several days' },
        { id: 'weeks', label: 'Weeks', text: 'several weeks' },
        { id: 'months', label: 'Months', text: 'several months' },
        { id: 'duration_other', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'onset',
      label: 'Onset',
      lead: 'Onset was',
      single: true,
      options: [
        { id: 'sudden', label: 'Sudden', text: 'sudden' },
        { id: 'gradual', label: 'Gradual', text: 'gradual' },
        { id: 'intermittent', label: 'Intermittent', text: 'intermittent' },
        { id: 'after_activity', label: 'After activity', text: 'related to activity' },
      ],
    },
    {
      id: 'severity',
      label: 'Severity/Course',
      lead: 'Severity is',
      single: true,
      options: [
        { id: 'mild', label: 'Mild', text: 'mild' },
        { id: 'moderate', label: 'Moderate', text: 'moderate' },
        { id: 'severe', label: 'Severe', text: 'severe' },
        { id: 'worsening', label: 'Worsening', text: 'worsening' },
        { id: 'improving', label: 'Improving', text: 'improving' },
        { id: 'unchanged', label: 'Unchanged', text: 'unchanged' },
      ],
    },
    {
      id: 'symptoms',
      label: 'Symptoms',
      lead: 'Reports',
      options: [
        { id: 'fever', label: 'Fever' },
        { id: 'cough', label: 'Cough' },
        { id: 'headache', label: 'Headache' },
        { id: 'nausea', label: 'Nausea' },
        { id: 'vomiting', label: 'Vomiting' },
        { id: 'diarrhoea', label: 'Diarrhoea' },
        { id: 'fatigue', label: 'Fatigue' },
        { id: 'pain', label: 'Pain' },
        { id: 'shortness_of_breath', label: 'Shortness of breath' },
        { id: 'light_sensitivity', label: 'Light sensitivity' },
        {
          id: 'other_sx',
          label: 'Other sx (describe)',
          freeText: true,
          text: '{}',
        },
      ],
    },
    {
      id: 'pertinent',
      label: 'Pertinent positives/negatives',
      lead: 'Denies',
      options: [
        { id: 'no_fever', label: 'No fever', text: 'fever' },
        { id: 'no_weight_loss', label: 'No weight loss', text: 'weight loss' },
        { id: 'no_night_sweats', label: 'No night sweats', text: 'night sweats' },
        { id: 'no_chest_pain', label: 'No chest pain', text: 'chest pain' },
        { id: 'no_bleeding', label: 'No bleeding', text: 'bleeding' },
        { id: 'pertinent_other', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'factors',
      label: 'Exacerbating/Alleviating factors',
      lead: 'Symptoms are',
      options: [
        { id: 'worse_movement', label: 'Worse with movement', text: 'worse with movement' },
        { id: 'worse_night', label: 'Worse at night', text: 'worse at night' },
        { id: 'worse_eating', label: 'Worse after eating', text: 'worse after eating' },
        { id: 'better_rest', label: 'Better with rest', text: 'relieved by rest' },
        { id: 'better_meds', label: 'Better with medication', text: 'relieved by medication' },
      ],
    },
    {
      id: 'tx_response',
      label: 'Tx response/Side effects',
      lead: 'Treatment response:',
      options: [
        { id: 'tx_effective', label: 'Effective', text: 'current treatment is effective' },
        { id: 'tx_partial', label: 'Partially effective', text: 'current treatment is partially effective' },
        { id: 'tx_ineffective', label: 'Not effective', text: 'current treatment is not effective' },
        { id: 'tx_side_effects', label: 'Side effects (describe)', freeText: true, text: 'side effects: {}' },
        { id: 'tx_adherence', label: 'Adherence issues', text: 'adherence has been difficult' },
      ],
    },
    {
      id: 'medical_hx',
      label: 'Medical Hx specifics',
      lead: 'Relevant history:',
      options: [
        { id: 'hx_hypertension', label: 'Hypertension', text: 'hypertension' },
        { id: 'hx_diabetes', label: 'Diabetes', text: 'diabetes' },
        { id: 'hx_asthma', label: 'Asthma', text: 'asthma' },
        { id: 'hx_hiv', label: 'HIV', text: 'HIV' },
        { id: 'hx_tb', label: 'Tuberculosis', text: 'tuberculosis' },
        { id: 'hx_other', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'lifestyle',
      label: 'Lifestyle/Environment',
      lead: 'Lifestyle:',
      options: [
        { id: 'smoker', label: 'Smoker', text: 'current smoker' },
        { id: 'alcohol', label: 'Alcohol use', text: 'uses alcohol' },
        { id: 'occupational', label: 'Occupational exposure', text: 'occupational exposure reported' },
        { id: 'water_source', label: 'Unsafe water source', text: 'unsafe water source' },
        { id: 'lifestyle_other', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'family_hx',
      label: 'Family Hx specifics',
      lead: 'Family history:',
      options: [
        { id: 'fhx_diabetes', label: 'Diabetes', text: 'diabetes' },
        { id: 'fhx_hypertension', label: 'Hypertension', text: 'hypertension' },
        { id: 'fhx_cancer', label: 'Cancer', text: 'cancer' },
        { id: 'fhx_none', label: 'Non-contributory', text: 'non-contributory' },
        { id: 'fhx_other', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'immunization',
      label: 'Immunization',
      lead: 'Immunisation:',
      options: [
        { id: 'imm_up_to_date', label: 'Up to date', text: 'up to date' },
        { id: 'imm_behind', label: 'Behind schedule', text: 'behind schedule' },
        { id: 'imm_unknown', label: 'Unknown', text: 'status unknown' },
      ],
    },
  ],
};

/** Plan-oriented template for the Plan section. */
export const PLAN_TEMPLATE: SectionTemplate = {
  id: 'default_plan',
  label: 'Default',
  groups: [
    {
      id: 'investigations',
      label: 'Investigations',
      lead: 'Ordered',
      options: [
        { id: 'bloods', label: 'Blood tests', text: 'blood tests' },
        { id: 'malaria_rdt', label: 'Malaria RDT', text: 'a malaria RDT' },
        { id: 'imaging', label: 'Imaging', text: 'imaging' },
        { id: 'inv_other', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'treatment',
      label: 'Treatment',
      lead: 'Treatment:',
      options: [
        { id: 'start_med', label: 'Start medication', text: 'medication started' },
        { id: 'continue_med', label: 'Continue current medication', text: 'current medication continued' },
        { id: 'stop_med', label: 'Stop medication', text: 'medication stopped' },
        { id: 'supportive', label: 'Supportive care', text: 'supportive care advised' },
      ],
    },
    {
      id: 'disposition_plan',
      label: 'Disposition',
      lead: 'Disposition:',
      single: true,
      options: [
        { id: 'home', label: 'Discharge home', text: 'discharged home' },
        { id: 'admit', label: 'Admit', text: 'admitted' },
        { id: 'refer', label: 'Refer', text: 'referred' },
        { id: 'observe', label: 'Observe', text: 'kept for observation' },
      ],
    },
    {
      id: 'followup_plan',
      label: 'Follow-up',
      lead: 'Follow-up',
      single: true,
      options: [
        { id: 'fu_prn', label: 'As needed', text: 'as needed' },
        { id: 'fu_week', label: 'In 1 week', text: 'in one week' },
        { id: 'fu_month', label: 'In 1 month', text: 'in one month' },
        { id: 'fu_other', label: 'Other (describe)', freeText: true, text: '{}' },
      ],
    },
    {
      id: 'education',
      label: 'Patient education',
      lead: 'Counselled on',
      options: [
        { id: 'edu_medication', label: 'Medication use', text: 'medication use' },
        { id: 'edu_warning', label: 'Warning signs', text: 'warning signs to return' },
        { id: 'edu_nutrition', label: 'Nutrition', text: 'nutrition' },
        { id: 'edu_adherence', label: 'Adherence', text: 'treatment adherence' },
      ],
    },
  ],
};

export const SECTION_TEMPLATES: readonly SectionTemplate[] = [HISTORY_TEMPLATE, PLAN_TEMPLATE];

/** Which template a section offers by default. */
export function templateForSection(sectionId: string): SectionTemplate {
  return sectionId === 'plan' ? PLAN_TEMPLATE : HISTORY_TEMPLATE;
}

/**
 * A clinician's ticks: option id → true, or option id → typed value for
 * free-text options. A plain map keeps it serialisable into the note document,
 * so reopening a draft restores the tree exactly as it was left.
 */
export type TemplateSelection = Record<string, boolean | string>;

function isSelected(selection: TemplateSelection, id: string): boolean {
  const v = selection[id];
  return v === true || (typeof v === 'string' && v.trim().length > 0);
}

/** Resolve one option's contribution, substituting any typed free text. */
function optionText(opt: TemplateOption, selection: TemplateSelection): string | null {
  const raw = selection[opt.id];
  const typed = typeof raw === 'string' ? raw.trim() : '';
  if (opt.freeText && !typed) return null;          // ticked but nothing typed
  const base = opt.text ?? opt.label.toLowerCase();
  if (base.includes('{}')) return base.replace('{}', typed).trim();
  return typed ? `${base} (${typed})` : base;
}

/** "a, b and c" — Oxford-free, which reads correctly in clinical prose. */
function joinList(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function sentenceFor(group: TemplateGroup, selection: TemplateSelection): string | null {
  const parts: string[] = [];
  for (const opt of group.options) {
    if (!isSelected(selection, opt.id)) continue;
    const text = optionText(opt, selection);
    if (text) parts.push(text);
    for (const child of opt.children ?? []) {
      if (!isSelected(selection, child.id)) continue;
      const childText = optionText(child, selection);
      if (childText) parts.push(childText);
    }
    if (group.single) break;   // a scale contributes at most one value
  }
  if (parts.length === 0) return null;

  const body = joinList(parts);
  const lead = group.lead?.trim();
  if (!lead) return `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
  return `${lead} ${body}.`;
}

/**
 * Turn a selection into prose.
 *
 * Returns one sentence per group with any ticks, in template order, so the
 * narrative reads in the order a clinician would tell it: reason, duration,
 * onset, severity, symptoms, then negatives.
 */
export function composeTemplateText(
  template: SectionTemplate,
  selection: TemplateSelection,
): string {
  const sentences: string[] = [];
  for (const group of template.groups) {
    const sentence = sentenceFor(group, selection);
    if (sentence) sentences.push(sentence);
  }
  return sentences.join(' ');
}

/**
 * Merge generated text into a section that may already have content.
 *
 * The generated block is delimited so a second pass over the template replaces
 * only what the template produced last time. Anything the clinician typed
 * around it is preserved verbatim — regenerating must never silently delete
 * dictated narrative, which is the whole reason this is not a plain overwrite.
 */
export const TEMPLATE_BLOCK_START = '<!--template-->';
export const TEMPLATE_BLOCK_END = '<!--/template-->';

export function composeNarrative(existing: string, generated: string): string {
  const body = generated.trim();
  const block = body ? `${TEMPLATE_BLOCK_START}${body}${TEMPLATE_BLOCK_END}` : '';

  const start = existing.indexOf(TEMPLATE_BLOCK_START);
  const end = existing.indexOf(TEMPLATE_BLOCK_END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + TEMPLATE_BLOCK_END.length);
    const merged = `${before}${block}${after}`;
    return block ? merged : merged.replace(/\n{3,}/g, '\n\n').trim();
  }

  if (!body) return existing;
  const prefix = existing.trim();
  return prefix ? `${prefix}\n\n${block}` : block;
}

/** Strip the delimiters for display, print and transmission. */
export function stripTemplateMarkers(text: string): string {
  return (text || '')
    .split(TEMPLATE_BLOCK_START).join('')
    .split(TEMPLATE_BLOCK_END).join('');
}
