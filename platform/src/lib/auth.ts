import bcrypt from 'bcryptjs';

// Re-export token functions so existing imports still work
export { createToken, verifyToken } from './auth-token';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
