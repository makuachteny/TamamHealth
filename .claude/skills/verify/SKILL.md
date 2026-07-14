---
name: verify
description: Build/launch/drive recipe for verifying TamamHealth platform UI changes end-to-end in a real browser.
---

# Verifying TamamHealth changes

The app is the Next.js project in `platform/`.

## Launch

- `cd platform && npm run dev` — but check first: the user usually already has a dev
  server on **http://localhost:3000** (`.next/dev/logs/next-development.log`). If one is
  running, drive that instead of starting another (a second `next dev` exits with
  "Another next dev server is already running"). Turbopack hot-reloads edits, so no restart needed.

## Login (seeded demo users)

- Credentials live in `platform/.seed-credentials.json` (gitignored; JSON after a `#` comment
  line — strip up to the first `{` before parsing). Usernames/roles are defined in
  `platform/src/lib/db-seed.ts` (e.g. `co.deng` = clinical officer, `dr.wani` = doctor).
- `/login` shows an account list: click the `.tl-user` entry for the person, fill
  `#tl-password`, then click `.tl-submit`.
- Gotcha: the submit button is disabled until the browser-side PouchDB finishes seeding
  ("Initializing offline database…") — wait for `.tl-submit:not([disabled])`, can take
  tens of seconds on a fresh browser profile.
- Gotcha: `.tl-user` picker clicks also silently no-op during that init — wait until
  "Initializing offline database" disappears from body text before clicking a profile.
- Users not on the picker: click `.tl-link:has-text("Other account")` then fill `#tl-name`.
- The picker shows a curated list by display name + role label (defined in `login/page.tsx`),
  not usernames — e.g. the Juba doctor row is `clinician.peter` ("Doctor · Juba Teaching
  Hospital"); `dr.wani` is seeded but not listed. Match on the role text, then use that
  username's password.

## Drive

- No Playwright in the repo. `npm i playwright` in the scratchpad works; Chromium is already
  cached in `~/Library/Caches/ms-playwright`.
- Use viewport width ≥1280 (xl) to see the consultation right rail (`.ehr-chart-details`,
  `hidden xl:block`); below 1280 the top patient picker (`.ehr-consult-patient-picker`)
  takes over patient selection.
- Data is per-hospital: which patients appear depends on which seeded user you log in as.
- First login shows a full-screen "Get Started" onboarding overlay (`div.absolute.inset-0.z-30`)
  that intercepts all clicks. "Skip setup" confirms via `window.confirm`, which headless
  Playwright auto-cancels — register `page.on('dialog', d => d.accept())` before clicking it.
- The clinician dashboard (`/dashboard`) lists only appointments with
  `providerId === currentUser._id`; seed appointment dates are relative
  (`dateFromNow(n)`/`dateAgo(n)` in `db-seed.ts`). Mini-calendar days are addressable
  via `button[data-date="YYYY-MM-DD"]`.
- Print styles: `page.emulateMedia({ media: 'print' })` + screenshot/`page.pdf()`.
  Global print CSS hides every `button:not(.print-visible)`.
