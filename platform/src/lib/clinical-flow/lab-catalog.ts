/**
 * Single source of truth for the lab investigations a clinic can order, their
 * specimen type, and basic/special tiering. Imported by the consultation form,
 * the lab page and anywhere else that lists or creates lab orders — so the
 * catalogue lives in one place rather than being hard-coded per screen.
 *
 * The static exports below remain the hard-coded defaults (kept for back-compat
 * and tests). The store-backed accessors (getLabCatalog, getBasicLabs, …) read
 * the live facility settings so admin changes to the catalogue propagate.
 */

import { getSettings } from '../settings/settings-store';
import type { LabTestDef } from '../settings/facility-settings';

export const BASIC_LABS = ['Full Blood Count', 'Urinalysis', 'Blood Glucose', 'Malaria RDT'] as const;

export const SPECIAL_LABS = [
  'HIV Rapid Test', 'CD4 Count', 'Liver Function', 'Renal Function',
  'Typhoid (Widal)', 'Rheumatoid Factor', 'ANA (autoimmune screen)',
  'Uric Acid', 'Vitamin D', 'Stool Culture', 'Blood Culture', 'Lipid Profile',
  // Imaging studies — ordered from consultation like any special investigation,
  // routed to the radiology work queue (specimen 'Imaging') instead of the lab.
  'X-Ray — Chest', 'X-Ray — Limb/Skeletal', 'Ultrasound — Abdomen', 'Ultrasound — Obstetric',
] as const;

/** Specimen value that routes an order to radiology instead of the lab bench. */
export const IMAGING_SPECIMEN = 'Imaging';

/** True when an investigation is an imaging study (belongs in the radiology queue). */
export const isImagingStudy = (test: { specimen?: string; testName: string }): boolean =>
  test.specimen === IMAGING_SPECIMEN || /^(x-ray|ultrasound|ct\b|mri)/i.test(test.testName);

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
  'X-Ray — Chest': 'Imaging',
  'X-Ray — Limb/Skeletal': 'Imaging',
  'Ultrasound — Abdomen': 'Imaging',
  'Ultrasound — Obstetric': 'Imaging',
};

// ── Store-backed accessors (read live facility settings) ────────────────────

/** The live lab catalogue from facility settings (defaults until hydrated). */
export const getLabCatalog = (): LabTestDef[] => getSettings().labCatalog;

/** Names of basic-tier investigations, from live settings. */
export const getBasicLabs = (): string[] =>
  getLabCatalog().filter(l => l.tier === 'basic').map(l => l.name);

/** Names of special-tier investigations, from live settings. */
export const getSpecialLabs = (): string[] =>
  getLabCatalog().filter(l => l.tier === 'special').map(l => l.name);

/** All investigation names (basic + special) from live settings. */
export const getLabTestNames = (): string[] => getLabCatalog().map(l => l.name);

export const labTier = (name: string): 'basic' | 'special' => {
  const def = getSettings().labCatalog.find(l => l.name === name);
  if (def) return def.tier;
  return (BASIC_LABS as readonly string[]).includes(name) ? 'basic' : 'special';
};

export const specimenFor = (name: string): string => {
  const def = getSettings().labCatalog.find(l => l.name === name);
  if (def) return def.specimen;
  return LAB_SPECIMENS[name] || DEFAULT_SPECIMEN;
};
