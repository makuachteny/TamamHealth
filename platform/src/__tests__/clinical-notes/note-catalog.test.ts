import {
  NOTE_TYPES, NOTE_TYPE_ORDER, NOTE_SECTIONS,
  resolveSections, availableOptionalSections, getNoteType,
  isNoteTypeId, isNoteSectionId, getSectionLabel,
  type NoteTypeId,
} from '@/lib/clinical-notes/note-catalog';

const ALL_TYPES = Object.keys(NOTE_TYPES) as NoteTypeId[];

describe('note catalog integrity', () => {
  test('every note type is in the display order, and vice versa', () => {
    expect(new Set(NOTE_TYPE_ORDER)).toEqual(new Set(ALL_TYPES));
    expect(NOTE_TYPE_ORDER.length).toBe(ALL_TYPES.length);
  });

  test.each(ALL_TYPES)('%s references only defined sections', (id) => {
    const def = NOTE_TYPES[id];
    for (const sid of [...def.sections, ...def.optionalSections]) {
      expect(NOTE_SECTIONS[sid]).toBeDefined();
    }
  });

  test.each(ALL_TYPES)('%s has a label, description and at least one section', (id) => {
    const def = NOTE_TYPES[id];
    expect(def.label).toBeTruthy();
    expect(def.description).toBeTruthy();
    expect(def.sections.length).toBeGreaterThan(0);
  });

  test.each(ALL_TYPES)('%s does not list a section as both default and optional', (id) => {
    const def = NOTE_TYPES[id];
    const overlap = def.optionalSections.filter(s => def.sections.includes(s));
    expect(overlap).toEqual([]);
  });

  test.each(ALL_TYPES)('%s has no duplicate sections', (id) => {
    const def = NOTE_TYPES[id];
    expect(new Set(def.sections).size).toBe(def.sections.length);
  });

  test('every section definition is self-consistent', () => {
    for (const [id, def] of Object.entries(NOTE_SECTIONS)) {
      expect(def.id).toBe(id);
      expect(def.label).toBeTruthy();
      // A derived section must name where its data comes from, or the editor
      // has nothing to fetch.
      if (def.kind === 'derived') expect(def.source).toBeTruthy();
    }
  });

  test('telehealth types are marked so the note records the modality', () => {
    expect(NOTE_TYPES.telehealth_soap.telehealth).toBe(true);
    expect(NOTE_TYPES.telehealth_hp.telehealth).toBe(true);
    expect(NOTE_TYPES.soap.telehealth).toBeFalsy();
  });
});

/**
 * Each note type exists to answer a different question, and the sections are
 * what make it answer that question. These assert the clinically load-bearing
 * parts — the ones whose absence would make the note the wrong document.
 */
describe('note types carry the sections their purpose requires', () => {
  test('a consultation records the referring question and answers it', () => {
    const s = NOTE_TYPES.consultation.sections;
    expect(s).toContain('reason_for_consultation');
    expect(s).toContain('recommendations');
    // The question comes first, the answer near the end.
    expect(s.indexOf('reason_for_consultation')).toBeLessThan(s.indexOf('recommendations'));
  });

  test('a procedure note keeps pre- and post-operative diagnoses separate', () => {
    const s = NOTE_TYPES.procedure.sections;
    // The difference between them IS the finding; one combined line loses it.
    expect(s).toContain('preop_diagnosis');
    expect(s).toContain('postop_diagnosis');
    expect(s).toContain('estimated_blood_loss');
    expect(s).toContain('specimens');
    expect(s).toContain('complications');
  });

  test('a discharge summary reads admission → course → what they leave with', () => {
    const s = NOTE_TYPES.discharge_summary.sections;
    expect(s).toContain('admission_reason');
    expect(s).toContain('discharge_diagnosis');
    expect(s).toContain('discharge_condition');
    expect(s).toContain('discharge_medications');
    expect(s).toContain('follow_up');
    expect(s.indexOf('admission_reason')).toBeLessThan(s.indexOf('hospital_course'));
    expect(s.indexOf('hospital_course')).toBeLessThan(s.indexOf('discharge_medications'));
  });

  test('nursing documentation records the response, not just the intervention', () => {
    const s = NOTE_TYPES.nurse_visit.sections;
    expect(s).toContain('interventions');
    expect(s).toContain('response_to_care');
    expect(s.indexOf('interventions')).toBeLessThan(s.indexOf('response_to_care'));
  });

  test('every telehealth type carries the attestation by default', () => {
    for (const id of ALL_TYPES) {
      if (!NOTE_TYPES[id].telehealth) continue;
      // Consent and both parties' locations are what evidence a lawful remote
      // visit — optional is not good enough.
      expect(NOTE_TYPES[id].sections).toContain('telehealth_attestation');
    }
  });

  test('a telehealth H&P does not pre-print a physical exam', () => {
    // Pre-printing it invites a normal-exam shortcut for findings nobody could
    // have elicited over a video link. It stays available as optional.
    expect(NOTE_TYPES.telehealth_hp.sections).not.toContain('physical_exam');
    expect(NOTE_TYPES.telehealth_hp.optionalSections).toContain('physical_exam');
  });

  test('an OB evaluation can record obstetric history and fetal assessment', () => {
    const s = NOTE_TYPES.ob_evaluation.sections;
    expect(s).toContain('obstetric_history');
    expect(s).toContain('fetal_assessment');
  });

  test('an amendment states why it is amending', () => {
    expect(NOTE_TYPES.amendment.sections).toContain('addendum_reason');
  });

  test('a phone note records who called and what they were told', () => {
    const s = NOTE_TYPES.phone.sections;
    expect(s).toContain('caller');
    expect(s).toContain('call_reason');
    expect(s).toContain('advice_given');
  });
});

describe('type guards', () => {
  test('isNoteTypeId', () => {
    expect(isNoteTypeId('soap')).toBe(true);
    expect(isNoteTypeId('not_a_type')).toBe(false);
    expect(isNoteTypeId(undefined)).toBe(false);
  });

  test('isNoteSectionId', () => {
    expect(isNoteSectionId('plan')).toBe(true);
    expect(isNoteSectionId('nope')).toBe(false);
  });

  test('getNoteType falls back to SOAP rather than returning undefined', () => {
    expect(getNoteType('garbage').id).toBe('soap');
  });

  test('getSectionLabel echoes an unknown id instead of throwing', () => {
    expect(getSectionLabel('cc')).toBe('CC');
    expect(getSectionLabel('mystery')).toBe('mystery');
  });
});

describe('resolveSections', () => {
  test('returns the type defaults when nothing was added', () => {
    expect(resolveSections('soap')).toEqual([...NOTE_TYPES.soap.sections]);
  });

  test('places an added optional section in its clinical position, not at the end', () => {
    // 'hpi' is optional for SOAP and sits between cc and subjective in the
    // catalog order, so adding it must not append it after plan.
    const resolved = resolveSections('soap', ['hpi']);
    expect(resolved).toContain('hpi');
    expect(resolved.indexOf('hpi')).toBeLessThan(resolved.indexOf('plan'));
    expect(resolved[resolved.length - 1]).toBe('plan');
  });

  test('ignores unknown section ids', () => {
    expect(resolveSections('soap', ['not_a_section'])).toEqual([...NOTE_TYPES.soap.sections]);
  });

  test('never duplicates a section already in the defaults', () => {
    const resolved = resolveSections('soap', ['plan', 'plan']);
    expect(resolved.filter(s => s === 'plan')).toHaveLength(1);
  });

  test('keeps an off-catalog section that carries content, ranked clinically', () => {
    // 'procedure' is neither default nor optional for SOAP. A note retyped from
    // Procedure to SOAP still carries that text, and dropping it would lose
    // documented narrative. It is placed by clinical rank — before the
    // assessment and plan, which is where a procedure account belongs.
    const resolved = resolveSections('soap', ['procedure']);
    expect(resolved).toContain('procedure');
    expect(resolved.indexOf('procedure')).toBeLessThan(resolved.indexOf('assessment'));
    expect(resolved[resolved.length - 1]).toBe('plan');
  });

  test('a section with no clinical rank sorts last rather than being dropped', () => {
    const resolved = resolveSections('memo_to_record', ['follow_up']);
    expect(resolved).toEqual(['memo', 'follow_up']);
  });

  test('preserves the type’s own order for its declared sections', () => {
    // Adding CC to a Procedure note must not reshuffle the operative narrative
    // that follows it — the type's declared order stays intact.
    const resolved = resolveSections('procedure', ['cc']);
    expect(resolved[0]).toBe('cc');
    expect(resolved.slice(1)).toEqual([...NOTE_TYPES.procedure.sections]);
  });
});

describe('availableOptionalSections', () => {
  test('excludes sections already present', () => {
    const before = availableOptionalSections('soap').map(s => s.id);
    expect(before).toContain('hpi');

    const after = availableOptionalSections('soap', ['hpi']).map(s => s.id);
    expect(after).not.toContain('hpi');
  });

  test('never offers a section the type already renders by default', () => {
    const offered = availableOptionalSections('soap').map(s => s.id);
    for (const def of NOTE_TYPES.soap.sections) {
      expect(offered).not.toContain(def);
    }
  });

  test('amendment offers nothing optional — it is a fixed two-part form', () => {
    expect(availableOptionalSections('amendment')).toEqual([]);
  });
});
