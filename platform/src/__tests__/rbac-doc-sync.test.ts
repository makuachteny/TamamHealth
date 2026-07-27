/**
 * RBAC documentation must describe roles that actually exist (KAN-120, KAN-121).
 *
 * `docs/RBAC-MATRIX.md` listed `boma_health_worker`, `community_health_volunteer` and
 * `payam_supervisor` with capability rows. None has ever been in the `UserRole`
 * union, so nothing could hold them and no guard could grant them anything —
 * the matrix read as an access-control statement while granting nothing. An
 * auditor reviewing it would have believed community workers had scoped access
 * they do not have.
 *
 * This test derives the answer from the type rather than from a hand-copied
 * list, so the doc cannot silently drift again.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOC = join(process.cwd(), '..', 'docs', 'RBAC-MATRIX.md');
const TYPES = join(process.cwd(), 'src', 'lib', 'db-types.ts');

/** Pull the UserRole union members straight out of the source of truth. */
function declaredRoles(): string[] {
  const src = readFileSync(TYPES, 'utf8');
  const start = src.indexOf('export type UserRole =');
  const end = src.indexOf(';', start);
  const block = src.slice(start, end);
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

/** Role-ish identifiers the doc mentions, excluding fenced explanatory prose. */
function docRoleMentions(): string[] {
  const doc = readFileSync(DOC, 'utf8');
  const body = doc
    .split('\n')
    // Blockquote lines are commentary about removed roles, not claims about
    // current access — exclude them or the note itself trips this test.
    .filter((l) => !l.trimStart().startsWith('>'))
    .join('\n');
  return [...body.matchAll(/\b([a-z]+_[a-z_]+)\b/g)].map((m) => m[1]);
}

describe('RBAC-MATRIX.md matches the UserRole union', () => {
  const roles = declaredRoles();

  test('the union parses to a plausible role list', () => {
    expect(roles.length).toBeGreaterThan(15);
    expect(roles).toContain('doctor');
    expect(roles).toContain('super_admin');
  });

  test('the three phantom roles are gone from the matrix body', () => {
    const mentions = docRoleMentions();
    for (const phantom of ['boma_health_worker', 'community_health_volunteer', 'payam_supervisor']) {
      expect(roles).not.toContain(phantom); // still absent from code
      expect(mentions).not.toContain(phantom); // and no longer claimed by the doc
    }
  });

  test('every snake_case role the doc names outside commentary really exists', () => {
    // Guards the reverse direction: a future edit adding a role row for
    // something that was never implemented fails here.
    const known = new Set(roles);
    // Terms that look like roles but are document vocabulary, not UserRole members.
    const NOT_ROLES = new Set([
      'read_write', 'least_privilege', 'scope_of_practice',
    ]);
    const unknown = [...new Set(docRoleMentions())].filter(
      (m) => !known.has(m) && !NOT_ROLES.has(m),
    );
    expect(unknown).toEqual([]);
  });
});
