#!/usr/bin/env bash
# Create DigitalOcean deployment Epic + Stories + Tasks in Jira via REST API.
#
# Prerequisites:
#   - Jira Cloud site with a Software/Team-managed project
#   - API token: https://id.atlassian.com/manage-profile/security/api-tokens
#
# Usage:
#   export JIRA_SITE="taban.atlassian.net"
#   export JIRA_EMAIL="you@example.com"
#   export JIRA_API_TOKEN="..."
#   export JIRA_PROJECT="TH"          # project key
#   ./scripts/jira-create-deploy-backlog.sh
#
# Dry run (prints payloads only):
#   DRY_RUN=1 ./scripts/jira-create-deploy-backlog.sh
#
set -euo pipefail

: "${JIRA_SITE:?Set JIRA_SITE (e.g. your-org.atlassian.net)}"
: "${JIRA_EMAIL:?Set JIRA_EMAIL}"
: "${JIRA_API_TOKEN:?Set JIRA_API_TOKEN}"
: "${JIRA_PROJECT:?Set JIRA_PROJECT (project key)}"

AUTH="$(printf '%s:%s' "$JIRA_EMAIL" "$JIRA_API_TOKEN" | base64 | tr -d '\n')"
BASE="https://${JIRA_SITE}/rest/api/3"
DRY_RUN="${DRY_RUN:-0}"

declare -A ISSUE_KEYS

api() {
  local method="$1" path="$2" body="${3:-}"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] $method $path" >&2
    [[ -n "$body" ]] && echo "$body" | head -c 500 >&2
    echo "DRY-RUN-KEY"
    return 0
  fi
  local resp
  if [[ -n "$body" ]]; then
    resp="$(curl -sS -X "$method" \
      -H "Authorization: Basic $AUTH" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      -d "$body" \
      "$BASE$path")"
  else
    resp="$(curl -sS -X "$method" \
      -H "Authorization: Basic $AUTH" \
      -H "Accept: application/json" \
      "$BASE$path")"
  fi
  local key err
  key="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('key',''))" 2>/dev/null || true)"
  err="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errorMessages',d.get('errors','')))" 2>/dev/null || true)"
  if [[ -z "$key" ]]; then
    echo "Jira API error: $resp" >&2
    exit 1
  fi
  echo "$key"
}

adf_para() {
  python3 -c "import json; print(json.dumps({'type':'paragraph','content':[{'type':'text','text':'''$1'''}]}))"
}

create_issue() {
  local type="$1" summary="$2" description="$3" parent_key="${4:-}"
  local body
  body="$(python3 - "$type" "$summary" "$description" "$parent_key" "$JIRA_PROJECT" <<'PY'
import json, sys
itype, summary, description, parent_key, project = sys.argv[1:6]
fields = {
  "project": {"key": project},
  "summary": summary,
  "description": {
    "type": "doc",
    "version": 1,
    "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}],
  },
  "issuetype": {"name": itype},
  "labels": ["deployment", "digitalocean"],
}
if parent_key:
  fields["parent"] = {"key": parent_key}
print(json.dumps({"fields": fields}))
PY
)"
  api POST "/issue" "$body"
}

link_to_epic() {
  local story_key="$1" epic_key="$2"
  [[ -z "$story_key" || -z "$epic_key" ]] && return 0
  [[ "$DRY_RUN" == "1" ]] && return 0
  # Team-managed: parent on Story may already be set. Company-managed: set Epic Link field.
  local epic_field
  epic_field="$(curl -sS \
    -H "Authorization: Basic $AUTH" \
    -H "Accept: application/json" \
    "$BASE/field" | python3 -c "
import sys, json
for f in json.load(sys.stdin):
    if f.get('name') == 'Epic Link' and f.get('custom'):
        print(f['id'])
        break
" 2>/dev/null || true)"
  [[ -z "$epic_field" ]] && return 0
  local body
  body="$(python3 -c "import json; print(json.dumps({'fields': {'$epic_field': '$epic_key'}}))")"
  api PUT "/issue/$story_key" "$body" >/dev/null || true
}

if [[ -n "${EPIC_KEY:-}" ]]; then
  echo "Using existing Epic: $EPIC_KEY"
else
  echo "Creating Epic..."
  EPIC_KEY="$(create_issue "Epic" \
    "DigitalOcean deployment — staging & CI/CD" \
    "Deploy TamamHealth to DO droplet. See docs/JIRA-DEPLOY-BACKLOG.md and docs/DEPLOY-DIGITALOCEAN.md.")"
  echo "  Epic: $EPIC_KEY"
fi
ISSUE_KEYS[epic]="$EPIC_KEY"

create_story_with_tasks() {
  local story_summary="$1"
  local story_desc="$2"
  shift 2
  local story_key
  story_key="$(create_issue "Story" "$story_summary" "$story_desc")"
  link_to_epic "$story_key" "$EPIC_KEY"
  echo "  Story: $story_key — $story_summary"
  while [[ $# -gt 0 ]]; do
    local task_summary="$1" task_desc="$2"
    shift 2
    local task_key
    task_key="$(create_issue "Subtask" "$task_summary" "$task_desc" "$story_key")"
    echo "    Subtask: $task_key — $task_summary"
    sleep 0.3
  done
}

add_subtasks_to_story() {
  local story_key="$1"
  shift
  link_to_epic "$story_key" "$EPIC_KEY"
  while [[ $# -gt 0 ]]; do
    local task_summary="$1" task_desc="$2"
    shift 2
    local task_key
    task_key="$(create_issue "Subtask" "$task_summary" "$task_desc" "$story_key")"
    echo "    Subtask: $task_key — $task_summary"
    sleep 0.3
  done
}

echo "Creating Stories and Tasks..."

if [[ -n "${PHASE1_STORY_KEY:-}" ]]; then
  echo "  Story (existing): $PHASE1_STORY_KEY — Phase 1"
  add_subtasks_to_story "$PHASE1_STORY_KEY" \
    "Create DigitalOcean account, project, and billing" "Sign up at digitalocean.com; attach payment method." \
    "Confirm domain registrar / DNS access" "Can add A records for @, app, couch." \
    "Verify CI passes on main" "Latest main commit green in GitHub Actions." \
    "Generate SSH key pair" "ssh-keygen -t ed25519; save public key for DO droplet."
else
  create_story_with_tasks "Phase 1 — Accounts & prerequisites" "Manual account setup before infrastructure." \
    "Create DigitalOcean account, project, and billing" "Sign up at digitalocean.com; attach payment method." \
    "Confirm domain registrar / DNS access" "Can add A records for @, app, couch." \
    "Verify CI passes on main" "Latest main commit green in GitHub Actions." \
    "Generate SSH key pair" "ssh-keygen -t ed25519; save public key for DO droplet."
fi

create_story_with_tasks "Phase 2 — DigitalOcean infrastructure" "Droplet, firewall, reserved IP, DNS." \
  "Create DO droplet (Ubuntu 22.04, 4GB+ RAM)" "4GB demo; 8GB+ production. Region FRA1 or BLR1." \
  "Assign Reserved IP to droplet" "DO Networking → Reserved IPs." \
  "Create DO Cloud Firewall (22, 80, 443)" "Do not open 5984 or 5432." \
  "Point @, app, couch DNS to reserved IP" "dig +short app.domain returns IP." \
  "(Production) LUKS block volume" "Skip for demo. See DEPLOYMENT-AND-ROLLOUT.md."

create_story_with_tasks "Phase 3 — Secrets & environment configuration" "Env files before docker compose build." \
  "Run scripts/gen-secrets.sh" "Writes .env and platform/website production env files." \
  "Set NEXT_PUBLIC_* URLs and org metadata" "Couch URL, app URL, sync enabled, org name." \
  "Set TAMAMHEALTH_LICENSE_KEY" "In platform/.env.production; never commit." \
  "Escrow secrets off-server" "Password manager + break-glass per docs/operations/secrets.md." \
  "(Optional) Configure Doppler" "dev/stg/prd configs and DOPPLER_TOKEN on host."

create_story_with_tasks "Phase 4 — First deploy on droplet" "Manual deploy via deploy.sh." \
  "Clone repo to /opt/tamamhealth" "git clone on droplet after SSH." \
  "Install env files on server" "scp or Doppler; chmod 600." \
  "Run preflight.sh and deploy.sh" "sudo bash deploy.sh" \
  "Verify TLS on app and couch subdomains" "Caddy auto-issue." \
  "Admin login smoke test" "Bootstrap login; core UI loads." \
  "(Optional) analytics profile" "docker compose --profile analytics up -d."

create_story_with_tasks "Phase 5 — CI/CD automation (GitHub → staging)" "GHCR + SSH auto-deploy." \
  "Create GitHub Environment staging" "Repo Settings → Environments." \
  "Add STAGING_SSH_HOST, USER, KEY secrets" "See deploy-staging.yml." \
  "Add docker-compose.ghcr.yml override" "So docker compose pull uses GHCR images." \
  "docker login ghcr.io on server" "If packages are private." \
  "Set GH_OWNER in server .env" "For image tag resolution." \
  "Verify auto-deploy on push to main" "deploy-staging after green ci."

create_story_with_tasks "Phase 6 — Post-deploy operations" "Backups, admin setup, monitoring." \
  "Rotate bootstrap admin password" "On first login." \
  "Create first hospital and facility admin" "Per RBAC-MATRIX.md." \
  "Configure offsite encrypted backups" "DO Spaces or S3-compatible." \
  "Run backup-restore-drill.sh" "Document successful drill." \
  "Enable DO weekly droplet backups" "Production: high priority." \
  "(Optional) email, SMS, Sentry, payments" "Only integrations in use."

create_story_with_tasks "Phase 7 — Optional enhancements" "Terraform, fingerprint, swap." \
  "Add infra/digitalocean/ Terraform" "Reproducible staging infra." \
  "Document fingerprint-bridge desk setup" "Bridge on desk PC, not cloud." \
  "Add 2GB swap if build OOMs" "See DEPLOY-DIGITALOCEAN.md §6."

echo ""
echo "Done. Epic: $EPIC_KEY"
echo "Open: https://${JIRA_SITE}/browse/${EPIC_KEY}"
echo ""
echo "Note: If Epic→Story linking failed, link stories manually via Epic Link field."
echo "See docs/JIRA-DEPLOY-BACKLOG.md for full descriptions and acceptance criteria."
