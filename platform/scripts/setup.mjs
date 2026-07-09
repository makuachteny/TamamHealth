#!/usr/bin/env node
// =============================================================================
// TamamHealth Platform — Setup Script
// =============================================================================
// Cross-platform (Windows, macOS, Linux) first-time setup.
// Requires a valid license key issued by TamamHealth Health Technologies.
//
// Usage:
//   node scripts/setup.mjs                            # Interactive setup
//   node scripts/setup.mjs --key TAMAMHEALTH-xxx-xxx-xxx    # Provide key as argument
// =============================================================================

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { randomBytes, createHmac } from 'crypto';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function log(msg) { console.log(msg); }
function info(msg) { log(`${CYAN}[info]${RESET} ${msg}`); }
function success(msg) { log(`${GREEN}[done]${RESET} ${msg}`); }
function warn(msg) { log(`${YELLOW}[warn]${RESET} ${msg}`); }
function error(msg) { log(`${RED}[error]${RESET} ${msg}`); }
function heading(msg) { log(`\n${BOLD}${msg}${RESET}`); }

// ---------------------------------------------------------------------------
// License verification (matches platform/src/lib/license.ts)
// ---------------------------------------------------------------------------
const LICENSE_SECRET = process.env.TAMAMHEALTH_LICENSE_SECRET || 'tamamhealth-2026-license-signing-key';

function verifyLicenseKey(key) {
  if (!key || !key.startsWith('TAMAMHEALTH-')) return null;
  const parts = key.split('-');
  if (parts.length < 5) return null;

  const sig = parts[parts.length - 1];
  const plan = parts[parts.length - 2];
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

// ---------------------------------------------------------------------------
// Readline helper
// ---------------------------------------------------------------------------
const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultValue) {
  const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : '';
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function close() { rl.close(); }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Parse --key argument
  const keyIndex = process.argv.indexOf('--key');
  let licenseKeyArg = keyIndex !== -1 ? process.argv[keyIndex + 1] : null;

  log('');
  log(`${BOLD}${GREEN}  TamamHealth Platform Setup${RESET}`);
  log(`${DIM}  Digital Health Records for South Sudan${RESET}`);
  log(`${DIM}  Copyright (c) 2026 TamamHealth Health Technologies${RESET}`);
  log('');

  // ---- Step 1: License key ----
  heading('1. License verification');

  const licensePath = join(ROOT, '.license');
  let licenseKey = licenseKeyArg;
  let licenseInfo = null;

  // Check if license already exists
  if (existsSync(licensePath) && !licenseKey) {
    licenseKey = readFileSync(licensePath, 'utf-8').trim();
    licenseInfo = verifyLicenseKey(licenseKey);
    if (licenseInfo && !licenseInfo.expired) {
      success(`Licensed to: ${licenseInfo.org} (${licenseInfo.plan}, expires ${licenseInfo.expiry.slice(0, 4)}-${licenseInfo.expiry.slice(4, 6)}-${licenseInfo.expiry.slice(6, 8)})`);
    } else if (licenseInfo && licenseInfo.expired) {
      warn('License has expired. Please contact support.tamam@gmail.com to renew.');
      licenseKey = null;
      licenseInfo = null;
    } else {
      warn('Stored license is invalid.');
      licenseKey = null;
    }
  }

  // Ask for license key if not provided or invalid
  if (!licenseInfo) {
    if (!licenseKey) {
      log('');
      info('A valid license key is required to use TamamHealth.');
      info('Contact support.tamam@gmail.com to obtain a license.');
      log('');
      licenseKey = await ask('Enter your license key');
    }

    if (!licenseKey) {
      error('No license key provided. Setup cannot continue.');
      log(`  ${DIM}Contact support.tamam@gmail.com to purchase a license.${RESET}`);
      log('');
      close();
      process.exit(1);
    }

    licenseInfo = verifyLicenseKey(licenseKey);

    if (!licenseInfo) {
      error('Invalid license key. Please check and try again.');
      log(`  ${DIM}Contact support.tamam@gmail.com if you need assistance.${RESET}`);
      log('');
      close();
      process.exit(1);
    }

    if (licenseInfo.expired) {
      error(`License expired on ${licenseInfo.expiry.slice(0, 4)}-${licenseInfo.expiry.slice(4, 6)}-${licenseInfo.expiry.slice(6, 8)}.`);
      log(`  ${DIM}Contact support.tamam@gmail.com to renew your license.${RESET}`);
      log('');
      close();
      process.exit(1);
    }

    // Save the valid license key
    writeFileSync(licensePath, licenseKey, 'utf-8');
    success(`Licensed to: ${licenseInfo.org} (${licenseInfo.plan}, expires ${licenseInfo.expiry.slice(0, 4)}-${licenseInfo.expiry.slice(4, 6)}-${licenseInfo.expiry.slice(6, 8)})`);
  }

  // ---- Step 2: Check Node version ----
  heading('2. Checking prerequisites');

  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split('.').map(Number);
  if (major < 18) {
    log(`  Node.js ${nodeVersion} detected — requires >= 18.0.0`);
    log('  Please upgrade Node.js: https://nodejs.org');
    close();
    process.exit(1);
  }
  success(`Node.js ${nodeVersion}`);

  // ---- Step 3: Create .env.local ----
  heading('3. Environment configuration');

  const envPath = join(ROOT, '.env.local');
  const envExamplePath = join(ROOT, '.env.example');

  if (existsSync(envPath)) {
    // Ensure the license key is in the env file
    let envContent = readFileSync(envPath, 'utf-8');
    if (!envContent.includes('TAMAMHEALTH_LICENSE_KEY=')) {
      envContent += `\n# License\nTAMAMHEALTH_LICENSE_KEY=${licenseKey}\n`;
      writeFileSync(envPath, envContent, 'utf-8');
      info('Added license key to existing .env.local');
    } else {
      info('.env.local already exists — skipping.');
    }
  } else if (!existsSync(envExamplePath)) {
    warn('.env.example not found — cannot create .env.local');
  } else {
    let envContent = readFileSync(envExamplePath, 'utf-8');

    // Add license key
    envContent = `# License key (issued by TamamHealth Health Technologies)\nTAMAMHEALTH_LICENSE_KEY=${licenseKey}\n\n${envContent}`;

    // Generate a random JWT secret (server-side only — never NEXT_PUBLIC_*)
    const jwtSecret = randomBytes(48).toString('base64');
    envContent = envContent.replace(
      'JWT_SECRET=',
      `JWT_SECRET=${jwtSecret}`
    );

    // Set org name from license
    envContent = envContent.replace(
      'NEXT_PUBLIC_ORG_NAME=My Organization',
      `NEXT_PUBLIC_ORG_NAME=${licenseInfo.org.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
    );

    log('');
    info('Configuring your environment...');
    log('');

    const mode = await ask('Demo mode? (loads sample data for testing) [yes/no]', 'yes');
    const isDemo = mode.toLowerCase().startsWith('y');
    envContent = envContent.replace(
      'NEXT_PUBLIC_DEMO_MODE=true',
      `NEXT_PUBLIC_DEMO_MODE=${isDemo}`
    );

    if (!isDemo) {
      log('');
      info('Production setup — configure your admin account:');
      const adminName = await ask('Admin full name', 'System Administrator');
      const adminPass = await ask(
        'Admin password (leave blank to auto-generate; saved to .seed-credentials.json)',
        '',
      );
      const orgEmail = await ask('Organization email', 'support.tamam@gmail.com');
      const orgCountry = await ask('Country', 'South Sudan');

      envContent = envContent.replace(
        'NEXT_PUBLIC_ADMIN_NAME=System Administrator',
        `NEXT_PUBLIC_ADMIN_NAME=${adminName}`,
      );
      // ADMIN_INITIAL_PASSWORD is server-only by design (commented out in
      // .env.example). Uncomment + fill it only if the operator typed one.
      if (adminPass) {
        envContent = envContent.replace(
          '# ADMIN_INITIAL_PASSWORD=',
          `ADMIN_INITIAL_PASSWORD=${adminPass}`,
        );
      }
      envContent = envContent.replace(
        'NEXT_PUBLIC_ORG_EMAIL=support.tamam@gmail.com',
        `NEXT_PUBLIC_ORG_EMAIL=${orgEmail}`,
      );
      envContent = envContent.replace(
        'NEXT_PUBLIC_ORG_COUNTRY=South Sudan',
        `NEXT_PUBLIC_ORG_COUNTRY=${orgCountry}`,
      );
    }

    const wantDb = await ask('Set up PostgreSQL connection? [yes/no]', 'no');
    if (wantDb.toLowerCase().startsWith('y')) {
      const dbUrl = await ask('DATABASE_URL', 'postgresql://tamamhealth:password@localhost:5432/safeguard_junub');
      envContent = envContent.replace(
        'DATABASE_URL=postgresql://tamamhealth:password@localhost:5432/safeguard_junub',
        `DATABASE_URL=${dbUrl}`
      );
    }

    writeFileSync(envPath, envContent, 'utf-8');
    success('Created .env.local with secure JWT secret');
  }

  // ---- Step 4: Install dependencies ----
  heading('4. Installing dependencies');

  if (existsSync(join(ROOT, 'node_modules', 'next'))) {
    info('node_modules already exists — skipping install.');
    info('Run "npm install" manually to update.');
  } else {
    info('Running npm install (this may take a minute)...');
    try {
      execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
      success('Dependencies installed');
    } catch {
      warn('npm install failed — try running it manually.');
    }
  }

  // ---- Step 5: Database setup guidance ----
  heading('5. Database setup (optional)');

  const envFile = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const hasDb = envFile.includes('DATABASE_URL=') && !envFile.includes('DATABASE_URL=postgresql://tamamhealth:password@localhost:5432/safeguard_junub');

  log(`  ${DIM}The app works fully offline with browser-based PouchDB.${RESET}`);
  log(`  ${DIM}PostgreSQL is only needed for national analytics & government dashboards.${RESET}`);
  log('');

  if (hasDb) {
    info('DATABASE_URL is configured. To initialize the schema:');
    log(`  ${CYAN}npm run db:migrate${RESET}`);
    log(`  ${DIM}(Migrations also run automatically at app startup.)${RESET}`);
  } else {
    info('No PostgreSQL configured. To add it later:');
    log(`  ${DIM}1. Create a database: createdb safeguard_junub${RESET}`);
    log(`  ${DIM}2. Set DATABASE_URL in .env.local${RESET}`);
    log(`  ${DIM}3. Run migrations:    npm run db:migrate${RESET}`);
  }

  // ---- Step 6: Summary ----
  heading('6. Ready!');
  log('');
  log(`  Start the server:`);
  log(`  ${BOLD}${GREEN}npm run dev${RESET}`);
  log('');
  log(`  Then open ${CYAN}http://localhost:3000${RESET}`);
  log('');

  if (envFile.includes('NEXT_PUBLIC_DEMO_MODE=true') || !existsSync(envPath)) {
    log(`  ${BOLD}Demo credentials:${RESET}`);
    log(`  ${DIM}A random password is generated for every demo user on first${RESET}`);
    log(`  ${DIM}server boot and written to:${RESET}`);
    log(`  ${CYAN}    platform/.seed-credentials.json${RESET} ${DIM}(gitignored, mode 0600)${RESET}`);
    log(`  ${DIM}You can also fetch them at runtime via:${RESET}`);
    log(`  ${CYAN}    curl http://localhost:3000/api/demo-credentials${RESET}`);
    log(`  ${DIM}or click any role chip on the login page (auto-fills the form).${RESET}`);
    log('');
  }

  log(`  ${DIM}Other commands:${RESET}`);
  log(`  ${DIM}  npm run build    Build for production${RESET}`);
  log(`  ${DIM}  npm test         Run test suite${RESET}`);
  log(`  ${DIM}  npm run lint     Run linter${RESET}`);
  log('');

  close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
