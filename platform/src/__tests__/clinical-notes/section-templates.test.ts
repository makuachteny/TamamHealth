/**
 * Section templates are retired, but notes written while they existed still
 * carry their delimiters. These pin the one behaviour that still matters: a
 * historic note renders as clean prose, and none of the surrounding text the
 * clinician typed by hand is disturbed on the way out.
 */
import {
  stripTemplateMarkers, TEMPLATE_BLOCK_START, TEMPLATE_BLOCK_END,
} from '@/lib/clinical-notes/section-templates';

describe('stripTemplateMarkers', () => {
  test('removes the delimiters and keeps the generated prose', () => {
    const stored = `Patient reports cough.\n\n${TEMPLATE_BLOCK_START}Denies fever. Denies chest pain.${TEMPLATE_BLOCK_END}`;
    expect(stripTemplateMarkers(stored)).toBe(
      'Patient reports cough.\n\nDenies fever. Denies chest pain.',
    );
  });

  test('leaves a note that never used a template untouched', () => {
    const plain = 'Seen with her daughter. Cough for three days, no fever.';
    expect(stripTemplateMarkers(plain)).toBe(plain);
  });

  test('handles several blocks and an unterminated one without losing text', () => {
    const messy = `${TEMPLATE_BLOCK_START}A${TEMPLATE_BLOCK_END} mid ${TEMPLATE_BLOCK_START}B`;
    expect(stripTemplateMarkers(messy)).toBe('A mid B');
  });

  test('tolerates empty and undefined input', () => {
    expect(stripTemplateMarkers('')).toBe('');
    expect(stripTemplateMarkers(undefined as unknown as string)).toBe('');
  });
});
