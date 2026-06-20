/**
 * Next.js Instrumentation — runs once on server startup.
 * Used to verify the license key before the app serves requests.
 */

import { validateProductionConfig } from './lib/config-validation';

/**
 * Boot-time configuration safety check. Refuses to start in production if an
 * obvious placeholder / empty / missing secret leaked through — better to fail
 * loudly on deploy than to silently ship a known-bad credential. The rules live
 * in lib/config-validation.ts so they are unit-testable.
 */
function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors = validateProductionConfig(process.env);

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
      console.warn('  Set TAMAMHEALTH_LICENSE_KEY in your .env.local file.');
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
