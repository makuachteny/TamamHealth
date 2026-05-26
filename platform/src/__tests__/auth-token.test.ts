/**
 * @jest-environment node
 */

/**
 * Tests for JWT token creation and verification
 * Runs in node environment (jose requires proper Uint8Array)
 */
import { SignJWT, jwtVerify } from 'jose';

const secret = 'tamamhealth-south-sudan-health-2026-secret-key';
const JWT_SECRET = new TextEncoder().encode(secret);
const JWT_ISSUER = 'tamamhealth';
const JWT_AUDIENCE = 'tamamhealth-web';

async function createToken(user: { _id: string; username: string; role: string; name: string; hospitalId?: string }) {
  return new SignJWT({
    sub: user._id,
    username: user.username,
    role: user.role,
    name: user.name,
    hospitalId: user.hospitalId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as {
      sub: string; username: string; role: string; name: string; hospitalId?: string;
    };
  } catch {
    return null;
  }
}

const mockUser = {
  _id: 'user-dr.test',
  username: 'dr.test',
  role: 'doctor',
  name: 'Dr. Test',
  hospitalId: 'hosp-001',
};

describe('auth-token', () => {
  test('createToken returns a valid JWT string', async () => {
    const token = await createToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(token.split('.')).toHaveLength(3);
  });

  test('verifyToken returns payload for valid token', async () => {
    const token = await createToken(mockUser);
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(mockUser._id);
    expect(payload!.username).toBe(mockUser.username);
    expect(payload!.role).toBe(mockUser.role);
    expect(payload!.name).toBe(mockUser.name);
    expect(payload!.hospitalId).toBe(mockUser.hospitalId);
  });

  test('verifyToken returns null for invalid token', async () => {
    const payload = await verifyToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  test('verifyToken returns null for tampered token', async () => {
    const token = await createToken(mockUser);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await verifyToken(tampered);
    expect(payload).toBeNull();
  });

  test('verifyToken returns null for empty string', async () => {
    const payload = await verifyToken('');
    expect(payload).toBeNull();
  });

  test('createToken handles user without hospitalId', async () => {
    const govUser = { _id: 'user-admin', username: 'admin', role: 'government', name: 'Admin' };
    const token = await createToken(govUser);
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.role).toBe('government');
    expect(payload!.hospitalId).toBeUndefined();
  });

  test('token with wrong issuer is rejected', async () => {
    const token = await new SignJWT({ sub: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('wrong-issuer')
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime('24h')
      .sign(JWT_SECRET);
    const payload = await verifyToken(token);
    expect(payload).toBeNull();
  });

  test('token with wrong audience is rejected', async () => {
    const token = await new SignJWT({ sub: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience('wrong-audience')
      .setExpirationTime('24h')
      .sign(JWT_SECRET);
    const payload = await verifyToken(token);
    expect(payload).toBeNull();
  });
});
