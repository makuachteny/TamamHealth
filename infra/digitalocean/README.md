# DigitalOcean — staging + production droplets

Two parallel Ubuntu 22.04 droplets run the same [`docker-compose.yml`](../../docker-compose.yml)
stack with [`docker-compose.ghcr.yml`](../../docker-compose.ghcr.yml) for GHCR pulls.

Tracking doc: [`docs/operations/jira-github-do-tracking.md`](../../docs/operations/jira-github-do-tracking.md).

---

## Staging droplet

| Setting | Value |
|---------|-------|
| Size | 4 GB / 2 vCPU (Basic, FRA1 or BLR1) |
| DNS | `app.staging.<domain>`, `couch.staging.<domain>` |
| `IMAGE_TAG` | `staging` |
| Doppler config | `stg` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| GitHub Environment | `staging` → `STAGING_SSH_*` secrets |

## Production droplet

| Setting | Value |
|---------|-------|
| Size | 8 GB / 4 vCPU+ |
| DNS | `app.<domain>`, `couch.<domain>` |
| `IMAGE_TAG` | `production` |
| Doppler config | `prd` |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| GitHub Environment | `production` → `PROD_SSH_*` secrets (required reviewers) |

**Residency:** DO is suitable for demo/staging and pre-pilot. Real PHI production
should move in-country or to `af-south-1` — see [`docs/AFRICA-HOSTING-STRATEGY.md`](../../docs/AFRICA-HOSTING-STRATEGY.md).

---

## Per-droplet checklist

1. Create droplet + attach SSH key + assign **Reserved IP**
2. Cloud Firewall: inbound **22** (your IP), **80**, **443** only
3. DNS A records → reserved IP
4. Run bootstrap:

```bash
ssh root@<reserved-ip>
git clone https://github.com/makuachteny/TamamHealth.git /opt/tamamhealth
cd /opt/tamamhealth
./scripts/gen-secrets.sh
# Edit platform/.env.production URLs for this environment (staging vs prod subdomains)
cp infra/digitalocean/staging.env.append .env.ghcr   # or production.env.append
cat .env.ghcr >> .env
./scripts/preflight.sh
sudo bash deploy.sh   # first boot: builds locally; after CI wired, use GHCR pull only
```

5. `docker login ghcr.io` (PAT with `read:packages` if GHCR packages are private)
6. Set `DOPPLER_TOKEN` on host (separate token per droplet — never share stg/prd)

---

## After GitHub CI is wired

Staging auto-deploys on every green `main` build. Production promotes manually via
**Actions → deploy-production → Run workflow** (`target: vps`).

Verify on host:

```bash
cd /opt/tamamhealth
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml ps
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml images
```
