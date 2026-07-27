# Contributing to TamamHealth

## Getting set up

One command from a fresh clone:

```bash
./scripts/setup.sh
```

It pins your Node version, installs every package, activates the git hooks,
seeds `platform/.env.local`, and finishes with a type-check so you know the
toolchain actually works. Useful flags:

| Flag | Effect |
|------|--------|
| `--fast` | Skip `mobile/` (much the largest install) |
| `--check` | Verify an existing setup; install nothing |

Then:

```bash
cd platform && npm run dev     # http://localhost:3000
```

For generated secrets and a guided config walkthrough, run
`node platform/scripts/setup.mjs`.

### Three gotchas that bite everyone

- **Leave `DATABASE_URL` unset for normal dev.** The platform is offline-first
  and runs on PouchDB in the browser. Setting `DATABASE_URL` switches on the
  Postgres analytics path, and you will chase phantom connection errors.
- **`rm -rf platform/.next` after switching branches.** Next caches hard enough
  that you will be served the other branch's pages.
- **Run `nvm use` in every new shell.** Node is pinned in `.nvmrc`; drifting off
  it is what produced the macOS-vs-Linux lockfile break and the Node-ESM outage.

### Node version

`.nvmrc` is the single source of truth — CI reads the same file via
`node-version-file`, so local and CI cannot drift apart. `engines` in each
`package.json` is pinned to the same major.

---

## Pre-commit hooks

`husky` + `lint-staged` run automatically on `git commit`, scoped to the
packages your commit actually touches:

- **eslint `--fix`** on the staged files — auto-fixable problems are repaired
  in place.
- **`tsc --noEmit`** on the whole affected package. TypeScript can't check
  these files in isolation (path aliases, JSX, ambient types all come from the
  tsconfig), so it's one project-wide check per touched package.
- **`bash -n`** on any changed shell script, and a YAML parse on changed
  workflow/compose files.

A commit with a lint or type error is blocked locally, in seconds, instead of
failing CI six minutes later.

```bash
git commit --no-verify      # emergency bypass
```

Config lives in [`.lintstagedrc.mjs`](.lintstagedrc.mjs) and
[`scripts/lint-staged-runner.mjs`](scripts/lint-staged-runner.mjs).

If hooks aren't firing, run `npm install` at the repo root — that's what
registers them.

---

## Review routing

[`.github/CODEOWNERS`](.github/CODEOWNERS) auto-requests reviewers by path.
Per-area owners are **not yet assigned** — everything currently routes to
`@makuachteny`. If you own a subsystem, put your handle on it.

---

## Jira integration (smart commits)

We track deployment and platform work in Jira (**tamamorg.atlassian.net**, project **KAN**).

### Branch names

```text
feat/KAN-91-ghcr-compose
fix/KAN-92-admin-password-rotation
```

### Commit messages

Include the issue key at the start:

```text
KAN-91 Add docker-compose.ghcr.yml for GHCR staging deploys
```

### Pull requests

- **Title:** include the Jira key — `KAN-91 Add GHCR compose override`
- **Description:** link and auto-close when merged:

```markdown
## Summary
Adds docker-compose.ghcr.yml so deploy-staging can pull pre-built images.

Closes KAN-91
```

Supported verbs (with GitHub for Jira installed): `Closes`, `Fixes`, `Resolves`.

### After merge

- **main** → CI → **deploy-staging** updates the staging droplet (`:staging` tag).
- Production: run **deploy-production** manually (`target: vps`) after staging smoke test.

Full operator guide: [docs/operations/jira-github-do-tracking.md](docs/operations/jira-github-do-tracking.md).

---

## CI gates

[`ci.yml`](.github/workflows/ci.yml) runs four independent jobs on every push
and PR. All must be green before merge:

| Job | What it runs |
|-----|--------------|
| `platform` | lint + type-check + test + build |
| `website` | lint + type-check + build |
| `mobile` | lint + type-check |
| `fingerprint-bridge` | syntax check + tests |

The pre-commit hook covers the lint and type-check halves locally, so CI
failures should mostly be test or build failures.

Green `ci` on `main` then triggers `deploy-staging` automatically.

---

## Code review

See [docs/PRINCIPLES.md](docs/PRINCIPLES.md) and the PR template checklist.

## Local development

See [docs/DEVELOPER-ONBOARDING.md](docs/DEVELOPER-ONBOARDING.md).
