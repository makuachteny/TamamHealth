/**
 * Regression coverage for the nurse MAR dose-expansion cutoff (KAN — a
 * discontinued/expired prescription must stop producing new due/overdue
 * rows). See src/components/nurse/shared.tsx `doseExpansionCutoff` and its
 * use inside `useMarEntries`.
 */
import { doseExpansionCutoff, scheduleForFrequency } from '@/components/nurse/shared';

describe('doseExpansionCutoff', () => {
  it('returns null for an open course with no stop and no duration', () => {
    expect(doseExpansionCutoff({ createdAt: '2026-08-01T08:00:00.000Z', duration: '' })).toBeNull();
  });

  it('cuts off at stoppedAt when the prescriber discontinued it', () => {
    const cutoff = doseExpansionCutoff({
      stoppedAt: '2026-08-03T12:00:00.000Z',
      createdAt: '2026-08-01T08:00:00.000Z',
      duration: '7 days',
    });
    expect(cutoff).toBe(new Date('2026-08-03T12:00:00.000Z').getTime());
  });

  it('falls back to createdAt + duration when there is no explicit stop', () => {
    const cutoff = doseExpansionCutoff({
      createdAt: '2026-08-01T08:00:00.000Z',
      duration: '7 days',
    });
    expect(cutoff).toBe(new Date('2026-08-01T08:00:00.000Z').getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  it('ignores an unparseable stoppedAt and falls back to duration', () => {
    const cutoff = doseExpansionCutoff({
      stoppedAt: 'not-a-date',
      createdAt: '2026-08-01T08:00:00.000Z',
      duration: '2 days',
    });
    expect(cutoff).toBe(new Date('2026-08-01T08:00:00.000Z').getTime() + 2 * 24 * 60 * 60 * 1000);
  });
});

// Sanity check that the module's other exported pure helper still behaves —
// guards against an import-time regression in the same file.
describe('scheduleForFrequency', () => {
  it('expands a twice-daily order into two clock times', () => {
    expect(scheduleForFrequency('BD')).toEqual(['08:00', '20:00']);
  });
});
