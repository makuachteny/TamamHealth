/**
 * Create Lab Order — the rules the wizard enforces, tested without React.
 *
 * These are the parts a broken render would hide: which questions a test asks,
 * which of those are required (and therefore gate Next), and the labs/imaging
 * split that decides which work queue an order lands in.
 */

import { aoeQuestionsFor, aoeSchedule } from '@/components/lab/order/lab-order-aoe';
import { catalogFor, groupBySection, searchCatalog, specimenSummary, toOrderedTest } from '@/components/lab/order/lab-order-catalog';
import { timingLabelKey, type OrderedTest } from '@/components/lab/order/lab-order-types';
import { completedThrough, containersFor, DEFAULT_CONTAINERS, stepForStage } from '@/components/lab/workflow/lab-workflow-types';
import type { LabTestDef } from '@/lib/settings/facility-settings';

const test_ = (name: string, specimen = 'Blood'): OrderedTest => ({ name, specimen, tier: 'basic' });

const CATALOG: LabTestDef[] = [
  { name: 'Malaria RDT', tier: 'basic', specimen: 'Blood', loinc: '70564-7' },
  { name: 'Urinalysis', tier: 'basic', specimen: 'Urine' },
  { name: 'Blood Culture', tier: 'special', specimen: 'Blood' },
  { name: 'X-Ray — Chest', tier: 'special', specimen: 'Imaging' },
  { name: 'Ultrasound — Abdomen', tier: 'special', specimen: 'Imaging' },
];

describe('lab order catalogue', () => {
  it('splits bench investigations from imaging studies', () => {
    expect(catalogFor(CATALOG, 'labs').map(e => e.name))
      .toEqual(['Blood Culture', 'Malaria RDT', 'Urinalysis']);
    expect(catalogFor(CATALOG, 'imaging').map(e => e.name))
      .toEqual(['Ultrasound — Abdomen', 'X-Ray — Chest']);
  });

  it('searches by name, specimen and LOINC', () => {
    expect(searchCatalog(CATALOG, 'urine').map(e => e.name)).toEqual(['Urinalysis']);
    expect(searchCatalog(CATALOG, '70564').map(e => e.name)).toEqual(['Malaria RDT']);
  });

  it('groups the picker by bench section', () => {
    const sections = groupBySection(catalogFor(CATALOG, 'labs')).map(s => s.section);
    expect(sections).toContain('Haematology & chemistry');
    expect(sections).toContain('Urine');
  });

  it('collapses repeat specimens into one tube line', () => {
    const summary = specimenSummary([test_('Malaria RDT'), test_('Blood Culture'), test_('Urinalysis', 'Urine')]);
    expect(summary).toEqual([{ specimen: 'Blood', count: 2 }, { specimen: 'Urine', count: 1 }]);
  });

  it('carries tier and LOINC onto the ordered test', () => {
    expect(toOrderedTest(CATALOG[0])).toEqual({ name: 'Malaria RDT', specimen: 'Blood', tier: 'basic', loinc: '70564-7' });
  });
});

describe('ask-at-order-entry questions', () => {
  it('asks fasting state for a glucose', () => {
    const ids = aoeQuestionsFor(test_('Blood Glucose')).map(q => q.id);
    expect(ids).toContain('fasting');
    expect(aoeQuestionsFor(test_('Blood Glucose')).find(q => q.id === 'fasting')?.required).toBe(true);
  });

  it('asks recent antibiotics for a culture', () => {
    expect(aoeQuestionsFor(test_('Blood Culture')).map(q => q.id)).toContain('recent_antibiotics');
  });

  it('requires consent before an HIV test', () => {
    const consent = aoeQuestionsFor(test_('HIV Rapid Test')).find(q => q.id === 'counselling');
    expect(consent?.required).toBe(true);
  });

  it('asks pregnancy status before irradiating a woman of childbearing age', () => {
    const xray = test_('X-Ray — Chest', 'Imaging');
    expect(aoeQuestionsFor(xray, { sex: 'Female', age: 28 }).map(q => q.id)).toContain('pregnant');
    // Not asked where it cannot apply — no pointless required field to clear.
    expect(aoeQuestionsFor(xray, { sex: 'Male', age: 28 }).map(q => q.id)).not.toContain('pregnant');
    expect(aoeQuestionsFor(xray, { sex: 'Female', age: 71 }).map(q => q.id)).not.toContain('pregnant');
    // Ultrasound involves no exposure, so it never asks.
    expect(aoeQuestionsFor(test_('Ultrasound — Abdomen', 'Imaging'), { sex: 'Female', age: 28 }).map(q => q.id))
      .not.toContain('pregnant');
  });

  it('never asks the same question twice when two rules match', () => {
    const ids = aoeQuestionsFor(test_('Urine Culture', 'Urine')).map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('schedules only the tests that actually ask something', () => {
    const schedule = aoeSchedule([test_('Blood Glucose'), test_('Full Blood Count')]);
    expect(schedule.map(entry => entry.test.name)).toEqual(['Blood Glucose']);
  });
});

describe('collection wording', () => {
  it('draws specimens but performs studies', () => {
    expect(timingLabelKey('labs', 'draw_now')).toBe('labOrder.timingDrawNow');
    expect(timingLabelKey('imaging', 'draw_now')).toBe('labOrder.timingPerformNow');
    expect(timingLabelKey('imaging', 'lab_collect')).toBe('labOrder.timingUnitSchedule');
    expect(timingLabelKey('labs', 'future')).toBe(timingLabelKey('imaging', 'future'));
  });
});

describe('bench workflow staging', () => {
  it('routes each lifecycle stage to the step waiting on it', () => {
    expect(stepForStage('ordered')).toBe('collect');
    expect(stepForStage('specimen_collected')).toBe('receive');
    expect(stepForStage('received_at_lab')).toBe('process');
    expect(stepForStage('in_process')).toBe('result');
    expect(stepForStage('resulted')).toBe('report');
  });

  it('sends a rejected specimen back to collection', () => {
    expect(stepForStage('rejected_needs_recollection')).toBe('collect');
    // …and does not credit it with having been collected.
    expect(completedThrough('rejected_needs_recollection')).toBe(0);
  });

  it('counts progress so finished steps stay openable', () => {
    expect(completedThrough('ordered')).toBe(0);
    expect(completedThrough('in_process')).toBe(3);
    expect(completedThrough('resulted')).toBe(4);
    expect(completedThrough('communicated_to_patient')).toBe(5);
  });

  it('offers containers that suit the specimen', () => {
    expect(containersFor('Blood')).toContain('EDTA (purple top)');
    expect(containersFor('Urine')).toContain('Sterile universal container');
    expect(containersFor('Nonsense')).toEqual(DEFAULT_CONTAINERS);
  });
});
