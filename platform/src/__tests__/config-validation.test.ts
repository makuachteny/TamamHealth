/**
 * Tests for production config validation (fail-closed secrets).
 */
import { validateProductionConfig } from '@/lib/config-validation';

/** A valid 32-byte AES-256 key, base64-encoded. */
const VALID_PHI_KEY = Buffer.alloc(32, 7).toString('base64');

/** A fully-valid production env baseline; tests override single keys. */
function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    JWT_SECRET: 'x'.repeat(48),
    AIRTEL_WEBHOOK_SECRET: 'airtel-webhook-secret',
    MPESA_WEBHOOK_SECRET: 'mpesa-webhook-secret',
    // Encryption at rest is REQUIRED in production, so a valid baseline must
    // include it — see the PHI encryption block below.
    PHI_ENCRYPTION_ENABLED: 'true',
    PHI_ENCRYPTION_KEY: VALID_PHI_KEY,
    // Shared security state is required in production — see the Upstash block.
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
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

  // --- Admin password / public exposure ---
  test('flags a placeholder admin password', () => {
    expect(validateProductionConfig(validEnv({ ADMIN_INITIAL_PASSWORD: 'ChangeMe123' }))[0]).toMatch(/placeholder/i);
  });
  test('flags NEXT_PUBLIC_ADMIN_PASSWORD exposure', () => {
    expect(validateProductionConfig(validEnv({ NEXT_PUBLIC_ADMIN_PASSWORD: 'anything' }))[0]).toMatch(/NEXT_PUBLIC_ADMIN_PASSWORD/);
  });

  // --- PHI encryption key ---
  test('flags encryption enabled without a key', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: 'true', PHI_ENCRYPTION_KEY: undefined }))[0]).toMatch(/PHI_ENCRYPTION_KEY is unset/);
  });
  test('flags a wrong-length encryption key', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: 'true', PHI_ENCRYPTION_KEY: 'AAAA' }))[0]).toMatch(/32 bytes/);
  });
  test('flags a placeholder encryption key', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_KEY: 'REPLACE-with-32-byte-base64-key' }))[0]).toMatch(/placeholder/i);
  });
  test('accepts a valid 32-byte base64 encryption key', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: 'true', PHI_ENCRYPTION_KEY: VALID_PHI_KEY }))).toEqual([]);
  });

  // The case that previously slipped through: encryption never switched on at
  // all. The old rule only fired when it was already 'true', so the dangerous
  // default — plaintext PHI — passed validation cleanly.
  test('REFUSES production boot when encryption is not enabled at all', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: undefined }))[0])
      .toMatch(/PHI_ENCRYPTION_ENABLED must be "true" in production/);
  });
  test('refuses production boot when encryption is explicitly disabled', () => {
    expect(validateProductionConfig(validEnv({ PHI_ENCRYPTION_ENABLED: 'false' }))[0])
      .toMatch(/PHI_ENCRYPTION_ENABLED must be "true" in production/);
  });
  test('exempts an explicit demo deployment, which holds no real PHI', () => {
    expect(validateProductionConfig(validEnv({
      PHI_ENCRYPTION_ENABLED: undefined,
      PHI_ENCRYPTION_KEY: undefined,
      NEXT_PUBLIC_DEMO_MODE: 'true',
    }))).toEqual([]);
  });

  // --- Shared security state (KAN-34) ---
  test('REFUSES production boot when no shared store is configured', () => {
    expect(validateProductionConfig(validEnv({
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    }))[0]).toMatch(/rate-limit counters and the JWT revocation list are per-instance/);
  });

  test('allows a single-replica deploy that explicitly acknowledges it', () => {
    expect(validateProductionConfig(validEnv({
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      SINGLE_REPLICA_ACK: 'true',
    }))).toEqual([]);
  });

  test('flags a half-configured shared store', () => {
    expect(validateProductionConfig(validEnv({ UPSTASH_REDIS_REST_TOKEN: undefined }))[0])
      .toMatch(/UPSTASH_REDIS_REST_TOKEN is unset/);
  });

  test('exempts a demo deployment from the shared-store requirement', () => {
    expect(validateProductionConfig(validEnv({
      PHI_ENCRYPTION_ENABLED: undefined,
      PHI_ENCRYPTION_KEY: undefined,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      NEXT_PUBLIC_DEMO_MODE: 'true',
    }))).toEqual([]);
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
