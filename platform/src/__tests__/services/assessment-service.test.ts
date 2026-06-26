/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for assessment scoring (pure) and assessment-service (P2.2).
 */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-asmt-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { PHQ9, GAD7, ANC_DANGER, IMCI_DANGER, scoreAssessment, getInstrument } from '@/lib/clinical/assessment-instruments';
import {
  createAssessment,
  updateAssessmentAnswers,
  signAssessment,
  getAssessmentsByPatient,
  getHeldAssessments,
  AssessmentLockError,
  AssessmentAuthorizationError,
} from '@/lib/services/assessment-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

describe('Assessment scoring (pure)', () => {
  test('PHQ-9 sums answered items and resolves the band', () => {
    const answers = { q1: 3, q2: 3, q3: 2, q4: 2, q5: 2, q6: 1, q7: 1, q8: 1, q9: 1 };
    const s = scoreAssessment(PHQ9, answers);
    expect(s.total).toBe(16);
    expect(s.answered).toBe(9);
    expect(s.band?.severity).toBe('moderately_severe');
  });

  test('only answered questions count toward the total', () => {
    const s = scoreAssessment(PHQ9, { q1: 2, q2: 2 });
    expect(s.total).toBe(4);
    expect(s.answered).toBe(2);
    expect(s.questionCount).toBe(9);
    expect(s.band?.severity).toBe('minimal');
  });

  test('GAD-7 severe band', () => {
    const s = scoreAssessment(GAD7, { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 2, q7: 2 });
    expect(s.total).toBe(19);
    expect(s.band?.severity).toBe('severe');
  });

  test('ignores NaN / undefined answers', () => {
    const s = scoreAssessment(PHQ9, { q1: 3, q2: undefined, q3: NaN as unknown as number });
    expect(s.total).toBe(3);
    expect(s.answered).toBe(1);
  });

  test('getInstrument returns known instruments', () => {
    expect(getInstrument('phq9')?.name).toContain('PHQ-9');
    expect(getInstrument('anc_danger')?.name).toContain('ANC');
    expect(getInstrument('imci_danger')?.name).toContain('IMCI');
    expect(getInstrument('nope')).toBeUndefined();
  });

  test('ANC danger screen: no signs is routine, any sign is urgent', () => {
    const none = scoreAssessment(ANC_DANGER, { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0 });
    expect(none.total).toBe(0);
    expect(none.band?.severity).toBe('minimal');
    const danger = scoreAssessment(ANC_DANGER, { q1: 1 });
    expect(danger.total).toBe(1);
    expect(danger.band?.severity).toBe('severe');
    expect(danger.band?.label).toMatch(/urgent referral/i);
  });

  test('IMCI danger screen flags any positive sign as urgent', () => {
    const s = scoreAssessment(IMCI_DANGER, { q4: 1 });
    expect(s.band?.severity).toBe('severe');
  });
});

describe('Assessment service (P2.2)', () => {
  const deskUser = { enteredById: 'u-desk', enteredByName: 'Amira (Front Desk)' };

  test('front desk creates a held assessment with computed score', async () => {
    const a = await createAssessment({
      patientId: 'p1', patientName: 'Ayen', instrumentId: 'phq9',
      answers: { q1: 2, q2: 2, q3: 1 }, ...deskUser,
    });
    expect(a.documentStatus).toBe('held');
    expect(a.totalScore).toBe(5);
    expect(a.severity).toBe('mild');
    expect(a.instrumentName).toContain('PHQ-9');
  });

  test('rejects an unknown instrument', async () => {
    await expect(createAssessment({ patientId: 'p1', instrumentId: 'bogus', answers: {} })).rejects.toThrow();
  });

  test('answers can be updated (re-scored) while held', async () => {
    const a = await createAssessment({ patientId: 'p1', instrumentId: 'phq9', answers: { q1: 1 } });
    const updated = await updateAssessmentAnswers(a._id, { q1: 3, q2: 3, q3: 3, q4: 3 });
    expect(updated!.totalScore).toBe(12);
    expect(updated!.severity).toBe('moderate');
  });

  test('provider signs a held assessment, locking it', async () => {
    const a = await createAssessment({ patientId: 'p1', instrumentId: 'phq9', answers: { q1: 1 } });
    const signed = await signAssessment(a._id, { userId: 'u-dr', userName: 'Dr. Wani', userRole: 'doctor' });
    expect(signed!.documentStatus).toBe('signed');
    expect(signed!.signedByName).toBe('Dr. Wani');
    // Locked: cannot edit answers after signing.
    await expect(updateAssessmentAnswers(a._id, { q1: 0 })).rejects.toThrow(AssessmentLockError);
  });

  test('a non-clinical role may not sign', async () => {
    const a = await createAssessment({ patientId: 'p1', instrumentId: 'phq9', answers: {} });
    await expect(signAssessment(a._id, { userName: 'Desk', userRole: 'front_desk' })).rejects.toThrow(AssessmentAuthorizationError);
  });

  test('held assessments list surfaces only held ones', async () => {
    const a1 = await createAssessment({ patientId: 'p1', instrumentId: 'phq9', answers: {} });
    await createAssessment({ patientId: 'p2', instrumentId: 'gad7', answers: {} });
    await signAssessment(a1._id, { userId: 'u-dr', userName: 'Dr. Wani', userRole: 'doctor' });
    const held = await getHeldAssessments();
    expect(held).toHaveLength(1);
    expect(held[0].patientId).toBe('p2');
  });

  test('lists by patient newest-first', async () => {
    await createAssessment({ patientId: 'p1', instrumentId: 'phq9', answers: {} });
    await createAssessment({ patientId: 'p1', instrumentId: 'gad7', answers: {} });
    const list = await getAssessmentsByPatient('p1');
    expect(list).toHaveLength(2);
  });
});
