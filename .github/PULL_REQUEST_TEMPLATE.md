## Summary

<!-- What does this PR do, and why? Link the issue/task if one exists. -->

## Principles check

<!-- See docs/PRINCIPLES.md. Tick what applies; explain anything you can't tick. -->

- [ ] **Offline-first** — the change works with the network disabled (no clinical workflow requires connectivity)
- [ ] **Data layer** — operational reads/writes go through the service layer → PouchDB; no new operational dependency on Postgres
- [ ] **Tenant isolation** — new/changed synced documents carry `orgId`; sync direction in `sync-config.ts` is justified
- [ ] **No mandatory cloud** — any new external service no-ops gracefully when unconfigured
- [ ] **PHI safety** — no patient data in logs, error reports, or URLs
- [ ] **Permissions** — new routes added to `role-routes.ts` with the narrowest role set; sensitive actions write an audit log entry
- [ ] N/A — docs/tooling-only change

## Testing

<!-- How was this verified? Unit tests, manual steps, offline test, etc. -->

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Tested with DevTools → Network → Offline (if user-facing)

## Notes for reviewers

<!-- Risky areas, migration/seed implications (SEED_VERSION bump?), follow-ups. -->
