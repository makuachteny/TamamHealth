/**
 * Production configuration safety checks (fail-closed).
 *
 * Extracted from instrumentation.ts so the rules are unit-testable. Each rule
 * returns a human-readable error; a non-empty list means production must refuse
 * to boot rather than silently ship a known-bad / missing credential.
 */

const PLACEHOLDER = /REPLACE|CHANGE|PLACEHOLDER|ChangeMe/i;
const JWT_PLACEHOLDER = /REPLACE|CHANGE|PLACEHOLDER|default|example|tamamhealth-south-sudan/i;

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

  // --- Field encryption key (encryption at rest) ---------------------------
  // REQUIRED in production. The previous rule only fired when encryption was
  // already switched ON, so the dangerous case — an operator who never set the
  // flag at all and is silently writing plaintext PHI — passed validation
  // cleanly. That is exactly backwards for a fail-closed check.
  // Exempt only an explicit demo deployment, which by definition holds seeded
  // fake data rather than real patients. Any other production boot must encrypt.
  const isDemo = env.NEXT_PUBLIC_DEMO_MODE === 'true';
  if (!isDemo && env.PHI_ENCRYPTION_ENABLED !== 'true') {
    errors.push(
      'PHI_ENCRYPTION_ENABLED must be "true" in production — patient data would otherwise be stored unencrypted. ' +
      'Set it and supply PHI_ENCRYPTION_KEY (`openssl rand -base64 32`). ' +
      'Only an explicit demo deployment (NEXT_PUBLIC_DEMO_MODE=true, seeded fake data) may run without it.',
    );
  } else if (env.PHI_ENCRYPTION_ENABLED === 'true') {
    const key = env.PHI_ENCRYPTION_KEY || '';
    if (!key) {
      errors.push('PHI_ENCRYPTION_ENABLED=true but PHI_ENCRYPTION_KEY is unset — generate one with `openssl rand -base64 32`.');
    } else if (PLACEHOLDER.test(key)) {
      errors.push('PHI_ENCRYPTION_KEY still contains a placeholder — generate a real one with `openssl rand -base64 32`.');
    } else if (Buffer.from(key, 'base64').length !== 32) {
      errors.push('PHI_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256) — generate with `openssl rand -base64 32`.');
    }
  }

  // --- Shared security state (Upstash Redis) -------------------------------
  // Rate-limit counters and the JWT revocation list are per-instance unless a
  // shared store is configured. With more than one replica that means an
  // attacker gets `limit` login attempts PER REPLICA, and a token revoked at
  // logout on replica A keeps working on replica B until its `exp` passes.
  //
  // A process cannot tell how many replicas it is one of, so this is required
  // in production and the single-replica case must say so explicitly. Same
  // fail-closed shape as the PHI rule above: the dangerous configuration is
  // reachable, but only as a deliberate, recorded choice.
  if (!isDemo && !env.UPSTASH_REDIS_REST_URL) {
    if (env.SINGLE_REPLICA_ACK !== 'true') {
      errors.push(
        'UPSTASH_REDIS_REST_URL/TOKEN are unset, so rate-limit counters and the JWT ' +
        'revocation list are per-instance — a logged-out token stays valid on other ' +
        'replicas. Configure Upstash, or set SINGLE_REPLICA_ACK=true to confirm this ' +
        'deploy runs exactly ONE platform replica.',
      );
    }
  } else if (!isDemo && env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push('UPSTASH_REDIS_REST_URL is set but UPSTASH_REDIS_REST_TOKEN is unset — the shared store would be unreachable.');
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

  // --- Payment webhooks ------------------------------------------------------
  // Public money-movement callbacks must not run unsigned in production. The
  // individual routes keep a non-production fallback for local gateway testing.
  if (!env.AIRTEL_WEBHOOK_SECRET) {
    errors.push('AIRTEL_WEBHOOK_SECRET is unset — Airtel webhooks would be unsigned in production.');
  }
  if (!env.MPESA_WEBHOOK_SECRET) {
    errors.push('MPESA_WEBHOOK_SECRET is unset — M-Pesa webhooks would be unsigned in production.');
  }

  return errors;
}
