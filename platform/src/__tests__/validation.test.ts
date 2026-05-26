/**
 * Tests for input validation functions
 */
import {
  validatePatientData,
  validateVitalSigns,
  validateMedicalRecord,
  validateAttachment,
  validatePrescription,
  sanitizePayload,
  ValidationError,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_FILE_TYPES,
} from '../lib/validation';

describe('validation', () => {
  describe('validatePatientData', () => {
    const validPatient = {
      firstName: 'John',
      surname: 'Deng',
      gender: 'male',
      dateOfBirth: '1990-01-15',
      state: 'Central Equatoria',
    };

    test('returns no errors for valid patient data', () => {
      const errors = validatePatientData(validPatient);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('requires firstName', () => {
      const errors = validatePatientData({ ...validPatient, firstName: '' });
      expect(errors.firstName).toBeDefined();
    });

    test('requires surname', () => {
      const errors = validatePatientData({ ...validPatient, surname: '' });
      expect(errors.surname).toBeDefined();
    });

    test('rejects too-long firstName', () => {
      const errors = validatePatientData({ ...validPatient, firstName: 'A'.repeat(101) });
      expect(errors.firstName).toContain('too long');
    });

    test('rejects too-long surname', () => {
      const errors = validatePatientData({ ...validPatient, surname: 'A'.repeat(101) });
      expect(errors.surname).toContain('too long');
    });

    test('rejects too-long middle name', () => {
      const errors = validatePatientData({ ...validPatient, middleName: 'A'.repeat(101) });
      expect(errors.middleName).toBeDefined();
    });

    test('rejects too-long maiden name', () => {
      const errors = validatePatientData({ ...validPatient, maidenName: 'A'.repeat(101) });
      expect(errors.maidenName).toBeDefined();
    });

    test('validates gender', () => {
      const errors = validatePatientData({ ...validPatient, gender: 'invalid' });
      expect(errors.gender).toBeDefined();
    });

    test('accepts lowercase gender values', () => {
      const errors = validatePatientData({ ...validPatient, gender: 'female' });
      expect(errors.gender).toBeUndefined();
    });

    test('requires dateOfBirth or estimatedAge', () => {
      const noDate = { firstName: 'John', surname: 'Deng', gender: 'male', state: 'Central Equatoria' };
      const errors = validatePatientData(noDate);
      expect(errors.dateOfBirth).toBeDefined();
    });

    test('accepts estimatedAge instead of dateOfBirth', () => {
      const noDate = { firstName: 'John', surname: 'Deng', gender: 'male', state: 'Central Equatoria', estimatedAge: 25 };
      const errors = validatePatientData(noDate);
      expect(errors.dateOfBirth).toBeUndefined();
    });

    test('rejects invalid date format', () => {
      const errors = validatePatientData({ ...validPatient, dateOfBirth: 'not-a-date' });
      expect(errors.dateOfBirth).toBeDefined();
    });

    test('rejects future date of birth', () => {
      const errors = validatePatientData({ ...validPatient, dateOfBirth: '2099-01-01' });
      expect(errors.dateOfBirth).toContain('future');
    });

    test('rejects estimated age below 0', () => {
      const errors = validatePatientData({ ...validPatient, estimatedAge: -1, dateOfBirth: undefined });
      expect(errors.estimatedAge).toBeDefined();
    });

    test('rejects estimated age above 150', () => {
      const errors = validatePatientData({ ...validPatient, estimatedAge: 151, dateOfBirth: undefined });
      expect(errors.estimatedAge).toBeDefined();
    });

    test('rejects non-numeric estimated age', () => {
      const errors = validatePatientData({ ...validPatient, estimatedAge: 'not-a-number', dateOfBirth: undefined });
      expect(errors.estimatedAge).toBeDefined();
    });

    test('validates phone format', () => {
      const errors = validatePatientData({ ...validPatient, phone: 'not-a-phone' });
      expect(errors.phone).toBeDefined();
    });

    test('accepts valid phone', () => {
      const errors = validatePatientData({ ...validPatient, phone: '+211912345678' });
      expect(errors.phone).toBeUndefined();
    });

    test('accepts valid phone with spaces', () => {
      const errors = validatePatientData({ ...validPatient, phone: '+211 912 345 678' });
      expect(errors.phone).toBeUndefined();
    });

    test('accepts empty phone field', () => {
      const errors = validatePatientData({ ...validPatient, phone: '' });
      expect(errors.phone).toBeUndefined();
    });

    test('validates alternative phone format', () => {
      const errors = validatePatientData({ ...validPatient, altPhone: 'invalid' });
      expect(errors.altPhone).toBeDefined();
    });

    test('validates whatsapp phone format', () => {
      const errors = validatePatientData({ ...validPatient, whatsapp: 'invalid' });
      expect(errors.whatsapp).toBeDefined();
    });

    test('validates next-of-kin phone format', () => {
      const errors = validatePatientData({ ...validPatient, nokPhone: 'invalid' });
      expect(errors.nokPhone).toBeDefined();
    });

    test('requires state', () => {
      const errors = validatePatientData({ ...validPatient, state: '' });
      expect(errors.state).toBeDefined();
    });

    test('validates boma code format - empty code after sanitization', () => {
      const errors = validatePatientData({ ...validPatient, bomaCode: '!!!!' });
      expect(errors.bomaCode).toBeDefined();
    });

    test('validates boma code format - too long', () => {
      const errors = validatePatientData({ ...validPatient, bomaCode: 'ABCDE' });
      expect(errors.bomaCode).toBeDefined();
    });

    test('accepts valid boma code', () => {
      const errors = validatePatientData({ ...validPatient, bomaCode: 'ABC1' });
      expect(errors.bomaCode).toBeUndefined();
    });

    test('rejects address that is too long', () => {
      const errors = validatePatientData({ ...validPatient, address: 'A'.repeat(501) });
      expect(errors.address).toBeDefined();
    });

    test('accepts address with valid length', () => {
      const errors = validatePatientData({ ...validPatient, address: 'A'.repeat(500) });
      expect(errors.address).toBeUndefined();
    });

    test('rejects national ID that is too short', () => {
      const errors = validatePatientData({ ...validPatient, nationalId: 'AB' });
      expect(errors.nationalId).toBeDefined();
    });

    test('rejects national ID that is too long', () => {
      const errors = validatePatientData({ ...validPatient, nationalId: 'A'.repeat(31) });
      expect(errors.nationalId).toBeDefined();
    });

    test('accepts valid national ID', () => {
      const errors = validatePatientData({ ...validPatient, nationalId: 'ABC123' });
      expect(errors.nationalId).toBeUndefined();
    });

    test('accepts national ID after trimming spaces', () => {
      const errors = validatePatientData({ ...validPatient, nationalId: '  ABC123  ' });
      expect(errors.nationalId).toBeUndefined();
    });
  });

  describe('validateVitalSigns', () => {
    test('returns no errors for valid vitals', () => {
      const errors = validateVitalSigns({
        temperature: 37.0,
        systolicBP: 120,
        diastolicBP: 80,
        pulse: 72,
        respiratoryRate: 16,
        oxygenSaturation: 98,
        weight: 70,
        height: 170,
      });
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('rejects temperature out of range', () => {
      expect(validateVitalSigns({ temperature: 50 }).temperature).toBeDefined();
      expect(validateVitalSigns({ temperature: 20 }).temperature).toBeDefined();
    });

    test('rejects invalid blood pressure', () => {
      expect(validateVitalSigns({ systolicBP: 400 }).systolicBP).toBeDefined();
      expect(validateVitalSigns({ diastolicBP: 5 }).diastolicBP).toBeDefined();
    });

    test('rejects invalid pulse', () => {
      expect(validateVitalSigns({ pulse: 10 }).pulse).toBeDefined();
      expect(validateVitalSigns({ pulse: 300 }).pulse).toBeDefined();
    });

    test('rejects invalid oxygen saturation', () => {
      expect(validateVitalSigns({ oxygenSaturation: 25 }).oxygenSaturation).toBeDefined();
      expect(validateVitalSigns({ oxygenSaturation: 105 }).oxygenSaturation).toBeDefined();
    });

    test('rejects invalid respiratory rate - too low', () => {
      expect(validateVitalSigns({ respiratoryRate: 3 }).respiratoryRate).toBeDefined();
    });

    test('rejects invalid respiratory rate - too high', () => {
      expect(validateVitalSigns({ respiratoryRate: 61 }).respiratoryRate).toBeDefined();
    });

    test('rejects invalid weight - too low', () => {
      expect(validateVitalSigns({ weight: 0.4 }).weight).toBeDefined();
    });

    test('rejects invalid weight - too high', () => {
      expect(validateVitalSigns({ weight: 301 }).weight).toBeDefined();
    });

    test('rejects invalid height - too low', () => {
      expect(validateVitalSigns({ height: 19 }).height).toBeDefined();
    });

    test('rejects invalid height - too high', () => {
      expect(validateVitalSigns({ height: 251 }).height).toBeDefined();
    });

    test('rejects non-numeric weight', () => {
      expect(validateVitalSigns({ weight: 'not-a-number' }).weight).toBeDefined();
    });

    test('rejects non-numeric height', () => {
      expect(validateVitalSigns({ height: 'not-a-number' }).height).toBeDefined();
    });

    test('rejects non-numeric respiratory rate', () => {
      expect(validateVitalSigns({ respiratoryRate: 'not-a-number' }).respiratoryRate).toBeDefined();
    });

    test('accepts valid systolic BP using systolic alias', () => {
      const errors = validateVitalSigns({ systolic: 120 });
      expect(errors.systolicBP).toBeUndefined();
    });

    test('accepts valid diastolic BP using diastolic alias', () => {
      const errors = validateVitalSigns({ diastolic: 80 });
      expect(errors.diastolicBP).toBeUndefined();
    });

    test('allows empty vitals (all optional)', () => {
      const errors = validateVitalSigns({});
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('validateMedicalRecord', () => {
    test('requires patientId', () => {
      const errors = validateMedicalRecord({ hospitalId: 'hosp-001', chiefComplaint: 'Fever' });
      expect(errors.patientId).toBeDefined();
    });

    test('requires hospitalId', () => {
      const errors = validateMedicalRecord({ patientId: 'pat-001', chiefComplaint: 'Fever' });
      expect(errors.hospitalId).toBeDefined();
    });

    test('requires chiefComplaint with min length', () => {
      const errors = validateMedicalRecord({ patientId: 'pat-001', hospitalId: 'hosp-001', chiefComplaint: 'Ab' });
      expect(errors.chiefComplaint).toBeDefined();
    });

    test('validates nested vital signs', () => {
      const errors = validateMedicalRecord({
        patientId: 'pat-001',
        hospitalId: 'hosp-001',
        chiefComplaint: 'Fever and chills',
        vitalSigns: { temperature: 55 },
      });
      expect(errors['vitalSigns.temperature']).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    test('creates error with field details', () => {
      const err = new ValidationError({ name: 'Required', age: 'Must be positive' });
      expect(err.name).toBe('ValidationError');
      expect(err.fields.name).toBe('Required');
      expect(err.fields.age).toBe('Must be positive');
      expect(err.message).toContain('Required');
    });
  });

  describe('validateAttachment', () => {
    test('accepts valid JPEG file', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts valid PNG file', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
    });

    test('accepts valid PDF file', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
    });

    test('accepts DICOM files with application/dicom type', () => {
      const file = new File(['test'], 'test.dcm', { type: 'application/dicom' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
    });

    test('accepts DICOM files with image/dicom type', () => {
      const file = new File(['test'], 'test.dcm', { type: 'image/dicom' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
    });

    test('accepts .dcm files by extension even with unknown type', () => {
      const file = new File(['test'], 'test.dcm', { type: '' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(true);
    });

    test('rejects file exceeding 5MB', () => {
      const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 5MB');
    });

    test('rejects unsupported file type', () => {
      const file = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unsupported type');
    });

    test('includes file size in error message', () => {
      const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const result = validateAttachment(file);
      expect(result.error).toMatch(/\d+\.\d+MB/);
    });

    test('includes file name in error message', () => {
      const file = new File(['test'], 'myfile.exe', { type: 'application/x-msdownload' });
      const result = validateAttachment(file);
      expect(result.error).toContain('myfile.exe');
    });

    test('handles files with empty type field', () => {
      const file = new File(['test'], 'document.txt', { type: '' });
      const result = validateAttachment(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unknown');
    });
  });

  describe('sanitizePayload', () => {
    test('preserves string values', () => {
      const data = { name: 'John', age: 25 };
      const result = sanitizePayload(data);
      expect(result.name).toBe('John');
      expect(result.age).toBe(25);
    });

    test('sanitizes malicious strings', () => {
      const data = { html: '<script>alert("xss")</script>' };
      const result = sanitizePayload(data);
      expect(result.html).not.toContain('<script>');
    });

    test('removes control characters from strings', () => {
      const data = { text: 'hello\x00world' };
      const result = sanitizePayload(data);
      expect(result.text).not.toContain('\x00');
    });

    test('removes event handlers from strings', () => {
      const data = { html: 'onclick="alert(1)" onload="bad()"' };
      const result = sanitizePayload(data);
      expect(result.html).not.toContain('onclick');
      expect(result.html).not.toContain('onload');
    });

    test('removes javascript: protocol from strings', () => {
      const data = { link: 'javascript:void(0)' };
      const result = sanitizePayload(data);
      expect(result.link).not.toContain('javascript:');
    });

    test('ignores non-string values', () => {
      const data = { num: 42, bool: true, obj: { nested: 'value' } };
      const result = sanitizePayload(data);
      expect(result.num).toBe(42);
      expect(result.bool).toBe(true);
      expect(result.obj).toEqual({ nested: 'value' });
    });

    test('preserves empty strings', () => {
      const data = { empty: '' };
      const result = sanitizePayload(data);
      expect(result.empty).toBe('');
    });

    test('trims whitespace from strings', () => {
      const data = { text: '  hello world  ' };
      const result = sanitizePayload(data);
      expect(result.text).toBe('hello world');
    });

    test('does not mutate original data', () => {
      const data = { name: '<script>test</script>' };
      const original = { ...data };
      sanitizePayload(data);
      expect(data).toEqual(original);
    });
  });

  describe('validatePrescription', () => {
    test('requires medication', () => {
      const errors = validatePrescription({
        dose: '500mg',
        frequency: 'twice daily',
        patientId: 'pat-001',
      });
      expect(errors.medication).toBeDefined();
    });

    test('requires dose', () => {
      const errors = validatePrescription({
        medication: 'Aspirin',
        frequency: 'twice daily',
        patientId: 'pat-001',
      });
      expect(errors.dose).toBeDefined();
    });

    test('requires frequency', () => {
      const errors = validatePrescription({
        medication: 'Aspirin',
        dose: '500mg',
        patientId: 'pat-001',
      });
      expect(errors.frequency).toBeDefined();
    });

    test('requires patientId', () => {
      const errors = validatePrescription({
        medication: 'Aspirin',
        dose: '500mg',
        frequency: 'twice daily',
      });
      expect(errors.patientId).toBeDefined();
    });

    test('rejects empty medication string', () => {
      const errors = validatePrescription({
        medication: '   ',
        dose: '500mg',
        frequency: 'twice daily',
        patientId: 'pat-001',
      });
      expect(errors.medication).toBeDefined();
    });

    test('rejects empty dose string', () => {
      const errors = validatePrescription({
        medication: 'Aspirin',
        dose: '   ',
        frequency: 'twice daily',
        patientId: 'pat-001',
      });
      expect(errors.dose).toBeDefined();
    });

    test('rejects empty frequency string', () => {
      const errors = validatePrescription({
        medication: 'Aspirin',
        dose: '500mg',
        frequency: '   ',
        patientId: 'pat-001',
      });
      expect(errors.frequency).toBeDefined();
    });

    test('accepts valid prescription', () => {
      const errors = validatePrescription({
        medication: 'Aspirin',
        dose: '500mg',
        frequency: 'twice daily',
        patientId: 'pat-001',
      });
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('constants', () => {
    test('MAX_FILE_SIZE_BYTES is 5MB', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    test('ALLOWED_FILE_TYPES includes common medical formats', () => {
      expect(ALLOWED_FILE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_FILE_TYPES).toContain('image/png');
      expect(ALLOWED_FILE_TYPES).toContain('application/pdf');
      expect(ALLOWED_FILE_TYPES).toContain('application/dicom');
    });
  });
});
