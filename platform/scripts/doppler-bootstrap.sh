#!/usr/bin/env bash
# =============================================================================
# doppler-bootstrap.sh — one-shot uploader for an existing .env.production into
# a Doppler project + config. Idempotent: re-running with the same file
# overwrites the same keys. Lines that look like comments, blanks, or
# placeholder values are skipped.
#
# Usage:
#   ./platform/scripts/doppler-bootstrap.sh \
#       --project tamamhealth \
#       --config  prd \
#       --file    platform/.env.production
#
#   Optional:
#       --dry-run     # show what would be uploaded, don't actually touch Doppler
#
# Prerequisites:
#   - `doppler` CLI installed and authenticated (`doppler login`).
#   - The target project + config already exist
#     (`doppler projects create` / `doppler configs create`).
#
# This script will REFUSE to run if:
#   - doppler CLI is missing,
#   - you are not logged in,
#   - the source file does not exist,
#   - the project or config does not exist.
# =============================================================================
set -euo pipefail

PROJECT=""
CONFIG=""
ENV_FILE=""
DRY_RUN=0

usage() {
  sed -n '3,22p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project)  PROJECT="${2:?--project requires a value}"; shift 2 ;;
    --config)   CONFIG="${2:?--config requires a value}"; shift 2 ;;
    --file)     ENV_FILE="${2:?--file requires a value}"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)  usage 0 ;;
    *)          echo "error: unknown arg: $1" >&2; usage 1 ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }
say() { echo "[doppler-bootstrap] $*"; }

[ -n "$PROJECT" ]  || die "--project is required"
[ -n "$CONFIG" ]   || die "--config is required"
[ -n "$ENV_FILE" ] || die "--file is required"

command -v doppler >/dev/null 2>&1 \
  || die "doppler CLI not found. Install: https://docs.doppler.com/docs/install-cli"

[ -f "$ENV_FILE" ] || die "env file not found: $ENV_FILE"

# Auth check. `doppler me` exits non-zero when no token is available.
if ! doppler me --json >/dev/null 2>&1; then
  die "not authenticated. Run 'doppler login' first."
fi

# Verify project + config exist. `doppler configs get` exits 1 if missing.
if ! doppler configs get "$CONFIG" --project "$PROJECT" >/dev/null 2>&1; then
  die "config '$CONFIG' does not exist in project '$PROJECT'. Create it with: doppler configs create $CONFIG --project $PROJECT"
fi

say "uploading $ENV_FILE -> doppler:$PROJECT/$CONFIG"
[ "$DRY_RUN" = "1" ] && say "(dry-run mode)"

# Build a temp file of "K=V" lines, skipping:
#   - blank lines
#   - comment lines (start with #)
#   - obvious placeholder values
#   - keys ending in _EXAMPLE / _PLACEHOLDER (defensive)
TMP=$(mktemp -t doppler-bootstrap.XXXXXX)
trap 'rm -f "$TMP"' EXIT

UPLOADED=0
SKIPPED=0
while IFS= read -r line || [ -n "$line" ]; do
  # strip CR (in case file has CRLF)
  line="${line%$'\r'}"
  case "$line" in
    ""|"#"*) SKIPPED=$((SKIPPED+1)); continue ;;
  esac
  # must contain =
  case "$line" in
    *=*) ;;
    *) SKIPPED=$((SKIPPED+1)); continue ;;
  esac

  KEY="${line%%=*}"
  VAL="${line#*=}"

  # trim whitespace from key
  KEY="$(printf '%s' "$KEY" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  # skip placeholder-suffixed keys
  case "$KEY" in
    *_EXAMPLE|*_PLACEHOLDER|"") SKIPPED=$((SKIPPED+1)); continue ;;
  esac

  # skip placeholder values
  case "$VAL" in
    REPLACE-*|*PLACEHOLDER*|*ChangeMe*|"")
      say "  skip $KEY (placeholder value)"
      SKIPPED=$((SKIPPED+1))
      continue
      ;;
  esac

  printf '%s=%s\n' "$KEY" "$VAL" >> "$TMP"
  UPLOADED=$((UPLOADED+1))
done < "$ENV_FILE"

say "  $UPLOADED keys ready, $SKIPPED skipped"

if [ "$UPLOADED" = "0" ]; then
  die "nothing to upload — every line was blank, a comment, or a placeholder."
fi

if [ "$DRY_RUN" = "1" ]; then
  say "would upload the following keys:"
  awk -F= '{print "    " $1}' "$TMP"
  exit 0
fi

# `doppler secrets upload` accepts dotenv-formatted stdin and merges with
# existing keys (will overwrite collisions, will not delete absent keys).
doppler secrets upload "$TMP" \
  --project "$PROJECT" \
  --config  "$CONFIG"

say "done. Verify with: doppler secrets --project $PROJECT --config $CONFIG"
