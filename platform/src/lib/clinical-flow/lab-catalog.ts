/**
 * Single source of truth for the lab investigations a clinic can order, their
 * specimen type, and basic/special tiering. Imported by the consultation form,
 * the lab page and anywhere else that lists or creates lab orders — so the
 * catalogue lives in one place rather than being hard-coded per screen.
 */

export const BASIC_LABS = ['Full Blood Count', 'Urinalysis', 'Blood Glucose', 'Malaria RDT'] as const;

export const SPECIAL_LABS = [
  'HIV Rapid Test', 'CD4 Count', 'Liver Function', 'Renal Function',
  'Typhoid (Widal)', 'Rheumatoid Factor', 'ANA (autoimmune screen)',
  'Uric Acid', 'Vitamin D', 'Stool Culture', 'Blood Culture', 'Lipid Profile',
] as const;

export const LAB_TESTS: string[] = [...BASIC_LABS, ...SPECIAL_LABS];

/** Default specimen when a test isn't explicitly mapped below. */
export const DEFAULT_SPECIMEN = 'Blood';

/** Specimen required per investigation. */
export const LAB_SPECIMENS: Record<string, string> = {
  'Malaria RDT': 'Blood',
  'Full Blood Count': 'Blood',
  'Blood Glucose': 'Blood',
  'Urinalysis': 'Urine',
  'HIV Rapid Test': 'Blood',
  'CD4 Count': 'Blood',
  'Liver Function': 'Blood',
  'Renal Function': 'Blood',
  'Typhoid (Widal)': 'Blood',
  'Rheumatoid Factor': 'Blood',
  'ANA (autoimmune screen)': 'Blood',
  'Uric Acid': 'Blood',
  'Vitamin D': 'Blood',
  'Stool Culture': 'Stool',
  'Blood Culture': 'Blood',
  'Lipid Profile': 'Blood',
};

export const labTier = (name: string): 'basic' | 'special' =>
  (BASIC_LABS as readonly string[]).includes(name) ? 'basic' : 'special';

export const specimenFor = (name: string): string => LAB_SPECIMENS[name] || DEFAULT_SPECIMEN;
