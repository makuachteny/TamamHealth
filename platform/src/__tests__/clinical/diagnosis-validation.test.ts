/**
 * ICD-11 diagnosis validation (KAN-49 / HIGH-18) and the notifiable-code
 * detection that drives auto-alerting (KAN-31 / CRIT-10).
 */
import {
  validateDiagnosisCodes,
  validateCauseOfDeathCode,
  isWellFormedIcd11,
  lookupIcd11,
} from '@/lib/clinical/diagnosis-validation';

const dx = (overrides: Record<string, unknown> = {}) => ({
  name: 'Malaria due to Plasmodium falciparum',
  icd11Code: '1A40',
  certainty: 'confirmed' as const,
  ...overrides,
});

describe('isWellFormedIcd11', () => {
  test('accepts real ICD-11 MMS stem and dotted codes', () => {
    expect(isWellFormedIcd11('1A40')).toBe(true);
    expect(isWellFormedIcd11('DA90')).toBe(true);
    expect(isWellFormedIcd11('1C62.Z')).toBe(true);
  });

  test('rejects free text', () => {
    expect(isWellFormedIcd11('malaria')).toBe(false);
    expect(isWellFormedIcd11('not a code at all')).toBe(false);
    expect(isWellFormedIcd11('')).toBe(false);
  });
});

describe('facility-level checking', () => {
  test('warns when a confirmed diagnosis outranks the facility', () => {
    // TB of lung is minLevel 'county'; a boma BHW should not confirm it.
    const r = validateDiagnosisCodes(
      [dx({ name: 'Tuberculosis of lung', icd11Code: '1B10' })],
      { facilityLevel: 'boma' },
    );
    expect(r.aboveFacilityLevel).toEqual(['1B10']);
    expect(r.warnings[0]).toMatch(/normally confirmed at county level/);
    // Advisory only — the clinician can still record it.
    expect(r.errors).toEqual([]);
  });

  test('does not warn for a SUSPECTED diagnosis above the facility level', () => {
    // Recording a suspicion and referring is exactly the right behaviour.
    const r = validateDiagnosisCodes(
      [dx({ name: 'Tuberculosis of lung', icd11Code: '1B10', certainty: 'suspected' })],
      { facilityLevel: 'boma' },
    );
    expect(r.aboveFacilityLevel).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  test('does not warn when the facility meets the level', () => {
    const r = validateDiagnosisCodes(
      [dx({ name: 'Tuberculosis of lung', icd11Code: '1B10' })],
      { facilityLevel: 'state' },
    );
    expect(r.aboveFacilityLevel).toEqual([]);
  });

  test('skips the level check entirely when facility level is unknown', () => {
    const r = validateDiagnosisCodes([dx({ icd11Code: '1B10' })]);
    expect(r.aboveFacilityLevel).toEqual([]);
  });
});

describe('notifiable disease detection', () => {
  test('collects notifiable codes for alerting', () => {
    const r = validateDiagnosisCodes([
      dx({ icd11Code: '1A00', name: 'Cholera' }),
      dx({ icd11Code: '1E30', name: 'Measles' }),
    ]);
    expect(r.notifiableCodes).toEqual(['1A00', '1E30']);
  });

  test('a non-notifiable code raises nothing', () => {
    // Intestinal worms carries no notifiable flag.
    const r = validateDiagnosisCodes([dx({ icd11Code: 'DA70', name: 'Intestinal worms' })]);
    expect(r.notifiableCodes).toEqual([]);
  });
});

describe('cause-of-death codes on living patients', () => {
  test('malaria is NOT blocked despite carrying the causeOfDeath flag', () => {
    // The commonest diagnosis in South Sudan. Blocking it would be a
    // catastrophic false positive — see the module header.
    const r = validateDiagnosisCodes([dx()], { facilityLevel: 'boma' });
    expect(r.errors).toEqual([]);
    expect(r.causeOfDeathNotes).toEqual(['1A40']);
  });
});

describe('diagnosis presence and shape', () => {
  test('requireDiagnosis rejects an empty list', () => {
    expect(validateDiagnosisCodes([], { requireDiagnosis: true }).errors[0])
      .toMatch(/At least one diagnosis/);
    expect(validateDiagnosisCodes(undefined, { requireDiagnosis: true }).errors[0])
      .toMatch(/At least one diagnosis/);
  });

  test('requireDiagnosis rejects a list of blank-named rows', () => {
    const r = validateDiagnosisCodes([{ name: '   ' }], { requireDiagnosis: true });
    expect(r.errors[0]).toMatch(/At least one diagnosis/);
  });

  test('passes when at least one diagnosis is named', () => {
    expect(validateDiagnosisCodes([dx()], { requireDiagnosis: true }).errors).toEqual([]);
  });

  test('rejects a coded row with no name', () => {
    const r = validateDiagnosisCodes([{ icd11Code: '1A40' }]);
    expect(r.errors[0]).toMatch(/has no name/);
  });

  test('rejects a malformed code', () => {
    const r = validateDiagnosisCodes([dx({ icd11Code: 'not-a-code' })]);
    expect(r.errors[0]).toMatch(/not a valid ICD-11 code format/);
  });

  test('free-text diagnosis with no code is allowed', () => {
    expect(validateDiagnosisCodes([{ name: 'Fever of unknown origin' }]).errors).toEqual([]);
  });

  test('falls back to the legacy icd10Code field', () => {
    const r = validateDiagnosisCodes([{ name: 'Cholera', icd10Code: '1A00', certainty: 'confirmed' }]);
    expect(r.notifiableCodes).toEqual(['1A00']);
  });

  test('warns on a well-formed code missing from the catalogue', () => {
    const r = validateDiagnosisCodes([dx({ icd11Code: '9Z99' })]);
    expect(r.unknownCodes).toEqual(['9Z99']);
    expect(r.warnings[0]).toMatch(/not in the South Sudan ICD-11 reference list/);
    expect(r.errors).toEqual([]);
  });
});

describe('validateCauseOfDeathCode', () => {
  test('accepts a catalogued cause-of-death code', () => {
    expect(validateCauseOfDeathCode('1A40')).toEqual({ errors: [], warnings: [] });
  });

  test('rejects a malformed code outright', () => {
    expect(validateCauseOfDeathCode('cholera')!.errors[0]).toMatch(/not a valid ICD-11 code format/);
  });

  test('warns on a well-formed code outside the catalogue', () => {
    expect(validateCauseOfDeathCode('9Z99').warnings[0]).toMatch(/not in the South Sudan ICD-11 reference list/);
  });

  test('warns when the code is not normally a cause of death', () => {
    // Intestinal worms has no causeOfDeath flag.
    expect(validateCauseOfDeathCode('DA70').warnings[0]).toMatch(/not normally used for cause-of-death/);
  });

  test('an empty code is not an error — the field is optional', () => {
    expect(validateCauseOfDeathCode(undefined)).toEqual({ errors: [], warnings: [] });
    expect(validateCauseOfDeathCode('')).toEqual({ errors: [], warnings: [] });
  });
});

describe('lookupIcd11', () => {
  test('is case-insensitive and trims', () => {
    expect(lookupIcd11(' da90 ')?.code).toBe('DA90');
  });
});
