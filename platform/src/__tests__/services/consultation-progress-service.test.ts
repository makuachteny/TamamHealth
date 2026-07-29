/* eslint-disable @typescript-eslint/no-require-imports */
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-progress-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  addProgressTask,
  ensureConsultationProgress,
  getConsultationProgressByPatient,
  updateProgressMilestone,
  updateProgressStage,
  updateProgressTask,
  syncConsultationProgressStage,
} from '@/lib/services/consultation-progress-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

const actor = { id: 'user-1', name: 'Nurse A', role: 'nurse' as const };

describe('consultation progress service', () => {
  test('creates one shared tracker and reuses it for the patient', async () => {
    const first = await ensureConsultationProgress({
      patientId: 'pat-1', patientName: 'Akol Deng', hospitalId: 'hosp-1', orgId: 'org-1', actor,
    });
    const second = await ensureConsultationProgress({
      patientId: 'pat-1', patientName: 'Akol Deng', hospitalId: 'hosp-1', orgId: 'org-1', encounterId: 'enc-1', actor,
    });

    expect(second._id).toBe(first._id);
    expect(second.encounterId).toBe('enc-1');
    expect(second.milestones).toHaveLength(9);
  });

  test('records stage, milestone, task, and completion changes in the event history', async () => {
    const tracker = await ensureConsultationProgress({
      patientId: 'pat-2', patientName: 'Mary Jada', hospitalId: 'hosp-1', actor,
    });
    const staged = await updateProgressStage(tracker._id, 'orders_pending', actor, 'Review laboratory result');
    const tasked = await addProgressTask(tracker._id, { title: 'Review CBC', priority: 'high' }, actor);
    const task = tasked!.tasks[0];
    const completedTask = await updateProgressTask(tracker._id, task.id, 'completed', actor);
    const final = await updateProgressMilestone(tracker._id, 'orders_placed', 'completed', actor);

    expect(staged?.currentStage).toBe('orders_pending');
    expect(completedTask?.tasks[0].status).toBe('completed');
    expect(final?.milestones.find(m => m.key === 'orders_placed')?.status).toBe('completed');
    expect(final?.events.length).toBeGreaterThanOrEqual(5);
    expect((await getConsultationProgressByPatient('pat-2'))?.currentStage).toBe('orders_pending');
  });

  test('syncs a nursing handoff without creating a duplicate tracker', async () => {
    const first = await syncConsultationProgressStage({
      patientId: 'pat-3',
      patientName: 'Nyandeng Lual',
      hospitalId: 'hosp-1',
      orgId: 'org-1',
      stage: 'waiting_for_provider',
      nextAction: 'Assign patient to a provider',
      actor,
    });
    const second = await syncConsultationProgressStage({
      patientId: 'pat-3',
      patientName: 'Nyandeng Lual',
      hospitalId: 'hosp-1',
      orgId: 'org-1',
      stage: 'waiting_for_provider',
      nextAction: 'Start consultation',
      actor: { ...actor, name: 'Rooming Nurse' },
    });

    expect(second?._id).toBe(first?._id);
    expect(second?.currentStage).toBe('waiting_for_provider');
    expect(second?.nextAction).toBe('Start consultation');
    expect(second?.events.filter(event => event.kind === 'stage')).toHaveLength(2);
  });
});
