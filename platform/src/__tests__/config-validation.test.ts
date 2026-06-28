/**
 * Tests for production config validation (fail-closed secrets).
 */
import { validateProductionConfig, DEFAULT_LICENSE_SECRET } from '@/lib/config-validation';

/** A fully-valid production env baseline; tests override single keys. */
function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    JWT_SECRET: 'x'.repeat(48),
    TAMAMHEALTH_LICENSE_SECRET: 'y'.repeat(48),
    AIRTEL_WEBHOOK_SECRET: 'airtel-webhook-secret',
    MPESA_WEBHOOK_SECRET: 'mpesa-webhook-secret',
    ...overrides,
  };
}

describe('validateProductionConfig', () => {
  test('passes with a fully-valid env', () => {
    expect(validateProductionConfig(validEnv())).toEqual([]);
  });

  // --- JWT ---
  test('flags missing JWT_SECRET', () => {
    expect(validateProductionConfig(validEnv({ JWT_SECRET: undefined }))).toEqual([
      expect.stringContaining('JWT_SECRET is unset'),
    ]);
  });
  test('flags placeholder JWT_SECRET', () => {
    expect(validateProductionConfig(validEnv({ JWT_SECRET: 'CHANGE_ME_please_now_xxxxxxxxxxxxxx' }))[0]).toMatch(/placeholder/i);
  });
  test('flags short JWT_SECRET', () => {
    expect(validateProductionConfig(validEnv({ JWT_SECRET: 'short' }))[0]).toMatch(/at least 32/);
  });

  // --- License signing secret ---
  test('flags missing license secret', () => {
    expect(validateProductionConfig(validEnv({ TAMAMHEALTH_LICENSE_SECRET: undefined }))[0]).toMatch(/LICENSE_SECRET is unset/);
  });
  test('flags the public default license secret', () => {
    expect(validateProductionConfig(validEnv({ TAMAMHEALTH_LICENSE_SECRET: DEFAULT_LICENSE_SECRET }))[0]).toMatch(/public default/);
  });
  test('flags a short license secret', () => {
    expect(validateProductionConfig(validEnv({ TAMAMHEALTH_LICENSE_SECRET: 'tooshort' }))[0]).toMatch(/at least 32/);
  });

  // --- Admin password / public exposure ---
  test('flags a placeholder admin password', () => {
    expect(validateProductionConfig(validEnv({ ADMIN_INITIAL_PASSWORD: 'ChangeMe123' }))[0]).toMatch(/placeholder/i);
  });
  test('flags NEXT_PUBLIC_ADMIN_PASSWORD exposure', () => {
    expect(validateProductionConfig(validEnv({ NEXT_PUBLIC_ADMIN_PASSWORD: 'anything' }))[0]).toMatch(/NEXT_PUBLIC_ADMIN_PASSWORD/);
  });

  // --- PHI encryption key ---
  test('flags encryption enabled without a key', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: 'true' }))[0]).toMatch(/PHI_ENCRYPTION_KEY is unset/);
  });
  test('flags a wrong-length encryption key', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: 'true', PHI_ENCRYPTION_KEY: 'AAAA' }))[0]).toMatch(/32 bytes/);
  });
  test('accepts a valid 32-byte base64 encryption key', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: 'true', PHI_ENCRYPTION_KEY: key }))).toEqual([]);
  });

  // --- Sync ---
  test('flags sync enabled without CouchDB URL or webhook secret', () => {
    const errs = validateProductionConfig(validEnv({ NEXT_PUBLIC_SYNC_ENABLED: 'true' }));
    expect(errs).toEqual(expect.arrayContaining([
      expect.stringContaining('NEXT_PUBLIC_COUCHDB_URL is unset'),
      expect.stringContaining('COUCHDB_WEBHOOK_SECRET is unset'),
    ]));
  });

  // --- Payment webhooks ---
  test('flags unsigned Airtel and M-Pesa webhooks', () => {
    const errs = validateProductionConfig(validEnv({
      AIRTEL_WEBHOOK_SECRET: undefined,
      MPESA_WEBHOOK_SECRET: undefined,
    }));
    expect(errs).toEqual(expect.arrayContaining([
      expect.stringContaining('AIRTEL_WEBHOOK_SECRET is unset'),
      expect.stringContaining('MPESA_WEBHOOK_SECRET is unset'),
    ]));
  });
});
