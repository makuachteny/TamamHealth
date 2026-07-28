/**
 * The deployed validator must match the generated one (KAN-94).
 *
 * `scripts/install-validate-doc-updates.mjs` is plain Node ESM so it can run
 * without a TypeScript toolchain during deploys — which means it embeds the
 * validator source as a literal rather than importing it. That embedded copy is
 * what actually reaches CouchDB, so if it drifts from
 * `buildValidateDocUpdateFn()` the tested rules and the enforced rules are
 * different things.
 *
 * This test makes that drift impossible to miss. Regenerate with:
 *   npx tsx -e "…" (see the KAN-94 ticket) — or copy the value of
 *   ORG_SCOPED_VALIDATE_FN into the script.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORG_SCOPED_VALIDATE_FN } from '@/lib/sync/write-permissions';

const SCRIPT = join(process.cwd(), 'scripts', 'install-validate-doc-updates.mjs');

function embeddedValidator(): string {
  const src = readFileSync(SCRIPT, 'utf8');
  const start = src.indexOf('const ORG_SCOPED_VALIDATE_FN = `');
  expect(start).toBeGreaterThan(-1);
  const open = src.indexOf('`', start);
  const close = src.indexOf('`;', open + 1);
  return src.slice(open + 1, close);
}

describe('installer / generator parity', () => {
  test('the embedded validator is byte-identical to the generated one', () => {
    expect(embeddedValidator()).toBe(ORG_SCOPED_VALIDATE_FN);
  });

  test('the embedded validator actually compiles', () => {
    // The script has no test coverage of its own; a syntax error here would
    // only surface as "every write to every database is blocked" in production.
     
    expect(() => new Function(`return (${embeddedValidator()});`)()).not.toThrow();
  });

  test('it enforces roles, not just tenancy', () => {
    // Guards against someone reverting to the org-only validator this replaced.
    const embedded = embeddedValidator();
    expect(embedded).toMatch(/may not write documents of type/);
    expect(embedded).toMatch(/no role claim/);
    expect(embedded).toMatch(/is immutable/);
  });
});
