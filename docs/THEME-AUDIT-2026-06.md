# Tamam Health — Cross-App Theme & Code Audit

**Date:** 2026-06-10
**Scope:** platform, website, mobile, backend services (sync-worker, country-node, regional-exchange, infra)
**Brief:** unify theme (branding, UI, copy, conventions), fix broken links/code, report what's next.

---

## TL;DR

The single biggest issue is **colour**: there is no shared source of truth, and the three apps run three different palettes — none of which matches the official Tamam Style Guide (June 2026). The guide and two of the three apps' logos are **green** (`#0d8844`); the platform UI is **blue**; mobile is a third teal-green.

I fixed the safe, unambiguous problems now (logos, token source-of-truth, a divergent token, a hidden font bug) and have **not** blindly recoloured the platform's ~1,900-line blue stylesheet — that is a deliberate, build-verified migration, not a find-and-replace. The decision and a plan are below.

No broken links, missing assets, or broken routes were found.

---

## The canonical theme (source of truth)

From `Logos/BRAND-IMPLEMENTATION.md` + `Tamam_Style_Guide_Draft.pdf` (last edited June 2026):

| Token | Hex | Role |
|-------|-----|------|
| Primary green | `#0d8844` | Mark, primary actions, accents |
| Dark green | `#0e4724` | Wordmark, headings, deep surfaces |
| Mint tint | `#e6f2ef` | Pale background wash |
| Amber (alt) | `#e39e25` / `#8f5b24` | Illustrative accent only |
| Blue (alt) | `#4591ce` / `#13284e` | Illustrative accent only |

> "Default product theme is **green** (`#0d8844` primary, `#0e4724` secondary)."

---

## What I found

### 1. Three divergent palettes (the headline issue)

| Surface | Primary | Secondary | Verdict |
|---------|---------|-----------|---------|
| **Brand guide** | `#0d8844` green | `#0e4724` dark green | canonical |
| **Website** logos | `#0d8844` | `#0e4724` | matches brand |
| **Mobile** logo | `#0d8844` | — | matches brand |
| **Website** tokens | `#1E3A8A` navy | `#2563EB` blue | **off-brand (blue)** |
| **Platform** tokens + logos | `#3b82f6` blue | `#1e3a8a` navy | **off-brand (blue)** |
| **Mobile** UI tokens | `#1B9E77` / `#2A7A6E` | `#1A3A3A` | **third palette (teal-green)** |

So: the platform was deliberately re-themed blue at some point (its `globals.css` comments literally say "deep brand blue / blue-600"), the website kept blue tokens but green logos, and mobile uses its own "Pan-African" teal-green set whose comment claims it "matches the platform" — it does not.

### 2. Platform logos were blue while everything else is green ✅ FIXED

All four platform logo/icon SVGs rendered blue (sidebar, login, favicon, patient portal, lock screen), while the website and mobile show the green brand mark. Recoloured in place to brand green — geometry untouched, files validated as well-formed XML.

### 3. `branding.ts` default is a drift bug ⚠️ FLAGGED (not auto-fixed)

`platform/src/lib/branding.ts` — the comment says *"Tamam Healthcare System brand greens (style guide, June 2026)"* but the values are blue (`#3b82f6` / `#1e3a8a`). Left intentionally: flipping it to green alone produces a **mixed** UI (the 658 CSS-variable-driven elements would go green while ~327 hard-coded blue hex literals stay blue). It should change as part of the migration below, not in isolation.

### 4. Hidden font bug — platform body font never loads

`platform/src/app/globals.css` declares `Untitled Sans` but its `@font-face` is commented out (the CDN URL was truncated with a literal `…`), so the platform silently falls back to **Arial**. Meanwhile the Tailwind config still lists `Untitled Sans` first. Net: fonts diverge three ways — platform → Arial, website → DM Sans / Plus Jakarta Sans, mobile → system default. None share a typeface.

### 5. Token-layer divergence ✅ PARTLY FIXED

`tamamhealth.teal` was `#3b82f6` (platform) vs `#2563EB` (website). Aligned platform to `#2563EB`. Added a shared, brand-correct `brand.*` token namespace to **both** web Tailwind configs so future code has one place to pull from.

### 6. Config & conventions — healthy ✅

Next.js `14.2.35` and React 18 are aligned across platform/website/mobile; `strict: true` everywhere; ESLint present in all three. No action needed.

### 7. No broken links or dead assets ✅

Every `/assets/...` reference resolves to a real file (incl. `tamam-icon.svg`). No broken internal routes found. The 23 `TODO`/`FIXME` markers are intentional engineering notes (biometric auth v2, payment reconciliation), not defects.

---

## What I changed (6 files, all verified)

| File | Change |
|------|--------|
| `platform/public/assets/tamam-icon.svg` | blue → brand green |
| `platform/public/assets/tamamhealth-icon.svg` | blue → brand green + mint |
| `platform/public/assets/tamamhealth-logo.svg` | blue → brand green |
| `platform/public/assets/tamamhealth-logo-full.svg` | blue → brand green/dark-green |
| `platform/tailwind.config.ts` | added `brand.*` tokens; `tamamhealth.teal` → `#2563EB` |
| `website/tailwind.config.ts` | added `brand.*` tokens |

Verified: SVGs parse as valid XML; `tsc` on the Tailwind config exits 0.

> **Note on the working tree:** when I started, ~112 other files were already modified (uncommitted, dated Jun 9) from prior work. Those are **not** mine — my changes are exactly the 6 above. Worth committing or stashing the rest so the history stays clean.

---

## The decision I did NOT make for you

**Should the product be green (brand-correct) or stay blue (current platform reality)?**

I recommend **green** — it's what the official June 2026 style guide mandates, what the website/mobile logos already use, and what `branding.ts` was *meant* to be. But a full migration is not a safe find-and-replace:

- `globals.css` (~1,900 lines) defines blue CSS-variable defaults plus blue-tuned gradients and shadows (`rgba(30,58,138,…)`).
- ~327 hard-coded blue hex literals (`#3b82f6` ×244, `#1e3a8a` ×83) are scattered through components.
- The blue values were hand-tuned for AA contrast; swapping hues blind risks failing accessibility checks.

This needs a build + visual QA pass, which I can't run in this environment. I scoped my changes to avoid shipping a half-green/half-blue UI.

---

## What's next for the platform (recommended roadmap)

**Now (this week)**
1. Decide green vs blue (recommend green). Once confirmed, I'll run the full migration: flip `globals.css` variable defaults + `branding.ts`, sweep the ~327 hard-coded literals onto `var(--accent-*)` / `brand.*` tokens, re-check AA contrast, and verify with a build.
2. Fix the font: either supply the real `Untitled Sans` WOFF2 URL or commit to a Google font (DM Sans) across all three apps so platform/website/mobile share one typeface.

**Next (this month)**
3. Extract a shared design-token package (`@tamam/tokens`) consumed by both Tailwind configs and mobile's `theme.ts`, so "three palettes" can never happen again.
4. Align mobile's palette and fonts to the same tokens (it's the most divergent surface).
5. Replace hard-coded hex literals with tokens repo-wide; add an ESLint rule to ban raw hex in `src/`.

**Later**
6. Shared UI primitives (Button, Card, PatientName, Logo) in one package across web + mobile.
7. Visual regression tests (Playwright/Chromatic) so theme drift is caught in CI.
8. A short `CONTRIBUTING`/brand section pointing future work at the token source of truth.

---

## Areas of improvement (themes observed)

- **No single source of truth for design** — the root cause of every divergence here. The new `brand.*` tokens are a start; a shared package is the real fix.
- **Comments drift from code** (`branding.ts`, mobile `theme.ts`, `globals.css` all describe a different colour than they implement) — a sign theme changes were made in a rush without updating intent.
- **Large uncommitted working tree** (~112 files) — commit cadence is making it hard to tell intentional changes from drift.
- **Fonts are an afterthought** — a disabled `@font-face` silently degrading to Arial in production is the kind of thing visual regression tests would catch.
