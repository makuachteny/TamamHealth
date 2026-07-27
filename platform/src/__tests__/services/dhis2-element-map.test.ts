/**
 * DHIS2 dataElement UID mapping (KAN-57 / MED-07).
 */
import {
  isDhis2Uid,
  loadElementMap,
  validateDataElements,
  resolveDataElement,
  _resetElementMapCache,
  DHIS2_CONCEPTS,
} from '@/lib/services/dhis2-element-map';

afterEach(() => {
  delete process.env.DHIS2_ELEMENT_MAP;
  delete process.env.NEXT_PUBLIC_DHIS2_ELEMENT_MAP;
  _resetElementMapCache();
});

describe('isDhis2Uid', () => {
  test('accepts an 11-char UID starting with a letter', () => {
    expect(isDhis2Uid('Uvn6LCg7dVU')).toBe(true);
    expect(isDhis2Uid('s46m5MS0hxu')).toBe(true);
  });

  test('rejects concept names and wrong-length values', () => {
    expect(isDhis2Uid('TOTAL_HOSPITALS')).toBe(false);
    expect(isDhis2Uid('IMM_BCG_COMPLETED')).toBe(false);
    expect(isDhis2Uid('short')).toBe(false);
    expect(isDhis2Uid('Uvn6LCg7dVUx')).toBe(false); // 12 chars
    expect(isDhis2Uid('1vn6LCg7dVU')).toBe(false); // leading digit
  });
});

describe('loadElementMap', () => {
  test('returns an empty map when unset — the pass-through default', () => {
    expect(loadElementMap({})).toEqual({ map: {}, configErrors: [] });
  });

  test('parses a valid map', () => {
    const r = loadElementMap({ DHIS2_ELEMENT_MAP: '{"TOTAL_HOSPITALS":"Uvn6LCg7dVU"}' });
    expect(r.map).toEqual({ TOTAL_HOSPITALS: 'Uvn6LCg7dVU' });
    expect(r.configErrors).toEqual([]);
  });

  test('reports malformed JSON without throwing', () => {
    const r = loadElementMap({ DHIS2_ELEMENT_MAP: '{not json' });
    expect(r.map).toEqual({});
    expect(r.configErrors[0]).toMatch(/not valid JSON/);
  });

  test('drops and reports an entry whose UID is malformed', () => {
    const r = loadElementMap({ DHIS2_ELEMENT_MAP: '{"TOTAL_HOSPITALS":"NOT_A_UID"}' });
    expect(r.map).toEqual({});
    expect(r.configErrors[0]).toMatch(/is not a valid DHIS2 UID/);
  });

  test('flags a concept name that this export never emits (typo guard)', () => {
    const r = loadElementMap({ DHIS2_ELEMENT_MAP: '{"TOTAL_HOSPITAL":"Uvn6LCg7dVU"}' });
    expect(r.map).toEqual({});
    expect(r.configErrors[0]).toMatch(/does not match any concept/);
  });

  test('one bad entry does not discard the good ones', () => {
    const r = loadElementMap({
      DHIS2_ELEMENT_MAP: '{"TOTAL_HOSPITALS":"Uvn6LCg7dVU","TOTAL_BEDS":"bad"}',
    });
    expect(r.map).toEqual({ TOTAL_HOSPITALS: 'Uvn6LCg7dVU' });
    expect(r.configErrors).toHaveLength(1);
  });

  test('NEXT_PUBLIC_ variant is honoured for the browser export UI', () => {
    const r = loadElementMap({ NEXT_PUBLIC_DHIS2_ELEMENT_MAP: '{"TOTAL_BEDS":"Uvn6LCg7dVU"}' });
    expect(r.map).toEqual({ TOTAL_BEDS: 'Uvn6LCg7dVU' });
  });
});

describe('resolveDataElement', () => {
  test('passes concept names through unchanged when unconfigured', () => {
    expect(resolveDataElement('TOTAL_HOSPITALS')).toBe('TOTAL_HOSPITALS');
  });

  test('maps a configured concept to its UID', () => {
    process.env.DHIS2_ELEMENT_MAP = '{"TOTAL_HOSPITALS":"Uvn6LCg7dVU"}';
    _resetElementMapCache();
    expect(resolveDataElement('TOTAL_HOSPITALS')).toBe('Uvn6LCg7dVU');
    expect(resolveDataElement('TOTAL_BEDS')).toBe('TOTAL_BEDS');
  });
});

describe('validateDataElements', () => {
  test('flags concept names as rows DHIS2 will reject', () => {
    const v = validateDataElements(['TOTAL_HOSPITALS', 'IMM_BCG_COMPLETED']);
    expect(v.valid).toBe(false);
    expect(v.unmappedConcepts).toEqual(['IMM_BCG_COMPLETED', 'TOTAL_HOSPITALS']);
    expect(v.warning).toMatch(/DHIS2 will reject these rows/);
  });

  test('passes when every element is a real UID', () => {
    const v = validateDataElements(['Uvn6LCg7dVU', 's46m5MS0hxu']);
    expect(v.valid).toBe(true);
    expect(v.unmappedConcepts).toEqual([]);
    expect(v.warning).toBe('');
  });

  test('deduplicates repeated concepts', () => {
    const v = validateDataElements(['TOTAL_BEDS', 'TOTAL_BEDS', 'TOTAL_BEDS']);
    expect(v.unmappedConcepts).toEqual(['TOTAL_BEDS']);
  });

  test('surfaces config errors alongside unmapped concepts', () => {
    process.env.DHIS2_ELEMENT_MAP = '{"TOTAL_HOSPITALS":"bad"}';
    _resetElementMapCache();
    const v = validateDataElements(['TOTAL_HOSPITALS']);
    expect(v.valid).toBe(false);
    expect(v.configErrors[0]).toMatch(/not a valid DHIS2 UID/);
  });
});

describe('DHIS2_CONCEPTS catalogue', () => {
  test('has no duplicates', () => {
    expect(new Set(DHIS2_CONCEPTS).size).toBe(DHIS2_CONCEPTS.length);
  });

  test('every concept is upper snake case, never already a UID', () => {
    for (const c of DHIS2_CONCEPTS) {
      expect(c).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(isDhis2Uid(c)).toBe(false);
    }
  });
});
