/**
 * @jest-environment node
 *
 * Every persisted setting must have both a writer and a reader (KAN-117).
 *
 * ## Why
 *
 * `safeguard_last_backup` was read by FOUR admin surfaces and written by none.
 * Backups run from a GitHub Actions cron outside the app, so the key could
 * never have had a value — yet `/admin` reported the backup as definitively
 * overdue and `/admin/risk` reported no backup risk at all, from the same
 * absent data.
 *
 * A read-only key is a control that reports on nothing. A write-only key is a
 * control that changes nothing — the "display-only setting" this ticket also
 * calls out. Both are invisible in review because each half looks perfectly
 * reasonable on its own; only the pairing reveals the gap.
 */

import { execSync } from 'child_process';
import { join } from 'path';

const SRC = join(__dirname, '..');

/**
 * Keys are collected as string literals. Keys accessed only through a variable
 * (`localStorage.getItem(SOME_KEY)`) are invisible here, so the constant's own
 * literal declaration is what this matches — which is why the allow-list below
 * exists rather than the check being silently incomplete.
 */
function keysFor(method: 'setItem' | 'getItem' | 'removeItem'): Set<string> {
  // Whole lines, not `-o`: the key has to be extracted alongside enough
  // context to tell code from prose. Documentation that QUOTES a call — this
  // file and backup-status-service.ts both do — would otherwise register as a
  // real access and mask the very orphan the check is looking for.
  const out = execSync(
    `grep -rhE "localStorage\\.${method}\\(\\s*['\\"][^'\\"]+['\\"]" ${JSON.stringify(SRC)} || true`,
    { encoding: 'utf8' },
  );
  const keys = new Set<string>();
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const m = line.match(new RegExp(`localStorage\\.${method}\\(\\s*['"]([^'"]+)['"]`));
    if (m) keys.add(m[1]);
  }
  return keys;
}

/**
 * Keys whose access goes through a shared constant rather than a literal at
 * every call site, or that are written outside this codebase.
 *
 * Every entry needs a reason. "It's fine" is not one — that is exactly what
 * would have been written for `safeguard_last_backup`.
 */
const EXEMPT: Record<string, string> = {
  // Read and written in useAutoLock.ts via the LOCK_TIMEOUT_KEY constant, and
  // additionally written by the org settings panel as a literal.
  'tamamhealth-lock-timeout': 'accessed via LOCK_TIMEOUT_KEY constant in useAutoLock.ts',
  // Test fixture, not a product setting.
  'tamamhealth.roleSettings.bad-user': 'test fixture for corrupt-value handling',
};

describe('persisted settings', () => {
  const written = keysFor('setItem');
  const read = keysFor('getItem');

  it('has a reader for every key the app writes', () => {
    const writeOnly = [...written].filter(k => !read.has(k) && !(k in EXEMPT));
    // A setting written but never read is a control that changes nothing —
    // it renders, it accepts input, and no behaviour depends on it.
    expect(writeOnly).toEqual([]);
  });

  it('has a writer for every key the app reads', () => {
    const readOnly = [...read].filter(k => !written.has(k) && !(k in EXEMPT));
    // A key read but never written always yields null, so whatever the screen
    // shows for "missing" is the only thing it will ever show — a status
    // reported without ever being measured.
    expect(readOnly).toEqual([]);
  });

  it('keeps every exemption justified', () => {
    for (const [key, reason] of Object.entries(EXEMPT)) {
      expect(reason.length).toBeGreaterThan(20);
      // An exemption for a key nobody touches any more is stale; drop it.
      expect(written.has(key) || read.has(key)).toBe(true);
    }
  });
});
