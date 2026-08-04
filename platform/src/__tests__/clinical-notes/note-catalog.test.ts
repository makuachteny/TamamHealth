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
    // A Procedure note opens with Indications; adding CC must not reorder the
    // procedure narrative that follows it.
    const resolved = resolveSections('procedure', ['cc']);
    expect(resolved[0]).toBe('cc');
    expect(resolved.slice(1, 4)).toEqual(['indications', 'procedure', 'anesthesia']);
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
