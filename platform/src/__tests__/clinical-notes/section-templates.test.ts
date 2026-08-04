import {
  HISTORY_TEMPLATE, PLAN_TEMPLATE, SECTION_TEMPLATES,
  templateForSection, composeTemplateText, composeNarrative,
  stripTemplateMarkers, TEMPLATE_BLOCK_START, TEMPLATE_BLOCK_END,
  type TemplateSelection,
} from '@/lib/clinical-notes/section-templates';

describe('template integrity', () => {
  test.each(SECTION_TEMPLATES.map(t => [t.id, t] as const))(
    '%s has unique group and option ids',
    (_id, template) => {
      const groupIds = template.groups.map(g => g.id);
      expect(new Set(groupIds).size).toBe(groupIds.length);

      const optionIds: string[] = [];
      for (const g of template.groups) {
        for (const o of g.options) {
          optionIds.push(o.id);
          for (const c of o.children ?? []) optionIds.push(c.id);
        }
      }
      expect(new Set(optionIds).size).toBe(optionIds.length);
    },
  );

  test('the Plan section gets the plan template, everything else the history one', () => {
    expect(templateForSection('plan').id).toBe(PLAN_TEMPLATE.id);
    expect(templateForSection('subjective').id).toBe(HISTORY_TEMPLATE.id);
    expect(templateForSection('cc').id).toBe(HISTORY_TEMPLATE.id);
  });
});

describe('composeTemplateText', () => {
  test('produces nothing when nothing is ticked', () => {
    expect(composeTemplateText(HISTORY_TEMPLATE, {})).toBe('');
  });

  test('writes one sentence per group, in template order', () => {
    const selection: TemplateSelection = { sudden: true, moderate: true };
    const text = composeTemplateText(HISTORY_TEMPLATE, selection);
    // Onset precedes Severity in the template, so it must precede it in prose.
    expect(text).toBe('Onset was sudden. Severity is moderate.');
  });

  test('joins several ticks in one group into a list', () => {
    const text = composeTemplateText(HISTORY_TEMPLATE, {
      fever: true, cough: true, headache: true,
    });
    expect(text).toBe('Reports fever, cough and headache.');
  });

  test('uses "and" for exactly two, with no comma', () => {
    const text = composeTemplateText(HISTORY_TEMPLATE, { fever: true, cough: true });
    expect(text).toBe('Reports fever and cough.');
  });

  test('a single-select group contributes only its first tick', () => {
    // Severity is a scale: ticking two values must not read "mild and severe".
    const text = composeTemplateText(HISTORY_TEMPLATE, { mild: true, severe: true });
    expect(text).toBe('Severity is mild.');
  });

  test('substitutes typed free text into the {} placeholder', () => {
    const text = composeTemplateText(HISTORY_TEMPLATE, { other_sx: 'blurred vision' });
    expect(text).toBe('Reports blurred vision.');
  });

  test('a free-text option ticked but left blank contributes nothing', () => {
    expect(composeTemplateText(HISTORY_TEMPLATE, { other_sx: true })).toBe('');
    expect(composeTemplateText(HISTORY_TEMPLATE, { other_sx: '   ' })).toBe('');
  });

  test('free text is combined with fixed text when the option has both', () => {
    const text = composeTemplateText(HISTORY_TEMPLATE, { tx_side_effects: 'drowsiness' });
    expect(text).toBe('Treatment response: side effects: drowsiness.');
  });

  test('falls back to the lower-cased label when an option has no text', () => {
    // Symptoms options are label-only by design.
    expect(composeTemplateText(HISTORY_TEMPLATE, { nausea: true })).toBe('Reports nausea.');
  });

  test('capitalises a group with no lead-in', () => {
    const template = {
      id: 't', label: 'T',
      groups: [{ id: 'g', label: 'G', options: [{ id: 'o', label: 'Opt', text: 'something happened' }] }],
    };
    expect(composeTemplateText(template, { o: true })).toBe('Something happened.');
  });

  test('composes a realistic multi-group history', () => {
    const text = composeTemplateText(HISTORY_TEMPLATE, {
      new_problem: true, days: true, gradual: true, moderate: true,
      headache: true, light_sensitivity: true, no_fever: true,
    });
    expect(text).toBe(
      'Patient presents with a new problem. '
      + 'Symptoms have been present for several days. '
      + 'Onset was gradual. '
      + 'Severity is moderate. '
      + 'Reports headache and light sensitivity. '
      + 'Denies fever.',
    );
  });

  test('the plan template composes orders and disposition', () => {
    const text = composeTemplateText(PLAN_TEMPLATE, {
      malaria_rdt: true, start_med: true, home: true, fu_week: true,
    });
    expect(text).toBe(
      'Ordered a malaria RDT. '
      + 'Treatment: medication started. '
      + 'Disposition: discharged home. '
      + 'Follow-up in one week.',
    );
  });
});

describe('composeNarrative', () => {
  test('wraps generated text in the template block', () => {
    const merged = composeNarrative('', 'Onset was sudden.');
    expect(merged).toBe(`${TEMPLATE_BLOCK_START}Onset was sudden.${TEMPLATE_BLOCK_END}`);
  });

  test('appends after text the clinician typed first', () => {
    const merged = composeNarrative('Seen with an interpreter.', 'Onset was sudden.');
    expect(merged.startsWith('Seen with an interpreter.')).toBe(true);
    expect(merged).toContain('Onset was sudden.');
  });

  // The reason the block delimiters exist at all: regenerating must replace
  // only what the template produced, never the clinician's own words.
  test('regenerating replaces only the generated block, preserving typed text', () => {
    const first = composeNarrative('Seen with an interpreter.', 'Onset was sudden.');
    const second = composeNarrative(first, 'Onset was gradual. Severity is severe.');

    expect(second).toContain('Seen with an interpreter.');
    expect(second).toContain('Onset was gradual. Severity is severe.');
    expect(second).not.toContain('Onset was sudden.');
  });

  test('preserves text typed after the generated block', () => {
    const withBlock = composeNarrative('', 'Onset was sudden.');
    const withTail = `${withBlock}\n\nPatient declined admission.`;
    const regenerated = composeNarrative(withTail, 'Onset was gradual.');

    expect(regenerated).toContain('Patient declined admission.');
    expect(regenerated).toContain('Onset was gradual.');
    expect(regenerated).not.toContain('Onset was sudden.');
  });

  test('clearing every tick removes the block but keeps typed narrative', () => {
    const withBlock = composeNarrative('Typed by hand.', 'Onset was sudden.');
    const cleared = composeNarrative(withBlock, '');

    expect(cleared).toContain('Typed by hand.');
    expect(cleared).not.toContain('Onset was sudden.');
    expect(cleared).not.toContain(TEMPLATE_BLOCK_START);
  });

  test('empty generated text against empty existing text stays empty', () => {
    expect(composeNarrative('', '')).toBe('');
  });
});

describe('stripTemplateMarkers', () => {
  test('removes delimiters for display and transmission', () => {
    const merged = composeNarrative('Hand typed.', 'Generated line.');
    const clean = stripTemplateMarkers(merged);
    expect(clean).toContain('Hand typed.');
    expect(clean).toContain('Generated line.');
    expect(clean).not.toContain(TEMPLATE_BLOCK_START);
    expect(clean).not.toContain(TEMPLATE_BLOCK_END);
  });

  test('tolerates empty and undefined input', () => {
    expect(stripTemplateMarkers('')).toBe('');
    expect(stripTemplateMarkers(undefined as unknown as string)).toBe('');
  });
});
