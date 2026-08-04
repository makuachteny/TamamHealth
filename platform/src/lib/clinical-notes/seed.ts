/**
 * Starter content for the clinical notes module.
 *
 * A shortcut picker that opens empty teaches nothing — a clinician cannot tell
 * whether the feature is broken or simply unused. These seed a handful of
 * phrases for the complaints this platform actually sees, so the first time
 * someone opens Text Shortcut they can tell what it is for.
 *
 * Idempotent: seeding twice does not duplicate, because the shortcuts carry
 * deterministic ids.
 */

import { getDB } from '../db';
import type { TextShortcutDoc } from './types';
import type { NoteSectionId } from './note-catalog';

interface SeedShortcut {
  key: string;
  name: string;
  body: string;
  sectionId?: NoteSectionId;
}

/**
 * Phrases chosen for the presenting complaints common in South Sudanese
 * primary care — malaria, respiratory infection, diarrhoeal disease — rather
 * than a generic template set.
 */
export const STARTER_SHORTCUTS: readonly SeedShortcut[] = [
  {
    key: 'headache',
    name: 'Headache',
    sectionId: 'cc',
    body: 'Patient presents with a persistent headache localized to the frontal region. '
      + 'Describes the pain as dull and throbbing, with intensity increasing over the past 24 hours. '
      + 'Reports associated symptoms of light sensitivity and mild nausea. '
      + 'Pain is relieved temporarily by rest and over-the-counter pain medication.',
  },
  {
    key: 'fever',
    name: 'Fever',
    sectionId: 'cc',
    body: 'Patient reports fever for the past three days, worse in the evenings, with chills and rigors. '
      + 'Associated with generalised body aches and reduced appetite. No rash, no neck stiffness.',
  },
  {
    key: 'cough',
    name: 'Cough',
    sectionId: 'cc',
    body: 'Productive cough for two weeks with yellow sputum. No haemoptysis. '
      + 'No night sweats or weight loss reported. No known TB contact.',
  },
  {
    key: 'diarrhoea',
    name: 'Diarrhoea',
    sectionId: 'cc',
    body: 'Loose stools for two days, five to six episodes per day, watery, without blood or mucus. '
      + 'Associated with abdominal cramps. Tolerating oral fluids.',
  },
  {
    key: 'malaria-plan',
    name: 'Malaria — plan',
    sectionId: 'plan',
    body: 'Malaria RDT sent. Commence artemether-lumefantrine as per national guidelines if positive. '
      + 'Paracetamol for fever. Advised on fluid intake and on warning signs requiring immediate return: '
      + 'inability to drink, repeated vomiting, convulsions, or altered consciousness. Review in 48 hours.',
  },
  {
    key: 'normal-exam',
    name: 'Normal examination',
    sectionId: 'objective',
    body: 'Alert and oriented, not in distress. Chest clear with equal air entry bilaterally. '
      + 'Heart sounds normal, no murmurs. Abdomen soft, non-tender, no organomegaly. '
      + 'No peripheral oedema. Neurological examination grossly normal.',
  },
  {
    key: 'counselled',
    name: 'Counselling given',
    sectionId: 'plan',
    body: 'Diagnosis, treatment plan and expected course explained to the patient in a language they '
      + 'understand. Medication use and adherence discussed. Warning signs for immediate return given. '
      + 'Patient verbalised understanding and consented to the plan.',
  },
];

const shortcutsDB = () => getDB('tamamhealth_text_shortcuts');

/** Deterministic id so re-seeding updates rather than duplicates. */
function seedId(userId: string, key: string): string {
  const safe = `${userId}:${key}`.toLowerCase().replace(/[^a-z0-9:_-]/g, '_');
  return `shortcut-seed-${safe}`;
}

/**
 * Give one clinician the starter set. Existing shortcuts are left alone — a
 * clinician who has edited a starter phrase should keep their version.
 */
export async function seedTextShortcutsFor(
  userId: string,
  context: { hospitalId?: string; orgId?: string } = {},
): Promise<number> {
  const db = shortcutsDB();
  const ts = new Date().toISOString();
  let created = 0;

  for (const shortcut of STARTER_SHORTCUTS) {
    const _id = seedId(userId, shortcut.key);
    try {
      await db.get(_id);
      continue;                       // already present — do not overwrite
    } catch {
      /* not seeded yet */
    }
    const doc: TextShortcutDoc = {
      _id,
      type: 'text_shortcut',
      userId,
      name: shortcut.name,
      body: shortcut.body,
      sectionId: shortcut.sectionId,
      useCount: 0,
      shared: false,
      hospitalId: context.hospitalId,
      orgId: context.orgId,
      createdBy: userId,
      createdAt: ts,
      updatedAt: ts,
    };
    await db.put(doc);
    created += 1;
  }
  return created;
}
