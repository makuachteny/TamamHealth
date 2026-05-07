#!/bin/bash
# =============================================================================
# TamamHealth — one-shot VPS deployment script
# =============================================================================
# Run this on a FRESH Ubuntu 22.04 VPS (root or sudo user). It will:
#   1. install Docker + Caddy
#   2. clone the repo and copy env files you've uploaded
#   3. build + start the stack
#   4. configure Caddy so TLS is auto-provisioned by Let's Encrypt
#
# Before running, you need:
#   - A VPS with a public IP
#   - 3 DNS A records pointing at it:
#       tamamhealth.org           → <VPS IP>
#       app.tamamhealth.org       → <VPS IP>
#       couch.tamamhealth.org     → <VPS IP>
#   - Your filled-in env files copied to the VPS (see "ENV FILES" below)
# =============================================================================
set -euo pipefail

# ----- EDIT THESE -----------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/YOUR-ORG/tamamhealth.git}"
APP_DIR="${APP_DIR:-/opt/tamamhealth}"
DOMAIN_ROOT="${DOMAIN_ROOT:-tamamhealth.org}"
DOMAIN_APP="${DOMAIN_APP:-app.tamamhealth.org}"
DOMAIN_COUCH="${DOMAIN_COUCH:-couch.tamamhealth.org}"
# ----------------------------------------------------------------------------

say() { echo -e "\033[1;36m[deploy]\033[0m $*"; }
die() { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

# ===== 1. SYSTEM PREREQUISITES =============================================
say "Updating apt and installing Docker + Caddy"
apt-get update -y
apt-get install -y ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https

# Docker
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# Caddy (official repo)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# ===== 2. REPO + ENV FILES =================================================
if [ ! -d "$APP_DIR/.git" ]; then
  say "Cloning repo to $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  say "Repo exists; pulling latest"
  (cd "$APP_DIR" && git pull)
fi

cd "$APP_DIR"

# Verify env files exist (you must upload these via scp BEFORE running the script)
for f in ".env" "platform/.env.production" "website/.env.production"; do
  [ -f "$f" ] || die "Missing $APP_DIR/$f — upload it first: scp $f root@<VPS>:$APP_DIR/$f"
done

# Sanity-check: no placeholders should have survived
if grep -q "REPLACE\|PLACEHOLDER\|ChangeMe" platform/.env.production; then
  die "platform/.env.production still has placeholders. Fill in real values and re-run."
fi

# ===== 3. CADDY CONFIG =====================================================
say "Writing /etc/caddy/Caddyfile"
cat > /etc/caddy/Caddyfile <<EOF
# Marketing site
${DOMAIN_ROOT}, www.${DOMAIN_ROOT} {
    reverse_proxy localhost:3001
    encode gzip
}

# Clinician + patient platform
${DOMAIN_APP} {
    reverse_proxy localhost:3000
    encode gzip
}

# CouchDB (browser-facing for live sync)
${DOMAIN_COUCH} {
    reverse_proxy localhost:5984
    # CouchDB needs CORS for browser PouchDB replication
    header {
        Access-Control-Allow-Origin "https://${DOMAIN_APP}"
        Access-Control-Allow-Credentials true
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, HEAD"
        Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With, X-CouchDB-Www-Authenticate"
    }
}
EOF

systemctl reload caddy || systemctl restart caddy

# ===== 4. BUILD + START ====================================================
say "Building images (tags with current git SHA)"
export NEXT_PUBLIC_BUILD_ID="$(git rev-parse --short HEAD)"
docker compose build

say "Bringing the stack up"
docker compose up -d

# Wait for health
say "Waiting for services to become healthy (timeout 120s)"
for i in $(seq 1 60); do
  if docker compose ps --format json | grep -q '"Health":"healthy"'; then
    say "Services reporting healthy"
    break
  fi
  sleep 2
done

# ===== 5. INIT COUCHDB SYSTEM DBS ==========================================
say "Initializing CouchDB system databases (idempotent)"
COUCH_USER="$(grep '^COUCHDB_USER=' .env | cut -d= -f2)"
COUCH_PASS="$(grep '^COUCHDB_PASSWORD=' .env | cut -d= -f2)"
for db in _users _replicator _global_changes; do
  curl -sf -X PUT "http://${COUCH_USER}:${COUCH_PASS}@localhost:5984/${db}" \
    >/dev/null 2>&1 && echo "  created $db" || echo "  $db already exists"
done

# ===== 6. SUMMARY ==========================================================
cat <<EOF

\033[1;32m[deploy] done.\033[0m

• Marketing:       https://${DOMAIN_ROOT}
• Clinician app:   https://${DOMAIN_APP}/login
• Patient portal:  https://${DOMAIN_APP}/patient-portal
• CouchDB admin:   https://${DOMAIN_COUCH}/_utils (log in with COUCHDB_USER)

First login: use \$NEXT_PUBLIC_ADMIN_NAME + \$NEXT_PUBLIC_ADMIN_PASSWORD
from platform/.env.production. Change the password immediately after first login.

Ops:
  docker compose logs -f platform     # tail platform logs
  docker compose ps                   # service health
  docker compose restart platform     # restart one service
  docker compose down && docker compose up -d   # full restart

Backups are running nightly to the couchdb_backups Docker volume
(/var/lib/docker/volumes/tamamhealth_couchdb_backups/_data on the host).
Rsync that directory offsite for full DR.
EOF
