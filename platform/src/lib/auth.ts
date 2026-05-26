import bcrypt from 'bcryptjs';
import { usersDB } from './db';
import type { UserDoc } from './db-types';

// Re-export token functions so existing imports still work
export { createToken, verifyToken } from './auth-token';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function getCurrentUser(token: string): Promise<UserDoc | null> {
  const { verifyToken } = await import('./auth-token');
  const payload = await verifyToken(token);
  if (!payload) return null;
  try {
    const db = usersDB();
    const user = await db.get(payload.sub) as UserDoc;
    return user;
  } catch {
    return null;
  }
}
