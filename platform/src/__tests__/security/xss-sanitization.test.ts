/**
 * Tests for XSS sanitization in validation.ts
 * Ensures that user input is cleaned of dangerous HTML/JS injection vectors.
 */
import { validatePatientData, sanitizePayload } from '@/lib/validation';

describe('XSS Sanitization', () => {
  test('sanitizePayload strips script tags from strings', () => {
    const dirty = {
      firstName: '<script>alert("xss")</script>John',
      surname: 'Doe',
      notes: 'Normal text<script>document.cookie</script>',
    };
    const clean = sanitizePayload(dirty);
    expect(clean.firstName).toBe('John');
    expect(clean.notes).toBe('Normal text');
  });

  test('sanitizePayload strips event handlers', () => {
    const dirty = {
      name: 'John onmouseover="alert(1)"',
      description: 'Test onclick="steal()" text',
    };
    const clean = sanitizePayload(dirty);
    expect(clean.name).toBe('John');
    expect(clean.description).toBe('Test  text');
  });

  test('sanitizePayload strips javascript: protocol', () => {
    const dirty = {
      url: 'javascript:alert(1)',
      link: 'JAVASCRIPT:void(0)',
    };
    const clean = sanitizePayload(dirty);
    expect(clean.url).toBe('alert(1)');
    expect(clean.link).toBe('void(0)');
  });

  test('sanitizePayload preserves non-string values', () => {
    const data = {
      name: 'Valid Name',
      age: 25,
      isActive: true,
      tags: ['a', 'b'],
    };
    const clean = sanitizePayload(data);
    expect(clean.age).toBe(25);
    expect(clean.isActive).toBe(true);
    expect(clean.tags).toEqual(['a', 'b']);
  });

  test('validatePatientData strips control characters from names', () => {
    const errors = validatePatientData({
      firstName: 'Achol\x00\x01',
      surname: 'Deng\x7F',
      gender: 'Female',
      dateOfBirth: '1995-06-15',
      state: 'Central Equatoria',
    });
    // Should pass validation (control chars removed, valid data remains)
    expect(errors.firstName).toBeUndefined();
    expect(errors.surname).toBeUndefined();
  });

  test('validatePatientData rejects excessively long names', () => {
    const longName = 'A'.repeat(101);
    const errors = validatePatientData({
      firstName: longName,
      surname: 'Deng',
      gender: 'Female',
      dateOfBirth: '1995-06-15',
      state: 'Central Equatoria',
    });
    expect(errors.firstName).toBe('First name is too long');
  });
});
