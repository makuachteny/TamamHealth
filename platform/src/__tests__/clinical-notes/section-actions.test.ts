/**
 * What a clinician can DO from each note section — the replacement for the
 * retired section templates. Pure catalog data, so these tests just pin its
 * self-consistency and the couple of clinically load-bearing placements.
 */
import {
  NOTE_SECTION_ACTIONS, SECTION_ACTIONS, actionsForSection,
  type NoteSectionActionId,
} from '@/lib/clinical-notes/section-actions';

describe('NOTE_SECTION_ACTIONS integrity', () => {
  test('every action definition is keyed under its own id', () => {
    for (const [key, def] of Object.entries(NOTE_SECTION_ACTIONS)) {
      expect(def.id).toBe(key);
    }
  });

  test('every action has a label and a description that actually says what it does', () => {
    for (const def of Object.values(NOTE_SECTION_ACTIONS)) {
      expect(def.label.trim().length).toBeGreaterThan(0);
      expect(def.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('SECTION_ACTIONS integrity', () => {
  test('every action id referenced by a section is a real, defined action', () => {
    for (const ids of Object.values(SECTION_ACTIONS)) {
      for (const id of ids!) {
        expect(NOTE_SECTION_ACTIONS[id as NoteSectionActionId]).toBeDefined();
      }
    }
  });

  test('no section lists the same action twice', () => {
    for (const ids of Object.values(SECTION_ACTIONS)) {
      expect(new Set(ids).size).toBe(ids!.length);
    }
  });

  test('purely narrative sections carry no actions — a row of irrelevant buttons is noise', () => {
    // These are free-text sections with nothing operational to trigger from
    // them; SECTION_ACTIONS should simply not mention them.
    for (const narrative of ['cc', 'hpi', 'ros', 'subjective', 'objective']) {
      expect(SECTION_ACTIONS[narrative as keyof typeof SECTION_ACTIONS]).toBeUndefined();
    }
  });

  test('Plan offers the orders a plan actually raises', () => {
    expect(SECTION_ACTIONS.plan).toEqual(
      expect.arrayContaining(['prescribe', 'order_lab', 'order_vaccine', 'refer']),
    );
  });

  test('Assessment can cite the problem list', () => {
    expect(SECTION_ACTIONS.assessment).toContain('include_problems');
  });

  test('Allergies reaches allergy management, not prescribing', () => {
    expect(SECTION_ACTIONS.allergies).toEqual(['manage_allergies']);
  });

  test('Medications and Discharge Medications offer the same actions', () => {
    expect(SECTION_ACTIONS.medications).toEqual(SECTION_ACTIONS.discharge_medications);
  });
});

describe('actionsForSection', () => {
  test('resolves ids to full action definitions, in declared order', () => {
    const defs = actionsForSection('plan');
    expect(defs.map(d => d.id)).toEqual([...SECTION_ACTIONS.plan!]);
    expect(defs[0]).toMatchObject({ id: 'prescribe', label: 'Prescribe' });
  });

  test('returns an empty array for a section with no actions', () => {
    expect(actionsForSection('cc')).toEqual([]);
  });

  test('returns an empty array for an unknown section id rather than throwing', () => {
    expect(actionsForSection('not_a_real_section')).toEqual([]);
  });
});
