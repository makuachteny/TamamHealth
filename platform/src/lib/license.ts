/**
 * TamamHealth License Validation — runtime license key verification.
 *
 * License keys are HMAC-SHA256 signed and verified offline (no network needed).
 * Format: TAMAMHEALTH-<org-slug>-<YYYYMMDD>-<plan>-<signature>
 */

import { createHmac } from 'crypto';

/**
 * License signing secret. In production it MUST come from the environment
 * (validated fail-closed at boot in lib/config-validation.ts); the compiled-in
 * fallback exists only for local dev / tooling. A missing secret in production
 * yields an empty key, so every verification fails closed rather than trusting
 * the public default.
 */
const LICENSE_SECRET =
  process.env.TAMAMHEALTH_LICENSE_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : 'tamamhealth-2026-license-signing-key');

export type LicenseInfo = {
  org: string;
  expiry: string;
  plan: 'trial' | 'standard' | 'professional' | 'enterprise';
  valid: boolean;
  expired: boolean;
};

/**
 * Verify a license key. Returns parsed info or null if the key is invalid.
 * Works fully offline — no network call.
 */
export function verifyLicenseKey(key: string | undefined): LicenseInfo | null {
  if (!key || !/^TAMAMHEALTH-/i.test(key)) return null;

  const parts = key.split('-');
  if (parts.length < 5) return null;

  const sig = parts[parts.length - 1];
  const plan = parts[parts.length - 2] as LicenseInfo['plan'];
  const expiry = parts[parts.length - 3];

  if (!/^\d{8}$/.test(expiry)) return null;
  if (!['standard', 'professional', 'enterprise', 'trial'].includes(plan)) return null;

  const slug = parts.slice(1, parts.length - 3).join('-');
  if (!slug) return null;

  const payload = `${slug}:${expiry}:${plan}`;
  const expectedSig = createHmac('sha256', LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);

  if (sig !== expectedSig) return null;

  const now = new Date();
  const expiryDate = new Date(
    parseInt(expiry.slice(0, 4)),
    parseInt(expiry.slice(4, 6)) - 1,
    parseInt(expiry.slice(6, 8))
  );

  return {
    org: slug.replace(/-/g, ' '),
    expiry,
    plan,
    valid: true,
    expired: now > expiryDate,
  };
}

/**
 * Read and verify the license from the TAMAMHEALTH_LICENSE_KEY env var.
 * Returns the license info, or null if missing/invalid.
 */
export function checkLicense(): LicenseInfo | null {
  return verifyLicenseKey(process.env.TAMAMHEALTH_LICENSE_KEY);
}
