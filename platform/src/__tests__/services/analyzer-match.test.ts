/**
 * Matching an analyzer reading to the order it belongs to.
 *
 * The case that matters is the one that used to fail silently: two patients
 * waiting on the same test. Name matching picked whichever sorted first, so a
 * reading could be filed against the wrong chart with nothing to show for it.
 */

import { matchAnalyzerResult } from '@/lib/services/instrument-intake-service';

type Order = { _id: string; status?: string; testName?: string; accessionNumber?: string };

const ORDERS: Order[] = [
  { _id: 'lab-a', status: 'pending', testName: 'Hemoglobin', accessionNumber: 'ACC-7788' },
  { _id: 'lab-b', status: 'pending', testName: 'Hemoglobin', accessionNumber: 'ACC-9911' },
  { _id: 'lab-c', status: 'completed', testName: 'Blood Glucose', accessionNumber: 'ACC-1234' },
];

describe('matchAnalyzerResult', () => {
  it('matches on accession, not on the first same-named order', () => {
    const hit = matchAnalyzerResult({ accession: 'ACC-9911', testName: 'Hemoglobin' }, ORDERS);
    expect(hit?._id).toBe('lab-b');
  });

  it('is insensitive to case and surrounding whitespace in the accession', () => {
    const hit = matchAnalyzerResult({ accession: '  acc-9911 ', testName: 'HGB' }, ORDERS);
    expect(hit?._id).toBe('lab-b');
  });

  it('refuses to guess when the accession is unknown to us', () => {
    // The old behaviour fell through to a name match here and filed the value
    // against a stranger's order.
    const hit = matchAnalyzerResult({ accession: 'ACC-0000', testName: 'Hemoglobin' }, ORDERS);
    expect(hit).toBeUndefined();
  });

  it('returns an already-reported order so its value is amended, not re-filed', () => {
    const hit = matchAnalyzerResult({ accession: 'ACC-1234', testName: 'Blood Glucose' }, ORDERS);
    expect(hit?._id).toBe('lab-c');
  });

  it('falls back to the test name only when the reading carries no accession', () => {
    const hit = matchAnalyzerResult({ accession: '', testName: 'Hemoglobin' }, ORDERS);
    expect(hit?._id).toBe('lab-a');
  });

  it('never matches a completed order by name', () => {
    const hit = matchAnalyzerResult({ accession: '', testName: 'Blood Glucose' }, ORDERS);
    expect(hit).toBeUndefined();
  });

  it('strips the parenthetical qualifier analyzers append to test names', () => {
    const hit = matchAnalyzerResult({ accession: '', testName: 'Hemoglobin (whole blood)' }, ORDERS);
    expect(hit?._id).toBe('lab-a');
  });

  it('returns nothing when there is neither an accession nor a usable name', () => {
    expect(matchAnalyzerResult({ accession: '', testName: '' }, ORDERS)).toBeUndefined();
  });
});
