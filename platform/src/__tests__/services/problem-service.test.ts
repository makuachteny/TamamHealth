/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for problem-service.ts (longitudinal Problem List).
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-problem-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createProblem, getProblemsByPatient, updateProblem, setProblemStatus, deleteProblem,
} from '@/lib/services/problem-service';
import type { DataScope } from '@/lib/services/data-scope';
import type { ProblemDoc } from '@/lib/db-types';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

function baseProblem(overrides: Partial<ProblemDoc> = {}) {
  return {
    patientId: 'patient-001',
    patientName: 'Ayen Deng',
    name: 'Type 2 Diabetes Mellitus',
    icd11Code: '5A11',
    status: 'active',
    onsetDate: '2024-01-01',
    hospitalId: 'hosp-001',
    orgId: 'org-a',
    recordedBy: 'u-doc',
    recordedByName: 'Dr Achol',
    ...overrides,
  } as unknown as Parameters<typeof createProblem>[0];
}

describe('Problem list service', () => {
  test('creates a problem and lists it for its patient', async () => {
    await createProblem(baseProblem());
    const rows = await getProblemsByPatient('patient-001');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Type 2 Diabetes Mellitus');
  });

  test('only returns problems for the requested patient', async () => {
    await createProblem(baseProblem());
    await createProblem(baseProblem({ patientId: 'patient-002', patientName: 'Other Patient' }));
    const rows = await getProblemsByPatient('patient-001');
    expect(rows).toHaveLength(1);
    expect(rows[0].patientId).toBe('patient-001');
  });

  test('updateProblem edits fields and setProblemStatus resolves with a date', async () => {
    const created = await createProblem(baseProblem());
    const resolved = await setProblemStatus(created._id, 'resolved');
    expect(resolved!.status).toBe('resolved');
    expect(resolved!.resolvedDate).toBeTruthy();

    const updated = await updateProblem(created._id, { severity: 'severe' });
    expect(updated!.severity).toBe('severe');
  });

  test('deleteProblem removes the entry', async () => {
    const created = await createProblem(baseProblem());
    expect(await deleteProblem(created._id)).toBe(true);
    expect(await getProblemsByPatient('patient-001')).toHaveLength(0);
  });

  test('getProblemsByPatient scopes by org/facility — a different org sees nothing', async () => {
    await createProblem(baseProblem());

    const otherOrg: DataScope = { role: 'doctor', orgId: 'org-b', hospitalId: 'hosp-999' };
    expect(await getProblemsByPatient('patient-001', otherOrg)).toHaveLength(0);

    const sameOrg: DataScope = { role: 'doctor', orgId: 'org-a', hospitalId: 'hosp-001' };
    const inScope = await getProblemsByPatient('patient-001', sameOrg);
    expect(inScope).toHaveLength(1);

    // Unscoped callers (internal reads, no `scope` passed) are unaffected.
    expect(await getProblemsByPatient('patient-001')).toHaveLength(1);
  });
});
