/**
 * Role checking for clinical-flow station roles.
 *
 * The audited defect: the six clinical-flow station roles are real `UserRole`s
 * with dashboards and seeded accounts, but were never added to the API's
 * hand-maintained allow-lists. Five of six matched ZERO of the 40 role-guarded
 * routes — a triage nurse could sign in and then be refused by `/api/triage`.
 *
 * These tests pin both halves of the fix: the station roles now resolve, and
 * they do NOT inherit anything their legacy equivalent lacks.
 */
import { hasRole } from '@/lib/api-auth';
import type { UserRole } from '@/lib/db-types';

function auth(role: UserRole) {
  return {
    sub: `user-${role}`,
    username: role,
    role,
    name: role,
  } as Parameters<typeof hasRole>[0];
}

describe('hasRole — clinical-flow station roles', () => {
  test('an exact match still wins', () => {
    expect(hasRole(auth('doctor'), ['doctor', 'nurse'])).toBe(true);
    expect(hasRole(auth('clinician'), ['clinician'])).toBe(true);
  });

  test('a role not in the list is still refused', () => {
    expect(hasRole(auth('cashier'), ['doctor', 'nurse'])).toBe(false);
    expect(hasRole(auth('lab_tech'), ['doctor'])).toBe(false);
  });

  // --- the defect ---------------------------------------------------------
  test.each([
    ['triage_nurse', 'nurse'],
    ['rooming_nurse', 'nurse'],
    ['clinician', 'doctor'],
    ['central_registration_clerk', 'front_desk'],
    ['clinic_clerk', 'front_desk'],
    ['records_hmis_officer', 'hrio'],
  ] as Array<[UserRole, UserRole]>)(
    '%s is accepted wherever %s is allowed',
    (station, legacy) => {
      expect(hasRole(auth(station), [legacy])).toBe(true);
    },
  );

  test('triage_nurse can reach the triage route allow-list', () => {
    // The exact list from src/app/api/triage/route.ts at the time of the audit.
    const TRIAGE_READ: UserRole[] = [
      'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'clinician',
      'nurse', 'front_desk', 'medical_superintendent',
    ];
    expect(hasRole(auth('triage_nurse'), TRIAGE_READ)).toBe(true);
  });

  // --- the limit ----------------------------------------------------------
  // The station must not pick up authority its equivalent does not have.
  test('a station role gains nothing beyond its legacy equivalent', () => {
    // `nurse` is not on this list, so neither is triage_nurse — even though
    // triage_nurse ALSO maps to clinical_officer in the migration table.
    // Honouring that second mapping would hand a triage nurse prescribing.
    const PRESCRIBERS: UserRole[] = ['doctor', 'clinical_officer', 'medical_superintendent'];
    expect(hasRole(auth('triage_nurse'), PRESCRIBERS)).toBe(false);
    expect(hasRole(auth('rooming_nurse'), PRESCRIBERS)).toBe(false);
  });

  test('clerk stations do not inherit clinical authority', () => {
    const CLINICAL: UserRole[] = ['doctor', 'clinical_officer', 'nurse'];
    expect(hasRole(auth('central_registration_clerk'), CLINICAL)).toBe(false);
    expect(hasRole(auth('clinic_clerk'), CLINICAL)).toBe(false);
  });

  test('records_hmis_officer does not inherit prescribing or dispensing', () => {
    expect(hasRole(auth('records_hmis_officer'), ['doctor', 'pharmacist'])).toBe(false);
  });

  test('no station role is granted super_admin or org_admin', () => {
    const admins: UserRole[] = ['super_admin', 'org_admin'];
    for (const station of [
      'triage_nurse', 'rooming_nurse', 'clinician',
      'central_registration_clerk', 'clinic_clerk', 'records_hmis_officer',
    ] as UserRole[]) {
      expect(hasRole(auth(station), admins)).toBe(false);
    }
  });
});
