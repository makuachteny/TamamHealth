#!/usr/bin/env bash
# Install pull-based auto-deploy on a TamamHealth droplet.
#
# WHY: the droplet firewall allows SSH only from the admin CIDR, so GitHub's
# hosted runners can never SSH in to push a deploy (deploy-staging.yml's SSH
# step is permanently gated off by the firewall even when secrets are set).
# Instead, the droplet polls GHCR itself: every 5 minutes it pulls the compose
# images and restarts any service whose image changed. `docker compose pull`
# is cheap when nothing changed and `up -d` is a no-op unless a new image
# arrived, so the steady-state cost is a few registry HEAD requests.
#
# USAGE (as root on the droplet, e.g. via the DigitalOcean web console):
#   cd /opt/tamamhealth && git pull && sudo bash scripts/install-self-deploy.sh
#
# PREREQS (already done if the droplet was bootstrapped per the README):
#   - /opt/tamamhealth/.env contains GH_OWNER, IMAGE_TAG and
#     COMPOSE_FILE=docker-compose.yml:docker-compose.ghcr.yml
#   - `docker login ghcr.io` has been run (PAT with read:packages — the GHCR
#     packages are private)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/tamamhealth}"
LOG_FILE="/var/log/tamamhealth-self-deploy.log"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env not found — bootstrap the droplet first (see infra/digitalocean/README.md)" >&2
  exit 1
fi
if ! grep -q '^COMPOSE_FILE=' "$APP_DIR/.env"; then
  echo "ERROR: COMPOSE_FILE not set in $APP_DIR/.env — append infra/digitalocean/<env>.env.append first" >&2
  exit 1
fi

cat > /usr/local/bin/tamamhealth-self-deploy <<EOS
#!/usr/bin/env bash
# Written by scripts/install-self-deploy.sh — do not edit by hand.
set -uo pipefail
cd "$APP_DIR" || exit 0
echo "[\$(date -u '+%Y-%m-%dT%H:%M:%SZ')] pulling…"
# COMPOSE_FILE / GH_OWNER / IMAGE_TAG come from .env (compose reads it from cwd).
docker compose pull --quiet || { echo "pull failed"; exit 1; }
docker compose up -d --remove-orphans
docker image prune -f > /dev/null
echo "[\$(date -u '+%Y-%m-%dT%H:%M:%SZ')] done"
EOS
chmod +x /usr/local/bin/tamamhealth-self-deploy

cat > /etc/cron.d/tamamhealth-self-deploy <<EOC
# Pull-based auto-deploy — see scripts/install-self-deploy.sh in the repo.
*/5 * * * * root /usr/local/bin/tamamhealth-self-deploy >> $LOG_FILE 2>&1
EOC
chmod 644 /etc/cron.d/tamamhealth-self-deploy

# Run once immediately so the droplet updates now rather than in <=5 minutes.
/usr/local/bin/tamamhealth-self-deploy | tee -a "$LOG_FILE"

echo ""
echo "Installed. The droplet now self-updates from GHCR every 5 minutes."
echo "Log: $LOG_FILE"
