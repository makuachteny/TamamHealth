/**
 * Ad-hoc CLI for applying pending Postgres migrations.
 *
 * The same runner is invoked automatically at server boot (instrumentation.ts).
 * This script is for operators who want to apply migrations out-of-band —
 * for example before swapping container images, or against a fresh staging
 * DB. Run via `npm run db:migrate`.
 */

import { runMigrations } from '../src/lib/db/migrate';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(2);
  }
  const summary = await runMigrations();
  console.log(
    `[migrate] done: applied=${summary.applied.length} ` +
      `skipped=${summary.skipped.length} (${summary.durationMs}ms)`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
