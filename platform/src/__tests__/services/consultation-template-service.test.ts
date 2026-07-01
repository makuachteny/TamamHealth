/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for consultation-template-service.ts — clinician-saved consult bundles.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-ctmpl-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  saveConsultationTemplate,
  getConsultationTemplates,
  deleteConsultationTemplate,
  bumpTemplateUse,
} from '@/lib/services/consultation-template-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const base = { userId: 'dr-1', userName: 'Dr One', orgId: 'org-1' } as const;

describe('Consultation template service', () => {
  test('saves and lists a template', async () => {
    await saveConsultationTemplate({
      ...base,
      name: 'Bronchitis adult',
      diagnoses: [{ code: 'J20', label: 'Acute bronchitis' }],
      medications: [{ medication: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'BD', duration: '5 days' }],
    });
    const list = await getConsultationTemplates('dr-1');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Bronchitis adult');
    expect(list[0].medications?.[0].medication).toBe('Amoxicillin');
  });

  test('rejects an empty name', async () => {
    await expect(saveConsultationTemplate({ ...base, name: '   ', diagnoses: [{ label: 'x' }] })).rejects.toThrow();
  });

  test('rejects an empty template (no content)', async () => {
    await expect(saveConsultationTemplate({ ...base, name: 'Empty' })).rejects.toThrow();
  });

  test('templates are scoped per user', async () => {
    await saveConsultationTemplate({ ...base, name: 'Mine', labs: ['Malaria RDT'] });
    expect(await getConsultationTemplates('dr-2')).toHaveLength(0);
    expect(await getConsultationTemplates('dr-1')).toHaveLength(1);
  });

  test('bumpTemplateUse orders most-used first and is safe on misses', async () => {
    const a = await saveConsultationTemplate({ ...base, name: 'A', labs: ['CBC'] });
    const b = await saveConsultationTemplate({ ...base, name: 'B', labs: ['CBC'] });
    await bumpTemplateUse(b._id);
    await bumpTemplateUse(b._id);
    await bumpTemplateUse('missing-id'); // no throw
    const list = await getConsultationTemplates('dr-1');
    expect(list[0]._id).toBe(b._id);
    expect(list[0].useCount).toBe(2);
    expect(list[1]._id).toBe(a._id);
  });

  test('delete reports whether it existed', async () => {
    const t = await saveConsultationTemplate({ ...base, name: 'Temp', labs: ['CBC'] });
    expect(await deleteConsultationTemplate(t._id)).toBe(true);
    expect(await deleteConsultationTemplate(t._id)).toBe(false);
    expect(await getConsultationTemplates('dr-1')).toHaveLength(0);
  });
});
