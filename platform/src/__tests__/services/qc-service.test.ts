/**
 * Westgard QC + critical-value tests. These are pure functions over
 * numeric inputs — no database, no async — so they get tested directly.
 */
import {
  evaluateWestgard,
  isCritical,
  DEFAULT_CRITICAL_VALUES,
  type QCMeasurement,
} from '@/lib/services/qc-service';

const meas = (value: number, hoursAgo = 0): QCMeasurement => ({
  at: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
  value,
});

describe('qc-service', () => {
  describe('evaluateWestgard', () => {
    const config = { targetMean: 100, targetSD: 5 };

    it('reports in_control when measurement sits at the mean', () => {
      const r = evaluateWestgard(meas(100), config);
      expect(r.verdict).toBe('in_control');
      expect(r.triggered).toEqual([]);
      expect(r.zScore).toBeCloseTo(0);
    });

    it('reports warning on 1_2s (z just outside ±2 SD)', () => {
      const r = evaluateWestgard(meas(110.5), config);   // z = 2.1
      expect(r.verdict).toBe('warning');
      expect(r.triggered).toEqual(['1_2s']);
    });

    it('reports out_of_control on 1_3s (z outside ±3 SD)', () => {
      const r = evaluateWestgard(meas(116), config);     // z = 3.2
      expect(r.verdict).toBe('out_of_control');
      expect(r.triggered).toContain('1_3s');
    });

    it('fires 2_2s when two consecutive readings are >2 SD on the same side', () => {
      const history = [meas(112)];                       // z = 2.4
      const r = evaluateWestgard(meas(113), { ...config, history });
      expect(r.triggered).toContain('2_2s');
      expect(r.verdict).toBe('out_of_control');
    });

    it('fires R_4s when range between two adjacent readings exceeds 4 SD', () => {
      const history = [meas(111)];                       // z = 2.2
      const r = evaluateWestgard(meas(89), { ...config, history }); // z = -2.2 → range = 4.4
      expect(r.triggered).toContain('R_4s');
      expect(r.verdict).toBe('out_of_control');
    });

    it('fires 4_1s when four consecutive readings are >1 SD same side', () => {
      const history = [meas(106), meas(107), meas(108)]; // z = 1.2, 1.4, 1.6
      const r = evaluateWestgard(meas(109), { ...config, history });
      expect(r.triggered).toContain('4_1s');
      expect(r.verdict).toBe('out_of_control');
    });

    it('fires 10_x when ten consecutive readings sit on the same side of the mean', () => {
      const history: QCMeasurement[] = Array.from({ length: 9 }, (_, i) => meas(101 + i * 0.1));
      const r = evaluateWestgard(meas(101), { ...config, history });
      expect(r.triggered).toContain('10_x');
      expect(r.verdict).toBe('out_of_control');
    });

    it('refuses to evaluate when targetSD is zero', () => {
      const r = evaluateWestgard(meas(100), { targetMean: 100, targetSD: 0 });
      expect(r.verdict).toBe('out_of_control');
      expect(r.message).toMatch(/targetSD/);
    });
  });

  describe('isCritical', () => {
    it('flags a Hb of 4 as critical', () => {
      const hbRule = DEFAULT_CRITICAL_VALUES.find(r => r.testName.startsWith('Hemoglobin'))!;
      expect(isCritical(4, hbRule)).toBe(true);
    });

    it('does not flag a Hb of 12 as critical', () => {
      const hbRule = DEFAULT_CRITICAL_VALUES.find(r => r.testName.startsWith('Hemoglobin'))!;
      expect(isCritical(12, hbRule)).toBe(false);
    });

    it('flags potassium of 7.0 as critical', () => {
      const kRule = DEFAULT_CRITICAL_VALUES.find(r => r.testName.startsWith('Potassium'))!;
      expect(isCritical(7.0, kRule)).toBe(true);
    });
  });
});
