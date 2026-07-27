/**
 * Clinical role authority (KAN-19, KAN-20).
 *
 * Both were long-standing disagreements between layers rather than bugs in one
 * place, so these tests pin the resolved answer where the next audit will find
 * it — the previous state passed every test suite it had.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROVIDER_ROLES,
  TRAINEE_AUTHOR_ROLES,
  isProviderRole,
  isClinicalAuthorRole,
} from '@/lib/clinical-roles';

describe('clinical_officer signs independently (KAN-19)', () => {
  test('is a provider, not a trainee author', () => {
    // Was in TRAINEE_AUTHOR_ROLES, so CO notes routed for co-signature while
    // every API guard already let a CO prescribe unsupervised.
    expect(isProviderRole('clinical_officer')).toBe(true);
    expect(PROVIDER_ROLES).toContain('clinical_officer');
    expect(TRAINEE_AUTHOR_ROLES).not.toContain('clinical_officer');
  });

  test('genuinely supervised roles still route for co-signature', () => {
    for (const role of ['nurse', 'midwife', 'nutritionist'] as const) {
      expect(isProviderRole(role)).toBe(false);
      expect(isClinicalAuthorRole(role)).toBe(true);
    }
  });

  test('a non-clinical role is neither', () => {
    expect(isProviderRole('cashier')).toBe(false);
    expect(isClinicalAuthorRole('cashier')).toBe(false);
  });
});

describe('clinician is a first-class clinical role (KAN-20)', () => {
  const CLINICAL_ROUTES = [
    'prescriptions', 'lab', 'deaths', 'births', 'anc',
    'immunizations', 'referrals', 'telehealth', 'triage',
  ];

  const routeSource = (name: string) =>
    readFileSync(join(process.cwd(), 'src/app/api', name, 'route.ts'), 'utf8');

  test.each(CLINICAL_ROUTES)('%s allows clinician', (name) => {
    // `clinician` was in patients + medical-records only, so it could open a
    // chart but not order a test, prescribe, or register a birth.
    expect(routeSource(name)).toContain("'clinician'");
  });

  test('clinician can AMEND a medical record, not just create one', () => {
    // The sharpest symptom: create was permitted, amend was not, so a clinician
    // could write a record they were then unable to correct.
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/medical-records/[id]/route.ts'),
      'utf8',
    );
    expect(src).toContain("'clinician'");
  });

  test('clinician signs as a provider, consistent with those route grants', () => {
    expect(isProviderRole('clinician')).toBe(true);
  });
});
