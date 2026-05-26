/**
 * Next.js Instrumentation — runs once on server startup.
 * Used to verify the license key before the app serves requests.
 */

/**
 * Boot-time configuration safety check. Refuses to start in production if an
 * obvious placeholder / empty value leaked through — better to fail loudly on
 * deploy than to silently ship a known-bad credential.
 */
function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  // Bootstrap admin password: server-only env var. If unset, the credential
  // generator (lib/seed-credentials.ts) will mint a random one on first boot
  // and print the file path to stdout. We accept that path here, but warn if
  // the operator left a known-placeholder value behind.
  const adminPass = process.env.ADMIN_INITIAL_PASSWORD || '';
  if (adminPass && /REPLACE|CHANGE|PLACEHOLDER|ChangeMe/i.test(adminPass)) {
    errors.push('ADMIN_INITIAL_PASSWORD still contains a placeholder — rotate it before boot.');
  }

  // Refuse to boot if a deploy still references the old browser-exposed
  // admin-password variable. NEXT_PUBLIC_* values get bundled into every
  // shipped JS payload, so this is never a safe place for a credential.
  if (process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    errors.push('NEXT_PUBLIC_ADMIN_PASSWORD is set — remove it. Use ADMIN_INITIAL_PASSWORD (server-only) instead.');
  }

  const jwt = process.env.JWT_SECRET || '';
  if (!jwt) {
    // Catch the missing-entirely case at boot rather than on first auth
    // request. auth-token.ts also refuses to fall back in production, but a
    // boot-time refusal turns this into a deploy-time failure rather than a
    // runtime 500 on the first login attempt.
    errors.push('JWT_SECRET is unset — generate one with `openssl rand -base64 48`.');
  } else if (/REPLACE|CHANGE|PLACEHOLDER|default|example|tamamhealth-south-sudan/i.test(jwt)) {
    errors.push('JWT_SECRET still contains a placeholder / default — generate one with `openssl rand -base64 48`.');
  } else if (jwt.length < 32) {
    // Mirror the runtime check in auth-token.ts so deploys with a too-short
    // secret fail loudly at boot.
    errors.push(`JWT_SECRET must be at least 32 characters in production (got ${jwt.length}).`);
  }

  if (process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true') {
    if (!process.env.NEXT_PUBLIC_COUCHDB_URL) {
      errors.push('NEXT_PUBLIC_SYNC_ENABLED=true but NEXT_PUBLIC_COUCHDB_URL is unset.');
    }
    if (!process.env.COUCHDB_WEBHOOK_SECRET) {
      errors.push('NEXT_PUBLIC_SYNC_ENABLED=true but COUCHDB_WEBHOOK_SECRET is unset.');
    }
  }

  if (errors.length > 0) {
    console.error('');
    console.error('  ============================================================');
    console.error('  PRODUCTION STARTUP REFUSED — invalid configuration');
    console.error('  ============================================================');
    for (const e of errors) console.error(`  • ${e}`);
    console.error('  ============================================================');
    console.error('');
    throw new Error('Invalid production configuration — see errors above.');
  }
}

export async function register() {
  // Wire Sentry early so any error thrown by the boot path below (license
  // check, migrations) gets captured. Gated on a DSN being set: with no DSN
  // configured this is a no-op and the SDK loader never fires a network
  // request — preserving the local "no Sentry account required" dev flow.
  const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (sentryDsn && process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (sentryDsn && process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }

  // Only run on the server (not during build or in the edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // If the operator has opted into Doppler (DOPPLER_TOKEN is set), verify
    // the secret injection actually populated process.env. No-op otherwise,
    // so existing .env_file-based deploys continue to work unchanged.
    const { assertDopplerEnv } = await import('./lib/secrets');
    assertDopplerEnv();
    assertProductionConfig();
    const { checkLicense } = await import('./lib/license');
    const license = checkLicense();

    if (!license) {
      console.warn('');
      console.warn('  ============================================================');
      console.warn('  WARNING: No valid TamamHealth license key found.');
      console.warn('  Set TamamHealth_LICENSE_KEY in your .env.local file.');
      console.warn('  Run "npm run setup" to configure your license.');
      console.warn('  Contact hello@tamamhealth.org to obtain a license.');
      console.warn('  ============================================================');
      console.warn('');
    } else if (license.expired) {
      console.warn('');
      console.warn('  ============================================================');
      console.warn(`  WARNING: TamamHealth license expired on ${license.expiry.slice(0, 4)}-${license.expiry.slice(4, 6)}-${license.expiry.slice(6, 8)}.`);
      console.warn('  Contact hello@tamamhealth.org to renew your license.');
      console.warn('  ============================================================');
      console.warn('');
    } else {
      console.log(`  TamamHealth licensed to: ${license.org} (${license.plan})`);
    }

    // Apply pending Postgres migrations before the app starts serving. The
    // runner takes a Postgres advisory lock so rolling-deploy replicas can't
    // race. If DATABASE_URL is unset the platform isn't using analytics
    // Postgres yet — that's a valid dev configuration, so we just log and
    // skip rather than crash.
    if (!process.env.DATABASE_URL) {
      console.log('  [migrate] DATABASE_URL not set — skipping Postgres migrations.');
    } else if (process.env.SKIP_DB_MIGRATIONS === 'true') {
      console.log('  [migrate] SKIP_DB_MIGRATIONS=true — operator has disabled the boot-time runner.');
    } else {
      try {
        const { runMigrations } = await import('./lib/db/migrate');
        await runMigrations();
      } catch (err) {
        console.error('');
        console.error('  ============================================================');
        console.error('  STARTUP REFUSED — Postgres migrations failed');
        console.error('  ============================================================');
        console.error(`  ${err instanceof Error ? err.message : String(err)}`);
        console.error('  ============================================================');
        console.error('');
        throw err;
      }
    }
  }
}
