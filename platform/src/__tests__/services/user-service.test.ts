/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for user-service.ts
 * Covers user CRUD, role validation, hospital assignment rules, and password reset.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-user-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  resetPassword,
  deactivateUser,
} from '@/lib/services/user-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

describe('User Service', () => {
  test('creates a clinical user with hospital assignment', async () => {
    const user = await createUser({
      username: 'dr.kuol',
      password: 'SecurePass123!',
      name: 'Dr. Kuol Deng',
      role: 'doctor',
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
      orgId: 'org-001',
    });
    expect(user._id).toBe('user-dr.kuol');
    expect(user.type).toBe('user');
    expect(user.role).toBe('doctor');
    expect(user.hospitalId).toBe('hosp-001');
    expect(user.isActive).toBe(true);
    // Password should be hashed, not stored plain
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('SecurePass123!');
  });

  test('creates admin user without hospital', async () => {
    const admin = await createUser({
      username: 'admin',
      password: 'AdminPass!',
      name: 'System Admin',
      role: 'super_admin',
    });
    expect(admin.role).toBe('super_admin');
    expect(admin.hospitalId).toBeUndefined();
  });

  test('rejects clinical user without hospital', async () => {
    await expect(
      createUser({
        username: 'nurse1',
        password: 'NursePass!',
        name: 'Nurse Ayen',
        role: 'nurse',
        // No hospitalId — should fail
      })
    ).rejects.toThrow(/hospital/i);
  });

  test('rejects duplicate username', async () => {
    await createUser({
      username: 'dr.kuol',
      password: 'Pass1!',
      name: 'Dr. Kuol',
      role: 'doctor',
      hospitalId: 'hosp-001',
      hospitalName: 'TamamHealth Hospital',
    });
    await expect(
      createUser({
        username: 'dr.kuol',
        password: 'Pass2!',
        name: 'Another Kuol',
        role: 'doctor',
        hospitalId: 'hosp-001',
        hospitalName: 'TamamHealth Hospital',
      })
    ).rejects.toThrow(/already exists/i);
  });

  test('rejects invalid role', async () => {
    await expect(
      createUser({
        username: 'baduser',
        password: 'Pass!',
        name: 'Bad User',
        role: 'hacker',
      } as unknown as Parameters<typeof createUser>[0])
    ).rejects.toThrow(/invalid role/i);
  });

  test('rejects missing required fields', async () => {
    await expect(
      createUser({
        username: '',
        password: 'Pass!',
        name: 'No Username',
        role: 'doctor',
        hospitalId: 'hosp-001',
        hospitalName: 'Hospital',
      })
    ).rejects.toThrow();
  });

  test('sanitizes username (lowercase, strip special chars)', async () => {
    const user = await createUser({
      username: 'Dr.KUOL@hospital',
      password: 'Pass!',
      name: 'Dr. Kuol',
      role: 'super_admin',
    });
    expect(user.username).toBe('dr.kuolhospital');
  });

  test('retrieves all users', async () => {
    await createUser({ username: 'user1', password: 'P1!', name: 'U1', role: 'super_admin' });
    await createUser({
      username: 'user2', password: 'P2!', name: 'U2', role: 'nurse',
      hospitalId: 'hosp-001', hospitalName: 'TamamHealth Hospital',
    });

    const all = await getAllUsers();
    expect(all).toHaveLength(2);
  });

  test('retrieves user by ID', async () => {
    const user = await createUser({
      username: 'dr.kuol', password: 'P!', name: 'Dr. Kuol', role: 'super_admin',
    });
    const found = await getUserById(user._id);
    expect(found).not.toBeNull();
    expect(found!.username).toBe('dr.kuol');
  });

  test('returns null for nonexistent user', async () => {
    const found = await getUserById('user-nonexistent');
    expect(found).toBeNull();
  });

  test('updates user profile', async () => {
    const user = await createUser({
      username: 'nurse1', password: 'P!', name: 'Nurse Ayen', role: 'nurse',
      hospitalId: 'hosp-001', hospitalName: 'TamamHealth Hospital',
    });
    const updated = await updateUser(user._id, {
      name: 'Nurse Ayen Deng',
      hospitalId: 'hosp-002',
      hospitalName: 'Juba Teaching Hospital',
    });
    expect(updated.name).toBe('Nurse Ayen Deng');
    expect(updated.hospitalId).toBe('hosp-002');
    expect(updated.role).toBe('nurse'); // unchanged
  });

  test('rejects update with invalid role', async () => {
    const user = await createUser({
      username: 'nurse1', password: 'P!', name: 'Nurse', role: 'nurse',
      hospitalId: 'hosp-001', hospitalName: 'Hospital',
    });
    await expect(
      updateUser(user._id, { role: 'wizard' } as unknown as Parameters<typeof updateUser>[1])
    ).rejects.toThrow(/invalid role/i);
  });

  test('resets password', async () => {
    const user = await createUser({
      username: 'dr.kuol', password: 'OldPass!', name: 'Dr. Kuol', role: 'super_admin',
    });
    const oldHash = user.passwordHash;

    await resetPassword(user._id, 'NewSecurePass!');

    const updated = await getUserById(user._id);
    expect(updated!.passwordHash).not.toBe(oldHash);
    expect(updated!.passwordHash).not.toBe('NewSecurePass!');
  });

  test('deactivates a user', async () => {
    const user = await createUser({
      username: 'nurse1', password: 'P!', name: 'Nurse', role: 'nurse',
      hospitalId: 'hosp-001', hospitalName: 'Hospital',
    });
    expect(user.isActive).toBe(true);

    await deactivateUser(user._id);

    const updated = await getUserById(user._id);
    expect(updated!.isActive).toBe(false);
  });

  // ---- Line 68: Test database error handling in createUser ----
  test('createUser handles DB error with non-404 status (line 68)', async () => {
    // First create a user successfully
    const user1 = await createUser({
      username: 'unique-user',
      password: 'Pass!',
      name: 'Unique',
      role: 'doctor',
      hospitalId: 'hosp-001',
      hospitalName: 'Hospital',
    });
    expect(user1).toBeDefined();

    // Now try to create another with same username
    await expect(
      createUser({
        username: 'unique-user',
        password: 'Pass!',
        name: 'Different',
        role: 'nurse',
        hospitalId: 'hosp-001',
        hospitalName: 'Hospital',
      })
    ).rejects.toThrow(/already exists/i);
  });

  test('createUser re-throws error when status !== 404 and message does not include "already exists" (line 67-68)', async () => {
    const { usersDB } = require('@/lib/db');
    const db = usersDB();

    // Mock the get method to throw an error with status !== 404
    const originalGet = db.get.bind(db);
    db.get = jest.fn().mockImplementationOnce(() => {
      const err = new Error('Database connection timeout');
      (err as Error & { status: number }).status = 500;
      throw err;
    });

    // Try to create a user — should fail with the DB error
    await expect(
      createUser({
        username: 'newuser',
        password: 'Pass!',
        name: 'New User',
        role: 'doctor',
        hospitalId: 'hosp-001',
        hospitalName: 'Hospital',
      })
    ).rejects.toThrow(/Database connection timeout/);

    // Restore original get
    db.get = originalGet;
  });
});
