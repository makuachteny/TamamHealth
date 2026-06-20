/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for fingerprint-service.ts
 * Covers enrollment (consent gating), revocation, bridge status probing,
 * and 1:N identification with a mocked bridge HTTP API.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-fp-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  enrollFingerprint,
  getTemplatesForPatient,
  revokeFingerprints,
  identifyPatient,
  getBridgeStatus,
  captureFingerprint,
  isFingerprintEnabled,
} from '@/lib/services/fingerprint-service';

const realFetch = global.fetch;
const mockFetch = jest.fn();

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset();
  process.env.NEXT_PUBLIC_FINGERPRINT_ENABLED = 'true';
});

afterEach(async () => {
  global.fetch = realFetch;
  delete process.env.NEXT_PUBLIC_FINGERPRINT_ENABLED;
  await teardownTestDBs();
  uuidCounter = 0;
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function validEnrollment(overrides: Partial<Parameters<typeof enrollFingerprint>[0]> = {}) {
  return {
    patientId: 'pat-001',
    patientName: 'Deng Mabior',
    finger: 'right_index' as const,
    template: 'dGVtcGxhdGUtMQ==',
    format: 'MOCK' as const,
    quality: 92,
    driver: 'mock',
    consentRecordedBy: 'nurse-mary',
    enrolledBy: 'nurse-mary',
    hospitalId: 'phcc-juba',
    orgId: 'org-001',
    ...overrides,
  };
}

describe('Fingerprint Service — enrollment', () => {
  test('enrolls a fingerprint template with consent metadata', async () => {
    const doc = await enrollFingerprint(validEnrollment());
    expect(doc._id).toMatch(/^biotpl-/);
    expect(doc.type).toBe('biometric_template');
    expect(doc.consentGiven).toBe(true);
    expect(doc.consentRecordedBy).toBe('nurse-mary');
    expect(doc.isActive).toBe(true);
    expect(doc.orgId).toBe('org-001');
  });

  test('rejects enrollment without recorded consent', async () => {
    await expect(enrollFingerprint(validEnrollment({ consentRecordedBy: '' })))
      .rejects.toThrow(/consent/i);
  });

  test('rejects enrollment without a template', async () => {
    await expect(enrollFingerprint(validEnrollment({ template: '' })))
      .rejects.toThrow(/template/i);
  });

  test('rejects enrollment with out-of-range quality', async () => {
    await expect(enrollFingerprint(validEnrollment({ quality: 150 })))
      .rejects.toThrow(/quality/i);
    await expect(enrollFingerprint(validEnrollment({ quality: -1 })))
      .rejects.toThrow(/quality/i);
  });

  test('rejects enrollment below the minimum quality floor', async () => {
    await expect(enrollFingerprint(validEnrollment({ quality: 20 })))
      .rejects.toThrow(/minimum/i);
  });

  test('lists only active templates for a patient', async () => {
    await enrollFingerprint(validEnrollment());
    await enrollFingerprint(validEnrollment({ finger: 'left_index', template: 'dGVtcGxhdGUtMg==' }));
    await enrollFingerprint(validEnrollment({ patientId: 'pat-002', patientName: 'Achol' }));

    const templates = await getTemplatesForPatient('pat-001');
    expect(templates).toHaveLength(2);
    expect(templates.every(t => t.patientId === 'pat-001')).toBe(true);
  });
});

describe('Fingerprint Service — revocation', () => {
  test('revokes all templates for a patient', async () => {
    await enrollFingerprint(validEnrollment());
    await enrollFingerprint(validEnrollment({ finger: 'left_index', template: 'dGVtcGxhdGUtMg==' }));

    const revoked = await revokeFingerprints('pat-001', 'admin-user');
    expect(revoked).toBe(2);
    expect(await getTemplatesForPatient('pat-001')).toHaveLength(0);
  });

  test('returns 0 when patient has no templates', async () => {
    expect(await revokeFingerprints('pat-none')).toBe(0);
  });
});

describe('Fingerprint Service — bridge client', () => {
  test('isFingerprintEnabled reflects the env flag', () => {
    expect(isFingerprintEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_FINGERPRINT_ENABLED = 'false';
    expect(isFingerprintEnabled()).toBe(false);
  });

  test('getBridgeStatus reports a healthy bridge', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      ok: true, driver: 'mock', templateFormat: 'MOCK', scannerConnected: true,
    }));
    const status = await getBridgeStatus();
    expect(status).toEqual({
      available: true, scannerConnected: true, driver: 'mock', templateFormat: 'MOCK',
    });
  });

  test('getBridgeStatus reports unavailable when bridge is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const status = await getBridgeStatus();
    expect(status.available).toBe(false);
    expect(status.scannerConnected).toBe(false);
  });

  test('getBridgeStatus short-circuits when the feature flag is off', async () => {
    process.env.NEXT_PUBLIC_FINGERPRINT_ENABLED = 'false';
    const status = await getBridgeStatus();
    expect(status.available).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('captureFingerprint returns the bridge capture payload', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      template: 'dGVtcGxhdGU=', quality: 88, finger: 'right_index', format: 'MOCK', driver: 'mock',
    }));
    const result = await captureFingerprint({ finger: 'right_index' });
    expect(result.template).toBe('dGVtcGxhdGU=');
    expect(result.quality).toBe(88);
  });

  test('captureFingerprint surfaces bridge errors', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'scanner not connected' }, 503));
    await expect(captureFingerprint()).rejects.toThrow('scanner not connected');
  });
});

describe('Fingerprint Service — identification', () => {
  test('returns ranked matches mapped to patients', async () => {
    const t1 = await enrollFingerprint(validEnrollment());
    await enrollFingerprint(validEnrollment({ patientId: 'pat-002', patientName: 'Achol', template: 'dGVtcGxhdGUtMg==' }));

    mockFetch.mockResolvedValueOnce(jsonResponse({ matches: [{ id: t1._id, score: 100 }] }));
    const matches = await identifyPatient('cHJvYmU=', { role: 'front_desk', orgId: 'org-001' });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      patientId: 'pat-001', patientName: 'Deng Mabior', finger: 'right_index', score: 100,
    });

    // Bridge received every active template as a candidate
    const matchCall = mockFetch.mock.calls[0];
    const payload = JSON.parse(matchCall[1].body);
    expect(payload.candidates).toHaveLength(2);
  });

  test('deduplicates multiple finger matches for the same patient', async () => {
    const t1 = await enrollFingerprint(validEnrollment());
    const t2 = await enrollFingerprint(validEnrollment({ finger: 'left_index', template: 'dGVtcGxhdGUtMg==' }));

    mockFetch.mockResolvedValueOnce(jsonResponse({
      matches: [{ id: t1._id, score: 95 }, { id: t2._id, score: 80 }],
    }));
    const matches = await identifyPatient('cHJvYmU=', { role: 'front_desk', orgId: 'org-001' });
    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBe(95);
  });

  test('excludes revoked templates from candidates', async () => {
    await enrollFingerprint(validEnrollment());
    await revokeFingerprints('pat-001');

    const matches = await identifyPatient('cHJvYmU=', { role: 'front_desk', orgId: 'org-001' });
    expect(matches).toEqual([]);
    // No candidates → no bridge call at all
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('fails closed without a scope (no unscoped 1:N search)', async () => {
    await enrollFingerprint(validEnrollment());
    const matches = await identifyPatient('cHJvYmU=');
    expect(matches).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('fails closed for a non-national role missing orgId', async () => {
    await enrollFingerprint(validEnrollment());
    const matches = await identifyPatient('cHJvYmU=', { role: 'front_desk' });
    expect(matches).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('scopes candidates to the caller org', async () => {
    await enrollFingerprint(validEnrollment({ orgId: 'org-001' }));
    await enrollFingerprint(validEnrollment({ patientId: 'pat-002', patientName: 'Achol', orgId: 'org-OTHER', template: 'dGVtcGxhdGUtMg==' }));

    mockFetch.mockResolvedValueOnce(jsonResponse({ matches: [] }));
    await identifyPatient('cHJvYmU=', { role: 'front_desk', orgId: 'org-001' });

    const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(payload.candidates).toHaveLength(1);
  });

  test('surfaces bridge matching errors', async () => {
    await enrollFingerprint(validEnrollment());
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'matcher crashed' }, 500));
    await expect(identifyPatient('cHJvYmU=', { role: 'front_desk', orgId: 'org-001' }))
      .rejects.toThrow('matcher crashed');
  });
});
