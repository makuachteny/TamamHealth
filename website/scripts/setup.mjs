#!/usr/bin/env node
// =============================================================================
// TamamHealth Website — Setup Script
// =============================================================================
// Cross-platform (Windows, macOS, Linux) first-time setup.
//
// Usage:
//   node scripts/setup.mjs          # Interactive setup
//   node scripts/setup.mjs --quick  # Accept all defaults
// =============================================================================

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function log(msg) { console.log(msg); }
function info(msg) { log(`${CYAN}[info]${RESET} ${msg}`); }
function success(msg) { log(`${GREEN}[done]${RESET} ${msg}`); }
function warn(msg) { log(`${YELLOW}[warn]${RESET} ${msg}`); }
function heading(msg) { log(`\n${BOLD}${msg}${RESET}`); }

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultValue) {
  const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : '';
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function main() {
  const isQuick = process.argv.includes('--quick');

  log('');
  log(`${BOLD}${GREEN}  TamamHealth Website Setup${RESET}`);
  log(`${DIM}  Marketing site for TamamHealth Health${RESET}`);
  log('');

  // ---- Step 1: Check Node version ----
  heading('1. Checking prerequisites');

  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split('.').map(Number);
  if (major < 18) {
    log(`  Node.js ${nodeVersion} detected — requires >= 18.0.0`);
    process.exit(1);
  }
  success(`Node.js ${nodeVersion}`);

  // ---- Step 2: Create .env.local ----
  heading('2. Environment configuration');

  const envPath = join(ROOT, '.env.local');
  const envExamplePath = join(ROOT, '.env.example');

  if (existsSync(envPath)) {
    info('.env.local already exists — skipping.');
  } else if (!existsSync(envExamplePath)) {
    warn('.env.example not found.');
  } else {
    let envContent = readFileSync(envExamplePath, 'utf-8');

    if (!isQuick) {
      log('');
      info('Email is optional — contact forms log to console without it.');
      log('');

      const wantEmail = await ask('Configure email provider? [yes/no]', 'no');
      if (wantEmail.toLowerCase().startsWith('y')) {
        const provider = await ask('Provider [resend/sendgrid]', 'resend');
        const apiKey = await ask(`${provider === 'sendgrid' ? 'SENDGRID' : 'RESEND'} API key`);
        const fromEmail = await ask('From email', 'noreply@tamamhealth.org');
        const notifyEmail = await ask('Send submissions to', 'hello@tamamhealth.org');

        if (provider === 'sendgrid') {
          envContent = envContent.replace('# SENDGRID_API_KEY=', `SENDGRID_API_KEY=${apiKey}`);
        } else {
          envContent = envContent.replace('# RESEND_API_KEY=', `RESEND_API_KEY=${apiKey}`);
        }
        envContent = envContent.replace('# DEMO_FROM_EMAIL=noreply@tamamhealth.org', `DEMO_FROM_EMAIL=${fromEmail}`);
        envContent = envContent.replace('# DEMO_NOTIFY_EMAIL=your-email@example.com', `DEMO_NOTIFY_EMAIL=${notifyEmail}`);
      }
    }

    writeFileSync(envPath, envContent, 'utf-8');
    success('Created .env.local');
  }

  // ---- Step 3: Install dependencies ----
  heading('3. Installing dependencies');

  if (existsSync(join(ROOT, 'node_modules', 'next'))) {
    info('node_modules already exists — skipping.');
  } else {
    info('Running npm install...');
    try {
      execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
      success('Dependencies installed');
    } catch {
      warn('npm install failed — try running it manually.');
    }
  }

  // ---- Step 4: Summary ----
  heading('4. Ready!');
  log('');
  log(`  Start the development server:`);
  log(`  ${BOLD}${GREEN}npm run dev${RESET}`);
  log('');
  log(`  Then open ${CYAN}http://localhost:3001${RESET}`);
  log('');
  log(`  ${DIM}Other commands:${RESET}`);
  log(`  ${DIM}  npm run build    Build for production${RESET}`);
  log(`  ${DIM}  npm run lint     Run linter${RESET}`);
  log('');

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
