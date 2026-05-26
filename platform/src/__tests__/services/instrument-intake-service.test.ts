/**
 * Instrument intake parser tests — pure functions, no DB.
 */
import { parseInstrumentPayload } from '@/lib/services/instrument-intake-service';

describe('instrument-intake-service', () => {
  describe('LIS-2A parsing', () => {
    const sample = [
      'H|\\^&|||Sysmex^XN-330|||||||P|1.0|20260423120000',
      'P|1|PID-001||MRN-9912|Lobon^Margaret|||F',
      'O|1|ACC-7788|XN-330|^^^FBC|R|20260423115500|20260423120000|||||||||||',
      'R|1|^^^WBC^White Blood Cell|7.4|10*9/L|4.0-11.0|N||F||TECH01|20260423120000|20260423120015',
      'R|2|^^^HGB^Hemoglobin|13.2|g/dL|12.0-16.0|N||F||TECH01|20260423120000|20260423120015',
      'R|3|^^^PLT^Platelets|245|10*9/L|150-450|N||F||TECH01|20260423120000|20260423120015',
      'L|1|N',
    ].join('\r\n');

    it('detects LIS-2A protocol from H header', () => {
      const out = parseInstrumentPayload(sample);
      expect(out.protocol).toBe('lis2a');
    });

    it('extracts the accession from the O record', () => {
      const out = parseInstrumentPayload(sample);
      expect(out.results.every(r => r.accession === 'ACC-7788')).toBe(true);
    });

    it('parses three results with numeric values + units', () => {
      const out = parseInstrumentPayload(sample);
      expect(out.results).toHaveLength(3);
      const wbc = out.results.find(r => r.testCode === 'WBC')!;
      expect(wbc.numericValue).toBeCloseTo(7.4);
      expect(wbc.unit).toBe('10*9/L');
      expect(wbc.referenceRange).toBe('4.0-11.0');
    });

    it('captures the instrument id from the H record', () => {
      const out = parseInstrumentPayload(sample);
      expect(out.results[0].instrumentId).toBe('Sysmex');
    });

    it('warns when an R record arrives with no preceding O', () => {
      const malformed = [
        'H|\\^&|||Sysmex^XN-330|||||||P|1.0|20260423120000',
        'R|1|^^^WBC^White Blood Cell|7.4|10*9/L|4.0-11.0|N||F||TECH01|20260423120000|20260423120015',
      ].join('\r\n');
      const out = parseInstrumentPayload(malformed);
      expect(out.results).toHaveLength(0);
      expect(out.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('HL7 ORU^R01 parsing', () => {
    const sample = [
      'MSH|^~\\&|MINDRAY^BC-3000|JUBA-LAB|TAMAMHEALTH-LIS|JUBA-HOSP|20260423120000||ORU^R01|MSG-001|P|2.5',
      'PID|1||MRN-1042||Deng^Achol||19980312|F',
      'OBR|1|ORD-9988|ACC-9988|FBC^Full Blood Count|R|20260423115500|20260423120000',
      'OBX|1|NM|HGB^Hemoglobin||9.8|g/dL|12.0-16.0|L|||F',
      'OBX|2|NM|WBC^White Blood Cell||4.2|10*9/L|4.0-11.0|N|||F',
      'OBX|3|ST|MORPH^Morphology||Microcytic, hypochromic||||N|||F',
    ].join('\r');

    it('detects HL7 protocol from MSH header', () => {
      const out = parseInstrumentPayload(sample);
      expect(out.protocol).toBe('hl7');
    });

    it('parses numeric OBX with abnormal flag', () => {
      const out = parseInstrumentPayload(sample);
      const hgb = out.results.find(r => r.testCode === 'HGB')!;
      expect(hgb.numericValue).toBeCloseTo(9.8);
      expect(hgb.unit).toBe('g/dL');
      expect(hgb.abnormalFlag).toBe('L');
    });

    it('parses qualitative ST OBX as text value', () => {
      const out = parseInstrumentPayload(sample);
      const morph = out.results.find(r => r.testCode === 'MORPH')!;
      expect(morph.numericValue).toBeUndefined();
      expect(morph.textValue).toContain('Microcytic');
    });

    it('uses the OBR fillerOrderNumber as accession', () => {
      const out = parseInstrumentPayload(sample);
      expect(out.results.every(r => r.accession === 'ACC-9988')).toBe(true);
    });
  });

  it('returns unknown protocol on garbage input', () => {
    const out = parseInstrumentPayload('this is not a real instrument message');
    expect(out.protocol).toBe('unknown');
    expect(out.results).toHaveLength(0);
    expect(out.warnings.length).toBeGreaterThan(0);
  });
});
