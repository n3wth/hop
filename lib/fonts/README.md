# OG card fonts

Vendored copies of hop's brand fonts, used **only** to render dynamic Open Graph
cards via `next/og` (Satori). Satori needs TTF/OTF/WOFF — not the WOFF2 that
`next/font` ships — so these are committed here and read at build time by
`lib/og.ts#ogFonts` (the OG routes are statically prerendered, so the files are
only needed during `next build`, never at runtime).

| File | Family / weight | Source | License |
|---|---|---|---|
| `BricolageGrotesque-700.woff` | Bricolage Grotesque, 700 (display) | Google Fonts | SIL Open Font License 1.1 |
| `GeneralSans-Regular.otf` | General Sans, 400 (body) | Fontshare | ITF Free Font License (free commercial use) |
| `GeneralSans-Semibold.otf` | General Sans, 600 (body) | Fontshare | ITF Free Font License (free commercial use) |

Both licenses permit embedding and commercial redistribution. These match the
fonts loaded for the live app in `app/layout.tsx` (Bricolage via `next/font`,
General Sans via Fontshare), so the cards read in hop's own type.
