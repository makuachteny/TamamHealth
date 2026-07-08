#!/usr/bin/env bash
#
# One-command onboarding for the TamamHealth monorepo.
# Checks Node, installs dependencies, seeds local env files, and installs the
# git pre-commit hooks. Idempotent — safe to re-run. Run from anywhere in the repo.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }

# ── 1. Node version ──────────────────────────────────────────────────────────
log "Checking Node"
if ! command -v node >/dev/null 2>&1; then
  warn "Node is not installed. Install Node 20+ (see .nvmrc), e.g. via nvm:  nvm install"
  exit 1
fi
have="$(node -v | sed 's/^v//')"
want=""
[ -f .nvmrc ] && want="$(tr -d '[:space:]' < .nvmrc)"
if [ -n "$want" ] && [ "${have%%.*}" != "${want%%.*}" ]; then
  warn "Node $have does not match .nvmrc ($want). Run 'nvm use' (or 'nvm install'). Continuing."
else
  ok "Node $have"
fi

# ── 2. Dependencies (root tooling + apps that have a lockfile) ────────────────
# Root install (if a root package.json exists) also wires the husky pre-commit
# hooks via its "prepare" script. `npm ci` is reproducible; fall back to
# `npm install` if the lockfile is temporarily out of sync.
for dir in . platform website mobile; do
  [ -f "$dir/package.json" ] || continue
  log "Installing deps: ${dir#.}${dir:+/}"
  ( cd "$dir" && { npm ci 2>/dev/null || { warn "npm ci failed (lockfile drift) — using npm install"; npm install; }; } )
  ok "deps installed: $dir"
done

# ── 3. Local env files (never overwrite an existing .env.local) ──────────────
log "Seeding local env"
for dir in . platform mobile; do
  if [ -f "$dir/.env.example" ] && [ ! -f "$dir/.env.local" ]; then
    cp "$dir/.env.example" "$dir/.env.local"
    ok "created $dir/.env.local"
  fi
done
# Gotcha: platform's boot-time migration hook aborts ("STARTUP REFUSED") if
# DATABASE_URL points at a Postgres that isn't running. Local dev is offline-first
# (PouchDB), so disable it out of the box.
if [ -f platform/.env.local ] && grep -q '^DATABASE_URL=' platform/.env.local; then
  # Comment the line (keeping the value, so it's easy to re-enable). Why it's
  # disabled: see the "Gotchas" section in CONTRIBUTING.md.
  sed -i.bak 's|^DATABASE_URL=|# DATABASE_URL=|' platform/.env.local
  rm -f platform/.env.local.bak
  ok "disabled DATABASE_URL in platform/.env.local (offline-first — re-enable by uncommenting)"
fi

# ── 4. Done ──────────────────────────────────────────────────────────────────
log "Setup complete"
cat <<'NEXT'
  Start an app:
    cd platform && npm run dev     # http://localhost:3000
    cd website  && npm run dev     # http://localhost:3001

  Gotchas:
    - vendor-chunk 500s after switching branches?   rm -rf platform/.next
    - commit blocked by lint/type errors?           fix them, or 'git commit --no-verify' in a pinch
NEXT
