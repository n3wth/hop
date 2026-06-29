// Shared SEO constants. Single source of truth for the production origin,
// default title/description/tagline, and brand colors used across the
// Metadata API (layout), the OG image, the manifest, robots, and sitemap.
//
// metadataBase / canonical / OG urls must point at the PROD origin, never the
// localhost APP_BASE_URL the Auth0 SDK uses. Override with NEXT_PUBLIC_SITE_URL
// for preview deploys; otherwise fall back to prod.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://hop.n3wth.com'

export const SITE_NAME = 'hop'

// Strong, on-brand default. Confident, terse — matches "One search. The smarter
// way to book." No emoji, no marketing slop.
export const DEFAULT_TITLE = 'hop — points vs cash, settled'

// ~150 chars. What hop actually does, in plain language.
export const DEFAULT_DESCRIPTION =
  'hop reads your real points balances, compares award vs cash for the same flight, and gives you the verdict — plus where your miles can actually take you.'

// One line for the social card.
export const TAGLINE = 'One search. The smarter way to book.'

// Brand palette.
export const TEAL = '#0d6e6e'
export const CREAM = '#f3f1ec'
export const INK = '#19545d'
