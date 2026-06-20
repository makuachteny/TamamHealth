/**
 * Tests for the lab-UI ↔ QC critical-value bridge. Pure functions over the
 * DEFAULT_CRITICAL_VALUES table — verifies fuzzy name matching and numeric
 * coercion so the lab result-entry screen flags critical values correctly.
 */
import { matchCriticalRule, evaluateCritical } from '@/lib/services/lab-critical-flag';

describe('lab-critical-flag', () => {
  describe('matchCriticalRule', () => {
    it('matches an exact friendly analyte name', () => {
      expect(matchCriticalRule('Hemoglobin')?.testName).toMatch(/^Hemoglobin/);
    });

    it('matches an order name carrying the unit suffix', () => {
      expect(matchCriticalRule('Hemoglobin (g/dL)')?.testName).toMatch(/^Hemoglobin/);
    });

    it('matches when the analyte is embedded in a longer test name', () => {
      expect(matchCriticalRule('Serum Potassium level')?.testName).toMatch(/^Potassium/);
    });

    it('returns undefined for an unmapped test', () => {
      expect(matchCriticalRule('Malaria RDT')).toBeUndefined();
    });

    it('returns undefined for empty input', () => {
      expect(matchCriticalRule('')).toBeUndefined();
    });
  });

  describe('evaluateCritical', () => {
    it('flags a Hb of 4 g/dL as critical', () => {
      const r = evaluateCritical('Hemoglobin', '4');
      expect(r.isCriticalValue).toBe(true);
      expect(r.rule?.testName).toMatch(/^Hemoglobin/);
    });

    it('does not flag a normal Hb of 13', () => {
      expect(evaluateCritical('Hemoglobin', '13').isCriticalValue).toBe(false);
    });

    it('flags a high potassium of 7.0', () => {
      expect(evaluateCritical('Potassium', '7.0').isCriticalValue).toBe(true);
    });

    it('treats non-numeric values as not critical but still returns the matched rule', () => {
      const r = evaluateCritical('Hemoglobin', 'pending');
      expect(r.isCriticalValue).toBe(false);
      expect(r.rule).toBeDefined();
    });

    it('returns not-critical with no rule for an unmapped qualitative test', () => {
      const r = evaluateCritical('Malaria RDT', 'Positive');
      expect(r.isCriticalValue).toBe(false);
      expect(r.rule).toBeUndefined();
    });
  });
});
