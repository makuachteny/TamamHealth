# TamamHealth Website — Color, Contrast & Accessibility Audit

Scope: the marketing site (`website/`), primarily `app/marketing.css`. All contrast ratios below are computed against WCAG 2.1 (AA needs **4.5:1** for normal text, **3:1** for large/bold ≥18.66px or bold ≥14px; AAA needs 7:1).

## TL;DR

The palette is well-chosen and the brand navy (`#10195A`) reads beautifully, but a few high-traffic colors are being used as **text/UI on light backgrounds where they fail AA**, and the palette is a bit too wide (6 accent families) to feel tightly professional. The three highest-impact fixes: stop using the medium blue `#2191D0` as text/link/CTA color, darken the gold/green when they carry text, and tighten focus-state handling.

---

## 1. Contrast problems (fix these first)

| Color (token) | Used as | On | Ratio | AA normal? | Verdict |
|---|---|---|---|---:|---|
| `#2191D0` `--tb-blue-700` | text / links (37 rules) | cream/white | **3.5:1** | ✗ | Fails. Biggest issue. |
| white | button text | on `#2191D0` CTA | **3.5:1** | ✗ (✓ large) | Small labels fail. |
| `#DFA83A` `--tb-gold` | text | white | **2.1:1** | ✗ | Fails badly — decorative only. |
| `#1E8A5E` `--tb-green` | text | white | **3.9:1** | ✗ (✓ large) | Fails for body text. |
| `#64748B` `--tb-text-ter/muted` | small captions | cream | **4.8:1** | ✓ (barely) | OK but tight; avoid <14px. |
| `#10195A` `--tb-text-pri` | body text | cream | ~15:1 | ✓✓✓ | Excellent. |
| `#015697` `--tb-blue-800` | text / CTA | white | **7.6:1** | ✓✓✓ | Use this for links/CTAs. |

**What to change:**
- **Links & inline accents → `#015697` (blue-800)**, not `#2191D0`. Reserve `#2191D0` for **fills, icons, borders, and large display text** only. This one swap fixes the majority of the 37 low-contrast usages.
- **Primary CTA buttons → `#015697` background** with white text (7.6:1). Keep `#2191D0` as the **hover/gradient** state, not the resting fill.
- **Gold and green as text → their `-dark` tokens** (`#9A6B1F`, `#14663F`). Gold especially must never sit under text at `#DFA83A`.
- **Tertiary text → `#475569`** instead of `#64748B` (lifts ~4.8:1 → ~7:1) so captions and metadata are comfortably readable, including for low-vision users and on lower-quality screens common in the field.

## 2. Rearranging the palette for a more professional feel

Right now there are six accent families (blue, green, gold, red, rose, iris). That's a lot of hues competing for attention. A tighter system reads as more trustworthy — important for a clinical product:

- **Brand core:** navy `#10195A` (primary text + hero) and one accent blue `#015697` (interactive). Use `#2191D0`/`#369FDA` only as tints, gradients, and illustration fills.
- **Semantic, used sparingly and consistently:** green = success/positive, gold = caution/highlight, red = error/critical. Give each a single "on-light text" value (the `-dark` variant) and a single tint for backgrounds.
- **Retire or demote rose + iris** to illustration-only. Two decorative hues doing brand-adjacent work dilutes the identity; fold their roles into the semantic set where possible.
- **Section rhythm via tints, not hues:** alternate `--tb-cream-50` and a very light blue/green tint for section backgrounds instead of introducing saturated blocks — cleaner, calmer, more enterprise.
- Lock a **3-step text ramp** everywhere: primary `#10195A`, secondary `#26336F`, tertiary `#475569`. No ad-hoc greys.

## 3. Transitions

- **`transition: all` appears 3×.** Replace with explicit properties (`transform, opacity, background-color, color, box-shadow`). `all` animates layout properties too and causes jank / accidental reflow animations.
- **Durations are inconsistent** (0.15s–0.7s across the file, plus mixed `.15s` vs `0.15s`). Standardize: **~150ms** for hover/press feedback, **~250–300ms** for reveals, and cap decorative motion at ~400ms. The 0.6–0.7s transitions feel sluggish on hover.
- Add a shared easing token (e.g. `cubic-bezier(0.25,0.1,0.25,1)`) rather than per-rule easings, so motion feels consistent.

## 4. Accessibility

- **Focus visibility:** there are 6 `outline: none/0` rules and 31 `:focus` (vs 22 `:focus-visible`). Two risks: (a) any `outline:none` **without** a paired `:focus-visible` style leaves keyboard users with no focus indicator (a WCAG 2.4.7 failure); (b) plain `:focus` shows rings on mouse click too. **Action:** audit each `outline:none`, ensure a clear `:focus-visible` ring (2px, `#015697`, 2px offset) on every interactive element, and prefer `:focus-visible` over `:focus`.
- **Reduced motion:** 4 `prefers-reduced-motion` blocks exist — good. Verify they cover the hero/parallax and any scroll-driven or looping animations (those are the ones that trigger vestibular issues).
- **Images:** one `<img>` is missing an `alt` attribute — add it (empty `alt=""` if decorative).
- **Contrast for non-text UI (WCAG 1.4.11):** icon-only buttons, form borders, and focus rings also need **3:1** against their background. The glass borders (`rgba(1,86,151,0.18)`) are ~1.3:1 against cream — fine as decoration, but don't rely on them alone to indicate an input's boundary; pair with a stronger `#015697`-based border or label.
- **Don't encode meaning in color alone** (WCAG 1.4.1): where green/gold/red convey status, add an icon or text label too — important for the ~1 in 12 users with color-vision deficiency and for sunlight-washed mobile screens.

## 5. Prioritized action list

1. Swap link/inline-accent color `#2191D0` → `#015697` (fixes ~37 failures).
2. Repaint primary CTA to `#015697` bg / white text; `#2191D0` becomes hover.
3. Move gold/green text to `-dark` tokens; bump tertiary text to `#475569`.
4. Replace the 3 `transition: all` and standardize durations/easing.
5. Guarantee a visible `:focus-visible` ring on every interactive element; remove risky bare `outline:none`.
6. Add the missing `alt`, and add icon/label backups wherever status is color-only.
7. (Design) Consolidate 6 accent families down to brand blue + 3 semantic colors; demote rose/iris to illustration.

Items 1–5 are mostly find-and-replace in `marketing.css` and are safe, high-impact accessibility wins. I can implement 1–6 directly if you'd like.
