#!/usr/bin/env node
// =============================================================================
// TamamHealth License Key Utilities
// =============================================================================
// Offline-verifiable license keys using HMAC-SHA256.
//
// Key format:  TAMAMHEALTH-<orgSlug>-<expiry>-<signature>
// Example:     TAMAMHEALTH-juba-teaching-hospital-20270101-a1b2c3d4e5f6
//
// The key encodes the organization name and expiry date, signed with a secret.
// Verification is offline — no network call needed (critical for South Sudan).
// =============================================================================

import { createHmac } from 'crypto';

// This secret is used to sign and verify license keys.
// IMPORTANT: Keep this secret. It should only exist in this admin tool,
// never in the distributed platform code. The platform only needs the
// verify function with the same secret embedded at build time.
const LICENSE_SECRET = process.env.TAMAMHEALTH_LICENSE_SECRET || 'tamamhealth-2026-license-signing-key';

/**
 * Generate a license key for an organization.
 * @param {string} org - Organization name (e.g., "Juba Teaching Hospital")
 * @param {string} expiry - Expiry date as YYYYMMDD (e.g., "20270101")
 * @param {string} plan - License plan: "standard" | "professional" | "enterprise"
 * @returns {string} License key
 */
export function generateLicenseKey(org, expiry, plan = 'standard') {
  const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const payload = `${slug}:${expiry}:${plan}`;
  const sig = createHmac('sha256', LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);
  return `TAMAMHEALTH-${slug}-${expiry}-${plan}-${sig}`;
}

/**
 * Verify a license key. Returns the parsed license or null if invalid.
 * @param {string} key - License key to verify
 * @returns {{ org: string, expiry: string, plan: string, valid: boolean, expired: boolean } | null}
 */
export function verifyLicenseKey(key) {
  if (!key || !key.startsWith('TAMAMHEALTH-')) return null;

  const parts = key.split('-');
  // Format: TAMAMHEALTH-<org-slug-parts>-<YYYYMMDD>-<plan>-<signature>
  // The org slug can contain hyphens, so we need to parse from the end.
  if (parts.length < 5) return null;

  const sig = parts[parts.length - 1];
  const plan = parts[parts.length - 2];
  const expiry = parts[parts.length - 3];

  if (!/^\d{8}$/.test(expiry)) return null;
  if (!['standard', 'professional', 'enterprise', 'trial'].includes(plan)) return null;

  // Reconstruct the org slug (everything between TAMAMHEALTH- and -expiry-plan-sig)
  const slug = parts.slice(1, parts.length - 3).join('-');
  if (!slug) return null;

  // Verify signature
  const payload = `${slug}:${expiry}:${plan}`;
  const expectedSig = createHmac('sha256', LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);

  if (sig !== expectedSig) return null;

  // Check expiry
  const now = new Date();
  const expiryDate = new Date(
    parseInt(expiry.slice(0, 4)),
    parseInt(expiry.slice(4, 6)) - 1,
    parseInt(expiry.slice(6, 8))
  );
  const expired = now > expiryDate;

  return {
    org: slug.replace(/-/g, ' '),
    expiry,
    plan,
    valid: true,
    expired,
  };
}

// ---------------------------------------------------------------------------
// CLI: Generate license keys
// ---------------------------------------------------------------------------
// Usage:
//   node scripts/license.mjs generate "Juba Teaching Hospital" 20270101 standard
//   node scripts/license.mjs verify TAMAMHEALTH-juba-teaching-hospital-20270101-standard-a1b2c3d4
// ---------------------------------------------------------------------------
const [,, command, ...args] = process.argv;

if (command === 'generate') {
  const [org, expiry, plan] = args;
  if (!org || !expiry) {
    console.log('Usage: node scripts/license.mjs generate "<org name>" <YYYYMMDD> [plan]');
    console.log('Plans: trial, standard, professional, enterprise');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/license.mjs generate "Juba Teaching Hospital" 20270101 standard');
    process.exit(1);
  }
  const key = generateLicenseKey(org, expiry, plan || 'standard');
  console.log('');
  console.log('  License key generated:');
  console.log(`  ${key}`);
  console.log('');
  console.log(`  Organization: ${org}`);
  console.log(`  Expires:      ${expiry.slice(0, 4)}-${expiry.slice(4, 6)}-${expiry.slice(6, 8)}`);
  console.log(`  Plan:         ${plan || 'standard'}`);
  console.log('');
  console.log('  Send this key to the customer. They enter it during setup.');
  console.log('');
} else if (command === 'verify') {
  const [key] = args;
  if (!key) {
    console.log('Usage: node scripts/license.mjs verify <license-key>');
    process.exit(1);
  }
  const result = verifyLicenseKey(key);
  if (!result) {
    console.log('  Invalid license key.');
    process.exit(1);
  }
  console.log('');
  console.log(`  Valid:        ${result.valid}`);
  console.log(`  Organization: ${result.org}`);
  console.log(`  Plan:         ${result.plan}`);
  console.log(`  Expires:      ${result.expiry.slice(0, 4)}-${result.expiry.slice(4, 6)}-${result.expiry.slice(6, 8)}`);
  console.log(`  Expired:      ${result.expired}`);
  console.log('');
} else if (command) {
  console.log(`Unknown command: ${command}`);
  console.log('Commands: generate, verify');
  process.exit(1);
}
