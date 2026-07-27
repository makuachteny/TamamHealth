import type { UserRole } from '@/lib/db-types';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import {
  getStoredRoleSettings,
  saveStoredRoleSettings,
  specForRole,
  type RoleSettingRow,
} from '@/lib/role-settings';

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[];
const REQUIRED_PERSONAL_SECTIONS = ['account', 'notifications', 'security'];

function editableRows(role: UserRole): RoleSettingRow[] {
  return specForRole(role).sections
    .flatMap(section => section.rows)
    .filter(row => row.kind === 'toggle' || row.kind === 'select' || row.kind === 'text');
}

describe('role settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test.each(ALL_ROLES)('provides a usable settings spec for %s', (role) => {
    const spec = specForRole(role);
    const sectionIds = spec.sections.map(section => section.id);

    expect(spec.title).toBeTruthy();
    expect(spec.subtitle).toBeTruthy();
    expect(spec.scope).toBeTruthy();
    expect(spec.chips.length).toBeGreaterThan(0);
    expect(spec.accent).toMatch(/^#/);

    for (const required of REQUIRED_PERSONAL_SECTIONS) {
      expect(sectionIds).toContain(required);
    }

    for (const section of spec.sections) {
      expect(section.title).toBeTruthy();
      expect(section.note).toBeTruthy();
      expect(section.rows.length).toBeGreaterThan(0);
    }
  });

  test.each(ALL_ROLES)('has unique editable setting keys for %s', (role) => {
    const keys = editableRows(role).map(row => 'key' in row ? row.key : '');
    expect(keys).not.toContain('');
    expect(new Set(keys).size).toBe(keys.length);
  });

  test.each(ALL_ROLES)('uses valid defaults for editable settings for %s', (role) => {
    for (const row of editableRows(role)) {
      if (row.kind === 'toggle') {
        expect(typeof row.def).toBe('boolean');
      }

      if (row.kind === 'text') {
        expect(typeof row.def).toBe('string');
      }

      if (row.kind === 'select') {
        expect(typeof row.def).toBe('string');
        if (row.key !== 'account.language') {
          expect(row.options).toContain(row.def);
        }
      }
    }
  });

  test.each(ALL_ROLES)('persists changed settings independently for %s', (role) => {
    const firstEditable = editableRows(role)[0];
    expect(firstEditable).toBeDefined();
    expect('key' in firstEditable).toBe(true);

    const key = 'key' in firstEditable ? firstEditable.key : '';
    saveStoredRoleSettings(`${role}-a`, { [key]: 'changed' });
    saveStoredRoleSettings(`${role}-b`, { [key]: 'other' });

    expect(getStoredRoleSettings(`${role}-a`)).toEqual({ [key]: 'changed' });
    expect(getStoredRoleSettings(`${role}-b`)).toEqual({ [key]: 'other' });
  });

  test('ignores corrupt stored settings instead of breaking the settings page', () => {
    window.localStorage.setItem('tamamhealth.roleSettings.bad-user', '{not-json');
    expect(getStoredRoleSettings('bad-user')).toEqual({});
  });
});
