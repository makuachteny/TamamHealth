#!/usr/bin/env node
// =============================================================================
// TamamHealth Platform — Release Packaging Script
// =============================================================================
// Builds a distributable archive (.tar.gz and .zip) for customers.
// The archive contains the platform source code WITHOUT:
//   - node_modules, .env files, .git, license keys, admin scripts
//
// Usage:
//   node scripts/release.mjs                 # Package current version
//   node scripts/release.mjs --version 1.2.0 # Set version label
//
// Output:
//   dist/tamamhealth-platform-<version>.tar.gz
//   dist/tamamhealth-platform-<version>.zip
// =============================================================================

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Parse --version flag
const versionIndex = process.argv.indexOf('--version');
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const version = versionIndex !== -1
  ? process.argv[versionIndex + 1]
  : packageJson.version || '0.1.0';

const archiveName = `tamamhealth-platform-${version}`;
const stagingDir = join(DIST, archiveName);

console.log(`\n  Packaging TamamHealth Platform v${version}...\n`);

// Use a temp directory for staging to avoid copying into self
const STAGING_ROOT = join(tmpdir(), `tamamhealth-release-${Date.now()}`);
const stagingDirActual = join(STAGING_ROOT, archiveName);

// Clean previous builds
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true });
}
mkdirSync(DIST, { recursive: true });
mkdirSync(stagingDirActual, { recursive: true });

// Files/directories to EXCLUDE from the release
const EXCLUDE = new Set([
  'node_modules',
  '.next',
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.license',
  '.git',
  '.DS_Store',
  'dist',
  'coverage',
  '.vercel',
  '.claude',
  'scripts/license.mjs',   // Admin-only license generator
  'scripts/release.mjs',   // This script
]);

// Copy files, respecting exclusions
console.log('  Copying source files...');
cpSync(ROOT, stagingDirActual, {
  recursive: true,
  filter: (src) => {
    const relative = src.replace(ROOT, '').replace(/^[/\\]/, '');
    if (!relative) return true; // root dir itself
    const topLevel = relative.split(/[/\\]/)[0];
    return !EXCLUDE.has(topLevel) && !EXCLUDE.has(relative);
  },
});

// Remove the license generator from the staged copy (security)
const stagedLicenseGen = join(stagingDirActual, 'scripts', 'license.mjs');
if (existsSync(stagedLicenseGen)) rmSync(stagedLicenseGen);
const stagedRelease = join(stagingDirActual, 'scripts', 'release.mjs');
if (existsSync(stagedRelease)) rmSync(stagedRelease);

// Write INSTALL.txt into the archive
writeFileSync(join(stagingDirActual, 'INSTALL.txt'), `
================================================================================
  TAMAMHEALTH PLATFORM — Installation Guide
================================================================================

  Prerequisites:
    - Node.js 18+ (https://nodejs.org)
    - A license key from TamamHealth Health Technologies (support.tamam@gmail.com)

  Installation:

    1. Extract this archive to your desired location.

    2. Open a terminal and navigate to the extracted folder:
       cd ${archiveName}

    3. Run the setup script:
       npm run setup

       This will:
       - Verify your license key
       - Install all dependencies
       - Configure your environment
       - Generate secure secrets

    4. Start the application:
       npm run dev          (development)
       npm run build        (production build)
       npm start            (production server)

    5. Open http://localhost:3000 in your browser.

  Support:
    Email: support.tamam@gmail.com

================================================================================
`, 'utf-8');

// Create archives from staging dir
console.log('  Creating .tar.gz...');
execSync(`tar -czf "${join(DIST, `${archiveName}.tar.gz`)}" "${archiveName}"`, { cwd: STAGING_ROOT });

console.log('  Creating .zip...');
try {
  execSync(`zip -rq "${join(DIST, `${archiveName}.zip`)}" "${archiveName}"`, { cwd: STAGING_ROOT });
} catch {
  // zip may not be available on all systems
  console.log('  (zip not available — skipping .zip archive)');
}

// Clean up staging
rmSync(STAGING_ROOT, { recursive: true });

// Summary
const tarSize = (existsSync(join(DIST, `${archiveName}.tar.gz`))
  ? (readFileSync(join(DIST, `${archiveName}.tar.gz`)).length / 1024 / 1024).toFixed(1)
  : '?');

console.log(`\n  Release packaged successfully!`);
console.log(`  ${join(DIST, `${archiveName}.tar.gz`)} (${tarSize} MB)`);
if (existsSync(join(DIST, `${archiveName}.zip`))) {
  const zipSize = (readFileSync(join(DIST, `${archiveName}.zip`)).length / 1024 / 1024).toFixed(1);
  console.log(`  ${join(DIST, `${archiveName}.zip`)} (${zipSize} MB)`);
}
console.log(`\n  Send the archive + a license key to your customer.\n`);
