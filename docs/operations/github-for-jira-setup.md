# GitHub for Jira — setup (taban.atlassian.net)

One-time install to link Jira issues with GitHub PRs, commits, and (optionally)
deployments for **makuachteny/TamamHealth**.

Parent doc: [jira-github-do-tracking.md](./jira-github-do-tracking.md).

---

## 1. Install the app

1. Open **https://taban.atlassian.net**
2. **Settings** (gear) → **Apps** → **Explore apps** (or Atlassian Marketplace)
3. Search **GitHub for Jira** (by Atlassian)
4. Click **Get app** → install for **taban**
5. Complete OAuth: authorize **GitHub** and select org/user **makuachteny**

---

## 2. Connect the repository

1. In Jira: **Apps → GitHub → Get started** (or **Manage your GitHub accounts**)
2. **Add organization** → `makuachteny`
3. **Include repositories** → select **TamamHealth** (or all repos)
4. Enable:
   - **Pull request linking**
   - **Commit linking**
   - **Deployments** (if shown)

---

## 3. Verify

1. Open any SCRUM issue (e.g. [SCRUM-98](https://taban.atlassian.net/browse/SCRUM-98))
2. Check **Development** panel — should show “Connect to GitHub” or linked items after first PR
3. Open a test PR on GitHub with `SCRUM-98` in the title — issue should link within a few minutes

---

## 4. Smart commits (team convention)

In commit messages:

```text
SCRUM-98 Add GHCR compose override for staging deploys
```

In PR description:

```text
Closes SCRUM-98
Fixes SCRUM-97
```

Jira moves issues to **Done** when merged if your workflow allows smart-commit transitions.

Full conventions: [CONTRIBUTING.md](../CONTRIBUTING.md#jira-integration-smart-commits).

---

## 5. Cursor / VS Code (Atlascode)

Cursor is authenticated to **taban.atlassian.net**. Update user settings if the Jira
sidebar still shows **inchcapeglobal**:

```json
"atlascode.jira.jqlList": [
  {
    "name": "My SCRUM Issues",
    "query": "project = SCRUM AND assignee = currentUser() AND resolution = Unresolved ORDER BY lastViewed DESC",
    "siteId": "03f67228-adf2-4432-b323-f5eb3f788025",
    "enabled": true,
    "monitor": true
  }
]
```

Site ID `03f67228-adf2-4432-b323-f5eb3f788025` = **taban**.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| PRs not linking | Confirm repo included in GitHub for Jira settings; key must match `SCRUM-123` |
| Wrong GitHub org | Re-authorize app under **makuachteny** |
| Deployments empty | GitHub Deployments API not used yet — track SHA manually in Jira comments |
