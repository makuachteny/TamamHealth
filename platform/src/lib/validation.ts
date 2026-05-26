// Input validation for patient and medical record data

// File upload constraints
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_TRANSFER_PACKAGE_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/dicom',
  'image/dicom',
];

export function validateAttachment(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File "${file.name}" exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)` };
  }
  if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.dcm')) {
    return { valid: false, error: `File "${file.name}" has unsupported type (${file.type || 'unknown'}). Allowed: JPEG, PNG, GIF, WebP, PDF, DICOM` };
  }
  return { valid: true };
}

export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super(Object.values(fields).join(', '));
    this.name = 'ValidationError';
  }
}

/**
 * Sanitize a string for safe storage: strip control characters and
 * HTML/script injection vectors. This is defense-in-depth — the
 * application uses React (which auto-escapes on render), but we
 * also sanitize at the data layer to prevent stored XSS if raw
 * values are ever rendered outside React.
 */
function sanitizeString(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\x00-\x1F\x7F]/g, '')     // Control chars
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Script tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')                       // Event handlers
    .replace(/javascript:/gi, '')                                        // JS protocol
    .trim();
}

/**
 * Deep-sanitize all string values in a flat object.
 * Used by API routes to clean incoming JSON payloads.
 */
export function sanitizePayload<T extends Record<string, unknown>>(data: T): T {
  const cleaned = { ...data } as Record<string, unknown>;
  for (const key of Object.keys(cleaned)) {
    if (typeof cleaned[key] === 'string') {
      cleaned[key] = sanitizeString(cleaned[key]);
    }
  }
  return cleaned as T;
}

function validatePhone(value: unknown, fieldName: string): string | null {
  if (!value || typeof value !== 'string') return null;
  const phone = value.replace(/\s/g, '');
  if (phone.length > 0 && !/^\+?[\d-]{7,15}$/.test(phone)) {
    return `Invalid ${fieldName} format`;
  }
  return null;
}

export function validatePatientData(data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};

  const firstName = sanitizeString(data.firstName);
  if (!firstName || firstName.length < 1) {
    errors.firstName = 'First name is required';
  } else if (firstName.length > 100) {
    errors.firstName = 'First name is too long';
  }

  const surname = sanitizeString(data.surname);
  if (!surname || surname.length < 1) {
    errors.surname = 'Surname is required';
  } else if (surname.length > 100) {
    errors.surname = 'Surname is too long';
  }

  // Optional name fields — validate length when provided
  const middleName = sanitizeString(data.middleName);
  if (middleName && middleName.length > 100) {
    errors.middleName = 'Middle name is too long';
  }
  const maidenName = sanitizeString(data.maidenName);
  if (maidenName && maidenName.length > 100) {
    errors.maidenName = 'Maiden name is too long';
  }

  if (!data.gender || !['male', 'female', 'unknown'].includes((data.gender as string).toLowerCase())) {
    errors.gender = 'Gender is required';
  }

  if (!data.dateOfBirth && !data.estimatedAge) {
    errors.dateOfBirth = 'Date of birth or estimated age is required';
  }

  if (data.dateOfBirth) {
    const dob = new Date(data.dateOfBirth as string);
    if (isNaN(dob.getTime())) {
      errors.dateOfBirth = 'Invalid date of birth';
    } else if (dob > new Date()) {
      errors.dateOfBirth = 'Date of birth cannot be in the future';
    }
  }

  // Validate estimated age range
  if (data.estimatedAge !== undefined && data.estimatedAge !== null) {
    const age = Number(data.estimatedAge);
    if (isNaN(age) || age < 0 || age > 150) {
      errors.estimatedAge = 'Estimated age must be between 0 and 150';
    }
  }

  // Validate all phone fields
  const phoneErr = validatePhone(data.phone, 'phone number');
  if (phoneErr) errors.phone = phoneErr;
  const altPhoneErr = validatePhone(data.altPhone, 'alternative phone number');
  if (altPhoneErr) errors.altPhone = altPhoneErr;
  const whatsappErr = validatePhone(data.whatsapp, 'WhatsApp number');
  if (whatsappErr) errors.whatsapp = whatsappErr;
  const nokPhoneErr = validatePhone(data.nokPhone, 'next-of-kin phone number');
  if (nokPhoneErr) errors.nokPhone = nokPhoneErr;

  if (!data.state || typeof data.state !== 'string') {
    errors.state = 'State is required';
  }

  // Validate boma code format when provided
  if (data.bomaCode && typeof data.bomaCode === 'string') {
    const code = data.bomaCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length === 0 || code.length > 4) {
      errors.bomaCode = 'Boma code must be 1-4 alphanumeric characters';
    }
  }

  // Validate address length
  if (data.address && typeof data.address === 'string' && data.address.length > 500) {
    errors.address = 'Address is too long (max 500 characters)';
  }

  // Validate national ID format when provided
  if (data.nationalId && typeof data.nationalId === 'string') {
    const nid = data.nationalId.trim();
    if (nid.length > 0 && nid.length < 3) {
      errors.nationalId = 'National ID is too short';
    } else if (nid.length > 30) {
      errors.nationalId = 'National ID is too long';
    }
  }

  return errors;
}

export function validateVitalSigns(vitals: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};

  const temp = Number(vitals.temperature);
  if (vitals.temperature && !isNaN(temp)) {
    if (temp < 25 || temp > 45) {
      errors.temperature = 'Temperature must be between 25-45°C';
    }
  }

  if (vitals.systolicBP || vitals.systolic) {
    const sys = Number(vitals.systolicBP || vitals.systolic);
    if (isNaN(sys) || sys < 40 || sys > 300) {
      errors.systolicBP = 'Systolic BP must be between 40-300 mmHg';
    }
  }

  if (vitals.diastolicBP || vitals.diastolic) {
    const dia = Number(vitals.diastolicBP || vitals.diastolic);
    if (isNaN(dia) || dia < 20 || dia > 200) {
      errors.diastolicBP = 'Diastolic BP must be between 20-200 mmHg';
    }
  }

  if (vitals.pulse) {
    const pulse = Number(vitals.pulse);
    if (isNaN(pulse) || pulse < 20 || pulse > 250) {
      errors.pulse = 'Pulse must be between 20-250 bpm';
    }
  }

  if (vitals.respiratoryRate) {
    const rr = Number(vitals.respiratoryRate);
    if (isNaN(rr) || rr < 4 || rr > 60) {
      errors.respiratoryRate = 'Respiratory rate must be between 4-60 breaths/min';
    }
  }

  if (vitals.oxygenSaturation) {
    const o2 = Number(vitals.oxygenSaturation);
    if (isNaN(o2) || o2 < 30 || o2 > 100) {
      errors.oxygenSaturation = 'Oxygen saturation must be between 30-100%';
    }
  }

  if (vitals.weight) {
    const w = Number(vitals.weight);
    if (isNaN(w) || w < 0.5 || w > 300) {
      errors.weight = 'Weight must be between 0.5-300 kg';
    }
  }

  if (vitals.height) {
    const h = Number(vitals.height);
    if (isNaN(h) || h < 20 || h > 250) {
      errors.height = 'Height must be between 20-250 cm';
    }
  }

  return errors;
}

export function validateMedicalRecord(data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.patientId || typeof data.patientId !== 'string') {
    errors.patientId = 'Patient ID is required';
  }

  if (!data.hospitalId || typeof data.hospitalId !== 'string') {
    errors.hospitalId = 'Hospital ID is required';
  }

  if (!data.chiefComplaint || (typeof data.chiefComplaint === 'string' && data.chiefComplaint.trim().length < 3)) {
    errors.chiefComplaint = 'Chief complaint is required (min 3 characters)';
  }

  if (data.vitalSigns && typeof data.vitalSigns === 'object') {
    const vitalErrors = validateVitalSigns(data.vitalSigns as Record<string, unknown>);
    Object.entries(vitalErrors).forEach(([k, v]) => {
      errors[`vitalSigns.${k}`] = v;
    });
  }

  return errors;
}

export function validatePrescription(data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.medication || (typeof data.medication === 'string' && !data.medication.trim())) {
    errors.medication = 'Medication name is required';
  }
  if (!data.dose || (typeof data.dose === 'string' && !data.dose.trim())) {
    errors.dose = 'Dose is required';
  }
  if (!data.frequency || (typeof data.frequency === 'string' && !data.frequency.trim())) {
    errors.frequency = 'Frequency is required';
  }
  if (!data.patientId || typeof data.patientId !== 'string') {
    errors.patientId = 'Patient ID is required';
  }
  return errors;
}
