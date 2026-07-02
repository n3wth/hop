# Dark footer treatment — design

## Context

The site owner flagged the footer as visually thin — narrow content marooned in a lot of
unused whitespace at wide viewports (already partly fixed: capped/centered the brand+nav row,
fixed a double-padding bug that misaligned it against page content). Separately, they shared a
screenshot of another product's footer (Ada — dark green background, oversized pink logotype,
newsletter signup) with "tbh this is cool," and confirmed they want to pull two specific things
from it: a dark background, and a bold, oversized brand mark as a graphic element. Explicitly
**not** wanted: a newsletter signup (real new feature/backend scope, out of scope here) or a
literal copy of Ada's pink-on-green palette (hop already has its own dark-surface palette).

## Decisions

- **Background**: `SiteFooter`'s `<footer>` fill changes from transparent to
  `var(--color-brand-ink)` (`#073e3e`) — the exact same dark teal already used on the login
  page's brand panel. No new color introduced.
- **Text tokens**: reuse the existing hero-* palette built for text-on-`brand-ink` (all already
  defined in `app/globals.css`, all already used on the login page):
  - Wordmark link → `text-hero-cream`, hover → white
  - Tagline → `text-hero-body`
  - Social icons → `text-hero-label`, hover → white
  - `FooterNav` section labels (Explore/Learn/Legal) → `text-hero-eyebrow`
  - `FooterNav` links → `text-hero-body`, hover → white/cream; active-page link → bold white
  - Legal-row divider → `--color-hero-line` (`rgba(255,255,255,0.16)`) instead of `border-hair`
    (a light-surface hairline that wouldn't read on the dark fill)
- **Oversized mark**: a large `Logo` (bunny mark) bleeding off the bottom-right corner —
  `position: absolute`, `overflow-hidden` on `<footer>` so it never spills into the page below.
  Rendered at low opacity (`text-brand-muted/40`) with `carve="var(--color-brand-ink)"` so its
  negative space matches the new fill. All real content sits above it via `relative z-10` —
  identical layering technique to the login page's aside (`components/login` reference:
  `Logo size={340} decorative carve="var(--color-brand-ink)" className="absolute -bottom-16
  -right-14 text-brand-muted/40"`). Sized larger here (~420–460px vs. 340px) since the footer
  spans the full shell width rather than a narrow column — should read as a real corner-anchor,
  not a duplicate of the exact login-page instance.
- **Scope — chosen approach**: "A" from three proposed (corner-bleed, reusing the exact
  already-shipped login-page pattern) over a bold contained centerpiece (no existing precedent,
  more design risk) or a full-bleed background watermark (likely undersells the boldness the
  Ada reference reacted to).
- **Applies to**: every page that renders `SiteFooter` — which today is every page except
  `/ask` (confirmed: `/ask` doesn't render `SiteFooter` at all, so no special-casing is needed).
- **Explicitly out of scope**: newsletter signup / email capture (real new feature, separate
  scope), any change to nav structure/copy, any layout structural change beyond what's already
  shipped (the capped-at-1200px, centered brand+nav row).

## Files touched

- `components/SiteFooter.tsx` — background, wordmark/tagline/social colors, oversized `Logo`
  instance, legal-row divider color.
- `components/FooterNav.tsx` — section-label and link colors (safe to hardcode directly; this
  component has no other, light-background usage — confirmed via grep, only imported by
  `SiteFooter.tsx`).

No new dependencies. No new automated tests — this is a pure presentational/color change with
nothing behavioral to unit test.

## Verification

Visual check only:
1. Every text element (wordmark, tagline, social icons, nav labels, nav links, legal row) reads
   with sufficient contrast against `--color-brand-ink`.
2. The bunny mark doesn't overlap or obscure any nav link at any breakpoint — including the
   mobile stacked-column layout, where the corner position needs to stay clear of the now-taller
   stacked content.
3. `npm run check` (lint + typecheck + test) still passes — regression check, not a new-behavior
   check.
