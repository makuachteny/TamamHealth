/**
 * Tests for field-level encryption at rest (AES-256-GCM).
 */
import {
  encryptField,
  decryptField,
  isEncrypted,
  maybeDecrypt,
  EncryptionKeyError,
} from '@/lib/field-encryption';
import { randomBytes } from 'crypto';

const KEY = randomBytes(32);

describe('Field encryption (AES-256-GCM)', () => {
  test('round-trips plaintext', () => {
    const ct = encryptField('Plasmodium falciparum — patient PHI', KEY);
    expect(ct).not.toContain('Plasmodium');
    expect(isEncrypted(ct)).toBe(true);
    expect(decryptField(ct, KEY)).toBe('Plasmodium falciparum — patient PHI');
  });

  test('produces a different ciphertext each time (random IV) but decrypts the same', () => {
    const a = encryptField('same input', KEY);
    const b = encryptField('same input', KEY);
    expect(a).not.toBe(b);
    expect(decryptField(a, KEY)).toBe('same input');
    expect(decryptField(b, KEY)).toBe('same input');
  });

  test('encrypt is idempotent (does not double-encrypt)', () => {
    const once = encryptField('x', KEY);
    expect(encryptField(once, KEY)).toBe(once);
  });

  test('decrypt returns non-envelope values unchanged (tolerates un-migrated plaintext)', () => {
    expect(decryptField('plain text', KEY)).toBe('plain text');
    expect(maybeDecrypt('plain text')).toBe('plain text');
  });

  test('tampered ciphertext fails the GCM integrity check', () => {
    const ct = encryptField('secret', KEY);
    const parts = ct.split(':');
    // Flip a character in the ciphertext body.
    parts[4] = parts[4].slice(0, -1) + (parts[4].slice(-1) === 'A' ? 'B' : 'A');
    expect(() => decryptField(parts.join(':'), KEY)).toThrow();
  });

  test('a wrong key cannot decrypt', () => {
    const ct = encryptField('secret', KEY);
    expect(() => decryptField(ct, randomBytes(32))).toThrow();
  });

  test('rejects a non-32-byte env key', () => {
    const prev = process.env.PHI_ENCRYPTION_KEY;
    process.env.PHI_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
    expect(() => encryptField('x')).toThrow(EncryptionKeyError);
    process.env.PHI_ENCRYPTION_KEY = prev;
  });
});
