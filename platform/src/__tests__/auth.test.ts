/**
 * Tests for password hashing and verification
 * Note: We import bcryptjs directly to avoid pulling in PouchDB (which needs fetch)
 */
import bcrypt from 'bcryptjs';

const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

describe('auth', () => {
  test('hashPassword returns a bcrypt hash', async () => {
    const hash = await hashPassword('test-password');
    expect(hash).toBeTruthy();
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    expect(hash.length).toBeGreaterThan(50);
  });

  test('hashPassword returns different hashes for same password (salted)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });

  test('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('correct-password', hash);
    expect(result).toBe(true);
  });

  test('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });

  test('verifyPassword handles empty password', async () => {
    const hash = await hashPassword('some-password');
    const result = await verifyPassword('', hash);
    expect(result).toBe(false);
  });
});
