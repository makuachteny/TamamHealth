/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for patient-document-service.ts — scanned chart documents.
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-pdoc-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  addPatientDocument,
  getPatientDocuments,
  deletePatientDocument,
} from '@/lib/services/patient-document-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const base = {
  patientId: 'pat-1', fileName: 'knee.png', mimeType: 'image/png',
  base64Data: 'AAAA', sizeBytes: 1024, uploadedById: 'dr-1', uploadedByName: 'Dr One', orgId: 'org-1',
} as const;

describe('Patient document service', () => {
  test('files and lists a document', async () => {
    await addPatientDocument({ ...base, title: 'Knee X-ray', category: 'radiology' });
    const list = await getPatientDocuments('pat-1');
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Knee X-ray');
    expect(list[0].category).toBe('radiology');
  });

  test('requires file data and a title', async () => {
    await expect(addPatientDocument({ ...base, title: 'x', category: 'other', base64Data: '' })).rejects.toThrow();
    await expect(addPatientDocument({ ...base, title: '  ', category: 'other' })).rejects.toThrow();
  });

  test('documents are scoped per patient', async () => {
    await addPatientDocument({ ...base, title: 'A', category: 'lab_report' });
    expect(await getPatientDocuments('pat-2')).toHaveLength(0);
    expect(await getPatientDocuments('pat-1')).toHaveLength(1);
  });

  test('delete reports whether it existed', async () => {
    const d = await addPatientDocument({ ...base, title: 'Temp', category: 'other' });
    expect(await deletePatientDocument(d._id)).toBe(true);
    expect(await deletePatientDocument(d._id)).toBe(false);
    expect(await getPatientDocuments('pat-1')).toHaveLength(0);
  });
});
