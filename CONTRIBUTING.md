# Contributing to TamamHealth

## Jira integration (smart commits)

We track deployment and platform work in Jira (**taban.atlassian.net**, project **SCRUM**).

### Branch names

```text
feat/SCRUM-98-ghcr-compose
fix/SCRUM-103-admin-password-rotation
```

### Commit messages

Include the issue key at the start:

```text
SCRUM-98 Add docker-compose.ghcr.yml for GHCR staging deploys
```

### Pull requests

- **Title:** include the Jira key — `SCRUM-98 Add GHCR compose override`
- **Description:** link and auto-close when merged:

```markdown
## Summary
Adds docker-compose.ghcr.yml so deploy-staging can pull pre-built images.

Closes SCRUM-98
```

Supported verbs (with GitHub for Jira installed): `Closes`, `Fixes`, `Resolves`.

### After merge

- **main** → CI → **deploy-staging** updates the staging droplet (`:staging` tag).
- Production: run **deploy-production** manually (`target: vps`) after staging smoke test.

Full operator guide: [docs/operations/jira-github-do-tracking.md](docs/operations/jira-github-do-tracking.md).

---

## Code review

See [docs/PRINCIPLES.md](docs/PRINCIPLES.md) and the PR template checklist.

## Local development

### Quick start (one command)

```bash
./scripts/setup.sh
```

Checks your Node version (`.nvmrc`), installs deps for the root + `platform` + `website` + `mobile`, seeds `.env.local` files, and installs the git pre-commit hooks. Idempotent — safe to re-run. Then:

```bash
cd platform && npm run dev   # http://localhost:3000
cd website  && npm run dev   # http://localhost:3001
```

Deeper guide: [docs/DEVELOPER-ONBOARDING.md](docs/DEVELOPER-ONBOARDING.md).

### Node version

Pinned in `.nvmrc`. Run `nvm use` (or `nvm install`) so your local Node, CI, and each package's `engines` all agree — this prevents "works on my machine" build breaks.

### Pre-commit hooks

`husky` + `lint-staged` run on every commit: `eslint --fix` on staged files plus a project-level `tsc --noEmit` for `platform`/`website`. **A commit with lint or type errors is blocked locally** (before it ever reaches CI). Hooks install when you run `npm install` at the repo root (or `./scripts/setup.sh`). Emergency bypass: `git commit --no-verify`.

### CI gates

Every PR must pass four checks before it can merge: **`platform`**, **`website`**, **`mobile`**, and **`fingerprint-bridge`** (lint + type-check + tests/build). The pre-commit hooks run the same lint/type checks locally, so *green locally ≈ green CI*.

### Gotchas

- **App aborts at boot with `STARTUP REFUSED — Postgres migrations failed`** — `DATABASE_URL` points at a Postgres that isn't running. Local dev is offline-first (PouchDB); leave `DATABASE_URL` commented out in `platform/.env.local` (`setup.sh` does this for you).
- **`vendor-chunks` 500s after switching branches** — stale Next build cache: `rm -rf platform/.next`.
