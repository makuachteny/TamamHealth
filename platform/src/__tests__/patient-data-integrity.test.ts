/**
 * Patient data-integrity fixes from the July audit:
 *   KAN-16 — DOB compared as a calendar date; age derived, not stored-and-stale
 *   KAN-17 — one canonical gender enum across type / validator / DB
 */
import {
  validateDateOfBirth,
  normalizeGender,
  patientAgeInYears,
  validatePatientData,
  CANONICAL_GENDERS,
} from '@/lib/validation';

describe('validateDateOfBirth (KAN-16)', () => {
  test('accepts a past calendar date', () => {
    expect(validateDateOfBirth('1994-05-05')).toBeNull();
  });

  test('rejects a future calendar date', () => {
    const today = new Date(2026, 6, 27); // 27 Jul 2026, local
    expect(validateDateOfBirth('2026-07-28', today)).toMatch(/cannot be in the future/);
  });

  test('accepts TODAY — a newborn registered on the day of birth', () => {
    // The regression this exists for. `new Date('2026-07-27')` is UTC midnight;
    // compared against local now in Juba (UTC+2) it read as 2 hours in the
    // future for the first two hours of every day, and the registration was
    // rejected as a future date.
    const today = new Date(2026, 6, 27, 1, 30); // 01:30 local
    expect(validateDateOfBirth('2026-07-27', today)).toBeNull();
  });

  test('is timezone-independent at the day boundary', () => {
    // Same calendar date, any local time of day — always acceptable.
    for (const hour of [0, 1, 12, 23]) {
      const now = new Date(2026, 6, 27, hour, 0);
      expect(validateDateOfBirth('2026-07-27', now)).toBeNull();
    }
  });

  test('rejects malformed input instead of coercing it', () => {
    for (const bad of ['not-a-date', '27/07/2026', '2026-7-5', '20260727']) {
      expect(validateDateOfBirth(bad)).toMatch(/Invalid date of birth/);
    }
  });

  test('rejects impossible calendar days that Date would roll forward', () => {
    // new Date('2026-02-30') silently becomes 2 March.
    expect(validateDateOfBirth('2026-02-30')).toMatch(/Invalid/);
    expect(validateDateOfBirth('2026-04-31')).toMatch(/Invalid/);
    // A real leap day still passes.
    expect(validateDateOfBirth('2024-02-29')).toBeNull();
  });

  test('rejects an implausibly old date as a typo', () => {
    expect(validateDateOfBirth('1820-01-01')).toMatch(/Invalid/);
  });

  test('an empty value is not an error — DOB is optional when age is given', () => {
    expect(validateDateOfBirth('')).toBeNull();
  });
});

describe('age derivation (KAN-16)', () => {
  test('age comes from DOB when one exists, not from the stale stored estimate', () => {
    const bornIso = `${new Date().getFullYear() - 30}-01-01`;
    // estimatedAge deliberately wrong — DOB must win.
    expect(patientAgeInYears({ dateOfBirth: bornIso, estimatedAge: 4 })).toBe(30);
  });

  test('falls back to estimatedAge when there is no DOB', () => {
    expect(patientAgeInYears({ estimatedAge: 41 })).toBe(41);
  });

  test('returns undefined when neither is known, rather than guessing', () => {
    expect(patientAgeInYears({})).toBeUndefined();
  });
});

describe('normalizeGender (KAN-17)', () => {
  test('canonicalises casing so storage holds one spelling', () => {
    for (const v of ['male', 'MALE', ' Male ', 'mAlE']) {
      expect(normalizeGender(v)).toBe('Male');
    }
    expect(normalizeGender('female')).toBe('Female');
  });

  test('rejects values the TypeScript type cannot represent', () => {
    // 'unknown' was accepted by the old validator and then unstorable.
    expect(normalizeGender('unknown')).toBeNull();
    expect(normalizeGender('other')).toBeNull();
    expect(normalizeGender('')).toBeNull();
    expect(normalizeGender(undefined)).toBeNull();
    expect(normalizeGender(42)).toBeNull();
  });

  test('the canonical set matches what the type declares', () => {
    expect([...CANONICAL_GENDERS]).toEqual(['Male', 'Female']);
  });
});

describe('validatePatientData wires both fixes', () => {
  const base = {
    firstName: 'Achol', surname: 'Deng', phone: '+211912345678',
    state: 'Central Equatoria', county: 'Juba', primaryLanguage: 'Juba Arabic',
    nokName: 'Mary', nokRelationship: 'Sister', nokPhone: '+211912000099',
  };

  test('rejects an unrepresentable gender', () => {
    expect(validatePatientData({ ...base, gender: 'unknown', estimatedAge: 30 }).gender)
      .toBe('Gender is required');
  });

  test('accepts a lowercase gender from a form or import', () => {
    expect(validatePatientData({ ...base, gender: 'female', estimatedAge: 30 }).gender)
      .toBeUndefined();
  });

  test('surfaces a malformed DOB', () => {
    expect(validatePatientData({ ...base, gender: 'Female', dateOfBirth: '27/07/1994' }).dateOfBirth)
      .toMatch(/Invalid date of birth/);
  });
});
