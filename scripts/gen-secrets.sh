#!/usr/bin/env bash
# =============================================================================
# TamamHealth — generate the random secrets in your env files for you.
# =============================================================================
# Creates the three gitignored env files from their .example templates and
# fills in every REPLACE-with-* random secret with a strong generated value,
# so you never hand-write a key. It leaves the genuinely manual placeholders
# (your domain, third-party provider API keys) untouched and lists them at the
# end as your TODO.
#
# Usage:
#   ./scripts/gen-secrets.sh            # create missing env files; never clobber
#   ./scripts/gen-secrets.sh --force    # regenerate ALL secrets (overwrites!)
#   ./scripts/gen-secrets.sh --dry-run  # show what it would do, write nothing
#
# Safe by default: it refuses to overwrite an existing env file unless --force,
# so it can't destroy secrets you've already deployed.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORCE=0; DRY=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "unknown arg: $arg"; exit 2 ;;
  esac
done

cyan()  { printf '\033[1;36m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[1;33m%s\033[0m\n' "$*"; }

command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }

# A single webhook secret must be IDENTICAL in root .env and platform — generate
# it once and reuse it across files.
SHARED_WEBHOOK="$(openssl rand -hex 32)"

# Pick a generated value based on the variable name.
gen_value() {
  local key="$1"
  case "$key" in
    *WEBHOOK*)            printf '%s' "$SHARED_WEBHOOK" ;;
    *JWT*)                openssl rand -base64 48 | tr -d '\n' ;;
    *HEX*|*HMAC*)         openssl rand -hex 32 ;;
    *)                    openssl rand -base64 24 | tr -d '\n/+=' ;;  # passwords
  esac
}

# Fill one file: copy example → target, replace KEY=REPLACE-* lines with secrets.
process() {
  local example="$1" target="$2"
  [ -f "$example" ] || { yellow "  (no template $example — skipping)"; return; }

  if [ -f "$target" ] && [ "$FORCE" -eq 0 ]; then
    yellow "  ✓ $target already exists — leaving it untouched (use --force to regenerate)"
    return
  fi

  local tmp; tmp="$(mktemp)"
  local filled=0
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=REPLACE ]]; then
      local key="${BASH_REMATCH[1]}"
      printf '%s=%s\n' "$key" "$(gen_value "$key")" >> "$tmp"
      filled=$((filled+1))
    else
      printf '%s\n' "$line" >> "$tmp"
    fi
  done < "$example"

  if [ "$DRY" -eq 1 ]; then
    green "  would write $target  (filled $filled secret(s))"
    rm -f "$tmp"
  else
    mv "$tmp" "$target"; chmod 600 "$target"
    green "  ✓ wrote $target  (filled $filled secret(s), chmod 600)"
  fi
}

cyan "TamamHealth — generating env secrets$([ "$DRY" -eq 1 ] && echo ' (dry run)')"
process ".env.example"                          ".env"
process "platform/.env.production.example"      "platform/.env.production"
process "website/.env.production.example"       "website/.env.production"

echo
cyan "Manual values YOU still need to set (no secret can fill these):"
yellow "  • Your domain — replace 'your-domain'/'your-org' placeholders, esp."
yellow "      NEXT_PUBLIC_COUCHDB_URL and NEXT_PUBLIC_APP_URL in platform/.env.production"
yellow "  • NEXT_PUBLIC_SYNC_ENABLED=true once CouchDB is reachable over TLS"
yellow "  • Any third-party keys you actually use (email/SMS/payments) — left blank/commented"
echo
green "Done. These files are gitignored — never commit them."
green "Re-run scripts/preflight.sh before building to confirm nothing's missing."
