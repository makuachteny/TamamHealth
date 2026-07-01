/**
 * Tests for symptom-templates.ts — branching question compile logic.
 */
import { SYMPTOM_TEMPLATES, getSymptomTemplate, compileSymptomNote } from '@/lib/clinical/symptom-templates';

describe('symptom templates', () => {
  test('every template + question has a unique id and follow-ups declare revealOn', () => {
    const ids = new Set<string>();
    for (const t of SYMPTOM_TEMPLATES) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      for (const q of t.questions) {
        if (q.followUps && q.followUps.length > 0) {
          expect(q.revealOn).toBeDefined();
        }
        if (q.type === 'select') expect((q.options || []).length).toBeGreaterThan(0);
      }
    }
  });

  test('getSymptomTemplate finds by id', () => {
    expect(getSymptomTemplate('malaria')?.name).toBe('Malaria');
    expect(getSymptomTemplate('nope')).toBeUndefined();
  });

  test('compile skips unanswered and N/A answers', () => {
    const t = getSymptomTemplate('covid_uri')!;
    const note = compileSymptomNote(t, { fever: 'yes', sore_throat: 'na' });
    expect(note).toContain('COVID-19 / URTI screen:');
    expect(note).toContain('- Fever: Yes');
    expect(note).not.toContain('Sore throat');
  });

  test('follow-ups appear only when the parent answer matches revealOn', () => {
    const t = getSymptomTemplate('covid_uri')!;
    // cough = yes reveals cough_type
    const withFollow = compileSymptomNote(t, { cough: 'yes', cough_type: 'Dry' });
    expect(withFollow).toContain('- Cough: Yes');
    expect(withFollow).toContain('  - Cough type: Dry');
    // cough = no must NOT include the follow-up even if an answer lingers
    const withoutFollow = compileSymptomNote(t, { cough: 'no', cough_type: 'Dry' });
    expect(withoutFollow).toContain('- Cough: No');
    expect(withoutFollow).not.toContain('Cough type');
  });

  test('empty answers compile to an empty string', () => {
    const t = getSymptomTemplate('hypertension')!;
    expect(compileSymptomNote(t, {})).toBe('');
    expect(compileSymptomNote(t, { adherence: 'na' })).toBe('');
  });

  test('select question renders its chosen option', () => {
    const t = getSymptomTemplate('diarrhoea')!;
    const note = compileSymptomNote(t, { duration: '>3 days' });
    expect(note).toContain('- Duration: >3 days');
  });
});
