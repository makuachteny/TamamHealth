/**
 * Production configuration safety checks (fail-closed).
 *
 * Extracted from instrumentation.ts so the rules are unit-testable. Each rule
 * returns a human-readable error; a non-empty list means production must refuse
 * to boot rather than silently ship a known-bad / missing credential.
 */

const PLACEHOLDER = /REPLACE|CHANGE|PLACEHOLDER|ChangeMe/i;
const JWT_PLACEHOLDER = /REPLACE|CHANGE|PLACEHOLDER|default|example|tamamhealth-south-sudan/i;

/** The compiled-in license signing fallback. Must never be the live secret. */
export const DEFAULT_LICENSE_SECRET = 'tamamhealth-2026-license-signing-key';

export interface ConfigEnv {
  [key: string]: string | undefined;
}

/**
 * Validate production config. Returns a list of fatal errors (empty = OK).
 * Pure: takes the env so tests can exercise every branch deterministically.
 */
export function validateProductionConfig(env: ConfigEnv): string[] {
  const errors: string[] = [];

  // --- Bootstrap admin password -------------------------------------------
  const adminPass = env.ADMIN_INITIAL_PASSWORD || '';
  if (adminPass && PLACEHOLDER.test(adminPass)) {
    errors.push('ADMIN_INITIAL_PASSWORD still contains a placeholder — rotate it before boot.');
  }
  if (env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    errors.push('NEXT_PUBLIC_ADMIN_PASSWORD is set — remove it. Use ADMIN_INITIAL_PASSWORD (server-only) instead.');
  }

  // --- JWT signing secret --------------------------------------------------
  const jwt = env.JWT_SECRET || '';
  if (!jwt) {
    errors.push('JWT_SECRET is unset — generate one with `openssl rand -base64 48`.');
  } else if (JWT_PLACEHOLDER.test(jwt)) {
    errors.push('JWT_SECRET still contains a placeholder / default — generate one with `openssl rand -base64 48`.');
  } else if (jwt.length < 32) {
    errors.push(`JWT_SECRET must be at least 32 characters in production (got ${jwt.length}).`);
  }

  // --- License signing secret (SaaS control plane) -------------------------
  // The operator signs every tenant's license with this key; if it is unset or
  // still the compiled-in fallback, anyone could forge a license. Required in
  // production so license expiry / suspension can't be bypassed.
  const licenseSecret = env.TAMAMHEALTH_LICENSE_SECRET || '';
  if (!licenseSecret) {
    errors.push('TAMAMHEALTH_LICENSE_SECRET is unset — license keys would be signed with the public default. Set a strong random secret.');
  } else if (licenseSecret === DEFAULT_LICENSE_SECRET || PLACEHOLDER.test(licenseSecret)) {
    errors.push('TAMAMHEALTH_LICENSE_SECRET is the public default / a placeholder — rotate it to a strong random secret.');
  } else if (licenseSecret.length < 32) {
    errors.push(`TAMAMHEALTH_LICENSE_SECRET must be at least 32 characters in production (got ${licenseSecret.length}).`);
  }

  // --- Field encryption key (encryption at rest) ---------------------------
  // Optional, but if encryption-at-rest is enabled the key must be valid.
  if (env.PHI_ENCRYPTION_ENABLED === 'true') {
    const key = env.PHI_ENCRYPTION_KEY || '';
    if (!key) {
      errors.push('PHI_ENCRYPTION_ENABLED=true but PHI_ENCRYPTION_KEY is unset — generate one with `openssl rand -base64 32`.');
    } else if (Buffer.from(key, 'base64').length !== 32) {
      errors.push('PHI_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256) — generate with `openssl rand -base64 32`.');
    }
  }

  // --- Sync (CouchDB) ------------------------------------------------------
  if (env.NEXT_PUBLIC_SYNC_ENABLED === 'true') {
    if (!env.NEXT_PUBLIC_COUCHDB_URL) {
      errors.push('NEXT_PUBLIC_SYNC_ENABLED=true but NEXT_PUBLIC_COUCHDB_URL is unset.');
    }
    if (!env.COUCHDB_WEBHOOK_SECRET) {
      errors.push('NEXT_PUBLIC_SYNC_ENABLED=true but COUCHDB_WEBHOOK_SECRET is unset.');
    }
  }

  return errors;
}
