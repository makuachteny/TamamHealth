# GitHub Environments — staging + production secrets

Configure repo **Settings → Environments** so [deploy-staging.yml](../../.github/workflows/deploy-staging.yml)
and [deploy-production.yml](../../.github/workflows/deploy-production.yml) can SSH to
DigitalOcean droplets.

Parent doc: [jira-github-do-tracking.md](./jira-github-do-tracking.md).

---

## Create environments

**GitHub → makuachteny/TamamHealth → Settings → Environments**

1. **New environment** → name: `staging`
2. **New environment** → name: `production`
   - Enable **Required reviewers** (at least one ops lead)
   - Optional: **Wait timer** (e.g. 5 minutes) for production

---

## Staging secrets

Environment: **`staging`**

| Secret | Description |
|--------|-------------|
| `STAGING_SSH_HOST` | Staging droplet reserved IP or hostname |
| `STAGING_SSH_USER` | SSH user (usually `root`) |
| `STAGING_SSH_KEY` | Private key (PEM), full contents including `BEGIN/END` lines |
| `STAGING_APP_DIR` | Optional; default `/opt/tamamhealth` |

Generate a deploy key pair:

```bash
ssh-keygen -t ed25519 -C "tamamhealth-staging-deploy" -f ~/.ssh/tamamhealth_staging -N ""
cat ~/.ssh/tamamhealth_staging.pub   # add to staging droplet authorized_keys
cat ~/.ssh/tamamhealth_staging       # paste into STAGING_SSH_KEY secret
```

---

## Production secrets

Environment: **`production`**

| Secret | Description |
|--------|-------------|
| `PROD_SSH_HOST` | Production droplet reserved IP |
| `PROD_SSH_USER` | SSH user (usually `root`) |
| `PROD_SSH_KEY` | **Separate** private key from staging |
| `PROD_APP_DIR` | Optional; default `/opt/tamamhealth` |

Use a different key than staging (`tamamhealth_prod`).

---

## Droplet prerequisites

On **each** droplet before first CI deploy:

```bash
cd /opt/tamamhealth
git pull
cat infra/digitalocean/staging.env.append >> .env    # or production.env.append
docker login ghcr.io -u YOUR_GITHUB_USER
# PAT needs read:packages if GHCR images are private
```

Ensure [`docker-compose.ghcr.yml`](../../docker-compose.ghcr.yml) exists in the clone.

---

## Verify

1. Merge any commit to `main` → wait for **ci** then **deploy-staging**
2. **deploy-staging** → job **ssh deploy to staging host** should not skip
3. Log should show: `Deployed sha=… tag=staging`
4. On staging droplet: `docker compose -f docker-compose.yml -f docker-compose.ghcr.yml ps`

Production:

1. **Actions → deploy-production → Run workflow**
2. `target`: **vps**
3. Approve in **production** environment
4. Log: `Deployed sha=… tag=production`

---

## Using GitHub CLI (optional)

```bash
gh auth login
gh secret set STAGING_SSH_HOST --env staging --body "203.0.113.10"
gh secret set STAGING_SSH_USER --env staging --body "root"
gh secret set STAGING_SSH_KEY --env staging < ~/.ssh/tamamhealth_staging
```

Repeat for `PROD_*` on environment `production`.

Run [`scripts/verify-deploy-pipeline.sh`](../../scripts/verify-deploy-pipeline.sh) locally to validate workflow + compose files.
