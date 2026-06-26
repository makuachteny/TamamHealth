#!/usr/bin/env bash
# =============================================================================
# Deploy a SEPARATE "tamamhealth-v2" Vercel project from the current working
# tree (includes uncommitted changes). The existing "tamamhealth" project and
# its live deployment are left completely untouched.
#
# Prereq (do once): authenticate the Vercel CLI, either
#     vercel login                       # interactive
#   or export a token:
#     export VERCEL_TOKEN=xxxxxxxx        # from vercel.com/account/tokens
#
# Optional: set the team scope so v2 lands in the same team as v1:
#     export VERCEL_SCOPE=<your-team-slug>
#
# Then run:   bash platform/deploy-v2.sh
# =============================================================================
# Note: no `set -u` — macOS bash 3.2 errors on empty-array expansion under it.
set -eo pipefail
cd "$(dirname "$0")"                      # -> platform/

PROJECT="tamamhealth-v2"
ENV_FILE=".env.production"
TOKEN_FLAG=(); [[ -n "${VERCEL_TOKEN:-}" ]] && TOKEN_FLAG=(--token "$VERCEL_TOKEN")
SCOPE_FLAG=(); [[ -n "${VERCEL_SCOPE:-}" ]] && SCOPE_FLAG=(--scope "$VERCEL_SCOPE")

say() { printf '\033[1;36m[v2]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[v2:error]\033[0m %s\n' "$*" >&2; exit 1; }

# 0. Verify auth -------------------------------------------------------------
vercel whoami "${TOKEN_FLAG[@]}" >/dev/null 2>&1 \
  || die "Vercel CLI not authenticated. Run 'vercel login' (or set VERCEL_TOKEN) first."
say "Authenticated as: $(vercel whoami "${TOKEN_FLAG[@]}" 2>/dev/null)"

# 1. Preserve the existing project link --------------------------------------
if [[ -d .vercel && ! -d .vercel.tamamhealth.bak ]]; then
  cp -r .vercel .vercel.tamamhealth.bak
  say "Backed up existing project link -> .vercel.tamamhealth.bak"
fi
rm -rf .vercel                            # unlink so we can link a NEW project

# 2. Create/link the separate v2 project -------------------------------------
say "Linking new project: $PROJECT"
vercel link --yes --project "$PROJECT" "${SCOPE_FLAG[@]}" "${TOKEN_FLAG[@]}"

# 3. Seed env vars (Production scope) from .env.production --------------------
if [[ -f "$ENV_FILE" ]]; then
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
      echo "  ! $key (already set or failed — skipped)"
    fi
  done < "$ENV_FILE"
else
  say "No $ENV_FILE found — skipping env import (set vars manually in the dashboard)."
fi

# 4. Deploy to the v2 project's production -----------------------------------
say "Deploying to $PROJECT (production)…"
vercel deploy --prod --yes "${SCOPE_FLAG[@]}" "${TOKEN_FLAG[@]}"

say "Done. v2 is live on its own URL above; the original 'tamamhealth' project is untouched."
say "To CLI-deploy the original again, restore: rm -rf .vercel && mv .vercel.tamamhealth.bak .vercel"
