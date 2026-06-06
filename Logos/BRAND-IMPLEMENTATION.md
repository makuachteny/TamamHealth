# Tamam Healthcare System — Brand Implementation

Generated from `Tamam_Style_Guide_Draft.pdf` (Last edited June 2026). This documents
the logo system and exactly how/where each asset is wired into the products.

## Brand colors

| Token | Hex | Use |
|-------|-----|-----|
| Primary green | `#0d8844` | Dot-cluster mark, accents, primary actions |
| Dark green | `#0e4724` | Wordmark, headings, deep UI surfaces |
| Amber (alt) | `#e39e25` / `#8f5b24` | Secondary/illustrative accent only |
| Blue (alt) | `#4591ce` / `#13284e` | Secondary/illustrative accent only |
| Mint tint | `#e6f2ef` | Pale background wash |

Default product theme is **green** (`#0d8844` primary, `#0e4724` secondary). Per-organization
custom branding still overrides at runtime via `branding.ts`.

## Logo system → source files

All masters live in `Logos/svgs/` (vector) and `Logos/pngs/` (raster).

| Variant | Uppercase master | Lowercase master |
|---------|------------------|------------------|
| Primary (horizontal, wordmark + mark) | `Tamam_Style_Guide-11.svg` | `Tamam_Style_Guide-12.svg` |
| Secondary (stacked, mark over wordmark) | `Tamam_Style_Guide-13.svg` | `Tamam_Style_Guide-14.svg` |
| Tertiary (mark left, wordmark right) | `Tamam_Style_Guide-15.svg` | `Tamam_Style_Guide-16.svg` |
| Submark TA / ta | `Tamam_Style_Guide-17.svg` | `Tamam_Style_Guide-19.svg` |
| Submark TM / tm | `Tamam_Style_Guide-18.svg` | `Tamam_Style_Guide-20.svg` |
| Text-only + tagline | `Tamam_Style_Guide-21.svg` | `Tamam_Style_Guide-23.svg` |
| Text-only wordmark | `Tamam_Style_Guide-22.svg` | `Tamam_Style_Guide-25.svg` |

> Note: the primary/secondary/tertiary masters render the "healthcare system" tagline as
> live text in the proprietary **All Round Gothic** typeface. They are print/design masters.
> For web/app use we ship font-independent vector lockups (below), where the mark and the
> `tamam` wordmark are fully outlined so they render identically everywhere.

## Shipped (font-independent) product assets

Created in both apps under `public/assets/`:

| File | Contents | Where it's used |
|------|----------|-----------------|
| `tamamhealth-logo.svg` | Dot-cluster **icon** (square) in primary green | Sidebar mark, login mark, compact spots, favicon source |
| `tamam-icon.svg` | Same icon, explicit name | App icon / favicon |
| `tamamhealth-logo-full.svg` | Lowercase `tamam` wordmark + mark (horizontal) | Headers, login, marketing hero, full lockups |

Mobile renders the same mark + wordmark via `mobile/src/components/TamamHealthLogo.tsx`
(react-native-svg), so all three surfaces share one mark.

## Clear space & minimum size

Keep clear space ≥ the diameter of the largest dot in the mark on all sides.
Minimum icon size 24px; minimum full lockup width 120px.
