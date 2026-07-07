#!/usr/bin/env bash
# =============================================================================
# Deploy a SEPARATE "tamamhealth-v5" Vercel project from the current working
# tree (includes uncommitted changes). All other projects ("tamamhealth",
# "tamamhealth-v2", "tamamhealth-v4", ...) and their live deployments are left
# untouched.
#
# v5 is a FULL DEMO build: NEXT_PUBLIC_DEMO_MODE=true (via .env.v5.local) so the
# entire user roster + sample patient data seed into each browser on first load.
#
# Prereq (do once): authenticate the Vercel CLI, either
#     vercel login                       # interactive
#   or export a token:
#     export VERCEL_TOKEN=xxxxxxxx        # from vercel.com/account/tokens
#
# Optional: set the team scope so v5 lands in the same team as the others:
#     export VERCEL_SCOPE=<your-team-slug>
#
# Then run:   bash platform/deploy-v5.sh
# =============================================================================
# Note: no `set -u` — macOS bash 3.2 errors on empty-array expansion under it.
set -eo pipefail
cd "$(dirname "$0")"                      # -> platform/

PROJECT="tamamhealth-v5"
ENV_FILE=".env.v5.local"
TOKEN_FLAG=(); [[ -n "${VERCEL_TOKEN:-}" ]] && TOKEN_FLAG=(--token "$VERCEL_TOKEN")
SCOPE_FLAG=(); [[ -n "${VERCEL_SCOPE:-}" ]] && SCOPE_FLAG=(--scope "$VERCEL_SCOPE")

say() { printf '\033[1;36m[v5]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[v5:error]\033[0m %s\n' "$*" >&2; exit 1; }

# Restore whatever project was linked before this script ran, on any exit.
RESTORE_DIR=""
LINK_TOUCHED="false"
restore_link() {
  if [[ "$LINK_TOUCHED" == "true" ]]; then
    rm -rf .vercel
  fi
  if [[ -n "$RESTORE_DIR" && -d "$RESTORE_DIR" ]]; then
    mv "$RESTORE_DIR" .vercel
    say "Restored previous project link."
  fi
}
trap restore_link EXIT

# 0. Preserve the currently-linked project so we can restore it afterward ----
if [[ -d .vercel ]]; then
  RESTORE_DIR=".vercel.restore.$$"
  mv .vercel "$RESTORE_DIR"
  say "Saved current project link -> $RESTORE_DIR (restored on exit)"
fi

# 1. Verify auth -------------------------------------------------------------
vercel whoami "${TOKEN_FLAG[@]}" >/dev/null 2>&1 \
  || die "Vercel CLI not authenticated. Run 'vercel login' (or set VERCEL_TOKEN) first."
say "Authenticated as: $(vercel whoami "${TOKEN_FLAG[@]}" 2>/dev/null)"

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found. Create it (demo build env) before deploying."

# 2. Create/link the separate v5 project -------------------------------------
say "Linking new project: $PROJECT"
LINK_TOUCHED="true"
vercel link --yes --project "$PROJECT" "${SCOPE_FLAG[@]}" "${TOKEN_FLAG[@]}"

# 3. Seed env vars (Production scope) from .env.v5.local ----------------------
say "Importing env vars from $ENV_FILE"
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue
  key="${line%%=*}"; val="${line#*=}"
  key="${key//[[:space:]]/}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  [[ -z "$key" ]] && continue
  if printf '%s' "$val" | vercel env add "$key" production "${SCOPE_FLAG[@]}" "${TOKEN_FLAG[@]}" >/dev/null 2>&1; then
    echo "  + $key"
  else
    echo "  ! $key (already set or failed - skipped)"
  fi
done < "$ENV_FILE"

# 4. Deploy to the v5 project's production -----------------------------------
say "Deploying to $PROJECT (production)..."
vercel deploy --prod --yes "${SCOPE_FLAG[@]}" "${TOKEN_FLAG[@]}"

say "Done. v5 is live on its own URL above; all other projects are untouched."
say "Demo mode is ON - every browser seeds the full user roster + sample data on first load."
