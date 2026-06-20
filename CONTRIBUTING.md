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

See [docs/DEVELOPER-ONBOARDING.md](docs/DEVELOPER-ONBOARDING.md).
